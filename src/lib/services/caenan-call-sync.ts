/**
 * Syncs Caenan Assistant calls (including full artifact + transcript) into local Supabase.
 * Called server-side from API routes — never exposes raw Vapi data to the client.
 */

import { getSupabaseAdminClient } from "@/lib/supabase-admin";

type VapiMessage = {
  role?: string;
  message?: string;
  content?: string;
  transcript?: string;
  time?: number;
  secondsFromStart?: number;
};

type VapiCall = {
  id: string;
  assistantId?: string;
  type?: string;
  status?: string;
  customer?: { number?: string };
  createdAt?: string;
  startedAt?: string;
  endedAt?: string;
  cost?: number;
  artifact?: {
    recordingUrl?: string;
    stereoRecordingUrl?: string;
    transcript?: string;
    messages?: VapiMessage[];
  };
  analysis?: { summary?: string };
  messages?: VapiMessage[];
  transcript?: string;
  [key: string]: unknown;
};

function extractMessages(call: VapiCall): VapiMessage[] {
  if (Array.isArray(call.artifact?.messages) && call.artifact!.messages.length > 0) {
    return call.artifact!.messages;
  }
  if (Array.isArray(call.messages) && call.messages.length > 0) {
    return call.messages;
  }
  return [];
}

function extractTranscriptText(call: VapiCall): string | null {
  if (call.artifact?.transcript && typeof call.artifact.transcript === "string") {
    return call.artifact.transcript;
  }
  if (call.transcript && typeof call.transcript === "string") {
    return call.transcript as string;
  }
  const msgs = extractMessages(call);
  if (msgs.length > 0) {
    return msgs
      .map((m) => {
        const text = m.message ?? m.content ?? m.transcript ?? "";
        return text ? `${m.role ?? "unknown"}: ${text}` : null;
      })
      .filter(Boolean)
      .join("\n");
  }
  return null;
}

function calcDuration(call: VapiCall): number | null {
  const start = call.startedAt ?? call.createdAt;
  const end = call.endedAt;
  if (!start || !end) return null;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return Math.max(0, Math.round(ms / 1000));
}

export async function syncCaenanCallsToLocal(calls: VapiCall[]): Promise<void> {
  const admin = getSupabaseAdminClient();
  if (!admin || calls.length === 0) return;

  for (const call of calls) {
    if (!call.id) continue;

    const callRow = {
      id:                   call.id,
      vapi_assistant_id:    call.assistantId ?? null,
      type:                 call.type ?? null,
      status:               call.status ?? null,
      customer_number:      call.customer?.number ?? null,
      started_at:           call.startedAt ?? call.createdAt ?? null,
      ended_at:             call.endedAt ?? null,
      duration_seconds:     calcDuration(call),
      recording_url:        call.artifact?.recordingUrl ?? null,
      stereo_recording_url: call.artifact?.stereoRecordingUrl ?? null,
      transcript_text:      extractTranscriptText(call),
      summary:              call.analysis?.summary ?? null,
      cost:                 call.cost ?? null,
      full_payload:         call as unknown as Record<string, unknown>,
      synced_at:            new Date().toISOString(),
    };

    const { error: upsertErr } = await admin
      .from("caenan_calls")
      .upsert(callRow, { onConflict: "id" });

    if (upsertErr) {
      console.error("[sync] caenan_calls upsert error:", upsertErr.message);
      continue;
    }

    // Upsert transcript messages only when we have them (avoids wiping on list-only fetches)
    const messages = extractMessages(call);
    if (messages.length > 0) {
      await admin.from("caenan_call_messages").delete().eq("call_id", call.id);

      const messageRows = messages.map((m, i) => ({
        call_id:      call.id,
        role:         m.role ?? "unknown",
        content:      m.message ?? m.content ?? m.transcript ?? null,
        time_seconds: m.time ?? m.secondsFromStart ?? null,
        seq:          i,
      }));

      const { error: msgErr } = await admin
        .from("caenan_call_messages")
        .insert(messageRows);

      if (msgErr) {
        console.error("[sync] caenan_call_messages insert error:", msgErr.message);
      }
    }
  }
}

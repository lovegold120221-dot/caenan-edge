import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

const ALLOWED_TABLES = ["caenan_calls", "caenan_call_messages", "tts_history", "api_keys", "api_usage", "user_assistants", "user_agents"];

export async function GET(request: NextRequest) {
  try {
    const table = request.nextUrl.searchParams.get("table");
    const ping  = request.nextUrl.searchParams.get("ping");

    const admin = getSupabaseAdminClient();
    if (!admin) {
      // No local Supabase configured — return offline gracefully
      if (ping) return NextResponse.json({ ok: false, error: "not_configured" });
      return NextResponse.json({ rows: [], count: 0, offline: true });
    }

    // Ping — confirm DB is reachable
    if (ping) {
      try {
        const { error } = await admin.from("caenan_calls").select("id").limit(1);
        if (error) return NextResponse.json({ ok: false, error: error.message });
        return NextResponse.json({ ok: true });
      } catch {
        return NextResponse.json({ ok: false, error: "unreachable" });
      }
    }

    if (!table || !ALLOWED_TABLES.includes(table)) {
      return NextResponse.json({ error: "Invalid or missing table name." }, { status: 400 });
    }

    try {
      const { data, error, count } = await admin
        .from(table)
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) {
        return NextResponse.json({ rows: [], count: 0, offline: true });
      }
      return NextResponse.json({ rows: data ?? [], count: count ?? 0 });
    } catch {
      return NextResponse.json({ rows: [], count: 0, offline: true });
    }
  } catch {
    // Top-level safety net — never let this route return 500
    return NextResponse.json({ rows: [], count: 0, offline: true });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

const ALLOWED_TABLES = ["caenan_calls", "caenan_call_messages", "tts_history", "api_keys", "api_usage", "user_assistants", "user_agents"];

export async function GET(request: NextRequest) {
  const table = request.nextUrl.searchParams.get("table");
  const ping  = request.nextUrl.searchParams.get("ping");

  const admin = getSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: "Local Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY." },
      { status: 503 }
    );
  }

  // Ping — confirm DB is reachable
  if (ping) {
    try {
      const { error } = await admin.from("caenan_calls").select("id").limit(1);
      if (error) return NextResponse.json({ ok: false, error: error.message });
      return NextResponse.json({ ok: true });
    } catch (err) {
      return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) });
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
      return NextResponse.json({ rows: [], count: 0, offline: true, error: error.message });
    }
    return NextResponse.json({ rows: data ?? [], count: count ?? 0 });
  } catch (err) {
    // Network-level failure (e.g. 127.0.0.1 unreachable on Vercel) — degrade gracefully
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ rows: [], count: 0, offline: true, error: message });
  }
}

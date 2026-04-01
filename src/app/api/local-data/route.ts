import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

const ALLOWED_TABLES = ["caenan_calls", "caenan_call_messages", "tts_history", "api_keys", "api_usage", "user_assistants", "user_agents"];

export async function GET(request: NextRequest) {
  const table = request.nextUrl.searchParams.get("table");

  if (!table || !ALLOWED_TABLES.includes(table)) {
    return NextResponse.json({ error: "Invalid or missing table name." }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: "Local Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY." },
      { status: 503 }
    );
  }

  const { data, error, count } = await admin
    .from(table)
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ rows: data ?? [], count: count ?? 0 });
}

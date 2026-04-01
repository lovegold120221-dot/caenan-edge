import { NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/supabase-server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { generateApiKeyForUser, getApiKeyPrefix, hashApiKey } from "@/lib/api-key-auth";

export const dynamic = "force-dynamic";

async function getAuthedUser(request: Request) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) return null;
  const admin = getSupabaseAdminClient();
  if (!admin) return null;
  return { admin, userId };
}

export async function GET(request: Request) {
  const auth = await getAuthedUser(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await auth.admin
    .from("api_keys")
    .select("id, name, key_prefix, created_at, last_used_at, revoked_at")
    .eq("user_id", auth.userId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ keys: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await getAuthedUser(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const name =
    typeof body?.name === "string" && body.name.trim().length > 0
      ? body.name.trim().slice(0, 80)
      : "Default key";

  const rawApiKey = generateApiKeyForUser(auth.userId);
  const keyHash = hashApiKey(rawApiKey);
  const keyPrefix = getApiKeyPrefix(rawApiKey);

  const { data, error } = await auth.admin
    .from("api_keys")
    .insert({
      user_id: auth.userId,
      name,
      key_hash: keyHash,
      key_prefix: keyPrefix,
    })
    .select("id, name, key_prefix, created_at, last_used_at, revoked_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ key: data, rawApiKey });
}


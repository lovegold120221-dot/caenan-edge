import { NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/supabase-server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

async function getAuthedAdmin(request: Request) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) return null;
  const admin = getSupabaseAdminClient();
  if (!admin) return null;
  return { admin, userId };
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthedAdmin(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Key ID required" }, { status: 400 });

  const { data, error } = await auth.admin
    .from("api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", auth.userId)
    .is("revoked_at", null)
    .select("id")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "API key not found" }, { status: 404 });

  return NextResponse.json({ ok: true, id: data.id });
}


import { NextResponse } from 'next/server';
import { fetchCalls } from '@/lib/services/orbit';
import { logApiUsage, requireApiPrincipal } from '@/lib/api-key-auth';
import { syncCaenanCallsToLocal } from '@/lib/services/caenan-call-sync';

export const dynamic = 'force-dynamic';

const CAENAN_ASSISTANT_ID = '0bad3e7a-c416-44cc-aedb-08516c7db5bd';

export async function GET(request: Request) {
  const startedAtMs = Date.now();
  const auth = await requireApiPrincipal(request);
  if (!auth.ok) return auth.response;

  let status = 200;
  let errorMessage: string | null = null;
  try {
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit');
    const assistantId = searchParams.get('assistantId') ?? undefined;
    const params: { limit?: number; assistantId?: string } = {};
    if (limit != null && limit !== '') params.limit = Number(limit);
    if (assistantId) params.assistantId = assistantId;
    const calls = await fetchCalls(Object.keys(params).length > 0 ? params : undefined);

    // Sync Caenan calls to local Supabase in the background (non-blocking)
    const caenanCalls = calls.filter((c) => c.assistantId === CAENAN_ASSISTANT_ID);
    syncCaenanCallsToLocal(caenanCalls).catch((e) =>
      console.error('[sync] background sync error:', e)
    );

    return NextResponse.json(calls);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    status = 500;
    errorMessage = message;
    return NextResponse.json({ error: message }, { status });
  } finally {
    await logApiUsage({
      request,
      principal: auth.principal,
      endpoint: "/api/orbit/calls",
      statusCode: status,
      startedAtMs,
      errorMessage,
    });
  }
}

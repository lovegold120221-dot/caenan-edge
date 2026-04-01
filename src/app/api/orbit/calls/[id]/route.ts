import { NextResponse } from 'next/server';
import { fetchCallById } from '@/lib/services/orbit';
import { logApiUsage, requireApiPrincipal } from '@/lib/api-key-auth';
import { syncCaenanCallsToLocal } from '@/lib/services/caenan-call-sync';

export const dynamic = 'force-dynamic';

const CAENAN_ASSISTANT_ID = '0bad3e7a-c416-44cc-aedb-08516c7db5bd';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const startedAtMs = Date.now();
  const auth = await requireApiPrincipal(request);
  if (!auth.ok) return auth.response;

  let status = 200;
  let errorMessage: string | null = null;
  try {
    const { id } = await params;
    if (!id) {
      status = 400;
      errorMessage = "Call ID required";
      return NextResponse.json({ error: errorMessage }, { status });
    }
    const call = await fetchCallById(id);

    // Sync full call detail (transcript + artifact) to local Supabase
    if (call && call.assistantId === CAENAN_ASSISTANT_ID) {
      syncCaenanCallsToLocal([call]).catch((e) =>
        console.error('[sync] detail sync error:', e)
      );
    }

    return NextResponse.json(call);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    status = 500;
    errorMessage = message;
    return NextResponse.json({ error: message }, { status });
  } finally {
    await logApiUsage({
      request,
      principal: auth.principal,
      endpoint: "/api/orbit/calls/[id]",
      statusCode: status,
      startedAtMs,
      errorMessage,
    });
  }
}

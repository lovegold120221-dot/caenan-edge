import { NextResponse } from 'next/server';

const ECHO_API_URL = 'https://echo.eburon.ai/api';
const ECHO_API_KEY = process.env.ECHO_API_KEY || 'vph_MjE4ODhkMzctZDQz_DbIgaA9G2oZ6MsWiDKWej87Y5ja8QSGI';

export async function GET() {
  try {
    const res = await fetch(`${ECHO_API_URL}/agents`, {
      headers: {
        'Authorization': `Bearer ${ECHO_API_KEY}`,
      },
      cache: 'no-store',
    });

    if (!res.ok) {
      const text = await res.text();
      console.error('[echo/agents] Error:', res.status, text);
      return NextResponse.json({ error: 'Failed to fetch agents' }, { status: res.status });
    }

    const agents = await res.json();
    return NextResponse.json(Array.isArray(agents) ? agents : []);
  } catch (error) {
    console.error('[echo/agents] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch agents' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase-admin';
import { getUserIdFromRequest } from '@/lib/supabase-server';

function admin() {
  const client = getSupabaseAdminClient();
  if (!client) throw new Error('Supabase admin client not configured');
  return client;
}

export async function GET(req: Request) {
  try {
    const supabase = admin();
    const userId = await getUserIdFromRequest(req);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data, error } = await supabase
      .from('user_agents')
      .select('id, assistant_id, name, phone_number_id, phone_number, voice_provider, voice_id, language, first_message, system_prompt, created_at, updated_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json((data || []).map((a: { assistant_id: string; id: string; name?: string; phone_number_id?: string; phone_number?: string; voice_provider?: string; voice_id?: string; language?: string; first_message?: string; system_prompt?: string; created_at?: string; updated_at?: string }) => ({
      id: a.assistant_id,
      dbId: a.id,
      name: a.name,
      phoneNumberId: a.phone_number_id,
      phoneNumber: a.phone_number,
      voiceProvider: a.voice_provider,
      voiceId: a.voice_id,
      language: a.language,
      firstMessage: a.first_message,
      systemPrompt: a.system_prompt,
      createdAt: a.created_at,
      updatedAt: a.updated_at,
    })));
  } catch (error: unknown) {
    console.error('[user-agents GET]', error);
    return NextResponse.json({ error: 'Failed to fetch agents' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const supabase = admin();
    const userId = await getUserIdFromRequest(req);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { assistantId, name, phoneNumberId, voiceProvider, voiceId, language, firstMessage, systemPrompt } = body;

    if (!assistantId || !name) {
      return NextResponse.json({ error: 'assistantId and name are required' }, { status: 400 });
    }

    // Check if agent already exists for this user
    const { data: existing } = await supabase
      .from('user_agents')
      .select('id')
      .eq('user_id', userId)
      .eq('assistant_id', assistantId)
      .single();

    const agentData = {
      user_id: userId,
      assistant_id: assistantId,
      name,
      phone_number_id: phoneNumberId || null,
      voice_provider: voiceProvider || 'vapi',
      voice_id: voiceId || null,
      language: language || 'multilingual',
      first_message: firstMessage || null,
      system_prompt: systemPrompt || null,
      updated_at: new Date().toISOString(),
    };

    let data, error;
    if (existing?.id) {
      // Update existing
      ({ data, error } = await supabase
        .from('user_agents')
        .update(agentData)
        .eq('id', existing.id)
        .select()
        .single());
    } else {
      // Insert new
      ({ data, error } = await supabase
        .from('user_agents')
        .insert(agentData)
        .select()
        .single());
    }

    if (error) {
      console.error('[user-agents POST] Supabase error:', error);
      throw error;
    }

    return NextResponse.json({ id: assistantId, ...data });
  } catch (error: unknown) {
    console.error('[user-agents POST] Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to save agent';
    return NextResponse.json({ error: message, details: error }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const supabase = admin();
    const userId = await getUserIdFromRequest(req);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { assistantId } = await req.json();
    if (!assistantId) return NextResponse.json({ error: 'assistantId required' }, { status: 400 });

    const { error } = await supabase
      .from('user_agents')
      .delete()
      .eq('user_id', userId)
      .eq('assistant_id', assistantId);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('[user-agents DELETE]', error);
    return NextResponse.json({ error: 'Failed to delete agent' }, { status: 500 });
  }
}

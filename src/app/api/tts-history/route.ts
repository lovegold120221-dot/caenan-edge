import { NextResponse } from 'next/server';
import { getUserIdFromRequest } from '@/lib/supabase-server';
import { getSupabaseAdminClient } from '@/lib/supabase-admin';

export async function GET(request: Request) {
  const userId = await getUserIdFromRequest(request);
  const admin = getSupabaseAdminClient();
  if (!userId || !admin) return NextResponse.json([]);
  try {
    const { data, error } = await admin
      .from('tts_history')
      .select('id, text, voice_id, voice_name, audio_path, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) {
      console.error('tts-history GET error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data ?? []);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const userId = await getUserIdFromRequest(request);
  const admin = getSupabaseAdminClient();
  if (!userId || !admin) {
    return NextResponse.json(
      { error: 'Unauthorized. Storage or authentication is not configured, or no auth token was provided.' },
      { status: 401 }
    );
  }
  try {
    const formData = await request.formData();
    const text = formData.get('text') as string | null;
    const voiceId = formData.get('voice_id') as string | null;
    const voiceName = formData.get('voice_name') as string | null;
    const audioFile = formData.get('audio') as File | null;
    if (!text?.trim() || !voiceId || !voiceName || !audioFile?.size) {
      return NextResponse.json(
        { error: 'Missing text, voice_id, voice_name, or audio file' },
        { status: 400 }
      );
    }
    const ext = audioFile.name?.endsWith('.mp3') ? 'mp3' : 'mp3';
    const path = `${userId}/${crypto.randomUUID()}.${ext}`;
    const { error: uploadError } = await admin.storage
      .from('tts-audio')
      .upload(path, audioFile, { contentType: audioFile.type || 'audio/mpeg', upsert: false });
    if (uploadError) {
      console.error('tts-history upload error:', uploadError);
      return NextResponse.json(
        { error: 'Storage upload failed. Audio history storage may not be configured.' },
        { status: 500 }
      );
    }
    const { data: row, error: insertError } = await admin
      .from('tts_history')
      .insert({
        user_id: userId,
        text: text.trim(),
        voice_id: voiceId,
        voice_name: voiceName,
        audio_path: path,
      })
      .select('id, text, voice_id, voice_name, audio_path, created_at')
      .single();
    if (insertError) {
      console.error('tts-history insert error:', insertError);
      await admin.storage.from('tts-audio').remove([path]);
      return NextResponse.json(
        { error: 'History save failed. Database storage may not be configured.' },
        { status: 500 }
      );
    }
    return NextResponse.json(row);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}


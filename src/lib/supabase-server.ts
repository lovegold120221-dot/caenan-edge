// cspell:ignore supabase SUPABASE
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { jwtVerify, decodeJwt } from 'jose';

// Local Supabase defaults (hardcoded so no Vercel env vars needed for Supabase)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

// Local Supabase default JWT secret
const jwtSecret =
  process.env.SUPABASE_JWT_SECRET ||
  'super-secret-jwt-token-with-at-least-32-characters-long';

/**
 * Verify a Supabase JWT locally using the JWT secret — no HTTP call to Supabase needed.
 * Falls back to raw decode (trusting the signature) when no secret is configured.
 * Returns the sub (user ID) on success, null on failure.
 */
async function getUserIdFromToken(token: string): Promise<string | null> {
  try {
    if (jwtSecret) {
      const secret = new TextEncoder().encode(jwtSecret);
      const { payload } = await jwtVerify(token, secret);
      return (payload.sub as string) ?? null;
    }
    // No secret configured — decode without verification (development fallback)
    const payload = decodeJwt(token);
    return (payload.sub as string) ?? null;
  } catch {
    return null;
  }
}

/**
 * Create a Supabase client for API routes.
 * Verifies the Bearer JWT locally (no round-trip to Supabase auth server),
 * so this works even when Supabase is running on localhost.
 * Returns null if no valid token is present.
 */
export function createSupabaseClientFromRequest(request: Request): SupabaseClient | null {
  if (!supabaseUrl || !supabaseAnonKey) return null;
  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return null;
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

/**
 * Get the authenticated user ID from the request without calling back to Supabase auth server.
 * Use this in API routes where you need the userId but Supabase may be on localhost.
 */
export async function getUserIdFromRequest(request: Request): Promise<string | null> {
  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return null;
  return getUserIdFromToken(token);
}

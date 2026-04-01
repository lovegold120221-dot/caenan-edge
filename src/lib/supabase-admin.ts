// cspell:ignore supabase SUPABASE
import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Local Supabase defaults (hardcoded so no Vercel env vars needed for Supabase)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
// Service role key must be provided via env var (sb_secret_* format for local Supabase)
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

let adminClient: SupabaseClient | null = null;

/**
 * Service-role Supabase client for server-side privileged operations.
 * Returns null when env vars are missing.
 */
export function getSupabaseAdminClient(): SupabaseClient | null {
  if (!supabaseUrl || !supabaseServiceRoleKey) return null;
  if (adminClient) return adminClient;

  adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return adminClient;
}


// cspell:ignore supabase SUPABASE
import { createClient } from '@supabase/supabase-js'

// Get dynamic port from URL query param (Electron passes ?supabasePort=XXXXX)
function getSupabaseUrl(): string {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search)
    const port = params.get('supabasePort')
    if (port) return `http://127.0.0.1:${port}`
  }
  return process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321'
}

const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH'

export const supabase = createClient(getSupabaseUrl(), supabaseAnonKey)

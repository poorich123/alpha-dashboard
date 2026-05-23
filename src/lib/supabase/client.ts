/**
 * Supabase browser client.
 * Use this in Client Components.
 *
 * Note: We use loose typing here (untyped client) because the strict typed
 * client from @supabase/ssr has known inference issues. RLS at the DB level
 * is the real source of truth — TS types are just for autocomplete.
 */
import { createBrowserClient } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"

let _client: SupabaseClient | null = null

export function getSupabaseBrowser(): SupabaseClient {
  if (_client) return _client
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    throw new Error(
      "Supabase env vars missing. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local",
    )
  }
  _client = createBrowserClient(url, key)
  return _client
}

export function hasSupabaseConfigured(): boolean {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
}

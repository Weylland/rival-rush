import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Lit le cookie ea_sb_token (non-httpOnly) pour authentifier le client Supabase.
 * Ce token est un JWT signé avec SUPABASE_JWT_SECRET → auth.uid() fonctionne dans RLS.
 */
function getToken(): string | undefined {
  if (typeof document === "undefined") return undefined;
  const match = document.cookie.match(/(?:^|;\s*)ea_sb_token=([^;]+)/);
  return match?.[1] ? decodeURIComponent(match[1]) : undefined;
}

let _client: ReturnType<typeof createSupabaseClient> | null = null;

export function createClient() {
  if (_client) return _client;

  const token = getToken();
  const authHeader = token ? { Authorization: `Bearer ${token}` } : {};

  _client = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: {
        headers: authHeader,
      },
      realtime: {
        headers: authHeader,
        params: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! },
      },
    },
  );

  // Synchronise l'auth realtime avec le JWT player
  if (token) _client.realtime.setAuth(token);

  return _client;
}

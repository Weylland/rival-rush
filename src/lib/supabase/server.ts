import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Client Supabase côté serveur — utilise le service role key.
 * Bypasse le RLS (la sécurité est garantie par getSession() dans chaque action).
 * Ne jamais exposer ce client côté browser.
 */
export async function createClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}

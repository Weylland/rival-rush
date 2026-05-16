import { createClient } from "@supabase/supabase-js";

/**
 * Client Supabase avec service role — bypasse le RLS.
 * À utiliser uniquement dans des Server Actions ou des routes API sécurisées.
 * Ne jamais exposer côté browser.
 */
export function createAdminClient() {
  return createClient(
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

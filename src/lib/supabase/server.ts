import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Client Supabase côté serveur — lit/écrit les cookies de session.
 * Soumis au RLS via l'identité de l'utilisateur connecté.
 * Utiliser pour : auth.getUser(), opérations nécessitant le contexte utilisateur.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Components ne peuvent pas écrire des cookies — OK,
            // le middleware s'en charge.
          }
        },
      },
    },
  );
}

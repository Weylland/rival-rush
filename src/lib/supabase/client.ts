import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | undefined;

/**
 * Lit le JWT de session directement depuis le cookie `sb-<ref>-auth-token`
 * (potentiellement découpé en `.0`, `.1`…), de façon SYNCHRONE.
 *
 * Indispensable : les abonnements Realtime `postgres_changes` protégés par RLS
 * sont évalués avec le token présent sur la socket AU MOMENT de l'abonnement.
 * `getSession()` est asynchrone → la socket s'abonnerait en anonyme et ne
 * recevrait jamais les défis / DMs / invitations (auth.uid() = null). On pose
 * donc le token avant que le moindre `channel().subscribe()` ne parte.
 */
function readAccessTokenFromCookie(): string | null {
  if (typeof document === "undefined") return null;
  try {
    const chunks = document.cookie
      .split("; ")
      .filter(c => /sb-.*-auth-token(\.\d+)?=/.test(c))
      .sort();
    if (chunks.length === 0) return null;
    let raw = chunks.map(c => decodeURIComponent(c.substring(c.indexOf("=") + 1))).join("");
    if (raw.startsWith("base64-")) raw = atob(raw.slice(7));
    const session = JSON.parse(raw);
    return typeof session?.access_token === "string" ? session.access_token : null;
  } catch {
    return null;
  }
}

/**
 * Client Supabase navigateur — SINGLETON, avec Realtime authentifié.
 */
export function createClient() {
  if (client) return client;

  client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  // 1) Synchrone : token posé immédiatement, avant tout abonnement Realtime.
  const token = readAccessTokenFromCookie();
  if (token) client.realtime.setAuth(token);

  // 2) Asynchrone : resynchronise au login / refresh de token / logout.
  client.auth.onAuthStateChange((_event, session) => {
    client!.realtime.setAuth(session?.access_token ?? null);
  });

  return client;
}

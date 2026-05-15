import { createBrowserClient } from "@supabase/ssr";

function getToken(): string | undefined {
  if (typeof document === "undefined") return undefined;
  const match = document.cookie.match(/(?:^|;\s*)ea_sb_token=([^;]+)/);
  return match?.[1] ? decodeURIComponent(match[1]) : undefined;
}

export function createClient() {
  const token = getToken();
  const client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      },
    },
  );

  // Synchronise l'auth Realtime pour que RLS filtre les subscriptions aussi
  if (token) client.realtime.setAuth(token);

  return client;
}

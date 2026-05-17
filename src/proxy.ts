import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/forgot-password", "/reset-password", "/legal", "/contact", "/ios-pwa"];

// ── Maintenance mode cache (évite un appel DB à chaque requête) ───────────────
let maintenanceCache: { value: boolean; expiresAt: number } | null = null;

async function isMaintenanceOn(supabase: ReturnType<typeof createServerClient>): Promise<boolean> {
  const now = Date.now();
  if (maintenanceCache && now < maintenanceCache.expiresAt) {
    return maintenanceCache.value;
  }
  try {
    const { data } = await supabase
      .from("site_settings")
      .select("value")
      .eq("key", "maintenance_mode")
      .maybeSingle();
    const value = data?.value === true;
    maintenanceCache = { value, expiresAt: now + 30_000 }; // cache 30s
    return value;
  } catch {
    return false; // en cas d'erreur, ne pas bloquer le site
  }
}

export function invalidateMaintenanceCache() {
  maintenanceCache = null;
}

// ── Proxy principal ───────────────────────────────────────────────────────────

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Rafraîchit la session — NE PAS supprimer ou déplacer cet appel.
  const { data: { user } } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  // ── Maintenance mode ──────────────────────────────────────────────────────
  // /admin toujours accessible → gère sa propre auth (formulaire de login inline)
  // /maintenance toujours accessible (c'est la page de destination)
  // Tout le reste en maintenance → /maintenance
  // Quand maintenance OFF → /maintenance redirige vers /lobby ou /login
  const MAINTENANCE_ALWAYS_OPEN = ["/maintenance", "/admin"];

  const maintenanceOn = await isMaintenanceOn(supabase);

  if (maintenanceOn) {
    const open = MAINTENANCE_ALWAYS_OPEN.some((p) => pathname.startsWith(p));
    if (!open) {
      return NextResponse.redirect(new URL("/maintenance", request.url));
    }
  } else {
    if (pathname.startsWith("/maintenance")) {
      return NextResponse.redirect(
        new URL(user ? "/lobby" : "/login", request.url),
      );
    }
  }

  // ── Auth guard ────────────────────────────────────────────────────────────
  if (!user && !isPublic && pathname !== "/maintenance") {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (user && pathname === "/login") {
    return NextResponse.redirect(new URL("/lobby", request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

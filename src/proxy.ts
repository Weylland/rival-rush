import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/admin", "/legal", "/contact", "/ios-pwa"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  // Check for the signed session cookie (ea_session replaces the old ea_player_id)
  const session = request.cookies.get("ea_session")?.value;

  if (!session && !PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (session && pathname === "/login") {
    return NextResponse.redirect(new URL("/lobby", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/).*)"],
};

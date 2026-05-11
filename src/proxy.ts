import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/admin", "/legal"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const playerId = request.cookies.get("ea_player_id")?.value;

  if (!playerId && !PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (playerId && pathname === "/login") {
    return NextResponse.redirect(new URL("/lobby", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/).*)"],
};

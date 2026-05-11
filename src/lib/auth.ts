import { cookies } from "next/headers";
import bcrypt from "bcryptjs";

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function getSession() {
  const cookieStore = await cookies();
  const playerId = cookieStore.get("ea_player_id")?.value;
  const pseudo = cookieStore.get("ea_pseudo")?.value;
  if (!playerId || !pseudo) return null;
  return { playerId, pseudo };
}

export async function setSession(playerId: string, pseudo: string) {
  const cookieStore = await cookies();
  const opts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: 60 * 60 * 24,
    path: "/",
  };
  cookieStore.set("ea_player_id", playerId, opts);
  cookieStore.set("ea_pseudo", pseudo, opts);
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete("ea_player_id");
  cookieStore.delete("ea_pseudo");
}

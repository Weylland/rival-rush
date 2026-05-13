import { cookies } from "next/headers";
import bcrypt from "bcryptjs";

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: 60 * 60 * 24 * 30,
  path: "/",
};

export async function getSession() {
  const cookieStore = await cookies();
  const playerId = cookieStore.get("ea_player_id")?.value;
  const pseudo = cookieStore.get("ea_pseudo")?.value;
  if (!playerId || !pseudo) return null;
  const avatarUrl = cookieStore.get("ea_avatar_url")?.value ?? null;
  return { playerId, pseudo, avatarUrl };
}

export async function setSession(playerId: string, pseudo: string, avatarUrl?: string | null) {
  const cookieStore = await cookies();
  cookieStore.set("ea_player_id", playerId, COOKIE_OPTS);
  cookieStore.set("ea_pseudo", pseudo, COOKIE_OPTS);
  if (avatarUrl !== undefined) {
    if (avatarUrl) cookieStore.set("ea_avatar_url", avatarUrl, COOKIE_OPTS);
    else cookieStore.delete("ea_avatar_url");
  }
}

export async function setAvatarUrl(avatarUrl: string | null) {
  const cookieStore = await cookies();
  if (avatarUrl) cookieStore.set("ea_avatar_url", avatarUrl, COOKIE_OPTS);
  else cookieStore.delete("ea_avatar_url");
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete("ea_player_id");
  cookieStore.delete("ea_pseudo");
  cookieStore.delete("ea_avatar_url");
}

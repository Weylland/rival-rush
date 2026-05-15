import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";

// ── Supabase JWT (Option B — custom JWT compatible Supabase Auth) ─────────────

function getSbSecret(): Uint8Array {
  const secret = process.env.SUPABASE_JWT_SECRET;
  if (!secret) throw new Error("SUPABASE_JWT_SECRET must be set");
  // Le secret Supabase est encodé en base64 — il faut le décoder avant usage
  return Buffer.from(secret, "base64");
}

async function signSupabaseToken(playerId: string): Promise<string> {
  return new SignJWT({ role: "authenticated" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(playerId)
    .setIssuer("supabase")
    .setAudience("authenticated")
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(getSbSecret());
}

const SB_COOKIE_NAME = "ea_sb_token";
const SB_COOKIE_OPTS = {
  httpOnly: false, // le browser doit pouvoir le lire pour le client Supabase
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: 60 * 60 * 24 * 30,
  path: "/",
};

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

// ── JWT helpers ───────────────────────────────────────────────────────────────

function getSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must be set and at least 32 characters long");
  }
  return new TextEncoder().encode(secret);
}

interface SessionPayload {
  playerId: string;
  pseudo: string;
  avatarUrl: string | null;
}

const COOKIE_NAME = "ea_session";
const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: 60 * 60 * 24 * 30, // 30 days
  path: "/",
};

async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(getSecret());
}

async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    const { playerId, pseudo, avatarUrl } = payload as Record<string, unknown>;
    if (typeof playerId !== "string" || typeof pseudo !== "string") return null;
    return {
      playerId,
      pseudo,
      avatarUrl: typeof avatarUrl === "string" ? avatarUrl : null,
    };
  } catch {
    return null;
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySession(token);
}

export async function setSession(
  playerId: string,
  pseudo: string,
  avatarUrl?: string | null,
) {
  const [token, sbToken] = await Promise.all([
    signSession({ playerId, pseudo, avatarUrl: avatarUrl ?? null }),
    signSupabaseToken(playerId),
  ]);
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, COOKIE_OPTS);
  cookieStore.set(SB_COOKIE_NAME, sbToken, SB_COOKIE_OPTS);
}

export async function setAvatarUrl(avatarUrl: string | null) {
  const session = await getSession();
  if (!session) return;
  await setSession(session.playerId, session.pseudo, avatarUrl);
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
  cookieStore.delete(SB_COOKIE_NAME);
}

"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession } from "@/lib/auth";
import { updateLeaderboard } from "@/lib/leaderboard";

export type AuthState = { error: string } | null;

// ── Rate limiting ─────────────────────────────────────────────────────────────
type RateEntry = { count: number; resetAt: number };
const loginBucket  = new Map<string, RateEntry>();
const signupBucket = new Map<string, RateEntry>();
const guestBucket  = new Map<string, RateEntry>();

async function getIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
}

function checkRate(
  bucket: Map<string, RateEntry>,
  ip: string,
  limit: number,
  windowMs = 60_000,
): boolean {
  const now = Date.now();
  const entry = bucket.get(ip);
  if (!entry || now > entry.resetAt) {
    bucket.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= limit) return false;
  entry.count++;
  return true;
}

// ── Signup ────────────────────────────────────────────────────────────────────

export async function signup(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const ip = await getIp();
  if (!checkRate(signupBucket, ip, 3)) {
    return { error: "Trop de tentatives. Réessaie dans une minute." };
  }

  const pseudo   = (formData.get("pseudo") as string)?.trim();
  const email    = (formData.get("email") as string)?.trim().toLowerCase();
  const password = formData.get("password") as string;

  if (!pseudo || !email || !password) return { error: "Remplis tous les champs" };
  if (pseudo.length < 2)  return { error: "Pseudo trop court (min 2 caractères)" };
  if (password.length < 6) return { error: "Mot de passe trop court (min 6 caractères)" };
  if (!/^[^@]+@[^@]+\.[^@]+$/.test(email)) return { error: "Email invalide" };

  const admin = createAdminClient();

  // Vérifier unicité du pseudo
  const { data: existing } = await admin
    .from("players")
    .select("id")
    .eq("pseudo", pseudo)
    .maybeSingle();
  if (existing) return { error: "Ce pseudo est déjà pris 😅" };

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { pseudo },
      // emailRedirectTo si email confirmation activée
    },
  });

  if (error) {
    if (error.code === "user_already_exists") return { error: "Cet email est déjà utilisé" };
    return { error: error.message };
  }

  redirect("/lobby");
}

// ── Signin ────────────────────────────────────────────────────────────────────

export async function signin(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const ip = await getIp();
  if (!checkRate(loginBucket, ip, 5)) {
    return { error: "Trop de tentatives. Réessaie dans une minute." };
  }

  const email    = (formData.get("email") as string)?.trim().toLowerCase();
  const password = formData.get("password") as string;

  if (!email || !password) return { error: "Remplis tous les champs" };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    if (error.code === "invalid_credentials") return { error: "Email ou mot de passe incorrect" };
    return { error: error.message };
  }

  redirect("/lobby");
}

// ── Login invité ──────────────────────────────────────────────────────────────

export async function signinAsGuest(_prev: AuthState, _formData: FormData): Promise<AuthState> {
  const ip = await getIp();
  if (!checkRate(guestBucket, ip, 5, 10 * 60_000)) {
    return { error: "Trop de connexions invité depuis cette IP. Réessaie dans 10 minutes." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInAnonymously();

  if (error) return { error: error.message };

  redirect("/lobby");
}

// ── Logout ────────────────────────────────────────────────────────────────────

export async function logout() {
  const session = await getSession();
  const supabase = await createClient();
  const admin    = createAdminClient();

  if (session) {
    // Forfeit active games
    const { data: activeChallenges } = await admin
      .from("challenges")
      .select("id, challenger_id, challenged_id, game_type")
      .or(`challenger_id.eq.${session.playerId},challenged_id.eq.${session.playerId}`)
      .eq("status", "accepted");

    const activeIds = (activeChallenges ?? []).map((c) => c.id);

    if (activeIds.length > 0) {
      const { data: activeGames } = await admin
        .from("games")
        .select("id, challenge_id, game_type")
        .in("challenge_id", activeIds)
        .eq("status", "playing");

      for (const game of activeGames ?? []) {
        const challenge = (activeChallenges ?? []).find((c) => c.id === game.challenge_id);
        if (!challenge) continue;
        const { challenger_id: p1Id, challenged_id: p2Id } = challenge;
        const opponentId = session.playerId === p1Id ? p2Id : p1Id;

        const { error } = await admin
          .from("games")
          .update({ status: "finished", winner_id: opponentId })
          .eq("id", game.id)
          .eq("status", "playing");

        if (!error) {
          await updateLeaderboard(admin, opponentId, p1Id, p2Id, game.game_type as string);
        }
      }
    }

    // Supprimer la présence
    await admin.from("presence").delete().eq("player_id", session.playerId);

    // Si invité : supprimer le compte entièrement (sinon comptes fantômes)
    if (session.isGuest) {
      await admin.auth.admin.deleteUser(session.playerId);
    }
  }

  await supabase.auth.signOut();
  redirect("/login");
}

// ── Conversion invité → compte réel ──────────────────────────────────────────

export async function convertGuestAccount(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email    = (formData.get("email") as string)?.trim().toLowerCase();
  const password = formData.get("password") as string;

  if (!email || !password) return { error: "Remplis tous les champs" };
  if (password.length < 6) return { error: "Mot de passe trop court (min 6 caractères)" };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ email, password });

  if (error) {
    if (error.code === "user_already_exists") return { error: "Cet email est déjà utilisé" };
    return { error: error.message };
  }

  // Mettre à jour is_guest dans players
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const admin = createAdminClient();
    await admin.from("players").update({ is_guest: false }).eq("id", user.id);
  }

  redirect("/lobby");
}

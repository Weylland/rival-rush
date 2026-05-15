"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hashPassword, verifyPassword, setSession, getSession, clearSession } from "@/lib/auth";
import { updateLeaderboard } from "@/lib/leaderboard";

export type AuthState = { error: string } | null;

// ── Rate limiting ─────────────────────────────────────────────────────────────
// In-memory per instance. Effective for single-node / dev. For multi-instance
// production, replace with an Upstash Redis rate limiter.
type RateEntry = { count: number; resetAt: number };
const loginBucket  = new Map<string, RateEntry>();
const signupBucket = new Map<string, RateEntry>();

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

export async function signup(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const ip = await getIp();
  if (!checkRate(signupBucket, ip, 3)) {
    return { error: "Trop de tentatives. Réessaie dans une minute." };
  }

  const pseudo = (formData.get("pseudo") as string)?.trim();
  const password = formData.get("password") as string;

  if (!pseudo || !password) return { error: "Remplis tous les champs" };
  if (pseudo.length < 2) return { error: "Pseudo trop court (min 2 caractères)" };
  if (password.length < 4) return { error: "Mot de passe trop court (min 4 caractères)" };

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("players")
    .select("id")
    .eq("pseudo", pseudo)
    .maybeSingle();

  if (existing) return { error: "Ce pseudo est déjà pris 😅" };

  const hashed = await hashPassword(password);

  const { data: player, error } = await supabase
    .from("players")
    .insert({ pseudo, password: hashed })
    .select()
    .single();

  if (error || !player) return { error: "Erreur lors de la création du compte" };

  await supabase.from("leaderboard").insert({ player_id: player.id });

  await setSession(player.id, player.pseudo);
  redirect("/lobby");
}

export async function logout() {
  const session = await getSession();
  if (!session) {
    await clearSession();
    redirect("/login");
  }

  const supabase = await createClient();

  // Forfeit any active games this player is in
  const { data: activeChallenges } = await supabase
    .from("challenges")
    .select("id, challenger_id, challenged_id, game_type")
    .or(`challenger_id.eq.${session.playerId},challenged_id.eq.${session.playerId}`)
    .eq("status", "accepted");

  const activeIds = (activeChallenges ?? []).map((c) => c.id);

  if (activeIds.length > 0) {
    const { data: activeGames } = await supabase
      .from("games")
      .select("id, challenge_id, game_type")
      .in("challenge_id", activeIds)
      .eq("status", "playing");

    for (const game of activeGames ?? []) {
      const challenge = (activeChallenges ?? []).find((c) => c.id === game.challenge_id);
      if (!challenge) continue;
      const { challenger_id: p1Id, challenged_id: p2Id } = challenge;
      const opponentId = session.playerId === p1Id ? p2Id : p1Id;

      const { error } = await supabase
        .from("games")
        .update({ status: "finished", winner_id: opponentId })
        .eq("id", game.id)
        .eq("status", "playing");

      if (!error) {
        await updateLeaderboard(supabase, opponentId, p1Id, p2Id, game.game_type as string);
      }
    }
  }

  // Remove presence and clear session
  await supabase.from("presence").delete().eq("player_id", session.playerId);
  await clearSession();

  redirect("/login");
}

export async function signin(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const ip = await getIp();
  if (!checkRate(loginBucket, ip, 5)) {
    return { error: "Trop de tentatives. Réessaie dans une minute." };
  }

  const pseudo = (formData.get("pseudo") as string)?.trim();
  const password = formData.get("password") as string;

  if (!pseudo || !password) return { error: "Remplis tous les champs" };

  const supabase = await createClient();

  const { data: player } = await supabase
    .from("players")
    .select("*")
    .eq("pseudo", pseudo)
    .maybeSingle();

  if (!player) return { error: "Pseudo introuvable" };

  const valid = await verifyPassword(password, player.password);
  if (!valid) return { error: "Mot de passe incorrect" };

  await setSession(player.id, player.pseudo, (player.avatar_url as string | null) ?? null);
  redirect("/lobby");
}

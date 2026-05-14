"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import { initialChessState } from "@/lib/chess";
import { sendPushToSubscriptions } from "@/lib/push";
import type { GameType } from "@/types/database";

const GAME_LABELS: Record<GameType, string> = {
  pfc: "Pierre Feuille Ciseaux",
  morpion: "Morpion",
  puissance4: "Puissance 4",
  reflexe: "Réflexe ⚡",
  naval: "Bataille Navale",
  chess: "Échecs ♟",
  nim: "Nim 🔥",
  pig: "Jeu du Cochon 🐷",
  mastermind: "Mastermind 🎨",
};

export async function sendChallenge(challengedId: string, gameType: GameType, timeControl?: number | null) {
  const session = await getSession();
  if (!session) redirect("/login");

  const supabase = await createClient();

  // Vérifie que la session pointe vers un joueur existant (session corrompue / compte supprimé)
  const { data: me } = await supabase
    .from("players")
    .select("id")
    .eq("id", session.playerId)
    .maybeSingle();

  if (!me) redirect("/login");

  // Check presence (block only if actively in-game)
  const { data: presence } = await supabase
    .from("presence")
    .select("status")
    .eq("player_id", challengedId)
    .maybeSingle();

  if (presence?.status === "in-game") {
    return { error: "Ce joueur est déjà en partie" };
  }

  const isOffline = !presence || presence.status === "offline";

  // Guard: no pending challenge already between these two players
  const { data: existing } = await supabase
    .from("challenges")
    .select("id")
    .eq("status", "pending")
    .or(
      `and(challenger_id.eq.${session.playerId},challenged_id.eq.${challengedId}),` +
      `and(challenger_id.eq.${challengedId},challenged_id.eq.${session.playerId})`
    )
    .maybeSingle();

  if (existing) return { error: "Un défi est déjà en cours avec ce joueur" };

  // expires_at: 2min online (chess gets a bit more think-time), 5min offline
  const expiresInMs = isOffline ? 5 * 60 * 1000 : 2 * 60 * 1000;
  const expiresAt = new Date(Date.now() + expiresInMs).toISOString();

  const { data: challenge, error } = await supabase
    .from("challenges")
    .insert({
      challenger_id: session.playerId,
      challenged_id: challengedId,
      game_type: gameType,
      status: "pending",
      expires_at: expiresAt,
      metadata: gameType === "chess" ? { timeControl: timeControl ?? null } : {},
    })
    .select()
    .single();

  if (error || !challenge) return { error: error?.message ?? "Impossible d'envoyer le défi" };

  // Send Web Push if player is offline (or as backup even if online)
  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("player_id", challengedId);

  if (subs && subs.length > 0) {
    const label = GAME_LABELS[gameType] ?? gameType;
    const duration = isOffline ? "5 minutes" : "2 minutes";
    await sendPushToSubscriptions(subs as { endpoint: string; p256dh: string; auth: string }[], {
      title: `⚔ Défi de ${session.pseudo} !`,
      body: `${session.pseudo} te défie sur ${label}. Tu as ${duration} pour accepter !`,
      tag: `challenge-${challenge.id}`,
      url: "/lobby",
    });
  }

  redirect(`/waiting?challenge_id=${challenge.id}`);
}

export async function cancelChallenge(challengeId: string) {
  const session = await getSession();
  if (!session) return;

  const supabase = await createClient();

  await supabase
    .from("challenges")
    .update({ status: "cancelled" })
    .eq("id", challengeId)
    .eq("challenger_id", session.playerId);
}

export async function acceptChallenge(challengeId: string) {
  const session = await getSession();
  if (!session) redirect("/login");

  const supabase = await createClient();

  const { data: challenge } = await supabase
    .from("challenges")
    .select("*")
    .eq("id", challengeId)
    .eq("challenged_id", session.playerId)
    .eq("status", "pending")
    .single();

  if (!challenge) return { error: "Défi introuvable" };

  await supabase
    .from("challenges")
    .update({ status: "accepted" })
    .eq("id", challengeId);

  const p1 = challenge.challenger_id;
  const p2 = session.playerId;

  const initialState =
    challenge.game_type === "pfc"
      ? { rounds: [], scores: { [p1]: 0, [p2]: 0 } }
      : challenge.game_type === "puissance4"
        ? { board: Array(42).fill(null) }
        : challenge.game_type === "reflexe"
          ? { rounds: [], scores: { [p1]: 0, [p2]: 0 }, phase: "idle", signal_at: null, current_round: 1, ready: [] }
          : challenge.game_type === "naval"
            ? { ships: {}, shots: { [p1]: [], [p2]: [] } }
            : challenge.game_type === "chess"
              ? initialChessState((challenge.metadata as { timeControl?: number | null } | null)?.timeControl ?? null, p1, p2)
              : challenge.game_type === "nim"
                ? (() => { const pile = Math.floor(Math.random() * 11) + 15; return { pile, initial_pile: pile, last_taken: null, last_player_id: null }; })()
                : challenge.game_type === "pig"
                  ? { scores: { [p1]: 0, [p2]: 0 }, turn_total: 0, last_roll: null }
                  : challenge.game_type === "mastermind"
                    ? { code: Array.from({ length: 4 }, () => Math.floor(Math.random() * 6)), guesses: [] }
                    : { board: Array(9).fill(null), scores: { [p1]: 0, [p2]: 0 } };

  const { data: game } = await supabase
    .from("games")
    .insert({
      challenge_id: challengeId,
      game_type: challenge.game_type,
      state: initialState,
      current_turn: challenge.game_type === "naval" ? null : challenge.challenger_id,
      status: "playing",
    })
    .select()
    .single();

  if (!game) return { error: "Impossible de créer la partie" };

  redirect(`/play/${challenge.game_type}?game_id=${game.id}`);
}

export async function declineChallenge(challengeId: string) {
  const session = await getSession();
  if (!session) redirect("/login");

  const supabase = await createClient();

  await supabase
    .from("challenges")
    .update({ status: "declined" })
    .eq("id", challengeId)
    .eq("challenged_id", session.playerId);
}

export async function updatePresenceStatus(status: "online" | "in-game") {
  const session = await getSession();
  if (!session) return;

  const supabase = await createClient();
  await supabase.from("presence").upsert({
    player_id: session.playerId,
    pseudo: session.pseudo,
    status,
    updated_at: new Date().toISOString(),
  });
}

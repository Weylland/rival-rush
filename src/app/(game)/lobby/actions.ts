"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import type { GameType } from "@/types/database";

export async function sendChallenge(challengedId: string, gameType: GameType) {
  const session = await getSession();
  if (!session) redirect("/login");

  const supabase = await createClient();

  // Guard: opponent must be online
  const { data: presence } = await supabase
    .from("presence")
    .select("status")
    .eq("player_id", challengedId)
    .maybeSingle();

  if (!presence || presence.status !== "online") {
    return { error: "Ce joueur n'est plus disponible" };
  }

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

  const { data: challenge, error } = await supabase
    .from("challenges")
    .insert({
      challenger_id: session.playerId,
      challenged_id: challengedId,
      game_type: gameType,
      status: "pending",
    })
    .select()
    .single();

  if (error || !challenge) return { error: "Impossible d'envoyer le défi" };

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

  const initialState =
    challenge.game_type === "pfc"
      ? { rounds: [], scores: { [challenge.challenger_id]: 0, [session.playerId]: 0 } }
      : challenge.game_type === "puissance4"
        ? { board: Array(42).fill(null) }
        : challenge.game_type === "reflexe"
          ? { rounds: [], scores: { [challenge.challenger_id]: 0, [session.playerId]: 0 }, phase: "idle", signal_at: null, current_round: 1, ready: [] }
          : { board: Array(9).fill(null), scores: { [challenge.challenger_id]: 0, [session.playerId]: 0 } };

  const { data: game } = await supabase
    .from("games")
    .insert({
      challenge_id: challengeId,
      game_type: challenge.game_type,
      state: initialState,
      current_turn: challenge.challenger_id,
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

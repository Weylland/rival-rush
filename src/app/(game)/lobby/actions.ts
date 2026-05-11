"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import type { GameType } from "@/types/database";

export async function sendChallenge(challengedId: string, gameType: GameType) {
  const session = await getSession();
  if (!session) redirect("/login");

  const supabase = await createClient();

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

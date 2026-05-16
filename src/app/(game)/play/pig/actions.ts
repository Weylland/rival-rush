"use server";

import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { updateLeaderboard } from "@/lib/leaderboard";
import type { PigState } from "@/types/database";

const WIN_SCORE = 100;

async function getGame(supabase: Awaited<ReturnType<typeof createClient>>, gameId: string, playerId: string) {
  const { data: game } = await supabase
    .from("games")
    .select("*, challenges(challenger_id, challenged_id)")
    .eq("id", gameId)
    .single();

  if (!game || game.game_type !== "pig" || game.status === "finished")
    return { error: "Invalid game" as const };

  const challenge = game.challenges as { challenger_id: string; challenged_id: string };
  const { challenger_id: p1Id, challenged_id: p2Id } = challenge;

  if (playerId !== p1Id && playerId !== p2Id) return { error: "Not a participant" as const };
  if (game.current_turn !== playerId) return { error: "Not your turn" as const };

  const raw = game.state as Record<string, unknown>;
  const state: PigState = raw && "scores" in raw
    ? (raw as unknown as PigState)
    : { scores: { [p1Id]: 0, [p2Id]: 0 }, turn_total: 0, last_roll: null };

  return { game, state, p1Id, p2Id };
}

export async function rollPig(gameId: string) {
  const session = await getSession();
  if (!session) return { ok: false, error: "Not authenticated" };

  const supabase = await createClient();
  const admin = createAdminClient();
  const res = await getGame(supabase, gameId, session.playerId);
  if ("error" in res) return { ok: false, error: res.error };

  const { game, state, p1Id, p2Id } = res;
  const myId = session.playerId;
  const opponentId = myId === p1Id ? p2Id : p1Id;

  const roll = Math.floor(Math.random() * 6) + 1;

  if (roll === 1) {
    // Lose turn total, pass turn
    const newState: PigState = {
      scores: state.scores,
      turn_total: 0,
      last_roll: 1,
    };
    await admin.from("games").update({
      state: newState as unknown as Record<string, unknown>,
      current_turn: opponentId,
    }).eq("id", gameId);

    return { ok: true, roll, bust: true };
  }

  // Add to turn total
  const newTurnTotal = state.turn_total + roll;
  const newState: PigState = {
    scores: state.scores,
    turn_total: newTurnTotal,
    last_roll: roll,
  };

  await admin.from("games").update({
    state: newState as unknown as Record<string, unknown>,
  }).eq("id", gameId);

  return { ok: true, roll, bust: false };
}

export async function holdPig(gameId: string) {
  const session = await getSession();
  if (!session) return { ok: false, error: "Not authenticated" };

  const supabase = await createClient();
  const admin = createAdminClient();
  const res = await getGame(supabase, gameId, session.playerId);
  if ("error" in res) return { ok: false, error: res.error };

  const { game, state, p1Id, p2Id } = res;
  const myId = session.playerId;
  const opponentId = myId === p1Id ? p2Id : p1Id;

  if (state.turn_total === 0) return { ok: false, error: "Nothing to hold" };

  const newScore = (state.scores[myId] ?? 0) + state.turn_total;
  const newScores = { ...state.scores, [myId]: newScore };
  const isFinished = newScore >= WIN_SCORE;

  const newState: PigState = {
    scores: newScores,
    turn_total: 0,
    last_roll: state.last_roll,
  };

  await admin.from("games").update({
    state: newState as unknown as Record<string, unknown>,
    current_turn: isFinished ? null : opponentId,
    status: isFinished ? "finished" : "playing",
    ...(isFinished ? { winner_id: myId } : {}),
  }).eq("id", gameId);

  if (isFinished) {
    await updateLeaderboard(admin, myId, p1Id, p2Id, "pig");
  }

  return { ok: true };
}

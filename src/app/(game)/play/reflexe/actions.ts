"use server";

import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { TapState } from "@/types/database";

async function updateLeaderboard(
  supabase: Awaited<ReturnType<typeof createClient>>,
  winnerId: string | null,
  player1Id: string,
  player2Id: string,
) {
  for (const player_id of [player1Id, player2Id]) {
    const isWinner = winnerId === player_id;
    const isDraw = winnerId === null;
    const { data: existing } = await supabase
      .from("leaderboard")
      .select("*")
      .eq("player_id", player_id)
      .single();

    if (existing) {
      await supabase.from("leaderboard").update({
        wins: existing.wins + (isWinner ? 1 : 0),
        losses: existing.losses + (!isWinner && !isDraw ? 1 : 0),
        draws: existing.draws + (isDraw ? 1 : 0),
        points: existing.points + (isWinner ? 3 : isDraw ? 1 : 0),
      }).eq("player_id", player_id);
    } else {
      await supabase.from("leaderboard").insert({
        player_id,
        wins: isWinner ? 1 : 0,
        losses: !isWinner && !isDraw ? 1 : 0,
        draws: isDraw ? 1 : 0,
        points: isWinner ? 3 : isDraw ? 1 : 0,
      });
    }
  }
}

export async function armReflexeRound(gameId: string) {
  const session = await getSession();
  if (!session) throw new Error("Not authenticated");

  const supabase = await createClient();

  const { data: game } = await supabase
    .from("games")
    .select("*, challenges(challenger_id, challenged_id)")
    .eq("id", gameId)
    .single();

  if (!game || game.game_type !== "reflexe" || game.status === "finished") {
    return { ok: false };
  }

  const challenge = game.challenges as { challenger_id: string; challenged_id: string };
  const myId = session.playerId;
  if (myId !== challenge.challenger_id && myId !== challenge.challenged_id) {
    return { ok: false };
  }

  const state = game.state as TapState;
  if (state.phase !== "idle") return { ok: false };

  const delayMs = 2500 + Math.floor(Math.random() * 2500);
  const signal_at = new Date(Date.now() + delayMs).toISOString();

  await supabase.from("games").update({
    state: { ...state, phase: "armed", signal_at } as unknown as Record<string, unknown>,
  }).eq("id", gameId);

  return { ok: true };
}

export async function submitReflexeTap(gameId: string) {
  const session = await getSession();
  if (!session) throw new Error("Not authenticated");

  const supabase = await createClient();

  const { data: game } = await supabase
    .from("games")
    .select("*, challenges(challenger_id, challenged_id)")
    .eq("id", gameId)
    .single();

  if (!game || game.game_type !== "reflexe" || game.status === "finished") {
    return { ok: false };
  }

  const challenge = game.challenges as { challenger_id: string; challenged_id: string };
  const { challenger_id: p1Id, challenged_id: p2Id } = challenge;
  const myId = session.playerId;

  if (myId !== p1Id && myId !== p2Id) return { ok: false };

  const state = game.state as TapState;
  if (state.phase !== "armed" || !state.signal_at) return { ok: false };

  // Guard: round already decided
  if (state.rounds.some(r => r.round === state.current_round)) return { ok: false };

  const now = new Date();
  const signalAt = new Date(state.signal_at);

  if (now < signalAt) {
    // False start — re-arm with new delay
    const delayMs = 2500 + Math.floor(Math.random() * 2500);
    const newSignalAt = new Date(Date.now() + delayMs).toISOString();
    await supabase.from("games").update({
      state: { ...state, signal_at: newSignalAt } as unknown as Record<string, unknown>,
    }).eq("id", gameId);
    return { ok: true };
  }

  const reaction_ms = Math.max(0, now.getTime() - signalAt.getTime());
  const newRound = {
    round: state.current_round,
    signal_at: state.signal_at,
    winner_id: myId,
    reaction_ms,
  };

  const newRounds = [...state.rounds, newRound];
  const newScores = { ...state.scores };
  newScores[myId] = (newScores[myId] ?? 0) + 1;

  const opponentId = myId === p1Id ? p2Id : p1Id;
  const isMatchOver = newScores[myId] >= 2;

  if (isMatchOver) {
    await supabase.from("games").update({
      state: { ...state, rounds: newRounds, scores: newScores, phase: "idle", signal_at: null } as unknown as Record<string, unknown>,
      status: "finished",
      winner_id: myId,
      current_turn: null,
    }).eq("id", gameId);
    await updateLeaderboard(supabase, myId, p1Id, p2Id);
  } else {
    await supabase.from("games").update({
      state: {
        ...state,
        rounds: newRounds,
        scores: newScores,
        phase: "idle",
        signal_at: null,
        current_round: state.current_round + 1,
      } as unknown as Record<string, unknown>,
    }).eq("id", gameId);
  }

  // Suppress unused variable warning
  void opponentId;
  return { ok: true };
}

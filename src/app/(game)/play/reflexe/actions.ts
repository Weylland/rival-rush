"use server";

import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { updateLeaderboard } from "@/lib/leaderboard";
import type { TapState } from "@/types/database";

// Called when a player clicks "Prêt". Arms automatically once both are ready.
export async function setReflexeReady(gameId: string) {
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
  if (state.phase !== "idle") return { ok: false };
  if ((state.ready ?? []).includes(myId)) return { ok: false }; // already ready

  const newReady = [...(state.ready ?? []), myId];
  const bothReady = newReady.includes(p1Id) && newReady.includes(p2Id);

  if (bothReady) {
    // Both ready → arm immediately
    const delayMs = 2500 + Math.floor(Math.random() * 2500);
    const signal_at = new Date(Date.now() + delayMs).toISOString();
    await supabase.from("games").update({
      state: { ...state, phase: "armed", signal_at, ready: [] } as unknown as Record<string, unknown>,
    }).eq("id", gameId);
  } else {
    // Only one ready so far
    await supabase.from("games").update({
      state: { ...state, ready: newReady } as unknown as Record<string, unknown>,
    }).eq("id", gameId);
  }

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
    // False start — re-arm with new delay, reset ready
    const delayMs = 2500 + Math.floor(Math.random() * 2500);
    const newSignalAt = new Date(Date.now() + delayMs).toISOString();
    await supabase.from("games").update({
      state: { ...state, signal_at: newSignalAt } as unknown as Record<string, unknown>,
    }).eq("id", gameId);
    return { ok: true };
  }

  const reaction_ms = Math.max(0, now.getTime() - signalAt.getTime());
  const newRounds = [...state.rounds, {
    round: state.current_round,
    signal_at: state.signal_at,
    winner_id: myId,
    reaction_ms,
  }];
  const newScores = { ...state.scores, [myId]: (state.scores[myId] ?? 0) + 1 };
  const isMatchOver = newScores[myId] >= 2;

  if (isMatchOver) {
    await supabase.from("games").update({
      state: { ...state, rounds: newRounds, scores: newScores, phase: "idle", signal_at: null, ready: [] } as unknown as Record<string, unknown>,
      status: "finished",
      winner_id: myId,
      current_turn: null,
    }).eq("id", gameId);
    await updateLeaderboard(supabase, myId, p1Id, p2Id, "reflexe");
  } else {
    await supabase.from("games").update({
      state: {
        ...state,
        rounds: newRounds,
        scores: newScores,
        phase: "idle",
        signal_at: null,
        current_round: state.current_round + 1,
        ready: [],
      } as unknown as Record<string, unknown>,
    }).eq("id", gameId);
  }

  return { ok: true };
}

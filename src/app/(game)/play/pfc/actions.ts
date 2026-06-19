"use server";

import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { updateLeaderboard } from "@/lib/leaderboard";
import { rpsRoundWinner, type RpsMove } from "@/lib/games/rps";
import type { PFCState, PFCRound } from "@/types/database";

export async function submitPFCMove(gameId: string, move: RpsMove) {
  const session = await getSession();
  if (!session) throw new Error("Not authenticated");

  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: game } = await supabase
    .from("games")
    .select("*, challenges(challenger_id, challenged_id)")
    .eq("id", gameId)
    .single();

  if (!game || game.game_type !== "pfc" || game.status === "finished") {
    return { ok: false, error: "Invalid game" };
  }

  const challenge = game.challenges as { challenger_id: string; challenged_id: string };
  const { challenger_id: p1Id, challenged_id: p2Id } = challenge;
  const myId = session.playerId;
  const opponentId = myId === p1Id ? p2Id : p1Id;

  if (myId !== p1Id && myId !== p2Id) return { ok: false, error: "Not a participant" };

  // Initialize or cast state
  const raw = game.state as Record<string, unknown>;
  const state: PFCState = raw && "rounds" in raw
    ? (raw as unknown as PFCState)
    : { rounds: [], scores: { [p1Id]: 0, [p2Id]: 0 } };

  if (!state.scores) state.scores = { [p1Id]: 0, [p2Id]: 0 };

  // Find active round (< 2 moves and no winner yet)
  let currentRound = state.rounds.find(r => Object.keys(r.moves).length < 2);
  if (!currentRound) {
    const newRound: PFCRound = { round: state.rounds.length + 1, moves: {}, winner_id: null };
    state.rounds.push(newRound);
    currentRound = newRound;
  }

  // Idempotent — already submitted
  if (currentRound.moves[myId]) return { ok: true };

  currentRound.moves[myId] = move;

  // Resolve round when both moved
  if (currentRound.moves[opponentId]) {
    const opMove = currentRound.moves[opponentId] as RpsMove;
    currentRound.winner_id = rpsRoundWinner(myId, move, opponentId, opMove);
    if (currentRound.winner_id) {
      state.scores[currentRound.winner_id] = (state.scores[currentRound.winner_id] ?? 0) + 1;
    }
  }

  // Game over? Any player at 2 wins, or 3 rounds played
  const resolvedRounds = state.rounds.filter(r => Object.keys(r.moves).length === 2);
  const maxScore = Math.max(...Object.values(state.scores));
  const isFinished = maxScore >= 2 || resolvedRounds.length >= 3;

  let gameWinnerId: string | null = null;
  if (isFinished) {
    const entries = Object.entries(state.scores);
    const top = Math.max(...entries.map(e => e[1]));
    const topPlayers = entries.filter(e => e[1] === top);
    gameWinnerId = topPlayers.length === 1 ? topPlayers[0][0] : null;
  }

  await admin.from("games").update({
    state: state as unknown as Record<string, unknown>,
    status: isFinished ? "finished" : "playing",
    ...(isFinished ? { winner_id: gameWinnerId } : {}),
  }).eq("id", gameId);

  if (isFinished) {
    await updateLeaderboard(admin, gameWinnerId, p1Id, p2Id, "pfc");
  }

  return { ok: true };
}

"use server";

import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  initialChessState,
  legalMoves,
  applyMove,
  isCheckmate,
  isStalemate,
} from "@/lib/chess";
import { updateLeaderboard } from "@/lib/leaderboard";
import type { ChessState, PieceType } from "@/lib/chess";

export async function submitChessMove(
  gameId: string,
  from: number,
  to: number,
  promotion: string = "Q",
) {
  const session = await getSession();
  if (!session) throw new Error("Not authenticated");

  const supabase = await createClient();

  const { data: game } = await supabase
    .from("games")
    .select("*, challenges(challenger_id, challenged_id)")
    .eq("id", gameId)
    .single();

  if (!game || game.game_type !== "chess" || game.status === "finished") {
    return { ok: false, error: "Invalid game" };
  }

  const challenge = game.challenges as { challenger_id: string; challenged_id: string };
  const { challenger_id: p1Id, challenged_id: p2Id } = challenge;
  const myId = session.playerId;

  if (myId !== p1Id && myId !== p2Id) return { ok: false, error: "Not a participant" };

  const currentTurn = game.current_turn as string | null;
  if (currentTurn && currentTurn !== myId) return { ok: false, error: "Not your turn" };

  const raw = game.state as Record<string, unknown>;
  const state: ChessState = (raw && "board" in raw)
    ? (raw as unknown as ChessState)
    : initialChessState();

  const myColor = myId === p1Id ? "w" : "b";
  const piece = state.board[from];
  if (!piece || piece[0] !== myColor) return { ok: false, error: "Not your piece" };

  const legal = legalMoves(state, from);
  if (!legal.includes(to)) return { ok: false, error: "Illegal move" };

  const promo = (["Q", "R", "B", "N"].includes(promotion) ? promotion : "Q") as PieceType;
  const newState = applyMove(state, from, to, promo);

  // ── Timing ──────────────────────────────────────────────────────────────────
  const now = Date.now();
  if (state.timeControl && state.timeLeft && state.lastMoveAt) {
    const elapsed = (now - new Date(state.lastMoveAt).getTime()) / 1000;
    const remaining = (state.timeLeft[myId] ?? state.timeControl) - elapsed;

    if (remaining <= 0) {
      // Timed out on their own move — they lose
      const opponentId = myId === p1Id ? p2Id : p1Id;
      await supabase.from("games").update({
        state: newState as unknown as Record<string, unknown>,
        current_turn: null,
        status: "finished",
        winner_id: opponentId,
      }).eq("id", gameId);
      await updateLeaderboard(supabase, opponentId, p1Id, p2Id, "chess");
      return { ok: true };
    }

    newState.timeLeft = { ...state.timeLeft, [myId]: remaining };
  }
  newState.lastMoveAt = new Date(now).toISOString();

  // ── Game-end detection ───────────────────────────────────────────────────────
  const oppColor = myColor === "w" ? "b" : "w";
  const opponentId = myId === p1Id ? p2Id : p1Id;

  const checkmate = isCheckmate(newState, oppColor);
  const stalemate = isStalemate(newState, oppColor);
  const finished = checkmate || stalemate;
  const winnerId = checkmate ? myId : null;

  await supabase.from("games").update({
    state: newState as unknown as Record<string, unknown>,
    current_turn: finished ? null : opponentId,
    status: finished ? "finished" : "playing",
    ...(checkmate ? { winner_id: winnerId } : {}),
  }).eq("id", gameId);

  if (finished) {
    await updateLeaderboard(supabase, winnerId, p1Id, p2Id, "chess");
  }

  return { ok: true };
}

export async function claimChessTimeout(gameId: string) {
  const session = await getSession();
  if (!session) return { ok: false };

  const supabase = await createClient();

  const { data: game } = await supabase
    .from("games")
    .select("*, challenges(challenger_id, challenged_id)")
    .eq("id", gameId)
    .eq("status", "playing")
    .single();

  if (!game || game.game_type !== "chess") return { ok: false };

  const challenge = game.challenges as { challenger_id: string; challenged_id: string };
  const { challenger_id: p1Id, challenged_id: p2Id } = challenge;

  if (session.playerId !== p1Id && session.playerId !== p2Id) return { ok: false };

  const state = game.state as unknown as ChessState;
  if (!state.timeControl || !state.timeLeft || !state.lastMoveAt) return { ok: false };

  const timedOutId = game.current_turn as string;
  const elapsed = (Date.now() - new Date(state.lastMoveAt).getTime()) / 1000;
  const remaining = (state.timeLeft[timedOutId] ?? state.timeControl) - elapsed;

  if (remaining > 2) return { ok: false, error: "Not timed out" }; // 2s grace

  const winnerId = timedOutId === p1Id ? p2Id : p1Id;

  const { error } = await supabase.from("games").update({
    status: "finished",
    winner_id: winnerId,
    current_turn: null,
  }).eq("id", gameId).eq("status", "playing");

  if (error) return { ok: false };

  await updateLeaderboard(supabase, winnerId, p1Id, p2Id, "chess");
  return { ok: true };
}

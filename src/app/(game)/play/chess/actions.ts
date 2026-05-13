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
import type { ChessState, PieceType } from "@/lib/chess";

async function updateLeaderboard(
  supabase: Awaited<ReturnType<typeof createClient>>,
  winnerId: string | null,
  p1Id: string,
  p2Id: string,
) {
  for (const player_id of [p1Id, p2Id]) {
    const isWinner = winnerId === player_id;
    const isDraw = winnerId === null;
    const { data: existing } = await supabase
      .from("leaderboard")
      .select("*")
      .eq("player_id", player_id)
      .single();

    if (existing) {
      await supabase.from("leaderboard").update({
        wins:   existing.wins   + (isWinner ? 1 : 0),
        losses: existing.losses + (!isWinner && !isDraw ? 1 : 0),
        draws:  existing.draws  + (isDraw ? 1 : 0),
        points: existing.points + (isWinner ? 3 : isDraw ? 1 : 0),
      }).eq("player_id", player_id);
    } else {
      await supabase.from("leaderboard").insert({
        player_id,
        wins:   isWinner ? 1 : 0,
        losses: !isWinner && !isDraw ? 1 : 0,
        draws:  isDraw ? 1 : 0,
        points: isWinner ? 3 : isDraw ? 1 : 0,
      });
    }
  }
}

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
    await updateLeaderboard(supabase, winnerId, p1Id, p2Id);
  }

  return { ok: true };
}

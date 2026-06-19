"use server";

import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { updateLeaderboard } from "@/lib/leaderboard";
import { connect4Winner, dropRow, isBoardFull, C4_COLS } from "@/lib/games/connect4";
import type { Puissance4State } from "@/types/database";

export async function submitPuissance4Move(gameId: string, col: number) {
  const session = await getSession();
  if (!session) throw new Error("Not authenticated");

  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: game } = await supabase
    .from("games")
    .select("*, challenges(challenger_id, challenged_id)")
    .eq("id", gameId)
    .single();

  if (!game || game.game_type !== "puissance4" || game.status === "finished") {
    return { ok: false, error: "Invalid game" };
  }

  const challenge = game.challenges as { challenger_id: string; challenged_id: string };
  const { challenger_id: p1Id, challenged_id: p2Id } = challenge;
  const myId = session.playerId;

  if (myId !== p1Id && myId !== p2Id) return { ok: false, error: "Not a participant" };

  const currentTurn = game.current_turn as string | null;
  if (currentTurn && currentTurn !== myId) return { ok: false, error: "Not your turn" };

  const raw = game.state as Record<string, unknown>;
  const state: Puissance4State = raw && "board" in raw
    ? (raw as unknown as Puissance4State)
    : { board: Array(42).fill(null) };

  if (!state.board || state.board.length !== 42) state.board = Array(42).fill(null);

  if (col < 0 || col >= C4_COLS) return { ok: false, error: "Invalid column" };

  // Ligne où tombe le jeton dans la colonne
  const targetRow = dropRow(state.board, col);
  if (targetRow === -1) return { ok: false, error: "Column full" };

  state.board[targetRow * C4_COLS + col] = myId;

  const winner = connect4Winner(state.board);
  const isDraw = !winner && isBoardFull(state.board);
  const isFinished = !!winner || isDraw;

  const opponentId = myId === p1Id ? p2Id : p1Id;
  const nextTurn = isFinished ? null : opponentId;

  await admin.from("games").update({
    state: state as unknown as Record<string, unknown>,
    current_turn: nextTurn,
    status: isFinished ? "finished" : "playing",
    ...(winner ? { winner_id: winner } : {}),
  }).eq("id", gameId);

  if (isFinished) {
    await updateLeaderboard(admin, winner, p1Id, p2Id, "puissance4");
  }

  return { ok: true };
}

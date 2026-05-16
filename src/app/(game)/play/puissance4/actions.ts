"use server";

import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { updateLeaderboard } from "@/lib/leaderboard";
import type { Puissance4State } from "@/types/database";

const ROWS = 6;
const COLS = 7;

function get(board: (string | null)[], r: number, c: number) {
  return board[r * COLS + c];
}

function checkWinner(board: (string | null)[]): string | null {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = get(board, r, c);
      if (!cell) continue;
      if (c + 3 < COLS && cell === get(board, r, c + 1) && cell === get(board, r, c + 2) && cell === get(board, r, c + 3)) return cell;
      if (r + 3 < ROWS && cell === get(board, r + 1, c) && cell === get(board, r + 2, c) && cell === get(board, r + 3, c)) return cell;
      if (r + 3 < ROWS && c + 3 < COLS && cell === get(board, r + 1, c + 1) && cell === get(board, r + 2, c + 2) && cell === get(board, r + 3, c + 3)) return cell;
      if (r + 3 < ROWS && c - 3 >= 0 && cell === get(board, r + 1, c - 1) && cell === get(board, r + 2, c - 2) && cell === get(board, r + 3, c - 3)) return cell;
    }
  }
  return null;
}

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

  if (col < 0 || col >= COLS) return { ok: false, error: "Invalid column" };

  // Find lowest empty row in column
  let targetRow = -1;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (state.board[r * COLS + col] === null) {
      targetRow = r;
      break;
    }
  }
  if (targetRow === -1) return { ok: false, error: "Column full" };

  state.board[targetRow * COLS + col] = myId;

  const winner = checkWinner(state.board);
  const isDraw = !winner && state.board.every(c => c !== null);
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

"use server";

import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { updateLeaderboard } from "@/lib/leaderboard";
import type { MorpionState } from "@/types/database";

const WINNING_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // cols
  [0, 4, 8], [2, 4, 6],             // diagonals
];

function checkWinner(board: (string | null)[]): string | null {
  for (const [a, b, c] of WINNING_LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a]!;
    }
  }
  return null;
}

export async function submitMorpionMove(gameId: string, cellIndex: number) {
  const session = await getSession();
  if (!session) throw new Error("Not authenticated");

  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: game } = await supabase
    .from("games")
    .select("*, challenges(challenger_id, challenged_id)")
    .eq("id", gameId)
    .single();

  if (!game || game.game_type !== "morpion" || game.status === "finished") {
    return { ok: false, error: "Invalid game" };
  }

  const challenge = game.challenges as { challenger_id: string; challenged_id: string };
  const { challenger_id: p1Id, challenged_id: p2Id } = challenge;
  const myId = session.playerId;

  if (myId !== p1Id && myId !== p2Id) return { ok: false, error: "Not a participant" };

  // Validate it's my turn
  const currentTurn = game.current_turn as string | null;
  if (currentTurn && currentTurn !== myId) return { ok: false, error: "Not your turn" };

  const raw = game.state as Record<string, unknown>;
  const state: MorpionState = raw && "board" in raw
    ? (raw as unknown as MorpionState)
    : { board: Array(9).fill(null), scores: { [p1Id]: 0, [p2Id]: 0 } };

  if (!state.board) state.board = Array(9).fill(null);
  if (!state.scores) state.scores = { [p1Id]: 0, [p2Id]: 0 };

  // Validate cell
  if (cellIndex < 0 || cellIndex > 8 || state.board[cellIndex] !== null) {
    return { ok: false, error: "Invalid cell" };
  }

  state.board[cellIndex] = myId;

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
    await updateLeaderboard(admin, winner, p1Id, p2Id, "morpion");
  }

  return { ok: true };
}

"use server";

import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { NimState } from "@/types/database";

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

export async function takeNim(gameId: string, count: 1 | 2 | 3) {
  const session = await getSession();
  if (!session) return { ok: false, error: "Not authenticated" };

  const supabase = await createClient();

  const { data: game } = await supabase
    .from("games")
    .select("*, challenges(challenger_id, challenged_id)")
    .eq("id", gameId)
    .single();

  if (!game || game.game_type !== "nim" || game.status === "finished") {
    return { ok: false, error: "Invalid game" };
  }

  const challenge = game.challenges as { challenger_id: string; challenged_id: string };
  const { challenger_id: p1Id, challenged_id: p2Id } = challenge;
  const myId = session.playerId;

  if (myId !== p1Id && myId !== p2Id) return { ok: false, error: "Not a participant" };

  if (game.current_turn !== myId) return { ok: false, error: "Not your turn" };

  const raw = game.state as Record<string, unknown>;
  const state: NimState = raw && "pile" in raw
    ? (raw as unknown as NimState)
    : { pile: 15, initial_pile: 15, last_taken: null, last_player_id: null };

  if (count < 1 || count > 3) return { ok: false, error: "Invalid count" };
  if (count > state.pile) return { ok: false, error: "Not enough allumettes" };

  const newPile = state.pile - count;
  const opponentId = myId === p1Id ? p2Id : p1Id;

  // Misère rule: who takes the LAST allumette LOSES
  // newPile === 0 → current player took the last one → they LOSE → opponent WINS
  const isFinished = newPile === 0;
  const winnerId = isFinished ? opponentId : null;

  const newState: NimState = {
    pile: newPile,
    initial_pile: state.initial_pile,
    last_taken: count,
    last_player_id: myId,
  };

  await supabase.from("games").update({
    state: newState as unknown as Record<string, unknown>,
    current_turn: isFinished ? null : opponentId,
    status: isFinished ? "finished" : "playing",
    ...(isFinished ? { winner_id: winnerId } : {}),
  }).eq("id", gameId);

  if (isFinished) {
    await updateLeaderboard(supabase, winnerId, p1Id, p2Id);
  }

  return { ok: true };
}

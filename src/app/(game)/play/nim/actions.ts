"use server";

import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { updateLeaderboard } from "@/lib/leaderboard";
import type { NimState } from "@/types/database";

export async function takeNim(gameId: string, count: 1 | 2 | 3) {
  const session = await getSession();
  if (!session) return { ok: false, error: "Not authenticated" };

  const supabase = await createClient();
  const admin = createAdminClient();

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

  await admin.from("games").update({
    state: newState as unknown as Record<string, unknown>,
    current_turn: isFinished ? null : opponentId,
    status: isFinished ? "finished" : "playing",
    ...(isFinished ? { winner_id: winnerId } : {}),
  }).eq("id", gameId);

  if (isFinished) {
    await updateLeaderboard(admin, winnerId, p1Id, p2Id, "nim");
  }

  return { ok: true };
}

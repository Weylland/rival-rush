"use server";

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { updateLeaderboard } from "@/lib/leaderboard";
import type { DuelDesState } from "@/types/database";

export async function rollDice(gameId: string) {
  const session = await getSession();
  if (!session) return { ok: false, error: "Non connecté" };

  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: game } = await supabase
    .from("games")
    .select("*, challenges(challenger_id, challenged_id)")
    .eq("id", gameId)
    .single();

  if (!game || game.game_type !== "duel-des" || game.status === "finished") {
    return { ok: false, error: "Partie introuvable" };
  }

  const challenge = game.challenges as { challenger_id: string; challenged_id: string };
  const { challenger_id: p1Id, challenged_id: p2Id } = challenge;
  const myId = session.playerId;

  if (myId !== p1Id && myId !== p2Id) return { ok: false, error: "Non participant" };

  const raw   = game.state as Record<string, unknown>;
  const state: DuelDesState = raw && "rounds" in raw
    ? (raw as unknown as DuelDesState)
    : { rounds: [{ rolls: {}, winner_id: null }], scores: { [p1Id]: 0, [p2Id]: 0 }, current_round: 1 };

  const roundIdx    = state.current_round - 1;
  const currentRound = state.rounds[roundIdx] ?? { rolls: {}, winner_id: null };

  if (currentRound.rolls[myId] !== undefined) return { ok: false, error: "Déjà lancé" };

  const roll       = Math.ceil(Math.random() * 6);
  const opponentId = myId === p1Id ? p2Id : p1Id;

  const newRounds = state.rounds.map((r, i) =>
    i !== roundIdx ? r : { ...r, rolls: { ...r.rolls, [myId]: roll } }
  );

  const opRoll = newRounds[roundIdx].rolls[opponentId];
  const bothRolled = opRoll !== undefined;

  let newState: DuelDesState = { ...state, rounds: newRounds };
  let gameFinished = false;
  let finalWinnerId: string | null = null;

  if (bothRolled) {
    const roundWinner = roll > opRoll ? myId : opRoll > roll ? opponentId : null;
    newRounds[roundIdx] = { ...newRounds[roundIdx], winner_id: roundWinner };

    const newScores = { ...state.scores };
    if (roundWinner) newScores[roundWinner] = (newScores[roundWinner] ?? 0) + 1;

    if (roundWinner && newScores[roundWinner] >= 3) {
      finalWinnerId = roundWinner;
      gameFinished  = true;
      newState = { ...newState, rounds: newRounds, scores: newScores };
    } else {
      newRounds.push({ rolls: {}, winner_id: null });
      newState = {
        ...newState,
        rounds: newRounds,
        scores: newScores,
        current_round: state.current_round + 1,
      };
    }
  }

  if (gameFinished) {
    await admin.from("games").update({
      state: newState as unknown as Record<string, unknown>,
      status: "finished",
      winner_id: finalWinnerId,
      current_turn: null,
    }).eq("id", gameId);

    await updateLeaderboard(admin, finalWinnerId, p1Id, p2Id, "duel-des");
    redirect(`/result?game_id=${gameId}`);
  }

  await admin.from("games").update({
    state: newState as unknown as Record<string, unknown>,
  }).eq("id", gameId);

  return { ok: true };
}

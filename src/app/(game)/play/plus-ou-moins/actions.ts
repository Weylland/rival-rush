"use server";

import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { PlusOuMoinsState } from "@/types/database";

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

export async function submitGuess(gameId: string, value: number) {
  const session = await getSession();
  if (!session) return { ok: false, error: "Not authenticated" };

  const supabase = await createClient();

  const { data: game } = await supabase
    .from("games")
    .select("*, challenges(challenger_id, challenged_id)")
    .eq("id", gameId)
    .single();

  if (!game || game.game_type !== "plus-ou-moins" || game.status === "finished") {
    return { ok: false, error: "Invalid game" };
  }

  const challenge = game.challenges as { challenger_id: string; challenged_id: string };
  const { challenger_id: p1Id, challenged_id: p2Id } = challenge;
  const myId = session.playerId;

  if (myId !== p1Id && myId !== p2Id) return { ok: false, error: "Not a participant" };
  if (game.current_turn !== myId) return { ok: false, error: "Not your turn" };

  const clampedValue = Math.max(1, Math.min(100, Math.round(value)));

  const raw = game.state as Record<string, unknown>;
  const state: PlusOuMoinsState = raw && "guesses" in raw
    ? (raw as unknown as PlusOuMoinsState)
    : {
        secret: 0,
        range_min: 1,
        range_max: 100,
        guesses: [],
        scores: { [p1Id]: 0, [p2Id]: 0 },
        current_round: 1,
      };

  // Génère le secret si c'est le premier coup du round
  const roundGuesses = state.guesses.filter(g => g.feedback !== "exact" || state.guesses.indexOf(g) < state.guesses.length);
  const currentRoundStart = state.guesses.filter(g => g.feedback === "exact").length;
  const _ = currentRoundStart; // suppress unused warning

  let secret = state.secret;
  if (secret === 0) {
    secret = Math.floor(Math.random() * 100) + 1;
  }
  // Check if this is a new round (last guess was "exact")
  const lastGuess = state.guesses[state.guesses.length - 1];
  if (lastGuess?.feedback === "exact") {
    // New round started — generate new secret
    secret = Math.floor(Math.random() * 100) + 1;
  }

  const opponentId = myId === p1Id ? p2Id : p1Id;
  const feedback: "plus" | "moins" | "exact" =
    clampedValue === secret ? "exact" :
    clampedValue < secret ? "plus" : "moins";

  const newGuess = { player_id: myId, value: clampedValue, feedback };

  // Met à jour le range
  let newMin = state.range_min;
  let newMax = state.range_max;
  if (feedback === "plus")  newMin = Math.max(newMin, clampedValue + 1);
  if (feedback === "moins") newMax = Math.min(newMax, clampedValue - 1);
  if (feedback === "exact") { newMin = secret; newMax = secret; }

  const newScores = { ...state.scores };
  let gameFinished = false;
  let roundWinnerId: string | null = null;
  let newRound = state.current_round;
  let nextSecret = secret;
  let nextMin = newMin;
  let nextMax = newMax;
  let nextCurrentTurn: string = opponentId;

  if (feedback === "exact") {
    // Round gagné
    roundWinnerId = myId;
    newScores[myId] = (newScores[myId] ?? 0) + 1;

    // 2 rounds gagnés = victoire finale
    if (newScores[myId] >= 2) {
      gameFinished = true;
    } else {
      // Nouveau round : l'adversaire commence
      newRound = state.current_round + 1;
      nextSecret = 0; // sera généré au prochain guess
      nextMin = 1;
      nextMax = 100;
      nextCurrentTurn = opponentId;
    }
  }

  const newState: PlusOuMoinsState = {
    secret: feedback === "exact" && !gameFinished ? nextSecret : secret,
    range_min: feedback === "exact" && !gameFinished ? nextMin : newMin,
    range_max: feedback === "exact" && !gameFinished ? nextMax : newMax,
    guesses: [...state.guesses, newGuess],
    scores: newScores,
    current_round: newRound,
  };

  await supabase.from("games").update({
    state: newState as unknown as Record<string, unknown>,
    current_turn: gameFinished ? null : nextCurrentTurn,
    status: gameFinished ? "finished" : "playing",
    ...(gameFinished ? { winner_id: roundWinnerId } : {}),
  }).eq("id", gameId);

  if (gameFinished) {
    await updateLeaderboard(supabase, roundWinnerId, p1Id, p2Id);
  }

  return { ok: true };
}

"use server";

import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { readSecrets, writeSecrets } from "@/lib/game-secrets";
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

/** Returns the secret for the given round from game_secrets, migrating legacy state if needed. */
async function getOrCreateSecret(
  gameId: string,
  round: number,
  legacySecret?: number,
): Promise<number> {
  const secrets = await readSecrets(gameId);
  const key = `round_${round}`;
  const existing = secrets.secret_rounds?.[key];
  if (existing && existing !== 0) return existing;

  // Migration: secret was in games.state.secret (old format)
  if (legacySecret && legacySecret !== 0) {
    await writeSecrets(gameId, {
      secret_rounds: { ...(secrets.secret_rounds ?? {}), [key]: legacySecret },
    });
    return legacySecret;
  }

  const newSecret = Math.floor(Math.random() * 100) + 1;
  await writeSecrets(gameId, {
    secret_rounds: { ...(secrets.secret_rounds ?? {}), [key]: newSecret },
  });
  return newSecret;
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
  // Legacy: state may still have `secret` from old games — used for migration only
  const legacySecret = (raw as { secret?: number }).secret;
  const state: PlusOuMoinsState = raw && "guesses" in raw
    ? (raw as unknown as PlusOuMoinsState)
    : {
        range_min: 1,
        range_max: 100,
        guesses: [],
        scores: { [p1Id]: 0, [p2Id]: 0 },
        current_round: 1,
      };

  // Determine if this is the start of a new round
  const lastGuess = state.guesses[state.guesses.length - 1];
  const isNewRound = lastGuess?.feedback === "exact";

  const currentRound = isNewRound ? state.current_round + 1 : state.current_round;

  // Get secret from game_secrets (server-only) — never from broadcast state
  const secret = await getOrCreateSecret(gameId, currentRound, isNewRound ? undefined : legacySecret);

  const opponentId = myId === p1Id ? p2Id : p1Id;
  const feedback: "plus" | "moins" | "exact" =
    clampedValue === secret ? "exact" :
    clampedValue < secret ? "plus" : "moins";

  const newGuess = { player_id: myId, value: clampedValue, feedback };

  let newMin = isNewRound ? 1 : state.range_min;
  let newMax = isNewRound ? 100 : state.range_max;
  if (feedback === "plus")  newMin = Math.max(newMin, clampedValue + 1);
  if (feedback === "moins") newMax = Math.min(newMax, clampedValue - 1);
  if (feedback === "exact") { newMin = secret; newMax = secret; }

  const newScores = { ...state.scores };
  let gameFinished = false;
  let roundWinnerId: string | null = null;
  let nextCurrentTurn: string = opponentId;

  if (feedback === "exact") {
    roundWinnerId = myId;
    newScores[myId] = (newScores[myId] ?? 0) + 1;
    if (newScores[myId] >= 2) {
      gameFinished = true;
    } else {
      nextCurrentTurn = opponentId;
    }
  }

  const newState: PlusOuMoinsState = {
    range_min: feedback === "exact" && !gameFinished ? 1 : newMin,
    range_max: feedback === "exact" && !gameFinished ? 100 : newMax,
    guesses: [...state.guesses, newGuess],
    scores: newScores,
    current_round: gameFinished ? state.current_round : currentRound,
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

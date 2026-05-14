"use server";

import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { MastermindState, MastermindGuess } from "@/types/database";

const MAX_GUESSES = 12;

function calcFeedback(code: number[], guess: number[]): { blacks: number; whites: number } {
  let blacks = 0;
  const codeCount = new Array(6).fill(0);
  const guessCount = new Array(6).fill(0);

  for (let i = 0; i < 4; i++) {
    if (guess[i] === code[i]) {
      blacks++;
    } else {
      codeCount[code[i]]++;
      guessCount[guess[i]]++;
    }
  }

  let whites = 0;
  for (let c = 0; c < 6; c++) {
    whites += Math.min(codeCount[c], guessCount[c]);
  }

  return { blacks, whites };
}

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
      .from("leaderboard").select("*").eq("player_id", player_id).single();

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

export async function submitMastermindGuess(gameId: string, guess: number[]) {
  const session = await getSession();
  if (!session) return { ok: false, error: "Not authenticated" };

  if (!Array.isArray(guess) || guess.length !== 4 || guess.some(c => c < 0 || c > 5 || !Number.isInteger(c))) {
    return { ok: false, error: "Invalid guess" };
  }

  const supabase = await createClient();

  const { data: game } = await supabase
    .from("games")
    .select("*, challenges(challenger_id, challenged_id)")
    .eq("id", gameId)
    .single();

  if (!game || game.game_type !== "mastermind" || game.status === "finished") {
    return { ok: false, error: "Invalid game" };
  }

  const challenge = game.challenges as { challenger_id: string; challenged_id: string };
  const { challenger_id: p1Id, challenged_id: p2Id } = challenge;
  const myId = session.playerId;

  if (myId !== p1Id && myId !== p2Id) return { ok: false, error: "Not a participant" };
  if (game.current_turn !== myId) return { ok: false, error: "Not your turn" };

  const raw = game.state as Record<string, unknown>;
  const state: MastermindState = raw && "code" in raw
    ? (raw as unknown as MastermindState)
    : { code: [], guesses: [] };

  const { blacks, whites } = calcFeedback(state.code, guess);

  const newGuess: MastermindGuess = { player_id: myId, guess, blacks, whites };
  const newGuesses = [...(state.guesses ?? []), newGuess];

  const opponentId = myId === p1Id ? p2Id : p1Id;
  const isWin = blacks === 4;
  const isDraw = !isWin && newGuesses.length >= MAX_GUESSES;
  const isFinished = isWin || isDraw;

  const newState: MastermindState = { code: state.code, guesses: newGuesses };

  await supabase.from("games").update({
    state: newState as unknown as Record<string, unknown>,
    current_turn: isFinished ? null : opponentId,
    status: isFinished ? "finished" : "playing",
    ...(isWin ? { winner_id: myId } : {}),
  }).eq("id", gameId);

  if (isFinished) {
    await updateLeaderboard(supabase, isWin ? myId : null, p1Id, p2Id);
  }

  return { ok: true, blacks, whites };
}

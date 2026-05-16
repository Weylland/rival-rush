"use server";

import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { readSecrets, writeSecrets } from "@/lib/game-secrets";
import { updateLeaderboard } from "@/lib/leaderboard";
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

/** Returns the secret code from game_secrets, migrating from state if needed. */
async function getOrCreateCode(gameId: string, stateCode: number[] | undefined): Promise<number[]> {
  const secrets = await readSecrets(gameId);

  if (secrets.code?.length === 4) return secrets.code;

  // Migration path: code was previously stored in games.state
  if (stateCode && stateCode.length === 4) {
    await writeSecrets(gameId, { code: stateCode });
    return stateCode;
  }

  // First game ever: generate a fresh code
  const code = Array.from({ length: 4 }, () => Math.floor(Math.random() * 6));
  await writeSecrets(gameId, { code });
  return code;
}

export async function submitMastermindGuess(gameId: string, guess: number[]) {
  const session = await getSession();
  if (!session) return { ok: false, error: "Not authenticated" };

  if (!Array.isArray(guess) || guess.length !== 4 || guess.some(c => c < 0 || c > 5 || !Number.isInteger(c))) {
    return { ok: false, error: "Invalid guess" };
  }

  const supabase = await createClient();
  const admin = createAdminClient();

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
  // Legacy: state may still have `code` from old games — used for migration only
  const legacyCode = (raw as { code?: number[] }).code;
  const state: MastermindState = raw && "guesses" in raw
    ? (raw as unknown as MastermindState)
    : { guesses: [] };

  // Get code from secrets (server-only) — never from broadcast state
  const code = await getOrCreateCode(gameId, legacyCode);

  const { blacks, whites } = calcFeedback(code, guess);

  const newGuess: MastermindGuess = { player_id: myId, guess, blacks, whites };
  const newGuesses = [...(state.guesses ?? []), newGuess];

  const opponentId = myId === p1Id ? p2Id : p1Id;
  const isWin = blacks === 4;
  const isDraw = !isWin && newGuesses.length >= MAX_GUESSES;
  const isFinished = isWin || isDraw;

  const newState: MastermindState = {
    guesses: newGuesses,
    // Reveal code only when game ends
    ...(isFinished ? { revealed_code: code } : {}),
  };

  await admin.from("games").update({
    state: newState as unknown as Record<string, unknown>,
    current_turn: isFinished ? null : opponentId,
    status: isFinished ? "finished" : "playing",
    ...(isWin ? { winner_id: myId } : {}),
  }).eq("id", gameId);

  if (isFinished) {
    await updateLeaderboard(admin, isWin ? myId : null, p1Id, p2Id, "mastermind");
  }

  return { ok: true, blacks, whites };
}

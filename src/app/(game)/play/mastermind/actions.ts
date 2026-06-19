"use server";

import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { readSecrets, writeSecrets } from "@/lib/game-secrets";
import { updateLeaderboard } from "@/lib/leaderboard";
import { calcFeedback, generateCode, isValidGuess, isWinningFeedback, MM_MAX_GUESSES } from "@/lib/mastermind";
import type { MastermindState, MastermindGuess } from "@/types/database";

/** Récupère le code secret du joueur, en le générant à son premier essai. Jamais diffusé. */
async function getOrCreatePlayerCode(gameId: string, playerId: string): Promise<number[]> {
  const secrets = await readSecrets(gameId);
  const existing = secrets.codes?.[playerId];
  if (existing && existing.length === 4) return existing;

  const code = generateCode();
  await writeSecrets(gameId, { codes: { ...(secrets.codes ?? {}), [playerId]: code } });
  return code;
}

export async function submitMastermindGuess(gameId: string, guess: number[]) {
  const session = await getSession();
  if (!session) return { ok: false, error: "Not authenticated" };

  if (!isValidGuess(guess)) return { ok: false, error: "Invalid guess" };

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
  const opponentId = myId === p1Id ? p2Id : p1Id;

  // State courant (boards par joueur). Tolère l'ancien format.
  const raw = game.state as Record<string, unknown>;
  const boards: Record<string, MastermindGuess[]> =
    raw && typeof raw.boards === "object" && raw.boards !== null
      ? (raw.boards as Record<string, MastermindGuess[]>)
      : {};

  const myBoard = boards[myId] ?? [];

  // Garde-fous : déjà gagné ou plus d'essais
  if (myBoard.length >= MM_MAX_GUESSES) return { ok: false, error: "No guesses left" };
  if (myBoard.some(g => g.blacks === 4)) return { ok: false, error: "Already cracked" };

  // Feedback contre MON propre code (server-only)
  const myCode = await getOrCreatePlayerCode(gameId, myId);
  const fb = calcFeedback(myCode, guess);
  const newGuess: MastermindGuess = { guess, blacks: fb.blacks, whites: fb.whites };

  const newMyBoard = [...myBoard, newGuess];
  const newBoards = { ...boards, [myId]: newMyBoard };

  const iWin = isWinningFeedback(fb);
  const opponentBoard = boards[opponentId] ?? [];
  const opponentDone =
    opponentBoard.some(g => g.blacks === 4) || opponentBoard.length >= MM_MAX_GUESSES;
  const iExhausted = newMyBoard.length >= MM_MAX_GUESSES;

  // Course : je gagne dès 4 noirs. Match nul si nous avons tous les deux épuisé sans craquer.
  const isFinished = iWin || (iExhausted && opponentDone);

  const newState: MastermindState = { boards: newBoards };

  if (isFinished) {
    // Révèle les deux codes une fois terminé
    const secrets = await readSecrets(gameId);
    newState.revealed = {
      [myId]: myCode,
      ...(secrets.codes?.[opponentId] ? { [opponentId]: secrets.codes[opponentId] } : {}),
    };
  }

  await admin
    .from("games")
    .update({
      state: newState as unknown as Record<string, unknown>,
      current_turn: null,
      status: isFinished ? "finished" : "playing",
      ...(iWin ? { winner_id: myId } : {}),
    })
    .eq("id", gameId);

  if (isFinished) {
    await updateLeaderboard(admin, iWin ? myId : null, p1Id, p2Id, "mastermind");
  }

  return { ok: true, blacks: fb.blacks, whites: fb.whites, win: iWin };
}

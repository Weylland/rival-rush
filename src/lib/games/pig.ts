/** Pig (jeu de dé cochon) — logique pure. Premier à PIG_WIN_SCORE gagne ; un 1 fait perdre la mise du tour. */

export const PIG_WIN_SCORE = 100;
export const PIG_BUST_ROLL = 1;

/** Un 1 fait perdre le cumul du tour (bust). */
export function isPigBust(roll: number): boolean {
  return roll === PIG_BUST_ROLL;
}

export interface PigBankResult {
  newScore: number;
  finished: boolean;
}

/** Banque le cumul du tour dans le score du joueur et indique si la partie est gagnée. */
export function pigBank(currentScore: number, turnTotal: number): PigBankResult {
  const newScore = currentScore + turnTotal;
  return { newScore, finished: newScore >= PIG_WIN_SCORE };
}

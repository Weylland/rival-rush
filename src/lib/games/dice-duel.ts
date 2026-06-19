/** Duel de dés — logique pure. Le dé le plus haut gagne la manche ; premier à DICE_DUEL_TARGET manches gagne. */

export const DICE_DUEL_TARGET = 3;

/** Gagnant d'une manche selon les dés, ou null en cas d'égalité. */
export function diceDuelRoundWinner<T>(p1: T, roll1: number, p2: T, roll2: number): T | null {
  if (roll1 > roll2) return p1;
  if (roll2 > roll1) return p2;
  return null;
}

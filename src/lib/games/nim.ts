/** Nim (jeu des allumettes) — logique pure, règle misère : qui prend la dernière PERD. */

export const NIM_MIN_TAKE = 1;
export const NIM_MAX_TAKE = 3;

export interface NimMoveResult {
  valid: boolean;
  newPile: number;
  /** Vrai si le coup vide le tas (le joueur courant a pris la dernière → il perd). */
  finished: boolean;
}

export function resolveNimTake(pile: number, count: number): NimMoveResult {
  if (!Number.isInteger(count) || count < NIM_MIN_TAKE || count > NIM_MAX_TAKE || count > pile) {
    return { valid: false, newPile: pile, finished: false };
  }
  const newPile = pile - count;
  return { valid: true, newPile, finished: newPile === 0 };
}

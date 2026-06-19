/** Pierre-Feuille-Ciseaux — logique pure. */

export type RpsMove = "pierre" | "feuille" | "ciseaux";

const BEATS: Record<RpsMove, RpsMove> = {
  pierre: "ciseaux",
  ciseaux: "feuille",
  feuille: "pierre",
};

/** Vrai si le coup `a` bat le coup `b`. */
export function rpsBeats(a: RpsMove, b: RpsMove): boolean {
  return BEATS[a] === b;
}

/** Gagnant d'une manche, ou null en cas d'égalité. */
export function rpsRoundWinner<T>(p1: T, m1: RpsMove, p2: T, m2: RpsMove): T | null {
  if (m1 === m2) return null;
  return rpsBeats(m1, m2) ? p1 : p2;
}

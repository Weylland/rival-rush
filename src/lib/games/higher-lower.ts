/** Plus-ou-Moins — logique pure (indice et resserrage de la plage). */

export type HiLoFeedback = "plus" | "moins" | "exact";

/**
 * Indice pour un essai face au nombre secret :
 * - "plus"  → il faut viser plus haut (essai trop bas)
 * - "moins" → il faut viser plus bas (essai trop haut)
 * - "exact" → trouvé
 */
export function higherLowerFeedback(guess: number, secret: number): HiLoFeedback {
  if (guess === secret) return "exact";
  return guess < secret ? "plus" : "moins";
}

/** Resserre la plage [min, max] en fonction de l'indice obtenu. */
export function narrowRange(
  min: number,
  max: number,
  guess: number,
  feedback: HiLoFeedback,
): { min: number; max: number } {
  if (feedback === "plus") return { min: Math.max(min, guess + 1), max };
  if (feedback === "moins") return { min, max: Math.min(max, guess - 1) };
  return { min: guess, max: guess }; // exact
}

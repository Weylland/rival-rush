/**
 * Mastermind — logique pure (sans I/O), réutilisée par l'action serveur et testée unitairement.
 *
 * Règles officielles, version duel "course" :
 * - chaque joueur a son PROPRE code secret de 4 pions parmi 6 couleurs (index 0-5),
 * - chacun ne voit que son plateau et court pour craquer son code,
 * - premier à 4 pions noirs (bonnes couleurs bien placées) gagne.
 */

export const MM_PEGS = 4;
export const MM_COLORS = 6;
export const MM_MAX_GUESSES = 12;

export interface Feedback {
  /** Bonne couleur, bonne place. */
  blacks: number;
  /** Bonne couleur, mauvaise place. */
  whites: number;
}

/** Code secret aléatoire : 4 couleurs (répétitions autorisées, règles officielles). */
export function generateCode(): number[] {
  return Array.from({ length: MM_PEGS }, () => Math.floor(Math.random() * MM_COLORS));
}

/** Un essai est valide : 4 entiers compris entre 0 et 5. */
export function isValidGuess(guess: unknown): guess is number[] {
  return (
    Array.isArray(guess) &&
    guess.length === MM_PEGS &&
    guess.every(c => Number.isInteger(c) && c >= 0 && c < MM_COLORS)
  );
}

/**
 * Feedback Mastermind officiel.
 * blacks = pions exacts ; whites = bonnes couleurs mal placées, sans double comptage.
 */
export function calcFeedback(code: number[], guess: number[]): Feedback {
  let blacks = 0;
  const codeCount = new Array(MM_COLORS).fill(0);
  const guessCount = new Array(MM_COLORS).fill(0);

  for (let i = 0; i < MM_PEGS; i++) {
    if (guess[i] === code[i]) {
      blacks++;
    } else {
      codeCount[code[i]]++;
      guessCount[guess[i]]++;
    }
  }

  let whites = 0;
  for (let c = 0; c < MM_COLORS; c++) {
    whites += Math.min(codeCount[c], guessCount[c]);
  }

  return { blacks, whites };
}

/** Un essai gagnant : tous les pions sont noirs. */
export function isWinningFeedback(fb: Feedback): boolean {
  return fb.blacks === MM_PEGS;
}

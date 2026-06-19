import { describe, it, expect } from "vitest";
import {
  calcFeedback,
  generateCode,
  isValidGuess,
  isWinningFeedback,
  MM_COLORS,
  MM_PEGS,
} from "./mastermind";

describe("calcFeedback — règles officielles Mastermind", () => {
  it("essai identique au code = 4 noirs, 0 blanc (victoire)", () => {
    expect(calcFeedback([5, 3, 3, 1], [5, 3, 3, 1])).toEqual({ blacks: 4, whites: 0 });
  });

  it("aucune couleur commune = 0 / 0", () => {
    expect(calcFeedback([0, 0, 0, 0], [1, 1, 1, 1])).toEqual({ blacks: 0, whites: 0 });
  });

  it("bonnes couleurs toutes mal placées = 0 noir, 4 blancs", () => {
    expect(calcFeedback([0, 1, 2, 3], [3, 2, 1, 0])).toEqual({ blacks: 0, whites: 4 });
  });

  it("ne double-compte pas une couleur en trop dans l'essai", () => {
    // code a un seul 0 (en position 0, exact). L'essai met des 0 partout.
    // → 1 noir (pos 0), et 0 blanc car le 0 du code est déjà consommé par le noir.
    expect(calcFeedback([0, 1, 2, 3], [0, 0, 0, 0])).toEqual({ blacks: 1, whites: 0 });
  });

  it("compte un blanc quand la couleur existe ailleurs mais une seule fois", () => {
    // code: deux 0. essai: un seul 0 mal placé → 1 blanc.
    expect(calcFeedback([0, 0, 1, 2], [3, 4, 0, 5])).toEqual({ blacks: 0, whites: 1 });
  });

  it("mélange noirs + blancs sans dépasser 4 indices", () => {
    const fb = calcFeedback([5, 3, 3, 1], [4, 3, 5, 1]);
    expect(fb).toEqual({ blacks: 2, whites: 1 });
    expect(fb.blacks + fb.whites).toBeLessThanOrEqual(MM_PEGS);
  });

  it("reproduit un vrai cas de partie (code [5,3,3,1])", () => {
    expect(calcFeedback([5, 3, 3, 1], [3, 3, 3, 1])).toEqual({ blacks: 3, whites: 0 });
    expect(calcFeedback([5, 3, 3, 1], [4, 4, 4, 4])).toEqual({ blacks: 0, whites: 0 });
    expect(calcFeedback([5, 3, 3, 1], [1, 1, 1, 1])).toEqual({ blacks: 1, whites: 0 });
  });
});

describe("isWinningFeedback", () => {
  it("vrai uniquement à 4 noirs", () => {
    expect(isWinningFeedback({ blacks: 4, whites: 0 })).toBe(true);
    expect(isWinningFeedback({ blacks: 3, whites: 1 })).toBe(false);
  });
});

describe("generateCode", () => {
  it("génère 4 couleurs valides", () => {
    for (let i = 0; i < 200; i++) {
      const code = generateCode();
      expect(code).toHaveLength(MM_PEGS);
      expect(code.every(c => Number.isInteger(c) && c >= 0 && c < MM_COLORS)).toBe(true);
    }
  });
});

describe("isValidGuess", () => {
  it("accepte un essai correct", () => {
    expect(isValidGuess([0, 1, 2, 3])).toBe(true);
    expect(isValidGuess([5, 5, 5, 5])).toBe(true);
  });

  it("rejette mauvaise longueur, hors bornes, non-entiers", () => {
    expect(isValidGuess([0, 1, 2])).toBe(false);
    expect(isValidGuess([0, 1, 2, 3, 4])).toBe(false);
    expect(isValidGuess([0, 1, 2, 6])).toBe(false);
    expect(isValidGuess([0, 1, 2, -1])).toBe(false);
    expect(isValidGuess([0, 1, 2, 1.5])).toBe(false);
    expect(isValidGuess("oops")).toBe(false);
    expect(isValidGuess(null)).toBe(false);
  });
});

import { describe, it, expect } from "vitest";
import { isPigBust, pigBank, PIG_WIN_SCORE } from "./pig";

describe("isPigBust", () => {
  it("seul un 1 fait perdre la mise", () => {
    expect(isPigBust(1)).toBe(true);
    [2, 3, 4, 5, 6].forEach(r => expect(isPigBust(r)).toBe(false));
  });
});

describe("pigBank", () => {
  it("ajoute le cumul du tour au score", () => {
    expect(pigBank(20, 15)).toEqual({ newScore: 35, finished: false });
  });

  it("gagne en atteignant ou dépassant le score cible", () => {
    expect(pigBank(90, 10)).toEqual({ newScore: PIG_WIN_SCORE, finished: true });
    expect(pigBank(95, 20).finished).toBe(true);
  });

  it("ne gagne pas en dessous de la cible", () => {
    expect(pigBank(80, 19).finished).toBe(false);
  });
});

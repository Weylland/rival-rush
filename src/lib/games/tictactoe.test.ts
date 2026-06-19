import { describe, it, expect } from "vitest";
import { tictactoeWinner, tictactoeWinningLine } from "./tictactoe";

const N = null;

describe("tictactoeWinner", () => {
  it("null sur plateau vide", () => {
    expect(tictactoeWinner([N, N, N, N, N, N, N, N, N])).toBeNull();
  });

  it("détecte une ligne", () => {
    expect(tictactoeWinner(["A", "A", "A", N, N, N, N, N, N])).toBe("A");
  });

  it("détecte une colonne", () => {
    expect(tictactoeWinner(["B", N, N, "B", N, N, "B", N, N])).toBe("B");
  });

  it("détecte une diagonale", () => {
    expect(tictactoeWinner(["A", N, N, N, "A", N, N, N, "A"])).toBe("A");
    expect(tictactoeWinner([N, N, "B", N, "B", N, "B", N, N])).toBe("B");
  });

  it("pas de gagnant sur plateau plein sans alignement (nul)", () => {
    // A B A / A B B / B A A
    expect(tictactoeWinner(["A", "B", "A", "A", "B", "B", "B", "A", "A"])).toBeNull();
  });
});

describe("tictactoeWinningLine", () => {
  it("null sans alignement", () => {
    expect(tictactoeWinningLine([N, N, N, N, N, N, N, N, N])).toBeNull();
  });

  it("retourne les indices de la ligne gagnante", () => {
    expect(tictactoeWinningLine(["A", "A", "A", N, N, N, N, N, N])).toEqual([0, 1, 2]);
    expect(tictactoeWinningLine([N, N, "B", N, "B", N, "B", N, N])).toEqual([2, 4, 6]);
  });
});

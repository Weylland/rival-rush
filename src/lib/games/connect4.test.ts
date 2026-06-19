import { describe, it, expect } from "vitest";
import { connect4Winner, connect4WinningCells, dropRow, isBoardFull, C4_COLS, C4_ROWS } from "./connect4";

const empty = () => Array<string | null>(C4_ROWS * C4_COLS).fill(null);
const idx = (r: number, c: number) => r * C4_COLS + c;

describe("connect4Winner", () => {
  it("null sur plateau vide", () => {
    expect(connect4Winner(empty())).toBeNull();
  });

  it("détecte un alignement horizontal", () => {
    const b = empty();
    [0, 1, 2, 3].forEach(c => (b[idx(5, c)] = "A"));
    expect(connect4Winner(b)).toBe("A");
  });

  it("détecte un alignement vertical", () => {
    const b = empty();
    [2, 3, 4, 5].forEach(r => (b[idx(r, 0)] = "B"));
    expect(connect4Winner(b)).toBe("B");
  });

  it("détecte une diagonale ↘", () => {
    const b = empty();
    [[2, 0], [3, 1], [4, 2], [5, 3]].forEach(([r, c]) => (b[idx(r, c)] = "A"));
    expect(connect4Winner(b)).toBe("A");
  });

  it("détecte une diagonale ↙", () => {
    const b = empty();
    [[2, 3], [3, 2], [4, 1], [5, 0]].forEach(([r, c]) => (b[idx(r, c)] = "B"));
    expect(connect4Winner(b)).toBe("B");
  });

  it("pas de faux positif en bord de ligne (pas de wrap-around)", () => {
    const b = empty();
    [idx(0, 6), idx(1, 0), idx(1, 1), idx(1, 2)].forEach(i => (b[i] = "A"));
    expect(connect4Winner(b)).toBeNull();
  });

  it("3 alignés seulement ne gagnent pas", () => {
    const b = empty();
    [0, 1, 2].forEach(c => (b[idx(5, c)] = "A"));
    expect(connect4Winner(b)).toBeNull();
  });
});

describe("dropRow", () => {
  it("tombe en bas sur colonne vide", () => {
    expect(dropRow(empty(), 3)).toBe(C4_ROWS - 1);
  });

  it("retourne -1 sur colonne pleine", () => {
    const b = empty();
    for (let r = 0; r < C4_ROWS; r++) b[idx(r, 3)] = "A";
    expect(dropRow(b, 3)).toBe(-1);
  });

  it("empile au-dessus du dernier jeton", () => {
    const b = empty();
    b[idx(5, 3)] = "A";
    expect(dropRow(b, 3)).toBe(4);
  });
});

describe("isBoardFull", () => {
  it("faux si une case est libre, vrai si plein", () => {
    expect(isBoardFull(empty())).toBe(false);
    expect(isBoardFull(Array(42).fill("A"))).toBe(true);
  });
});

describe("connect4WinningCells", () => {
  it("null sans alignement", () => {
    expect(connect4WinningCells(empty())).toBeNull();
  });

  it("retourne les 4 indices d'un alignement horizontal", () => {
    const b = empty();
    [0, 1, 2, 3].forEach(c => (b[idx(5, c)] = "A"));
    expect(connect4WinningCells(b)).toEqual([idx(5, 0), idx(5, 1), idx(5, 2), idx(5, 3)]);
  });

  it("retourne les 4 indices d'une diagonale ↘", () => {
    const b = empty();
    [[2, 0], [3, 1], [4, 2], [5, 3]].forEach(([r, c]) => (b[idx(r, c)] = "A"));
    expect(connect4WinningCells(b)).toEqual([idx(2, 0), idx(3, 1), idx(4, 2), idx(5, 3)]);
  });
});

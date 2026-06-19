import { describe, it, expect } from "vitest";
import { calcFeedback, isWinningFeedback, MM_MAX_GUESSES, MM_COLORS } from "@/lib/mastermind";
import { connect4Winner, dropRow, C4_COLS, C4_ROWS } from "./connect4";
import { resolveNimTake } from "./nim";

/**
 * Tests de simulation : des bots jouent des parties entières via le moteur de
 * règles. But : prouver que les jeux se terminent et que les règles sont saines,
 * sans navigateur ni base de données.
 */

// ── Mastermind : tout code est-il craquable dans la limite d'essais ? ──────────
describe("Mastermind — solvabilité (bot solveur)", () => {
  // Tous les codes possibles (6^4 = 1296)
  const ALL: number[][] = [];
  for (let a = 0; a < MM_COLORS; a++)
    for (let b = 0; b < MM_COLORS; b++)
      for (let c = 0; c < MM_COLORS; c++)
        for (let d = 0; d < MM_COLORS; d++)
          ALL.push([a, b, c, d]);

  /** Solveur naïf "essai cohérent" : renvoie le nombre d'essais pour craquer `secret`. */
  function solve(secret: number[]): number {
    let candidates = ALL;
    let guess = [0, 0, 1, 1]; // ouverture classique
    for (let n = 1; n <= MM_MAX_GUESSES + 1; n++) {
      const fb = calcFeedback(secret, guess);
      if (isWinningFeedback(fb)) return n;
      candidates = candidates.filter(c => {
        const f = calcFeedback(c, guess);
        return f.blacks === fb.blacks && f.whites === fb.whites;
      });
      guess = candidates[0];
    }
    return Infinity; // non résolu dans la limite
  }

  it("les 1296 codes sont tous craquables dans la limite de 12 essais", () => {
    let worst = 0;
    for (const secret of ALL) {
      const n = solve(secret);
      if (n > worst) worst = n;
    }
    expect(worst).toBeLessThanOrEqual(MM_MAX_GUESSES);
    // Le solveur naïf fait nettement mieux que la limite (sanity check)
    expect(worst).toBeLessThanOrEqual(8);
  });

  it("le feedback d'un essai = code donne toujours la victoire", () => {
    expect(isWinningFeedback(calcFeedback([3, 1, 4, 1], [3, 1, 4, 1]))).toBe(true);
  });
});

// ── Puissance 4 : auto-jeu aléatoire ───────────────────────────────────────────
describe("Puissance 4 — auto-jeu aléatoire", () => {
  function playRandomGame(seed: number): { winner: string | null; lastMover: string | null } {
    // PRNG déterministe pour reproductibilité
    let s = seed;
    const rng = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };

    const board: (string | null)[] = Array(C4_ROWS * C4_COLS).fill(null);
    let turn: "A" | "B" = "A";
    let lastMover: string | null = null;

    for (let move = 0; move < C4_ROWS * C4_COLS; move++) {
      const cols = [...Array(C4_COLS).keys()].filter(c => dropRow(board, c) !== -1);
      if (cols.length === 0) break;
      const col = cols[Math.floor(rng() * cols.length)];
      const row = dropRow(board, col);
      board[row * C4_COLS + col] = turn;
      lastMover = turn;
      if (connect4Winner(board)) return { winner: connect4Winner(board), lastMover };
      turn = turn === "A" ? "B" : "A";
    }
    return { winner: connect4Winner(board), lastMover };
  }

  it("500 parties se terminent ; tout gagnant est le dernier joueur ayant posé", () => {
    for (let seed = 1; seed <= 500; seed++) {
      const { winner, lastMover } = playRandomGame(seed);
      if (winner) expect(winner).toBe(lastMover); // on ne peut gagner que sur son propre coup
    }
  });
});

// ── Nim : auto-jeu, la partie se termine toujours ──────────────────────────────
describe("Nim — auto-jeu (règle misère)", () => {
  it("une partie aléatoire vide toujours le tas et désigne un perdant", () => {
    for (let seed = 1; seed <= 200; seed++) {
      let s = seed;
      const rng = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };

      let pile = 15 + Math.floor(rng() * 11); // 15..25
      let turn: "A" | "B" = "A";
      let lastTaker: "A" | "B" | null = null;
      let finished = false;
      let safety = 0;

      while (!finished && safety++ < 100) {
        const max = Math.min(3, pile);
        const count = 1 + Math.floor(rng() * max);
        const res = resolveNimTake(pile, count);
        expect(res.valid).toBe(true);
        pile = res.newPile;
        lastTaker = turn;
        finished = res.finished;
        turn = turn === "A" ? "B" : "A";
      }

      expect(finished).toBe(true); // la partie se termine
      expect(pile).toBe(0);        // le tas est vidé
      expect(lastTaker).not.toBeNull(); // celui qui a pris la dernière (= le perdant)
    }
  });
});

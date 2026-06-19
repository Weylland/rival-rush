import { describe, it, expect } from "vitest";
import {
  initialBoard,
  initialChessState,
  legalMoves,
  applyMove,
  isInCheck,
  isCheckmate,
  isStalemate,
  pieceColor,
  type ChessState,
} from "./chess";

// Aide : index 0 = a8 (haut, noirs), index 63 = h1 (bas, blancs). sq(row,col) = row*8+col.
const sq = (row: number, col: number) => row * 8 + col;

function bareState(board: (string | null)[], overrides: Partial<ChessState> = {}): ChessState {
  return {
    board,
    enPassantTarget: null,
    castlingRights: { wK: false, wQ: false, bK: false, bQ: false },
    lastMove: null,
    timeControl: null,
    timeLeft: null,
    lastMoveAt: null,
    ...overrides,
  };
}

describe("initialBoard", () => {
  it("place 32 pièces avec les rois aux bonnes cases", () => {
    const b = initialBoard();
    expect(b.filter(Boolean)).toHaveLength(32);
    expect(b[sq(7, 4)]).toBe("wK"); // e1
    expect(b[sq(0, 4)]).toBe("bK"); // e8
    expect(b[sq(6, 0)]).toBe("wP"); // a2
  });
});

describe("legalMoves — position de départ", () => {
  it("le pion e2 peut avancer d'une ou deux cases", () => {
    const s = initialChessState();
    const moves = legalMoves(s, sq(6, 4)); // e2
    expect(new Set(moves)).toEqual(new Set([sq(5, 4), sq(4, 4)])); // e3, e4
  });

  it("le cavalier b1 a deux coups", () => {
    const s = initialChessState();
    const moves = legalMoves(s, sq(7, 1)); // b1
    expect(new Set(moves)).toEqual(new Set([sq(5, 0), sq(5, 2)])); // a3, c3
  });

  it("aucun roi n'est en échec au départ", () => {
    const s = initialChessState();
    expect(isInCheck(s.board, "w")).toBe(false);
    expect(isInCheck(s.board, "b")).toBe(false);
  });
});

describe("applyMove", () => {
  it("définit la case en passant après un double pas de pion", () => {
    const s = initialChessState();
    const after = applyMove(s, sq(6, 4), sq(4, 4)); // e2-e4
    expect(after.enPassantTarget).toBe(sq(5, 4)); // e3
    expect(after.board[sq(4, 4)]).toBe("wP");
    expect(after.board[sq(6, 4)]).toBeNull();
  });

  it("promeut un pion arrivé sur la dernière rangée", () => {
    const board: (string | null)[] = Array(64).fill(null);
    board[sq(1, 0)] = "wP"; // a7
    board[sq(7, 4)] = "wK";
    board[sq(0, 7)] = "bK";
    const after = applyMove(bareState(board), sq(1, 0), sq(0, 0), "Q"); // a7-a8=Q
    expect(after.board[sq(0, 0)]).toBe("wQ");
  });
});

describe("fins de partie", () => {
  it("détecte le mat du fou (fool's mate)", () => {
    let s = initialChessState();
    s = applyMove(s, sq(6, 5), sq(5, 5)); // f2-f3
    s = applyMove(s, sq(1, 4), sq(3, 4)); // e7-e5
    s = applyMove(s, sq(6, 6), sq(4, 6)); // g2-g4
    s = applyMove(s, sq(0, 3), sq(4, 7)); // Dd8-h4#
    expect(isInCheck(s.board, "w")).toBe(true);
    expect(isCheckmate(s, "w")).toBe(true);
    expect(isCheckmate(s, "b")).toBe(false);
  });

  it("détecte un pat (roi noir h8, roi blanc f7, dame blanche g6)", () => {
    const board: (string | null)[] = Array(64).fill(null);
    board[sq(0, 7)] = "bK"; // h8
    board[sq(1, 5)] = "wK"; // f7
    board[sq(2, 6)] = "wQ"; // g6
    const s = bareState(board);
    expect(isInCheck(s.board, "b")).toBe(false);
    expect(isStalemate(s, "b")).toBe(true);
    expect(isCheckmate(s, "b")).toBe(false);
  });
});

describe("pieceColor", () => {
  it("lit la couleur d'une pièce", () => {
    expect(pieceColor("wK")).toBe("w");
    expect(pieceColor("bP")).toBe("b");
    expect(pieceColor(null)).toBeNull();
  });
});

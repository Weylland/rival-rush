// Pure chess engine — no browser APIs, importable from server and client

export type Color = "w" | "b";
export type PieceType = "P" | "R" | "N" | "B" | "Q" | "K";
export type Piece = string; // "wP", "bK", etc.

export interface ChessState {
  board: (string | null)[];
  enPassantTarget: number | null;
  castlingRights: { wK: boolean; wQ: boolean; bK: boolean; bQ: boolean };
  lastMove: { from: number; to: number } | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function r(idx: number) { return Math.floor(idx / 8); }
function c(idx: number) { return idx % 8; }
function sq(row: number, col: number) { return row * 8 + col; }
export function pieceColor(p: string | null): Color | null { return p ? (p[0] as Color) : null; }
export function pieceType(p: string | null): PieceType | null { return p ? (p[1] as PieceType) : null; }

// ── Starting position ─────────────────────────────────────────────────────────

export function initialBoard(): (string | null)[] {
  const b: (string | null)[] = Array(64).fill(null);
  const backRow = ["R", "N", "B", "Q", "K", "B", "N", "R"] as PieceType[];
  for (let col = 0; col < 8; col++) {
    b[col] = `b${backRow[col]}`;       // row 0 — black back rank
    b[8 + col] = "bP";                  // row 1 — black pawns
    b[48 + col] = "wP";                 // row 6 — white pawns
    b[56 + col] = `w${backRow[col]}`;  // row 7 — white back rank
  }
  return b;
}

export function initialChessState(): ChessState {
  return {
    board: initialBoard(),
    enPassantTarget: null,
    castlingRights: { wK: true, wQ: true, bK: true, bQ: true },
    lastMove: null,
  };
}

// ── Raw move generation (no check filtering) ──────────────────────────────────

function rawMoves(
  board: (string | null)[],
  from: number,
  enPassantTarget: number | null,
  castlingRights: ChessState["castlingRights"],
): number[] {
  const piece = board[from];
  if (!piece) return [];
  const color = pieceColor(piece)!;
  const type = pieceType(piece)!;
  const opp: Color = color === "w" ? "b" : "w";
  const row = r(from);
  const col = c(from);
  const moves: number[] = [];

  function slide(dr: number, dc: number) {
    let nr = row + dr, nc = col + dc;
    while (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
      const to = sq(nr, nc);
      if (!board[to]) {
        moves.push(to);
      } else {
        if (pieceColor(board[to]) === opp) moves.push(to);
        break;
      }
      nr += dr; nc += dc;
    }
  }

  switch (type) {
    case "P": {
      const dir = color === "w" ? -1 : 1;
      const startRow = color === "w" ? 6 : 1;
      const fwd1 = sq(row + dir, col);
      if (row + dir >= 0 && row + dir < 8 && !board[fwd1]) {
        moves.push(fwd1);
        if (row === startRow) {
          const fwd2 = sq(row + 2 * dir, col);
          if (!board[fwd2]) moves.push(fwd2);
        }
      }
      for (const dc of [-1, 1]) {
        const nc = col + dc;
        const nr = row + dir;
        if (nc < 0 || nc > 7 || nr < 0 || nr > 7) continue;
        const to = sq(nr, nc);
        if (board[to] && pieceColor(board[to]) === opp) moves.push(to);
        else if (enPassantTarget === to) moves.push(to);
      }
      break;
    }
    case "R": slide(1, 0); slide(-1, 0); slide(0, 1); slide(0, -1); break;
    case "B": slide(1, 1); slide(1, -1); slide(-1, 1); slide(-1, -1); break;
    case "Q":
      slide(1, 0); slide(-1, 0); slide(0, 1); slide(0, -1);
      slide(1, 1); slide(1, -1); slide(-1, 1); slide(-1, -1);
      break;
    case "N":
      for (const [dr, dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]) {
        const nr = row + dr, nc = col + dc;
        if (nr < 0 || nr > 7 || nc < 0 || nc > 7) continue;
        const to = sq(nr, nc);
        if (!board[to] || pieceColor(board[to]) === opp) moves.push(to);
      }
      break;
    case "K": {
      for (const [dr, dc] of [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]) {
        const nr = row + dr, nc = col + dc;
        if (nr < 0 || nr > 7 || nc < 0 || nc > 7) continue;
        const to = sq(nr, nc);
        if (!board[to] || pieceColor(board[to]) === opp) moves.push(to);
      }
      const back = color === "w" ? 7 : 0;
      if (row === back && col === 4) {
        // Kingside
        if ((color === "w" ? castlingRights.wK : castlingRights.bK) &&
            !board[sq(back, 5)] && !board[sq(back, 6)] &&
            board[sq(back, 7)] === `${color}R`) {
          moves.push(sq(back, 6));
        }
        // Queenside
        if ((color === "w" ? castlingRights.wQ : castlingRights.bQ) &&
            !board[sq(back, 3)] && !board[sq(back, 2)] && !board[sq(back, 1)] &&
            board[sq(back, 0)] === `${color}R`) {
          moves.push(sq(back, 2));
        }
      }
      break;
    }
  }
  return moves;
}

// ── Check detection ───────────────────────────────────────────────────────────

export function isSquareAttackedBy(board: (string | null)[], square: number, attackerColor: Color): boolean {
  const noRights = { wK: false, wQ: false, bK: false, bQ: false };
  for (let i = 0; i < 64; i++) {
    if (!board[i] || pieceColor(board[i]) !== attackerColor) continue;
    if (rawMoves(board, i, null, noRights).includes(square)) return true;
  }
  return false;
}

function findKing(board: (string | null)[], color: Color): number {
  return board.indexOf(`${color}K`);
}

export function isInCheck(board: (string | null)[], color: Color): boolean {
  const kingIdx = findKing(board, color);
  if (kingIdx === -1) return false;
  const opp: Color = color === "w" ? "b" : "w";
  return isSquareAttackedBy(board, kingIdx, opp);
}

// ── Apply a move ──────────────────────────────────────────────────────────────

export function applyMove(
  state: ChessState,
  from: number,
  to: number,
  promotion: PieceType = "Q",
): ChessState {
  const board = [...state.board];
  const piece = board[from]!;
  const color = pieceColor(piece)!;
  const type = pieceType(piece)!;
  let enPassantTarget: number | null = null;
  const cr = { ...state.castlingRights };

  // Castling: move the rook
  if (type === "K") {
    const back = color === "w" ? 7 : 0;
    if (from === sq(back, 4) && to === sq(back, 6)) {        // kingside
      board[sq(back, 5)] = board[sq(back, 7)];
      board[sq(back, 7)] = null;
    } else if (from === sq(back, 4) && to === sq(back, 2)) { // queenside
      board[sq(back, 3)] = board[sq(back, 0)];
      board[sq(back, 0)] = null;
    }
    if (color === "w") { cr.wK = false; cr.wQ = false; }
    else               { cr.bK = false; cr.bQ = false; }
  }

  // En passant capture
  if (type === "P" && to === state.enPassantTarget) {
    board[sq(r(from), c(to))] = null;
  }

  // Double pawn push → set en passant target
  if (type === "P" && Math.abs(r(to) - r(from)) === 2) {
    enPassantTarget = sq((r(from) + r(to)) / 2, c(from));
  }

  // Castling rights: rook moves
  if (type === "R") {
    if (from === sq(7, 0)) cr.wQ = false;
    if (from === sq(7, 7)) cr.wK = false;
    if (from === sq(0, 0)) cr.bQ = false;
    if (from === sq(0, 7)) cr.bK = false;
  }
  // Castling rights: rook captured
  if (to === sq(7, 0)) cr.wQ = false;
  if (to === sq(7, 7)) cr.wK = false;
  if (to === sq(0, 0)) cr.bQ = false;
  if (to === sq(0, 7)) cr.bK = false;

  // Move piece
  board[to] = board[from];
  board[from] = null;

  // Pawn promotion
  if (type === "P" && ((color === "w" && r(to) === 0) || (color === "b" && r(to) === 7))) {
    board[to] = `${color}${promotion}`;
  }

  return { board, enPassantTarget, castlingRights: cr, lastMove: { from, to } };
}

// ── Legal moves (filters moves that leave own king in check) ──────────────────

export function legalMoves(state: ChessState, from: number): number[] {
  const piece = state.board[from];
  if (!piece) return [];
  const color = pieceColor(piece)!;
  const opp: Color = color === "w" ? "b" : "w";
  const candidates = rawMoves(state.board, from, state.enPassantTarget, state.castlingRights);

  return candidates.filter(to => {
    // Castling: king must not pass through check
    if (pieceType(piece) === "K") {
      const back = color === "w" ? 7 : 0;
      if (from === sq(back, 4) && to === sq(back, 6)) {
        if (isSquareAttackedBy(state.board, from, opp) ||
            isSquareAttackedBy(state.board, sq(back, 5), opp) ||
            isSquareAttackedBy(state.board, sq(back, 6), opp)) return false;
      }
      if (from === sq(back, 4) && to === sq(back, 2)) {
        if (isSquareAttackedBy(state.board, from, opp) ||
            isSquareAttackedBy(state.board, sq(back, 3), opp) ||
            isSquareAttackedBy(state.board, sq(back, 2), opp)) return false;
      }
    }
    // Move must not leave own king in check
    const newState = applyMove(state, from, to);
    return !isInCheck(newState.board, color);
  });
}

// ── Game-end detection ────────────────────────────────────────────────────────

function hasAnyLegalMove(state: ChessState, color: Color): boolean {
  for (let i = 0; i < 64; i++) {
    if (!state.board[i] || pieceColor(state.board[i]) !== color) continue;
    if (legalMoves(state, i).length > 0) return true;
  }
  return false;
}

export function isCheckmate(state: ChessState, color: Color): boolean {
  return isInCheck(state.board, color) && !hasAnyLegalMove(state, color);
}

export function isStalemate(state: ChessState, color: Color): boolean {
  return !isInCheck(state.board, color) && !hasAnyLegalMove(state, color);
}

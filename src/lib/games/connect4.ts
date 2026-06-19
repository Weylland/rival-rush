/** Puissance 4 — logique pure (détection d'alignement, chute du jeton). */

export const C4_ROWS = 6;
export const C4_COLS = 7;

/** Retourne la valeur (id joueur) gagnante si 4 sont alignés, sinon null. */
export function connect4Winner<T extends string>(
  board: (T | null)[],
  rows = C4_ROWS,
  cols = C4_COLS,
): T | null {
  const get = (r: number, c: number) => board[r * cols + c];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = get(r, c);
      if (!cell) continue;
      // horizontal, vertical, diagonale ↘, diagonale ↙
      if (c + 3 < cols && cell === get(r, c + 1) && cell === get(r, c + 2) && cell === get(r, c + 3)) return cell;
      if (r + 3 < rows && cell === get(r + 1, c) && cell === get(r + 2, c) && cell === get(r + 3, c)) return cell;
      if (r + 3 < rows && c + 3 < cols && cell === get(r + 1, c + 1) && cell === get(r + 2, c + 2) && cell === get(r + 3, c + 3)) return cell;
      if (r + 3 < rows && c - 3 >= 0 && cell === get(r + 1, c - 1) && cell === get(r + 2, c - 2) && cell === get(r + 3, c - 3)) return cell;
    }
  }
  return null;
}

/** Ligne où tomberait un jeton lâché dans la colonne, ou -1 si la colonne est pleine. */
export function dropRow<T>(
  board: (T | null)[],
  col: number,
  rows = C4_ROWS,
  cols = C4_COLS,
): number {
  for (let r = rows - 1; r >= 0; r--) {
    if (board[r * cols + col] === null) return r;
  }
  return -1;
}

export function isBoardFull<T>(board: (T | null)[]): boolean {
  return board.every(c => c !== null);
}

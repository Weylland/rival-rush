/** Morpion (tic-tac-toe) — logique pure. */

export const TICTACTOE_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // lignes
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // colonnes
  [0, 4, 8], [2, 4, 6],             // diagonales
] as const;

/** Retourne la valeur (id joueur) gagnante si une ligne est complète, sinon null. */
export function tictactoeWinner<T extends string>(board: (T | null)[]): T | null {
  for (const [a, b, c] of TICTACTOE_LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a]!;
    }
  }
  return null;
}

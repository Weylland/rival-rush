import { FLEET_DEFS } from "@/lib/battleship";
import type { NavalShip } from "@/types/database";

export type CellKind = "water" | "ship" | "hit" | "miss" | "sunk";

/** Ma grille : mes navires + les tirs reçus de l'adversaire. */
export function computeMyGrid(myShips: NavalShip[], opShots: { cell: number; result: string }[]): CellKind[] {
  const grid: CellKind[] = Array(100).fill("water");
  for (const ship of myShips) {
    for (const c of ship.cells) grid[c] = "ship";
  }
  for (const s of opShots) {
    grid[s.cell] = s.result === "miss" ? "miss" : "hit";
  }
  return grid;
}

/** Grille d'attaque : mes tirs ; les navires coulés (révélés) passent en "sunk". */
export function computeAttackGrid(myShots: { cell: number; result: string }[], opponentSunkShips: NavalShip[]): CellKind[] {
  const grid: CellKind[] = Array(100).fill("water");
  const sunkCells = new Set<number>();
  for (const ship of opponentSunkShips) {
    ship.cells.forEach(c => sunkCells.add(c));
  }
  for (const s of myShots) {
    grid[s.cell] = sunkCells.has(s.cell) ? "sunk" : s.result === "miss" ? "miss" : "hit";
  }
  return grid;
}

/** Cases couvertes par un navire posé à `anchorCell`, ou [] si ça sort de la grille. */
export function getPreviewCells(anchorCell: number, defId: number, horiz: boolean): number[] {
  const def = FLEET_DEFS.find(d => d.id === defId);
  if (!def) return [];
  const row = Math.floor(anchorCell / 10);
  const col = anchorCell % 10;
  const cells: number[] = [];
  for (let i = 0; i < def.size; i++) {
    const r = horiz ? row : row + i;
    const c = horiz ? col + i : col;
    if (r >= 10 || c >= 10) return [];
    cells.push(r * 10 + c);
  }
  return cells;
}

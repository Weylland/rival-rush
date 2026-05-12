import type { NavalShip } from "@/types/database";

export const FLEET_DEFS = [
  { id: 0, name: "Porte-avions", size: 5 },
  { id: 1, name: "Croiseur",     size: 4 },
  { id: 2, name: "Destroyer",    size: 3 },
  { id: 3, name: "Sous-marin",   size: 3 },
  { id: 4, name: "Torpilleur",   size: 2 },
] as const;

// Total ship cells: 5+4+3+3+2 = 17
export const TOTAL_SHIP_CELLS = 17;
export const GRID = 10;

export function generateFleet(): NavalShip[] {
  const occupied = new Set<number>();
  const ships: NavalShip[] = [];

  for (const def of FLEET_DEFS) {
    let placed = false;
    let attempts = 0;

    while (!placed && attempts < 500) {
      attempts++;
      const horiz = Math.random() < 0.5;
      const row = Math.floor(Math.random() * (horiz ? GRID : GRID - def.size + 1));
      const col = Math.floor(Math.random() * (horiz ? GRID - def.size + 1 : GRID));

      const cells: number[] = [];
      let valid = true;

      for (let i = 0; i < def.size; i++) {
        const r = horiz ? row : row + i;
        const c = horiz ? col + i : col;
        const idx = r * GRID + c;
        if (occupied.has(idx)) { valid = false; break; }
        cells.push(idx);
      }

      if (valid) {
        cells.forEach(c => occupied.add(c));
        ships.push({ id: def.id, name: def.name, size: def.size, cells });
        placed = true;
      }
    }

    if (!placed) throw new Error(`Cannot place ship: ${def.name}`);
  }

  return ships;
}

/** Returns the ship hit by a cell index, or null */
export function findHitShip(ships: NavalShip[], cell: number): NavalShip | null {
  return ships.find(s => s.cells.includes(cell)) ?? null;
}

/** Returns true if every cell of the ship has been shot */
export function isShipSunk(ship: NavalShip, shots: number[]): boolean {
  return ship.cells.every(c => shots.includes(c));
}

/** Returns true if all ships are sunk */
export function isFleetSunk(ships: NavalShip[], shots: number[]): boolean {
  return ships.every(s => isShipSunk(s, shots));
}

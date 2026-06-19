import { describe, it, expect } from "vitest";
import {
  generateFleet,
  validateFleet,
  findHitShip,
  isShipSunk,
  isFleetSunk,
  FLEET_DEFS,
  TOTAL_SHIP_CELLS,
} from "./battleship";
import type { NavalShip } from "@/types/database";

describe("generateFleet", () => {
  it("génère une flotte valide à chaque fois (sans chevauchement)", () => {
    for (let i = 0; i < 100; i++) {
      const fleet = generateFleet();
      expect(validateFleet(fleet)).toBe(true);
      const cells = fleet.flatMap(s => s.cells);
      expect(cells).toHaveLength(TOTAL_SHIP_CELLS);
      expect(new Set(cells).size).toBe(TOTAL_SHIP_CELLS); // aucun doublon
    }
  });
});

describe("validateFleet", () => {
  it("rejette une flotte incomplète", () => {
    const fleet = generateFleet().slice(0, 4);
    expect(validateFleet(fleet)).toBe(false);
  });

  it("rejette un bateau en diagonale", () => {
    const fleet: NavalShip[] = FLEET_DEFS.map(def => ({
      id: def.id, name: def.name, size: def.size,
      cells: Array.from({ length: def.size }, (_, i) => i * 11), // 0,11,22… diagonale
    }));
    expect(validateFleet(fleet)).toBe(false);
  });

  it("rejette un bateau hors grille", () => {
    const fleet = generateFleet();
    fleet[0] = { ...fleet[0], cells: fleet[0].cells.map(() => 999) };
    expect(validateFleet(fleet)).toBe(false);
  });
});

describe("touches & naufrages", () => {
  const ship: NavalShip = { id: 2, name: "Destroyer", size: 3, cells: [10, 11, 12] };

  it("findHitShip trouve le bateau touché", () => {
    expect(findHitShip([ship], 11)).toBe(ship);
    expect(findHitShip([ship], 50)).toBeNull();
  });

  it("isShipSunk vrai seulement quand toutes les cases sont touchées", () => {
    expect(isShipSunk(ship, [10, 11])).toBe(false);
    expect(isShipSunk(ship, [10, 11, 12])).toBe(true);
  });

  it("isFleetSunk vrai quand toute la flotte est coulée", () => {
    const fleet: NavalShip[] = [
      { id: 0, name: "A", size: 2, cells: [0, 1] },
      { id: 1, name: "B", size: 2, cells: [20, 21] },
    ];
    expect(isFleetSunk(fleet, [0, 1, 20])).toBe(false);
    expect(isFleetSunk(fleet, [0, 1, 20, 21])).toBe(true);
  });
});

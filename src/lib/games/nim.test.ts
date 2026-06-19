import { describe, it, expect } from "vitest";
import { resolveNimTake } from "./nim";

describe("resolveNimTake (règle misère)", () => {
  it("retire les allumettes du tas", () => {
    expect(resolveNimTake(15, 3)).toEqual({ valid: true, newPile: 12, finished: false });
    expect(resolveNimTake(10, 1)).toEqual({ valid: true, newPile: 9, finished: false });
  });

  it("vider le tas termine la partie (celui qui prend la dernière perd)", () => {
    expect(resolveNimTake(2, 2)).toEqual({ valid: true, newPile: 0, finished: true });
    expect(resolveNimTake(1, 1)).toEqual({ valid: true, newPile: 0, finished: true });
  });

  it("refuse 0, plus de 3, ou plus que le tas", () => {
    expect(resolveNimTake(15, 0).valid).toBe(false);
    expect(resolveNimTake(15, 4).valid).toBe(false);
    expect(resolveNimTake(2, 3).valid).toBe(false);
    expect(resolveNimTake(15, 1.5).valid).toBe(false);
  });

  it("un coup invalide ne change pas le tas", () => {
    expect(resolveNimTake(5, 9)).toEqual({ valid: false, newPile: 5, finished: false });
  });
});

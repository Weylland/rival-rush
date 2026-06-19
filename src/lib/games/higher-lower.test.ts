import { describe, it, expect } from "vitest";
import { higherLowerFeedback, narrowRange } from "./higher-lower";

describe("higherLowerFeedback", () => {
  it("indique la direction du secret", () => {
    expect(higherLowerFeedback(50, 50)).toBe("exact");
    expect(higherLowerFeedback(30, 50)).toBe("plus");  // trop bas → viser plus haut
    expect(higherLowerFeedback(70, 50)).toBe("moins"); // trop haut → viser plus bas
  });
});

describe("narrowRange", () => {
  it("remonte le minimum sur 'plus'", () => {
    expect(narrowRange(1, 100, 30, "plus")).toEqual({ min: 31, max: 100 });
  });
  it("abaisse le maximum sur 'moins'", () => {
    expect(narrowRange(1, 100, 70, "moins")).toEqual({ min: 1, max: 69 });
  });
  it("verrouille la plage sur 'exact'", () => {
    expect(narrowRange(1, 100, 42, "exact")).toEqual({ min: 42, max: 42 });
  });
  it("ne relâche jamais une borne déjà resserrée (essai hors plage)", () => {
    expect(narrowRange(40, 60, 30, "plus")).toEqual({ min: 40, max: 60 });
    expect(narrowRange(40, 60, 90, "moins")).toEqual({ min: 40, max: 60 });
  });
});

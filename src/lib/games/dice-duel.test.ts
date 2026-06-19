import { describe, it, expect } from "vitest";
import { diceDuelRoundWinner } from "./dice-duel";

describe("diceDuelRoundWinner", () => {
  it("le dé le plus haut gagne", () => {
    expect(diceDuelRoundWinner("p1", 6, "p2", 3)).toBe("p1");
    expect(diceDuelRoundWinner("p1", 2, "p2", 5)).toBe("p2");
  });
  it("égalité → null", () => {
    expect(diceDuelRoundWinner("p1", 4, "p2", 4)).toBeNull();
  });
});

import { describe, it, expect } from "vitest";
import { rpsBeats, rpsRoundWinner } from "./rps";

describe("rpsBeats", () => {
  it("respecte le cycle pierre>ciseaux>feuille>pierre", () => {
    expect(rpsBeats("pierre", "ciseaux")).toBe(true);
    expect(rpsBeats("ciseaux", "feuille")).toBe(true);
    expect(rpsBeats("feuille", "pierre")).toBe(true);
    expect(rpsBeats("ciseaux", "pierre")).toBe(false);
    expect(rpsBeats("pierre", "feuille")).toBe(false);
  });
});

describe("rpsRoundWinner", () => {
  it("égalité → null", () => {
    expect(rpsRoundWinner("p1", "pierre", "p2", "pierre")).toBeNull();
  });
  it("désigne le bon gagnant", () => {
    expect(rpsRoundWinner("p1", "pierre", "p2", "ciseaux")).toBe("p1");
    expect(rpsRoundWinner("p1", "pierre", "p2", "feuille")).toBe("p2");
  });
});

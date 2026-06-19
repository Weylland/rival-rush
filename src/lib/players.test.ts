import { describe, it, expect } from "vitest";
import { resolveDuo } from "./players";

const base = {
  p1Id: "p1", p2Id: "p2",
  p1Pseudo: "Alice", p2Pseudo: "Bob",
  p1AvatarUrl: "a.png", p2AvatarUrl: "b.png",
};

describe("resolveDuo", () => {
  it("point de vue du joueur 1", () => {
    expect(resolveDuo({ myId: "p1", ...base })).toEqual({
      iAmP1: true, opponentId: "p2",
      myPseudo: "Alice", opPseudo: "Bob",
      myAvatarUrl: "a.png", opAvatarUrl: "b.png",
    });
  });

  it("point de vue du joueur 2 (tout est inversé)", () => {
    expect(resolveDuo({ myId: "p2", ...base })).toEqual({
      iAmP1: false, opponentId: "p1",
      myPseudo: "Bob", opPseudo: "Alice",
      myAvatarUrl: "b.png", opAvatarUrl: "a.png",
    });
  });

  it("avatars manquants → null", () => {
    const duo = resolveDuo({ myId: "p1", p1Id: "p1", p2Id: "p2", p1Pseudo: "A", p2Pseudo: "B" });
    expect(duo.myAvatarUrl).toBeNull();
    expect(duo.opAvatarUrl).toBeNull();
  });
});

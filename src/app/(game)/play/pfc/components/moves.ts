import { RR } from "@/lib/design";

export type PFCMove = "pierre" | "feuille" | "ciseaux";

export const MOVES: { id: PFCMove; emoji: string; label: string; color: string; shadow: string }[] = [
  { id: "pierre",  emoji: "✊", label: "Pierre",  color: RR.cyan,   shadow: RR.pink },
  { id: "feuille", emoji: "✋", label: "Feuille", color: RR.pink,   shadow: RR.cyan },
  { id: "ciseaux", emoji: "✂️", label: "Ciseaux", color: RR.butter, shadow: RR.pink },
];

import { EA } from "@/lib/design";

export type PFCMove = "pierre" | "feuille" | "ciseaux";

export const MOVES: { id: PFCMove; emoji: string; label: string; color: string; shadow: string }[] = [
  { id: "pierre",  emoji: "✊", label: "Pierre",  color: EA.cyan,   shadow: EA.pink },
  { id: "feuille", emoji: "✋", label: "Feuille", color: EA.pink,   shadow: EA.cyan },
  { id: "ciseaux", emoji: "✂️", label: "Ciseaux", color: EA.butter, shadow: EA.pink },
];

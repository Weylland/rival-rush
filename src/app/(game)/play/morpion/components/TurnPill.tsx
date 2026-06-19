import { EA } from "@/lib/design";

interface Props {
  isFinished: boolean;
  isDraw: boolean;
  iWon: boolean;
  isMyTurn: boolean;
  opPseudo: string;
}

/** Pastille d'état : résultat si fini, sinon indication de tour. */
export function TurnPill({ isFinished, isDraw, iWon, isMyTurn, opPseudo }: Props) {
  if (isFinished) {
    const color = isDraw ? EA.butter : iWon ? EA.cyan : EA.pink;
    return (
      <div style={{ background: isDraw ? `rgba(255,233,74,0.15)` : iWon ? `rgba(0,212,232,0.15)` : `rgba(255,30,140,0.15)`, border: `2px solid ${color}`, borderRadius: 999, padding: "8px 20px", display: "inline-flex", alignItems: "center", gap: 8, boxShadow: `3px 3px 0 ${color}` }}>
        <span style={{ fontFamily: "var(--font-display)", fontSize: 24, color, transform: "skewX(-6deg)" }}>
          {isDraw ? "🤝 MATCH NUL !" : iWon ? "🏆 VICTOIRE !" : "💀 DÉFAITE !"}
        </span>
      </div>
    );
  }
  return (
    <div style={{ background: "rgba(26,15,94,0.7)", border: `2px solid ${EA.ink}`, borderRadius: 999, padding: "8px 18px", display: "inline-flex", alignItems: "center", gap: 10, boxShadow: `3px 3px 0 ${EA.cyan}` }}>
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: isMyTurn ? EA.butter : EA.cyan, boxShadow: `0 0 10px ${isMyTurn ? EA.butter : EA.cyan}`, animation: "ea-pulse 1.2s ease-in-out infinite", flexShrink: 0 }} />
      <span style={{ fontFamily: "var(--font-sans)", fontStyle: "italic", fontSize: 14, fontWeight: 800, color: EA.white }}>
        {isMyTurn ? "À toi de jouer !" : `${opPseudo} réfléchit...`}
      </span>
    </div>
  );
}

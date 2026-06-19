import { EA } from "@/lib/design";
import { Avatar } from "@/components/ui/avatar";

interface Props {
  pseudo: string;
  avatarUrl: string | null;
  score: number;
  side: "left" | "right";
  isArmed: boolean;
  /** Affiche le badge "✓ PRÊT" (phase idle, joueur prêt). */
  showReady: boolean;
}

/** En-tête joueur du jeu Réflexe (carte + score), symétrique gauche/droite. */
export function ScorePanel({ pseudo, avatarUrl, score, side, isArmed, showReady }: Props) {
  const isMe = side === "left";
  const cardBg = isArmed ? "rgba(255,80,0,0.15)" : isMe ? EA.pink : EA.cyan;
  const textColor = isArmed ? "rgba(255,200,150,0.7)" : isMe ? EA.white : EA.ink;
  const scoreColor = isArmed ? EA.butter : isMe ? EA.white : EA.ink;

  const nameEl = (
    <div style={{ minWidth: 0, ...(isMe ? {} : { textAlign: "right" as const }) }}>
      <div style={{ fontFamily: "var(--font-display)", fontSize: 10, color: textColor, transform: "skewX(-4deg)", lineHeight: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{pseudo.toUpperCase()}</div>
      <div style={{ fontFamily: "var(--font-display)", fontSize: 30, color: scoreColor, lineHeight: 1, transition: "color 0.3s" }}>{score}</div>
    </div>
  );
  const avatarEl = (
    <Avatar name={pseudo} color={isMe ? EA.butter : EA.pink} ring={EA.ink} size={32} src={avatarUrl} />
  );

  return (
    <div style={{ flex: 1, minWidth: 0, position: "relative" }}>
      {showReady && (
        <div style={{
          position: "absolute", top: -10, [isMe ? "left" : "right"]: -6, zIndex: 10,
          background: EA.cyan, border: `2px solid ${EA.ink}`,
          padding: "2px 8px", borderRadius: 999,
          fontFamily: "var(--font-display)", fontSize: 9, color: EA.ink,
          transform: isMe ? "rotate(-8deg)" : "rotate(8deg)", boxShadow: `2px 2px 0 ${EA.ink}`,
        }}>✓ PRÊT</div>
      )}
      <div style={{
        background: cardBg,
        border: `2.5px solid ${isArmed ? "rgba(255,80,0,0.5)" : EA.ink}`,
        borderRadius: 18, padding: "10px 12px",
        display: "flex", alignItems: "center", gap: 8,
        transform: isMe ? "rotate(-0.8deg)" : "rotate(0.8deg)",
        ...(isMe ? {} : { justifyContent: "flex-end" as const }),
        boxShadow: isArmed ? `3px 3px 0 rgba(255,80,0,0.4)` : `3px 3px 0 ${isMe ? EA.cyan : EA.pink}`,
        transition: "all 0.3s",
      }}>
        {isMe ? <>{avatarEl}{nameEl}</> : <>{nameEl}{avatarEl}</>}
      </div>
    </div>
  );
}

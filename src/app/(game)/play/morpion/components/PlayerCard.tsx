import { EA } from "@/lib/design";
import { Avatar } from "@/components/ui/avatar";

interface Props {
  pseudo: string;
  avatarUrl: string | null;
  mark: string;
  isMe: boolean;
  isActive: boolean;
  isWinner: boolean;
  isFinished: boolean;
  align: "left" | "right";
  avatarColor?: string | null;
}

/** Carte joueur (layout desktop). */
export function PlayerCard({ pseudo, avatarUrl, mark, isMe, isActive, isWinner, isFinished, align, avatarColor }: Props) {
  const bgColor = isMe ? EA.pink : EA.cyan;
  const shadowColor = isMe ? EA.cyan : EA.pink;
  const textColor = isMe ? EA.white : EA.ink;
  const avatarBg = isMe ? EA.butter : EA.pink;
  const rotation = isMe ? "rotate(-1deg)" : "rotate(1.5deg)";
  const tagText = isActive ? (isMe ? "TON TOUR" : "SON TOUR") : isWinner ? "🏆 GAGNE" : null;
  const tagRotate = isMe ? "rotate(-8deg)" : "rotate(8deg)";
  const tagSide = isMe
    ? { left: align === "left" ? -10 : "auto", right: align === "right" ? -10 : "auto" }
    : { right: align === "right" ? -10 : "auto", left: align === "left" ? -10 : "auto" };

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      {tagText && (
        <div style={{ position: "absolute", top: -14, ...tagSide, zIndex: 5, background: EA.butter, border: `2px solid ${EA.ink}`, padding: "3px 12px", borderRadius: 999, fontFamily: "var(--font-display)", fontSize: 13, color: EA.ink, letterSpacing: 0.6, transform: tagRotate, boxShadow: `2px 2px 0 ${EA.ink}`, whiteSpace: "nowrap" }}>
          {tagText}
        </div>
      )}
      <div style={{ background: bgColor, border: `2.5px solid ${EA.ink}`, borderRadius: 24, padding: "20px 24px", display: "flex", flexDirection: "column", alignItems: "center", gap: 12, transform: rotation, boxShadow: `4px 4px 0 ${shadowColor}`, opacity: !isActive && !isFinished ? 0.6 : 1, transition: "opacity 0.3s", minWidth: 160 }}>
        <Avatar name={pseudo} color={avatarColor ?? avatarBg} ring={EA.ink} size={72} src={avatarUrl} />
        <div style={{ fontFamily: "var(--font-display)", fontSize: 20, color: textColor, transform: "skewX(-4deg)", lineHeight: 1, textAlign: "center" }}>{pseudo.toUpperCase()}</div>
        <div style={{ fontFamily: "var(--font-sans)", fontSize: 40, fontWeight: 900, color: textColor, lineHeight: 1 }}>{mark}</div>
      </div>
    </div>
  );
}

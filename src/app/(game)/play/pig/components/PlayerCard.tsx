import { EA } from "@/lib/design";
import { Avatar } from "@/components/ui/avatar";
import { PIG_WIN_SCORE } from "@/lib/games/pig";

export function PlayerCard({ score, pseudo, avatarUrl, color, isActive, isMe, side, avatarColor }: {
  score: number; pseudo: string; avatarUrl: string | null;
  color: string; isActive: boolean; isMe: boolean; side: "left" | "right";
  avatarColor?: string | null;
}) {
  const pct = Math.min(100, (score / PIG_WIN_SCORE) * 100);
  return (
    <div style={{
      flex: 1, minWidth: 0,
      background: isActive ? `${color}1f` : EA.violetDeep,
      border: `2.5px solid ${isActive ? color : EA.ink}`,
      borderRadius: 18, padding: "12px 14px",
      boxShadow: isActive ? `3px 3px 0 ${color}` : `2px 2px 0 ${EA.ink}`,
      transition: "all 0.3s",
      display: "flex", flexDirection: "column", gap: 8,
    }}>
      <div style={{
        display: "flex",
        flexDirection: side === "right" ? "row-reverse" : "row",
        alignItems: "center", gap: 10,
      }}>
        <Avatar name={pseudo} src={avatarUrl} color={avatarColor ?? color} ring={isActive ? color : "transparent"} size={38} />
        <div style={{ flex: 1, minWidth: 0, textAlign: side }}>
          <div style={{
            fontFamily: "var(--font-display)", fontSize: 12, color: EA.white,
            transform: "skewX(-4deg)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {pseudo.toUpperCase()}
            {isMe && <span style={{ fontSize: 9, fontWeight: 900, color, marginLeft: 5 }}>TOI</span>}
          </div>
          <div style={{
            fontFamily: "var(--font-display)", fontSize: 32,
            color: EA.white, transform: "skewX(-6deg)",
            textShadow: `2px 2px 0 ${color}`, lineHeight: 1,
            marginTop: 2,
          }}>{score}</div>
        </div>
      </div>
      <div style={{
        height: 8, borderRadius: 999,
        background: "rgba(0,0,0,0.35)",
        border: `1.5px solid rgba(255,255,255,0.08)`,
        overflow: "hidden", position: "relative",
      }}>
        <div style={{
          height: "100%", width: `${pct}%`,
          background: `linear-gradient(90deg, ${color}, ${color}cc)`,
          borderRadius: 999,
          transition: "width 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
          boxShadow: `0 0 10px ${color}`,
        }} />
      </div>
      <div style={{
        fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.35)",
        textAlign: side, textTransform: "uppercase", letterSpacing: 1,
      }}>
        {PIG_WIN_SCORE - score > 0 ? `${PIG_WIN_SCORE - score} pts à atteindre` : "🏆 GAGNÉ"}
      </div>
    </div>
  );
}

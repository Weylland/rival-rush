import { Avatar } from "@/components/ui/avatar";

export function PlayerBadge({ pseudo, avatar, guessCount, cracked, color, active, align }: {
  pseudo: string; avatar: string | null;
  guessCount: number; cracked: boolean; color: string;
  active: boolean; align: "left" | "right";
}) {
  return (
    <div style={{
      display: "flex",
      flexDirection: align === "right" ? "row-reverse" : "row",
      alignItems: "center", gap: 8,
    }}>
      <div style={{
        padding: 2, borderRadius: "50%", flexShrink: 0,
        border: `2.5px solid ${active ? color : "transparent"}`,
        boxShadow: active ? `0 0 12px ${color}` : "none",
        transition: "border 0.3s, box-shadow 0.3s",
      }}>
        <Avatar name={pseudo} src={avatar} color={color} ring="transparent" size={36} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0, textAlign: align }}>
        <div style={{
          fontFamily: "var(--font-display)", fontSize: 11,
          color: active ? color : "rgba(255,255,255,0.5)",
          transform: "skewX(-4deg)",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          transition: "color 0.3s",
        }}>{pseudo.toUpperCase()}</div>
        <div style={{ fontSize: 9, fontWeight: 900, color: cracked ? color : "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: 0.8 }}>
          {cracked ? "🏁 craqué" : `${guessCount} essai${guessCount !== 1 ? "s" : ""}`}
        </div>
      </div>
    </div>
  );
}

export const COLORS = [
  { bg: "#FF2D78", glow: "rgba(255,45,120,0.6)",  label: "Rubis",     symbol: "♦" },
  { bg: "#00D4E8", glow: "rgba(0,212,232,0.6)",   label: "Saphir",    symbol: "★" },
  { bg: "#FFE94A", glow: "rgba(255,233,74,0.6)",  label: "Or",        symbol: "▲" },
  { bg: "#4ADE80", glow: "rgba(74,222,128,0.6)",  label: "Émeraude",  symbol: "●" },
  { bg: "#C084FC", glow: "rgba(192,132,252,0.6)", label: "Améthyste", symbol: "■" },
  { bg: "#FB923C", glow: "rgba(251,146,60,0.6)",  label: "Ambre",     symbol: "✕" },
];

export function Gem({ color, size = 42, glow = false, onClick }: {
  color: number | null;
  size?: number;
  glow?: boolean;
  onClick?: () => void;
}) {
  const c = color !== null ? COLORS[color] : null;
  const symbolSize = Math.round(size * 0.42);
  return (
    <div
      onClick={onClick}
      style={{
        width: size, height: size, borderRadius: "50%", flexShrink: 0,
        cursor: onClick ? "pointer" : "default",
        background: c
          ? `radial-gradient(circle at 35% 35%, ${c.bg}ff, ${c.bg}88)`
          : "rgba(255,255,255,0.08)",
        border: c
          ? `2.5px solid rgba(255,255,255,0.45)`
          : `2.5px dashed rgba(255,255,255,0.2)`,
        boxShadow: c && glow
          ? `0 0 16px 4px ${c.glow}, inset 0 1px 3px rgba(255,255,255,0.5)`
          : c
            ? `0 3px 8px rgba(0,0,0,0.5), inset 0 1px 2px rgba(255,255,255,0.35)`
            : "none",
        transition: "transform 0.1s, box-shadow 0.15s",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      {c && (
        <span style={{
          fontSize: symbolSize,
          color: "rgba(0,0,0,0.45)",
          lineHeight: 1,
          userSelect: "none",
          pointerEvents: "none",
        }}>{c.symbol}</span>
      )}
    </div>
  );
}

/** Pegs 2×2 : noir = bonne couleur bien placée, blanc = bonne couleur mal placée. */
export function Pegs({ blacks, whites }: { blacks: number; whites: number }) {
  const list = [
    ...Array(blacks).fill("black"),
    ...Array(whites).fill("white"),
    ...Array(4 - blacks - whites).fill("empty"),
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5 }}>
      {list.map((p, i) => (
        <div key={i} style={{
          width: 14, height: 14, borderRadius: "50%",
          background:
            p === "black" ? "#0d0d1a" :
            p === "white" ? "#e8e8f8" :
            "rgba(255,255,255,0.1)",
          border:
            p === "black" ? "2px solid rgba(255,255,255,0.35)" :
            p === "white" ? "2px solid rgba(0,0,0,0.35)" :
            "1.5px solid rgba(255,255,255,0.15)",
          boxShadow: p === "white" ? "0 0 6px rgba(255,255,255,0.5)" : "none",
        }} />
      ))}
    </div>
  );
}

export function EmptyPegs() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5 }}>
      {[0, 1, 2, 3].map(i => (
        <div key={i} style={{
          width: 14, height: 14, borderRadius: "50%",
          background: "rgba(255,255,255,0.06)",
          border: "1.5px solid rgba(255,255,255,0.12)",
        }} />
      ))}
    </div>
  );
}

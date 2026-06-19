import { EA } from "@/lib/design";

const DOT_CELLS: Record<number, number[]> = {
  1: [4],
  2: [2, 6],
  3: [2, 4, 6],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 3, 6, 2, 5, 8],
};

export function DieFace({ value, size, bg, dotColor, glowColor, shaking = false }: {
  value: number | null;
  size: number;
  bg: string;
  dotColor: string;
  glowColor?: string;
  shaking?: boolean;
}) {
  const dots = value !== null ? (DOT_CELLS[value] ?? []) : [];
  const dotSize = Math.round(size * 0.17);
  const radius = Math.round(size * 0.16);

  return (
    <div style={{
      width: size, height: size,
      background: bg,
      border: `3.5px solid ${EA.ink}`,
      borderRadius: radius,
      boxShadow: glowColor
        ? `5px 5px 0 ${EA.ink}, 0 0 18px ${glowColor}99, 0 0 40px ${glowColor}44`
        : `5px 5px 0 ${EA.ink}`,
      display: "grid",
      gridTemplateColumns: "repeat(3, 1fr)",
      gridTemplateRows: "repeat(3, 1fr)",
      padding: `${Math.round(size * 0.1)}px`,
      animation: shaking ? "die-shake 0.45s cubic-bezier(0.36,0.07,0.19,0.97)" : undefined,
      willChange: "transform",
    }}>
      {value === null ? (
        <div style={{
          gridColumn: "1 / -1", gridRow: "1 / -1",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: "var(--font-display)", fontSize: Math.round(size * 0.44),
          color: dotColor, opacity: 0.45,
        }}>?</div>
      ) : (
        Array.from({ length: 9 }, (_, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
            {dots.includes(i) && (
              <div style={{
                width: dotSize, height: dotSize,
                borderRadius: "50%",
                background: dotColor,
                boxShadow: `0 0 5px 1px ${dotColor}66`,
              }} />
            )}
          </div>
        ))
      )}
    </div>
  );
}

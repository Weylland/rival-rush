import { EA } from "@/lib/design";

const DOT_POSITIONS: Record<number, [number, number][]> = {
  1: [[1, 1]],
  2: [[0, 0], [2, 2]],
  3: [[0, 0], [1, 1], [2, 2]],
  4: [[0, 0], [2, 0], [0, 2], [2, 2]],
  5: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]],
  6: [[0, 0], [2, 0], [0, 1], [2, 1], [0, 2], [2, 2]],
};

export function DieFace({ value, size = 140, bust = false, rolling = false }: {
  value: number | null; size?: number; bust?: boolean; rolling?: boolean;
}) {
  const dots = value ? DOT_POSITIONS[value] ?? [] : [];
  const dotSize = size * 0.14;
  const padding = size * 0.14;
  const inner = size - padding * 2;
  const cell = inner / 3;

  return (
    <div style={{
      width: size, height: size,
      background: bust
        ? `linear-gradient(145deg, #ff5599 0%, ${EA.pink} 100%)`
        : `linear-gradient(145deg, #ffffff 0%, #e8e8f0 100%)`,
      border: `4px solid ${EA.ink}`,
      borderRadius: size * 0.18,
      boxShadow: bust
        ? `0 0 40px rgba(255,45,140,0.7), 6px 6px 0 ${EA.ink}, inset 0 -10px 18px rgba(0,0,0,0.18)`
        : `6px 6px 0 ${EA.cyan}, 6px 6px 0 1px ${EA.ink}, inset 0 -10px 18px rgba(0,0,0,0.1), 0 0 30px rgba(0,212,232,0.3)`,
      position: "relative", flexShrink: 0,
      transition: "background 0.2s, box-shadow 0.2s",
      animation: rolling ? "pig-roll 0.55s cubic-bezier(0.4, 0, 0.2, 1)" : "none",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      {value === null ? (
        <div style={{ fontSize: size * 0.45, lineHeight: 1, opacity: 0.3 }}>🎲</div>
      ) : (
        <div style={{ position: "relative", width: inner, height: inner }}>
          {dots.map(([col, row], i) => (
            <div key={i} style={{
              position: "absolute",
              left: col * cell + cell / 2 - dotSize / 2,
              top: row * cell + cell / 2 - dotSize / 2,
              width: dotSize, height: dotSize,
              borderRadius: "50%",
              background: bust ? EA.white : EA.ink,
              boxShadow: bust ? "none" : `inset 0 1px 2px rgba(255,255,255,0.4), 0 1px 2px rgba(0,0,0,0.25)`,
            }} />
          ))}
        </div>
      )}
    </div>
  );
}

import { RR } from "@/lib/design";

/** Couleur de la pile selon le danger (peu d'allumettes = rouge). */
export function getPileColor(pile: number) {
  if (pile <= 1) return RR.pink;
  if (pile <= 3) return "#ff6b35";
  if (pile <= 6) return RR.butter;
  return RR.cyan;
}

function Allumette({ highlight, danger, size = 1 }: { highlight: boolean; danger: boolean; size?: number }) {
  const headSize = Math.round(12 * size);
  const stickW = Math.round(7 * size);
  const stickH = Math.round(48 * size);

  const headColor = danger ? RR.pink : highlight ? "#ff6b35" : "#e85d04";
  const stickTop = danger
    ? `linear-gradient(180deg, ${RR.pink} 0%, #c8a063 50%)`
    : highlight
      ? `linear-gradient(180deg, #ff6b35 0%, #c8a063 50%)`
      : `linear-gradient(180deg, #d4874a 0%, #8b5e3c 100%)`;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0 }}>
      {/* Tête enflammée */}
      <div style={{
        width: headSize, height: headSize, borderRadius: "50%",
        background: headColor,
        border: `2px solid ${RR.ink}`,
        boxShadow: danger
          ? `0 0 10px ${RR.pink}, 0 0 20px rgba(255,30,140,0.6)`
          : highlight
            ? `0 0 8px #ff6b35`
            : "none",
        flexShrink: 0,
        transition: "background 0.2s, box-shadow 0.2s",
      }} />
      {/* Bâton */}
      <div style={{
        width: stickW, height: stickH,
        background: stickTop,
        border: `1.5px solid ${RR.ink}`,
        borderTop: "none",
        borderRadius: "0 0 3px 3px",
        transition: "background 0.2s",
      }} />
    </div>
  );
}

export function AllumettesGrid({ pile, hoverCount, myTurn, danger }: {
  pile: number;
  hoverCount: number | null;
  myTurn: boolean;
  danger: boolean;
}) {
  const perRow = pile > 12 ? 7 : pile > 6 ? 5 : pile;
  const rows: number[][] = [];
  for (let i = 0; i < pile; i += perRow) {
    rows.push(Array.from({ length: Math.min(perRow, pile - i) }, (_, j) => i + j));
  }
  const highlightFrom = hoverCount !== null && myTurn ? pile - hoverCount : -1;
  const size = pile > 15 ? 0.7 : pile > 8 ? 0.85 : 1;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
      {rows.map((row, ri) => (
        <div key={ri} style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
          {row.map((idx) => (
            <Allumette
              key={idx}
              highlight={idx >= highlightFrom}
              danger={danger && idx >= highlightFrom}
              size={size}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

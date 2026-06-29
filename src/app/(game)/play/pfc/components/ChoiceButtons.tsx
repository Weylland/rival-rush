import { RR } from "@/lib/design";
import { MOVES, type PFCMove } from "./moves";

interface Props {
  phase: "picking" | "waiting" | "revealing";
  myMove: PFCMove | null;
  submitting: boolean;
  onPick: (id: PFCMove) => void;
  vertical?: boolean;
}

export function ChoiceButtons({ phase, myMove, submitting, onPick, vertical = false }: Props) {
  return (
    <div style={{ display: "flex", flexDirection: vertical ? "column" : "row", gap: vertical ? 12 : 10 }}>
      {MOVES.map(({ id, emoji, label, color, shadow }) => {
        const picked = phase === "waiting" && myMove === id;
        return (
          <button
            key={id}
            onClick={() => onPick(id)}
            disabled={phase === "waiting" || submitting}
            style={{
              flex: vertical ? "unset" : 1,
              background: picked ? color : RR.white,
              border: `2.5px solid ${RR.ink}`,
              borderRadius: 24,
              padding: vertical ? "20px 36px" : "18px 6px 16px",
              display: "flex",
              flexDirection: vertical ? "row" : "column",
              alignItems: "center",
              gap: vertical ? 14 : 6,
              boxShadow: picked ? `5px 5px 0 ${shadow}, 5px 5px 0 1px ${RR.ink}` : `4px 4px 0 ${RR.violetDeep}`,
              transform: picked ? (vertical ? "translateX(4px)" : "translateY(-5px) rotate(-2deg)") : "skewX(-3deg)",
              cursor: phase === "picking" ? "pointer" : "default",
              position: "relative",
              transition: "transform 0.15s, box-shadow 0.15s",
            }}
          >
            {picked && (
              <div style={{
                position: "absolute",
                top: vertical ? "50%" : -12,
                left: vertical ? -10 : "50%",
                transform: vertical ? "translateY(-50%) rotate(-6deg)" : "translateX(-50%) skewX(3deg) rotate(-6deg)",
                background: RR.butter, border: `2px solid ${RR.ink}`,
                padding: "2px 8px", borderRadius: 999,
                fontFamily: "var(--font-display)", fontSize: 9, color: RR.ink,
                letterSpacing: 0.6, boxShadow: `2px 2px 0 ${RR.ink}`, whiteSpace: "nowrap",
              }}>TON CHOIX</div>
            )}
            <div style={{ fontSize: vertical ? 52 : 46, lineHeight: 1, transform: "skewX(3deg)" }}>{emoji}</div>
            <div style={{
              fontFamily: "var(--font-display)", fontSize: vertical ? 22 : 13, color: RR.ink,
              textTransform: "uppercase", letterSpacing: 0.8,
            }}>{label}</div>
          </button>
        );
      })}
    </div>
  );
}

export function MyChoiceLocked({ myMove }: { myMove: PFCMove | null }) {
  const move = MOVES.find(m => m.id === myMove);
  if (!move) return null;
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
      background: move.color, border: `3px solid ${RR.ink}`, borderRadius: 24,
      padding: "20px 0", width: "100%",
      boxShadow: `5px 5px 0 ${move.shadow}, 5px 5px 0 1px ${RR.ink}`,
      transform: "skewX(-3deg)",
      position: "relative",
    }}>
      <div style={{
        position: "absolute", top: -13, left: "50%",
        transform: "translateX(-50%) skewX(3deg) rotate(-4deg)",
        background: RR.butter, border: `2px solid ${RR.ink}`,
        padding: "3px 12px", borderRadius: 999,
        fontFamily: "var(--font-display)", fontSize: 10, color: RR.ink,
        letterSpacing: 0.6, boxShadow: `2px 2px 0 ${RR.ink}`, whiteSpace: "nowrap",
      }}>🔒 CHOIX VERROUILLÉ</div>
      <div style={{ fontSize: 60, lineHeight: 1, transform: "skewX(3deg)" }}>{move.emoji}</div>
      <div style={{ fontFamily: "var(--font-display)", fontSize: 22, color: RR.ink, letterSpacing: 0.8, transform: "skewX(3deg) skewX(-4deg)" }}>
        {move.label.toUpperCase()}
      </div>
    </div>
  );
}

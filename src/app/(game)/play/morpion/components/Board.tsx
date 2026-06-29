import { RR } from "@/lib/design";
import { CellMark, CellX, CellO } from "./marks";

interface Props {
  board: (string | null)[];
  winLine: readonly number[] | null;
  p1Id: string;
  iAmP1: boolean;
  isMyTurn: boolean;
  isFinished: boolean;
  submitting: boolean;
  onCellClick: (idx: number) => void;
}

/** Plateau 3×3 fluide (remplit son conteneur, cases carrées via aspect-ratio). */
export function Board({ board, winLine, p1Id, iAmP1, isMyTurn, isFinished, submitting, onCellClick }: Props) {
  return (
    <div style={{
      background: RR.violetDeep, border: `3px solid ${RR.ink}`,
      borderRadius: 26, padding: 14,
      display: "grid", gridTemplateColumns: "repeat(3, 1fr)",
      gap: 10,
      boxShadow: `5px 5px 0 ${RR.pink}, 5px 5px 0 1px ${RR.ink}`,
      position: "relative",
      width: "100%",
    }}>
      <div aria-hidden style={{ position: "absolute", inset: 6, borderRadius: 22, backgroundImage: `radial-gradient(circle, rgba(0,212,232,0.25) 0.9px, transparent 1.3px) 0 0 / 10px 10px`, pointerEvents: "none" }} />
      {board.map((cell, idx) => {
        const isWinCell = winLine?.includes(idx) ?? false;
        const isEmpty = cell === null;
        const canClick = isEmpty && isMyTurn && !isFinished && !submitting;
        const accentColor = idx % 2 === 0 ? RR.cyan : RR.pink;
        return (
          <button
            key={idx}
            onClick={() => onCellClick(idx)}
            disabled={!canClick}
            style={{
              aspectRatio: "1 / 1",
              width: "100%",
              background: isWinCell ? RR.butter : RR.white,
              border: `2.5px solid ${RR.ink}`,
              borderRadius: 18,
              display: "flex", alignItems: "center", justifyContent: "center",
              position: "relative",
              boxShadow: `3px 3px 0 ${isWinCell ? RR.pink : accentColor}`,
              cursor: canClick ? "pointer" : "default",
              transition: "transform 0.1s",
            }}
            onMouseEnter={e => { if (canClick) e.currentTarget.style.transform = "scale(1.06)"; }}
            onMouseLeave={e => { e.currentTarget.style.transform = ""; }}
          >
            <CellMark cellValue={cell} p1Id={p1Id} />
            {isEmpty && canClick && (
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", opacity: 0, transition: "opacity 0.15s" }}
                onMouseEnter={e => { e.currentTarget.style.opacity = "0.3"; }}
                onMouseLeave={e => { e.currentTarget.style.opacity = "0"; }}
              >
                {iAmP1 ? <CellX /> : <CellO />}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

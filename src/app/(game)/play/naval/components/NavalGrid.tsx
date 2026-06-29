import { RR } from "@/lib/design";
import { FLEET_DEFS } from "@/lib/battleship";
import type { NavalShip } from "@/types/database";
import type { CellKind } from "./grid";

export function NavalGrid({ cells, cellSize, interactive, shotCells, onShoot, accentColor }: {
  cells: CellKind[];
  cellSize: number;
  interactive: boolean;
  shotCells: Set<number>;
  onShoot?: (i: number) => void;
  accentColor: string;
}) {
  const gap = 2;
  const gridPx = cellSize * 10 + gap * 9;

  return (
    <div style={{
      background: RR.violetDeep,
      border: `3px solid ${RR.ink}`,
      borderRadius: 16,
      padding: 6,
      boxShadow: `5px 5px 0 ${accentColor}, 5px 5px 0 1px ${RR.ink}`,
      display: "inline-block",
      position: "relative",
    }}>
      {/* dot overlay */}
      <div aria-hidden style={{
        position: "absolute", inset: 6, borderRadius: 12, pointerEvents: "none",
        backgroundImage: "radial-gradient(circle, rgba(0,212,232,0.12) 0.8px, transparent 1.1px)",
        backgroundSize: "10px 10px",
      }} />

      <div style={{
        display: "grid",
        gridTemplateColumns: `repeat(10, ${cellSize}px)`,
        gridTemplateRows: `repeat(10, ${cellSize}px)`,
        gap,
        width: gridPx,
        height: gridPx,
        position: "relative", zIndex: 2,
      }}>
        {cells.map((kind, i) => {
          const canShoot = interactive && !shotCells.has(i) && kind === "water";
          return (
            <div
              key={i}
              onClick={() => canShoot && onShoot?.(i)}
              title={interactive && !shotCells.has(i) ? `Tirer ici` : undefined}
              style={{
                borderRadius: cellSize <= 24 ? 2 : 4,
                background:
                  kind === "water" ? "rgba(0,80,200,0.18)" :
                  kind === "ship"  ? `rgba(0,212,232,0.45)` :
                  kind === "hit"   ? RR.pink :
                  kind === "sunk"  ? "#c0132a" :
                  /* miss */         "rgba(255,255,255,0.08)",
                border: `1.5px solid ${
                  kind === "ship" ? "rgba(0,212,232,0.7)" :
                  kind === "hit" || kind === "sunk" ? RR.ink :
                  "rgba(255,255,255,0.06)"
                }`,
                cursor: canShoot ? "crosshair" : "default",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "background 0.1s, transform 0.05s",
                transform: canShoot ? undefined : "none",
                boxShadow:
                  kind === "hit" ? `inset 0 -2px 4px rgba(0,0,0,0.4)` :
                  kind === "sunk" ? `inset 0 -2px 4px rgba(0,0,0,0.5)` :
                  kind === "ship" ? `inset 0 1px 3px rgba(0,212,232,0.3)` : "none",
              }}
            >
              {kind === "miss" && (
                <div style={{ width: "38%", height: "38%", borderRadius: "50%", background: "rgba(255,255,255,0.35)" }} />
              )}
              {(kind === "hit" || kind === "sunk") && (
                <span style={{ fontSize: cellSize * 0.52, lineHeight: 1, color: RR.white, fontWeight: 900 }}>✕</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function FleetTracker({ ships, shotCells, accent }: { ships: NavalShip[]; shotCells: Set<number>; accent: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      {FLEET_DEFS.map(def => {
        const ship = ships.find(s => s.id === def.id);
        const sunk = ship ? ship.cells.every(c => shotCells.has(c)) : false;
        return (
          <div key={def.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ display: "flex", gap: 2 }}>
              {Array.from({ length: def.size }).map((_, i) => (
                <div key={i} style={{
                  width: 10, height: 10, borderRadius: 2,
                  background: sunk ? "rgba(255,255,255,0.1)" : accent,
                  border: `1.5px solid ${sunk ? "rgba(255,255,255,0.1)" : RR.ink}`,
                  boxShadow: sunk ? "none" : `1px 1px 0 ${RR.ink}`,
                  opacity: sunk ? 0.3 : 1,
                }} />
              ))}
            </div>
            <span style={{
              fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 800,
              color: sunk ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.65)",
              textDecoration: sunk ? "line-through" : "none",
            }}>{def.name}</span>
            {sunk && <span style={{ fontSize: 11 }}>💥</span>}
          </div>
        );
      })}
    </div>
  );
}

export function TurnPill({ isMyTurn, isFinished, iWon, isDraw, opPseudo, shotFeedback }: {
  isMyTurn: boolean; isFinished: boolean; iWon: boolean; isDraw: boolean; opPseudo: string; shotFeedback: string | null;
}) {
  if (isFinished) {
    return (
      <div style={{
        background: isDraw ? "rgba(255,233,74,0.15)" : iWon ? "rgba(0,212,232,0.15)" : "rgba(255,30,140,0.15)",
        border: `2px solid ${isDraw ? RR.butter : iWon ? RR.cyan : RR.pink}`,
        borderRadius: 999, padding: "8px 20px",
        display: "inline-flex", alignItems: "center", gap: 8,
        boxShadow: `3px 3px 0 ${isDraw ? RR.butter : iWon ? RR.cyan : RR.pink}`,
      }}>
        <span style={{ fontFamily: "var(--font-display)", fontSize: 22, color: isDraw ? RR.butter : iWon ? RR.cyan : RR.pink, transform: "skewX(-6deg)" }}>
          {isDraw ? "🤝 MATCH NUL !" : iWon ? "🏆 VICTOIRE !" : "💀 DÉFAITE !"}
        </span>
      </div>
    );
  }
  return (
    <div style={{
      background: "rgba(26,15,94,0.7)", border: `2px solid ${RR.ink}`,
      borderRadius: 999, padding: "8px 18px",
      display: "inline-flex", alignItems: "center", gap: 10,
      boxShadow: `3px 3px 0 ${RR.cyan}`,
    }}>
      <span style={{
        width: 8, height: 8, borderRadius: "50%",
        background: isMyTurn ? RR.butter : RR.cyan,
        boxShadow: `0 0 10px ${isMyTurn ? RR.butter : RR.cyan}`,
        animation: "rr-pulse 1.2s ease-in-out infinite",
        flexShrink: 0,
      }} />
      <span style={{ fontFamily: "var(--font-sans)", fontStyle: "italic", fontSize: 14, fontWeight: 800, color: RR.white }}>
        {shotFeedback ?? (isMyTurn ? "À toi de jouer — vise bien !" : `${opPseudo} vise…`)}
      </span>
    </div>
  );
}

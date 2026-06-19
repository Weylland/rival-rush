"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { submitNavalShot, submitNavalPlacement } from "./actions";
import { useOpponentWatcher } from "@/hooks/useOpponentWatcher";
import { useGameSounds } from "@/hooks/useGameSounds";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { useWindowWidth } from "@/hooks/useWindowWidth";
import { RulesButton } from "@/components/ui/rules-button";
import { Avatar } from "@/components/ui/avatar";
import { SvgBlob } from "@/components/ui/blob";
import { Star } from "@/components/ui/star";
import { EA } from "@/lib/design";
import { useGameOpponent } from "@/app/(game)/chat/ChatSystem";
import { PreventLeave } from "@/components/PreventLeave";
import { FLEET_DEFS, generateFleet } from "@/lib/battleship";
import type { NavalState, NavalShip, GameStatus } from "@/types/database";

// ── Cell computation ───────────────────────────────────────────────────────────

type CellKind = "water" | "ship" | "hit" | "miss" | "sunk";

function computeMyGrid(myShips: NavalShip[], opShots: { cell: number; result: string }[]): CellKind[] {
  const grid: CellKind[] = Array(100).fill("water");
  for (const ship of myShips) {
    for (const c of ship.cells) grid[c] = "ship";
  }
  for (const s of opShots) {
    grid[s.cell] = s.result === "miss" ? "miss" : "hit";
  }
  return grid;
}

function computeAttackGrid(myShots: { cell: number; result: string }[], opponentSunkShips: NavalShip[]): CellKind[] {
  const grid: CellKind[] = Array(100).fill("water");
  const sunkCells = new Set<number>();
  // Only use ships that have been fully sunk (publicly revealed)
  for (const ship of opponentSunkShips) {
    ship.cells.forEach(c => sunkCells.add(c));
  }
  for (const s of myShots) {
    grid[s.cell] = sunkCells.has(s.cell) ? "sunk" : s.result === "miss" ? "miss" : "hit";
  }
  return grid;
}

// ── Grid component ─────────────────────────────────────────────────────────────

function NavalGrid({
  cells,
  cellSize,
  interactive,
  shotCells,
  onShoot,
  accentColor,
}: {
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
      background: EA.violetDeep,
      border: `3px solid ${EA.ink}`,
      borderRadius: 16,
      padding: 6,
      boxShadow: `5px 5px 0 ${accentColor}, 5px 5px 0 1px ${EA.ink}`,
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
                  kind === "hit"   ? EA.pink :
                  kind === "sunk"  ? "#c0132a" :
                  /* miss */         "rgba(255,255,255,0.08)",
                border: `1.5px solid ${
                  kind === "ship" ? "rgba(0,212,232,0.7)" :
                  kind === "hit" || kind === "sunk" ? EA.ink :
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
                <span style={{ fontSize: cellSize * 0.52, lineHeight: 1, color: EA.white, fontWeight: 900 }}>✕</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Fleet tracker ──────────────────────────────────────────────────────────────

function FleetTracker({ ships, shotCells, accent }: { ships: NavalShip[]; shotCells: Set<number>; accent: string }) {
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
                  border: `1.5px solid ${sunk ? "rgba(255,255,255,0.1)" : EA.ink}`,
                  boxShadow: sunk ? "none" : `1px 1px 0 ${EA.ink}`,
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

// ── Turn pill ──────────────────────────────────────────────────────────────────

function TurnPill({ isMyTurn, isFinished, iWon, isDraw, opPseudo, shotFeedback }: {
  isMyTurn: boolean; isFinished: boolean; iWon: boolean; isDraw: boolean; opPseudo: string; shotFeedback: string | null;
}) {
  if (isFinished) {
    return (
      <div style={{
        background: isDraw ? "rgba(255,233,74,0.15)" : iWon ? "rgba(0,212,232,0.15)" : "rgba(255,30,140,0.15)",
        border: `2px solid ${isDraw ? EA.butter : iWon ? EA.cyan : EA.pink}`,
        borderRadius: 999, padding: "8px 20px",
        display: "inline-flex", alignItems: "center", gap: 8,
        boxShadow: `3px 3px 0 ${isDraw ? EA.butter : iWon ? EA.cyan : EA.pink}`,
      }}>
        <span style={{ fontFamily: "var(--font-display)", fontSize: 22, color: isDraw ? EA.butter : iWon ? EA.cyan : EA.pink, transform: "skewX(-6deg)" }}>
          {isDraw ? "🤝 MATCH NUL !" : iWon ? "🏆 VICTOIRE !" : "💀 DÉFAITE !"}
        </span>
      </div>
    );
  }
  return (
    <div style={{
      background: "rgba(26,15,94,0.7)", border: `2px solid ${EA.ink}`,
      borderRadius: 999, padding: "8px 18px",
      display: "inline-flex", alignItems: "center", gap: 10,
      boxShadow: `3px 3px 0 ${EA.cyan}`,
    }}>
      <span style={{
        width: 8, height: 8, borderRadius: "50%",
        background: isMyTurn ? EA.butter : EA.cyan,
        boxShadow: `0 0 10px ${isMyTurn ? EA.butter : EA.cyan}`,
        animation: "ea-pulse 1.2s ease-in-out infinite",
        flexShrink: 0,
      }} />
      <span style={{ fontFamily: "var(--font-sans)", fontStyle: "italic", fontSize: 14, fontWeight: 800, color: EA.white }}>
        {shotFeedback ?? (isMyTurn ? "À toi de jouer — vise bien !" : `${opPseudo} vise...`)}
      </span>
    </div>
  );
}

// ── Placement Screen ───────────────────────────────────────────────────────────

interface PlacementProps {
  gameId: string;
  myId: string;
  p1Id: string;
  myPseudo: string;
  opPseudo: string;
  onPlaced: (ships: NavalShip[]) => void;
}

function getPreviewCells(anchorCell: number, defId: number, horiz: boolean): number[] {
  const def = FLEET_DEFS.find(d => d.id === defId);
  if (!def) return [];
  const row = Math.floor(anchorCell / 10);
  const col = anchorCell % 10;
  const cells: number[] = [];
  for (let i = 0; i < def.size; i++) {
    const r = horiz ? row : row + i;
    const c = horiz ? col + i : col;
    if (r >= 10 || c >= 10) return [];
    cells.push(r * 10 + c);
  }
  return cells;
}

function PlacementScreen({ gameId, myId, p1Id, myPseudo, opPseudo, onPlaced }: PlacementProps) {
  const desktop = useIsDesktop();
  const winWidth = useWindowWidth();
  const [placedShips, setPlacedShips] = useState<NavalShip[]>([]);
  const [selectedShipId, setSelectedShipId] = useState<number | null>(0);
  const [horizontal, setHorizontal] = useState(true);
  const [hoverCell, setHoverCell] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [countdown, setCountdown] = useState(90);
  const submittedRef = useRef(false);

  // Auto-submit on countdown = 0
  useEffect(() => {
    if (countdown <= 0 && !submittedRef.current) {
      const fleet = generateFleet();
      setPlacedShips(fleet);
      submittedRef.current = true;
      submitNavalPlacement(gameId, fleet).then(() => onPlaced(fleet));
    }
  }, [countdown, gameId, onPlaced]);

  useEffect(() => {
    const id = setInterval(() => setCountdown(c => Math.max(0, c - 1)), 1000);
    return () => clearInterval(id);
  }, []);

  function hasConflict(cells: number[]): boolean {
    const existing = placedShips.flatMap(s => s.cells);
    return cells.some(c => existing.includes(c));
  }

  function handleCellClick(cell: number) {
    if (selectedShipId === null) return;
    const def = FLEET_DEFS.find(d => d.id === selectedShipId);
    if (!def) return;
    const preview = getPreviewCells(cell, selectedShipId, horizontal);
    if (preview.length === 0 || hasConflict(preview)) return;

    const newShip: NavalShip = { id: def.id, name: def.name, size: def.size, cells: preview };
    const newPlaced = [...placedShips.filter(s => s.id !== selectedShipId), newShip];
    setPlacedShips(newPlaced);

    // Auto-select next unplaced ship
    const placedIds = new Set(newPlaced.map(s => s.id));
    const next = FLEET_DEFS.find(d => !placedIds.has(d.id));
    setSelectedShipId(next ? next.id : null);
  }

  function handleUnplace(shipId: number) {
    setPlacedShips(prev => prev.filter(s => s.id !== shipId));
    setSelectedShipId(shipId);
  }

  function handleRandom() {
    const fleet = generateFleet();
    setPlacedShips(fleet);
    setSelectedShipId(null);
  }

  async function handleSubmit() {
    if (placedShips.length < FLEET_DEFS.length || submitting || submittedRef.current) return;
    setSubmitting(true);
    submittedRef.current = true;
    const res = await submitNavalPlacement(gameId, placedShips);
    setSubmitting(false);
    if (res.ok) {
      onPlaced(placedShips);
    } else {
      submittedRef.current = false;
    }
  }

  const previewCells = hoverCell !== null && selectedShipId !== null
    ? getPreviewCells(hoverCell, selectedShipId, horizontal)
    : [];
  const previewConflict = hasConflict(previewCells);

  function getCellState(i: number): "water" | "ship" | "preview-valid" | "preview-invalid" {
    const isShip = placedShips.some(s => s.cells.includes(i));
    if (isShip) return "ship";
    if (previewCells.includes(i)) return previewConflict ? "preview-invalid" : "preview-valid";
    return "water";
  }

  const timerColor = countdown <= 10 ? EA.pink : EA.butter;
  const timerText = `0:${String(countdown).padStart(2, "0")}`;
  const allPlaced = placedShips.length >= FLEET_DEFS.length;

  const placementGrid = (cellSize: number) => {
    const gap = 2;
    const gridPx = cellSize * 10 + gap * 9;
    return (
      <div style={{
        background: EA.violetDeep, border: `3px solid ${EA.ink}`, borderRadius: 16,
        padding: 6, boxShadow: `5px 5px 0 ${EA.cyan}, 5px 5px 0 1px ${EA.ink}`,
        display: "inline-block", position: "relative",
      }}>
        <div aria-hidden style={{
          position: "absolute", inset: 6, borderRadius: 12, pointerEvents: "none",
          backgroundImage: "radial-gradient(circle, rgba(0,212,232,0.12) 0.8px, transparent 1.1px)",
          backgroundSize: "10px 10px",
        }} />
        <div style={{
          display: "grid",
          gridTemplateColumns: `repeat(10, ${cellSize}px)`,
          gridTemplateRows: `repeat(10, ${cellSize}px)`,
          gap, width: gridPx, height: gridPx,
          position: "relative", zIndex: 2,
        }}>
          {Array.from({ length: 100 }, (_, i) => {
            const state = getCellState(i);
            return (
              <div
                key={i}
                onMouseEnter={() => setHoverCell(i)}
                onMouseLeave={() => setHoverCell(null)}
                onClick={() => handleCellClick(i)}
                style={{
                  borderRadius: cellSize <= 24 ? 2 : 4,
                  background:
                    state === "ship" ? "rgba(0,212,232,0.45)" :
                    state === "preview-valid" ? "rgba(0,212,232,0.25)" :
                    state === "preview-invalid" ? "rgba(255,30,140,0.25)" :
                    "rgba(0,80,200,0.18)",
                  border: `1.5px solid ${
                    state === "ship" ? "rgba(0,212,232,0.7)" :
                    state === "preview-valid" ? "rgba(0,212,232,0.6)" :
                    state === "preview-invalid" ? EA.pink :
                    "rgba(255,255,255,0.06)"
                  }`,
                  borderStyle: state === "preview-valid" || state === "preview-invalid" ? "dashed" : "solid",
                  cursor: selectedShipId !== null ? "crosshair" : "default",
                  transition: "background 0.08s",
                  boxShadow: state === "ship" ? `inset 0 1px 3px rgba(0,212,232,0.3)` : "none",
                }}
              />
            );
          })}
        </div>
      </div>
    );
  };

  const shipList = (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {FLEET_DEFS.map(def => {
        const isPlaced = placedShips.some(s => s.id === def.id);
        const isSelected = selectedShipId === def.id;
        return (
          <div
            key={def.id}
            onClick={() => isPlaced ? handleUnplace(def.id) : setSelectedShipId(def.id)}
            style={{
              display: "flex", alignItems: "center", gap: 10,
              background: isSelected ? EA.butter : isPlaced ? "rgba(0,212,232,0.12)" : "rgba(255,255,255,0.05)",
              border: `2px solid ${isSelected ? EA.ink : isPlaced ? "rgba(0,212,232,0.4)" : "rgba(255,255,255,0.1)"}`,
              borderRadius: 10, padding: "8px 12px", cursor: "pointer",
              opacity: isPlaced && !isSelected ? 0.65 : 1,
              boxShadow: isSelected ? `2px 2px 0 ${EA.ink}` : "none",
              transition: "background 0.1s, opacity 0.1s",
            }}
          >
            <div style={{ display: "flex", gap: 2 }}>
              {Array.from({ length: def.size }).map((_, i) => (
                <div key={i} style={{
                  width: 10, height: 10, borderRadius: 2,
                  background: isSelected ? EA.ink : isPlaced ? EA.cyan : "rgba(255,255,255,0.4)",
                  border: `1.5px solid ${isSelected ? EA.ink : isPlaced ? EA.ink : "rgba(255,255,255,0.2)"}`,
                }} />
              ))}
            </div>
            <span style={{
              fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 800,
              color: isSelected ? EA.ink : isPlaced ? EA.cyan : "rgba(255,255,255,0.7)",
              flex: 1,
            }}>{def.name}</span>
            {isPlaced && <span style={{ fontSize: 13 }}>✓</span>}
          </div>
        );
      })}
    </div>
  );

  const timerPill = (
    <div style={{
      background: "rgba(26,15,94,0.7)", border: `2px solid ${timerColor}`,
      borderRadius: 999, padding: "6px 16px",
      display: "inline-flex", alignItems: "center", gap: 8,
      boxShadow: `2px 2px 0 ${timerColor}`,
    }}>
      <span style={{ fontFamily: "var(--font-display)", fontSize: 18, color: timerColor, transform: "skewX(-4deg)" }}>⏱ {timerText}</span>
    </div>
  );

  const rotateBtn = (
    <button
      onClick={() => setHorizontal(h => !h)}
      title={horizontal ? "Passer en vertical" : "Passer en horizontal"}
      style={{
        background: "rgba(26,15,94,0.7)",
        border: `2px solid ${horizontal ? EA.cyan : EA.pink}`,
        borderRadius: 10, padding: "8px 14px",
        cursor: "pointer", boxShadow: `2px 2px 0 ${EA.ink}`,
        display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
      }}
    >
      {/* Mini ship preview showing orientation */}
      <div style={{ display: "flex", flexDirection: horizontal ? "row" : "column", gap: 2 }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            width: 8, height: 8,
            background: i === 0
              ? (horizontal ? EA.cyan : EA.pink)
              : "rgba(255,255,255,0.4)",
            borderRadius: 2,
          }} />
        ))}
      </div>
      <span style={{
        fontFamily: "var(--font-display)", fontSize: 11, fontWeight: 900,
        color: horizontal ? EA.cyan : EA.pink,
        letterSpacing: 1, textTransform: "uppercase",
      }}>
        {horizontal ? "Horiz." : "Vert."}
      </span>
    </button>
  );

  const randomBtn = (
    <button
      onClick={handleRandom}
      style={{
        background: EA.butter, border: `2px solid ${EA.ink}`, borderRadius: 10,
        padding: "8px 16px", fontFamily: "var(--font-display)", fontSize: 14,
        color: EA.ink, cursor: "pointer", boxShadow: `2px 2px 0 ${EA.ink}`, fontWeight: 700,
      }}
    >
      🎲 Aléatoire
    </button>
  );

  const readyBtn = (
    <button
      onClick={handleSubmit}
      disabled={!allPlaced || submitting}
      style={{
        background: allPlaced && !submitting ? EA.violet : "rgba(255,255,255,0.1)",
        border: `2px solid ${allPlaced ? EA.ink : "rgba(255,255,255,0.2)"}`,
        borderRadius: 10, padding: "10px 24px",
        fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 700,
        color: allPlaced && !submitting ? EA.white : "rgba(255,255,255,0.3)",
        cursor: allPlaced && !submitting ? "pointer" : "not-allowed",
        boxShadow: allPlaced && !submitting ? `3px 3px 0 ${EA.ink}` : "none",
        width: "100%",
      }}
    >
      {submitting ? "..." : "⚓ PRÊT !"}
    </button>
  );

  // Background decorations
  const Bg = (
    <>
      <div aria-hidden style={{ position: "absolute", inset: 0, opacity: 0.3, backgroundImage: `radial-gradient(circle, rgba(0,212,232,0.5) 1.2px, transparent 1.6px) 0 0 / 16px 16px` }} />
      <SvgBlob color={EA.cyan} style={{ width: 480, height: 420, top: -180, left: -140, opacity: 0.55, animation: "ea-float 7s ease-in-out infinite" }} />
      <SvgBlob color={EA.butter} style={{ width: 400, height: 360, bottom: -160, right: -120, opacity: 0.45, animation: "ea-float 9s ease-in-out infinite reverse" }} path="M 50 30 Q 90 5 140 30 Q 195 50 180 110 Q 175 175 110 175 Q 30 180 25 120 Q 10 60 50 30 Z" />
      <Star color={EA.butter} size={32} style={{ top: "8%", right: "5%", transform: "rotate(12deg)", animation: "ea-spin-slow 10s linear infinite" }} />
      <Star color={EA.white} size={18} style={{ bottom: "12%", left: "4%", animation: "ea-float 6s ease-in-out infinite" }} />
    </>
  );

  if (desktop) {
    return (
      <div style={{ position: "relative", minHeight: "100dvh", background: EA.violet, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {Bg}
        <div style={{ position: "relative", zIndex: 5, flex: 1, maxWidth: 1200, width: "100%", margin: "0 auto", display: "flex", flexDirection: "column" }}>
          <div style={{ textAlign: "center", padding: "24px 40px 0" }}>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 900, color: EA.cyan, textTransform: "uppercase", letterSpacing: 2 }}>PLACEMENT DES BATEAUX</div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 48, color: EA.white, transform: "skewX(-8deg)", textShadow: `4px 4px 0 ${EA.cyan}`, lineHeight: 1, marginTop: 4 }}>POSITIONNE TA FLOTTE ⚓</div>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: 13, color: "rgba(255,255,255,0.6)", marginTop: 8 }}>vs <strong style={{ color: EA.pink }}>{opPseudo}</strong></div>
          </div>

          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 48, padding: "24px 40px 32px" }}>
            {/* Grid */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
              <div style={{ fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 900, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: 1.2 }}>Ta flotte</div>
              {placementGrid(44)}
            </div>

            {/* Controls */}
            <div style={{ display: "flex", flexDirection: "column", gap: 20, minWidth: 260 }}>
              <div>
                <div style={{ fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 900, color: EA.cyan, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 10 }}>Bateaux à placer</div>
                {shipList}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {rotateBtn}
                {randomBtn}
              </div>
              <div style={{ display: "flex", justifyContent: "center" }}>{timerPill}</div>
              {readyBtn}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Mobile
  const mobileCellSize = Math.min(Math.floor((winWidth - 24) / 10), 36);
  return (
    <div style={{ position: "relative", minHeight: "100dvh", background: EA.violet, overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <div aria-hidden style={{ position: "absolute", inset: 0, opacity: 0.3, backgroundImage: `radial-gradient(circle, rgba(0,212,232,0.5) 1.2px, transparent 1.6px) 0 0 / 16px 16px` }} />
      <SvgBlob color={EA.cyan} style={{ width: 200, height: 180, top: -80, left: -60, opacity: 0.7, animation: "ea-float 4s ease-in-out infinite" }} />

      <div style={{ position: "relative", zIndex: 5, flex: 1, display: "flex", flexDirection: "column", padding: "12px 12px 20px", gap: 10 }}>
        {/* Title + timer + buttons */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexShrink: 0 }}>
          <div>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: 9, fontWeight: 900, color: EA.cyan, textTransform: "uppercase", letterSpacing: 1.5 }}>PLACEMENT</div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 20, color: EA.white, transform: "skewX(-6deg)", textShadow: `2px 2px 0 ${EA.cyan}`, lineHeight: 1 }}>POSITIONNE TA FLOTTE ⚓</div>
          </div>
          {timerPill}
        </div>

        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          {rotateBtn}
          {randomBtn}
        </div>

        {/* Grid */}
        <div style={{ display: "flex", justifyContent: "center", flexShrink: 0 }}>
          {placementGrid(mobileCellSize)}
        </div>

        {/* Ship list + ready button */}
        <div style={{ flex: 1 }}>{shipList}</div>
        <div style={{ flexShrink: 0 }}>{readyBtn}</div>
      </div>
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────

interface Props {
  gameId: string; myId: string; p1Id: string; p2Id: string;
  p1Pseudo: string; p2Pseudo: string;
  p1AvatarUrl: string | null;
  p2AvatarUrl: string | null;
  myInitialShips: NavalShip[] | null;
  initialState: NavalState; initialStatus: GameStatus;
  initialWinnerId: string | null; initialTurn: string | null;
}

export function NavalClient({ gameId, myId, p1Id, p2Id, p1Pseudo, p2Pseudo, p1AvatarUrl, p2AvatarUrl, myInitialShips, initialState, initialStatus, initialWinnerId, initialTurn }: Props) {
  const router = useRouter();
  const desktop = useIsDesktop();
  const winWidth = useWindowWidth();
  const { play } = useGameSounds();
  const opponentId = myId === p1Id ? p2Id : p1Id;
  const myPseudo = myId === p1Id ? p1Pseudo : p2Pseudo;
  const opPseudo  = myId === p1Id ? p2Pseudo : p1Pseudo;
  const myAvatarUrl = myId === p1Id ? p1AvatarUrl : p2AvatarUrl;
  const opAvatarUrl = myId === p1Id ? p2AvatarUrl : p1AvatarUrl;

  const [navalState, setNavalState] = useState<NavalState>(initialState);
  const [gameStatus, setGameStatus]   = useState<GameStatus>(initialStatus);
  const [currentTurn, setCurrentTurn] = useState<string | null>(initialTurn);
  const [winnerId, setWinnerId]       = useState<string | null>(initialWinnerId);
  const [shooting, setShooting]       = useState(false);
  const [activeTab, setActiveTab]     = useState<"fleet" | "attack">("attack");
  const [shotFeedback, setShotFeedback] = useState<string | null>(null);
  // My ships are kept in local state (not broadcast in Realtime — private)
  const [myShips, setMyShips]         = useState<NavalShip[]>(myInitialShips ?? []);

  const isFinishedRef = useRef(initialStatus === "finished");
  const forfeitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useOpponentWatcher({ gameId, opponentId, isFinishedRef });
  useGameOpponent(opponentId, opPseudo);

  // Presence heartbeat
  useEffect(() => {
    if (forfeitTimerRef.current) { clearTimeout(forfeitTimerRef.current); forfeitTimerRef.current = null; }
    const supabase = createClient();
    const beat = () => supabase.from("presence").upsert({ player_id: myId, pseudo: myPseudo, status: "in-game", game_type: "naval", updated_at: new Date().toISOString() }).then(() => {});
    beat();
    const hb = setInterval(beat, 15_000);
    return () => {
      clearInterval(hb);
      supabase.from("presence").update({ status: "online", updated_at: new Date().toISOString() }).eq("player_id", myId).then(() => {});
      if (!isFinishedRef.current) {
        forfeitTimerRef.current = setTimeout(() => {
          forfeitTimerRef.current = null;
          fetch("/api/forfeit", { method: "POST", body: JSON.stringify({ gameId }), headers: { "Content-Type": "application/json" }, keepalive: true });
        }, 5000);
      }
    };
  }, [myId, gameId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Redirect if already finished on load
  useEffect(() => {
    if (initialStatus === "finished") { isFinishedRef.current = true; router.replace(`/result?game_id=${gameId}`); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Realtime
  useEffect(() => {
    const supabase = createClient();
    const sub = supabase.channel(`game-naval-${gameId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "games", filter: `id=eq.${gameId}` }, (payload) => {
        const u = payload.new as { state: unknown; status: string; winner_id: string | null; current_turn: string | null };
        const ns = u.state as unknown as NavalState;
        setNavalState(ns);
        setGameStatus(u.status as GameStatus);
        setCurrentTurn(u.current_turn);
        setWinnerId(u.winner_id);
        if (u.status === "finished") {
          isFinishedRef.current = true;
          play(u.winner_id === myId ? "win" : "lose");
          setTimeout(() => router.replace(`/result?game_id=${gameId}`), 4000);
        } else if (u.current_turn === myId) {
          // Opponent just fired at me — switch to fleet view briefly
          const opShots = ns.shots?.[opponentId] ?? [];
          const last = opShots[opShots.length - 1];
          if (last) {
            play(last.result === "sunk" ? "reveal" : last.result === "hit" ? "move" : "tick");
            setActiveTab("fleet");
            setTimeout(() => setActiveTab("attack"), 2000);
          }
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [gameId, myId, opponentId, router, play]);

  const isMyTurn = currentTurn === myId && gameStatus === "playing";
  const isFinished = gameStatus === "finished";
  const iWon = winnerId === myId;
  const isDraw = isFinished && !winnerId;

  // myShips lives in local state (set from prop or after placement — never from Realtime)
  // opponentSunkShips are publicly revealed once a ship is destroyed
  const opponentSunkShips = navalState.sunk_ships?.[opponentId] ?? [];
  // On game over, full fleets are revealed
  const revealedOpShips = navalState.revealed_ships?.[opponentId] ?? opponentSunkShips;

  const inPlacementPhase = myShips.length === 0 && !navalState.fleets_placed?.[myId];
  const waitingForOpponent = (myShips.length > 0 || navalState.fleets_placed?.[myId]) &&
    !navalState.fleets_placed?.[opponentId];

  const myShots  = navalState.shots?.[myId]       ?? [];
  const opShots  = navalState.shots?.[opponentId] ?? [];

  const myGrid     = computeMyGrid(myShips, opShots);
  const attackGrid = isFinished
    ? computeAttackGrid(myShots, revealedOpShips)
    : computeAttackGrid(myShots, opponentSunkShips);
  const myShotCells = new Set(myShots.map(s => s.cell));
  const opShotCells = new Set(opShots.map(s => s.cell));

  const myHits = myShots.filter(s => s.result !== "miss").length;
  const opHits = opShots.filter(s => s.result !== "miss").length;

  async function handleShoot(cell: number) {
    if (!isMyTurn || shooting) return;
    setShooting(true);
    try {
      const res = await submitNavalShot(gameId, cell);
      if (res.ok) {
        const fb = res.result === "sunk" ? "💥 Coulé !" : res.result === "hit" ? "🔥 Touché !" : "💧 Manqué !";
        setShotFeedback(fb);
        setTimeout(() => setShotFeedback(null), 2200);
      }
    } finally {
      setShooting(false);
    }
  }

  // ── Placement phase early return ─────────────────────────────────────────────
  if (inPlacementPhase) {
    return (
      <PlacementScreen
        gameId={gameId}
        myId={myId}
        p1Id={p1Id}
        myPseudo={myPseudo}
        opPseudo={opPseudo}
        onPlaced={(ships) => {
          setMyShips(ships);
        }}
      />
    );
  }

  if (waitingForOpponent) {
    const waitGrid = computeMyGrid(myShips, []);
    const waitCellSize = desktop
      ? 44
      : Math.min(Math.floor((winWidth - 24) / 10), 36);
    return (
      <div style={{ position: "relative", minHeight: "100dvh", background: EA.violet, overflow: "hidden", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 32 }}>
        <div aria-hidden style={{ position: "absolute", inset: 0, opacity: 0.3, backgroundImage: `radial-gradient(circle, rgba(0,212,232,0.5) 1.2px, transparent 1.6px) 0 0 / 16px 16px` }} />
        <SvgBlob color={EA.cyan} style={{ width: 480, height: 420, top: -180, left: -140, opacity: 0.55, animation: "ea-float 7s ease-in-out infinite" }} />
        <div style={{ position: "relative", zIndex: 5, display: "flex", flexDirection: "column", alignItems: "center", gap: 24, padding: "40px 24px" }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: desktop ? 48 : 28, color: EA.white, transform: "skewX(-8deg)", textShadow: `4px 4px 0 ${EA.cyan}`, lineHeight: 1 }}>FLOTTE PRÊTE ⚓</div>
          <div style={{
            background: "rgba(26,15,94,0.7)", border: `2px solid ${EA.cyan}`,
            borderRadius: 999, padding: "10px 28px",
            display: "inline-flex", alignItems: "center", gap: 12,
            boxShadow: `3px 3px 0 ${EA.cyan}`,
            animation: "ea-pulse 1.2s ease-in-out infinite",
          }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: EA.cyan, boxShadow: `0 0 10px ${EA.cyan}`, flexShrink: 0 }} />
            <span style={{ fontFamily: "var(--font-sans)", fontSize: 15, fontWeight: 800, color: EA.white }}>En attente de {opPseudo}...</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 900, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: 1.2 }}>Ta flotte (lecture seule)</div>
            <NavalGrid cells={waitGrid} cellSize={waitCellSize} interactive={false} shotCells={new Set()} accentColor={EA.cyan} />
          </div>
        </div>
      </div>
    );
  }

  // ── Shared decorations ───────────────────────────────────────────────────────
  const Bg = (
    <>
      <div aria-hidden style={{ position: "absolute", inset: 0, opacity: 0.3, backgroundImage: `radial-gradient(circle, rgba(0,212,232,0.5) 1.2px, transparent 1.6px) 0 0 / 16px 16px` }} />
      <SvgBlob color={EA.cyan}   style={{ width: 480, height: 420, top: -180, left: -140, opacity: 0.55, animation: "ea-float 7s ease-in-out infinite" }} />
      <SvgBlob color={EA.butter} style={{ width: 400, height: 360, bottom: -160, right: -120, opacity: 0.45, animation: "ea-float 9s ease-in-out infinite reverse" }} path="M 50 30 Q 90 5 140 30 Q 195 50 180 110 Q 175 175 110 175 Q 30 180 25 120 Q 10 60 50 30 Z" />
      <Star color={EA.butter} size={32} style={{ top: "8%",  right: "5%",  transform: "rotate(12deg)", animation: "ea-spin-slow 10s linear infinite" }} />
      <Star color={EA.white}  size={18} style={{ bottom: "12%", left: "4%", animation: "ea-float 6s ease-in-out infinite" }} />
      <Star color={EA.cyan}   size={14} style={{ top: "45%", right: "3%",  animation: "ea-spin-slow 14s linear infinite reverse" }} />
    </>
  );

  // ── DESKTOP ──────────────────────────────────────────────────────────────────
  if (desktop) {
    return (
      <div style={{ position: "relative", minHeight: "100dvh", background: EA.violet, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <RulesButton gameType="naval" />
        {Bg}

        <div style={{ position: "relative", zIndex: 5, flex: 1, maxWidth: 1500, width: "100%", margin: "0 auto", display: "flex", flexDirection: "column" }}>
          {/* Title */}
          <div style={{ textAlign: "center", padding: "20px 40px 0" }}>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 900, color: EA.cyan, textTransform: "uppercase", letterSpacing: 2 }}>JEU EN COURS</div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 52, color: EA.white, transform: "skewX(-8deg)", textShadow: `4px 4px 0 ${EA.cyan}`, lineHeight: 1, marginTop: 4 }}>BATAILLE NAVALE ⚓</div>
          </div>

          {/* Main layout */}
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 40, padding: "16px 40px 32px" }}>

            {/* Me */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
              <div style={{ position: "relative" }}>
                {isMyTurn && !isFinished && <div style={{ position: "absolute", top: -14, left: -10, zIndex: 5, background: EA.butter, border: `2px solid ${EA.ink}`, padding: "3px 12px", borderRadius: 999, fontFamily: "var(--font-display)", fontSize: 13, color: EA.ink, letterSpacing: 0.6, transform: "rotate(-8deg)", boxShadow: `2px 2px 0 ${EA.ink}`, whiteSpace: "nowrap" }}>TON TOUR</div>}
                <div style={{ background: EA.pink, border: `2.5px solid ${EA.ink}`, borderRadius: 24, padding: "20px 28px", display: "flex", flexDirection: "column", alignItems: "center", gap: 12, transform: "rotate(-1deg)", boxShadow: `4px 4px 0 ${EA.cyan}`, opacity: !isMyTurn && !isFinished ? 0.6 : 1, minWidth: 160 }}>
                  <Avatar name={myPseudo} color={EA.butter} ring={EA.ink} size={72} src={myAvatarUrl} />
                  <div style={{ fontFamily: "var(--font-display)", fontSize: 18, color: EA.white, transform: "skewX(-4deg)" }}>{myPseudo.toUpperCase()}</div>
                  <div style={{ fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 800, color: "rgba(255,255,255,0.7)" }}>{opHits}/{17} reçus</div>
                </div>
              </div>
              <div style={{ background: EA.violetDeep, border: `2px solid ${EA.ink}`, borderRadius: 14, padding: "14px 18px" }}>
                <div style={{ fontFamily: "var(--font-sans)", fontSize: 10, fontWeight: 900, color: EA.cyan, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 10 }}>Ma flotte</div>
                <FleetTracker ships={myShips} shotCells={opShotCells} accent={EA.cyan} />
              </div>
            </div>

            {/* Grids */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 24 }}>
              <div style={{ display: "flex", gap: 28 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "center" }}>
                  <div style={{ fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 900, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: 1.2 }}>Ma flotte</div>
                  <NavalGrid cells={myGrid} cellSize={44} interactive={false} shotCells={opShotCells} accentColor={EA.cyan} />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "center" }}>
                  <div style={{ fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 900, color: isMyTurn ? EA.pink : "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: 1.2 }}>
                    {isMyTurn ? "🎯 ATTAQUE !" : "Zone ennemie"}
                  </div>
                  <NavalGrid cells={attackGrid} cellSize={44} interactive={isMyTurn && !shooting} shotCells={myShotCells} onShoot={handleShoot} accentColor={EA.pink} />
                </div>
              </div>
              <TurnPill isMyTurn={isMyTurn} isFinished={isFinished} iWon={iWon} isDraw={isDraw} opPseudo={opPseudo} shotFeedback={shotFeedback} />
            </div>

            {/* Opponent */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
              <div style={{ position: "relative" }}>
                {!isMyTurn && !isFinished && <div style={{ position: "absolute", top: -14, right: -10, zIndex: 5, background: EA.butter, border: `2px solid ${EA.ink}`, padding: "3px 12px", borderRadius: 999, fontFamily: "var(--font-display)", fontSize: 13, color: EA.ink, letterSpacing: 0.6, transform: "rotate(8deg)", boxShadow: `2px 2px 0 ${EA.ink}`, whiteSpace: "nowrap" }}>SON TOUR</div>}
                <div style={{ background: EA.cyan, border: `2.5px solid ${EA.ink}`, borderRadius: 24, padding: "20px 28px", display: "flex", flexDirection: "column", alignItems: "center", gap: 12, transform: "rotate(1.5deg)", boxShadow: `4px 4px 0 ${EA.pink}`, opacity: isMyTurn && !isFinished ? 0.6 : 1, minWidth: 160 }}>
                  <Avatar name={opPseudo} color={EA.pink} ring={EA.ink} size={72} src={opAvatarUrl} />
                  <div style={{ fontFamily: "var(--font-display)", fontSize: 18, color: EA.ink, transform: "skewX(-4deg)" }}>{opPseudo.toUpperCase()}</div>
                  <div style={{ fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 800, color: "rgba(26,15,94,0.6)" }}>{myHits}/{17} reçus</div>
                </div>
              </div>
              <div style={{ background: EA.violetDeep, border: `2px solid ${EA.ink}`, borderRadius: 14, padding: "14px 18px" }}>
                <div style={{ fontFamily: "var(--font-sans)", fontSize: 10, fontWeight: 900, color: EA.pink, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 10 }}>Flotte ennemie</div>
                <FleetTracker ships={isFinished ? revealedOpShips : opponentSunkShips} shotCells={myShotCells} accent={EA.pink} />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── MOBILE ───────────────────────────────────────────────────────────────────
  const meActive = isMyTurn && !isFinished;
  const opActive = !isMyTurn && !isFinished;

  // Full-width grid: screen - 2*12px padding - 12px grid padding*2 - 3px border*2
  const gridCellSize = Math.min(Math.floor(winWidth / 10) - 3, 36);

  return (
    <div style={{ position: "relative", minHeight: "100dvh", background: EA.violet, overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <RulesButton gameType="naval" />
      <div aria-hidden style={{ position: "absolute", inset: 0, opacity: 0.3, backgroundImage: `radial-gradient(circle, rgba(0,212,232,0.5) 1.2px, transparent 1.6px) 0 0 / 16px 16px` }} />
      <SvgBlob color={EA.cyan}   style={{ width: 200, height: 180, top: -80, left: -60, opacity: 0.7, animation: "ea-float 4s ease-in-out infinite" }} />
      <SvgBlob color={EA.butter} style={{ width: 180, height: 160, bottom: -60, right: -40, opacity: 0.6, animation: "ea-float 6s ease-in-out infinite reverse" }} path="M 50 30 Q 90 5 140 30 Q 195 50 180 110 Q 175 175 110 175 Q 30 180 25 120 Q 10 60 50 30 Z" />
      <Star color={EA.butter} size={16} style={{ top: "28%", right: 14, transform: "rotate(15deg)", animation: "ea-spin-slow 10s linear infinite" }} />

      <div style={{ position: "relative", zIndex: 5, flex: 1, display: "flex", flexDirection: "column", padding: "12px 12px 20px", gap: 10 }}>

        {/* Title */}
        <div style={{ textAlign: "center", flexShrink: 0 }}>
          <div style={{ fontFamily: "var(--font-sans)", fontSize: 10, fontWeight: 900, color: EA.cyan, textTransform: "uppercase", letterSpacing: 2 }}>JEU EN COURS</div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 26, color: EA.white, transform: "skewX(-8deg)", textShadow: `3px 3px 0 ${EA.cyan}`, lineHeight: 1 }}>BATAILLE NAVALE ⚓</div>
        </div>

        {/* Player headers */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexShrink: 0 }}>
          <div style={{ flex: 1, minWidth: 0, position: "relative" }}>
            {meActive && <div style={{ position: "absolute", top: -10, left: -4, zIndex: 5, background: EA.butter, border: `2px solid ${EA.ink}`, padding: "2px 7px", borderRadius: 999, fontFamily: "var(--font-display)", fontSize: 9, color: EA.ink, transform: "rotate(-8deg)", boxShadow: `2px 2px 0 ${EA.ink}` }}>TON TOUR</div>}
            <div style={{ background: EA.pink, border: `2.5px solid ${EA.ink}`, borderRadius: 16, padding: "8px 10px", display: "flex", alignItems: "center", gap: 8, transform: "rotate(-1deg)", boxShadow: `3px 3px 0 ${EA.cyan}`, opacity: !meActive && !isFinished ? 0.65 : 1 }}>
              <Avatar name={myPseudo} color={EA.butter} ring={EA.ink} size={28} src={myAvatarUrl} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 11, color: EA.white, transform: "skewX(-4deg)", lineHeight: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{myPseudo.toUpperCase()}</div>
                <div style={{ fontFamily: "var(--font-sans)", fontSize: 10, fontWeight: 800, color: "rgba(255,255,255,0.7)", marginTop: 2 }}>Touché : {myHits}/17</div>
              </div>
            </div>
          </div>
          <div style={{ flexShrink: 0, background: EA.violetDeep, border: `2.5px solid ${EA.ink}`, borderRadius: 12, padding: "4px 8px", fontFamily: "var(--font-display)", fontSize: 13, color: EA.cyan, transform: "skewX(-8deg)", boxShadow: `2px 2px 0 ${EA.pink}` }}>
            ⚓
          </div>
          <div style={{ flex: 1, minWidth: 0, position: "relative" }}>
            {opActive && <div style={{ position: "absolute", top: -10, right: -4, zIndex: 5, background: EA.butter, border: `2px solid ${EA.ink}`, padding: "2px 7px", borderRadius: 999, fontFamily: "var(--font-display)", fontSize: 9, color: EA.ink, transform: "rotate(8deg)", boxShadow: `2px 2px 0 ${EA.ink}` }}>SON TOUR</div>}
            <div style={{ background: EA.cyan, border: `2.5px solid ${EA.ink}`, borderRadius: 16, padding: "8px 10px", display: "flex", alignItems: "center", gap: 8, transform: "rotate(1.5deg)", boxShadow: `3px 3px 0 ${EA.pink}`, opacity: !opActive && !isFinished ? 0.65 : 1 }}>
              <Avatar name={opPseudo} color={EA.pink} ring={EA.ink} size={28} src={opAvatarUrl} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 11, color: EA.ink, transform: "skewX(-4deg)", lineHeight: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{opPseudo.toUpperCase()}</div>
                <div style={{ fontFamily: "var(--font-sans)", fontSize: 10, fontWeight: 800, color: "rgba(26,15,94,0.6)", marginTop: 2 }}>Touché : {opHits}/17</div>
              </div>
            </div>
          </div>
        </div>

        {/* Tab switcher */}
        <div style={{
          display: "flex", gap: 4, flexShrink: 0,
          background: "rgba(26,15,94,0.55)", border: `2px solid ${EA.ink}`,
          borderRadius: 999, padding: 3,
        }}>
          {([
            { id: "fleet"  as const, label: "🛡 MA FLOTTE" },
            { id: "attack" as const, label: isMyTurn ? "🎯 ATTAQUE !" : "⚔ ZONE ENNEMIE" },
          ]).map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
              flex: 1, textAlign: "center",
              background: activeTab === t.id ? (t.id === "attack" ? EA.pink : EA.cyan) : "transparent",
              border: "none", borderRadius: 999, padding: "8px 0",
              fontFamily: "var(--font-display)", fontSize: 13,
              color: activeTab === t.id ? (t.id === "attack" ? EA.white : EA.ink) : "rgba(255,255,255,0.55)",
              cursor: "pointer",
              boxShadow: activeTab === t.id ? `2px 2px 0 ${EA.ink}` : "none",
            }}>{t.label}</button>
          ))}
        </div>

        {/* Active grid */}
        <div style={{ flex: 1, display: "flex", alignItems: "flex-start", justifyContent: "center", flexShrink: 0 }}>
          {activeTab === "fleet"
            ? <NavalGrid cells={myGrid} cellSize={gridCellSize} interactive={false} shotCells={opShotCells} accentColor={EA.cyan} />
            : <NavalGrid cells={attackGrid} cellSize={gridCellSize} interactive={isMyTurn && !shooting} shotCells={myShotCells} onShoot={handleShoot} accentColor={EA.pink} />
          }
        </div>

        {/* Fleet tracker */}
        <div style={{
          background: EA.violetDeep, border: `2px solid ${EA.ink}`,
          borderRadius: 14, padding: "10px 14px", flexShrink: 0,
          display: "flex", gap: 16,
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: 9, fontWeight: 900, color: EA.cyan, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 6 }}>Ma flotte</div>
            <FleetTracker ships={myShips} shotCells={opShotCells} accent={EA.cyan} />
          </div>
          <div style={{ width: 1, background: "rgba(255,255,255,0.08)" }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: 9, fontWeight: 900, color: EA.pink, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 6 }}>Flotte ennemie</div>
            <FleetTracker ships={isFinished ? revealedOpShips : opponentSunkShips} shotCells={myShotCells} accent={EA.pink} />
          </div>
        </div>

        {/* Turn pill */}
        <div style={{ textAlign: "center", flexShrink: 0 }}>
          <TurnPill isMyTurn={isMyTurn} isFinished={isFinished} iWon={iWon} isDraw={isDraw} opPseudo={opPseudo} shotFeedback={shotFeedback} />
        </div>
      </div>
      <PreventLeave enabled={!isFinished} gameId={gameId} />
    </div>
  );
}

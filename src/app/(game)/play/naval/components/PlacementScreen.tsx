import { useEffect, useRef, useState } from "react";
import { RR } from "@/lib/design";
import { SvgBlob } from "@/components/ui/blob";
import { Star } from "@/components/ui/star";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { useWindowWidth } from "@/hooks/useWindowWidth";
import { PreventLeave } from "@/components/PreventLeave";
import { FLEET_DEFS, generateFleet } from "@/lib/battleship";
import type { NavalShip } from "@/types/database";
import { submitNavalPlacement } from "../actions";
import { getPreviewCells } from "./grid";

interface PlacementProps {
  gameId: string;
  myId: string;
  p1Id: string;
  myPseudo: string;
  opPseudo: string;
  onPlaced: (ships: NavalShip[]) => void;
}

export function PlacementScreen({ gameId, myId, p1Id, myPseudo, opPseudo, onPlaced }: PlacementProps) {
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

  const timerColor = countdown <= 10 ? RR.pink : RR.butter;
  const timerText = `0:${String(countdown).padStart(2, "0")}`;
  const allPlaced = placedShips.length >= FLEET_DEFS.length;

  const placementGrid = (cellSize: number) => {
    const gap = 2;
    const gridPx = cellSize * 10 + gap * 9;
    return (
      <div style={{
        background: RR.violetDeep, border: `3px solid ${RR.ink}`, borderRadius: 16,
        padding: 6, boxShadow: `5px 5px 0 ${RR.cyan}, 5px 5px 0 1px ${RR.ink}`,
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
                    state === "preview-invalid" ? RR.pink :
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
              background: isSelected ? RR.butter : isPlaced ? "rgba(0,212,232,0.12)" : "rgba(255,255,255,0.05)",
              border: `2px solid ${isSelected ? RR.ink : isPlaced ? "rgba(0,212,232,0.4)" : "rgba(255,255,255,0.1)"}`,
              borderRadius: 10, padding: "8px 12px", cursor: "pointer",
              opacity: isPlaced && !isSelected ? 0.65 : 1,
              boxShadow: isSelected ? `2px 2px 0 ${RR.ink}` : "none",
              transition: "background 0.1s, opacity 0.1s",
            }}
          >
            <div style={{ display: "flex", gap: 2 }}>
              {Array.from({ length: def.size }).map((_, i) => (
                <div key={i} style={{
                  width: 10, height: 10, borderRadius: 2,
                  background: isSelected ? RR.ink : isPlaced ? RR.cyan : "rgba(255,255,255,0.4)",
                  border: `1.5px solid ${isSelected ? RR.ink : isPlaced ? RR.ink : "rgba(255,255,255,0.2)"}`,
                }} />
              ))}
            </div>
            <span style={{
              fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 800,
              color: isSelected ? RR.ink : isPlaced ? RR.cyan : "rgba(255,255,255,0.7)",
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
        border: `2px solid ${horizontal ? RR.cyan : RR.pink}`,
        borderRadius: 10, padding: "8px 14px",
        cursor: "pointer", boxShadow: `2px 2px 0 ${RR.ink}`,
        display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
      }}
    >
      {/* Mini ship preview showing orientation */}
      <div style={{ display: "flex", flexDirection: horizontal ? "row" : "column", gap: 2 }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            width: 8, height: 8,
            background: i === 0
              ? (horizontal ? RR.cyan : RR.pink)
              : "rgba(255,255,255,0.4)",
            borderRadius: 2,
          }} />
        ))}
      </div>
      <span style={{
        fontFamily: "var(--font-display)", fontSize: 11, fontWeight: 900,
        color: horizontal ? RR.cyan : RR.pink,
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
        background: RR.butter, border: `2px solid ${RR.ink}`, borderRadius: 10,
        padding: "8px 16px", fontFamily: "var(--font-display)", fontSize: 14,
        color: RR.ink, cursor: "pointer", boxShadow: `2px 2px 0 ${RR.ink}`, fontWeight: 700,
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
        background: allPlaced && !submitting ? RR.violet : "rgba(255,255,255,0.1)",
        border: `2px solid ${allPlaced ? RR.ink : "rgba(255,255,255,0.2)"}`,
        borderRadius: 10, padding: "10px 24px",
        fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 700,
        color: allPlaced && !submitting ? RR.white : "rgba(255,255,255,0.3)",
        cursor: allPlaced && !submitting ? "pointer" : "not-allowed",
        boxShadow: allPlaced && !submitting ? `3px 3px 0 ${RR.ink}` : "none",
        width: "100%",
      }}
    >
      {submitting ? "…" : "⚓ PRÊT !"}
    </button>
  );

  // Background decorations
  const Bg = (
    <>
      <div aria-hidden style={{ position: "absolute", inset: 0, opacity: 0.3, backgroundImage: `radial-gradient(circle, rgba(0,212,232,0.5) 1.2px, transparent 1.6px) 0 0 / 16px 16px` }} />
      <SvgBlob color={RR.cyan} style={{ width: 480, height: 420, top: -180, left: -140, opacity: 0.55, animation: "rr-float 7s ease-in-out infinite" }} />
      <SvgBlob color={RR.butter} style={{ width: 400, height: 360, bottom: -160, right: -120, opacity: 0.45, animation: "rr-float 9s ease-in-out infinite reverse" }} path="M 50 30 Q 90 5 140 30 Q 195 50 180 110 Q 175 175 110 175 Q 30 180 25 120 Q 10 60 50 30 Z" />
      <Star color={RR.butter} size={32} style={{ top: "8%", right: "5%", transform: "rotate(12deg)", animation: "rr-spin-slow 10s linear infinite" }} />
      <Star color={RR.white} size={18} style={{ bottom: "12%", left: "4%", animation: "rr-float 6s ease-in-out infinite" }} />
    </>
  );

  if (desktop) {
    return (
      <div style={{ position: "relative", minHeight: "100dvh", background: RR.violet, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <PreventLeave enabled gameId={gameId} />
        {Bg}
        <div style={{ position: "relative", zIndex: 5, flex: 1, maxWidth: 1200, width: "100%", margin: "0 auto", display: "flex", flexDirection: "column" }}>
          <div style={{ textAlign: "center", padding: "24px 40px 0" }}>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 900, color: RR.cyan, textTransform: "uppercase", letterSpacing: 2 }}>PLACEMENT DES BATEAUX</div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 48, color: RR.white, transform: "skewX(-8deg)", textShadow: `4px 4px 0 ${RR.cyan}`, lineHeight: 1, marginTop: 4 }}>POSITIONNE TA FLOTTE ⚓</div>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: 13, color: "rgba(255,255,255,0.6)", marginTop: 8 }}>vs <strong style={{ color: RR.pink }}>{opPseudo}</strong></div>
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
                <div style={{ fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 900, color: RR.cyan, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 10 }}>Bateaux à placer</div>
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
    <div style={{ position: "relative", minHeight: "100dvh", background: RR.violet, overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <PreventLeave enabled gameId={gameId} />
      <div aria-hidden style={{ position: "absolute", inset: 0, opacity: 0.3, backgroundImage: `radial-gradient(circle, rgba(0,212,232,0.5) 1.2px, transparent 1.6px) 0 0 / 16px 16px` }} />
      <SvgBlob color={RR.cyan} style={{ width: 200, height: 180, top: -80, left: -60, opacity: 0.7, animation: "rr-float 4s ease-in-out infinite" }} />

      <div style={{ position: "relative", zIndex: 5, flex: 1, display: "flex", flexDirection: "column", padding: "12px 12px 20px", gap: 10 }}>
        {/* Title + timer + buttons */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexShrink: 0 }}>
          <div>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: 9, fontWeight: 900, color: RR.cyan, textTransform: "uppercase", letterSpacing: 1.5 }}>PLACEMENT</div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 20, color: RR.white, transform: "skewX(-6deg)", textShadow: `2px 2px 0 ${RR.cyan}`, lineHeight: 1 }}>POSITIONNE TA FLOTTE ⚓</div>
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

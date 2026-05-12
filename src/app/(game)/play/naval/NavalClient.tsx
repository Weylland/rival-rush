"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { submitNavalShot } from "./actions";
import { useOpponentWatcher } from "@/hooks/useOpponentWatcher";
import { useGameSounds } from "@/hooks/useGameSounds";
import { RulesButton } from "@/components/ui/rules-button";
import { EA } from "@/lib/design";
import { FLEET_DEFS, TOTAL_SHIP_CELLS } from "@/lib/battleship";
import type { NavalState, NavalShip, GameStatus } from "@/types/database";

// ── Grid rendering ─────────────────────────────────────────────────────────────

type CellKind = "water" | "ship" | "hit" | "miss" | "sunk";

function computeMyGrid(myShips: NavalShip[], opShots: { cell: number; result: string }[]): CellKind[] {
  const grid: CellKind[] = Array(100).fill("water");
  const shotMap = new Map(opShots.map(s => [s.cell, s.result]));
  for (const ship of myShips) {
    for (const c of ship.cells) {
      const r = shotMap.get(c);
      grid[c] = r === "hit" || r === "sunk" ? "hit" : "ship";
    }
  }
  for (const [cell, result] of shotMap) {
    if (result === "miss") grid[cell] = "miss";
  }
  return grid;
}

function computeAttackGrid(myShots: { cell: number; result: string }[], opShips: NavalShip[]): CellKind[] {
  const grid: CellKind[] = Array(100).fill("water");
  const shotSet = new Set(myShots.map(s => s.cell));
  const sunkShipCells = new Set<number>();

  for (const ship of opShips) {
    if (ship.cells.every(c => {
      const shot = myShots.find(s => s.cell === c);
      return shot && shot.result !== "miss";
    })) {
      ship.cells.forEach(c => sunkShipCells.add(c));
    }
  }

  for (const s of myShots) {
    if (sunkShipCells.has(s.cell)) grid[s.cell] = "sunk";
    else if (s.result === "miss") grid[s.cell] = "miss";
    else if (s.result === "hit") grid[s.cell] = "hit";
  }
  return grid;
}

const CELL_COLORS: Record<CellKind, string> = {
  water: "rgba(0,80,180,0.18)",
  ship:  "rgba(0,212,232,0.35)",
  hit:   "#ff1e8c",
  miss:  "rgba(255,255,255,0.12)",
  sunk:  "#8b0000",
};

function Grid({
  cells,
  label,
  interactive,
  onShoot,
  shotCells,
  size,
}: {
  cells: CellKind[];
  label: string;
  interactive: boolean;
  onShoot?: (cell: number) => void;
  shotCells: Set<number>;
  size: number;
}) {
  const cellSize = size / 10;
  return (
    <div>
      <div style={{
        fontFamily: "var(--font-sans)", fontSize: 10, fontWeight: 900,
        color: interactive ? EA.cyan : "rgba(255,255,255,0.45)",
        textTransform: "uppercase", letterSpacing: 1.4, marginBottom: 4,
        textAlign: "center",
      }}>{label}</div>
      <div style={{
        width: size, height: size,
        display: "grid", gridTemplateColumns: `repeat(10, 1fr)`,
        gap: 1,
        border: `2px solid ${interactive ? EA.cyan : "rgba(255,255,255,0.2)"}`,
        borderRadius: 6,
        overflow: "hidden",
        boxShadow: interactive ? `0 0 12px rgba(0,212,232,0.3)` : "none",
      }}>
        {cells.map((kind, i) => {
          const alreadyShot = shotCells.has(i);
          const canShoot = interactive && !alreadyShot && kind === "water";
          return (
            <div
              key={i}
              onClick={() => canShoot && onShoot?.(i)}
              style={{
                background: CELL_COLORS[kind],
                cursor: canShoot ? "crosshair" : "default",
                position: "relative",
                transition: "background 0.1s",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              {kind === "miss" && (
                <div style={{
                  width: "35%", height: "35%", borderRadius: "50%",
                  background: "rgba(255,255,255,0.5)",
                }} />
              )}
              {(kind === "hit" || kind === "sunk") && (
                <div style={{
                  fontSize: cellSize * 0.55, lineHeight: 1,
                  color: "#fff", fontWeight: 900,
                }}>✕</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Fleet tracker ──────────────────────────────────────────────────────────────

function FleetTracker({
  label,
  ships,
  shotCells,
  accent,
}: {
  label: string;
  ships: NavalShip[];
  shotCells: Set<number>;
  accent: string;
}) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{
        fontFamily: "var(--font-sans)", fontSize: 9, fontWeight: 900,
        color: "rgba(255,255,255,0.4)", textTransform: "uppercase",
        letterSpacing: 1.2, marginBottom: 6, textAlign: "center",
      }}>{label}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {FLEET_DEFS.map(def => {
          const ship = ships.find(s => s.id === def.id);
          const sunk = ship ? ship.cells.every(c => shotCells.has(c)) : false;
          return (
            <div key={def.id} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
                {Array.from({ length: def.size }).map((_, i) => (
                  <div key={i} style={{
                    width: 8, height: 8, borderRadius: 2,
                    background: sunk ? "rgba(255,255,255,0.15)" : accent,
                    border: `1px solid ${sunk ? "rgba(255,255,255,0.1)" : EA.ink}`,
                    opacity: sunk ? 0.4 : 1,
                  }} />
                ))}
              </div>
              <div style={{
                fontFamily: "var(--font-sans)", fontSize: 9, fontWeight: 700,
                color: sunk ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.6)",
                textDecoration: sunk ? "line-through" : "none",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>{def.name}</div>
              {sunk && <div style={{ fontSize: 9, flexShrink: 0 }}>💥</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

interface Props {
  gameId: string;
  myId: string;
  p1Id: string;
  p2Id: string;
  p1Pseudo: string;
  p2Pseudo: string;
  initialState: NavalState;
  initialStatus: GameStatus;
  initialWinnerId: string | null;
  initialTurn: string | null;
}

export function NavalClient({
  gameId, myId, p1Id, p2Id, p1Pseudo, p2Pseudo,
  initialState, initialStatus, initialWinnerId, initialTurn,
}: Props) {
  const router = useRouter();
  const { play } = useGameSounds();
  const opponentId = myId === p1Id ? p2Id : p1Id;
  const myPseudo = myId === p1Id ? p1Pseudo : p2Pseudo;
  const opPseudo = myId === p1Id ? p2Pseudo : p1Pseudo;

  const [navalState, setNavalState] = useState<NavalState>(initialState);
  const [gameStatus, setGameStatus] = useState<GameStatus>(initialStatus);
  const [currentTurn, setCurrentTurn] = useState<string | null>(initialTurn);
  const [shooting, setShooting] = useState(false);
  const [lastShot, setLastShot] = useState<{ result: string; label: string } | null>(null);

  const isGameFinishedRef = useRef(initialStatus === "finished");
  const forfeitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useOpponentWatcher({ gameId, opponentId, isFinishedRef: isGameFinishedRef });

  // Presence: mark in-game
  useEffect(() => {
    if (forfeitTimerRef.current) { clearTimeout(forfeitTimerRef.current); forfeitTimerRef.current = null; }
    const supabase = createClient();
    const beat = () => supabase.from("presence").upsert({ player_id: myId, pseudo: myPseudo, status: "in-game", updated_at: new Date().toISOString() }).then(() => {});
    beat();
    const hb = setInterval(beat, 30_000);
    return () => {
      clearInterval(hb);
      supabase.from("presence").update({ status: "online", updated_at: new Date().toISOString() }).eq("player_id", myId).then(() => {});
      if (!isGameFinishedRef.current) {
        forfeitTimerRef.current = setTimeout(() => {
          forfeitTimerRef.current = null;
          fetch("/api/forfeit", { method: "POST", body: JSON.stringify({ gameId }), headers: { "Content-Type": "application/json" }, keepalive: true });
        }, 500);
      }
    };
  }, [myId, gameId]);

  // Redirect if already finished
  useEffect(() => {
    if (initialStatus === "finished") { isGameFinishedRef.current = true; router.push(`/result?game_id=${gameId}`); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Realtime subscription
  useEffect(() => {
    const supabase = createClient();
    const sub = supabase
      .channel(`game-naval-${gameId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "games", filter: `id=eq.${gameId}` }, (payload) => {
        const updated = payload.new as { state: unknown; status: string; winner_id: string | null; current_turn: string | null };
        const newState = updated.state as unknown as NavalState;
        setNavalState(newState);
        setGameStatus(updated.status as GameStatus);
        setCurrentTurn(updated.current_turn);
        if (updated.status === "finished") {
          isGameFinishedRef.current = true;
          play(updated.winner_id === myId ? "win" : "lose");
          setTimeout(() => router.push(`/result?game_id=${gameId}`), 2000);
        } else {
          // Detect new shot on my grid (opponent fired)
          const opShots = newState.shots?.[opponentId] ?? [];
          if (updated.current_turn === myId && opShots.length > 0) {
            const last = opShots[opShots.length - 1];
            if (last.result === "sunk") play("reveal");
            else if (last.result === "hit") play("move");
            else play("tick");
          }
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [gameId, myId, opponentId, router, play]);

  const isMyTurn = currentTurn === myId && gameStatus === "playing";

  const myShips = navalState.ships?.[myId] ?? [];
  const opShips = navalState.ships?.[opponentId] ?? [];
  const myShots = navalState.shots?.[myId] ?? [];
  const opShots = navalState.shots?.[opponentId] ?? [];

  const myGrid = computeMyGrid(myShips, opShots);
  const attackGrid = computeAttackGrid(myShots, opShips);

  const myShotCells = new Set(myShots.map(s => s.cell));
  const opShotCells = new Set(opShots.map(s => s.cell));

  const myHits = myShots.filter(s => s.result !== "miss").length;
  const opHits = opShots.filter(s => s.result !== "miss").length;

  async function handleShoot(cell: number) {
    if (!isMyTurn || shooting) return;
    setShooting(true);
    setLastShot(null);
    try {
      const res = await submitNavalShot(gameId, cell);
      if (res.ok) {
        const label = res.result === "sunk" ? "💥 Coulé !" : res.result === "hit" ? "🔥 Touché !" : "💧 Manqué";
        setLastShot({ result: res.result as string, label });
        if (res.result === "sunk") play("reveal");
        else if (res.result === "hit") play("move");
        else play("tick");
        setTimeout(() => setLastShot(null), 2000);
      }
    } finally {
      setShooting(false);
    }
  }

  // Responsive grid size
  const gridSize = typeof window !== "undefined"
    ? Math.min(Math.floor((window.innerWidth - 56) / 2), 200)
    : 160;

  return (
    <div style={{ minHeight: "100dvh", background: "#0a0a2e", position: "relative", overflow: "hidden" }}>
      {/* Subtle water grid bg */}
      <div aria-hidden style={{
        position: "absolute", inset: 0,
        backgroundImage: "linear-gradient(rgba(0,80,180,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(0,80,180,0.08) 1px, transparent 1px)",
        backgroundSize: "40px 40px",
      }} />
      {/* Animated wave gradient */}
      <div aria-hidden style={{
        position: "absolute", inset: 0, opacity: 0.15,
        background: "radial-gradient(ellipse at 30% 60%, #00d4e8 0%, transparent 60%), radial-gradient(ellipse at 70% 20%, #1a0f5e 0%, transparent 60%)",
      }} />

      <div style={{ position: "relative", zIndex: 10, maxWidth: 480, margin: "0 auto", padding: "16px 12px 80px" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 14, color: EA.cyan, transform: "skewX(-4deg)" }}>
            {myPseudo.toUpperCase()}
          </div>
          <div style={{
            fontFamily: "var(--font-sans)", fontSize: 10, fontWeight: 900,
            color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: 1.2,
          }}>⚓ BATAILLE NAVALE</div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 14, color: EA.pink, transform: "skewX(-4deg)" }}>
            {opPseudo.toUpperCase()}
          </div>
        </div>

        {/* Turn banner */}
        <div style={{
          background: isMyTurn ? "rgba(0,212,232,0.15)" : "rgba(255,30,140,0.1)",
          border: `2px solid ${isMyTurn ? EA.cyan : EA.pink}`,
          borderRadius: 12, padding: "8px 16px", marginBottom: 14,
          textAlign: "center",
          fontFamily: "var(--font-display)", fontSize: 14,
          color: isMyTurn ? EA.cyan : "rgba(255,255,255,0.6)",
          transform: "skewX(-4deg)",
        }}>
          {gameStatus === "finished"
            ? "🏁 Partie terminée — redirection..."
            : isMyTurn
              ? lastShot ? lastShot.label : "⚔ À TOI DE JOUER — Clique sur la grille ennemie"
              : `⏳ ${opPseudo} vise...`}
        </div>

        {/* Score bar */}
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          {[
            { label: "Mes touches", hits: myHits, total: TOTAL_SHIP_CELLS, color: EA.cyan },
            { label: "Leurs touches", hits: opHits, total: TOTAL_SHIP_CELLS, color: EA.pink },
          ].map(({ label, hits, total, color }) => (
            <div key={label} style={{ flex: 1, background: "rgba(255,255,255,0.05)", borderRadius: 8, padding: "6px 10px" }}>
              <div style={{ fontFamily: "var(--font-sans)", fontSize: 9, fontWeight: 900, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: 1 }}>{label}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                <div style={{ flex: 1, height: 6, background: "rgba(255,255,255,0.1)", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ width: `${(hits / total) * 100}%`, height: "100%", background: color, borderRadius: 3, transition: "width 0.3s" }} />
                </div>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 12, color, flexShrink: 0 }}>{hits}/{total}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Both grids */}
        <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
          <Grid
            cells={myGrid}
            label="MA FLOTTE"
            interactive={false}
            shotCells={opShotCells}
            size={gridSize}
          />
          <Grid
            cells={attackGrid}
            label={isMyTurn ? "🎯 ATTAQUE !" : "ZONE ENNEMIE"}
            interactive={isMyTurn && !shooting}
            onShoot={handleShoot}
            shotCells={myShotCells}
            size={gridSize}
          />
        </div>

        {/* Fleet trackers */}
        <div style={{
          display: "flex", gap: 12, marginTop: 16,
          background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 12, padding: "12px 10px",
        }}>
          <FleetTracker
            label="Ma flotte"
            ships={myShips}
            shotCells={opShotCells}
            accent={EA.cyan}
          />
          <div style={{ width: 1, background: "rgba(255,255,255,0.08)", flexShrink: 0 }} />
          <FleetTracker
            label={`Flotte de ${opPseudo}`}
            ships={opShips}
            shotCells={myShotCells}
            accent={EA.pink}
          />
        </div>

      </div>

      <RulesButton gameType="naval" />
    </div>
  );
}

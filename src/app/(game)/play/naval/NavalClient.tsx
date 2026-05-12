"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { submitNavalShot } from "./actions";
import { useOpponentWatcher } from "@/hooks/useOpponentWatcher";
import { useGameSounds } from "@/hooks/useGameSounds";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { RulesButton } from "@/components/ui/rules-button";
import { Avatar } from "@/components/ui/avatar";
import { SvgBlob } from "@/components/ui/blob";
import { Star } from "@/components/ui/star";
import { EA } from "@/lib/design";
import { FLEET_DEFS } from "@/lib/battleship";
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

function computeAttackGrid(myShots: { cell: number; result: string }[], opShips: NavalShip[]): CellKind[] {
  const grid: CellKind[] = Array(100).fill("water");
  const sunkCells = new Set<number>();
  for (const ship of opShips) {
    if (ship.cells.every(c => myShots.find(s => s.cell === c && s.result !== "miss"))) {
      ship.cells.forEach(c => sunkCells.add(c));
    }
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

// ── Main ───────────────────────────────────────────────────────────────────────

interface Props {
  gameId: string; myId: string; p1Id: string; p2Id: string;
  p1Pseudo: string; p2Pseudo: string;
  initialState: NavalState; initialStatus: GameStatus;
  initialWinnerId: string | null; initialTurn: string | null;
}

export function NavalClient({ gameId, myId, p1Id, p2Id, p1Pseudo, p2Pseudo, initialState, initialStatus, initialWinnerId, initialTurn }: Props) {
  const router = useRouter();
  const desktop = useIsDesktop();
  const { play } = useGameSounds();
  const opponentId = myId === p1Id ? p2Id : p1Id;
  const myPseudo = myId === p1Id ? p1Pseudo : p2Pseudo;
  const opPseudo  = myId === p1Id ? p2Pseudo : p1Pseudo;

  const [navalState, setNavalState] = useState<NavalState>(initialState);
  const [gameStatus, setGameStatus]   = useState<GameStatus>(initialStatus);
  const [currentTurn, setCurrentTurn] = useState<string | null>(initialTurn);
  const [winnerId, setWinnerId]       = useState<string | null>(initialWinnerId);
  const [shooting, setShooting]       = useState(false);
  const [activeTab, setActiveTab]     = useState<"fleet" | "attack">("attack");
  const [shotFeedback, setShotFeedback] = useState<string | null>(null);

  const isFinishedRef = useRef(initialStatus === "finished");
  const forfeitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useOpponentWatcher({ gameId, opponentId, isFinishedRef });

  // Presence heartbeat
  useEffect(() => {
    if (forfeitTimerRef.current) { clearTimeout(forfeitTimerRef.current); forfeitTimerRef.current = null; }
    const supabase = createClient();
    const beat = () => supabase.from("presence").upsert({ player_id: myId, pseudo: myPseudo, status: "in-game", updated_at: new Date().toISOString() }).then(() => {});
    beat();
    const hb = setInterval(beat, 30_000);
    return () => {
      clearInterval(hb);
      supabase.from("presence").update({ status: "online", updated_at: new Date().toISOString() }).eq("player_id", myId).then(() => {});
      if (!isFinishedRef.current) {
        forfeitTimerRef.current = setTimeout(() => {
          forfeitTimerRef.current = null;
          fetch("/api/forfeit", { method: "POST", body: JSON.stringify({ gameId }), headers: { "Content-Type": "application/json" }, keepalive: true });
        }, 500);
      }
    };
  }, [myId, gameId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Redirect if already finished on load
  useEffect(() => {
    if (initialStatus === "finished") { isFinishedRef.current = true; router.push(`/result?game_id=${gameId}`); }
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
          setTimeout(() => router.push(`/result?game_id=${gameId}`), 2000);
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

  const myShips  = navalState.ships?.[myId]       ?? [];
  const opShips  = navalState.ships?.[opponentId] ?? [];
  const myShots  = navalState.shots?.[myId]       ?? [];
  const opShots  = navalState.shots?.[opponentId] ?? [];

  const myGrid     = computeMyGrid(myShips, opShots);
  const attackGrid = computeAttackGrid(myShots, opShips);
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

        <div style={{ position: "relative", zIndex: 5, flex: 1, maxWidth: 1100, width: "100%", margin: "0 auto", display: "flex", flexDirection: "column" }}>
          {/* Title */}
          <div style={{ textAlign: "center", padding: "24px 40px 0" }}>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 900, color: EA.cyan, textTransform: "uppercase", letterSpacing: 2 }}>JEU EN COURS</div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 56, color: EA.white, transform: "skewX(-8deg)", textShadow: `4px 4px 0 ${EA.cyan}`, lineHeight: 1, marginTop: 4 }}>BATAILLE NAVALE ⚓</div>
          </div>

          {/* Main layout */}
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 48, padding: "20px 40px 40px" }}>

            {/* Me */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
              <div style={{ position: "relative" }}>
                {isMyTurn && !isFinished && <div style={{ position: "absolute", top: -14, left: -10, zIndex: 5, background: EA.butter, border: `2px solid ${EA.ink}`, padding: "3px 12px", borderRadius: 999, fontFamily: "var(--font-display)", fontSize: 13, color: EA.ink, letterSpacing: 0.6, transform: "rotate(-8deg)", boxShadow: `2px 2px 0 ${EA.ink}`, whiteSpace: "nowrap" }}>TON TOUR</div>}
                <div style={{ background: EA.pink, border: `2.5px solid ${EA.ink}`, borderRadius: 24, padding: "18px 22px", display: "flex", flexDirection: "column", alignItems: "center", gap: 10, transform: "rotate(-1deg)", boxShadow: `4px 4px 0 ${EA.cyan}`, opacity: !isMyTurn && !isFinished ? 0.6 : 1, minWidth: 130 }}>
                  <Avatar name={myPseudo} color={EA.butter} ring={EA.ink} size={56} />
                  <div style={{ fontFamily: "var(--font-display)", fontSize: 16, color: EA.white, transform: "skewX(-4deg)" }}>{myPseudo.toUpperCase()}</div>
                  <div style={{ fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 800, color: "rgba(255,255,255,0.7)" }}>{opHits}/{17} reçus</div>
                </div>
              </div>
              <div style={{ background: EA.violetDeep, border: `2px solid ${EA.ink}`, borderRadius: 14, padding: "12px 16px" }}>
                <div style={{ fontFamily: "var(--font-sans)", fontSize: 10, fontWeight: 900, color: EA.cyan, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 8 }}>Ma flotte</div>
                <FleetTracker ships={myShips} shotCells={opShotCells} accent={EA.cyan} />
              </div>
            </div>

            {/* Grids */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
              <div style={{ display: "flex", gap: 20 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "center" }}>
                  <div style={{ fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 900, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: 1.2 }}>Ma flotte</div>
                  <NavalGrid cells={myGrid} cellSize={30} interactive={false} shotCells={opShotCells} accentColor={EA.cyan} />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "center" }}>
                  <div style={{ fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 900, color: isMyTurn ? EA.pink : "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: 1.2 }}>
                    {isMyTurn ? "🎯 ATTAQUE !" : "Zone ennemie"}
                  </div>
                  <NavalGrid cells={attackGrid} cellSize={30} interactive={isMyTurn && !shooting} shotCells={myShotCells} onShoot={handleShoot} accentColor={EA.pink} />
                </div>
              </div>
              <TurnPill isMyTurn={isMyTurn} isFinished={isFinished} iWon={iWon} isDraw={isDraw} opPseudo={opPseudo} shotFeedback={shotFeedback} />
            </div>

            {/* Opponent */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
              <div style={{ position: "relative" }}>
                {!isMyTurn && !isFinished && <div style={{ position: "absolute", top: -14, right: -10, zIndex: 5, background: EA.butter, border: `2px solid ${EA.ink}`, padding: "3px 12px", borderRadius: 999, fontFamily: "var(--font-display)", fontSize: 13, color: EA.ink, letterSpacing: 0.6, transform: "rotate(8deg)", boxShadow: `2px 2px 0 ${EA.ink}`, whiteSpace: "nowrap" }}>SON TOUR</div>}
                <div style={{ background: EA.cyan, border: `2.5px solid ${EA.ink}`, borderRadius: 24, padding: "18px 22px", display: "flex", flexDirection: "column", alignItems: "center", gap: 10, transform: "rotate(1.5deg)", boxShadow: `4px 4px 0 ${EA.pink}`, opacity: isMyTurn && !isFinished ? 0.6 : 1, minWidth: 130 }}>
                  <Avatar name={opPseudo} color={EA.pink} ring={EA.ink} size={56} />
                  <div style={{ fontFamily: "var(--font-display)", fontSize: 16, color: EA.ink, transform: "skewX(-4deg)" }}>{opPseudo.toUpperCase()}</div>
                  <div style={{ fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 800, color: "rgba(26,15,94,0.6)" }}>{myHits}/{17} reçus</div>
                </div>
              </div>
              <div style={{ background: EA.violetDeep, border: `2px solid ${EA.ink}`, borderRadius: 14, padding: "12px 16px" }}>
                <div style={{ fontFamily: "var(--font-sans)", fontSize: 10, fontWeight: 900, color: EA.pink, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 8 }}>Flotte ennemie</div>
                <FleetTracker ships={opShips} shotCells={myShotCells} accent={EA.pink} />
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
  const gridCellSize = Math.min(Math.floor((typeof window !== "undefined" ? window.innerWidth : 390) / 10) - 3, 36);

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
          <div style={{ flex: 1, position: "relative" }}>
            {meActive && <div style={{ position: "absolute", top: -10, left: -4, zIndex: 5, background: EA.butter, border: `2px solid ${EA.ink}`, padding: "2px 7px", borderRadius: 999, fontFamily: "var(--font-display)", fontSize: 9, color: EA.ink, transform: "rotate(-8deg)", boxShadow: `2px 2px 0 ${EA.ink}` }}>TON TOUR</div>}
            <div style={{ background: EA.pink, border: `2.5px solid ${EA.ink}`, borderRadius: 16, padding: "8px 10px", display: "flex", alignItems: "center", gap: 8, transform: "rotate(-1deg)", boxShadow: `3px 3px 0 ${EA.cyan}`, opacity: !meActive && !isFinished ? 0.65 : 1 }}>
              <Avatar name={myPseudo} color={EA.butter} ring={EA.ink} size={28} />
              <div>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 11, color: EA.white, transform: "skewX(-4deg)", lineHeight: 1 }}>{myPseudo.toUpperCase()}</div>
                <div style={{ fontFamily: "var(--font-sans)", fontSize: 10, fontWeight: 800, color: "rgba(255,255,255,0.7)", marginTop: 2 }}>Touché : {myHits}/17</div>
              </div>
            </div>
          </div>
          <div style={{ flexShrink: 0, background: EA.violetDeep, border: `2.5px solid ${EA.ink}`, borderRadius: 12, padding: "4px 8px", fontFamily: "var(--font-display)", fontSize: 13, color: EA.cyan, transform: "skewX(-8deg)", boxShadow: `2px 2px 0 ${EA.pink}` }}>
            ⚓
          </div>
          <div style={{ flex: 1, position: "relative" }}>
            {opActive && <div style={{ position: "absolute", top: -10, right: -4, zIndex: 5, background: EA.butter, border: `2px solid ${EA.ink}`, padding: "2px 7px", borderRadius: 999, fontFamily: "var(--font-display)", fontSize: 9, color: EA.ink, transform: "rotate(8deg)", boxShadow: `2px 2px 0 ${EA.ink}` }}>SON TOUR</div>}
            <div style={{ background: EA.cyan, border: `2.5px solid ${EA.ink}`, borderRadius: 16, padding: "8px 10px", display: "flex", alignItems: "center", gap: 8, transform: "rotate(1.5deg)", boxShadow: `3px 3px 0 ${EA.pink}`, opacity: !opActive && !isFinished ? 0.65 : 1 }}>
              <Avatar name={opPseudo} color={EA.pink} ring={EA.ink} size={28} />
              <div>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 11, color: EA.ink, transform: "skewX(-4deg)", lineHeight: 1 }}>{opPseudo.toUpperCase()}</div>
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
            <FleetTracker ships={opShips} shotCells={myShotCells} accent={EA.pink} />
          </div>
        </div>

        {/* Turn pill */}
        <div style={{ textAlign: "center", flexShrink: 0 }}>
          <TurnPill isMyTurn={isMyTurn} isFinished={isFinished} iWon={iWon} isDraw={isDraw} opPseudo={opPseudo} shotFeedback={shotFeedback} />
        </div>
      </div>
    </div>
  );
}

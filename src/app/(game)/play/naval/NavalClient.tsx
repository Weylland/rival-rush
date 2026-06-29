"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { submitNavalShot, submitNavalPlacement } from "./actions";
import { useOpponentWatcher } from "@/hooks/useOpponentWatcher";
import { useGameSounds } from "@/hooks/useGameSounds";
import { useGamePresence } from "@/hooks/useGamePresence";
import { resolveDuo } from "@/lib/players";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { useWindowWidth } from "@/hooks/useWindowWidth";
import { RulesButton } from "@/components/ui/rules-button";
import { Avatar } from "@/components/ui/avatar";
import { SvgBlob } from "@/components/ui/blob";
import { Star } from "@/components/ui/star";
import { RR } from "@/lib/design";
import { useGameOpponent } from "@/app/(game)/chat/ChatSystem";
import { PreventLeave } from "@/components/PreventLeave";
import type { NavalState, NavalShip, GameStatus } from "@/types/database";
import { computeMyGrid, computeAttackGrid } from "./components/grid";
import { NavalGrid, FleetTracker, TurnPill } from "./components/NavalGrid";
import { PlacementScreen } from "./components/PlacementScreen";

// ── Main ───────────────────────────────────────────────────────────────────────

interface Props {
  gameId: string; myId: string; p1Id: string; p2Id: string;
  p1Pseudo: string; p2Pseudo: string;
  p1AvatarUrl: string | null;
  p2AvatarUrl: string | null;
  p1AvatarColor: string | null;
  p2AvatarColor: string | null;
  myInitialShips: NavalShip[] | null;
  initialState: NavalState; initialStatus: GameStatus;
  initialWinnerId: string | null; initialTurn: string | null;
}

export function NavalClient({ gameId, myId, p1Id, p2Id, p1Pseudo, p2Pseudo, p1AvatarUrl, p2AvatarUrl, p1AvatarColor, p2AvatarColor, myInitialShips, initialState, initialStatus, initialWinnerId, initialTurn }: Props) {
  const router = useRouter();
  const desktop = useIsDesktop();
  const winWidth = useWindowWidth();
  const { play } = useGameSounds();
  const { opponentId, myPseudo, opPseudo, myAvatarUrl, opAvatarUrl, myAvatarColor, opAvatarColor } = resolveDuo({ myId, p1Id, p2Id, p1Pseudo, p2Pseudo, p1AvatarUrl, p2AvatarUrl, p1AvatarColor, p2AvatarColor });

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

  useOpponentWatcher({ gameId, opponentId, isFinishedRef });
  useGameOpponent(opponentId, opPseudo);
  useGamePresence({ gameId, myId, myPseudo, gameType: "naval", initialFinished: initialStatus === "finished", isFinishedRef });

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
      <div style={{ position: "relative", minHeight: "100dvh", background: RR.violet, overflow: "hidden", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 32 }}>
        <PreventLeave enabled={!isFinished} gameId={gameId} />
        <div aria-hidden style={{ position: "absolute", inset: 0, opacity: 0.3, backgroundImage: `radial-gradient(circle, rgba(0,212,232,0.5) 1.2px, transparent 1.6px) 0 0 / 16px 16px` }} />
        <SvgBlob color={RR.cyan} style={{ width: 480, height: 420, top: -180, left: -140, opacity: 0.55, animation: "rr-float 7s ease-in-out infinite" }} />
        <div style={{ position: "relative", zIndex: 5, display: "flex", flexDirection: "column", alignItems: "center", gap: 24, padding: "40px 24px" }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: desktop ? 48 : 28, color: RR.white, transform: "skewX(-8deg)", textShadow: `4px 4px 0 ${RR.cyan}`, lineHeight: 1 }}>FLOTTE PRÊTE ⚓</div>
          <div style={{
            background: "rgba(26,15,94,0.7)", border: `2px solid ${RR.cyan}`,
            borderRadius: 999, padding: "10px 28px",
            display: "inline-flex", alignItems: "center", gap: 12,
            boxShadow: `3px 3px 0 ${RR.cyan}`,
            animation: "rr-pulse 1.2s ease-in-out infinite",
          }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: RR.cyan, boxShadow: `0 0 10px ${RR.cyan}`, flexShrink: 0 }} />
            <span style={{ fontFamily: "var(--font-sans)", fontSize: 15, fontWeight: 800, color: RR.white }}>En attente de {opPseudo}...</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 900, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: 1.2 }}>Ta flotte (lecture seule)</div>
            <NavalGrid cells={waitGrid} cellSize={waitCellSize} interactive={false} shotCells={new Set()} accentColor={RR.cyan} />
          </div>
        </div>
      </div>
    );
  }

  // ── Shared decorations ───────────────────────────────────────────────────────
  const Bg = (
    <>
      <div aria-hidden style={{ position: "absolute", inset: 0, opacity: 0.3, backgroundImage: `radial-gradient(circle, rgba(0,212,232,0.5) 1.2px, transparent 1.6px) 0 0 / 16px 16px` }} />
      <SvgBlob color={RR.cyan}   style={{ width: 480, height: 420, top: -180, left: -140, opacity: 0.55, animation: "rr-float 7s ease-in-out infinite" }} />
      <SvgBlob color={RR.butter} style={{ width: 400, height: 360, bottom: -160, right: -120, opacity: 0.45, animation: "rr-float 9s ease-in-out infinite reverse" }} path="M 50 30 Q 90 5 140 30 Q 195 50 180 110 Q 175 175 110 175 Q 30 180 25 120 Q 10 60 50 30 Z" />
      <Star color={RR.butter} size={32} style={{ top: "8%",  right: "5%",  transform: "rotate(12deg)", animation: "rr-spin-slow 10s linear infinite" }} />
      <Star color={RR.white}  size={18} style={{ bottom: "12%", left: "4%", animation: "rr-float 6s ease-in-out infinite" }} />
      <Star color={RR.cyan}   size={14} style={{ top: "45%", right: "3%",  animation: "rr-spin-slow 14s linear infinite reverse" }} />
    </>
  );

  // ── DESKTOP ──────────────────────────────────────────────────────────────────
  if (desktop) {
    return (
      <div style={{ position: "relative", minHeight: "100dvh", background: RR.violet, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <RulesButton gameType="naval" />
        <PreventLeave enabled={!isFinished} gameId={gameId} />
        {Bg}

        <div style={{ position: "relative", zIndex: 5, flex: 1, maxWidth: 1500, width: "100%", margin: "0 auto", display: "flex", flexDirection: "column" }}>
          {/* Title */}
          <div style={{ textAlign: "center", padding: "20px 40px 0" }}>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 900, color: RR.cyan, textTransform: "uppercase", letterSpacing: 2 }}>JEU EN COURS</div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 52, color: RR.white, transform: "skewX(-8deg)", textShadow: `4px 4px 0 ${RR.cyan}`, lineHeight: 1, marginTop: 4 }}>BATAILLE NAVALE ⚓</div>
          </div>

          {/* Main layout */}
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 40, padding: "16px 40px 32px" }}>

            {/* Me */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
              <div style={{ position: "relative" }}>
                {isMyTurn && !isFinished && <div style={{ position: "absolute", top: -14, left: -10, zIndex: 5, background: RR.butter, border: `2px solid ${RR.ink}`, padding: "3px 12px", borderRadius: 999, fontFamily: "var(--font-display)", fontSize: 13, color: RR.ink, letterSpacing: 0.6, transform: "rotate(-8deg)", boxShadow: `2px 2px 0 ${RR.ink}`, whiteSpace: "nowrap" }}>TON TOUR</div>}
                <div style={{ background: RR.pink, border: `2.5px solid ${RR.ink}`, borderRadius: 24, padding: "20px 28px", display: "flex", flexDirection: "column", alignItems: "center", gap: 12, transform: "rotate(-1deg)", boxShadow: `4px 4px 0 ${RR.cyan}`, opacity: !isMyTurn && !isFinished ? 0.6 : 1, minWidth: 160 }}>
                  <Avatar name={myPseudo} color={myAvatarColor ?? RR.butter} ring={RR.ink} size={72} src={myAvatarUrl} />
                  <div style={{ fontFamily: "var(--font-display)", fontSize: 18, color: RR.white, transform: "skewX(-4deg)" }}>{myPseudo.toUpperCase()}</div>
                  <div style={{ fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 800, color: "rgba(255,255,255,0.7)" }}>{opHits}/{17} reçus</div>
                </div>
              </div>
              <div style={{ background: RR.violetDeep, border: `2px solid ${RR.ink}`, borderRadius: 14, padding: "14px 18px" }}>
                <div style={{ fontFamily: "var(--font-sans)", fontSize: 10, fontWeight: 900, color: RR.cyan, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 10 }}>Ma flotte</div>
                <FleetTracker ships={myShips} shotCells={opShotCells} accent={RR.cyan} />
              </div>
            </div>

            {/* Grids */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 24 }}>
              <div style={{ display: "flex", gap: 28 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "center" }}>
                  <div style={{ fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 900, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: 1.2 }}>Ma flotte</div>
                  <NavalGrid cells={myGrid} cellSize={44} interactive={false} shotCells={opShotCells} accentColor={RR.cyan} />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "center" }}>
                  <div style={{ fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 900, color: isMyTurn ? RR.pink : "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: 1.2 }}>
                    {isMyTurn ? "🎯 ATTAQUE !" : "Zone ennemie"}
                  </div>
                  <NavalGrid cells={attackGrid} cellSize={44} interactive={isMyTurn && !shooting} shotCells={myShotCells} onShoot={handleShoot} accentColor={RR.pink} />
                </div>
              </div>
              <TurnPill isMyTurn={isMyTurn} isFinished={isFinished} iWon={iWon} isDraw={isDraw} opPseudo={opPseudo} shotFeedback={shotFeedback} />
            </div>

            {/* Opponent */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
              <div style={{ position: "relative" }}>
                {!isMyTurn && !isFinished && <div style={{ position: "absolute", top: -14, right: -10, zIndex: 5, background: RR.butter, border: `2px solid ${RR.ink}`, padding: "3px 12px", borderRadius: 999, fontFamily: "var(--font-display)", fontSize: 13, color: RR.ink, letterSpacing: 0.6, transform: "rotate(8deg)", boxShadow: `2px 2px 0 ${RR.ink}`, whiteSpace: "nowrap" }}>SON TOUR</div>}
                <div style={{ background: RR.cyan, border: `2.5px solid ${RR.ink}`, borderRadius: 24, padding: "20px 28px", display: "flex", flexDirection: "column", alignItems: "center", gap: 12, transform: "rotate(1.5deg)", boxShadow: `4px 4px 0 ${RR.pink}`, opacity: isMyTurn && !isFinished ? 0.6 : 1, minWidth: 160 }}>
                  <Avatar name={opPseudo} color={opAvatarColor ?? RR.pink} ring={RR.ink} size={72} src={opAvatarUrl} />
                  <div style={{ fontFamily: "var(--font-display)", fontSize: 18, color: RR.ink, transform: "skewX(-4deg)" }}>{opPseudo.toUpperCase()}</div>
                  <div style={{ fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 800, color: "rgba(26,15,94,0.6)" }}>{myHits}/{17} reçus</div>
                </div>
              </div>
              <div style={{ background: RR.violetDeep, border: `2px solid ${RR.ink}`, borderRadius: 14, padding: "14px 18px" }}>
                <div style={{ fontFamily: "var(--font-sans)", fontSize: 10, fontWeight: 900, color: RR.pink, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 10 }}>Flotte ennemie</div>
                <FleetTracker ships={isFinished ? revealedOpShips : opponentSunkShips} shotCells={myShotCells} accent={RR.pink} />
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
    <div style={{ position: "relative", minHeight: "100dvh", background: RR.violet, overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <RulesButton gameType="naval" />
      <div aria-hidden style={{ position: "absolute", inset: 0, opacity: 0.3, backgroundImage: `radial-gradient(circle, rgba(0,212,232,0.5) 1.2px, transparent 1.6px) 0 0 / 16px 16px` }} />
      <SvgBlob color={RR.cyan}   style={{ width: 200, height: 180, top: -80, left: -60, opacity: 0.7, animation: "rr-float 4s ease-in-out infinite" }} />
      <SvgBlob color={RR.butter} style={{ width: 180, height: 160, bottom: -60, right: -40, opacity: 0.6, animation: "rr-float 6s ease-in-out infinite reverse" }} path="M 50 30 Q 90 5 140 30 Q 195 50 180 110 Q 175 175 110 175 Q 30 180 25 120 Q 10 60 50 30 Z" />
      <Star color={RR.butter} size={16} style={{ top: "28%", right: 14, transform: "rotate(15deg)", animation: "rr-spin-slow 10s linear infinite" }} />

      <div style={{ position: "relative", zIndex: 5, flex: 1, display: "flex", flexDirection: "column", padding: "12px 12px 20px", gap: 10 }}>

        {/* Title */}
        <div style={{ textAlign: "center", flexShrink: 0 }}>
          <div style={{ fontFamily: "var(--font-sans)", fontSize: 10, fontWeight: 900, color: RR.cyan, textTransform: "uppercase", letterSpacing: 2 }}>JEU EN COURS</div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 26, color: RR.white, transform: "skewX(-8deg)", textShadow: `3px 3px 0 ${RR.cyan}`, lineHeight: 1 }}>BATAILLE NAVALE ⚓</div>
        </div>

        {/* Player headers */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexShrink: 0 }}>
          <div style={{ flex: 1, minWidth: 0, position: "relative" }}>
            {meActive && <div style={{ position: "absolute", top: -10, left: -4, zIndex: 5, background: RR.butter, border: `2px solid ${RR.ink}`, padding: "2px 7px", borderRadius: 999, fontFamily: "var(--font-display)", fontSize: 9, color: RR.ink, transform: "rotate(-8deg)", boxShadow: `2px 2px 0 ${RR.ink}` }}>TON TOUR</div>}
            <div style={{ background: RR.pink, border: `2.5px solid ${RR.ink}`, borderRadius: 16, padding: "8px 10px", display: "flex", alignItems: "center", gap: 8, transform: "rotate(-1deg)", boxShadow: `3px 3px 0 ${RR.cyan}`, opacity: !meActive && !isFinished ? 0.65 : 1 }}>
              <Avatar name={myPseudo} color={myAvatarColor ?? RR.butter} ring={RR.ink} size={28} src={myAvatarUrl} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 11, color: RR.white, transform: "skewX(-4deg)", lineHeight: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{myPseudo.toUpperCase()}</div>
                <div style={{ fontFamily: "var(--font-sans)", fontSize: 10, fontWeight: 800, color: "rgba(255,255,255,0.7)", marginTop: 2 }}>Touché : {myHits}/17</div>
              </div>
            </div>
          </div>
          <div style={{ flexShrink: 0, background: RR.violetDeep, border: `2.5px solid ${RR.ink}`, borderRadius: 12, padding: "4px 8px", fontFamily: "var(--font-display)", fontSize: 13, color: RR.cyan, transform: "skewX(-8deg)", boxShadow: `2px 2px 0 ${RR.pink}` }}>
            ⚓
          </div>
          <div style={{ flex: 1, minWidth: 0, position: "relative" }}>
            {opActive && <div style={{ position: "absolute", top: -10, right: -4, zIndex: 5, background: RR.butter, border: `2px solid ${RR.ink}`, padding: "2px 7px", borderRadius: 999, fontFamily: "var(--font-display)", fontSize: 9, color: RR.ink, transform: "rotate(8deg)", boxShadow: `2px 2px 0 ${RR.ink}` }}>SON TOUR</div>}
            <div style={{ background: RR.cyan, border: `2.5px solid ${RR.ink}`, borderRadius: 16, padding: "8px 10px", display: "flex", alignItems: "center", gap: 8, transform: "rotate(1.5deg)", boxShadow: `3px 3px 0 ${RR.pink}`, opacity: !opActive && !isFinished ? 0.65 : 1 }}>
              <Avatar name={opPseudo} color={opAvatarColor ?? RR.pink} ring={RR.ink} size={28} src={opAvatarUrl} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 11, color: RR.ink, transform: "skewX(-4deg)", lineHeight: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{opPseudo.toUpperCase()}</div>
                <div style={{ fontFamily: "var(--font-sans)", fontSize: 10, fontWeight: 800, color: "rgba(26,15,94,0.6)", marginTop: 2 }}>Touché : {opHits}/17</div>
              </div>
            </div>
          </div>
        </div>

        {/* Tab switcher */}
        <div style={{
          display: "flex", gap: 4, flexShrink: 0,
          background: "rgba(26,15,94,0.55)", border: `2px solid ${RR.ink}`,
          borderRadius: 999, padding: 3,
        }}>
          {([
            { id: "fleet"  as const, label: "🛡 MA FLOTTE" },
            { id: "attack" as const, label: isMyTurn ? "🎯 ATTAQUE !" : "⚔ ZONE ENNEMIE" },
          ]).map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
              flex: 1, textAlign: "center",
              background: activeTab === t.id ? (t.id === "attack" ? RR.pink : RR.cyan) : "transparent",
              border: "none", borderRadius: 999, padding: "8px 0",
              fontFamily: "var(--font-display)", fontSize: 13,
              color: activeTab === t.id ? (t.id === "attack" ? RR.white : RR.ink) : "rgba(255,255,255,0.55)",
              cursor: "pointer",
              boxShadow: activeTab === t.id ? `2px 2px 0 ${RR.ink}` : "none",
            }}>{t.label}</button>
          ))}
        </div>

        {/* Active grid */}
        <div style={{ flex: 1, display: "flex", alignItems: "flex-start", justifyContent: "center", flexShrink: 0 }}>
          {activeTab === "fleet"
            ? <NavalGrid cells={myGrid} cellSize={gridCellSize} interactive={false} shotCells={opShotCells} accentColor={RR.cyan} />
            : <NavalGrid cells={attackGrid} cellSize={gridCellSize} interactive={isMyTurn && !shooting} shotCells={myShotCells} onShoot={handleShoot} accentColor={RR.pink} />
          }
        </div>

        {/* Fleet tracker */}
        <div style={{
          background: RR.violetDeep, border: `2px solid ${RR.ink}`,
          borderRadius: 14, padding: "10px 14px", flexShrink: 0,
          display: "flex", gap: 16,
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: 9, fontWeight: 900, color: RR.cyan, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 6 }}>Ma flotte</div>
            <FleetTracker ships={myShips} shotCells={opShotCells} accent={RR.cyan} />
          </div>
          <div style={{ width: 1, background: "rgba(255,255,255,0.08)" }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: 9, fontWeight: 900, color: RR.pink, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 6 }}>Flotte ennemie</div>
            <FleetTracker ships={isFinished ? revealedOpShips : opponentSunkShips} shotCells={myShotCells} accent={RR.pink} />
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

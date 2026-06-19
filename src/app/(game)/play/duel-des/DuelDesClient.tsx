"use client";

import { useEffect, useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { rollDice } from "./actions";
import { EA } from "@/lib/design";
import { Avatar } from "@/components/ui/avatar";
import { SvgBlob } from "@/components/ui/blob";
import { Star } from "@/components/ui/star";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { RulesButton } from "@/components/ui/rules-button";
import { useGameOpponent } from "@/app/(game)/chat/ChatSystem";
import type { DuelDesState } from "@/types/database";

// ── Dé CSS ────────────────────────────────────────────────────────────────────

const DOT_CELLS: Record<number, number[]> = {
  1: [4],
  2: [2, 6],
  3: [2, 4, 6],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 3, 6, 2, 5, 8],
};

function DieFace({ value, size, bg, dotColor, glowColor, shaking = false }: {
  value: number | null;
  size: number;
  bg: string;
  dotColor: string;
  glowColor?: string;
  shaking?: boolean;
}) {
  const dots    = value !== null ? (DOT_CELLS[value] ?? []) : [];
  const dotSize = Math.round(size * 0.17);
  const radius  = Math.round(size * 0.16);

  return (
    <div style={{
      width: size, height: size,
      background: bg,
      border: `3.5px solid ${EA.ink}`,
      borderRadius: radius,
      boxShadow: glowColor
        ? `5px 5px 0 ${EA.ink}, 0 0 18px ${glowColor}99, 0 0 40px ${glowColor}44`
        : `5px 5px 0 ${EA.ink}`,
      display: "grid",
      gridTemplateColumns: "repeat(3, 1fr)",
      gridTemplateRows: "repeat(3, 1fr)",
      padding: `${Math.round(size * 0.1)}px`,
      animation: shaking ? "die-shake 0.45s cubic-bezier(0.36,0.07,0.19,0.97)" : undefined,
      willChange: "transform",
    }}>
      {value === null ? (
        <div style={{
          gridColumn: "1 / -1", gridRow: "1 / -1",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: "var(--font-display)", fontSize: Math.round(size * 0.44),
          color: dotColor, opacity: 0.45,
        }}>?</div>
      ) : (
        Array.from({ length: 9 }, (_, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
            {dots.includes(i) && (
              <div style={{
                width: dotSize, height: dotSize,
                borderRadius: "50%",
                background: dotColor,
                boxShadow: `0 0 5px 1px ${dotColor}66`,
              }} />
            )}
          </div>
        ))
      )}
    </div>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  gameId: string;
  myId: string;
  p1Id: string;
  p2Id: string;
  p1Pseudo: string;
  p2Pseudo: string;
  p1AvatarUrl: string | null;
  p2AvatarUrl: string | null;
  initialState: DuelDesState;
  initialStatus: "waiting" | "playing" | "finished";
  initialWinnerId: string | null;
}

interface RevealData {
  myRoll: number;
  opRoll: number;
  roundWinner: string | null;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function DuelDesClient({
  gameId, myId, p1Id, p2Id,
  p1Pseudo, p2Pseudo, p1AvatarUrl, p2AvatarUrl,
  initialState, initialStatus, initialWinnerId,
}: Props) {
  const router   = useRouter();
  const desktop  = useIsDesktop();
  const [rolling, startRoll] = useTransition();

  const [gameState,  setGameState]  = useState<DuelDesState>(initialState);
  const [gameStatus, setGameStatus] = useState(initialStatus);
  const [winnerId,   setWinnerId]   = useState(initialWinnerId);

  const [myShaking, setMyShaking]   = useState(false);
  const [opShaking, setOpShaking]   = useState(false);
  const [revealData, setRevealData] = useState<RevealData | null>(null);
  const [showReveal, setShowReveal] = useState(false);
  const revealedUpToRef             = useRef(-1);

  const opponentId    = myId === p1Id ? p2Id : p1Id;
  const opponentPseudo = myId === p1Id ? p2Pseudo : p1Pseudo;
  const myPseudo      = myId === p1Id ? p1Pseudo : p2Pseudo;
  const myAvatarUrl   = myId === p1Id ? p1AvatarUrl : p2AvatarUrl;
  const opAvatarUrl   = myId === p1Id ? p2AvatarUrl : p1AvatarUrl;

  useGameOpponent(opponentId, opponentPseudo);

  // ── Realtime ──────────────────────────────────────────────────────────────

  useEffect(() => {
    const supabase = createClient();
    const ch = supabase
      .channel(`duel-des-${gameId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "games", filter: `id=eq.${gameId}` }, (payload) => {
        const g = payload.new as { state: DuelDesState; status: string; winner_id: string | null };
        setGameState(g.state);
        setGameStatus(g.status as "waiting" | "playing" | "finished");
        setWinnerId(g.winner_id);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [gameId]);

  // ── Redirect on finish ────────────────────────────────────────────────────

  useEffect(() => {
    if (gameStatus === "finished") {
      const t = setTimeout(() => router.replace(`/result?game_id=${gameId}`), 4000);
      return () => clearTimeout(t);
    }
  }, [gameStatus, gameId, router]);

  // ── Reveal animation between rounds ──────────────────────────────────────

  useEffect(() => {
    const prevIdx = gameState.current_round - 2;
    if (prevIdx < 0 || prevIdx <= revealedUpToRef.current) return;
    const prev = gameState.rounds[prevIdx];
    if (!prev || Object.keys(prev.rolls).length < 2) return;

    const myR = prev.rolls[myId];
    const opR = prev.rolls[opponentId];
    if (myR === undefined || opR === undefined) return;

    revealedUpToRef.current = prevIdx;
    setRevealData({ myRoll: myR, opRoll: opR, roundWinner: prev.winner_id });
    setOpShaking(true);
    setShowReveal(true);
    const t1 = setTimeout(() => setOpShaking(false), 500);
    const t2 = setTimeout(() => setShowReveal(false), 2600);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [gameState.current_round, gameState.rounds, myId, opponentId]);

  // ── Current round data ────────────────────────────────────────────────────

  const roundIdx     = gameState.current_round - 1;
  const currentRound = gameState.rounds[roundIdx] ?? { rolls: {}, winner_id: null };
  const myRoll       = currentRound.rolls[myId]       ?? null;
  const opRolled     = currentRound.rolls[opponentId] !== undefined;
  const bothRolled   = myRoll !== null && opRolled;
  const opRevealedRoll = bothRolled ? currentRound.rolls[opponentId] : null;

  const myScore = gameState.scores[myId]       ?? 0;
  const opScore = gameState.scores[opponentId] ?? 0;

  const d = desktop;
  const diceSize = d ? 120 : 88;

  const myWin  = winnerId === myId;
  const opWin  = winnerId === opponentId;

  // ── Helpers ───────────────────────────────────────────────────────────────

  function handleRoll() {
    if (myRoll !== null || rolling) return;
    setMyShaking(true);
    setTimeout(() => setMyShaking(false), 500);
    startRoll(async () => { await rollDice(gameId); });
  }

  function roundOutcome(rw: string | null): { label: string; color: string } {
    if (!rw) return { label: "ÉGALITÉ", color: EA.butter };
    return rw === myId
      ? { label: "TU GAGNES", color: EA.cyan }
      : { label: "TU PERDS",  color: EA.pink };
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: "100dvh", background: EA.violet, position: "relative", overflow: "hidden" }}>

      {/* Background */}
      <div aria-hidden style={{
        position: "absolute", inset: 0, opacity: 0.18,
        backgroundImage: "radial-gradient(circle, rgba(0,212,232,0.7) 1.5px, transparent 2px)",
        backgroundSize: "18px 18px",
      }} />
      <SvgBlob color={EA.cyan}   style={{ width: d ? 480 : 280, height: d ? 420 : 250, top: -140, left: -100, opacity: 0.55, animation: "ea-float 6s ease-in-out infinite" }} />
      <SvgBlob color={EA.pink}   style={{ width: d ? 440 : 260, height: d ? 380 : 220, bottom: -120, right: -100, opacity: 0.55, animation: "ea-float 8s ease-in-out infinite reverse" }} />
      <SvgBlob color={EA.butter} style={{ width: d ? 340 : 200, height: d ? 300 : 180, top: "40%", right: -100, opacity: 0.4, animation: "ea-float 10s ease-in-out infinite" }} />

      <Star color={EA.butter} size={d ? 32 : 22} style={{ top: "8%", right: "8%", animation: "ea-spin-slow 8s linear infinite" }} />
      <Star color={EA.cyan}   size={d ? 20 : 14} style={{ bottom: "20%", left: "6%", animation: "ea-float 5s ease-in-out infinite" }} />
      <Star color={EA.pink}   size={d ? 14 : 11} style={{ top: "28%", left: "5%", animation: "ea-spin-slow 12s linear infinite reverse" }} />

      {/* ── Reveal overlay ── */}
      {showReveal && revealData && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 100,
          background: "rgba(15,8,60,0.88)",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          gap: d ? 24 : 18,
          animation: "dd-fadein 0.2s ease",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: d ? 40 : 28 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
              <span style={{ fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 900, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: 1.5 }}>TOI</span>
              <DieFace
                value={revealData.myRoll}
                size={diceSize}
                bg={EA.butter}
                dotColor={EA.ink}
                glowColor={revealData.roundWinner === myId ? EA.cyan : revealData.roundWinner === opponentId ? EA.pink : undefined}
              />
              <span style={{ fontFamily: "var(--font-display)", fontSize: d ? 40 : 30, color: EA.butter }}>{revealData.myRoll}</span>
            </div>

            <div style={{
              fontFamily: "var(--font-display)", fontSize: d ? 28 : 22, color: EA.pink,
              border: `2.5px solid ${EA.pink}`, borderRadius: "50%",
              width: d ? 56 : 42, height: d ? 56 : 42,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: "rgba(255,30,140,0.12)",
            }}>VS</div>

            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
              <span style={{ fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 900, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: 1.5 }}>{opponentPseudo.toUpperCase()}</span>
              <DieFace
                value={revealData.opRoll}
                size={diceSize}
                bg={EA.pink}
                dotColor={EA.white}
                glowColor={revealData.roundWinner === opponentId ? EA.cyan : revealData.roundWinner === myId ? EA.pink : undefined}
              />
              <span style={{ fontFamily: "var(--font-display)", fontSize: d ? 40 : 30, color: EA.pink }}>{revealData.opRoll}</span>
            </div>
          </div>

          <div style={{
            fontFamily: "var(--font-display)", fontSize: d ? 34 : 24,
            color: roundOutcome(revealData.roundWinner).color,
            transform: "skewX(-6deg)",
            animation: "dd-pop 0.3s cubic-bezier(0.175,0.885,0.32,1.6)",
          }}>
            {roundOutcome(revealData.roundWinner).label} !
          </div>
        </div>
      )}

      {/* ── Content ── */}
      <div style={{
        position: "relative", zIndex: 10,
        maxWidth: d ? 560 : "100%",
        margin: "0 auto",
        padding: d ? "40px 40px 80px" : "28px 20px 80px",
        display: "flex", flexDirection: "column", alignItems: "center", gap: 0,
      }}>

        {/* Header — avatars + scores */}
        <div style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
          marginBottom: d ? 28 : 20,
        }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
            <Avatar name={myPseudo} src={myAvatarUrl} color={EA.butter} ring={EA.cyan} size={d ? 48 : 38} />
            <span style={{ fontFamily: "var(--font-display)", fontSize: d ? 14 : 11, color: EA.white, transform: "skewX(-3deg)", display: "inline-block", maxWidth: d ? 160 : 90, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{myPseudo.toUpperCase()}</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <div style={{ display: "flex", alignItems: "center", gap: d ? 16 : 12 }}>
              <span style={{ fontFamily: "var(--font-display)", fontSize: d ? 52 : 38, color: EA.cyan, textShadow: `3px 3px 0 ${EA.ink}` }}>{myScore}</span>
              <span style={{ fontFamily: "var(--font-display)", fontSize: d ? 24 : 18, color: "rgba(255,255,255,0.3)" }}>—</span>
              <span style={{ fontFamily: "var(--font-display)", fontSize: d ? 52 : 38, color: EA.pink, textShadow: `3px 3px 0 ${EA.ink}` }}>{opScore}</span>
            </div>
            <span style={{ fontFamily: "var(--font-sans)", fontSize: d ? 11 : 9, fontWeight: 900, color: "rgba(255,255,255,0.4)", letterSpacing: 2, textTransform: "uppercase" }}>
              MANCHE {gameState.current_round} — 3 VICTOIRES POUR GAGNER
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
            <Avatar name={opponentPseudo} src={opAvatarUrl} color={EA.pink} ring={EA.butter} size={d ? 48 : 38} />
            <span style={{ fontFamily: "var(--font-display)", fontSize: d ? 14 : 11, color: "rgba(255,255,255,0.6)", transform: "skewX(-3deg)", display: "inline-block", maxWidth: d ? 160 : 90, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{opponentPseudo.toUpperCase()}</span>
          </div>
        </div>

        {/* Score dots */}
        <div style={{ display: "flex", alignItems: "center", gap: d ? 14 : 10, marginBottom: d ? 32 : 24 }}>
          {Array.from({ length: 3 }, (_, i) => (
            <div key={`my-${i}`} style={{
              width: d ? 16 : 12, height: d ? 16 : 12, borderRadius: "50%",
              background: i < myScore ? EA.cyan : "rgba(255,255,255,0.15)",
              border: `2px solid ${i < myScore ? EA.cyan : "rgba(255,255,255,0.2)"}`,
              boxShadow: i < myScore ? `0 0 8px ${EA.cyan}` : "none",
              transition: "all 0.3s",
            }} />
          ))}
          <div style={{ fontFamily: "var(--font-display)", fontSize: d ? 20 : 15, color: "rgba(255,255,255,0.2)", margin: `0 ${d ? 6 : 4}px` }}>VS</div>
          {Array.from({ length: 3 }, (_, i) => (
            <div key={`op-${i}`} style={{
              width: d ? 16 : 12, height: d ? 16 : 12, borderRadius: "50%",
              background: i < opScore ? EA.pink : "rgba(255,255,255,0.15)",
              border: `2px solid ${i < opScore ? EA.pink : "rgba(255,255,255,0.2)"}`,
              boxShadow: i < opScore ? `0 0 8px ${EA.pink}` : "none",
              transition: "all 0.3s",
            }} />
          ))}
        </div>

        {/* Dés + bouton */}
        <div style={{
          width: "100%",
          background: EA.violetDeep, border: `2.5px solid ${EA.ink}`,
          borderRadius: d ? 28 : 20,
          padding: d ? "36px 32px" : "28px 20px",
          boxShadow: `5px 5px 0 ${EA.ink}`,
          display: "flex", flexDirection: "column", alignItems: "center", gap: d ? 28 : 22,
          marginBottom: d ? 20 : 16,
        }}>
          {/* Les deux dés */}
          <div style={{ display: "flex", alignItems: "center", gap: d ? 40 : 28 }}>
            {/* Mon dé */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: d ? 12 : 8 }}>
              <span style={{ fontFamily: "var(--font-sans)", fontSize: 10, fontWeight: 900, color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: 1.5 }}>MOI</span>
              <DieFace
                value={myRoll}
                size={diceSize}
                bg={myRoll !== null ? EA.butter : EA.violetMid}
                dotColor={myRoll !== null ? EA.ink : "rgba(255,255,255,0.5)"}
                glowColor={myRoll !== null ? EA.butter : undefined}
                shaking={myShaking}
              />
              {myRoll !== null && (
                <span style={{ fontFamily: "var(--font-display)", fontSize: d ? 32 : 24, color: EA.butter }}>{myRoll}</span>
              )}
            </div>

            {/* VS central */}
            <div style={{
              display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
            }}>
              <div style={{
                fontFamily: "var(--font-display)", fontSize: d ? 24 : 18, color: EA.pink,
                border: `2.5px solid ${EA.pink}`, borderRadius: "50%",
                width: d ? 52 : 40, height: d ? 52 : 40,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: "rgba(255,30,140,0.1)",
                transform: "skewX(-4deg)",
              }}>VS</div>
            </div>

            {/* Dé adversaire */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: d ? 12 : 8 }}>
              <span style={{ fontFamily: "var(--font-sans)", fontSize: 10, fontWeight: 900, color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: 1.5 }}>ADV.</span>
              <DieFace
                value={opRevealedRoll}
                size={diceSize}
                bg={opRevealedRoll !== null ? EA.pink : opRolled ? "#3d1f3d" : EA.violetMid}
                dotColor={opRevealedRoll !== null ? EA.white : "rgba(255,255,255,0.5)"}
                glowColor={opRevealedRoll !== null ? EA.pink : opRolled ? "rgba(200,100,200,0.6)" : undefined}
                shaking={opShaking}
              />
              {opRolled && !bothRolled && (
                <span style={{ fontFamily: "var(--font-sans)", fontSize: d ? 12 : 10, fontWeight: 800, color: "rgba(255,255,255,0.45)" }}>✓ A lancé</span>
              )}
              {opRevealedRoll !== null && (
                <span style={{ fontFamily: "var(--font-display)", fontSize: d ? 32 : 24, color: EA.pink }}>{opRevealedRoll}</span>
              )}
            </div>
          </div>

          {/* Bouton ou statut */}
          {gameStatus !== "finished" && (
            myRoll === null ? (
              <button
                onClick={handleRoll}
                disabled={rolling}
                style={{
                  background: EA.cyan, border: `3px solid ${EA.ink}`,
                  borderRadius: d ? 20 : 16,
                  padding: d ? "20px 60px" : "16px 44px",
                  fontFamily: "var(--font-display)", fontSize: d ? 28 : 22,
                  color: EA.ink, transform: "skewX(-6deg)",
                  boxShadow: rolling ? "none" : `5px 5px 0 ${EA.ink}`,
                  cursor: rolling ? "wait" : "pointer",
                  opacity: rolling ? 0.7 : 1,
                  transition: "transform 0.1s, box-shadow 0.1s",
                }}
                onMouseDown={e => { if (!rolling) { e.currentTarget.style.transform = "skewX(-6deg) translate(5px,5px)"; e.currentTarget.style.boxShadow = "none"; }}}
                onMouseUp={e => { if (!rolling) { e.currentTarget.style.transform = "skewX(-6deg)"; e.currentTarget.style.boxShadow = `5px 5px 0 ${EA.ink}`; }}}
              >
                <span style={{ display: "inline-block", transform: "skewX(6deg)" }}>
                  🎲 LANCER !
                </span>
              </button>
            ) : !opRolled ? (
              <div style={{
                fontFamily: "var(--font-sans)", fontSize: d ? 14 : 12, fontWeight: 800,
                color: "rgba(255,255,255,0.55)", textAlign: "center",
                display: "flex", alignItems: "center", gap: 8,
              }}>
                <span style={{ animation: "ea-pulse 1s ease-in-out infinite" }}>⏳</span>
                {opponentPseudo} lance…
              </div>
            ) : null
          )}

          {gameStatus === "finished" && (
            <div style={{
              fontFamily: "var(--font-display)", fontSize: d ? 22 : 17,
              color: myWin ? EA.cyan : opWin ? EA.pink : EA.butter,
              transform: "skewX(-4deg)", textAlign: "center",
            }}>
              {myWin ? "🏆 VICTOIRE !" : opWin ? "💀 DÉFAITE !" : "🤝 ÉGALITÉ !"}
            </div>
          )}
        </div>

        {/* Historique des manches */}
        {gameState.rounds.filter((r, i) => i < roundIdx && Object.keys(r.rolls).length === 2).length > 0 && (
          <div style={{
            width: "100%", background: EA.violetDeep, border: `2px solid rgba(255,255,255,0.08)`,
            borderRadius: d ? 20 : 16, padding: d ? "16px 20px" : "12px 16px",
          }}>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: d ? 11 : 9, fontWeight: 900, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: 2, marginBottom: d ? 12 : 8 }}>
              Manches précédentes
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: d ? 6 : 5 }}>
              {gameState.rounds
                .filter((r, i) => i < roundIdx && Object.keys(r.rolls).length === 2)
                .map((r, i) => {
                  const myR  = r.rolls[myId];
                  const opR  = r.rolls[opponentId];
                  const rWin = r.winner_id === myId;
                  const rLose = r.winner_id === opponentId;
                  const rTie = !r.winner_id;
                  return (
                    <div key={i} style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: d ? "6px 0" : "4px 0",
                      borderBottom: i < gameState.rounds.filter((rr, ii) => ii < roundIdx && Object.keys(rr.rolls).length === 2).length - 1
                        ? "1px solid rgba(255,255,255,0.06)" : "none",
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontFamily: "var(--font-display)", fontSize: d ? 12 : 9, color: "rgba(255,255,255,0.25)", width: 20 }}>M{i + 1}</span>
                        <span style={{ fontSize: d ? 22 : 16 }}>🎲</span>
                        <span style={{ fontFamily: "var(--font-display)", fontSize: d ? 22 : 17, color: EA.butter }}>{myR ?? "?"}</span>
                      </div>
                      <span style={{ fontFamily: "var(--font-display)", fontSize: d ? 13 : 10, color: rTie ? EA.butter : rWin ? EA.cyan : EA.pink, letterSpacing: 1 }}>
                        {rTie ? "ÉGAL" : rWin ? "WIN" : "LOSE"}
                      </span>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontFamily: "var(--font-display)", fontSize: d ? 22 : 17, color: EA.pink }}>{opR ?? "?"}</span>
                        <span style={{ fontSize: d ? 22 : 16 }}>🎲</span>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}
      </div>

      <RulesButton gameType="duel-des" />

      <style>{`
        @keyframes die-shake {
          0%,100% { transform: translate(0,0) rotate(0deg); }
          15%      { transform: translate(-6px,3px) rotate(-8deg); }
          30%      { transform: translate(6px,-3px) rotate(8deg); }
          45%      { transform: translate(-4px,5px) rotate(-5deg); }
          60%      { transform: translate(5px,-4px) rotate(6deg); }
          75%      { transform: translate(-3px,2px) rotate(-3deg); }
          90%      { transform: translate(2px,-2px) rotate(2deg); }
        }
        @keyframes dd-fadein {
          from { opacity: 0; } to { opacity: 1; }
        }
        @keyframes dd-pop {
          0%   { transform: skewX(-6deg) scale(0.5); opacity: 0; }
          60%  { transform: skewX(-6deg) scale(1.15); opacity: 1; }
          100% { transform: skewX(-6deg) scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

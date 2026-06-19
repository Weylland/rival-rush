"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { EA } from "@/lib/design";
import { useGameOpponent } from "@/app/(game)/chat/ChatSystem";
import { PreventLeave } from "@/components/PreventLeave";
import { setReflexeReady, submitReflexeTap } from "./actions";
import { useOpponentWatcher } from "@/hooks/useOpponentWatcher";
import { useGameSounds } from "@/hooks/useGameSounds";
import { useGamePresence } from "@/hooks/useGamePresence";
import { resolveDuo } from "@/lib/players";
import { ScorePanel } from "./components/ScorePanel";
import { RulesButton } from "@/components/ui/rules-button";
import type { TapState, GameStatus } from "@/types/database";

interface Props {
  gameId: string;
  myId: string;
  p1Id: string;
  p2Id: string;
  p1Pseudo: string;
  p2Pseudo: string;
  p1AvatarUrl: string | null;
  p2AvatarUrl: string | null;
  initialState: TapState;
  initialStatus: GameStatus;
  initialWinnerId: string | null;
}

export function ReflexeClient({
  gameId, myId, p1Id, p2Id, p1Pseudo, p2Pseudo, p1AvatarUrl, p2AvatarUrl,
  initialState, initialStatus, initialWinnerId,
}: Props) {
  const router = useRouter();
  const { opponentId, myPseudo, opPseudo, myAvatarUrl, opAvatarUrl } = resolveDuo({ myId, p1Id, p2Id, p1Pseudo, p2Pseudo, p1AvatarUrl, p2AvatarUrl });

  const [tapState, setTapState] = useState<TapState>(initialState);
  const [gameStatus, setGameStatus] = useState<GameStatus>(initialStatus);
  const [winnerId, setWinnerId] = useState<string | null>(initialWinnerId);
  const [signalFired, setSignalFired] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [lastRound, setLastRound] = useState<{ winner_id: string; reaction_ms: number } | null>(null);

  const isFinishedRef = useRef(initialStatus === "finished");
  const tapStateRef = useRef(initialState);

  useEffect(() => { isFinishedRef.current = gameStatus === "finished"; }, [gameStatus]);
  useOpponentWatcher({ gameId, opponentId, isFinishedRef });
  useGameOpponent(opponentId, opPseudo);
  useGamePresence({ gameId, myId, myPseudo, gameType: "reflexe", initialFinished: initialStatus === "finished", isFinishedRef });
  const { play } = useGameSounds();

  // Realtime
  useEffect(() => {
    const supabase = createClient();
    const sub = supabase
      .channel(`reflexe-${gameId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "games", filter: `id=eq.${gameId}` }, (payload) => {
        const updated = payload.new as { state: unknown; status: string; winner_id: string | null };
        const newState = updated.state as TapState;
        const prevRoundsCount = tapStateRef.current.rounds.length;
        tapStateRef.current = newState;
        setTapState(newState);
        setGameStatus(updated.status as GameStatus);
        setWinnerId(updated.winner_id);
        if (updated.status === "finished") {
          isFinishedRef.current = true;
          play(updated.winner_id === myId ? "win" : "lose");
          setTimeout(() => router.replace(`/result?game_id=${gameId}`), 4000);
        } else if (newState.rounds.length > prevRoundsCount) {
          const completed = newState.rounds[newState.rounds.length - 1];
          setLastRound({ winner_id: completed.winner_id, reaction_ms: completed.reaction_ms });
          play(completed.winner_id === myId ? "reveal" : "move");
          setTimeout(() => setLastRound(null), 3000);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [gameId, router]); // eslint-disable-line react-hooks/exhaustive-deps

  // Signal detection
  useEffect(() => {
    setSignalFired(false);
    if (tapState.phase !== "armed" || !tapState.signal_at) return;
    const remaining = new Date(tapState.signal_at).getTime() - Date.now();
    if (remaining <= 0) { setSignalFired(true); return; }
    const timer = setTimeout(() => {
      setSignalFired(true);
      play("tick");
    }, remaining);
    return () => clearTimeout(timer);
  }, [tapState.phase, tapState.signal_at]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleReady() {
    if (tapState.phase !== "idle" || gameStatus === "finished" || submitting) return;
    setSubmitting(true);
    try { await setReflexeReady(gameId); } finally { setSubmitting(false); }
  }

  async function handleTap() {
    if (tapState.phase !== "armed" || gameStatus === "finished" || submitting) return;
    setSubmitting(true);
    try { await submitReflexeTap(gameId); } finally { setSubmitting(false); }
  }

  const isFinished = gameStatus === "finished";
  const myScore = tapState.scores?.[myId] ?? 0;
  const opScore = tapState.scores?.[opponentId] ?? 0;
  const ready = tapState.ready ?? [];
  const iAmReady = ready.includes(myId);
  const opIsReady = ready.includes(opponentId);
  const isSignal = tapState.phase === "armed" && signalFired;
  const isArmed = tapState.phase === "armed" && !signalFired;

  function handleZoneClick() {
    if (isFinished) return;
    if (tapState.phase === "idle" && !iAmReady) { handleReady(); return; }
    if (isSignal || isArmed) { handleTap(); return; }
  }

  // ── Background selon la phase ──────────────────────────────────────────────
  const bgColor = isSignal
    ? "#00c44f"                                             // vert explosion
    : isArmed
      ? "#1a0a00"                                           // noir danger
      : EA.violet;                                          // normal

  const dotColor = isSignal
    ? "rgba(0,255,80,0.3)"
    : isArmed
      ? "rgba(255,100,30,0.2)"
      : "rgba(0,212,232,0.15)";

  return (
    <div style={{
      position: "fixed", inset: 0,
      background: bgColor,
      display: "flex", flexDirection: "column",
      overflow: "hidden",
      transition: "background 0.25s cubic-bezier(0.4,0,0.2,1)",
    }}>
      <RulesButton gameType="reflexe" />

      {/* Dot background */}
      <div aria-hidden style={{
        position: "absolute", inset: 0,
        backgroundImage: `radial-gradient(circle, ${dotColor} 1.2px, transparent 1.6px)`,
        backgroundSize: "16px 16px",
        pointerEvents: "none", zIndex: 0,
        transition: "all 0.3s",
      }} />

      {/* ARMED: danger aura blob */}
      {isArmed && (
        <div aria-hidden style={{
          position: "absolute", inset: 0,
          background: "radial-gradient(ellipse at 50% 60%, rgba(255,80,0,0.18) 0%, transparent 70%)",
          animation: "reflexe-throb 1.2s ease-in-out infinite",
          zIndex: 1,
        }} />
      )}

      {/* SIGNAL: flash explosion */}
      {isSignal && (
        <div aria-hidden style={{
          position: "absolute", inset: 0,
          background: "radial-gradient(ellipse at 50% 50%, rgba(0,255,120,0.35) 0%, transparent 60%)",
          animation: "reflexe-flash 0.4s ease-out",
          zIndex: 1,
        }} />
      )}

      {/* ── HEADER ── */}
      <div style={{
        position: "relative", zIndex: 5,
        display: "flex", alignItems: "center", gap: 10,
        padding: "20px 16px 0",
        maxWidth: 520, width: "100%", margin: "0 auto",
        flexShrink: 0,
      }}>
        {/* Moi */}
        <ScorePanel pseudo={myPseudo} avatarUrl={myAvatarUrl} score={myScore} side="left" isArmed={isArmed} showReady={tapState.phase === "idle" && iAmReady} />

        {/* Round counter */}
        <div style={{ flexShrink: 0, textAlign: "center" }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 9, color: isArmed ? "rgba(255,150,80,0.6)" : "rgba(255,255,255,0.35)", lineHeight: 1, letterSpacing: 1, transition: "color 0.3s" }}>MANCHE</div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 30, color: isSignal ? EA.ink : isArmed ? "#ff9940" : EA.cyan, lineHeight: 1, transition: "color 0.3s" }}>{tapState.current_round}</div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 9, color: isArmed ? "rgba(255,150,80,0.4)" : "rgba(255,255,255,0.2)", letterSpacing: 0.5, transition: "color 0.3s" }}>/ 3</div>
        </div>

        {/* Adversaire */}
        <ScorePanel pseudo={opPseudo} avatarUrl={opAvatarUrl} score={opScore} side="right" isArmed={isArmed} showReady={tapState.phase === "idle" && opIsReady} />
      </div>

      {/* ── LAST ROUND RESULT ── */}
      <div style={{
        position: "relative", zIndex: 5,
        padding: "12px 16px 0",
        maxWidth: 520, width: "100%", margin: "0 auto",
        flexShrink: 0,
        minHeight: 42,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {lastRound && (
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 10,
            background: EA.violetDeep,
            border: `2.5px solid ${lastRound.winner_id === myId ? EA.cyan : EA.pink}`,
            borderRadius: 999, padding: "7px 18px",
            boxShadow: `3px 3px 0 ${lastRound.winner_id === myId ? EA.cyan : EA.pink}`,
            animation: "reflexe-pop 0.3s cubic-bezier(0.175,0.885,0.32,1.6)",
          }}>
            <span style={{ fontFamily: "var(--font-display)", fontSize: 14, color: lastRound.winner_id === myId ? EA.cyan : EA.pink, transform: "skewX(-4deg)" }}>
              {lastRound.winner_id === myId ? "🏆 MANCHE GAGNÉE" : `${opPseudo.toUpperCase()} GAGNE`}
            </span>
            <span style={{ fontFamily: "var(--font-display)", fontSize: 14, color: EA.butter }}>
              {lastRound.reaction_ms}ms
            </span>
          </div>
        )}
      </div>

      {/* ── ZONE PRINCIPALE ── */}
      <div style={{
        position: "relative", zIndex: 5,
        flex: 1, display: "flex", flexDirection: "column",
        padding: "16px 16px 24px",
        maxWidth: 520, width: "100%", margin: "0 auto",
        minHeight: 0,
      }}>
        <div
          onClick={handleZoneClick}
          style={{
            flex: 1,
            borderRadius: 32,
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            gap: 20,
            userSelect: "none",
            cursor: (tapState.phase === "idle" && !iAmReady) || isSignal || isArmed ? "pointer" : "default",
            transition: "background 0.25s, border-color 0.25s, box-shadow 0.25s",
            position: "relative",
            overflow: "hidden",
            ...getZoneStyle(tapState.phase, iAmReady, isArmed, isSignal, isFinished),
          }}
        >
          {/* Inner glow pour armed */}
          {isArmed && (
            <div aria-hidden style={{
              position: "absolute", inset: 0,
              background: "radial-gradient(ellipse at 50% 50%, rgba(255,100,0,0.15) 0%, transparent 65%)",
              animation: "reflexe-throb 1.2s ease-in-out infinite",
            }} />
          )}

          {/* Content */}
          {isFinished && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, position: "relative", zIndex: 2 }}>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 44, color: winnerId === myId ? EA.cyan : EA.pink, transform: "skewX(-6deg)", textShadow: `4px 4px 0 ${EA.ink}`, textAlign: "center" }}>
                {winnerId === myId ? "🏆 VICTOIRE !" : "💀 DÉFAITE !"}
              </div>
              <div style={{ fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.4)" }}>
                Redirection...
              </div>
            </div>
          )}

          {!isFinished && tapState.phase === "idle" && !iAmReady && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, position: "relative", zIndex: 2 }}>
              <div style={{ fontSize: 60, lineHeight: 1 }}>✋</div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 40, color: EA.ink, transform: "skewX(-6deg)", textShadow: `3px 3px 0 rgba(0,0,0,0.15)` }}>
                {submitting ? "..." : "PRÊT ?"}
              </div>
              <div style={{ fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 800, color: "rgba(26,15,94,0.6)", textAlign: "center", padding: "0 24px" }}>
                {opIsReady ? `⚡ ${opPseudo} attend déjà !` : "Appuie quand tu es prêt"}
              </div>
            </div>
          )}

          {!isFinished && tapState.phase === "idle" && iAmReady && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, position: "relative", zIndex: 2 }}>
              <div style={{ fontSize: 48, lineHeight: 1, animation: "reflexe-throb 1.4s ease-in-out infinite" }}>⏳</div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 26, color: EA.white, transform: "skewX(-4deg)" }}>
                En attente…
              </div>
              <div style={{ fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.45)", textAlign: "center" }}>
                {`${opPseudo} n'est pas encore prêt`}
              </div>
            </div>
          )}

          {!isFinished && isArmed && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 24, position: "relative", zIndex: 2 }}>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 34, color: "#ff9940", letterSpacing: 6, transform: "skewX(-4deg)", textShadow: `2px 2px 0 rgba(0,0,0,0.5)`, animation: "reflexe-throb 1s ease-in-out infinite" }}>
                ATTENTION…
              </div>
              <div style={{ display: "flex", gap: 16 }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{
                    width: 18, height: 18, borderRadius: "50%",
                    background: "#ff9940",
                    boxShadow: `0 0 12px #ff9940`,
                    animation: `reflexe-dot ${0.6 + i * 0.15}s ease-in-out infinite`,
                  }} />
                ))}
              </div>
              <div style={{ fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 800, color: "rgba(255,150,80,0.5)", textTransform: "uppercase", letterSpacing: 2 }}>
                Prépare ton doigt…
              </div>
            </div>
          )}

          {!isFinished && isSignal && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, position: "relative", zIndex: 2 }}>
              <div style={{
                fontFamily: "var(--font-display)", fontSize: 72, color: EA.ink,
                transform: "skewX(-8deg)", lineHeight: 1,
                textShadow: `4px 4px 0 rgba(0,0,0,0.2)`,
                animation: "reflexe-pop 0.2s cubic-bezier(0.175,0.885,0.32,1.6)",
              }}>
                {submitting ? "..." : "TAPEZ !"}
              </div>
              {!submitting && (
                <div style={{ fontSize: 36, animation: "reflexe-pop 0.2s cubic-bezier(0.175,0.885,0.32,1.6) 0.05s both" }}>
                  ⚡
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer règle */}
        {!isFinished && (
          <div style={{ textAlign: "center", marginTop: 14, flexShrink: 0 }}>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 700, color: isArmed ? "rgba(255,150,80,0.4)" : isSignal ? "rgba(0,50,20,0.5)" : "rgba(255,255,255,0.25)", textTransform: "uppercase", letterSpacing: 1, transition: "color 0.3s" }}>
              Premier à 2 manches gagne
            </div>
          </div>
        )}
      </div>

      <PreventLeave enabled={!isFinished} gameId={gameId} />

      <style>{`
        @keyframes reflexe-throb {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.65; transform: scale(0.97); }
        }
        @keyframes reflexe-dot {
          0%, 100% { transform: translateY(0) scale(1); opacity: 1; }
          50% { transform: translateY(-10px) scale(1.3); opacity: 0.5; }
        }
        @keyframes reflexe-pop {
          0% { transform: skewX(-8deg) scale(0.6); opacity: 0; }
          100% { transform: skewX(-8deg) scale(1); opacity: 1; }
        }
        @keyframes reflexe-flash {
          0% { opacity: 1; }
          100% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}

// ── Zone style helper ──────────────────────────────────────────────────────────

function getZoneStyle(
  phase: string,
  iAmReady: boolean,
  isArmed: boolean,
  isSignal: boolean,
  isFinished: boolean,
): React.CSSProperties {
  if (isFinished) return {
    background: EA.violetDeep,
    border: `2.5px solid ${EA.ink}`,
    boxShadow: `4px 4px 0 ${EA.ink}`,
  };
  if (phase === "idle" && !iAmReady) return {
    background: EA.butter,
    border: `3px solid ${EA.ink}`,
    boxShadow: `8px 8px 0 ${EA.cyan}, 8px 8px 0 1px ${EA.ink}`,
  };
  if (phase === "idle" && iAmReady) return {
    background: "rgba(255,255,255,0.05)",
    border: `2.5px dashed rgba(255,255,255,0.2)`,
  };
  if (isArmed) return {
    background: "rgba(255,70,0,0.08)",
    border: `2.5px solid rgba(255,120,40,0.5)`,
    boxShadow: `0 0 32px rgba(255,80,0,0.15)`,
  };
  // Signal
  return {
    background: "rgba(0,180,60,0.18)",
    border: `3px solid ${EA.ink}`,
    boxShadow: `0 0 48px rgba(0,255,100,0.4), 8px 8px 0 rgba(0,0,0,0.3)`,
  };
}

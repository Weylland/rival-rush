"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { EA } from "@/lib/design";
import { Avatar } from "@/components/ui/avatar";
import { Star } from "@/components/ui/star";
import { SvgBlob } from "@/components/ui/blob";
import { setReflexeReady, submitReflexeTap } from "./actions";
import { useOpponentWatcher } from "@/hooks/useOpponentWatcher";
import { useGameSounds } from "@/hooks/useGameSounds";
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
  const opponentId = myId === p1Id ? p2Id : p1Id;
  const myPseudo = myId === p1Id ? p1Pseudo : p2Pseudo;
  const opPseudo = myId === p1Id ? p2Pseudo : p1Pseudo;
  const myAvatarUrl = myId === p1Id ? p1AvatarUrl : p2AvatarUrl;
  const opAvatarUrl = myId === p1Id ? p2AvatarUrl : p1AvatarUrl;

  const [tapState, setTapState] = useState<TapState>(initialState);
  const [gameStatus, setGameStatus] = useState<GameStatus>(initialStatus);
  const [winnerId, setWinnerId] = useState<string | null>(initialWinnerId);
  const [signalFired, setSignalFired] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [lastRound, setLastRound] = useState<{ winner_id: string; reaction_ms: number } | null>(null);
  const isFinishedRef = useRef(initialStatus === "finished");
  const forfeitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tapStateRef = useRef(initialState);

  useEffect(() => { isFinishedRef.current = gameStatus === "finished"; }, [gameStatus]);
  useOpponentWatcher({ gameId, opponentId, isFinishedRef });
  const { play } = useGameSounds();

  // Presence heartbeat
  useEffect(() => {
    if (forfeitTimerRef.current) { clearTimeout(forfeitTimerRef.current); forfeitTimerRef.current = null; }
    const supabase = createClient();
    const updatePresence = () =>
      supabase.from("presence").upsert({ player_id: myId, pseudo: myPseudo, status: "in-game", game_type: "reflexe", updated_at: new Date().toISOString() }).then(() => {});
    updatePresence();
    const heartbeat = setInterval(updatePresence, 30_000);
    return () => {
      clearInterval(heartbeat);
      supabase.from("presence").update({ status: "online", updated_at: new Date().toISOString() }).eq("player_id", myId).then(() => {});
      if (!isFinishedRef.current) {
        forfeitTimerRef.current = setTimeout(() => {
          forfeitTimerRef.current = null;
          fetch("/api/forfeit", { method: "POST", body: JSON.stringify({ gameId }), headers: { "Content-Type": "application/json" }, keepalive: true });
        }, 500);
      }
    };
  }, [myId, gameId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (initialStatus === "finished") {
      isFinishedRef.current = true;
      router.push(`/result?game_id=${gameId}`);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
          setTimeout(() => router.push(`/result?game_id=${gameId}`), 2000);
        } else if (newState.rounds.length > prevRoundsCount) {
          const completed = newState.rounds[newState.rounds.length - 1];
          setLastRound({ winner_id: completed.winner_id, reaction_ms: completed.reaction_ms });
          play(completed.winner_id === myId ? "reveal" : "move");
          setTimeout(() => setLastRound(null), 2500);
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

  // ── Tap zone content ─────────────────────────────────────────────────────────

  function tapZoneContent() {
    if (isFinished) {
      return (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 38, color: winnerId === myId ? EA.cyan : EA.pink, transform: "skewX(-6deg)", textShadow: `3px 3px 0 ${EA.ink}`, textAlign: "center" }}>
            {winnerId === myId ? "🏆 VICTOIRE !" : "💀 DÉFAITE !"}
          </div>
          <div style={{ fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.4)" }}>
            Redirection en cours...
          </div>
        </div>
      );
    }

    // Idle — attente que les deux soient prêts
    if (tapState.phase === "idle") {
      if (!iAmReady) {
        return (
          <>
            <div style={{ fontSize: 48, lineHeight: 1 }}>✋</div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 36, color: EA.ink, transform: "skewX(-6deg)" }}>
              {submitting ? "..." : "PRÊT ?"}
            </div>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 700, color: "rgba(26,15,94,0.55)", textTransform: "uppercase", letterSpacing: 1, textAlign: "center", padding: "0 16px" }}>
              {opIsReady ? `${opPseudo} attend...` : "Appuie quand tu es prêt"}
            </div>
          </>
        );
      }
      // Je suis prêt, attente de l'adversaire
      return (
        <>
          <div style={{ fontSize: 40, lineHeight: 1 }}>⏳</div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 24, color: EA.white, transform: "skewX(-4deg)" }}>
            En attente...
          </div>
          <div style={{ fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.5)", textAlign: "center" }}>
            {`${opPseudo} n'est pas encore prêt`}
          </div>
        </>
      );
    }

    // Armed — tension
    if (isArmed) {
      return (
        <>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 26, color: "rgba(255,165,80,0.95)", letterSpacing: 4, transform: "skewX(-4deg)" }}>
            ATTENTION...
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{
                width: 16, height: 16, borderRadius: "50%",
                background: "rgba(255,165,80,0.85)",
                animation: `ea-pulse ${0.5 + i * 0.2}s ease-in-out infinite`,
              }} />
            ))}
          </div>
        </>
      );
    }

    // Signal !
    return (
      <>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 60, color: EA.ink, transform: "skewX(-8deg)", textShadow: `3px 3px 0 ${EA.violetDeep}`, lineHeight: 1 }}>
          {submitting ? "..." : "TAPEZ !"}
        </div>
        {!submitting && (
          <div style={{ fontFamily: "var(--font-sans)", fontSize: 18, fontWeight: 900, color: EA.ink, letterSpacing: 4 }}>
            ⚡ ⚡ ⚡
          </div>
        )}
      </>
    );
  }

  // ── Tap zone style par phase ─────────────────────────────────────────────────

  function tapZoneStyle(): React.CSSProperties {
    if (isFinished) return {
      background: EA.violetDeep, border: `2.5px solid ${EA.ink}`,
      boxShadow: `4px 4px 0 ${EA.ink}`,
    };
    if (tapState.phase === "idle" && !iAmReady) return {
      background: EA.butter, border: `2.5px solid ${EA.ink}`,
      boxShadow: `6px 6px 0 ${EA.cyan}, 6px 6px 0 1px ${EA.ink}`,
      cursor: submitting ? "wait" : "pointer",
    };
    if (tapState.phase === "idle" && iAmReady) return {
      background: EA.violetDeep, border: `2.5px dashed rgba(255,255,255,0.25)`,
      boxShadow: "none",
    };
    if (isArmed) return {
      background: "rgba(255,90,30,0.13)", border: `2.5px solid rgba(255,150,60,0.7)`,
      boxShadow: `6px 6px 0 rgba(255,90,30,0.5)`,
      animation: "ea-pulse 0.9s ease-in-out infinite",
    };
    // Signal
    return {
      background: EA.cyan, border: `3px solid ${EA.ink}`,
      boxShadow: `8px 8px 0 ${EA.pink}, 8px 8px 0 1px ${EA.ink}`,
      animation: "ea-pulse 0.35s ease-in-out infinite",
      cursor: "pointer",
    };
  }

  function handleZoneClick() {
    if (isFinished) return;
    if (tapState.phase === "idle" && !iAmReady) { handleReady(); return; }
    if (isSignal || isArmed) { handleTap(); return; }
  }

  return (
    <div style={{ position: "relative", minHeight: "100dvh", background: EA.violet, overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <RulesButton gameType="reflexe" />

      <div aria-hidden style={{ position: "absolute", inset: 0, opacity: 0.3, backgroundImage: `radial-gradient(circle, rgba(0,212,232,0.5) 1.2px, transparent 1.6px) 0 0 / 16px 16px` }} />
      <SvgBlob color={EA.pink} style={{ width: 300, height: 260, top: -100, left: -80, opacity: 0.7, animation: "ea-float 5s ease-in-out infinite" }} />
      <SvgBlob color={EA.cyan} style={{ width: 280, height: 240, bottom: -90, right: -70, opacity: 0.65, animation: "ea-float 7s ease-in-out infinite reverse" }} path="M 50 30 Q 90 5 140 30 Q 195 50 180 110 Q 175 175 110 175 Q 30 180 25 120 Q 10 60 50 30 Z" />
      <Star color={EA.butter} size={22} style={{ top: "8%", right: "8%", animation: "ea-spin-slow 10s linear infinite" }} />
      <Star color={EA.white} size={15} style={{ bottom: "15%", left: "6%", animation: "ea-float 6s ease-in-out infinite" }} />
      <Star color={EA.pink} size={12} style={{ top: "40%", right: "4%", animation: "ea-spin-slow 14s linear infinite reverse" }} />

      <div style={{ position: "relative", zIndex: 5, flex: 1, display: "flex", flexDirection: "column", maxWidth: 520, width: "100%", margin: "0 auto", padding: "20px 16px 24px", gap: 14 }}>

        {/* Title */}
        <div style={{ textAlign: "center", flexShrink: 0 }}>
          <div style={{ fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 900, color: EA.cyan, textTransform: "uppercase", letterSpacing: 2 }}>JEU EN COURS</div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 40, color: EA.white, transform: "skewX(-8deg)", textShadow: `3px 3px 0 ${EA.pink}`, lineHeight: 1 }}>RÉFLEXE !</div>
        </div>

        {/* Player cards avec indicateur "prêt" */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          {/* Me */}
          <div style={{ flex: 1, position: "relative" }}>
            {tapState.phase === "idle" && iAmReady && (
              <div style={{ position: "absolute", top: -10, left: -6, zIndex: 5, background: EA.cyan, border: `2px solid ${EA.ink}`, padding: "2px 8px", borderRadius: 999, fontFamily: "var(--font-display)", fontSize: 9, color: EA.ink, letterSpacing: 0.6, transform: "rotate(-8deg)", boxShadow: `2px 2px 0 ${EA.ink}` }}>✓ PRÊT</div>
            )}
            <div style={{ background: EA.pink, border: `2.5px solid ${EA.ink}`, borderRadius: 18, padding: "10px 12px", display: "flex", alignItems: "center", gap: 8, transform: "rotate(-0.8deg)", boxShadow: `3px 3px 0 ${EA.cyan}` }}>
              <Avatar name={myPseudo} color={EA.butter} ring={EA.ink} size={32} src={myAvatarUrl} />
              <div>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 11, color: EA.white, transform: "skewX(-4deg)", lineHeight: 1 }}>{myPseudo.toUpperCase()}</div>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 28, color: EA.white, lineHeight: 1.1 }}>{myScore}</div>
              </div>
            </div>
          </div>

          {/* Round */}
          <div style={{ flexShrink: 0, textAlign: "center" }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 10, color: "rgba(255,255,255,0.4)", lineHeight: 1 }}>MANCHE</div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 28, color: EA.cyan, lineHeight: 1 }}>{tapState.current_round}</div>
          </div>

          {/* Opponent */}
          <div style={{ flex: 1, position: "relative" }}>
            {tapState.phase === "idle" && opIsReady && (
              <div style={{ position: "absolute", top: -10, right: -6, zIndex: 5, background: EA.cyan, border: `2px solid ${EA.ink}`, padding: "2px 8px", borderRadius: 999, fontFamily: "var(--font-display)", fontSize: 9, color: EA.ink, letterSpacing: 0.6, transform: "rotate(8deg)", boxShadow: `2px 2px 0 ${EA.ink}` }}>✓ PRÊT</div>
            )}
            <div style={{ background: EA.cyan, border: `2.5px solid ${EA.ink}`, borderRadius: 18, padding: "10px 12px", display: "flex", alignItems: "center", gap: 8, transform: "rotate(0.8deg)", boxShadow: `3px 3px 0 ${EA.pink}`, justifyContent: "flex-end" }}>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 11, color: EA.ink, transform: "skewX(-4deg)", lineHeight: 1 }}>{opPseudo.toUpperCase()}</div>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 28, color: EA.ink, lineHeight: 1.1 }}>{opScore}</div>
              </div>
              <Avatar name={opPseudo} color={EA.pink} ring={EA.ink} size={32} src={opAvatarUrl} />
            </div>
          </div>
        </div>

        {/* Last round result */}
        {lastRound && (
          <div style={{ textAlign: "center", flexShrink: 0 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: EA.violetDeep, border: `2px solid ${lastRound.winner_id === myId ? EA.cyan : EA.pink}`, borderRadius: 999, padding: "6px 16px", boxShadow: `2px 2px 0 ${lastRound.winner_id === myId ? EA.cyan : EA.pink}` }}>
              <span style={{ fontFamily: "var(--font-display)", fontSize: 13, color: lastRound.winner_id === myId ? EA.cyan : EA.pink, transform: "skewX(-4deg)" }}>
                {lastRound.winner_id === myId ? "🏆 MANCHE GAGNÉE" : `${opPseudo.toUpperCase()} GAGNE`}
              </span>
              <span style={{ fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 900, color: EA.butter }}>
                {lastRound.reaction_ms}ms
              </span>
            </div>
          </div>
        )}

        {/* TAP ZONE */}
        <div style={{ flex: 1, display: "flex", alignItems: "stretch", minHeight: 180 }}>
          <div
            onClick={handleZoneClick}
            style={{
              width: "100%",
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14,
              borderRadius: 28,
              userSelect: "none",
              transition: "background 0.2s, border-color 0.2s, box-shadow 0.2s",
              ...tapZoneStyle(),
            }}
          >
            {tapZoneContent()}
          </div>
        </div>

        {/* Footer */}
        {!isFinished && (
          <div style={{ textAlign: "center", flexShrink: 0 }}>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.28)", textTransform: "uppercase", letterSpacing: 1 }}>
              Premier à 2 manches gagne
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

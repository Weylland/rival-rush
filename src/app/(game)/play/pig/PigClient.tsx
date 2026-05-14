"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { EA } from "@/lib/design";
import { Avatar } from "@/components/ui/avatar";
import { GameChat } from "@/components/GameChat";
import { PreventLeave } from "@/components/PreventLeave";
import { RulesButton } from "@/components/ui/rules-button";
import { rollPig, holdPig } from "./actions";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { useOpponentWatcher } from "@/hooks/useOpponentWatcher";
import { useGameSounds } from "@/hooks/useGameSounds";
import type { PigState, GameStatus } from "@/types/database";

const WIN_SCORE = 100;

// ── Dot positions for each die face ──────────────────────────────────────────
// Grid 3×3, positions: [col, row] 0-indexed
const DOT_POSITIONS: Record<number, [number, number][]> = {
  1: [[1, 1]],
  2: [[0, 0], [2, 2]],
  3: [[0, 0], [1, 1], [2, 2]],
  4: [[0, 0], [2, 0], [0, 2], [2, 2]],
  5: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]],
  6: [[0, 0], [2, 0], [0, 1], [2, 1], [0, 2], [2, 2]],
};

function DieFace({ value, size = 110, bust = false, rolling = false }: {
  value: number | null;
  size?: number;
  bust?: boolean;
  rolling?: boolean;
}) {
  const dots = value ? DOT_POSITIONS[value] ?? [] : [];
  const dotSize = size * 0.14;
  const padding = size * 0.12;
  const inner = size - padding * 2;
  const cell = inner / 3;

  return (
    <div style={{
      width: size, height: size,
      background: bust ? EA.pink : EA.white,
      border: `3px solid ${EA.ink}`,
      borderRadius: size * 0.18,
      boxShadow: bust
        ? `5px 5px 0 ${EA.ink}`
        : `5px 5px 0 ${EA.cyan}, 5px 5px 0 1px ${EA.ink}`,
      position: "relative",
      flexShrink: 0,
      transition: "background 0.2s, box-shadow 0.2s",
      animation: rolling ? "pig-roll 0.35s ease-in-out" : "none",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      {value === null ? (
        <div style={{
          fontSize: size * 0.35, lineHeight: 1,
          opacity: 0.25,
        }}>🎲</div>
      ) : (
        <div style={{
          position: "relative",
          width: inner, height: inner,
        }}>
          {dots.map(([col, row], i) => (
            <div key={i} style={{
              position: "absolute",
              left: col * cell + cell / 2 - dotSize / 2,
              top: row * cell + cell / 2 - dotSize / 2,
              width: dotSize, height: dotSize,
              borderRadius: "50%",
              background: bust ? EA.white : EA.ink,
              transition: "background 0.2s",
            }} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Score bar ─────────────────────────────────────────────────────────────────

function ScoreBar({ score, pseudo, avatarUrl, isMe, isActive, color }: {
  score: number;
  pseudo: string;
  avatarUrl: string | null;
  isMe: boolean;
  isActive: boolean;
  color: string;
}) {
  const pct = Math.min(100, (score / WIN_SCORE) * 100);
  return (
    <div style={{
      flex: 1,
      display: "flex", flexDirection: "column", gap: 6,
      opacity: isActive ? 1 : 0.6,
      transition: "opacity 0.3s",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{
          padding: 2, borderRadius: "50%",
          border: isActive ? `3px solid ${color}` : `3px solid transparent`,
          boxShadow: isActive ? `0 0 10px ${color}` : "none",
          transition: "border 0.3s, box-shadow 0.3s",
        }}>
          <Avatar name={pseudo} src={avatarUrl} color={color} ring={EA.ink} size={36} />
        </div>
        <div style={{
          fontFamily: "var(--font-display)", fontSize: 12, color: EA.white,
          transform: "skewX(-4deg)",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          maxWidth: 80,
        }}>{pseudo.toUpperCase()}</div>
        <div style={{
          fontFamily: "var(--font-display)", fontSize: 22, color: EA.white,
          transform: "skewX(-6deg)",
          textShadow: `2px 2px 0 ${color}`,
          marginLeft: "auto", flexShrink: 0,
        }}>{score}</div>
      </div>
      {/* Progress bar */}
      <div style={{
        height: 10, borderRadius: 999,
        background: "rgba(255,255,255,0.1)",
        border: `1.5px solid rgba(255,255,255,0.15)`,
        overflow: "hidden",
      }}>
        <div style={{
          height: "100%", width: `${pct}%`,
          background: color,
          borderRadius: 999,
          transition: "width 0.4s ease",
          boxShadow: `0 0 6px ${color}`,
        }} />
      </div>
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  gameId: string;
  myId: string;
  p1Id: string;
  p2Id: string;
  p1Pseudo: string;
  p2Pseudo: string;
  p1AvatarUrl: string | null;
  p2AvatarUrl: string | null;
  initialState: PigState;
  initialStatus: GameStatus;
  initialCurrentTurn: string | null;
  initialWinnerId: string | null;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function PigClient({
  gameId, myId, p1Id, p2Id,
  p1Pseudo, p2Pseudo, p1AvatarUrl, p2AvatarUrl,
  initialState, initialStatus, initialCurrentTurn, initialWinnerId,
}: Props) {
  const router = useRouter();
  const desktop = useIsDesktop();
  const opponentId = myId === p1Id ? p2Id : p1Id;
  const myPseudo = myId === p1Id ? p1Pseudo : p2Pseudo;
  const opPseudo = myId === p1Id ? p2Pseudo : p1Pseudo;
  const myAvatarUrl = myId === p1Id ? p1AvatarUrl : p2AvatarUrl;
  const opAvatarUrl = myId === p1Id ? p2AvatarUrl : p1AvatarUrl;

  const [scores, setScores] = useState<Record<string, number>>(
    initialState.scores ?? { [myId]: 0, [opponentId]: 0 }
  );
  const [turnTotal, setTurnTotal] = useState(initialState.turn_total ?? 0);
  const [lastRoll, setLastRoll] = useState<number | null>(initialState.last_roll ?? null);
  const [currentTurn, setCurrentTurn] = useState<string | null>(initialCurrentTurn);
  const [gameStatus, setGameStatus] = useState<GameStatus>(initialStatus);
  const [submitting, setSubmitting] = useState(false);
  const [rolling, setRolling] = useState(false);
  const [bust, setBust] = useState(false);
  const [bustMsg, setBustMsg] = useState<string | null>(null);

  const isMyTurn = currentTurn === myId;
  const isFinished = gameStatus === "finished";
  const myScore = scores[myId] ?? 0;
  const opScore = scores[opponentId] ?? 0;

  const isFinishedRef = useRef<boolean>(initialStatus === "finished");
  const forfeitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { isFinishedRef.current = isFinished; }, [isFinished]);

  useOpponentWatcher({ gameId, opponentId, isFinishedRef });
  const { play } = useGameSounds();

  // Presence + forfeit
  useEffect(() => {
    if (forfeitTimerRef.current) { clearTimeout(forfeitTimerRef.current); forfeitTimerRef.current = null; }
    const supabase = createClient();
    const updatePresence = () =>
      supabase.from("presence").upsert({
        player_id: myId, pseudo: myPseudo,
        status: "in-game", game_type: "pig",
        updated_at: new Date().toISOString(),
      }).then(() => {});
    updatePresence();
    const heartbeat = setInterval(updatePresence, 30_000);
    return () => {
      clearInterval(heartbeat);
      supabase.from("presence").update({ status: "online", updated_at: new Date().toISOString() }).eq("player_id", myId).then(() => {});
      if (!isFinishedRef.current) {
        forfeitTimerRef.current = setTimeout(() => {
          forfeitTimerRef.current = null;
          fetch("/api/forfeit", { method: "POST", body: JSON.stringify({ gameId }), headers: { "Content-Type": "application/json" }, keepalive: true });
        }, 5000);
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
      .channel(`pig-${gameId}`)
      .on("postgres_changes", {
        event: "UPDATE", schema: "public", table: "games",
        filter: `id=eq.${gameId}`,
      }, (payload) => {
        const updated = payload.new as { state: unknown; status: string; current_turn: string | null; winner_id: string | null };
        const raw = updated.state as Record<string, unknown>;
        const newState: PigState = raw && "scores" in raw
          ? (raw as unknown as PigState)
          : { scores: {}, turn_total: 0, last_roll: null };

        const newRoll = newState.last_roll;
        const prevRoll = lastRoll;

        // Detect bust from opponent's perspective
        if (newRoll === 1 && updated.current_turn === myId) {
          setBust(true);
          setBustMsg(`${opPseudo} a fait 1 — tour perdu !`);
          setTimeout(() => { setBust(false); setBustMsg(null); }, 2500);
          play("notify");
        } else if (updated.current_turn === myId && updated.current_turn !== currentTurn) {
          play("notify");
        }

        setScores(newState.scores ?? {});
        setTurnTotal(newState.turn_total ?? 0);
        setLastRoll(newState.last_roll ?? null);
        setCurrentTurn(updated.current_turn);
        setGameStatus(updated.status as GameStatus);

        if (updated.status === "finished") {
          isFinishedRef.current = true;
          play(updated.winner_id === myId ? "win" : "lose");
          setTimeout(() => router.push(`/result?game_id=${gameId}`), 1800);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [gameId, myId, opPseudo, currentTurn, lastRoll]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleRoll() {
    if (!isMyTurn || submitting) return;
    setSubmitting(true);
    setRolling(true);
    setTimeout(() => setRolling(false), 380);

    const res = await rollPig(gameId);
    if (res.ok) {
      play("move");
      if (res.bust) {
        setBust(true);
        setBustMsg("Tu as fait 1 — tour perdu !");
        setTimeout(() => { setBust(false); setBustMsg(null); }, 2500);
      }
    }
    setSubmitting(false);
  }

  async function handleHold() {
    if (!isMyTurn || submitting || turnTotal === 0) return;
    setSubmitting(true);
    play("move");
    await holdPig(gameId);
    setSubmitting(false);
  }

  const dieSize = desktop ? 130 : 110;

  return (
    <div style={{
      minHeight: "100dvh",
      background: `linear-gradient(160deg, ${EA.violetDeep} 0%, #1a1050 60%, #0d0826 100%)`,
      display: "flex", flexDirection: "column", alignItems: "center",
      padding: desktop ? "28px 24px 48px" : "16px 16px 40px",
      gap: desktop ? 24 : 18,
      fontFamily: "var(--font-sans)",
      position: "relative", overflow: "hidden",
    }}>
      {/* Dot grid bg */}
      <div style={{
        position: "fixed", inset: 0,
        backgroundImage: "radial-gradient(circle, rgba(0,212,232,0.1) 1px, transparent 1.4px)",
        backgroundSize: "18px 18px", pointerEvents: "none", zIndex: 0,
      }} />

      {/* Score bars */}
      <div style={{
        width: "100%", maxWidth: 480,
        display: "flex", gap: 16, alignItems: "stretch",
        position: "relative", zIndex: 2,
      }}>
        <ScoreBar score={myScore} pseudo={myPseudo} avatarUrl={myAvatarUrl} isMe color={EA.cyan} isActive={isMyTurn && !isFinished} />
        <div style={{
          width: 2, background: "rgba(255,255,255,0.15)", borderRadius: 1, flexShrink: 0,
        }} />
        <ScoreBar score={opScore} pseudo={opPseudo} avatarUrl={opAvatarUrl} isMe={false} color={EA.pink} isActive={!isMyTurn && !isFinished} />
      </div>

      {/* Objectif */}
      <div style={{
        position: "relative", zIndex: 2,
        fontSize: 10, fontWeight: 900, color: "rgba(255,255,255,0.35)",
        textTransform: "uppercase", letterSpacing: 1.4,
      }}>Objectif : {WIN_SCORE} points</div>

      {/* Tour en cours */}
      <div style={{
        position: "relative", zIndex: 2,
        background: "rgba(255,255,255,0.06)",
        border: `2px solid rgba(255,255,255,0.12)`,
        borderRadius: 16, padding: "10px 24px",
        display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
      }}>
        <div style={{
          fontSize: 10, fontWeight: 900, color: "rgba(255,255,255,0.4)",
          textTransform: "uppercase", letterSpacing: 1.2,
        }}>
          {isMyTurn ? "Ce tour" : `Tour de ${opPseudo}`}
        </div>
        <div style={{
          fontFamily: "var(--font-display)", fontSize: desktop ? 36 : 30,
          color: turnTotal > 0 ? EA.butter : "rgba(255,255,255,0.2)",
          transform: "skewX(-6deg)",
          textShadow: turnTotal > 0 ? `3px 3px 0 ${EA.ink}` : "none",
          transition: "color 0.2s",
          lineHeight: 1,
        }}>
          {turnTotal > 0 ? `+${turnTotal}` : "—"}
        </div>
        {turnTotal > 0 && isMyTurn && (
          <div style={{
            fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.35)",
            textTransform: "uppercase",
          }}>
            → {myScore + turnTotal} pts si tu banques
          </div>
        )}
      </div>

      {/* Die */}
      <div style={{
        position: "relative", zIndex: 2,
        display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
      }}>
        <DieFace value={lastRoll} size={dieSize} bust={bust} rolling={rolling} />

        {/* Bust message */}
        {bustMsg && (
          <div style={{
            background: "rgba(255,30,140,0.2)", border: `2px solid ${EA.pink}`,
            borderRadius: 12, padding: "8px 18px",
            fontFamily: "var(--font-display)", fontSize: 13, color: EA.pink,
            transform: "skewX(-4deg)",
            animation: "pig-fadein 0.2s ease",
          }}>
            💀 {bustMsg}
          </div>
        )}
      </div>

      {/* Buttons */}
      {!isFinished && (
        <div style={{
          display: "flex", gap: 14,
          position: "relative", zIndex: 2,
        }}>
          {/* LANCER */}
          <button
            type="button"
            disabled={!isMyTurn || submitting}
            onClick={handleRoll}
            style={{
              width: desktop ? 140 : 120,
              height: desktop ? 64 : 56,
              background: !isMyTurn || submitting ? "rgba(255,255,255,0.07)" : EA.cyan,
              border: `3px solid ${!isMyTurn || submitting ? "rgba(255,255,255,0.12)" : EA.ink}`,
              borderRadius: 16,
              boxShadow: !isMyTurn || submitting ? "none" : `4px 4px 0 ${EA.pink}, 4px 4px 0 1px ${EA.ink}`,
              cursor: !isMyTurn || submitting ? "not-allowed" : "pointer",
              fontFamily: "var(--font-display)", fontSize: desktop ? 16 : 14,
              color: !isMyTurn || submitting ? "rgba(255,255,255,0.2)" : EA.ink,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              transition: "background 0.15s, box-shadow 0.15s",
            }}
          >
            <span style={{ fontSize: desktop ? 22 : 18 }}>🎲</span> LANCER
          </button>

          {/* BANQUER */}
          <button
            type="button"
            disabled={!isMyTurn || submitting || turnTotal === 0}
            onClick={handleHold}
            style={{
              width: desktop ? 140 : 120,
              height: desktop ? 64 : 56,
              background: (!isMyTurn || submitting || turnTotal === 0) ? "rgba(255,255,255,0.07)" : EA.butter,
              border: `3px solid ${(!isMyTurn || submitting || turnTotal === 0) ? "rgba(255,255,255,0.12)" : EA.ink}`,
              borderRadius: 16,
              boxShadow: (!isMyTurn || submitting || turnTotal === 0) ? "none" : `4px 4px 0 ${EA.cyan}, 4px 4px 0 1px ${EA.ink}`,
              cursor: (!isMyTurn || submitting || turnTotal === 0) ? "not-allowed" : "pointer",
              fontFamily: "var(--font-display)", fontSize: desktop ? 16 : 14,
              color: (!isMyTurn || submitting || turnTotal === 0) ? "rgba(255,255,255,0.2)" : EA.ink,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              transition: "background 0.15s, box-shadow 0.15s",
            }}
          >
            <span style={{ fontSize: desktop ? 22 : 18 }}>🏦</span> BANQUER
          </button>
        </div>
      )}

      {/* Status message */}
      {!isFinished && !isMyTurn && !bustMsg && (
        <div style={{
          position: "relative", zIndex: 2,
          fontSize: 12, fontWeight: 800, color: "rgba(255,255,255,0.35)",
          textTransform: "uppercase", letterSpacing: 1.2,
          animation: "pulse 2s ease-in-out infinite",
        }}>
          En attente de {opPseudo}…
        </div>
      )}

      <RulesButton gameType="pig" />

      <GameChat
        gameId={gameId}
        myId={myId}
        myPseudo={myPseudo}
        opponentId={opponentId}
        opponentPseudo={opPseudo}
      />

      <PreventLeave enabled={!isFinished} gameId={gameId} />

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @keyframes pig-roll {
          0%   { transform: rotate(0deg) scale(1); }
          25%  { transform: rotate(-12deg) scale(0.92); }
          50%  { transform: rotate(10deg) scale(0.95); }
          75%  { transform: rotate(-6deg) scale(0.98); }
          100% { transform: rotate(0deg) scale(1); }
        }
        @keyframes pig-fadein {
          from { opacity: 0; transform: translateY(-6px) skewX(-4deg); }
          to   { opacity: 1; transform: translateY(0) skewX(-4deg); }
        }
      `}</style>
    </div>
  );
}

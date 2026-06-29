"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { RR } from "@/lib/design";
import { useGameOpponent } from "@/app/(game)/chat/ChatSystem";
import { PreventLeave } from "@/components/PreventLeave";
import { RulesButton } from "@/components/ui/rules-button";
import { rollPig, holdPig } from "./actions";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { useOpponentWatcher } from "@/hooks/useOpponentWatcher";
import { useGameSounds } from "@/hooks/useGameSounds";
import { useGamePresence } from "@/hooks/useGamePresence";
import { resolveDuo } from "@/lib/players";
import { DieFace } from "./components/Die";
import { PlayerCard } from "./components/PlayerCard";
import type { PigState, GameStatus } from "@/types/database";

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props {
  gameId: string; myId: string;
  p1Id: string; p2Id: string;
  p1Pseudo: string; p2Pseudo: string;
  p1AvatarUrl: string | null; p2AvatarUrl: string | null;
  p1AvatarColor: string | null;
  p2AvatarColor: string | null;
  initialState: PigState;
  initialStatus: GameStatus;
  initialCurrentTurn: string | null;
  initialWinnerId: string | null;
}

// ── Component ─────────────────────────────────────────────────────────────────
export function PigClient({
  gameId, myId, p1Id, p2Id,
  p1Pseudo, p2Pseudo, p1AvatarUrl, p2AvatarUrl, p1AvatarColor, p2AvatarColor,
  initialState, initialStatus, initialCurrentTurn, initialWinnerId,
}: Props) {
  const router = useRouter();
  const desktop = useIsDesktop();
  const { opponentId, myPseudo, opPseudo, myAvatarUrl, opAvatarUrl, myAvatarColor, opAvatarColor } = resolveDuo({ myId, p1Id, p2Id, p1Pseudo, p2Pseudo, p1AvatarUrl, p2AvatarUrl, p1AvatarColor, p2AvatarColor });

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

  useEffect(() => { isFinishedRef.current = isFinished; }, [isFinished]);
  useOpponentWatcher({ gameId, opponentId, isFinishedRef });
  useGameOpponent(opponentId, opPseudo);
  useGamePresence({ gameId, myId, myPseudo, gameType: "pig", initialFinished: initialStatus === "finished", isFinishedRef });
  const { play } = useGameSounds();

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

        // Bust déclenché côté adverse
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
          setTimeout(() => router.replace(`/result?game_id=${gameId}`), 4000);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [gameId, myId, opPseudo, currentTurn]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleRoll() {
    if (!isMyTurn || submitting) return;
    setSubmitting(true);
    setRolling(true);
    setTimeout(() => setRolling(false), 580);

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

  const dieSize = desktop ? 150 : 130;

  // Niveau de "chaleur" de la cagnotte : 0 = vide, 1 = chaud, 2 = brûlant
  const heat = turnTotal === 0 ? 0 : turnTotal < 20 ? 1 : 2;
  const cagnotteColor = heat === 2 ? RR.pink : heat === 1 ? RR.butter : "rgba(255,255,255,0.15)";

  return (
    <div style={{
      minHeight: "100dvh",
      background: `
        radial-gradient(ellipse at 20% 10%, rgba(0,212,232,0.15) 0%, transparent 50%),
        radial-gradient(ellipse at 85% 90%, rgba(255,45,140,0.13) 0%, transparent 50%),
        linear-gradient(180deg, ${RR.violet} 0%, ${RR.violetDeep} 100%)
      `,
      display: "flex", flexDirection: "column", alignItems: "center",
      padding: desktop ? "24px 24px 100px" : "14px 14px 100px",
      gap: desktop ? 18 : 14,
      fontFamily: "var(--font-sans)",
      position: "relative", overflow: "hidden",
    }}>

      {/* Dot grid bg */}
      <div aria-hidden style={{
        position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0,
        backgroundImage: "radial-gradient(circle, rgba(0,212,232,0.5) 1.3px, transparent 1.8px)",
        backgroundSize: "16px 16px", opacity: 0.18,
      }} />

      <div style={{ position: "relative", zIndex: 2, width: "100%", maxWidth: 480, display: "flex", flexDirection: "column", gap: 14, alignItems: "center" }}>

        {/* Title */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            fontSize: 38, lineHeight: 1,
            animation: rolling ? "pig-shake 0.55s ease-in-out" : "none",
            filter: bust ? "grayscale(0.5)" : "none",
          }}>{bust ? "😵" : "🐷"}</div>
          <div>
            <div style={{
              fontFamily: "var(--font-display)", fontSize: 24, color: RR.white,
              transform: "skewX(-6deg)", textShadow: `3px 3px 0 ${RR.pink}`,
              lineHeight: 1,
            }}>JEU DU COCHON</div>
            <div style={{ fontSize: 9, fontWeight: 900, color: RR.cyan, textTransform: "uppercase", letterSpacing: 2, marginTop: 4 }}>
              Premier à 100 gagne
            </div>
          </div>
        </div>

        {/* Player cards */}
        <div style={{ display: "flex", gap: 10, width: "100%" }}>
          <PlayerCard
            score={myScore} pseudo={myPseudo} avatarUrl={myAvatarUrl}
            color={RR.cyan} avatarColor={myAvatarColor} isActive={isMyTurn && !isFinished} isMe side="left"
          />
          <PlayerCard
            score={opScore} pseudo={opPseudo} avatarUrl={opAvatarUrl}
            color={RR.pink} avatarColor={opAvatarColor} isActive={!isMyTurn && !isFinished} isMe={false} side="right"
          />
        </div>

        {/* CAGNOTTE */}
        <div style={{
          width: "100%",
          background: heat > 0
            ? `radial-gradient(circle at 50% 50%, ${cagnotteColor}22 0%, ${RR.violetDeep} 75%)`
            : RR.violetDeep,
          border: `3px solid ${heat > 0 ? cagnotteColor : RR.ink}`,
          borderRadius: 22, padding: "14px 20px",
          boxShadow: heat === 2
            ? `0 0 40px rgba(255,45,140,0.45), 4px 4px 0 ${RR.pink}`
            : heat === 1
              ? `0 0 24px rgba(255,233,74,0.3), 3px 3px 0 ${RR.butter}`
              : `2px 2px 0 ${RR.ink}`,
          display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
          transition: "all 0.3s",
          animation: heat === 2 ? "cagnotte-pulse 1s ease-in-out infinite" : "none",
        }}>
          <div style={{
            fontFamily: "var(--font-sans)", fontSize: 10, fontWeight: 900,
            color: heat > 0 ? cagnotteColor : "rgba(255,255,255,0.4)",
            textTransform: "uppercase", letterSpacing: 2,
            transition: "color 0.3s",
          }}>
            {heat === 2 ? "🔥 CAGNOTTE BRÛLANTE" : heat === 1 ? "🪙 CAGNOTTE EN COURS" : isMyTurn ? "À TOI DE LANCER" : `EN ATTENTE…`}
          </div>
          <div style={{
            fontFamily: "var(--font-display)", fontSize: desktop ? 56 : 48,
            color: heat > 0 ? cagnotteColor : "rgba(255,255,255,0.18)",
            textShadow: heat > 0 ? `4px 4px 0 ${RR.ink}` : "none",
            transform: "skewX(-8deg)", lineHeight: 1,
            transition: "color 0.3s",
          }}>
            {turnTotal > 0 ? `+${turnTotal}` : "—"}
          </div>
          {turnTotal > 0 && isMyTurn && (
            <div style={{
              fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 700,
              color: "rgba(255,255,255,0.55)", marginTop: 2,
            }}>
              🏦 Banque pour <strong style={{ color: RR.cyan }}>{myScore + turnTotal}</strong> pts
            </div>
          )}
        </div>

        {/* Die */}
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center", gap: 12,
          padding: "8px 0",
        }}>
          <DieFace value={lastRoll} size={dieSize} bust={bust} rolling={rolling} />

          {bustMsg && (
            <div style={{
              background: `rgba(255,30,140,0.25)`, border: `2px solid ${RR.pink}`,
              borderRadius: 14, padding: "8px 18px",
              fontFamily: "var(--font-display)", fontSize: 13, color: RR.white,
              transform: "skewX(-4deg)",
              boxShadow: `3px 3px 0 ${RR.ink}`,
              animation: "pig-fadein 0.25s ease",
            }}>
              💥 {bustMsg}
            </div>
          )}
        </div>

        {/* Buttons */}
        {!isFinished && (
          <div style={{ display: "flex", gap: 12, width: "100%", maxWidth: 380 }}>
            {/* LANCER */}
            <button
              type="button"
              disabled={!isMyTurn || submitting}
              onClick={handleRoll}
              style={{
                flex: 1, height: desktop ? 64 : 58,
                background: !isMyTurn || submitting ? "rgba(255,255,255,0.06)" : RR.cyan,
                border: `3px solid ${RR.ink}`,
                borderRadius: 18,
                boxShadow: !isMyTurn || submitting
                  ? `2px 2px 0 ${RR.ink}`
                  : `5px 5px 0 ${RR.pink}, 5px 5px 0 1px ${RR.ink}`,
                cursor: !isMyTurn || submitting ? "not-allowed" : "pointer",
                fontFamily: "var(--font-display)", fontSize: 16,
                color: !isMyTurn || submitting ? "rgba(255,255,255,0.3)" : RR.ink,
                opacity: !isMyTurn || submitting ? 0.55 : 1,
                transition: "all 0.1s",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                transform: "skewX(-4deg)",
              }}
            >
              <span style={{ display: "inline-block", transform: "skewX(4deg)", fontSize: 22 }}>🎲</span>
              <span style={{ display: "inline-block", transform: "skewX(4deg)" }}>LANCER</span>
            </button>

            {/* BANQUER */}
            <button
              type="button"
              disabled={!isMyTurn || submitting || turnTotal === 0}
              onClick={handleHold}
              style={{
                flex: 1, height: desktop ? 64 : 58,
                background: (!isMyTurn || submitting || turnTotal === 0) ? "rgba(255,255,255,0.06)" : RR.butter,
                border: `3px solid ${RR.ink}`,
                borderRadius: 18,
                boxShadow: (!isMyTurn || submitting || turnTotal === 0)
                  ? `2px 2px 0 ${RR.ink}`
                  : `5px 5px 0 ${RR.cyan}, 5px 5px 0 1px ${RR.ink}`,
                cursor: (!isMyTurn || submitting || turnTotal === 0) ? "not-allowed" : "pointer",
                fontFamily: "var(--font-display)", fontSize: 16,
                color: (!isMyTurn || submitting || turnTotal === 0) ? "rgba(255,255,255,0.3)" : RR.ink,
                opacity: (!isMyTurn || submitting || turnTotal === 0) ? 0.55 : 1,
                transition: "all 0.1s",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                transform: "skewX(-4deg)",
              }}
            >
              <span style={{ display: "inline-block", transform: "skewX(4deg)", fontSize: 22 }}>🏦</span>
              <span style={{ display: "inline-block", transform: "skewX(4deg)" }}>BANQUER</span>
            </button>
          </div>
        )}

        {/* Status */}
        {!isFinished && !isMyTurn && !bustMsg && (
          <div style={{
            fontFamily: "var(--font-display)", fontSize: 13,
            color: "rgba(255,255,255,0.5)",
            transform: "skewX(-4deg)", letterSpacing: 1,
            animation: "pig-pulse 2s ease-in-out infinite",
          }}>
            ⏳ {opPseudo.toUpperCase()} JOUE…
          </div>
        )}
      </div>

      <RulesButton gameType="pig" />
      <PreventLeave enabled={!isFinished} gameId={gameId} />

      <style>{`
        @keyframes pig-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @keyframes pig-roll {
          0%   { transform: rotate(0deg) scale(1) translateY(0); }
          20%  { transform: rotate(-180deg) scale(0.9) translateY(-10px); }
          50%  { transform: rotate(180deg) scale(0.85) translateY(-14px); }
          80%  { transform: rotate(-90deg) scale(0.95) translateY(-4px); }
          100% { transform: rotate(0deg) scale(1) translateY(0); }
        }
        @keyframes pig-shake {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(-15deg); }
          75% { transform: rotate(15deg); }
        }
        @keyframes pig-fadein {
          from { opacity: 0; transform: translateY(-6px) skewX(-4deg); }
          to   { opacity: 1; transform: translateY(0) skewX(-4deg); }
        }
        @keyframes cagnotte-pulse {
          0%, 100% { box-shadow: 0 0 40px rgba(255,45,140,0.45), 4px 4px 0 ${RR.pink}; }
          50%      { box-shadow: 0 0 60px rgba(255,45,140,0.7),  6px 6px 0 ${RR.pink}; }
        }
      `}</style>
    </div>
  );
}

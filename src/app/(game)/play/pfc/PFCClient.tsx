"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { EA } from "@/lib/design";
import { Avatar } from "@/components/ui/avatar";
import { Star } from "@/components/ui/star";
import { submitPFCMove } from "./actions";
import type { PFCState, PFCRound, GameStatus } from "@/types/database";

type PFCMove = "pierre" | "feuille" | "ciseaux";
type Phase = "picking" | "waiting" | "revealing";

const MOVES: { id: PFCMove; emoji: string; label: string; color: string; shadow: string }[] = [
  { id: "pierre",  emoji: "✊", label: "Pierre",  color: EA.cyan,   shadow: EA.pink },
  { id: "feuille", emoji: "✋", label: "Feuille", color: EA.pink,   shadow: EA.cyan },
  { id: "ciseaux", emoji: "✌", label: "Ciseaux", color: EA.butter, shadow: EA.pink },
];

interface Props {
  gameId: string;
  myId: string;
  p1Id: string;
  p2Id: string;
  p1Pseudo: string;
  p2Pseudo: string;
  initialState: PFCState;
  initialStatus: GameStatus;
  initialWinnerId: string | null;
}

export function PFCClient({ gameId, myId, p1Id, p2Id, p1Pseudo, p2Pseudo, initialState, initialStatus }: Props) {
  const router = useRouter();
  const opponentId = myId === p1Id ? p2Id : p1Id;
  const myPseudo = myId === p1Id ? p1Pseudo : p2Pseudo;
  const opPseudo = myId === p1Id ? p2Pseudo : p1Pseudo;

  const [pfcState, setPfcState] = useState<PFCState>(initialState);
  const [phase, setPhase] = useState<Phase>(() => {
    if (initialStatus === "finished") return "picking";
    const last = initialState.rounds[initialState.rounds.length - 1];
    if (last && Object.keys(last.moves).length < 2 && last.moves[myId]) return "waiting";
    return "picking";
  });
  const [myMove, setMyMove] = useState<PFCMove | null>(() => {
    const last = initialState.rounds[initialState.rounds.length - 1];
    return (last?.moves[myId] as PFCMove | undefined) ?? null;
  });
  const [opponentChose, setOpponentChose] = useState<boolean>(() => {
    const last = initialState.rounds[initialState.rounds.length - 1];
    return !!(last?.moves[opponentId]);
  });
  const [revealingRound, setRevealingRound] = useState<PFCRound | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const lastRevealedRef = useRef<number>(0);
  const revealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (initialStatus === "finished") router.push(`/result?game_id=${gameId}`);
    const last = initialState.rounds[initialState.rounds.length - 1];
    if (last && Object.keys(last.moves).length === 2) lastRevealedRef.current = last.round;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRoundResolved = useCallback((round: PFCRound, newState: PFCState, newStatus: GameStatus) => {
    if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
    lastRevealedRef.current = round.round;
    setRevealingRound(round);
    setPhase("revealing");
    setPfcState(newState);
    revealTimerRef.current = setTimeout(() => {
      if (newStatus === "finished") {
        router.push(`/result?game_id=${gameId}`);
      } else {
        setMyMove(null);
        setOpponentChose(false);
        setPhase("picking");
        setRevealingRound(null);
      }
    }, 2800);
  }, [gameId, router]);

  useEffect(() => {
    const supabase = createClient();
    const sub = supabase
      .channel(`game-${gameId}`)
      .on("postgres_changes", {
        event: "UPDATE", schema: "public", table: "games",
        filter: `id=eq.${gameId}`,
      }, (payload) => {
        const updated = payload.new as { state: unknown; status: string; winner_id: string | null };
        const raw = updated.state as Record<string, unknown>;
        const newState: PFCState = raw && "rounds" in raw
          ? (raw as unknown as PFCState)
          : { rounds: [], scores: {} };
        const newStatus = updated.status as GameStatus;

        const lastRound = newState.rounds[newState.rounds.length - 1];
        if (lastRound && Object.keys(lastRound.moves).length === 2 && lastRound.round > lastRevealedRef.current) {
          handleRoundResolved(lastRound, newState, newStatus);
        } else {
          setPfcState(newState);
          // Check if opponent just chose
          if (lastRound && lastRound.moves[opponentId] && !lastRound.moves[myId]) {
            setOpponentChose(true);
          }
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(sub);
      if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
    };
  }, [gameId, handleRoundResolved, myId, opponentId]);

  async function handlePick(move: PFCMove) {
    if (phase !== "picking" || submitting) return;
    setMyMove(move);
    setPhase("waiting");
    setSubmitting(true);
    try {
      await submitPFCMove(gameId, move);
    } finally {
      setSubmitting(false);
    }
  }

  const scores = pfcState.scores ?? { [myId]: 0, [opponentId]: 0 };
  const myScore = scores[myId] ?? 0;
  const opScore = scores[opponentId] ?? 0;
  const currentRoundNum = Math.min(pfcState.rounds.length + (phase === "picking" ? 1 : 0), 3);
  const activeRoundNum = phase === "revealing" && revealingRound ? revealingRound.round : currentRoundNum;

  function getRoundWinnerLabel(round: PFCRound) {
    if (!round.winner_id) return "ÉGALITÉ !";
    return round.winner_id === myId ? "TU GAGNES ! 🎉" : `${opPseudo.toUpperCase()} GAGNE !`;
  }

  const revealMyMove = revealingRound?.moves[myId] as PFCMove | undefined;
  const revealOpMove = revealingRound?.moves[opponentId] as PFCMove | undefined;
  const revealWin = revealingRound?.winner_id === myId;
  const revealDraw = revealingRound && !revealingRound.winner_id;

  return (
    <div style={{ position: "absolute", inset: 0, background: EA.violet, overflow: "hidden" }}>
      {/* Dot bg */}
      <div aria-hidden style={{
        position: "absolute", inset: 0, opacity: 0.3,
        backgroundImage: `radial-gradient(circle, rgba(0,212,232,0.5) 1.2px, transparent 1.6px) 0 0 / 16px 16px`,
      }} />

      {/* Blobs */}
      <svg viewBox="0 0 200 200" style={{ position: "absolute", width: 340, height: 200, top: -80, right: -60, opacity: 0.85 }} preserveAspectRatio="none">
        <path d="M 40 60 Q 30 20 80 25 Q 140 10 165 50 Q 195 90 175 140 Q 155 185 100 180 Q 40 190 25 140 Q 5 95 40 60 Z" fill={EA.pink} />
      </svg>

      <Star color={EA.butter} size={18} style={{ top: 130, right: 32, transform: "rotate(20deg)" }} />
      <Star color={EA.white} size={12} style={{ top: 200, left: 26 }} />

      {/* ── PICKING / WAITING phase ── */}
      {(phase === "picking" || phase === "waiting") && (
        <>
          {/* Opponent area (top) */}
          <div style={{ position: "absolute", top: 56, left: 0, right: 0, padding: "0 18px" }}>
            {/* Round badge */}
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
              <div style={{
                background: EA.violetDeep, border: `2px solid ${EA.ink}`,
                borderRadius: 999, padding: "4px 14px",
                fontFamily: "var(--font-display)", fontSize: 11, color: EA.cyan,
                letterSpacing: 1.4, boxShadow: `2px 2px 0 ${EA.pink}`,
              }}>MANCHE {activeRoundNum} / 3</div>
            </div>

            <div style={{
              background: "rgba(26,15,94,0.55)", border: `2.5px solid ${EA.ink}`,
              borderRadius: 22, padding: "14px 14px 16px",
            }}>
              {/* Opponent header */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Avatar name={opPseudo} color={EA.cyan} ring={EA.pink} size={36} />
                  <div>
                    <div style={{ fontFamily: "var(--font-display)", fontSize: 14, color: EA.white, transform: "skewX(-4deg)", lineHeight: 1 }}>
                      {opPseudo.toUpperCase()}
                    </div>
                    <div style={{ fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 800, color: opponentChose ? EA.cyan : "rgba(255,255,255,0.4)", marginTop: 2, display: "flex", alignItems: "center", gap: 5 }}>
                      {opponentChose
                        ? <><span style={{ width: 6, height: 6, borderRadius: "50%", background: EA.cyan, boxShadow: `0 0 6px ${EA.cyan}`, display: "inline-block" }} />A choisi !</>
                        : "Réfléchit..."}
                    </div>
                  </div>
                </div>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 22, color: EA.cyan, transform: "skewX(-8deg)" }}>
                  {opScore} — {myScore}
                </div>
              </div>

              {/* Face-down card */}
              <div style={{
                height: 96,
                background: opponentChose
                  ? `repeating-linear-gradient(45deg, ${EA.pink} 0 12px, ${EA.violetDeep} 12px 24px)`
                  : `repeating-linear-gradient(45deg, rgba(255,30,140,0.3) 0 12px, ${EA.violetDeep} 12px 24px)`,
                border: `2.5px solid ${EA.ink}`,
                borderRadius: 18,
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: `inset 0 0 0 4px ${EA.violet}`,
              }}>
                <div style={{
                  background: opponentChose ? EA.cyan : "rgba(255,255,255,0.15)",
                  border: `2px solid ${EA.ink}`,
                  borderRadius: 999, padding: "6px 14px",
                  fontFamily: "var(--font-display)", fontSize: 14,
                  color: opponentChose ? EA.ink : "rgba(255,255,255,0.5)",
                  transform: "skewX(-4deg) rotate(-3deg)",
                  boxShadow: opponentChose ? `2px 2px 0 ${EA.ink}` : "none",
                }}>
                  {opponentChose ? "✓ A CHOISI" : "?? CACHÉ ??"}
                </div>
              </div>
            </div>
          </div>

          {/* Center VS */}
          <div style={{
            position: "absolute", top: 332, left: "50%", transform: "translate(-50%, -50%)", zIndex: 10,
          }}>
            <div style={{
              width: 70, height: 70, borderRadius: "50%",
              background: EA.butter, border: `3px solid ${EA.ink}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: "var(--font-display)", fontSize: 26, color: EA.ink,
              transform: "skewX(-8deg) rotate(-6deg)",
              boxShadow: `3px 3px 0 ${EA.pink}`,
            }}>VS</div>
          </div>

          {/* My area (bottom) */}
          <div style={{ position: "absolute", bottom: 50, left: 0, right: 0, padding: "0 18px", zIndex: 5 }}>
            <div style={{ textAlign: "center", marginBottom: 10 }}>
              <div style={{
                fontFamily: "var(--font-display)", fontSize: 26, color: EA.white,
                transform: "skewX(-8deg)", textShadow: `3px 3px 0 ${EA.violetDeep}`,
              }}>
                {phase === "waiting" ? "EN ATTENTE..." : "À TOI DE JOUER !"}
              </div>
              <div style={{
                fontFamily: "var(--font-sans)", fontStyle: "italic", fontSize: 12, fontWeight: 800,
                color: EA.cyan, marginTop: 4,
              }}>
                {phase === "waiting" ? `${opPseudo} doit encore choisir 🔒` : "tape pour choisir, révélation simultanée 🔒"}
              </div>
            </div>

            {/* Choices */}
            <div style={{ display: "flex", gap: 8 }}>
              {MOVES.map(({ id, emoji, label, color, shadow }) => {
                const picked = phase === "waiting" && myMove === id;
                return (
                  <button
                    key={id}
                    onClick={() => handlePick(id)}
                    disabled={phase === "waiting" || submitting}
                    style={{
                      flex: 1,
                      background: picked ? color : EA.white,
                      border: `2.5px solid ${EA.ink}`,
                      borderRadius: 24,
                      padding: "14px 8px 12px",
                      display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                      boxShadow: picked ? `5px 5px 0 ${shadow}, 5px 5px 0 1px ${EA.ink}` : `3px 3px 0 ${EA.violetDeep}`,
                      transform: picked ? "translateY(-4px) rotate(-2deg)" : "none",
                      cursor: phase === "picking" ? "pointer" : "default",
                      position: "relative",
                      transition: "transform 0.15s, box-shadow 0.15s",
                    }}
                  >
                    {picked && (
                      <div style={{
                        position: "absolute", top: -10, left: "50%",
                        transform: "translateX(-50%) rotate(-6deg)",
                        background: EA.butter, border: `2px solid ${EA.ink}`,
                        padding: "2px 8px", borderRadius: 999,
                        fontFamily: "var(--font-display)", fontSize: 9, color: EA.ink,
                        letterSpacing: 0.6, boxShadow: `2px 2px 0 ${EA.ink}`,
                        whiteSpace: "nowrap",
                      }}>TON CHOIX</div>
                    )}
                    <div style={{ fontSize: 38, lineHeight: 1 }}>{emoji}</div>
                    <div style={{
                      fontFamily: "var(--font-display)", fontSize: 12, color: EA.ink,
                      textTransform: "uppercase", letterSpacing: 0.8, transform: "skewX(-4deg)",
                    }}>{label}</div>
                  </button>
                );
              })}
            </div>

            {/* My name + score */}
            <div style={{
              marginTop: 12, textAlign: "center",
              fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 800,
              color: "rgba(255,255,255,0.55)", textTransform: "uppercase", letterSpacing: 1.2,
            }}>
              Tu : {myPseudo.toUpperCase()} · {myScore} — {opScore}
            </div>
          </div>
        </>
      )}

      {/* ── REVEALING phase ── */}
      {phase === "revealing" && revealingRound && (
        <>
          {/* Round label */}
          <div style={{ position: "absolute", top: 60, left: 0, right: 0, textAlign: "center", zIndex: 5 }}>
            <div style={{
              display: "inline-block",
              background: EA.violetDeep, border: `2px solid ${EA.ink}`,
              borderRadius: 999, padding: "4px 14px",
              fontFamily: "var(--font-display)", fontSize: 11, color: EA.cyan,
              letterSpacing: 1.4, boxShadow: `2px 2px 0 ${EA.pink}`,
            }}>MANCHE {revealingRound.round} / 3 — RÉVÉLATION</div>
          </div>

          {/* Result banner */}
          <div style={{ position: "absolute", top: 110, left: 16, right: 16, textAlign: "center", zIndex: 8 }}>
            <div style={{
              display: "inline-block",
              background: revealDraw ? EA.butter : revealWin ? EA.butter : EA.pink,
              border: `3px solid ${EA.ink}`,
              borderRadius: 18, padding: "8px 20px",
              transform: "rotate(-2deg)",
              boxShadow: `5px 5px 0 ${revealWin ? EA.pink : EA.cyan}, 5px 5px 0 1px ${EA.ink}`,
            }}>
              <div style={{
                fontFamily: "var(--font-display)", fontSize: 32,
                color: EA.ink, transform: "skewX(-8deg)",
                textShadow: `3px 3px 0 ${EA.white}`,
              }}>
                {getRoundWinnerLabel(revealingRound)}
              </div>
            </div>
            {revealMyMove && revealOpMove && (
              <div style={{
                fontFamily: "var(--font-sans)", fontStyle: "italic",
                fontSize: 13, fontWeight: 800, color: EA.white, opacity: 0.9, marginTop: 12,
              }}>
                {MOVES.find(m => m.id === revealMyMove)?.label} vs {MOVES.find(m => m.id === revealOpMove)?.label}
              </div>
            )}
          </div>

          {/* Hands */}
          <div style={{
            position: "absolute", top: 240, left: 12, right: 12,
            display: "flex", alignItems: "center", gap: 8, zIndex: 5,
          }}>
            {/* My hand */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, position: "relative" }}>
              {revealWin && (
                <div style={{
                  position: "absolute", top: -22, left: "50%",
                  transform: "translateX(-50%) rotate(-8deg)",
                  background: EA.butter, border: `2.5px solid ${EA.ink}`,
                  borderRadius: 999, padding: "4px 12px",
                  fontFamily: "var(--font-display)", fontSize: 12, color: EA.ink,
                  letterSpacing: 1, boxShadow: `3px 3px 0 ${EA.ink}`, whiteSpace: "nowrap", zIndex: 5,
                }}>🏆 GAGNE</div>
              )}
              <div style={{
                width: 110, height: 110, borderRadius: 28,
                background: revealWin ? EA.butter : EA.white,
                border: `3px solid ${EA.ink}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 62,
                boxShadow: revealWin
                  ? `5px 5px 0 ${EA.pink}, 5px 5px 0 1px ${EA.ink}`
                  : `3px 3px 0 ${EA.violetDeep}`,
                transform: revealWin ? "rotate(-3deg) scale(1.05)" : (!revealDraw ? "rotate(4deg) scale(0.92)" : "none"),
                opacity: (!revealWin && !revealDraw) ? 0.7 : 1,
              }}>
                {revealMyMove ? MOVES.find(m => m.id === revealMyMove)?.emoji : "?"}
              </div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 14, color: EA.white, transform: "skewX(-4deg)", opacity: (!revealWin && !revealDraw) ? 0.6 : 1 }}>
                {myPseudo.toUpperCase()}
              </div>
            </div>

            {/* VS */}
            <div style={{
              flexShrink: 0, width: 56, height: 56, borderRadius: "50%",
              background: EA.pink, border: `2.5px solid ${EA.ink}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: "var(--font-display)", fontSize: 18, color: EA.white,
              transform: "skewX(-8deg) rotate(-6deg)",
              boxShadow: `3px 3px 0 ${EA.cyan}`,
            }}>VS</div>

            {/* Opponent hand */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, position: "relative" }}>
              {!revealWin && !revealDraw && (
                <div style={{
                  position: "absolute", top: -22, left: "50%",
                  transform: "translateX(-50%) rotate(8deg)",
                  background: EA.butter, border: `2.5px solid ${EA.ink}`,
                  borderRadius: 999, padding: "4px 12px",
                  fontFamily: "var(--font-display)", fontSize: 12, color: EA.ink,
                  letterSpacing: 1, boxShadow: `3px 3px 0 ${EA.ink}`, whiteSpace: "nowrap", zIndex: 5,
                }}>🏆 GAGNE</div>
              )}
              <div style={{
                width: 110, height: 110, borderRadius: 28,
                background: (!revealWin && !revealDraw) ? EA.butter : EA.white,
                border: `3px solid ${EA.ink}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 62,
                boxShadow: (!revealWin && !revealDraw)
                  ? `5px 5px 0 ${EA.pink}, 5px 5px 0 1px ${EA.ink}`
                  : `3px 3px 0 ${EA.violetDeep}`,
                transform: (!revealWin && !revealDraw) ? "rotate(3deg) scale(1.05)" : (revealWin ? "rotate(-4deg) scale(0.92)" : "none"),
                opacity: (revealWin && !revealDraw) ? 0.7 : 1,
              }}>
                {revealOpMove ? MOVES.find(m => m.id === revealOpMove)?.emoji : "?"}
              </div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 14, color: EA.white, transform: "skewX(-4deg)", opacity: (revealWin && !revealDraw) ? 0.6 : 1 }}>
                {opPseudo.toUpperCase()}
              </div>
            </div>
          </div>

          {/* Score update */}
          <div style={{
            position: "absolute", top: 420, left: 24, right: 24,
            background: EA.violetDeep, border: `2.5px solid ${EA.ink}`,
            borderRadius: 18, padding: "12px 14px",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            boxShadow: `4px 4px 0 ${EA.cyan}`, zIndex: 5,
          }}>
            <div>
              <div style={{ fontFamily: "var(--font-sans)", fontSize: 10, fontWeight: 900, color: EA.cyan, textTransform: "uppercase", letterSpacing: 1.2 }}>
                Score du match
              </div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 22, color: EA.white, transform: "skewX(-8deg)", marginTop: 2 }}>
                {myPseudo.toUpperCase()} {myScore} — {opScore} {opPseudo.toUpperCase()}
              </div>
            </div>
          </div>

          {/* Auto next */}
          <div style={{
            position: "absolute", bottom: 50, left: 24, right: 24,
            textAlign: "center", fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 800,
            color: "rgba(255,255,255,0.55)", zIndex: 5,
          }}>
            auto dans 3 sec...
          </div>

          <Star color={EA.butter} size={22} style={{ top: 200, left: 24, transform: "rotate(15deg)" }} />
          <Star color={EA.white} size={14} style={{ top: 180, right: 30 }} />
          <Star color={EA.cyan} size={18} style={{ bottom: 200, right: 28 }} />
        </>
      )}
    </div>
  );
}

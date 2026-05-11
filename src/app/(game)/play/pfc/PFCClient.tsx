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

const MOVES: { id: PFCMove; emoji: string; label: string }[] = [
  { id: "pierre", emoji: "🪨", label: "PIERRE" },
  { id: "feuille", emoji: "📄", label: "FEUILLE" },
  { id: "ciseaux", emoji: "✂️", label: "CISEAUX" },
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

export function PFCClient({ gameId, myId, p1Id, p2Id, p1Pseudo, p2Pseudo, initialState, initialStatus, initialWinnerId }: Props) {
  const router = useRouter();
  const opponentId = myId === p1Id ? p2Id : p1Id;
  const myPseudo = myId === p1Id ? p1Pseudo : p2Pseudo;
  const opPseudo = myId === p1Id ? p2Pseudo : p1Pseudo;

  const [pfcState, setPfcState] = useState<PFCState>(initialState);
  const [phase, setPhase] = useState<Phase>(() => {
    if (initialStatus === "finished") return "picking"; // will redirect
    const last = initialState.rounds[initialState.rounds.length - 1];
    if (last && Object.keys(last.moves).length < 2 && last.moves[myId]) return "waiting";
    return "picking";
  });
  const [myMove, setMyMove] = useState<PFCMove | null>(() => {
    const last = initialState.rounds[initialState.rounds.length - 1];
    return (last?.moves[myId] as PFCMove | undefined) ?? null;
  });
  const [revealingRound, setRevealingRound] = useState<PFCRound | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const lastRevealedRef = useRef<number>(0);
  const revealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Redirect if already finished on mount
  useEffect(() => {
    if (initialStatus === "finished") {
      router.push(`/result?game_id=${gameId}`);
    }
    const last = initialState.rounds[initialState.rounds.length - 1];
    if (last && Object.keys(last.moves).length === 2) {
      lastRevealedRef.current = last.round;
    }
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
        setPhase("picking");
        setRevealingRound(null);
      }
    }, 2500);
  }, [gameId, router]);

  useEffect(() => {
    const supabase = createClient();
    const sub = supabase
      .channel(`game-${gameId}`)
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "games",
        filter: `id=eq.${gameId}`,
      }, (payload) => {
        const updated = payload.new as { state: unknown; status: string; winner_id: string | null };
        const raw = updated.state as Record<string, unknown>;
        const newState: PFCState = raw && "rounds" in raw
          ? (raw as unknown as PFCState)
          : { rounds: [], scores: {} };
        const newStatus = updated.status as GameStatus;

        const lastRound = newState.rounds[newState.rounds.length - 1];
        if (
          lastRound &&
          Object.keys(lastRound.moves).length === 2 &&
          lastRound.round > lastRevealedRef.current
        ) {
          handleRoundResolved(lastRound, newState, newStatus);
        } else {
          setPfcState(newState);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(sub);
      if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
    };
  }, [gameId, handleRoundResolved]);

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
  const roundNum = Math.min(pfcState.rounds.length + (phase === "picking" ? 1 : 0), 3);

  function getMoveEmoji(move: PFCMove | undefined) {
    if (!move) return "❓";
    return MOVES.find(m => m.id === move)?.emoji ?? "❓";
  }

  function getRoundWinnerLabel(round: PFCRound) {
    if (!round.winner_id) return "ÉGALITÉ !";
    return round.winner_id === myId ? "TU GAGNES !" : "PERDU !";
  }

  function getRoundColor(round: PFCRound) {
    if (!round.winner_id) return EA.butter;
    return round.winner_id === myId ? EA.cyan : EA.pink;
  }

  return (
    <div style={{ position: "relative", minHeight: "100dvh", background: EA.violet, overflow: "hidden" }}>
      {/* Dot background */}
      <div aria-hidden style={{
        position: "absolute", inset: 0, opacity: 0.25,
        backgroundImage: "radial-gradient(circle, rgba(0,212,232,0.6) 1.4px, transparent 1.8px)",
        backgroundSize: "16px 16px",
      }} />

      <Star color={EA.butter} size={14} style={{ top: 60, right: 28, transform: "rotate(15deg)", animation: "ea-spin-slow 8s linear infinite" }} />
      <Star color={EA.pink} size={10} style={{ top: 120, left: 20, transform: "rotate(-10deg)" }} />

      {/* Header */}
      <div style={{ position: "relative", zIndex: 10, padding: "20px 20px 0" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: 9, fontWeight: 900, color: EA.cyan, textTransform: "uppercase", letterSpacing: 2 }}>
              PIERRE·FEUILLE·CISEAUX
            </div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 13, color: "rgba(255,255,255,0.6)", transform: "skewX(-6deg)", marginTop: 1 }}>
              Manche {roundNum} / 3
            </div>
          </div>
          {/* Round dots */}
          <div style={{ display: "flex", gap: 6 }}>
            {[0, 1, 2].map(i => {
              const r = pfcState.rounds[i];
              const resolved = r && Object.keys(r.moves).length === 2;
              let bg = "rgba(255,255,255,0.2)";
              if (resolved) {
                bg = !r.winner_id ? EA.butter : r.winner_id === myId ? EA.cyan : EA.pink;
              }
              return (
                <div key={i} style={{
                  width: 12, height: 12, borderRadius: "50%",
                  background: bg, border: `2px solid ${EA.ink}`,
                  transition: "background 0.3s",
                }} />
              );
            })}
          </div>
        </div>
      </div>

      {/* Score bar */}
      <div style={{
        position: "relative", zIndex: 10,
        margin: "16px 20px 0",
        background: EA.violetDeep, border: `2.5px solid ${EA.ink}`,
        borderRadius: 16, padding: "12px 16px",
        display: "flex", alignItems: "center",
        boxShadow: `3px 3px 0 ${EA.ink}`,
      }}>
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 10 }}>
          <Avatar name={myPseudo} color={EA.butter} ring={EA.cyan} size={40} />
          <div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 11, color: EA.white, transform: "skewX(-4deg)" }}>
              {myPseudo.toUpperCase()}
            </div>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: 9, fontWeight: 900, color: EA.cyan, letterSpacing: 1 }}>
              MOI
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexShrink: 0 }}>
          <span style={{ fontFamily: "var(--font-display)", fontSize: 32, color: EA.white, transform: "skewX(-8deg)", lineHeight: 1 }}>{myScore}</span>
          <span style={{ fontFamily: "var(--font-display)", fontSize: 18, color: "rgba(255,255,255,0.4)", transform: "skewX(-8deg)" }}>–</span>
          <span style={{ fontFamily: "var(--font-display)", fontSize: 32, color: "rgba(255,255,255,0.5)", transform: "skewX(-8deg)", lineHeight: 1 }}>{opScore}</span>
        </div>

        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10 }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 11, color: "rgba(255,255,255,0.6)", transform: "skewX(-4deg)" }}>
              {opPseudo.toUpperCase()}
            </div>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: 9, fontWeight: 900, color: EA.pink, letterSpacing: 1 }}>
              ADVERSAIRE
            </div>
          </div>
          <Avatar name={opPseudo} color={EA.pink} ring={EA.butter} size={40} />
        </div>
      </div>

      {/* Main game area */}
      <div style={{ position: "relative", zIndex: 10, margin: "20px 20px 0" }}>

        {/* PICKING phase */}
        {phase === "picking" && (
          <div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 15, color: EA.cyan, textAlign: "center", transform: "skewX(-6deg)", marginBottom: 16 }}>
              CHOISIS TON ARME !
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              {MOVES.map(({ id, emoji, label }) => (
                <button
                  key={id}
                  onClick={() => handlePick(id)}
                  disabled={submitting}
                  style={{
                    background: EA.violetDeep,
                    border: `2.5px solid ${EA.ink}`,
                    borderRadius: 16,
                    padding: "18px 8px",
                    cursor: submitting ? "not-allowed" : "pointer",
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
                    boxShadow: `3px 3px 0 ${EA.ink}`,
                    transition: "transform 0.12s, box-shadow 0.12s",
                    opacity: submitting ? 0.6 : 1,
                  }}
                  onMouseDown={e => {
                    const t = e.currentTarget;
                    t.style.transform = "translate(3px,3px)";
                    t.style.boxShadow = "none";
                  }}
                  onMouseUp={e => {
                    const t = e.currentTarget;
                    t.style.transform = "";
                    t.style.boxShadow = `3px 3px 0 ${EA.ink}`;
                  }}
                >
                  <div style={{ fontSize: 36 }}>{emoji}</div>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: 9, color: EA.cyan, letterSpacing: 1, transform: "skewX(-4deg)" }}>
                    {label}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* WAITING phase */}
        {phase === "waiting" && myMove && (
          <div style={{
            background: EA.violetDeep, border: `2.5px solid ${EA.ink}`,
            borderRadius: 20, padding: "28px 20px",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 14,
            boxShadow: `4px 4px 0 ${EA.cyan}`,
          }}>
            <div style={{ fontSize: 72 }}>{getMoveEmoji(myMove)}</div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 18, color: EA.white, transform: "skewX(-6deg)" }}>
              {MOVES.find(m => m.id === myMove)?.label}
            </div>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 800, color: "rgba(255,255,255,0.6)" }}>
              En attente de {opPseudo}...
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{
                  width: 10, height: 10, borderRadius: "50%",
                  background: i === 0 ? EA.cyan : i === 1 ? EA.pink : EA.butter,
                  border: `2px solid ${EA.ink}`,
                  animation: `ea-bounce 1.2s ease-in-out infinite ${i * 0.2}s`,
                }} />
              ))}
            </div>
          </div>
        )}

        {/* REVEALING phase */}
        {phase === "revealing" && revealingRound && (
          <div style={{
            background: EA.violetDeep, border: `2.5px solid ${EA.ink}`,
            borderRadius: 20, padding: "24px 16px",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 16,
            boxShadow: `4px 4px 0 ${getRoundColor(revealingRound)}`,
            animation: "ea-fade-in 0.3s ease-out",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 20, width: "100%", justifyContent: "center" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                <div style={{ fontSize: 56 }}>{getMoveEmoji(revealingRound.moves[myId] as PFCMove)}</div>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 10, color: EA.cyan, letterSpacing: 1 }}>MOI</div>
              </div>

              <div style={{
                fontFamily: "var(--font-display)", fontSize: 18, color: EA.white,
                transform: "skewX(-8deg) rotate(-6deg)",
                background: EA.pink, border: `2px solid ${EA.ink}`,
                width: 36, height: 36, borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: `2px 2px 0 ${EA.ink}`, flexShrink: 0,
              }}>VS</div>

              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                <div style={{ fontSize: 56 }}>{getMoveEmoji(revealingRound.moves[opponentId] as PFCMove)}</div>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 10, color: EA.pink, letterSpacing: 1 }}>{opPseudo.toUpperCase()}</div>
              </div>
            </div>

            <div style={{
              background: getRoundColor(revealingRound),
              border: `2.5px solid ${EA.ink}`,
              borderRadius: 999, padding: "6px 20px",
              fontFamily: "var(--font-display)", fontSize: 16,
              color: EA.ink, transform: "skewX(-8deg)",
              boxShadow: `3px 3px 0 ${EA.ink}`,
              animation: "ea-pulse 0.6s ease-out",
            }}>
              {getRoundWinnerLabel(revealingRound)}
            </div>
          </div>
        )}
      </div>

      {/* Previous rounds recap */}
      {pfcState.rounds.filter(r => Object.keys(r.moves).length === 2 && phase !== "revealing").length > 0 && (
        <div style={{ position: "relative", zIndex: 10, margin: "20px 20px 0" }}>
          <div style={{ fontFamily: "var(--font-sans)", fontSize: 9, fontWeight: 900, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: 2, marginBottom: 8 }}>
            Manches précédentes
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {pfcState.rounds.filter(r => Object.keys(r.moves).length === 2).map(r => (
              <div key={r.round} style={{
                background: "rgba(26,15,94,0.4)", border: `1.5px solid rgba(255,255,255,0.1)`,
                borderRadius: 10, padding: "8px 12px",
                display: "flex", alignItems: "center", justifyContent: "space-between",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontFamily: "var(--font-display)", fontSize: 9, color: "rgba(255,255,255,0.4)" }}>M{r.round}</span>
                  <span style={{ fontSize: 20 }}>{getMoveEmoji(r.moves[myId] as PFCMove)}</span>
                  <span style={{ fontFamily: "var(--font-display)", fontSize: 10, color: "rgba(255,255,255,0.3)" }}>vs</span>
                  <span style={{ fontSize: 20 }}>{getMoveEmoji(r.moves[opponentId] as PFCMove)}</span>
                </div>
                <div style={{
                  fontFamily: "var(--font-display)", fontSize: 9,
                  color: !r.winner_id ? EA.butter : r.winner_id === myId ? EA.cyan : EA.pink,
                  letterSpacing: 1,
                }}>
                  {!r.winner_id ? "ÉGAL" : r.winner_id === myId ? "WIN" : "LOSE"}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

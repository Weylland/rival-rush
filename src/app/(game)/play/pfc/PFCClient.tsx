"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { EA } from "@/lib/design";
import { Avatar } from "@/components/ui/avatar";
import { Star } from "@/components/ui/star";
import { submitPFCMove } from "./actions";
import { useIsDesktop } from "@/hooks/useIsDesktop";
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
  const desktop = useIsDesktop();
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
      .channel(`game-pfc-${gameId}`)
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
          if (lastRound && lastRound.moves[opponentId] && !lastRound.moves[myId]) setOpponentChose(true);
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
    try { await submitPFCMove(gameId, move); } finally { setSubmitting(false); }
  }

  const scores = pfcState.scores ?? { [myId]: 0, [opponentId]: 0 };
  const myScore = scores[myId] ?? 0;
  const opScore = scores[opponentId] ?? 0;
  const currentRoundNum = Math.min(pfcState.rounds.length + (phase === "picking" ? 1 : 0), 3);
  const activeRoundNum = phase === "revealing" && revealingRound ? revealingRound.round : currentRoundNum;

  const revealMyMove = revealingRound?.moves[myId] as PFCMove | undefined;
  const revealOpMove = revealingRound?.moves[opponentId] as PFCMove | undefined;
  const revealWin = revealingRound?.winner_id === myId;
  const revealDraw = revealingRound ? !revealingRound.winner_id : false;

  function getRoundWinnerLabel(round: PFCRound) {
    if (!round.winner_id) return "ÉGALITÉ !";
    return round.winner_id === myId ? "TU GAGNES ! 🎉" : `${opPseudo.toUpperCase()} GAGNE !`;
  }

  // ── Shared background ──────────────────────────────────────────────────────
  const BG = (
    <>
      <div aria-hidden style={{
        position: "absolute", inset: 0, opacity: 0.3,
        backgroundImage: `radial-gradient(circle, rgba(0,212,232,0.5) 1.2px, transparent 1.6px) 0 0 / 16px 16px`,
      }} />
      <svg viewBox="0 0 200 200" aria-hidden style={{ position: "absolute", width: desktop ? 500 : 340, height: desktop ? 400 : 220, top: -120, right: -80, opacity: 0.7, pointerEvents: "none" }} preserveAspectRatio="none">
        <path d="M 40 60 Q 30 20 80 25 Q 140 10 165 50 Q 195 90 175 140 Q 155 185 100 180 Q 40 190 25 140 Q 5 95 40 60 Z" fill={EA.pink} />
      </svg>
      <svg viewBox="0 0 200 200" aria-hidden style={{ position: "absolute", width: desktop ? 400 : 280, height: desktop ? 320 : 220, bottom: -100, left: -80, opacity: 0.5, pointerEvents: "none" }} preserveAspectRatio="none">
        <path d="M 50 30 Q 90 5 140 30 Q 195 50 180 110 Q 175 175 110 175 Q 30 180 25 120 Q 10 60 50 30 Z" fill={EA.cyan} />
      </svg>
      <Star color={EA.butter} size={desktop ? 22 : 18} style={{ top: desktop ? "8%" : 130, right: desktop ? "6%" : 32, transform: "rotate(20deg)" }} />
      <Star color={EA.white} size={desktop ? 14 : 12} style={{ top: desktop ? "20%" : 200, left: desktop ? "5%" : 26 }} />
      {desktop && <Star color={EA.cyan} size={16} style={{ bottom: "15%", right: "8%", transform: "rotate(-10deg)" }} />}
      {desktop && <Star color={EA.butter} size={12} style={{ bottom: "10%", left: "7%" }} />}
    </>
  );

  // ── Face-down card ─────────────────────────────────────────────────────────
  function FaceDownCard({ chose, height = 96 }: { chose: boolean; height?: number }) {
    return (
      <div style={{
        height,
        background: chose
          ? `repeating-linear-gradient(45deg, ${EA.pink} 0 12px, ${EA.violetDeep} 12px 24px)`
          : `repeating-linear-gradient(45deg, rgba(255,30,140,0.3) 0 12px, ${EA.violetDeep} 12px 24px)`,
        border: `2.5px solid ${EA.ink}`,
        borderRadius: 18,
        display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: `inset 0 0 0 4px ${EA.violet}`,
      }}>
        <div style={{
          background: chose ? EA.cyan : "rgba(255,255,255,0.15)",
          border: `2px solid ${EA.ink}`,
          borderRadius: 999, padding: "6px 14px",
          fontFamily: "var(--font-display)", fontSize: 14,
          color: chose ? EA.ink : "rgba(255,255,255,0.5)",
          transform: "skewX(-4deg) rotate(-3deg)",
          boxShadow: chose ? `2px 2px 0 ${EA.ink}` : "none",
        }}>
          {chose ? "✓ A CHOISI" : "?? CACHÉ ??"}
        </div>
      </div>
    );
  }

  // ── Choice buttons ─────────────────────────────────────────────────────────
  function ChoiceButtons({ vertical = false }: { vertical?: boolean }) {
    return (
      <div style={{ display: "flex", flexDirection: vertical ? "column" : "row", gap: vertical ? 12 : 8 }}>
        {MOVES.map(({ id, emoji, label, color, shadow }) => {
          const picked = phase === "waiting" && myMove === id;
          return (
            <button
              key={id}
              onClick={() => handlePick(id)}
              disabled={phase === "waiting" || submitting}
              style={{
                flex: vertical ? "unset" : 1,
                background: picked ? color : EA.white,
                border: `2.5px solid ${EA.ink}`,
                borderRadius: 24,
                padding: vertical ? "16px 28px" : "14px 8px 12px",
                display: "flex",
                flexDirection: vertical ? "row" : "column",
                alignItems: "center",
                gap: vertical ? 14 : 4,
                boxShadow: picked ? `5px 5px 0 ${shadow}, 5px 5px 0 1px ${EA.ink}` : `3px 3px 0 ${EA.violetDeep}`,
                transform: picked ? (vertical ? "translateX(4px)" : "translateY(-4px) rotate(-2deg)") : "none",
                cursor: phase === "picking" ? "pointer" : "default",
                position: "relative",
                transition: "transform 0.15s, box-shadow 0.15s",
              }}
            >
              {picked && (
                <div style={{
                  position: "absolute",
                  top: vertical ? "50%" : -10,
                  left: vertical ? -10 : "50%",
                  transform: vertical ? "translateY(-50%) rotate(-6deg)" : "translateX(-50%) rotate(-6deg)",
                  background: EA.butter, border: `2px solid ${EA.ink}`,
                  padding: "2px 8px", borderRadius: 999,
                  fontFamily: "var(--font-display)", fontSize: 9, color: EA.ink,
                  letterSpacing: 0.6, boxShadow: `2px 2px 0 ${EA.ink}`, whiteSpace: "nowrap",
                }}>TON CHOIX</div>
              )}
              <div style={{ fontSize: vertical ? 44 : 38, lineHeight: 1 }}>{emoji}</div>
              <div style={{
                fontFamily: "var(--font-display)", fontSize: vertical ? 18 : 12, color: EA.ink,
                textTransform: "uppercase", letterSpacing: 0.8, transform: "skewX(-4deg)",
              }}>{label}</div>
            </button>
          );
        })}
      </div>
    );
  }

  // ── DESKTOP LAYOUT ─────────────────────────────────────────────────────────
  if (desktop) {
    if (phase === "revealing" && revealingRound) {
      return (
        <div style={{ position: "relative", minHeight: "100dvh", background: EA.violet, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          {BG}
          <div style={{ position: "relative", zIndex: 5, flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 60px", gap: 32 }}>
            {/* Round label */}
            <div style={{ display: "inline-block", background: EA.violetDeep, border: `2px solid ${EA.ink}`, borderRadius: 999, padding: "4px 18px", fontFamily: "var(--font-display)", fontSize: 12, color: EA.cyan, letterSpacing: 1.4, boxShadow: `2px 2px 0 ${EA.pink}` }}>
              MANCHE {revealingRound.round} / 3 — RÉVÉLATION
            </div>
            {/* Result banner */}
            <div style={{ background: revealDraw ? EA.butter : revealWin ? EA.butter : EA.pink, border: `3px solid ${EA.ink}`, borderRadius: 20, padding: "12px 36px", transform: "rotate(-2deg)", boxShadow: `6px 6px 0 ${revealWin ? EA.pink : EA.cyan}, 6px 6px 0 1px ${EA.ink}` }}>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 44, color: EA.ink, transform: "skewX(-8deg)", textShadow: `3px 3px 0 ${EA.white}` }}>
                {getRoundWinnerLabel(revealingRound)}
              </div>
            </div>
            {/* Hands */}
            <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
              {/* My hand */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, position: "relative" }}>
                {revealWin && <div style={{ position: "absolute", top: -28, left: "50%", transform: "translateX(-50%) rotate(-8deg)", background: EA.butter, border: `2.5px solid ${EA.ink}`, borderRadius: 999, padding: "4px 14px", fontFamily: "var(--font-display)", fontSize: 13, color: EA.ink, boxShadow: `3px 3px 0 ${EA.ink}`, whiteSpace: "nowrap" }}>🏆 GAGNE</div>}
                <div style={{ width: 160, height: 160, borderRadius: 36, background: revealWin ? EA.butter : EA.white, border: `3px solid ${EA.ink}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 90, boxShadow: revealWin ? `6px 6px 0 ${EA.pink}, 6px 6px 0 1px ${EA.ink}` : `4px 4px 0 ${EA.violetDeep}`, transform: revealWin ? "rotate(-3deg) scale(1.05)" : (!revealDraw ? "rotate(4deg) scale(0.9)" : "none"), opacity: (!revealWin && !revealDraw) ? 0.65 : 1 }}>
                  {revealMyMove ? MOVES.find(m => m.id === revealMyMove)?.emoji : "?"}
                </div>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 18, color: EA.white, transform: "skewX(-4deg)" }}>{myPseudo.toUpperCase()}</div>
              </div>
              {/* VS */}
              <div style={{ width: 80, height: 80, borderRadius: "50%", background: EA.pink, border: `3px solid ${EA.ink}`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-display)", fontSize: 22, color: EA.white, transform: "skewX(-8deg) rotate(-6deg)", boxShadow: `4px 4px 0 ${EA.cyan}`, flexShrink: 0 }}>VS</div>
              {/* Opponent hand */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, position: "relative" }}>
                {!revealWin && !revealDraw && <div style={{ position: "absolute", top: -28, left: "50%", transform: "translateX(-50%) rotate(8deg)", background: EA.butter, border: `2.5px solid ${EA.ink}`, borderRadius: 999, padding: "4px 14px", fontFamily: "var(--font-display)", fontSize: 13, color: EA.ink, boxShadow: `3px 3px 0 ${EA.ink}`, whiteSpace: "nowrap" }}>🏆 GAGNE</div>}
                <div style={{ width: 160, height: 160, borderRadius: 36, background: (!revealWin && !revealDraw) ? EA.butter : EA.white, border: `3px solid ${EA.ink}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 90, boxShadow: (!revealWin && !revealDraw) ? `6px 6px 0 ${EA.pink}, 6px 6px 0 1px ${EA.ink}` : `4px 4px 0 ${EA.violetDeep}`, transform: (!revealWin && !revealDraw) ? "rotate(3deg) scale(1.05)" : (revealWin ? "rotate(-4deg) scale(0.9)" : "none"), opacity: (revealWin && !revealDraw) ? 0.65 : 1 }}>
                  {revealOpMove ? MOVES.find(m => m.id === revealOpMove)?.emoji : "?"}
                </div>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 18, color: "rgba(255,255,255,0.7)", transform: "skewX(-4deg)" }}>{opPseudo.toUpperCase()}</div>
              </div>
            </div>
            {/* Score */}
            <div style={{ background: EA.violetDeep, border: `2.5px solid ${EA.ink}`, borderRadius: 18, padding: "14px 28px", boxShadow: `4px 4px 0 ${EA.cyan}`, textAlign: "center" }}>
              <div style={{ fontFamily: "var(--font-sans)", fontSize: 10, fontWeight: 900, color: EA.cyan, textTransform: "uppercase", letterSpacing: 1.5 }}>Score du match</div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 28, color: EA.white, transform: "skewX(-6deg)", marginTop: 4 }}>
                {myPseudo.toUpperCase()} {myScore} — {opScore} {opPseudo.toUpperCase()}
              </div>
            </div>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 800, color: "rgba(255,255,255,0.45)" }}>auto dans 3 sec...</div>
          </div>
        </div>
      );
    }

    // Desktop picking / waiting
    return (
      <div style={{ position: "relative", minHeight: "100dvh", background: EA.violet, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {BG}
        {/* Top bar */}
        <div style={{ position: "relative", zIndex: 10, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 40px" }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 13, color: EA.cyan, transform: "skewX(-6deg)", letterSpacing: 1 }}>
            PIERRE · FEUILLE · CISEAUX
          </div>
          {/* Round dots */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
            <div style={{ display: "inline-block", background: EA.violetDeep, border: `2px solid ${EA.ink}`, borderRadius: 999, padding: "4px 16px", fontFamily: "var(--font-display)", fontSize: 11, color: EA.cyan, letterSpacing: 1.4, boxShadow: `2px 2px 0 ${EA.pink}` }}>
              MANCHE {activeRoundNum} / 3
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {[0, 1, 2].map(i => {
                const r = pfcState.rounds[i];
                const resolved = r && Object.keys(r.moves).length === 2;
                const bg = resolved ? (!r.winner_id ? EA.butter : r.winner_id === myId ? EA.cyan : EA.pink) : "rgba(255,255,255,0.2)";
                return <div key={i} style={{ width: 10, height: 10, borderRadius: "50%", background: bg, border: `2px solid ${EA.ink}` }} />;
              })}
            </div>
          </div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 13, color: "rgba(255,255,255,0.5)", transform: "skewX(-4deg)" }}>
            {myScore} — {opScore}
          </div>
        </div>

        {/* Main split */}
        <div style={{ position: "relative", zIndex: 5, flex: 1, display: "flex", alignItems: "stretch", gap: 0, padding: "0 40px 40px", minHeight: 0 }}>
          {/* LEFT — Opponent */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 24, padding: "32px 48px 32px 0", borderRight: `2px solid rgba(255,255,255,0.08)` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <Avatar name={opPseudo} color={EA.cyan} ring={EA.pink} size={56} />
              <div>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 22, color: EA.white, transform: "skewX(-4deg)", lineHeight: 1 }}>{opPseudo.toUpperCase()}</div>
                <div style={{ fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 800, color: opponentChose ? EA.cyan : "rgba(255,255,255,0.4)", marginTop: 4, display: "flex", alignItems: "center", gap: 6 }}>
                  {opponentChose ? <><span style={{ width: 7, height: 7, borderRadius: "50%", background: EA.cyan, boxShadow: `0 0 8px ${EA.cyan}`, display: "inline-block" }} />A choisi !</> : "Réfléchit..."}
                </div>
              </div>
            </div>
            <FaceDownCard chose={opponentChose} height={200} />
          </div>

          {/* CENTER — VS */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "0 32px", flexShrink: 0 }}>
            <div style={{ width: 80, height: 80, borderRadius: "50%", background: EA.butter, border: `3px solid ${EA.ink}`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-display)", fontSize: 28, color: EA.ink, transform: "skewX(-8deg) rotate(-6deg)", boxShadow: `4px 4px 0 ${EA.pink}` }}>VS</div>
          </div>

          {/* RIGHT — Me */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 24, padding: "32px 0 32px 48px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <Avatar name={myPseudo} color={EA.butter} ring={EA.cyan} size={56} />
              <div>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 22, color: EA.white, transform: "skewX(-4deg)", lineHeight: 1 }}>{myPseudo.toUpperCase()}</div>
                <div style={{ fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 900, color: EA.cyan, letterSpacing: 1, marginTop: 4 }}>MOI</div>
              </div>
            </div>
            <div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 30, color: EA.white, transform: "skewX(-8deg)", textShadow: `3px 3px 0 ${EA.violetDeep}`, marginBottom: 6 }}>
                {phase === "waiting" ? "EN ATTENTE..." : "À TOI DE JOUER !"}
              </div>
              <div style={{ fontFamily: "var(--font-sans)", fontStyle: "italic", fontSize: 13, fontWeight: 800, color: EA.cyan, marginBottom: 20 }}>
                {phase === "waiting" ? `${opPseudo} doit encore choisir 🔒` : "tape pour choisir, révélation simultanée 🔒"}
              </div>
              <ChoiceButtons vertical />
            </div>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: 1.2 }}>
              Tu · {myPseudo.toUpperCase()} · {myScore} — {opScore}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── MOBILE LAYOUT ──────────────────────────────────────────────────────────
  return (
    <div style={{ position: "absolute", inset: 0, background: EA.violet, overflow: "hidden" }}>
      {BG}

      {(phase === "picking" || phase === "waiting") && (
        <>
          <div style={{ position: "absolute", top: 56, left: 0, right: 0, padding: "0 18px" }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
              <div style={{ background: EA.violetDeep, border: `2px solid ${EA.ink}`, borderRadius: 999, padding: "4px 14px", fontFamily: "var(--font-display)", fontSize: 11, color: EA.cyan, letterSpacing: 1.4, boxShadow: `2px 2px 0 ${EA.pink}` }}>MANCHE {activeRoundNum} / 3</div>
            </div>
            <div style={{ background: "rgba(26,15,94,0.55)", border: `2.5px solid ${EA.ink}`, borderRadius: 22, padding: "14px 14px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Avatar name={opPseudo} color={EA.cyan} ring={EA.pink} size={36} />
                  <div>
                    <div style={{ fontFamily: "var(--font-display)", fontSize: 14, color: EA.white, transform: "skewX(-4deg)", lineHeight: 1 }}>{opPseudo.toUpperCase()}</div>
                    <div style={{ fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 800, color: opponentChose ? EA.cyan : "rgba(255,255,255,0.4)", marginTop: 2, display: "flex", alignItems: "center", gap: 5 }}>
                      {opponentChose ? <><span style={{ width: 6, height: 6, borderRadius: "50%", background: EA.cyan, boxShadow: `0 0 6px ${EA.cyan}`, display: "inline-block" }} />A choisi !</> : "Réfléchit..."}
                    </div>
                  </div>
                </div>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 22, color: EA.cyan, transform: "skewX(-8deg)" }}>{opScore} — {myScore}</div>
              </div>
              <FaceDownCard chose={opponentChose} height={96} />
            </div>
          </div>

          <div style={{ position: "absolute", top: 332, left: "50%", transform: "translate(-50%, -50%)", zIndex: 10 }}>
            <div style={{ width: 70, height: 70, borderRadius: "50%", background: EA.butter, border: `3px solid ${EA.ink}`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-display)", fontSize: 26, color: EA.ink, transform: "skewX(-8deg) rotate(-6deg)", boxShadow: `3px 3px 0 ${EA.pink}` }}>VS</div>
          </div>

          <div style={{ position: "absolute", bottom: 50, left: 0, right: 0, padding: "0 18px", zIndex: 5 }}>
            <div style={{ textAlign: "center", marginBottom: 10 }}>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 26, color: EA.white, transform: "skewX(-8deg)", textShadow: `3px 3px 0 ${EA.violetDeep}` }}>
                {phase === "waiting" ? "EN ATTENTE..." : "À TOI DE JOUER !"}
              </div>
              <div style={{ fontFamily: "var(--font-sans)", fontStyle: "italic", fontSize: 12, fontWeight: 800, color: EA.cyan, marginTop: 4 }}>
                {phase === "waiting" ? `${opPseudo} doit encore choisir 🔒` : "tape pour choisir, révélation simultanée 🔒"}
              </div>
            </div>
            <ChoiceButtons />
            <div style={{ marginTop: 12, textAlign: "center", fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,0.55)", textTransform: "uppercase", letterSpacing: 1.2 }}>
              Tu : {myPseudo.toUpperCase()} · {myScore} — {opScore}
            </div>
          </div>
        </>
      )}

      {phase === "revealing" && revealingRound && (
        <>
          <div style={{ position: "absolute", top: 60, left: 0, right: 0, textAlign: "center", zIndex: 5 }}>
            <div style={{ display: "inline-block", background: EA.violetDeep, border: `2px solid ${EA.ink}`, borderRadius: 999, padding: "4px 14px", fontFamily: "var(--font-display)", fontSize: 11, color: EA.cyan, letterSpacing: 1.4, boxShadow: `2px 2px 0 ${EA.pink}` }}>MANCHE {revealingRound.round} / 3 — RÉVÉLATION</div>
          </div>
          <div style={{ position: "absolute", top: 110, left: 16, right: 16, textAlign: "center", zIndex: 8 }}>
            <div style={{ display: "inline-block", background: revealDraw ? EA.butter : revealWin ? EA.butter : EA.pink, border: `3px solid ${EA.ink}`, borderRadius: 18, padding: "8px 20px", transform: "rotate(-2deg)", boxShadow: `5px 5px 0 ${revealWin ? EA.pink : EA.cyan}, 5px 5px 0 1px ${EA.ink}` }}>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 32, color: EA.ink, transform: "skewX(-8deg)", textShadow: `3px 3px 0 ${EA.white}` }}>{getRoundWinnerLabel(revealingRound)}</div>
            </div>
          </div>
          <div style={{ position: "absolute", top: 240, left: 12, right: 12, display: "flex", alignItems: "center", gap: 8, zIndex: 5 }}>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, position: "relative" }}>
              {revealWin && <div style={{ position: "absolute", top: -22, left: "50%", transform: "translateX(-50%) rotate(-8deg)", background: EA.butter, border: `2.5px solid ${EA.ink}`, borderRadius: 999, padding: "4px 12px", fontFamily: "var(--font-display)", fontSize: 12, color: EA.ink, boxShadow: `3px 3px 0 ${EA.ink}`, whiteSpace: "nowrap", zIndex: 5 }}>🏆 GAGNE</div>}
              <div style={{ width: 110, height: 110, borderRadius: 28, background: revealWin ? EA.butter : EA.white, border: `3px solid ${EA.ink}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 62, boxShadow: revealWin ? `5px 5px 0 ${EA.pink}, 5px 5px 0 1px ${EA.ink}` : `3px 3px 0 ${EA.violetDeep}`, transform: revealWin ? "rotate(-3deg) scale(1.05)" : (!revealDraw ? "rotate(4deg) scale(0.92)" : "none"), opacity: (!revealWin && !revealDraw) ? 0.7 : 1 }}>
                {revealMyMove ? MOVES.find(m => m.id === revealMyMove)?.emoji : "?"}
              </div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 14, color: EA.white, transform: "skewX(-4deg)", opacity: (!revealWin && !revealDraw) ? 0.6 : 1 }}>{myPseudo.toUpperCase()}</div>
            </div>
            <div style={{ flexShrink: 0, width: 56, height: 56, borderRadius: "50%", background: EA.pink, border: `2.5px solid ${EA.ink}`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-display)", fontSize: 18, color: EA.white, transform: "skewX(-8deg) rotate(-6deg)", boxShadow: `3px 3px 0 ${EA.cyan}` }}>VS</div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, position: "relative" }}>
              {!revealWin && !revealDraw && <div style={{ position: "absolute", top: -22, left: "50%", transform: "translateX(-50%) rotate(8deg)", background: EA.butter, border: `2.5px solid ${EA.ink}`, borderRadius: 999, padding: "4px 12px", fontFamily: "var(--font-display)", fontSize: 12, color: EA.ink, boxShadow: `3px 3px 0 ${EA.ink}`, whiteSpace: "nowrap", zIndex: 5 }}>🏆 GAGNE</div>}
              <div style={{ width: 110, height: 110, borderRadius: 28, background: (!revealWin && !revealDraw) ? EA.butter : EA.white, border: `3px solid ${EA.ink}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 62, boxShadow: (!revealWin && !revealDraw) ? `5px 5px 0 ${EA.pink}, 5px 5px 0 1px ${EA.ink}` : `3px 3px 0 ${EA.violetDeep}`, transform: (!revealWin && !revealDraw) ? "rotate(3deg) scale(1.05)" : (revealWin ? "rotate(-4deg) scale(0.92)" : "none"), opacity: (revealWin && !revealDraw) ? 0.7 : 1 }}>
                {revealOpMove ? MOVES.find(m => m.id === revealOpMove)?.emoji : "?"}
              </div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 14, color: EA.white, transform: "skewX(-4deg)", opacity: (revealWin && !revealDraw) ? 0.6 : 1 }}>{opPseudo.toUpperCase()}</div>
            </div>
          </div>
          <div style={{ position: "absolute", top: 420, left: 24, right: 24, background: EA.violetDeep, border: `2.5px solid ${EA.ink}`, borderRadius: 18, padding: "12px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", boxShadow: `4px 4px 0 ${EA.cyan}`, zIndex: 5 }}>
            <div>
              <div style={{ fontFamily: "var(--font-sans)", fontSize: 10, fontWeight: 900, color: EA.cyan, textTransform: "uppercase", letterSpacing: 1.2 }}>Score du match</div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 22, color: EA.white, transform: "skewX(-8deg)", marginTop: 2 }}>{myPseudo.toUpperCase()} {myScore} — {opScore} {opPseudo.toUpperCase()}</div>
            </div>
          </div>
          <div style={{ position: "absolute", bottom: 50, left: 24, right: 24, textAlign: "center", fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,0.55)", zIndex: 5 }}>auto dans 3 sec...</div>
          <Star color={EA.butter} size={22} style={{ top: 200, left: 24, transform: "rotate(15deg)" }} />
          <Star color={EA.white} size={14} style={{ top: 180, right: 30 }} />
        </>
      )}
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { RR } from "@/lib/design";
import { PreventLeave } from "@/components/PreventLeave";
import { RulesButton } from "@/components/ui/rules-button";
import { useGameOpponent } from "@/app/(game)/chat/ChatSystem";
import { submitMastermindGuess } from "./actions";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { useOpponentWatcher } from "@/hooks/useOpponentWatcher";
import { useGameSounds } from "@/hooks/useGameSounds";
import { useGamePresence } from "@/hooks/useGamePresence";
import { resolveDuo } from "@/lib/players";
import { MM_MAX_GUESSES } from "@/lib/mastermind";
import { COLORS, Gem, Pegs, EmptyPegs } from "./components/Gem";
import { PlayerBadge } from "./components/PlayerBadge";
import type { MastermindState, MastermindGuess, GameStatus } from "@/types/database";

const MAX_GUESSES = MM_MAX_GUESSES;

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props {
  gameId: string; myId: string;
  p1Id: string; p2Id: string;
  p1Pseudo: string; p2Pseudo: string;
  p1AvatarUrl: string | null; p2AvatarUrl: string | null;
  p1AvatarColor: string | null;
  p2AvatarColor: string | null;
  initialState: MastermindState;
  initialStatus: GameStatus;
  initialWinnerId: string | null;
}

// ── Component ─────────────────────────────────────────────────────────────────
export function MastermindClient({
  gameId, myId, p1Id, p2Id,
  p1Pseudo, p2Pseudo, p1AvatarUrl, p2AvatarUrl, p1AvatarColor, p2AvatarColor,
  initialState, initialStatus, initialWinnerId,
}: Props) {
  const router = useRouter();
  const desktop = useIsDesktop();
  const { opponentId, myPseudo, opPseudo, myAvatarUrl, opAvatarUrl, myAvatarColor, opAvatarColor } = resolveDuo({ myId, p1Id, p2Id, p1Pseudo, p2Pseudo, p1AvatarUrl, p2AvatarUrl, p1AvatarColor, p2AvatarColor });

  const [myBoard, setMyBoard]     = useState<MastermindGuess[]>(initialState.boards?.[myId] ?? []);
  const [opCount, setOpCount]     = useState<number>(initialState.boards?.[opponentId]?.length ?? 0);
  const [opCracked, setOpCracked] = useState<boolean>(
    (initialState.boards?.[opponentId] ?? []).some(g => g.blacks === 4)
  );
  const [revealedCode, setRevealedCode] = useState<number[] | null>(
    initialStatus === "finished" ? (initialState.revealed?.[myId] ?? null) : null
  );
  const [winnerId, setWinnerId]   = useState<string | null>(initialWinnerId);
  const [gameStatus, setGameStatus] = useState<GameStatus>(initialStatus);
  const [currentGuess, setCurrentGuess] = useState<(number | null)[]>([null, null, null, null]);
  const [submitting, setSubmitting]     = useState(false);

  const boardEndRef   = useRef<HTMLDivElement>(null);
  const isFinishedRef = useRef<boolean>(initialStatus === "finished");

  const iCracked   = myBoard.some(g => g.blacks === 4);
  const isFinished = gameStatus === "finished";
  const outOfGuesses = myBoard.length >= MAX_GUESSES;
  const canPlay    = !isFinished && !iCracked && !outOfGuesses;
  const guessReady = currentGuess.every(c => c !== null);
  const activeRow  = myBoard.length;

  useEffect(() => { isFinishedRef.current = isFinished; }, [isFinished]);
  useOpponentWatcher({ gameId, opponentId, isFinishedRef });
  useGameOpponent(opponentId, opPseudo);
  useGamePresence({ gameId, myId, myPseudo, gameType: "mastermind", initialFinished: initialStatus === "finished", isFinishedRef });
  const { play } = useGameSounds();

  // Auto-scroll vers le bas quand un essai est ajouté
  useEffect(() => {
    boardEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [myBoard.length]);

  // Realtime — on ne fait jamais régresser son propre plateau (anti perte d'écriture concurrente)
  useEffect(() => {
    const supabase = createClient();
    const sub = supabase
      .channel(`mastermind-${gameId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "games", filter: `id=eq.${gameId}` }, (payload) => {
        const updated = payload.new as { state: unknown; status: string; winner_id: string | null };
        const raw = updated.state as Record<string, unknown>;
        const boards = (raw && typeof raw.boards === "object" && raw.boards !== null
          ? raw.boards
          : {}) as Record<string, MastermindGuess[]>;

        const incomingMine = boards[myId] ?? [];
        setMyBoard(prev => incomingMine.length >= prev.length ? incomingMine : prev);

        const incomingOp = boards[opponentId] ?? [];
        setOpCount(prev => Math.max(prev, incomingOp.length));
        if (incomingOp.some(g => g.blacks === 4)) setOpCracked(true);

        setGameStatus(updated.status as GameStatus);
        setWinnerId(updated.winner_id);

        if (updated.status === "finished") {
          isFinishedRef.current = true;
          const revealed = (raw.revealed as Record<string, number[]> | undefined)?.[myId] ?? null;
          setRevealedCode(revealed);
          play(updated.winner_id === myId ? "win" : "lose");
          // Laisse le temps de voir le code révélé + la ligne gagnante avant le résultat
          setTimeout(() => router.replace(`/result?game_id=${gameId}`), 4500);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [gameId, myId, opponentId]); // eslint-disable-line react-hooks/exhaustive-deps

  function pickColor(idx: number) {
    if (!canPlay || submitting) return;
    const next = [...currentGuess];
    const first = next.findIndex(v => v === null);
    if (first === -1) return;
    next[first] = idx;
    setCurrentGuess(next);
  }

  function clearSlot(i: number) {
    if (!canPlay || submitting) return;
    const next = [...currentGuess];
    next[i] = null;
    setCurrentGuess(next);
  }

  function clearAll() {
    if (!canPlay || submitting) return;
    setCurrentGuess([null, null, null, null]);
  }

  async function handleSubmit() {
    if (!canPlay || submitting || !guessReady) return;
    setSubmitting(true);
    play("move");
    // Optimiste : on ajoute l'essai localement, le realtime confirmera le feedback
    const res = await submitMastermindGuess(gameId, currentGuess as number[]);
    if (res.ok) {
      setMyBoard(prev => {
        if (prev.length >= MAX_GUESSES) return prev;
        return [...prev, { guess: currentGuess as number[], blacks: res.blacks ?? 0, whites: res.whites ?? 0 }];
      });
      setCurrentGuess([null, null, null, null]);
      if (res.win) play("win");
    }
    setSubmitting(false);
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div style={{
      minHeight: "100dvh",
      background: RR.violet,
      display: "flex", flexDirection: "column", alignItems: "center",
      padding: desktop ? "20px 24px 100px" : "12px 14px 100px",
      gap: 12,
      position: "relative", overflow: "hidden",
    }}>

      {/* Dot grid */}
      <div aria-hidden style={{
        position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0,
        backgroundImage: "radial-gradient(circle, rgba(0,212,232,0.5) 1.3px, transparent 1.8px)",
        backgroundSize: "16px 16px", opacity: 0.22,
      }} />

      <div style={{ position: "relative", zIndex: 2, width: "100%", maxWidth: 460, display: "flex", flexDirection: "column", gap: 12 }}>

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div style={{
          display: "grid", gridTemplateColumns: "1fr auto 1fr",
          alignItems: "center", gap: 8,
        }}>
          <PlayerBadge
            pseudo={myPseudo} avatar={myAvatarUrl} avatarColor={myAvatarColor}
            guessCount={myBoard.length} cracked={iCracked} color={RR.cyan}
            active={canPlay}
            align="left"
          />
          <div style={{ textAlign: "center" }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 13, color: RR.white, letterSpacing: 2, transform: "skewX(-4deg)", lineHeight: 1.1 }}>
              🎨 MASTER
            </div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 13, color: RR.white, letterSpacing: 2, transform: "skewX(-4deg)", lineHeight: 1.1 }}>
              MIND
            </div>
          </div>
          <PlayerBadge
            pseudo={opPseudo} avatar={opAvatarUrl} avatarColor={opAvatarColor}
            guessCount={opCount} cracked={opCracked} color={RR.pink}
            active={!isFinished && !opCracked}
            align="right"
          />
        </div>

        {/* ── Ton code secret ─────────────────────────────────────────────── */}
        <div style={{
          background: RR.violetDeep,
          border: `2.5px solid ${revealedCode ? RR.butter : RR.ink}`,
          borderRadius: 18, padding: "12px 16px",
          boxShadow: revealedCode ? `3px 3px 0 ${RR.butter}` : `2px 2px 0 ${RR.ink}`,
          display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
        }}>
          <div style={{
            fontFamily: "var(--font-sans)", fontSize: 10, fontWeight: 900,
            color: revealedCode ? RR.butter : "rgba(255,255,255,0.4)",
            textTransform: "uppercase", letterSpacing: 2,
          }}>
            {revealedCode ? "🔓 TON CODE ÉTAIT…" : "🔒 TON CODE SECRET À CRAQUER"}
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            {(revealedCode ?? [null, null, null, null]).map((c, i) => (
              <Gem key={i} color={c} size={revealedCode ? 44 : 36} glow={!!revealedCode} />
            ))}
          </div>
        </div>

        {/* ── Plateau (uniquement mes essais) ─────────────────────────────── */}
        <div style={{
          background: RR.violetDeep,
          border: `2.5px solid ${RR.ink}`,
          borderRadius: 18,
          boxShadow: `2px 2px 0 ${RR.ink}`,
          overflow: "hidden",
        }}>
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "10px 16px 8px",
            borderBottom: `1.5px solid rgba(255,255,255,0.08)`,
          }}>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: 10, fontWeight: 900, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: 1.5 }}>
              Ton plateau
            </div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 12, color: "rgba(255,255,255,0.4)", transform: "skewX(-4deg)" }}>
              {activeRow} / {MAX_GUESSES} essais
            </div>
          </div>

          <div style={{ padding: "8px 10px", display: "flex", flexDirection: "column", gap: 6 }}>
            {/* Lignes jouées */}
            {myBoard.map((g, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "8px 10px",
                background: "rgba(255,255,255,0.04)",
                border: `1.5px solid rgba(255,255,255,0.08)`,
                borderRadius: 12,
              }}>
                <div style={{ width: 4, height: 36, borderRadius: 2, background: RR.cyan, flexShrink: 0 }} />
                <div style={{ width: 20, fontFamily: "var(--font-display)", fontSize: 11, color: "rgba(255,255,255,0.35)", textAlign: "right", flexShrink: 0 }}>
                  {i + 1}
                </div>
                <div style={{ display: "flex", gap: 8, flex: 1, justifyContent: "center" }}>
                  {g.guess.map((c, j) => <Gem key={j} color={c} size={36} />)}
                </div>
                <Pegs blacks={g.blacks} whites={g.whites} />
              </div>
            ))}

            {/* Ligne active */}
            {canPlay && (
              <div style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 10px",
                background: "rgba(0,212,232,0.08)",
                border: `2px solid ${RR.cyan}`,
                borderRadius: 12,
                boxShadow: `0 0 12px rgba(0,212,232,0.2)`,
              }}>
                <div style={{ width: 4, height: 40, borderRadius: 2, background: RR.cyan, flexShrink: 0 }} />
                <div style={{ width: 20, fontFamily: "var(--font-display)", fontSize: 11, color: RR.cyan, textAlign: "right", flexShrink: 0 }}>
                  {activeRow + 1}
                </div>
                <div style={{ display: "flex", gap: 8, flex: 1, justifyContent: "center" }}>
                  {currentGuess.map((c, i) => (
                    <Gem
                      key={i}
                      color={c}
                      size={40}
                      glow={c !== null}
                      onClick={c !== null ? () => clearSlot(i) : undefined}
                    />
                  ))}
                </div>
                <EmptyPegs />
              </div>
            )}

            <div ref={boardEndRef} />
          </div>
        </div>

        {/* ── Zone de saisie ──────────────────────────────────────────────── */}
        {!isFinished && (
          <div style={{
            background: RR.violetDeep,
            border: `2.5px solid ${RR.ink}`,
            borderRadius: 18,
            boxShadow: `2px 2px 0 ${RR.ink}`,
            padding: "14px 16px",
            display: "flex", flexDirection: "column", gap: 14,
          }}>
            <div style={{
              textAlign: "center",
              fontFamily: "var(--font-display)", fontSize: 14,
              color: iCracked ? RR.butter : canPlay ? RR.cyan : "rgba(255,255,255,0.4)",
              transform: "skewX(-4deg)",
              letterSpacing: 0.8,
            }}>
              {iCracked
                ? `✓ CODE CRAQUÉ — ON ATTEND ${opPseudo.toUpperCase()}…`
                : outOfGuesses
                  ? `😬 12 ESSAIS ÉPUISÉS — ON ATTEND ${opPseudo.toUpperCase()}…`
                  : opCracked
                    ? `⚡ ${opPseudo.toUpperCase()} A CRAQUÉ — VITE !`
                    : "🎯 CRAQUE TON CODE"}
            </div>

            {/* Palette */}
            <div style={{
              display: "flex", gap: desktop ? 10 : 7,
              justifyContent: "center",
              opacity: canPlay && !submitting ? 1 : 0.35,
              transition: "opacity 0.3s",
            }}>
              {COLORS.map((col, idx) => {
                const usedCount = currentGuess.filter(c => c === idx).length;
                return (
                  <div key={idx} style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                    <button
                      type="button"
                      disabled={!canPlay || submitting}
                      onClick={() => pickColor(idx)}
                      title={col.label}
                      style={{
                        width: desktop ? 50 : 44, height: desktop ? 50 : 44,
                        borderRadius: "50%",
                        background: `radial-gradient(circle at 35% 35%, ${col.bg}ff, ${col.bg}88)`,
                        border: `3px solid rgba(255,255,255,0.4)`,
                        cursor: !canPlay || submitting ? "not-allowed" : "pointer",
                        boxShadow: canPlay && !submitting
                          ? `0 0 16px 4px ${col.glow}, 0 4px 10px rgba(0,0,0,0.4), inset 0 1px 3px rgba(255,255,255,0.45)`
                          : "none",
                        position: "relative",
                        transition: "transform 0.1s",
                        flexShrink: 0,
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}
                    >
                      <span style={{ fontSize: desktop ? 20 : 17, color: "rgba(0,0,0,0.45)", lineHeight: 1, pointerEvents: "none", userSelect: "none" }}>
                        {col.symbol}
                      </span>
                    </button>
                    {usedCount > 0 && (
                      <div style={{
                        position: "absolute", top: -5, right: -5,
                        width: 16, height: 16, borderRadius: "50%",
                        background: RR.white, border: `2px solid ${RR.ink}`,
                        fontFamily: "var(--font-display)", fontSize: 9,
                        color: RR.ink, lineHeight: "13px", textAlign: "center",
                        zIndex: 1,
                      }}>{usedCount}</div>
                    )}
                    <div style={{ fontSize: 8, fontWeight: 900, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: 0.5 }}>
                      {col.label.slice(0, 3)}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Boutons */}
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                disabled={!canPlay || submitting || currentGuess.every(c => c === null)}
                onClick={clearAll}
                style={{
                  flexShrink: 0, width: 52, height: 52,
                  background: "rgba(255,255,255,0.07)",
                  border: `2.5px solid ${RR.ink}`,
                  borderRadius: 14,
                  boxShadow: `2px 2px 0 ${RR.ink}`,
                  cursor: (!canPlay || submitting || currentGuess.every(c => c === null)) ? "not-allowed" : "pointer",
                  fontFamily: "var(--font-display)", fontSize: 18,
                  color: RR.white,
                  opacity: (!canPlay || submitting || currentGuess.every(c => c === null)) ? 0.3 : 1,
                  transition: "opacity 0.15s",
                }}
              >⌫</button>

              <button
                type="button"
                disabled={!canPlay || !guessReady || submitting}
                onClick={handleSubmit}
                style={{
                  flex: 1, height: 52,
                  background: (!canPlay || !guessReady || submitting)
                    ? "rgba(255,255,255,0.06)"
                    : RR.cyan,
                  border: `2.5px solid ${RR.ink}`,
                  borderRadius: 14,
                  boxShadow: (!canPlay || !guessReady || submitting)
                    ? `2px 2px 0 ${RR.ink}`
                    : `3px 3px 0 ${RR.ink}`,
                  cursor: (!canPlay || !guessReady || submitting) ? "not-allowed" : "pointer",
                  fontFamily: "var(--font-display)", fontSize: 15,
                  color: (!canPlay || !guessReady || submitting) ? "rgba(255,255,255,0.2)" : RR.ink,
                  letterSpacing: 1,
                  transition: "all 0.15s",
                }}
              >
                {submitting ? "…" : guessReady ? "✓ CONFIRMER" : "CHOISIS 4 COULEURS"}
              </button>
            </div>

            {/* Légende */}
            <div style={{
              display: "flex", gap: 20, justifyContent: "center", alignItems: "center",
              fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.35)",
              textTransform: "uppercase", letterSpacing: 0.8,
            }}>
              <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ display: "inline-block", width: 12, height: 12, borderRadius: "50%", background: "#0d0d1a", border: "2px solid rgba(255,255,255,0.35)", verticalAlign: "middle" }} />
                Bonne place
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ display: "inline-block", width: 12, height: 12, borderRadius: "50%", background: "#e8e8f8", border: "2px solid rgba(0,0,0,0.35)", boxShadow: "0 0 5px rgba(255,255,255,0.4)", verticalAlign: "middle" }} />
                Mauvaise place
              </span>
            </div>
          </div>
        )}
      </div>

      <RulesButton gameType="mastermind" />
      <PreventLeave enabled={!isFinished} gameId={gameId} />
    </div>
  );
}

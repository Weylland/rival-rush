"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { EA } from "@/lib/design";
import { Avatar } from "@/components/ui/avatar";
import { GameChat } from "@/components/GameChat";
import { PreventLeave } from "@/components/PreventLeave";
import { RulesButton } from "@/components/ui/rules-button";
import { submitMastermindGuess } from "./actions";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { useOpponentWatcher } from "@/hooks/useOpponentWatcher";
import { useGameSounds } from "@/hooks/useGameSounds";
import type { MastermindState, MastermindGuess, GameStatus } from "@/types/database";

const MAX_GUESSES = 12;

// ── Palette bijou ─────────────────────────────────────────────────────────────
const COLORS = [
  { bg: "#FF2D78", glow: "rgba(255,45,120,0.7)",  label: "Rubis"    },
  { bg: "#00D4E8", glow: "rgba(0,212,232,0.7)",   label: "Saphir"   },
  { bg: "#FFE94A", glow: "rgba(255,233,74,0.7)",  label: "Or"       },
  { bg: "#4ADE80", glow: "rgba(74,222,128,0.7)",  label: "Émeraude" },
  { bg: "#C084FC", glow: "rgba(192,132,252,0.7)", label: "Améthyste"},
  { bg: "#FB923C", glow: "rgba(251,146,60,0.7)",  label: "Ambre"    },
];

// ── Gem dot ───────────────────────────────────────────────────────────────────
function Gem({ color, size = 24, glow = false, empty = false, onClick }: {
  color: number | null;
  size?: number;
  glow?: boolean;
  empty?: boolean;
  onClick?: () => void;
}) {
  const c = color !== null ? COLORS[color] : null;
  return (
    <div
      onClick={onClick}
      style={{
        width: size, height: size,
        borderRadius: "50%",
        flexShrink: 0,
        cursor: onClick ? "pointer" : "default",
        background: c
          ? `radial-gradient(circle at 35% 35%, ${c.bg}ff, ${c.bg}99)`
          : empty
            ? "rgba(255,255,255,0.06)"
            : "rgba(255,255,255,0.04)",
        border: c
          ? `2px solid rgba(255,255,255,0.4)`
          : `2px solid rgba(255,255,255,0.1)`,
        boxShadow: c && glow
          ? `0 0 12px 2px ${c.glow}, inset 0 1px 2px rgba(255,255,255,0.4)`
          : c
            ? `0 2px 6px rgba(0,0,0,0.4), inset 0 1px 2px rgba(255,255,255,0.3)`
            : "none",
        transition: "box-shadow 0.2s, transform 0.1s",
      }}
    />
  );
}

// ── Pegs 2×2 ─────────────────────────────────────────────────────────────────
function Pegs({ blacks, whites, size = 8 }: { blacks: number; whites: number; size?: number }) {
  const list = [
    ...Array(blacks).fill("black"),
    ...Array(whites).fill("white"),
    ...Array(4 - blacks - whites).fill("empty"),
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 3 }}>
      {list.map((p, i) => (
        <div key={i} style={{
          width: size, height: size, borderRadius: "50%",
          background:
            p === "black" ? "#1a0f4e" :
            p === "white" ? "#f0f0ff" :
            "rgba(255,255,255,0.08)",
          border:
            p === "empty"
              ? "1.5px solid rgba(255,255,255,0.1)"
              : "1.5px solid rgba(0,0,0,0.4)",
          boxShadow: p === "black" ? "inset 0 1px 2px rgba(255,255,255,0.15)" :
                     p === "white" ? "0 0 4px rgba(255,255,255,0.5)" : "none",
        }} />
      ))}
    </div>
  );
}

// ── Board row ─────────────────────────────────────────────────────────────────
function BoardRow({
  rowIndex, guess, currentGuess, isActive, isMyTurn, myId,
  onClearSlot, gemSize, pegSize,
}: {
  rowIndex: number;
  guess: MastermindGuess | null;
  currentGuess: (number | null)[];
  isActive: boolean;
  isMyTurn: boolean;
  myId: string;
  onClearSlot: (i: number) => void;
  gemSize: number;
  pegSize: number;
}) {
  const dots = guess
    ? guess.guess
    : isActive
      ? currentGuess
      : [null, null, null, null];

  const isPlayed = guess !== null;
  const isMe = guess ? guess.player_id === myId : isMyTurn;

  return (
    <div style={{
      display: "flex", alignItems: "center",
      gap: 10,
      padding: "6px 10px",
      borderRadius: 12,
      background: isActive
        ? isMyTurn
          ? "rgba(0,212,232,0.08)"
          : "rgba(255,45,120,0.06)"
        : "transparent",
      border: isActive
        ? `1.5px solid ${isMyTurn ? "rgba(0,212,232,0.35)" : "rgba(255,45,120,0.2)"}`
        : "1.5px solid transparent",
      opacity: !isPlayed && !isActive ? 0.3 : 1,
      transition: "opacity 0.2s, background 0.3s",
    }}>
      {/* Numéro */}
      <div style={{
        width: 18, flexShrink: 0, textAlign: "right",
        fontFamily: "var(--font-display)", fontSize: 10,
        color: isActive ? (isMyTurn ? EA.cyan : EA.pink) : "rgba(255,255,255,0.25)",
      }}>
        {rowIndex + 1}
      </div>

      {/* Joueur badge */}
      <div style={{
        width: 4, height: 28, borderRadius: 2, flexShrink: 0,
        background: isPlayed
          ? (isMe ? EA.cyan : EA.pink)
          : isActive
            ? (isMyTurn ? EA.cyan : EA.pink)
            : "rgba(255,255,255,0.1)",
        opacity: isPlayed || isActive ? 1 : 0.3,
      }} />

      {/* Gems */}
      <div style={{ display: "flex", gap: 7, flex: 1, justifyContent: "center" }}>
        {dots.map((c, i) => (
          <Gem
            key={i}
            color={c}
            size={gemSize}
            glow={isActive && c !== null}
            empty={!isPlayed && !isActive}
            onClick={isActive && isMyTurn && c !== null ? () => onClearSlot(i) : undefined}
          />
        ))}
      </div>

      {/* Pegs */}
      <div style={{ width: pegSize * 2 + 3, flexShrink: 0 }}>
        {isPlayed ? (
          <Pegs blacks={guess!.blacks} whites={guess!.whites} size={pegSize} />
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 3 }}>
            {[0,1,2,3].map(i => (
              <div key={i} style={{
                width: pegSize, height: pegSize, borderRadius: "50%",
                background: "rgba(255,255,255,0.05)",
                border: "1.5px solid rgba(255,255,255,0.08)",
              }} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props {
  gameId: string; myId: string;
  p1Id: string; p2Id: string;
  p1Pseudo: string; p2Pseudo: string;
  p1AvatarUrl: string | null; p2AvatarUrl: string | null;
  initialState: MastermindState;
  initialStatus: GameStatus;
  initialCurrentTurn: string | null;
  initialWinnerId: string | null;
}

// ── Component ─────────────────────────────────────────────────────────────────
export function MastermindClient({
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

  const [guesses, setGuesses] = useState<MastermindGuess[]>(initialState.guesses ?? []);
  const [revealedCode, setRevealedCode] = useState<number[] | null>(
    initialStatus === "finished" ? initialState.code : null
  );
  const [currentTurn, setCurrentTurn] = useState<string | null>(initialCurrentTurn);
  const [gameStatus, setGameStatus] = useState<GameStatus>(initialStatus);
  const [currentGuess, setCurrentGuess] = useState<(number | null)[]>([null, null, null, null]);
  const [submitting, setSubmitting] = useState(false);

  const boardRef = useRef<HTMLDivElement>(null);
  const isFinishedRef = useRef<boolean>(initialStatus === "finished");
  const forfeitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isMyTurn = currentTurn === myId;
  const isFinished = gameStatus === "finished";
  const guessReady = currentGuess.every(c => c !== null);
  const activeRow = guesses.length; // index of current active row

  const gemSize = desktop ? 30 : 26;
  const pegSize = desktop ? 10 : 9;

  useEffect(() => { isFinishedRef.current = isFinished; }, [isFinished]);
  useOpponentWatcher({ gameId, opponentId, isFinishedRef });
  const { play } = useGameSounds();

  // Auto-scroll board to active row
  useEffect(() => {
    if (boardRef.current) {
      const rows = boardRef.current.querySelectorAll("[data-row]");
      const activeEl = rows[activeRow] as HTMLElement | undefined;
      activeEl?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [guesses.length, activeRow]);

  // Presence + forfeit
  useEffect(() => {
    if (forfeitTimerRef.current) { clearTimeout(forfeitTimerRef.current); forfeitTimerRef.current = null; }
    const supabase = createClient();
    const up = () => supabase.from("presence").upsert({
      player_id: myId, pseudo: myPseudo,
      status: "in-game", game_type: "mastermind",
      updated_at: new Date().toISOString(),
    }).then(() => {});
    up();
    const hb = setInterval(up, 30_000);
    return () => {
      clearInterval(hb);
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
      .channel(`mastermind-${gameId}`)
      .on("postgres_changes", {
        event: "UPDATE", schema: "public", table: "games",
        filter: `id=eq.${gameId}`,
      }, (payload) => {
        const updated = payload.new as { state: unknown; status: string; current_turn: string | null; winner_id: string | null };
        const raw = updated.state as Record<string, unknown>;
        const newState: MastermindState = raw && "code" in raw
          ? (raw as unknown as MastermindState)
          : { code: [], guesses: [] };
        setGuesses(newState.guesses ?? []);
        setCurrentTurn(updated.current_turn);
        setGameStatus(updated.status as GameStatus);
        if (updated.current_turn === myId) play("notify");
        if (updated.status === "finished") {
          isFinishedRef.current = true;
          setRevealedCode(newState.code);
          play(updated.winner_id === myId ? "win" : "lose");
          setTimeout(() => router.push(`/result?game_id=${gameId}`), 2200);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [gameId, myId]); // eslint-disable-line react-hooks/exhaustive-deps

  function pickColor(colorIdx: number) {
    if (!isMyTurn || submitting) return;
    const next = [...currentGuess];
    const firstEmpty = next.findIndex(v => v === null);
    if (firstEmpty === -1) return; // already full
    next[firstEmpty] = colorIdx;
    setCurrentGuess(next);
  }

  function clearSlot(slotIdx: number) {
    if (!isMyTurn || submitting) return;
    const next = [...currentGuess];
    next[slotIdx] = null;
    setCurrentGuess(next);
  }

  function clearAll() {
    if (!isMyTurn || submitting) return;
    setCurrentGuess([null, null, null, null]);
  }

  async function handleSubmit() {
    if (!isMyTurn || submitting || !guessReady) return;
    setSubmitting(true);
    play("move");
    const res = await submitMastermindGuess(gameId, currentGuess as number[]);
    if (res.ok) setCurrentGuess([null, null, null, null]);
    setSubmitting(false);
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{
      minHeight: "100dvh",
      background: `
        radial-gradient(ellipse at 15% 15%, rgba(120,0,200,0.35) 0%, transparent 50%),
        radial-gradient(ellipse at 85% 85%, rgba(0,80,180,0.3) 0%, transparent 50%),
        radial-gradient(ellipse at 50% 50%, rgba(0,20,60,0.8) 0%, transparent 70%),
        #050510
      `,
      display: "flex", flexDirection: "column", alignItems: "center",
      padding: desktop ? "20px 24px 40px" : "12px 12px 28px",
      gap: desktop ? 16 : 10,
      fontFamily: "var(--font-sans)",
      position: "relative", overflow: "hidden",
    }}>

      {/* Subtle dot grid */}
      <div aria-hidden style={{
        position: "fixed", inset: 0,
        backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.04) 1px, transparent 1px)",
        backgroundSize: "20px 20px", pointerEvents: "none", zIndex: 0,
      }} />

      {/* ── Header ────────────────────────────────────────────────────── */}
      <div style={{
        width: "100%", maxWidth: 420,
        position: "relative", zIndex: 2,
        display: "flex", alignItems: "center", gap: 8,
      }}>
        {/* Moi */}
        {[
          { id: myId, pseudo: myPseudo, avatar: myAvatarUrl, color: EA.cyan, align: "left" },
          { id: opponentId, pseudo: opPseudo, avatar: opAvatarUrl, color: EA.pink, align: "right" },
        ].map((p, i) => {
          const active = currentTurn === p.id && !isFinished;
          const myGuessCount = guesses.filter(g => g.player_id === p.id).length;
          return (
            <div key={p.id} style={{
              flex: 1,
              display: "flex", flexDirection: i === 1 ? "row-reverse" : "row",
              alignItems: "center", gap: 8,
            }}>
              <div style={{
                padding: 2, borderRadius: "50%",
                border: `2.5px solid ${active ? p.color : "transparent"}`,
                boxShadow: active ? `0 0 14px ${p.color}` : "none",
                transition: "border 0.3s, box-shadow 0.3s",
                flexShrink: 0,
              }}>
                <Avatar name={p.pseudo} src={p.avatar} color={p.color} ring="transparent" size={38} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                <div style={{
                  fontFamily: "var(--font-display)", fontSize: 11,
                  color: active ? p.color : "rgba(255,255,255,0.5)",
                  transform: "skewX(-4deg)",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  transition: "color 0.3s",
                }}>{p.pseudo.toUpperCase()}</div>
                <div style={{
                  fontSize: 9, fontWeight: 900,
                  color: "rgba(255,255,255,0.3)",
                  textTransform: "uppercase", letterSpacing: 0.8,
                }}>{myGuessCount} essai{myGuessCount !== 1 ? "s" : ""}</div>
              </div>
            </div>
          );
        })}

        {/* Centre — titre */}
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          flexShrink: 0,
        }}>
          <div style={{
            fontFamily: "var(--font-display)", fontSize: desktop ? 11 : 10,
            color: "rgba(255,255,255,0.6)", letterSpacing: 2,
            textTransform: "uppercase", transform: "skewX(-4deg)",
          }}>MASTER</div>
          <div style={{
            fontFamily: "var(--font-display)", fontSize: desktop ? 11 : 10,
            color: "rgba(255,255,255,0.6)", letterSpacing: 2,
            textTransform: "uppercase", transform: "skewX(-4deg)",
          }}>MIND</div>
        </div>
      </div>

      {/* ── Code secret ───────────────────────────────────────────────── */}
      <div style={{
        position: "relative", zIndex: 2,
        display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
        background: "rgba(255,255,255,0.04)",
        border: `1.5px solid rgba(255,255,255,0.1)`,
        borderRadius: 16, padding: "10px 20px",
        width: "100%", maxWidth: 420,
      }}>
        <div style={{
          fontSize: 9, fontWeight: 900, color: "rgba(255,255,255,0.35)",
          textTransform: "uppercase", letterSpacing: 1.6,
        }}>Code secret</div>
        <div style={{ display: "flex", gap: 10 }}>
          {(revealedCode ?? [null, null, null, null]).map((c, i) => (
            <div key={i} style={{
              width: gemSize, height: gemSize, borderRadius: "50%",
              background: revealedCode
                ? `radial-gradient(circle at 35% 35%, ${COLORS[c!].bg}ff, ${COLORS[c!].bg}88)`
                : "rgba(255,255,255,0.05)",
              border: revealedCode
                ? "2px solid rgba(255,255,255,0.4)"
                : "2px dashed rgba(255,255,255,0.15)",
              boxShadow: revealedCode
                ? `0 0 16px 3px ${COLORS[c!].glow}, inset 0 1px 2px rgba(255,255,255,0.4)`
                : "none",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 12,
              transition: "all 0.5s",
            }}>
              {!revealedCode && <span style={{ opacity: 0.3 }}>?</span>}
            </div>
          ))}
        </div>
        {revealedCode && (
          <div style={{
            fontSize: 9, fontWeight: 900, color: EA.butter,
            textTransform: "uppercase", letterSpacing: 1.2,
            animation: "mm-fadein 0.4s ease",
          }}>Révélé !</div>
        )}
      </div>

      {/* ── Plateau ───────────────────────────────────────────────────── */}
      <div
        ref={boardRef}
        style={{
          width: "100%", maxWidth: 420,
          position: "relative", zIndex: 2,
          background: "rgba(255,255,255,0.025)",
          border: "1.5px solid rgba(255,255,255,0.08)",
          borderRadius: 20,
          padding: "8px 6px",
          overflowY: "auto",
          maxHeight: desktop ? 420 : 320,
          display: "flex", flexDirection: "column", gap: 2,
        }}
      >
        {Array.from({ length: MAX_GUESSES }).map((_, i) => (
          <div key={i} data-row={i}>
            <BoardRow
              rowIndex={i}
              guess={guesses[i] ?? null}
              currentGuess={currentGuess}
              isActive={i === activeRow && !isFinished}
              isMyTurn={isMyTurn}
              myId={myId}
              onClearSlot={clearSlot}
              gemSize={gemSize}
              pegSize={pegSize}
            />
          </div>
        ))}
      </div>

      {/* ── Zone saisie ───────────────────────────────────────────────── */}
      {!isFinished && (
        <div style={{
          width: "100%", maxWidth: 420,
          position: "relative", zIndex: 2,
          display: "flex", flexDirection: "column", gap: 10,
        }}>
          {/* Status */}
          <div style={{
            textAlign: "center",
            fontSize: 11, fontWeight: 900,
            color: isMyTurn ? EA.cyan : "rgba(255,255,255,0.3)",
            textTransform: "uppercase", letterSpacing: 1.4,
            animation: !isMyTurn ? "none" : "none",
          }}>
            {isMyTurn ? "🎯 À toi de jouer" : `⏳ En attente de ${opPseudo}…`}
          </div>

          {/* Palette de couleurs */}
          <div style={{
            display: "flex", gap: desktop ? 10 : 8,
            justifyContent: "center",
            opacity: isMyTurn && !submitting ? 1 : 0.3,
            transition: "opacity 0.3s",
          }}>
            {COLORS.map((col, idx) => {
              const usedCount = currentGuess.filter(c => c === idx).length;
              return (
                <button
                  key={idx}
                  type="button"
                  disabled={!isMyTurn || submitting}
                  onClick={() => pickColor(idx)}
                  title={col.label}
                  style={{
                    width: desktop ? 44 : 38, height: desktop ? 44 : 38,
                    borderRadius: "50%",
                    background: `radial-gradient(circle at 35% 35%, ${col.bg}ff, ${col.bg}99)`,
                    border: `2.5px solid rgba(255,255,255,0.35)`,
                    cursor: !isMyTurn || submitting ? "not-allowed" : "pointer",
                    boxShadow: isMyTurn && !submitting
                      ? `0 0 14px 3px ${col.glow}, 0 4px 8px rgba(0,0,0,0.4), inset 0 1px 2px rgba(255,255,255,0.4)`
                      : "none",
                    position: "relative",
                    transition: "transform 0.1s, box-shadow 0.15s",
                    flexShrink: 0,
                  }}
                >
                  {usedCount > 0 && (
                    <div style={{
                      position: "absolute", top: -4, right: -4,
                      width: 14, height: 14, borderRadius: "50%",
                      background: EA.white, border: `1.5px solid ${EA.ink}`,
                      fontFamily: "var(--font-display)", fontSize: 8,
                      color: EA.ink, lineHeight: "12px", textAlign: "center",
                    }}>{usedCount}</div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Boutons action */}
          <div style={{ display: "flex", gap: 8 }}>
            {/* Effacer */}
            <button
              type="button"
              disabled={!isMyTurn || submitting || currentGuess.every(c => c === null)}
              onClick={clearAll}
              style={{
                flex: "0 0 auto",
                height: 48,
                paddingInline: 16,
                background: "rgba(255,255,255,0.06)",
                border: "2px solid rgba(255,255,255,0.12)",
                borderRadius: 14,
                cursor: (!isMyTurn || submitting || currentGuess.every(c => c === null)) ? "not-allowed" : "pointer",
                fontFamily: "var(--font-display)", fontSize: 12,
                color: "rgba(255,255,255,0.4)",
                transition: "opacity 0.15s",
                opacity: (!isMyTurn || submitting || currentGuess.every(c => c === null)) ? 0.4 : 1,
              }}
            >⌫</button>

            {/* Confirmer */}
            <button
              type="button"
              disabled={!isMyTurn || !guessReady || submitting}
              onClick={handleSubmit}
              style={{
                flex: 1,
                height: 48,
                background: (!isMyTurn || !guessReady || submitting)
                  ? "rgba(255,255,255,0.05)"
                  : `linear-gradient(135deg, #00D4E8, #7B4FFF)`,
                border: `2.5px solid ${(!isMyTurn || !guessReady || submitting) ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.3)"}`,
                borderRadius: 14,
                boxShadow: (!isMyTurn || !guessReady || submitting)
                  ? "none"
                  : "0 0 20px rgba(0,212,232,0.4), 0 4px 12px rgba(0,0,0,0.4)",
                cursor: (!isMyTurn || !guessReady || submitting) ? "not-allowed" : "pointer",
                fontFamily: "var(--font-display)", fontSize: desktop ? 15 : 13,
                color: (!isMyTurn || !guessReady || submitting) ? "rgba(255,255,255,0.2)" : EA.white,
                letterSpacing: 1,
                transition: "all 0.2s",
              }}
            >
              {submitting ? "…" : guessReady ? "✓ CONFIRMER" : "CHOISIS 4 COULEURS"}
            </button>
          </div>

          {/* Légende pegs */}
          <div style={{
            display: "flex", gap: 16, justifyContent: "center",
            fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.25)",
            textTransform: "uppercase", letterSpacing: 0.8,
          }}>
            <span>⚫ Bonne place</span>
            <span>⚪ Mauvaise place</span>
          </div>
        </div>
      )}

      <RulesButton gameType="mastermind" />
      <GameChat gameId={gameId} myId={myId} myPseudo={myPseudo} opponentId={opponentId} opponentPseudo={opPseudo} />
      <PreventLeave enabled={!isFinished} />

      <style>{`
        @keyframes mm-fadein {
          from { opacity: 0; transform: translateY(-4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

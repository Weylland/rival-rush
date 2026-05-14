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

const COLORS = [
  { bg: "#FF2D78", glow: "rgba(255,45,120,0.6)",  label: "Rubis",     symbol: "♦" },
  { bg: "#00D4E8", glow: "rgba(0,212,232,0.6)",   label: "Saphir",    symbol: "★" },
  { bg: "#FFE94A", glow: "rgba(255,233,74,0.6)",  label: "Or",        symbol: "▲" },
  { bg: "#4ADE80", glow: "rgba(74,222,128,0.6)",  label: "Émeraude",  symbol: "●" },
  { bg: "#C084FC", glow: "rgba(192,132,252,0.6)", label: "Améthyste", symbol: "■" },
  { bg: "#FB923C", glow: "rgba(251,146,60,0.6)",  label: "Ambre",     symbol: "✕" },
];

// ── Gem ───────────────────────────────────────────────────────────────────────
function Gem({ color, size = 42, glow = false, onClick }: {
  color: number | null;
  size?: number;
  glow?: boolean;
  onClick?: () => void;
}) {
  const c = color !== null ? COLORS[color] : null;
  const symbolSize = Math.round(size * 0.42);
  return (
    <div
      onClick={onClick}
      style={{
        width: size, height: size, borderRadius: "50%", flexShrink: 0,
        cursor: onClick ? "pointer" : "default",
        background: c
          ? `radial-gradient(circle at 35% 35%, ${c.bg}ff, ${c.bg}88)`
          : "rgba(255,255,255,0.08)",
        border: c
          ? `2.5px solid rgba(255,255,255,0.45)`
          : `2.5px dashed rgba(255,255,255,0.2)`,
        boxShadow: c && glow
          ? `0 0 16px 4px ${c.glow}, inset 0 1px 3px rgba(255,255,255,0.5)`
          : c
            ? `0 3px 8px rgba(0,0,0,0.5), inset 0 1px 2px rgba(255,255,255,0.35)`
            : "none",
        transition: "transform 0.1s, box-shadow 0.15s",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      {c && (
        <span style={{
          fontSize: symbolSize,
          color: "rgba(0,0,0,0.45)",
          lineHeight: 1,
          userSelect: "none",
          pointerEvents: "none",
        }}>{c.symbol}</span>
      )}
    </div>
  );
}

// ── Pegs 2×2 ──────────────────────────────────────────────────────────────────
function Pegs({ blacks, whites }: { blacks: number; whites: number }) {
  const list = [
    ...Array(blacks).fill("black"),
    ...Array(whites).fill("white"),
    ...Array(4 - blacks - whites).fill("empty"),
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5 }}>
      {list.map((p, i) => (
        <div key={i} style={{
          width: 14, height: 14, borderRadius: "50%",
          background:
            p === "black" ? "#0d0d1a" :
            p === "white" ? "#e8e8f8" :
            "rgba(255,255,255,0.1)",
          border:
            p === "black" ? "2px solid rgba(255,255,255,0.35)" :
            p === "white" ? "2px solid rgba(0,0,0,0.35)" :
            "1.5px solid rgba(255,255,255,0.15)",
          boxShadow: p === "white" ? "0 0 6px rgba(255,255,255,0.5)" : "none",
        }} />
      ))}
    </div>
  );
}

// ── EmptyPegs ─────────────────────────────────────────────────────────────────
function EmptyPegs() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5 }}>
      {[0,1,2,3].map(i => (
        <div key={i} style={{
          width: 14, height: 14, borderRadius: "50%",
          background: "rgba(255,255,255,0.06)",
          border: "1.5px solid rgba(255,255,255,0.12)",
        }} />
      ))}
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
  const myPseudo   = myId === p1Id ? p1Pseudo : p2Pseudo;
  const opPseudo   = myId === p1Id ? p2Pseudo : p1Pseudo;
  const myAvatarUrl = myId === p1Id ? p1AvatarUrl : p2AvatarUrl;
  const opAvatarUrl = myId === p1Id ? p2AvatarUrl : p1AvatarUrl;

  const [guesses, setGuesses]           = useState<MastermindGuess[]>(initialState.guesses ?? []);
  const [revealedCode, setRevealedCode] = useState<number[] | null>(
    initialStatus === "finished" ? initialState.code : null
  );
  const [currentTurn, setCurrentTurn]   = useState<string | null>(initialCurrentTurn);
  const [gameStatus, setGameStatus]     = useState<GameStatus>(initialStatus);
  const [currentGuess, setCurrentGuess] = useState<(number | null)[]>([null, null, null, null]);
  const [submitting, setSubmitting]     = useState(false);

  const boardEndRef   = useRef<HTMLDivElement>(null);
  const isFinishedRef = useRef<boolean>(initialStatus === "finished");
  const forfeitRef    = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isMyTurn   = currentTurn === myId;
  const isFinished = gameStatus === "finished";
  const guessReady = currentGuess.every(c => c !== null);
  const activeRow  = guesses.length;

  useEffect(() => { isFinishedRef.current = isFinished; }, [isFinished]);
  useOpponentWatcher({ gameId, opponentId, isFinishedRef });
  const { play } = useGameSounds();

  // Auto-scroll to bottom when new guess added
  useEffect(() => {
    boardEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [guesses.length]);

  // Presence + forfeit
  useEffect(() => {
    if (forfeitRef.current) { clearTimeout(forfeitRef.current); forfeitRef.current = null; }
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
        forfeitRef.current = setTimeout(() => {
          forfeitRef.current = null;
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
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "games", filter: `id=eq.${gameId}` }, (payload) => {
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

  function pickColor(idx: number) {
    if (!isMyTurn || submitting) return;
    const next = [...currentGuess];
    const first = next.findIndex(v => v === null);
    if (first === -1) return;
    next[first] = idx;
    setCurrentGuess(next);
  }

  function clearSlot(i: number) {
    if (!isMyTurn || submitting) return;
    const next = [...currentGuess];
    next[i] = null;
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

  const myGuessCount = guesses.filter(g => g.player_id === myId).length;
  const opGuessCount = guesses.filter(g => g.player_id === opponentId).length;

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div style={{
      minHeight: "100dvh",
      background: EA.violet,
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
          {/* Moi */}
          <PlayerBadge
            pseudo={myPseudo} avatar={myAvatarUrl}
            guessCount={myGuessCount} color={EA.cyan}
            active={currentTurn === myId && !isFinished}
            align="left"
          />
          {/* Titre */}
          <div style={{ textAlign: "center" }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 13, color: EA.white, letterSpacing: 2, transform: "skewX(-4deg)", lineHeight: 1.1 }}>
              🎨 MASTER
            </div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 13, color: EA.white, letterSpacing: 2, transform: "skewX(-4deg)", lineHeight: 1.1 }}>
              MIND
            </div>
          </div>
          {/* Adversaire */}
          <PlayerBadge
            pseudo={opPseudo} avatar={opAvatarUrl}
            guessCount={opGuessCount} color={EA.pink}
            active={currentTurn === opponentId && !isFinished}
            align="right"
          />
        </div>

        {/* ── Code secret ─────────────────────────────────────────────────── */}
        <div style={{
          background: EA.violetDeep,
          border: `2.5px solid ${revealedCode ? EA.butter : EA.ink}`,
          borderRadius: 18, padding: "12px 16px",
          boxShadow: revealedCode ? `3px 3px 0 ${EA.butter}` : `2px 2px 0 ${EA.ink}`,
          display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
        }}>
          <div style={{
            fontFamily: "var(--font-sans)", fontSize: 10, fontWeight: 900,
            color: revealedCode ? EA.butter : "rgba(255,255,255,0.4)",
            textTransform: "uppercase", letterSpacing: 2,
          }}>
            {revealedCode ? "🔓 CODE RÉVÉLÉ !" : "🔒 CODE SECRET"}
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            {(revealedCode ?? [null, null, null, null]).map((c, i) => (
              <Gem
                key={i}
                color={c}
                size={revealedCode ? 44 : 36}
                glow={!!revealedCode}
              />
            ))}
          </div>
        </div>

        {/* ── Plateau — seulement les essais joués + ligne active ─────────── */}
        <div style={{
          background: EA.violetDeep,
          border: `2.5px solid ${EA.ink}`,
          borderRadius: 18,
          boxShadow: `2px 2px 0 ${EA.ink}`,
          overflow: "hidden",
        }}>
          {/* Sous-titre / compteur */}
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "10px 16px 8px",
            borderBottom: `1.5px solid rgba(255,255,255,0.08)`,
          }}>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: 10, fontWeight: 900, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: 1.5 }}>
              Plateau
            </div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 12, color: "rgba(255,255,255,0.4)", transform: "skewX(-4deg)" }}>
              {activeRow} / {MAX_GUESSES} essais
            </div>
          </div>

          <div style={{ padding: "8px 10px", display: "flex", flexDirection: "column", gap: 6 }}>
            {/* Lignes jouées */}
            {guesses.map((g, i) => {
              const isMe = g.player_id === myId;
              const playerColor = isMe ? EA.cyan : EA.pink;
              return (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "8px 10px",
                  background: "rgba(255,255,255,0.04)",
                  border: `1.5px solid rgba(255,255,255,0.08)`,
                  borderRadius: 12,
                }}>
                  {/* Barre joueur */}
                  <div style={{ width: 4, height: 36, borderRadius: 2, background: playerColor, flexShrink: 0 }} />
                  {/* Numéro */}
                  <div style={{ width: 20, fontFamily: "var(--font-display)", fontSize: 11, color: "rgba(255,255,255,0.35)", textAlign: "right", flexShrink: 0 }}>
                    {i + 1}
                  </div>
                  {/* Gems */}
                  <div style={{ display: "flex", gap: 8, flex: 1, justifyContent: "center" }}>
                    {g.guess.map((c, j) => <Gem key={j} color={c} size={36} />)}
                  </div>
                  {/* Pegs */}
                  <Pegs blacks={g.blacks} whites={g.whites} />
                </div>
              );
            })}

            {/* Ligne active */}
            {!isFinished && activeRow < MAX_GUESSES && (
              <div style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 10px",
                background: isMyTurn ? "rgba(0,212,232,0.08)" : "rgba(255,45,120,0.06)",
                border: `2px solid ${isMyTurn ? EA.cyan : EA.pink}`,
                borderRadius: 12,
                boxShadow: isMyTurn ? `0 0 12px rgba(0,212,232,0.2)` : "none",
              }}>
                {/* Barre joueur */}
                <div style={{ width: 4, height: 40, borderRadius: 2, background: isMyTurn ? EA.cyan : EA.pink, flexShrink: 0 }} />
                {/* Numéro */}
                <div style={{ width: 20, fontFamily: "var(--font-display)", fontSize: 11, color: isMyTurn ? EA.cyan : EA.pink, textAlign: "right", flexShrink: 0 }}>
                  {activeRow + 1}
                </div>
                {/* Slots */}
                <div style={{ display: "flex", gap: 8, flex: 1, justifyContent: "center" }}>
                  {currentGuess.map((c, i) => (
                    <Gem
                      key={i}
                      color={c}
                      size={40}
                      glow={c !== null && isMyTurn}
                      onClick={isMyTurn && c !== null ? () => clearSlot(i) : undefined}
                    />
                  ))}
                </div>
                {/* Empty pegs */}
                <EmptyPegs />
              </div>
            )}

            {/* Sentinel pour auto-scroll */}
            <div ref={boardEndRef} />
          </div>
        </div>

        {/* ── Zone de saisie ──────────────────────────────────────────────── */}
        {!isFinished && (
          <div style={{
            background: EA.violetDeep,
            border: `2.5px solid ${EA.ink}`,
            borderRadius: 18,
            boxShadow: `2px 2px 0 ${EA.ink}`,
            padding: "14px 16px",
            display: "flex", flexDirection: "column", gap: 14,
          }}>
            {/* Status */}
            <div style={{
              textAlign: "center",
              fontFamily: "var(--font-display)", fontSize: 14,
              color: isMyTurn ? EA.cyan : "rgba(255,255,255,0.4)",
              transform: "skewX(-4deg)",
              letterSpacing: 0.8,
            }}>
              {isMyTurn ? "🎯 À TOI DE JOUER" : `⏳ ${opPseudo.toUpperCase()} RÉFLÉCHIT…`}
            </div>

            {/* Palette */}
            <div style={{
              display: "flex", gap: desktop ? 10 : 7,
              justifyContent: "center",
              opacity: isMyTurn && !submitting ? 1 : 0.35,
              transition: "opacity 0.3s",
            }}>
              {COLORS.map((col, idx) => {
                const usedCount = currentGuess.filter(c => c === idx).length;
                return (
                  <div key={idx} style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                    <button
                      type="button"
                      disabled={!isMyTurn || submitting}
                      onClick={() => pickColor(idx)}
                      title={col.label}
                      style={{
                        width: desktop ? 50 : 44, height: desktop ? 50 : 44,
                        borderRadius: "50%",
                        background: `radial-gradient(circle at 35% 35%, ${col.bg}ff, ${col.bg}88)`,
                        border: `3px solid rgba(255,255,255,0.4)`,
                        cursor: !isMyTurn || submitting ? "not-allowed" : "pointer",
                        boxShadow: isMyTurn && !submitting
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
                    {/* Compteur d'usage */}
                    {usedCount > 0 && (
                      <div style={{
                        position: "absolute", top: -5, right: -5,
                        width: 16, height: 16, borderRadius: "50%",
                        background: EA.white, border: `2px solid ${EA.ink}`,
                        fontFamily: "var(--font-display)", fontSize: 9,
                        color: EA.ink, lineHeight: "13px", textAlign: "center",
                        zIndex: 1,
                      }}>{usedCount}</div>
                    )}
                    {/* Label */}
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
                disabled={!isMyTurn || submitting || currentGuess.every(c => c === null)}
                onClick={clearAll}
                style={{
                  flexShrink: 0, width: 52, height: 52,
                  background: "rgba(255,255,255,0.07)",
                  border: `2.5px solid ${EA.ink}`,
                  borderRadius: 14,
                  boxShadow: `2px 2px 0 ${EA.ink}`,
                  cursor: (!isMyTurn || submitting || currentGuess.every(c => c === null)) ? "not-allowed" : "pointer",
                  fontFamily: "var(--font-display)", fontSize: 18,
                  color: EA.white,
                  opacity: (!isMyTurn || submitting || currentGuess.every(c => c === null)) ? 0.3 : 1,
                  transition: "opacity 0.15s",
                }}
              >⌫</button>

              <button
                type="button"
                disabled={!isMyTurn || !guessReady || submitting}
                onClick={handleSubmit}
                style={{
                  flex: 1, height: 52,
                  background: (!isMyTurn || !guessReady || submitting)
                    ? "rgba(255,255,255,0.06)"
                    : EA.cyan,
                  border: `2.5px solid ${EA.ink}`,
                  borderRadius: 14,
                  boxShadow: (!isMyTurn || !guessReady || submitting)
                    ? `2px 2px 0 ${EA.ink}`
                    : `3px 3px 0 ${EA.ink}`,
                  cursor: (!isMyTurn || !guessReady || submitting) ? "not-allowed" : "pointer",
                  fontFamily: "var(--font-display)", fontSize: 15,
                  color: (!isMyTurn || !guessReady || submitting) ? "rgba(255,255,255,0.2)" : EA.ink,
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
      <GameChat gameId={gameId} myId={myId} myPseudo={myPseudo} opponentId={opponentId} opponentPseudo={opPseudo} />
      <PreventLeave enabled={!isFinished} gameId={gameId} />
    </div>
  );
}

// ── PlayerBadge ───────────────────────────────────────────────────────────────
function PlayerBadge({ pseudo, avatar, guessCount, color, active, align }: {
  pseudo: string; avatar: string | null;
  guessCount: number; color: string;
  active: boolean; align: "left" | "right";
}) {
  return (
    <div style={{
      display: "flex",
      flexDirection: align === "right" ? "row-reverse" : "row",
      alignItems: "center", gap: 8,
    }}>
      <div style={{
        padding: 2, borderRadius: "50%", flexShrink: 0,
        border: `2.5px solid ${active ? color : "transparent"}`,
        boxShadow: active ? `0 0 12px ${color}` : "none",
        transition: "border 0.3s, box-shadow 0.3s",
      }}>
        <Avatar name={pseudo} src={avatar} color={color} ring="transparent" size={36} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0, textAlign: align }}>
        <div style={{
          fontFamily: "var(--font-display)", fontSize: 11,
          color: active ? color : "rgba(255,255,255,0.5)",
          transform: "skewX(-4deg)",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          transition: "color 0.3s",
        }}>{pseudo.toUpperCase()}</div>
        <div style={{ fontSize: 9, fontWeight: 900, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: 0.8 }}>
          {guessCount} essai{guessCount !== 1 ? "s" : ""}
        </div>
      </div>
    </div>
  );
}

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

// ── 6 couleurs ────────────────────────────────────────────────────────────────
const COLORS = [
  { bg: EA.cyan,    label: "Cyan"   },
  { bg: EA.pink,    label: "Rose"   },
  { bg: EA.butter,  label: "Jaune"  },
  { bg: "#4ADE80",  label: "Vert"   },
  { bg: "#A78BFA",  label: "Violet" },
  { bg: "#FB923C",  label: "Orange" },
];

function ColorDot({ color, size = 22, border = true, onClick, dim }: {
  color: number | null;
  size?: number;
  border?: boolean;
  onClick?: () => void;
  dim?: boolean;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        width: size, height: size, borderRadius: "50%",
        background: color !== null ? COLORS[color].bg : "rgba(255,255,255,0.1)",
        border: border ? `2px solid ${color !== null ? EA.ink : "rgba(255,255,255,0.2)"}` : "none",
        cursor: onClick ? "pointer" : "default",
        flexShrink: 0,
        opacity: dim ? 0.4 : 1,
        transition: "opacity 0.2s, transform 0.1s",
        boxShadow: color !== null && onClick ? `0 0 0 0` : "none",
      }}
    />
  );
}

function PegFeedback({ blacks, whites, size = 10 }: { blacks: number; whites: number; size?: number }) {
  const pegs = [
    ...Array(blacks).fill("black"),
    ...Array(whites).fill("white"),
    ...Array(4 - blacks - whites).fill("empty"),
  ];
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "1fr 1fr",
      gap: 3, width: size * 2 + 3, flexShrink: 0,
    }}>
      {pegs.map((p, i) => (
        <div key={i} style={{
          width: size, height: size, borderRadius: "50%",
          background: p === "black" ? EA.ink : p === "white" ? EA.white : "rgba(255,255,255,0.1)",
          border: p === "empty" ? "1.5px solid rgba(255,255,255,0.15)" : `1.5px solid ${EA.ink}`,
        }} />
      ))}
    </div>
  );
}

function GuessRow({ g, myId, myPseudo, opPseudo, isLatest }: {
  g: MastermindGuess;
  myId: string;
  myPseudo: string;
  opPseudo: string;
  isLatest: boolean;
}) {
  const isMe = g.player_id === myId;
  const pseudo = isMe ? myPseudo : opPseudo;
  const color = isMe ? EA.cyan : EA.pink;

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      padding: "6px 10px",
      background: isLatest ? "rgba(255,255,255,0.06)" : "transparent",
      borderRadius: 10,
      border: isLatest ? `1px solid rgba(255,255,255,0.1)` : "1px solid transparent",
      transition: "background 0.3s",
    }}>
      {/* Pseudo tag */}
      <div style={{
        fontFamily: "var(--font-display)", fontSize: 9,
        color, transform: "skewX(-4deg)",
        width: 52, flexShrink: 0, overflow: "hidden",
        textOverflow: "ellipsis", whiteSpace: "nowrap",
        textAlign: "right",
      }}>{pseudo.toUpperCase()}</div>

      {/* 4 dots */}
      <div style={{ display: "flex", gap: 5 }}>
        {g.guess.map((c, i) => <ColorDot key={i} color={c} size={20} />)}
      </div>

      {/* Pegs */}
      <PegFeedback blacks={g.blacks} whites={g.whites} size={9} />

      {/* Label */}
      {g.blacks === 4 && (
        <div style={{
          fontFamily: "var(--font-display)", fontSize: 9,
          color: EA.butter, transform: "skewX(-4deg)",
        }}>✓ TROUVÉ</div>
      )}
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
  const [selectedSlot, setSelectedSlot] = useState<number>(0);
  const [submitting, setSubmitting] = useState(false);

  const historyRef = useRef<HTMLDivElement>(null);
  const isFinishedRef = useRef<boolean>(initialStatus === "finished");
  const forfeitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isMyTurn = currentTurn === myId;
  const isFinished = gameStatus === "finished";
  const guessReady = currentGuess.every(c => c !== null);
  const guessesLeft = MAX_GUESSES - guesses.length;

  useEffect(() => { isFinishedRef.current = isFinished; }, [isFinished]);
  useOpponentWatcher({ gameId, opponentId, isFinishedRef });
  const { play } = useGameSounds();

  // Auto-scroll history
  useEffect(() => {
    if (historyRef.current) {
      historyRef.current.scrollTop = historyRef.current.scrollHeight;
    }
  }, [guesses]);

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
    next[selectedSlot] = colorIdx;
    setCurrentGuess(next);
    // Avance au slot suivant vide
    const nextEmpty = next.findIndex((v, i) => i > selectedSlot && v === null);
    if (nextEmpty !== -1) setSelectedSlot(nextEmpty);
    else {
      const firstEmpty = next.findIndex(v => v === null);
      if (firstEmpty !== -1) setSelectedSlot(firstEmpty);
    }
  }

  function clearSlot(slotIdx: number) {
    if (!isMyTurn || submitting) return;
    const next = [...currentGuess];
    next[slotIdx] = null;
    setCurrentGuess(next);
    setSelectedSlot(slotIdx);
  }

  async function handleSubmit() {
    if (!isMyTurn || submitting || !guessReady) return;
    setSubmitting(true);
    play("move");
    const res = await submitMastermindGuess(gameId, currentGuess as number[]);
    if (res.ok) {
      setCurrentGuess([null, null, null, null]);
      setSelectedSlot(0);
    }
    setSubmitting(false);
  }

  const dotSize = desktop ? 26 : 22;
  const slotSize = desktop ? 32 : 28;

  return (
    <div style={{
      minHeight: "100dvh",
      background: `linear-gradient(160deg, ${EA.violetDeep} 0%, #1a1050 60%, #0d0826 100%)`,
      display: "flex", flexDirection: "column", alignItems: "center",
      padding: desktop ? "24px 24px 48px" : "14px 14px 36px",
      gap: desktop ? 18 : 12,
      fontFamily: "var(--font-sans)",
      position: "relative", overflow: "hidden",
    }}>
      {/* Dot grid bg */}
      <div style={{
        position: "fixed", inset: 0,
        backgroundImage: "radial-gradient(circle, rgba(0,212,232,0.1) 1px, transparent 1.4px)",
        backgroundSize: "18px 18px", pointerEvents: "none", zIndex: 0,
      }} />

      {/* Header joueurs */}
      <div style={{
        width: "100%", maxWidth: 480,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        position: "relative", zIndex: 2,
      }}>
        {[
          { id: myId, pseudo: myPseudo, avatar: myAvatarUrl, color: EA.cyan },
          { id: opponentId, pseudo: opPseudo, avatar: opAvatarUrl, color: EA.pink },
        ].map((p, i) => {
          const active = currentTurn === p.id && !isFinished;
          return (
            <div key={p.id} style={{ display: "flex", flexDirection: i === 1 ? "row-reverse" : "row", alignItems: "center", gap: 8 }}>
              <div style={{
                padding: 2, borderRadius: "50%",
                border: active ? `3px solid ${p.color}` : `3px solid transparent`,
                boxShadow: active ? `0 0 10px ${p.color}` : "none",
                transition: "border 0.3s, box-shadow 0.3s",
              }}>
                <Avatar name={p.pseudo} src={p.avatar} color={p.color} ring={EA.ink} size={40} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 2, alignItems: i === 1 ? "flex-end" : "flex-start" }}>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 11, color: EA.white, transform: "skewX(-4deg)", maxWidth: 80, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {p.pseudo.toUpperCase()}
                </div>
                <div style={{ fontSize: 9, fontWeight: 900, color: p.color, textTransform: "uppercase", letterSpacing: 1 }}>
                  {guesses.filter(g => g.player_id === p.id).length} essai{guesses.filter(g => g.player_id === p.id).length !== 1 ? "s" : ""}
                </div>
              </div>
            </div>
          );
        })}

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: desktop ? 13 : 11, color: "rgba(255,255,255,0.5)", transform: "skewX(-6deg)" }}>
            {guessesLeft} essai{guessesLeft !== 1 ? "s" : ""}
          </div>
          <div style={{ fontSize: 9, fontWeight: 900, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: 1 }}>restant{guessesLeft !== 1 ? "s" : ""}</div>
        </div>
      </div>

      {/* Code secret (révélé en fin) */}
      {revealedCode && (
        <div style={{
          position: "relative", zIndex: 2,
          display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
          background: "rgba(255,233,74,0.12)", border: `2px solid ${EA.butter}`,
          borderRadius: 14, padding: "10px 20px",
        }}>
          <div style={{ fontSize: 10, fontWeight: 900, color: EA.butter, textTransform: "uppercase", letterSpacing: 1.2 }}>
            Code secret
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {revealedCode.map((c, i) => <ColorDot key={i} color={c} size={28} />)}
          </div>
        </div>
      )}

      {/* Historique */}
      <div
        ref={historyRef}
        style={{
          width: "100%", maxWidth: 480,
          flex: 1, minHeight: 0,
          maxHeight: desktop ? 340 : 240,
          overflowY: "auto",
          display: "flex", flexDirection: "column", gap: 3,
          position: "relative", zIndex: 2,
          paddingRight: 4,
        }}
      >
        {guesses.length === 0 && (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            height: 80,
            fontSize: 12, fontWeight: 800, color: "rgba(255,255,255,0.2)",
            textTransform: "uppercase", letterSpacing: 1,
          }}>
            Aucun essai encore
          </div>
        )}
        {guesses.map((g, i) => (
          <GuessRow
            key={i}
            g={g}
            myId={myId}
            myPseudo={myPseudo}
            opPseudo={opPseudo}
            isLatest={i === guesses.length - 1}
          />
        ))}
      </div>

      {/* Zone de saisie */}
      {!isFinished && (
        <div style={{
          width: "100%", maxWidth: 480,
          position: "relative", zIndex: 2,
          background: isMyTurn ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.02)",
          border: `2px solid ${isMyTurn ? "rgba(0,212,232,0.3)" : "rgba(255,255,255,0.08)"}`,
          borderRadius: 18, padding: desktop ? "16px 18px" : "12px 14px",
          display: "flex", flexDirection: "column", gap: 12,
          transition: "border 0.3s",
        }}>
          {/* Titre */}
          <div style={{
            fontSize: 10, fontWeight: 900,
            color: isMyTurn ? EA.cyan : "rgba(255,255,255,0.3)",
            textTransform: "uppercase", letterSpacing: 1.4,
            textAlign: "center",
          }}>
            {isMyTurn ? "🎯 Ton essai" : `En attente de ${opPseudo}…`}
          </div>

          {/* Slots du guess courant */}
          <div style={{ display: "flex", gap: 10, justifyContent: "center", alignItems: "center" }}>
            {currentGuess.map((c, i) => (
              <div
                key={i}
                onClick={() => isMyTurn && clearSlot(i)}
                style={{
                  width: slotSize, height: slotSize, borderRadius: "50%",
                  background: c !== null ? COLORS[c].bg : "rgba(255,255,255,0.08)",
                  border: selectedSlot === i && isMyTurn
                    ? `3px solid ${EA.white}`
                    : `2.5px solid rgba(255,255,255,${c !== null ? "0.4" : "0.15"})`,
                  cursor: isMyTurn && c !== null ? "pointer" : isMyTurn ? "default" : "not-allowed",
                  boxShadow: selectedSlot === i && isMyTurn ? `0 0 0 2px rgba(255,255,255,0.2)` : "none",
                  transition: "border 0.15s, box-shadow 0.15s",
                  flexShrink: 0,
                }}
              />
            ))}

            {/* Bouton valider */}
            <button
              type="button"
              disabled={!isMyTurn || !guessReady || submitting}
              onClick={handleSubmit}
              style={{
                marginLeft: 8,
                height: slotSize + 6, paddingInline: desktop ? 18 : 14,
                background: (!isMyTurn || !guessReady || submitting) ? "rgba(255,255,255,0.06)" : EA.cyan,
                border: `2.5px solid ${(!isMyTurn || !guessReady || submitting) ? "rgba(255,255,255,0.1)" : EA.ink}`,
                borderRadius: 12,
                boxShadow: (!isMyTurn || !guessReady || submitting) ? "none" : `3px 3px 0 ${EA.ink}`,
                cursor: (!isMyTurn || !guessReady || submitting) ? "not-allowed" : "pointer",
                fontFamily: "var(--font-display)", fontSize: desktop ? 13 : 11,
                color: (!isMyTurn || !guessReady || submitting) ? "rgba(255,255,255,0.2)" : EA.ink,
                whiteSpace: "nowrap",
                transition: "background 0.15s",
              }}
            >
              ✓ OK
            </button>
          </div>

          {/* Palette de couleurs */}
          <div style={{ display: "flex", gap: desktop ? 10 : 8, justifyContent: "center", flexWrap: "wrap" }}>
            {COLORS.map((col, idx) => (
              <button
                key={idx}
                type="button"
                disabled={!isMyTurn || submitting}
                onClick={() => pickColor(idx)}
                style={{
                  width: dotSize + 8, height: dotSize + 8,
                  borderRadius: "50%",
                  background: col.bg,
                  border: `2.5px solid ${EA.ink}`,
                  cursor: !isMyTurn || submitting ? "not-allowed" : "pointer",
                  boxShadow: !isMyTurn || submitting ? "none" : `2px 2px 0 ${EA.ink}`,
                  opacity: !isMyTurn || submitting ? 0.35 : 1,
                  transition: "opacity 0.15s, transform 0.1s",
                  flexShrink: 0,
                }}
              />
            ))}
          </div>

          {/* Hint */}
          {isMyTurn && (
            <div style={{
              textAlign: "center", fontSize: 9, fontWeight: 700,
              color: "rgba(255,255,255,0.25)", textTransform: "uppercase", letterSpacing: 0.8,
            }}>
              Clique un slot pour le vider · Clique une couleur pour la placer
            </div>
          )}
        </div>
      )}

      <RulesButton gameType="mastermind" />
      <GameChat gameId={gameId} myId={myId} myPseudo={myPseudo} opponentId={opponentId} opponentPseudo={opPseudo} />
      <PreventLeave enabled={!isFinished} />
    </div>
  );
}

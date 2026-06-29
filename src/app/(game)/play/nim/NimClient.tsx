"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { RR } from "@/lib/design";
import { Avatar } from "@/components/ui/avatar";
import { useGameOpponent } from "@/app/(game)/chat/ChatSystem";
import { PreventLeave } from "@/components/PreventLeave";
import { RulesButton } from "@/components/ui/rules-button";
import { takeNim } from "./actions";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { useOpponentWatcher } from "@/hooks/useOpponentWatcher";
import { useGameSounds } from "@/hooks/useGameSounds";
import { useGamePresence } from "@/hooks/useGamePresence";
import { resolveDuo } from "@/lib/players";
import { getPileColor, AllumettesGrid } from "./components/Allumettes";
import type { NimState, GameStatus } from "@/types/database";

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
  p1AvatarColor: string | null;
  p2AvatarColor: string | null;
  initialState: NimState;
  initialStatus: GameStatus;
  initialCurrentTurn: string | null;
  initialWinnerId: string | null;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function NimClient({
  gameId, myId, p1Id, p2Id,
  p1Pseudo, p2Pseudo, p1AvatarUrl, p2AvatarUrl, p1AvatarColor, p2AvatarColor,
  initialState, initialStatus, initialCurrentTurn,
}: Props) {
  const router = useRouter();
  const desktop = useIsDesktop();
  const { opponentId, myPseudo, opPseudo, myAvatarUrl, opAvatarUrl, myAvatarColor, opAvatarColor } = resolveDuo({ myId, p1Id, p2Id, p1Pseudo, p2Pseudo, p1AvatarUrl, p2AvatarUrl, p1AvatarColor, p2AvatarColor });

  const [pile, setPile] = useState(initialState.pile);
  const [lastTaken, setLastTaken] = useState<number | null>(initialState.last_taken);
  const [lastPlayerId, setLastPlayerId] = useState<string | null>(initialState.last_player_id);
  const [currentTurn, setCurrentTurn] = useState<string | null>(initialCurrentTurn);
  const [gameStatus, setGameStatus] = useState<GameStatus>(initialStatus);
  const [submitting, setSubmitting] = useState(false);
  const [hoverCount, setHoverCount] = useState<number | null>(null);
  const [shakePile, setShakePile] = useState(false);

  const isFinishedRef = useRef<boolean>(initialStatus === "finished");

  const isMyTurn = currentTurn === myId;
  const isFinished = gameStatus === "finished";
  const danger = pile <= 3 && pile > 0;
  const pileColor = getPileColor(pile);

  useEffect(() => {
    isFinishedRef.current = isFinished;
  }, [isFinished]);

  useOpponentWatcher({ gameId, opponentId, isFinishedRef });
  useGameOpponent(opponentId, opPseudo);
  useGamePresence({ gameId, myId, myPseudo, gameType: "nim", initialFinished: initialStatus === "finished", isFinishedRef });
  const { play } = useGameSounds();

  useEffect(() => {
    const supabase = createClient();
    const sub = supabase
      .channel(`nim-${gameId}`)
      .on("postgres_changes", {
        event: "UPDATE", schema: "public", table: "games",
        filter: `id=eq.${gameId}`,
      }, (payload) => {
        const updated = payload.new as {
          state: unknown; status: string;
          current_turn: string | null; winner_id: string | null;
        };
        const raw = updated.state as Record<string, unknown>;
        const newState: NimState = raw && "pile" in raw
          ? (raw as unknown as NimState)
          : { pile: 0, initial_pile: 0, last_taken: null, last_player_id: null };

        setPile(newState.pile);
        setLastTaken(newState.last_taken);
        setLastPlayerId(newState.last_player_id);
        setCurrentTurn(updated.current_turn);
        setGameStatus(updated.status as GameStatus);

        // Shake animation on pile change
        setShakePile(true);
        setTimeout(() => setShakePile(false), 400);

        if (updated.current_turn === myId) play("notify");
        if (updated.status === "finished") {
          isFinishedRef.current = true;
          play(updated.winner_id === myId ? "win" : "lose");
          setTimeout(() => router.replace(`/result?game_id=${gameId}`), 4000);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [gameId, myId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleTake(count: 1 | 2 | 3) {
    if (!isMyTurn || submitting || count > pile) return;
    setSubmitting(true);
    play("move");
    const res = await takeNim(gameId, count);
    if (!res.ok) console.error(res.error);
    setSubmitting(false);
  }

  const lastMoverPseudo = lastPlayerId === myId ? myPseudo : opPseudo;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{
      minHeight: "100dvh",
      background: RR.violet,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      padding: desktop ? "28px 24px 60px" : "20px 16px 50px",
      gap: desktop ? 28 : 20,
      position: "relative",
      overflow: "hidden",
    }}>

      {/* Background dots */}
      <div aria-hidden style={{
        position: "fixed", inset: 0,
        backgroundImage: `radial-gradient(circle, rgba(0,212,232,0.15) 1.2px, transparent 1.6px)`,
        backgroundSize: "18px 18px",
        pointerEvents: "none", zIndex: 0,
      }} />

      {/* Blob déco */}
      <svg viewBox="0 0 200 200" aria-hidden style={{ position: "fixed", width: desktop ? 500 : 300, height: desktop ? 400 : 240, top: -160, right: -100, opacity: 0.3, pointerEvents: "none", zIndex: 0 }} preserveAspectRatio="none">
        <path d="M 40 60 Q 30 20 80 25 Q 140 10 165 50 Q 195 90 175 140 Q 155 185 100 180 Q 40 190 25 140 Q 5 95 40 60 Z" fill={danger ? RR.pink : RR.cyan} style={{ transition: "fill 0.5s" }} />
      </svg>
      <svg viewBox="0 0 200 200" aria-hidden style={{ position: "fixed", width: desktop ? 400 : 260, height: desktop ? 340 : 200, bottom: -120, left: -80, opacity: 0.25, pointerEvents: "none", zIndex: 0 }} preserveAspectRatio="none">
        <path d="M 50 30 Q 90 5 140 30 Q 195 50 180 110 Q 175 175 110 175 Q 30 180 25 120 Q 10 60 50 30 Z" fill={danger ? "#ff6b35" : RR.pink} style={{ transition: "fill 0.5s" }} />
      </svg>

      {/* ── HEADER joueurs ── */}
      <div style={{
        width: "100%", maxWidth: desktop ? 560 : 420,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        position: "relative", zIndex: 2,
      }}>
        {/* Moi */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, flex: 1 }}>
          <div style={{
            padding: 3, borderRadius: "50%",
            border: isMyTurn && !isFinished ? `3px solid ${RR.cyan}` : `3px solid transparent`,
            boxShadow: isMyTurn && !isFinished ? `0 0 14px ${RR.cyan}` : "none",
            transition: "border 0.3s, box-shadow 0.3s",
          }}>
            <Avatar name={myPseudo} src={myAvatarUrl} color={myAvatarColor ?? RR.butter} ring={RR.cyan} size={desktop ? 60 : 48} />
          </div>
          <div style={{
            fontFamily: "var(--font-display)", fontSize: 12, color: RR.white,
            transform: "skewX(-4deg)", textAlign: "center",
            maxWidth: 110, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>{myPseudo.toUpperCase()}</div>
          {isMyTurn && !isFinished && (
            <div style={{ fontSize: 9, fontWeight: 900, color: RR.cyan, textTransform: "uppercase", letterSpacing: 1.4, animation: "nim-pulse 1.2s ease-in-out infinite" }}>▶ À TOI</div>
          )}
        </div>

        {/* Centre VS */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <div style={{
            fontFamily: "var(--font-display)", fontSize: desktop ? 22 : 18,
            color: RR.white, transform: "skewX(-8deg)",
            textShadow: `3px 3px 0 ${RR.pink}`,
          }}>VS</div>
          <div style={{ fontSize: 9, fontWeight: 900, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: 1 }}>NIM</div>
        </div>

        {/* Adversaire */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, flex: 1 }}>
          <div style={{
            padding: 3, borderRadius: "50%",
            border: !isMyTurn && !isFinished ? `3px solid ${RR.pink}` : `3px solid transparent`,
            boxShadow: !isMyTurn && !isFinished ? `0 0 14px ${RR.pink}` : "none",
            transition: "border 0.3s, box-shadow 0.3s",
          }}>
            <Avatar name={opPseudo} src={opAvatarUrl} color={opAvatarColor ?? RR.pink} ring={RR.cyan} size={desktop ? 60 : 48} />
          </div>
          <div style={{
            fontFamily: "var(--font-display)", fontSize: 12, color: RR.white,
            transform: "skewX(-4deg)", textAlign: "center",
            maxWidth: 110, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>{opPseudo.toUpperCase()}</div>
          {!isMyTurn && !isFinished && (
            <div style={{ fontSize: 9, fontWeight: 900, color: RR.pink, textTransform: "uppercase", letterSpacing: 1.4, animation: "nim-pulse 1.2s ease-in-out infinite" }}>▶ SON TOUR</div>
          )}
        </div>
      </div>

      {/* ── RÈGLE MISÈRE ── */}
      <div style={{
        position: "relative", zIndex: 2,
        background: danger ? "rgba(255,30,140,0.2)" : "rgba(255,255,255,0.07)",
        border: `2px solid ${danger ? RR.pink : "rgba(255,255,255,0.15)"}`,
        borderRadius: 999, padding: "6px 18px",
        fontFamily: "var(--font-display)", fontSize: 12,
        color: danger ? RR.pink : "rgba(255,255,255,0.55)",
        transform: "skewX(-3deg)",
        boxShadow: danger ? `2px 2px 0 ${RR.pink}` : "none",
        transition: "all 0.4s",
        animation: danger ? "nim-pulse 1.5s ease-in-out infinite" : "none",
      }}>
        💀 Prends la dernière → tu PERDS
      </div>

      {/* ── COMPTEUR PILE (star of the show) ── */}
      <div style={{
        position: "relative", zIndex: 2,
        display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
      }}>
        <div style={{
          fontFamily: "var(--font-display)",
          fontSize: desktop ? 100 : 80,
          color: pileColor,
          transform: `skewX(-8deg) ${shakePile ? "scale(1.12)" : "scale(1)"}`,
          textShadow: `5px 5px 0 ${RR.ink}`,
          filter: `drop-shadow(0 0 20px ${pileColor})`,
          lineHeight: 1,
          transition: "color 0.4s, filter 0.4s, transform 0.25s cubic-bezier(0.175,0.885,0.32,1.6)",
        }}>{pile}</div>
        <div style={{
          fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 900,
          color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: 1.8,
        }}>
          allumette{pile !== 1 ? "s" : ""} restante{pile !== 1 ? "s" : ""}
        </div>
      </div>

      {/* ── GRILLE ALLUMETTES ── */}
      <div style={{
        position: "relative", zIndex: 2,
        background: danger
          ? "rgba(255,30,140,0.08)"
          : "rgba(255,255,255,0.04)",
        border: `2.5px solid ${danger ? `rgba(255,30,140,0.4)` : "rgba(255,255,255,0.1)"}`,
        borderRadius: 24,
        padding: desktop ? "28px 36px" : "18px 20px",
        minWidth: desktop ? 320 : 240,
        minHeight: desktop ? 100 : 80,
        display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: danger ? `0 0 24px rgba(255,30,140,0.2)` : "none",
        transition: "all 0.4s",
      }}>
        {pile === 0 ? (
          <div style={{
            fontFamily: "var(--font-display)", fontSize: 30,
            color: RR.pink, transform: "skewX(-6deg)",
            textShadow: `3px 3px 0 ${RR.ink}`,
          }}>VIDÉ 🔥</div>
        ) : (
          <AllumettesGrid pile={pile} hoverCount={hoverCount} myTurn={isMyTurn} danger={danger} />
        )}
      </div>

      {/* ── DERNIER COUP ── */}
      {lastTaken !== null && lastPlayerId !== null && (
        <div style={{
          position: "relative", zIndex: 2,
          background: "rgba(255,255,255,0.06)",
          border: `1.5px solid rgba(255,255,255,0.12)`,
          borderRadius: 999, padding: "5px 16px",
          fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 800,
          color: "rgba(255,255,255,0.5)",
          textTransform: "uppercase", letterSpacing: 1,
        }}>
          {lastMoverPseudo} a pris {lastTaken} allumette{lastTaken > 1 ? "s" : ""}
        </div>
      )}

      {/* ── BOUTONS ACTION ── */}
      {!isFinished && (
        <div style={{
          position: "relative", zIndex: 2,
          display: "flex", gap: desktop ? 16 : 10,
        }}>
          {([1, 2, 3] as const).map((n) => {
            const disabled = !isMyTurn || submitting || n > pile;
            const hovered = hoverCount === n && !disabled;
            return (
              <button
                key={n}
                type="button"
                disabled={disabled}
                onMouseEnter={() => !disabled && setHoverCount(n)}
                onMouseLeave={() => setHoverCount(null)}
                onTouchStart={() => !disabled && setHoverCount(n)}
                onTouchEnd={() => setHoverCount(null)}
                onClick={() => handleTake(n)}
                style={{
                  width: desktop ? 100 : 84,
                  padding: "16px 0 14px",
                  borderRadius: 20,
                  background: disabled
                    ? "rgba(255,255,255,0.06)"
                    : hovered
                      ? RR.pink
                      : RR.cyan,
                  border: `3px solid ${disabled ? "rgba(255,255,255,0.1)" : RR.ink}`,
                  boxShadow: disabled
                    ? "none"
                    : hovered
                      ? `5px 5px 0 ${RR.ink}`
                      : `4px 4px 0 ${RR.pink}, 4px 4px 0 1px ${RR.ink}`,
                  cursor: disabled ? "not-allowed" : "pointer",
                  display: "flex", flexDirection: "column",
                  alignItems: "center", gap: 4,
                  transform: hovered ? "translate(-2px, -2px) skewX(-4deg)" : disabled ? "none" : "skewX(-4deg)",
                  transition: "background 0.15s, box-shadow 0.15s, transform 0.12s",
                }}
              >
                <div style={{
                  fontFamily: "var(--font-display)", fontSize: desktop ? 36 : 30,
                  color: disabled ? "rgba(255,255,255,0.18)" : RR.ink,
                  lineHeight: 1, transform: "skewX(4deg)",
                }}>{n}</div>
                <div style={{
                  fontFamily: "var(--font-sans)", fontSize: 9, fontWeight: 900,
                  color: disabled ? "rgba(255,255,255,0.18)" : RR.ink,
                  textTransform: "uppercase", letterSpacing: 0.8,
                  transform: "skewX(4deg)",
                }}>
                  allumette{n > 1 ? "s" : ""}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* ── ÉTAT DU TOUR ── */}
      {!isFinished && (
        <div style={{
          position: "relative", zIndex: 2,
          fontFamily: "var(--font-display)", fontSize: 14,
          color: isMyTurn ? RR.cyan : "rgba(255,255,255,0.35)",
          transform: "skewX(-4deg)",
          letterSpacing: 1,
          animation: !isMyTurn ? "nim-pulse 2s ease-in-out infinite" : "none",
        }}>
          {isMyTurn ? "⚔ À TOI DE JOUER !" : `💭 ${opPseudo} réfléchit…`}
        </div>
      )}


      <RulesButton gameType="nim" />
      <PreventLeave enabled={!isFinished} gameId={gameId} />

      <style>{`
        @keyframes nim-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.45; }
        }
      `}</style>
    </div>
  );
}

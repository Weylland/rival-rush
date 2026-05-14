"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { EA } from "@/lib/design";
import { Avatar } from "@/components/ui/avatar";
import { GameChat } from "@/components/GameChat";
import { PreventLeave } from "@/components/PreventLeave";
import { takeNim } from "./actions";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { useOpponentWatcher } from "@/hooks/useOpponentWatcher";
import { useGameSounds } from "@/hooks/useGameSounds";
import type { NimState, GameStatus } from "@/types/database";

// ── Couleurs danger selon la pile ────────────────────────────────────────────

function getPileColor(pile: number) {
  if (pile <= 1) return EA.pink;
  if (pile <= 3) return "#ff6b35";
  if (pile <= 6) return EA.butter;
  return EA.cyan;
}

function getPileGlow(pile: number) {
  if (pile <= 1) return `0 0 32px ${EA.pink}, 0 0 64px rgba(255,30,140,0.5)`;
  if (pile <= 3) return `0 0 24px #ff6b35, 0 0 48px rgba(255,107,53,0.4)`;
  if (pile <= 6) return `0 0 20px ${EA.butter}`;
  return `0 0 16px ${EA.cyan}`;
}

// ── Allumette visuelle ────────────────────────────────────────────────────────

function Allumette({
  highlight,
  danger,
  size = 1,
}: {
  highlight: boolean;
  danger: boolean;
  size?: number;
}) {
  const headSize = Math.round(12 * size);
  const stickW = Math.round(7 * size);
  const stickH = Math.round(48 * size);

  const headColor = danger ? EA.pink : highlight ? "#ff6b35" : "#e85d04";
  const stickTop = danger
    ? `linear-gradient(180deg, ${EA.pink} 0%, #c8a063 50%)`
    : highlight
      ? `linear-gradient(180deg, #ff6b35 0%, #c8a063 50%)`
      : `linear-gradient(180deg, #d4874a 0%, #8b5e3c 100%)`;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0 }}>
      {/* Tête enflammée */}
      <div style={{
        width: headSize, height: headSize, borderRadius: "50%",
        background: headColor,
        border: `2px solid ${EA.ink}`,
        boxShadow: danger
          ? `0 0 10px ${EA.pink}, 0 0 20px rgba(255,30,140,0.6)`
          : highlight
            ? `0 0 8px #ff6b35`
            : "none",
        flexShrink: 0,
        transition: "background 0.2s, box-shadow 0.2s",
      }} />
      {/* Bâton */}
      <div style={{
        width: stickW, height: stickH,
        background: stickTop,
        border: `1.5px solid ${EA.ink}`,
        borderTop: "none",
        borderRadius: "0 0 3px 3px",
        transition: "background 0.2s",
      }} />
    </div>
  );
}

function AllumettesGrid({
  pile,
  hoverCount,
  myTurn,
  danger,
}: {
  pile: number;
  hoverCount: number | null;
  myTurn: boolean;
  danger: boolean;
}) {
  const perRow = pile > 12 ? 7 : pile > 6 ? 5 : pile;
  const rows: number[][] = [];
  for (let i = 0; i < pile; i += perRow) {
    rows.push(Array.from({ length: Math.min(perRow, pile - i) }, (_, j) => i + j));
  }
  const highlightFrom = hoverCount !== null && myTurn ? pile - hoverCount : -1;
  const size = pile > 15 ? 0.7 : pile > 8 ? 0.85 : 1;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
      {rows.map((row, ri) => (
        <div key={ri} style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
          {row.map((idx) => (
            <Allumette
              key={idx}
              highlight={idx >= highlightFrom}
              danger={danger && idx >= highlightFrom}
              size={size}
            />
          ))}
        </div>
      ))}
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
  initialState: NimState;
  initialStatus: GameStatus;
  initialCurrentTurn: string | null;
  initialWinnerId: string | null;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function NimClient({
  gameId, myId, p1Id, p2Id,
  p1Pseudo, p2Pseudo, p1AvatarUrl, p2AvatarUrl,
  initialState, initialStatus, initialCurrentTurn,
}: Props) {
  const router = useRouter();
  const desktop = useIsDesktop();
  const opponentId = myId === p1Id ? p2Id : p1Id;
  const myPseudo = myId === p1Id ? p1Pseudo : p2Pseudo;
  const opPseudo = myId === p1Id ? p2Pseudo : p1Pseudo;
  const myAvatarUrl = myId === p1Id ? p1AvatarUrl : p2AvatarUrl;
  const opAvatarUrl = myId === p1Id ? p2AvatarUrl : p1AvatarUrl;

  const [pile, setPile] = useState(initialState.pile);
  const [lastTaken, setLastTaken] = useState<number | null>(initialState.last_taken);
  const [lastPlayerId, setLastPlayerId] = useState<string | null>(initialState.last_player_id);
  const [currentTurn, setCurrentTurn] = useState<string | null>(initialCurrentTurn);
  const [gameStatus, setGameStatus] = useState<GameStatus>(initialStatus);
  const [submitting, setSubmitting] = useState(false);
  const [hoverCount, setHoverCount] = useState<number | null>(null);
  const [shakePile, setShakePile] = useState(false);

  const isFinishedRef = useRef<boolean>(initialStatus === "finished");
  const forfeitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isMyTurn = currentTurn === myId;
  const isFinished = gameStatus === "finished";
  const danger = pile <= 3 && pile > 0;
  const pileColor = getPileColor(pile);

  useEffect(() => {
    isFinishedRef.current = isFinished;
  }, [isFinished]);

  useOpponentWatcher({ gameId, opponentId, isFinishedRef });
  const { play } = useGameSounds();

  // Presence + forfeit
  useEffect(() => {
    if (forfeitTimerRef.current) {
      clearTimeout(forfeitTimerRef.current);
      forfeitTimerRef.current = null;
    }
    const supabase = createClient();
    const updatePresence = () =>
      supabase.from("presence").upsert({
        player_id: myId, pseudo: myPseudo,
        status: "in-game", game_type: "nim",
        updated_at: new Date().toISOString(),
      }).then(() => {});
    updatePresence();
    const heartbeat = setInterval(updatePresence, 15_000);
    return () => {
      clearInterval(heartbeat);
      supabase.from("presence").update({ status: "online", updated_at: new Date().toISOString() }).eq("player_id", myId).then(() => {});
      if (!isFinishedRef.current) {
        forfeitTimerRef.current = setTimeout(() => {
          forfeitTimerRef.current = null;
          fetch("/api/forfeit", {
            method: "POST",
            body: JSON.stringify({ gameId }),
            headers: { "Content-Type": "application/json" },
            keepalive: true,
          });
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
          setTimeout(() => router.push(`/result?game_id=${gameId}`), 1800);
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
      background: EA.violet,
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
        <path d="M 40 60 Q 30 20 80 25 Q 140 10 165 50 Q 195 90 175 140 Q 155 185 100 180 Q 40 190 25 140 Q 5 95 40 60 Z" fill={danger ? EA.pink : EA.cyan} style={{ transition: "fill 0.5s" }} />
      </svg>
      <svg viewBox="0 0 200 200" aria-hidden style={{ position: "fixed", width: desktop ? 400 : 260, height: desktop ? 340 : 200, bottom: -120, left: -80, opacity: 0.25, pointerEvents: "none", zIndex: 0 }} preserveAspectRatio="none">
        <path d="M 50 30 Q 90 5 140 30 Q 195 50 180 110 Q 175 175 110 175 Q 30 180 25 120 Q 10 60 50 30 Z" fill={danger ? "#ff6b35" : EA.pink} style={{ transition: "fill 0.5s" }} />
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
            border: isMyTurn && !isFinished ? `3px solid ${EA.cyan}` : `3px solid transparent`,
            boxShadow: isMyTurn && !isFinished ? `0 0 14px ${EA.cyan}` : "none",
            transition: "border 0.3s, box-shadow 0.3s",
          }}>
            <Avatar name={myPseudo} src={myAvatarUrl} color={EA.butter} ring={EA.cyan} size={desktop ? 60 : 48} />
          </div>
          <div style={{
            fontFamily: "var(--font-display)", fontSize: 12, color: EA.white,
            transform: "skewX(-4deg)", textAlign: "center",
            maxWidth: 110, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>{myPseudo.toUpperCase()}</div>
          {isMyTurn && !isFinished && (
            <div style={{ fontSize: 9, fontWeight: 900, color: EA.cyan, textTransform: "uppercase", letterSpacing: 1.4, animation: "nim-pulse 1.2s ease-in-out infinite" }}>▶ À TOI</div>
          )}
        </div>

        {/* Centre VS */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <div style={{
            fontFamily: "var(--font-display)", fontSize: desktop ? 22 : 18,
            color: EA.white, transform: "skewX(-8deg)",
            textShadow: `3px 3px 0 ${EA.pink}`,
          }}>VS</div>
          <div style={{ fontSize: 9, fontWeight: 900, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: 1 }}>NIM</div>
        </div>

        {/* Adversaire */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, flex: 1 }}>
          <div style={{
            padding: 3, borderRadius: "50%",
            border: !isMyTurn && !isFinished ? `3px solid ${EA.pink}` : `3px solid transparent`,
            boxShadow: !isMyTurn && !isFinished ? `0 0 14px ${EA.pink}` : "none",
            transition: "border 0.3s, box-shadow 0.3s",
          }}>
            <Avatar name={opPseudo} src={opAvatarUrl} color={EA.pink} ring={EA.cyan} size={desktop ? 60 : 48} />
          </div>
          <div style={{
            fontFamily: "var(--font-display)", fontSize: 12, color: EA.white,
            transform: "skewX(-4deg)", textAlign: "center",
            maxWidth: 110, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>{opPseudo.toUpperCase()}</div>
          {!isMyTurn && !isFinished && (
            <div style={{ fontSize: 9, fontWeight: 900, color: EA.pink, textTransform: "uppercase", letterSpacing: 1.4, animation: "nim-pulse 1.2s ease-in-out infinite" }}>▶ SON TOUR</div>
          )}
        </div>
      </div>

      {/* ── RÈGLE MISÈRE ── */}
      <div style={{
        position: "relative", zIndex: 2,
        background: danger ? "rgba(255,30,140,0.2)" : "rgba(255,255,255,0.07)",
        border: `2px solid ${danger ? EA.pink : "rgba(255,255,255,0.15)"}`,
        borderRadius: 999, padding: "6px 18px",
        fontFamily: "var(--font-display)", fontSize: 12,
        color: danger ? EA.pink : "rgba(255,255,255,0.55)",
        transform: "skewX(-3deg)",
        boxShadow: danger ? `2px 2px 0 ${EA.pink}` : "none",
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
          textShadow: `5px 5px 0 ${EA.ink}`,
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
            color: EA.pink, transform: "skewX(-6deg)",
            textShadow: `3px 3px 0 ${EA.ink}`,
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
                      ? EA.pink
                      : EA.cyan,
                  border: `3px solid ${disabled ? "rgba(255,255,255,0.1)" : EA.ink}`,
                  boxShadow: disabled
                    ? "none"
                    : hovered
                      ? `5px 5px 0 ${EA.ink}`
                      : `4px 4px 0 ${EA.pink}, 4px 4px 0 1px ${EA.ink}`,
                  cursor: disabled ? "not-allowed" : "pointer",
                  display: "flex", flexDirection: "column",
                  alignItems: "center", gap: 4,
                  transform: hovered ? "translate(-2px, -2px) skewX(-4deg)" : disabled ? "none" : "skewX(-4deg)",
                  transition: "background 0.15s, box-shadow 0.15s, transform 0.12s",
                }}
              >
                <div style={{
                  fontFamily: "var(--font-display)", fontSize: desktop ? 36 : 30,
                  color: disabled ? "rgba(255,255,255,0.18)" : EA.ink,
                  lineHeight: 1, transform: "skewX(4deg)",
                }}>{n}</div>
                <div style={{
                  fontFamily: "var(--font-sans)", fontSize: 9, fontWeight: 900,
                  color: disabled ? "rgba(255,255,255,0.18)" : EA.ink,
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
          color: isMyTurn ? EA.cyan : "rgba(255,255,255,0.35)",
          transform: "skewX(-4deg)",
          letterSpacing: 1,
          animation: !isMyTurn ? "nim-pulse 2s ease-in-out infinite" : "none",
        }}>
          {isMyTurn ? "⚔ À TOI DE JOUER !" : `💭 ${opPseudo} réfléchit…`}
        </div>
      )}

      <GameChat
        gameId={gameId}
        myId={myId}
        myPseudo={myPseudo}
        opponentId={opponentId}
        opponentPseudo={opPseudo}
      />

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

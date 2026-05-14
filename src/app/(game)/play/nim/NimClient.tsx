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

// ── Allumette visuelle ────────────────────────────────────────────────────────

function Allumette({ highlight, fading }: { highlight: boolean; fading: boolean }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", gap: 0,
      opacity: fading ? 0.25 : 1,
      transition: "opacity 0.2s",
    }}>
      {/* tête */}
      <div style={{
        width: 10, height: 10, borderRadius: "50%",
        background: highlight ? EA.pink : "#e85d04",
        border: `2px solid ${EA.ink}`,
        boxShadow: highlight ? `0 0 6px ${EA.pink}` : "none",
        transition: "background 0.15s, box-shadow 0.15s",
        flexShrink: 0,
      }} />
      {/* bâton */}
      <div style={{
        width: 6, height: 40,
        background: highlight
          ? `linear-gradient(180deg, ${EA.pink} 0%, #c8a063 60%)`
          : "linear-gradient(180deg, #c8a063 0%, #8b5e3c 100%)",
        border: `1.5px solid ${EA.ink}`,
        borderTop: "none",
        borderRadius: "0 0 3px 3px",
        transition: "background 0.15s",
      }} />
    </div>
  );
}

function AllumettesGrid({ pile, hoverCount, myTurn }: { pile: number; hoverCount: number | null; myTurn: boolean }) {
  const perRow = 5;
  const rows: number[][] = [];
  for (let i = 0; i < pile; i += perRow) {
    rows.push(Array.from({ length: Math.min(perRow, pile - i) }, (_, j) => i + j));
  }

  // Les dernières `hoverCount` allumettes sont highlights
  const highlightFrom = hoverCount !== null && myTurn ? pile - hoverCount : -1;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
      {rows.map((row, ri) => (
        <div key={ri} style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
          {row.map((idx) => (
            <Allumette
              key={idx}
              highlight={idx >= highlightFrom}
              fading={false}
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
  initialState, initialStatus, initialCurrentTurn, initialWinnerId,
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
  const [winnerId, setWinnerId] = useState<string | null>(initialWinnerId);
  const [submitting, setSubmitting] = useState(false);
  const [hoverCount, setHoverCount] = useState<number | null>(null);

  const isFinishedRef = useRef<boolean>(initialStatus === "finished");
  const forfeitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isMyTurn = currentTurn === myId;
  const isFinished = gameStatus === "finished";

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
    const heartbeat = setInterval(updatePresence, 30_000);

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

  // Redirect if already finished on mount
  useEffect(() => {
    if (initialStatus === "finished") {
      isFinishedRef.current = true;
      router.push(`/result?game_id=${gameId}`);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Realtime subscription
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
        setWinnerId(updated.winner_id);

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
      background: `linear-gradient(160deg, ${EA.violetDeep} 0%, #1a1050 60%, #0d0826 100%)`,
      display: "flex", flexDirection: "column", alignItems: "center",
      padding: desktop ? "32px 24px 48px" : "20px 16px 40px",
      gap: 24,
      fontFamily: "var(--font-sans)",
      position: "relative", overflow: "hidden",
    }}>
      {/* Dot grid background */}
      <div style={{
        position: "fixed", inset: 0,
        backgroundImage: "radial-gradient(circle, rgba(0,212,232,0.12) 1px, transparent 1.4px)",
        backgroundSize: "18px 18px", pointerEvents: "none", zIndex: 0,
      }} />

      {/* Header — joueurs */}
      <div style={{
        width: "100%", maxWidth: 480,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        position: "relative", zIndex: 2,
      }}>
        {/* Moi */}
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
          flex: 1,
        }}>
          <div style={{
            position: "relative",
            padding: 3,
            borderRadius: "50%",
            border: isMyTurn && !isFinished ? `3px solid ${EA.cyan}` : `3px solid transparent`,
            boxShadow: isMyTurn && !isFinished ? `0 0 12px ${EA.cyan}` : "none",
            transition: "border 0.3s, box-shadow 0.3s",
          }}>
            <Avatar name={myPseudo} src={myAvatarUrl} color={EA.cyan} ring={EA.pink} size={52} />
          </div>
          <div style={{
            fontFamily: "var(--font-display)", fontSize: 12, color: EA.white,
            transform: "skewX(-4deg)", textAlign: "center",
            maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>{myPseudo.toUpperCase()}</div>
          {isMyTurn && !isFinished && (
            <div style={{
              fontSize: 9, fontWeight: 900, color: EA.cyan,
              textTransform: "uppercase", letterSpacing: 1.4,
              animation: "pulse 1.2s ease-in-out infinite",
            }}>▶ À TOI</div>
          )}
        </div>

        {/* VS */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <div style={{
            fontFamily: "var(--font-display)", fontSize: desktop ? 22 : 18,
            color: EA.white, transform: "skewX(-8deg)",
            textShadow: `3px 3px 0 ${EA.pink}`,
          }}>VS</div>
          <div style={{
            fontSize: 9, fontWeight: 900, color: "rgba(255,255,255,0.4)",
            textTransform: "uppercase", letterSpacing: 1,
          }}>NIM</div>
        </div>

        {/* Adversaire */}
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
          flex: 1,
        }}>
          <div style={{
            position: "relative",
            padding: 3,
            borderRadius: "50%",
            border: !isMyTurn && !isFinished ? `3px solid ${EA.pink}` : `3px solid transparent`,
            boxShadow: !isMyTurn && !isFinished ? `0 0 12px ${EA.pink}` : "none",
            transition: "border 0.3s, box-shadow 0.3s",
          }}>
            <Avatar name={opPseudo} src={opAvatarUrl} color={EA.pink} ring={EA.cyan} size={52} />
          </div>
          <div style={{
            fontFamily: "var(--font-display)", fontSize: 12, color: EA.white,
            transform: "skewX(-4deg)", textAlign: "center",
            maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>{opPseudo.toUpperCase()}</div>
          {!isMyTurn && !isFinished && (
            <div style={{
              fontSize: 9, fontWeight: 900, color: EA.pink,
              textTransform: "uppercase", letterSpacing: 1.4,
              animation: "pulse 1.2s ease-in-out infinite",
            }}>▶ SON TOUR</div>
          )}
        </div>
      </div>

      {/* Règle misère + badge */}
      <div style={{
        display: "flex", gap: 8, alignItems: "center",
        position: "relative", zIndex: 2,
        flexWrap: "wrap", justifyContent: "center",
      }}>
        <div style={{
          background: "rgba(255,30,140,0.18)", border: `2px solid ${EA.pink}`,
          borderRadius: 999, padding: "4px 14px",
          fontFamily: "var(--font-display)", fontSize: 11, color: EA.pink,
          transform: "skewX(-4deg)",
        }}>
          💀 Prends la dernière allumette et tu PERDS
        </div>
      </div>

      {/* Compteur pile */}
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
        position: "relative", zIndex: 2,
      }}>
        <div style={{
          fontFamily: "var(--font-display)", fontSize: desktop ? 64 : 52,
          color: EA.white, transform: "skewX(-8deg)",
          textShadow: `4px 4px 0 ${pile <= 3 ? EA.pink : EA.cyan}`,
          lineHeight: 1,
          transition: "text-shadow 0.3s",
        }}>{pile}</div>
        <div style={{
          fontSize: 11, fontWeight: 900, color: "rgba(255,255,255,0.5)",
          textTransform: "uppercase", letterSpacing: 1.4,
        }}>allumette{pile !== 1 ? "s" : ""} restante{pile !== 1 ? "s" : ""}</div>
      </div>

      {/* Grille allumettes */}
      <div style={{
        position: "relative", zIndex: 2,
        background: "rgba(255,255,255,0.04)",
        border: `2px solid rgba(255,255,255,0.1)`,
        borderRadius: 20, padding: desktop ? "28px 32px" : "20px 20px",
        minWidth: desktop ? 320 : 260,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {pile === 0 ? (
          <div style={{
            fontFamily: "var(--font-display)", fontSize: 28,
            color: EA.pink, transform: "skewX(-6deg)",
            textShadow: `3px 3px 0 ${EA.ink}`,
          }}>VIDÉ 🔥</div>
        ) : (
          <AllumettesGrid pile={pile} hoverCount={hoverCount} myTurn={isMyTurn} />
        )}
      </div>

      {/* Dernier coup */}
      {lastTaken !== null && lastPlayerId !== null && (
        <div style={{
          position: "relative", zIndex: 2,
          fontSize: 12, fontWeight: 800,
          color: "rgba(255,255,255,0.55)",
          textTransform: "uppercase", letterSpacing: 1,
        }}>
          {lastMoverPseudo} a pris {lastTaken} allumette{lastTaken > 1 ? "s" : ""}
        </div>
      )}

      {/* Boutons prendre */}
      {!isFinished && (
        <div style={{
          display: "flex", gap: desktop ? 16 : 12,
          position: "relative", zIndex: 2,
        }}>
          {([1, 2, 3] as const).map((n) => {
            const disabled = !isMyTurn || submitting || n > pile;
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
                  width: desktop ? 88 : 76,
                  height: desktop ? 88 : 76,
                  borderRadius: 20,
                  background: disabled
                    ? "rgba(255,255,255,0.06)"
                    : hoverCount === n
                      ? EA.pink
                      : EA.cyan,
                  border: `3px solid ${disabled ? "rgba(255,255,255,0.12)" : EA.ink}`,
                  boxShadow: disabled
                    ? "none"
                    : hoverCount === n
                      ? `4px 4px 0 ${EA.ink}`
                      : `4px 4px 0 ${EA.pink}, 4px 4px 0 1px ${EA.ink}`,
                  cursor: disabled ? "not-allowed" : "pointer",
                  display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center", gap: 4,
                  transition: "background 0.15s, box-shadow 0.15s",
                  transform: hoverCount === n && !disabled ? "translate(-2px, -2px)" : "none",
                }}
              >
                <div style={{
                  fontFamily: "var(--font-display)", fontSize: 28,
                  color: disabled ? "rgba(255,255,255,0.2)" : EA.ink,
                  lineHeight: 1,
                }}>{n}</div>
                <div style={{
                  fontSize: 9, fontWeight: 900, letterSpacing: 0.8,
                  color: disabled ? "rgba(255,255,255,0.2)" : EA.ink,
                  textTransform: "uppercase",
                }}>
                  allumette{n > 1 ? "s" : ""}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Message attente adversaire */}
      {!isFinished && !isMyTurn && (
        <div style={{
          position: "relative", zIndex: 2,
          fontSize: 12, fontWeight: 800, color: "rgba(255,255,255,0.4)",
          textTransform: "uppercase", letterSpacing: 1.2,
          animation: "pulse 2s ease-in-out infinite",
        }}>
          En attente de {opPseudo}…
        </div>
      )}

      {/* Chat */}
      <GameChat
        gameId={gameId}
        myId={myId}
        myPseudo={myPseudo}
        opponentId={opponentId}
        opponentPseudo={opPseudo}
      />

      <PreventLeave enabled={!isFinished} gameId={gameId} />

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}

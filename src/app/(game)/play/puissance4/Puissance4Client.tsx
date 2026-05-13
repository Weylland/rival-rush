"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { EA } from "@/lib/design";
import { Avatar } from "@/components/ui/avatar";
import { Star } from "@/components/ui/star";
import { SvgBlob } from "@/components/ui/blob";
import { submitPuissance4Move } from "./actions";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { useOpponentWatcher } from "@/hooks/useOpponentWatcher";
import { useGameSounds } from "@/hooks/useGameSounds";
import { RulesButton } from "@/components/ui/rules-button";
import { GameChat } from "@/components/GameChat";
import type { Puissance4State, GameStatus } from "@/types/database";

const ROWS = 6;
const COLS = 7;

function getWinningCells(board: (string | null)[]): number[] | null {
  const get = (r: number, c: number) => board[r * COLS + c];
  const idx = (r: number, c: number) => r * COLS + c;

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = get(r, c);
      if (!cell) continue;
      if (c + 3 < COLS && cell === get(r, c + 1) && cell === get(r, c + 2) && cell === get(r, c + 3))
        return [idx(r, c), idx(r, c + 1), idx(r, c + 2), idx(r, c + 3)];
      if (r + 3 < ROWS && cell === get(r + 1, c) && cell === get(r + 2, c) && cell === get(r + 3, c))
        return [idx(r, c), idx(r + 1, c), idx(r + 2, c), idx(r + 3, c)];
      if (r + 3 < ROWS && c + 3 < COLS && cell === get(r + 1, c + 1) && cell === get(r + 2, c + 2) && cell === get(r + 3, c + 3))
        return [idx(r, c), idx(r + 1, c + 1), idx(r + 2, c + 2), idx(r + 3, c + 3)];
      if (r + 3 < ROWS && c - 3 >= 0 && cell === get(r + 1, c - 1) && cell === get(r + 2, c - 2) && cell === get(r + 3, c - 3))
        return [idx(r, c), idx(r + 1, c - 1), idx(r + 2, c - 2), idx(r + 3, c - 3)];
    }
  }
  return null;
}

interface Props {
  gameId: string;
  myId: string;
  p1Id: string;
  p2Id: string;
  p1Pseudo: string;
  p2Pseudo: string;
  p1AvatarUrl: string | null;
  p2AvatarUrl: string | null;
  initialState: Puissance4State;
  initialStatus: GameStatus;
  initialCurrentTurn: string | null;
  initialWinnerId: string | null;
}

export function Puissance4Client({ gameId, myId, p1Id, p2Id, p1Pseudo, p2Pseudo, p1AvatarUrl, p2AvatarUrl, initialState, initialStatus, initialCurrentTurn, initialWinnerId }: Props) {
  const router = useRouter();
  const desktop = useIsDesktop();
  const opponentId = myId === p1Id ? p2Id : p1Id;
  const myPseudo = myId === p1Id ? p1Pseudo : p2Pseudo;
  const opPseudo = myId === p1Id ? p2Pseudo : p1Pseudo;
  const myAvatarUrl = myId === p1Id ? p1AvatarUrl : p2AvatarUrl;
  const opAvatarUrl = myId === p1Id ? p2AvatarUrl : p1AvatarUrl;
  const iAmP1 = myId === p1Id;

  const [board, setBoard] = useState<(string | null)[]>(
    initialState.board?.length === 42 ? initialState.board : Array(42).fill(null)
  );
  const [currentTurn, setCurrentTurn] = useState<string | null>(initialCurrentTurn ?? p1Id);
  const [gameStatus, setGameStatus] = useState<GameStatus>(initialStatus);
  const [winnerId, setWinnerId] = useState<string | null>(initialWinnerId);
  const [submitting, setSubmitting] = useState(false);
  const [hoverCol, setHoverCol] = useState<number | null>(null);
  const isFinishedRef = useRef<boolean>(initialStatus === "finished");
  const forfeitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    isFinishedRef.current = gameStatus === "finished";
  }, [gameStatus]);

  useOpponentWatcher({ gameId, opponentId, isFinishedRef });
  const { play } = useGameSounds();

  useEffect(() => {
    if (forfeitTimerRef.current) {
      clearTimeout(forfeitTimerRef.current);
      forfeitTimerRef.current = null;
    }

    const supabase = createClient();
    const updatePresence = () =>
      supabase.from("presence").upsert({ player_id: myId, pseudo: myPseudo, status: "in-game", game_type: "puissance4", updated_at: new Date().toISOString() }).then(() => {});
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
        }, 500);
      }
    };
  }, [myId, gameId]);

  useEffect(() => {
    if (initialStatus === "finished") {
      isFinishedRef.current = true;
      router.push(`/result?game_id=${gameId}`);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const supabase = createClient();
    const sub = supabase
      .channel(`puissance4-${gameId}`)
      .on("postgres_changes", {
        event: "UPDATE", schema: "public", table: "games",
        filter: `id=eq.${gameId}`,
      }, (payload) => {
        const updated = payload.new as { state: unknown; status: string; current_turn: string | null; winner_id: string | null };
        const raw = updated.state as Record<string, unknown>;
        const newState: Puissance4State = raw && "board" in raw
          ? (raw as unknown as Puissance4State)
          : { board: Array(42).fill(null) };
        setBoard(newState.board?.length === 42 ? newState.board : Array(42).fill(null));
        setCurrentTurn(updated.current_turn);
        setGameStatus(updated.status as GameStatus);
        setWinnerId(updated.winner_id);
        if (updated.status === "finished") {
          isFinishedRef.current = true;
          const iWon = updated.winner_id === myId;
          const isDraw = updated.winner_id === null;
          play(isDraw ? "reveal" : iWon ? "win" : "lose");
          setTimeout(() => router.push(`/result?game_id=${gameId}`), 1800);
        } else if (updated.current_turn === myId) {
          play("tick");
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [gameId, router]); // eslint-disable-line react-hooks/exhaustive-deps

  const isMyTurn = currentTurn === myId;
  const isFinished = gameStatus === "finished";
  const isDraw = isFinished && !winnerId;
  const winCells = winnerId ? getWinningCells(board) : null;

  const myColor = iAmP1 ? EA.pink : EA.cyan;
  const opColor = iAmP1 ? EA.cyan : EA.pink;

  async function handleColClick(col: number) {
    if (!isMyTurn || submitting || isFinished) return;
    // Find lowest empty row
    let targetRow = -1;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (board[r * COLS + col] === null) { targetRow = r; break; }
    }
    if (targetRow === -1) return; // column full

    play("move");
    setSubmitting(true);
    const newBoard = [...board];
    newBoard[targetRow * COLS + col] = myId;
    setBoard(newBoard);
    setCurrentTurn(opponentId);
    try { await submitPuissance4Move(gameId, col); } finally { setSubmitting(false); }
  }

  function isColFull(col: number) {
    return board[0 * COLS + col] !== null;
  }

  function cellColor(value: string | null): string | null {
    if (!value) return null;
    return value === p1Id ? EA.pink : EA.cyan;
  }

  function Board({ cellSize }: { cellSize: number }) {
    const gap = Math.max(4, Math.round(cellSize * 0.1));
    return (
      <div style={{
        background: EA.violetDeep,
        border: `3px solid ${EA.ink}`,
        borderRadius: 20,
        padding: gap + 2,
        boxShadow: `5px 5px 0 ${EA.pink}, 5px 5px 0 1px ${EA.ink}`,
        display: "inline-block",
        position: "relative",
      }}>
        <div aria-hidden style={{ position: "absolute", inset: 6, borderRadius: 16, backgroundImage: `radial-gradient(circle, rgba(0,212,232,0.2) 0.9px, transparent 1.3px) 0 0 / 10px 10px`, pointerEvents: "none" }} />

        {/* Column click zones — hover highlight */}
        <div style={{ display: "flex", gap, position: "relative", zIndex: 2 }}>
          {Array.from({ length: COLS }, (_, col) => {
            const canClick = isMyTurn && !isFinished && !submitting && !isColFull(col);
            const isHovered = hoverCol === col && canClick;
            return (
              <div
                key={col}
                style={{ width: cellSize, cursor: canClick ? "pointer" : "default" }}
                onClick={() => handleColClick(col)}
                onMouseEnter={() => canClick && setHoverCol(col)}
                onMouseLeave={() => setHoverCol(null)}
              >
                {/* Preview token in top slot */}
                <div style={{
                  width: cellSize, height: cellSize * 0.55,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  marginBottom: 2,
                }}>
                  {isHovered && (
                    <div style={{
                      width: cellSize * 0.72, height: cellSize * 0.72,
                      borderRadius: "50%",
                      background: myColor,
                      border: `2px solid ${EA.ink}`,
                      opacity: 0.55,
                    }} />
                  )}
                </div>

                {/* Grid rows for this column */}
                {Array.from({ length: ROWS }, (_, row) => {
                  const idx = row * COLS + col;
                  const val = board[idx];
                  const color = cellColor(val);
                  const isWin = winCells?.includes(idx) ?? false;
                  return (
                    <div
                      key={row}
                      style={{
                        width: cellSize, height: cellSize,
                        marginBottom: row < ROWS - 1 ? gap : 0,
                        borderRadius: "50%",
                        background: isWin ? EA.butter : (color ?? "rgba(255,255,255,0.08)"),
                        border: `2.5px solid ${isWin ? EA.ink : (color ? EA.ink : "rgba(255,255,255,0.18)")}`,
                        boxShadow: isWin
                          ? `0 0 0 3px ${EA.butter}, inset 0 2px 4px rgba(0,0,0,0.3)`
                          : color
                            ? `inset 0 -3px 6px rgba(0,0,0,0.35), inset 0 2px 4px rgba(255,255,255,0.2)`
                            : "inset 0 2px 6px rgba(0,0,0,0.4)",
                        transition: "background 0.1s, border-color 0.1s",
                        flexShrink: 0,
                      }}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  function TurnPill() {
    if (isFinished) {
      return (
        <div style={{ background: isDraw ? `rgba(255,233,74,0.15)` : winnerId === myId ? `rgba(0,212,232,0.15)` : `rgba(255,30,140,0.15)`, border: `2px solid ${isDraw ? EA.butter : winnerId === myId ? EA.cyan : EA.pink}`, borderRadius: 999, padding: "8px 20px", display: "inline-flex", alignItems: "center", gap: 8, boxShadow: `3px 3px 0 ${isDraw ? EA.butter : winnerId === myId ? EA.cyan : EA.pink}` }}>
          <span style={{ fontFamily: "var(--font-display)", fontSize: 22, color: isDraw ? EA.butter : winnerId === myId ? EA.cyan : EA.pink, transform: "skewX(-6deg)" }}>
            {isDraw ? "🤝 MATCH NUL !" : winnerId === myId ? "🏆 VICTOIRE !" : "💀 DÉFAITE !"}
          </span>
        </div>
      );
    }
    return (
      <div style={{ background: "rgba(26,15,94,0.7)", border: `2px solid ${EA.ink}`, borderRadius: 999, padding: "8px 18px", display: "inline-flex", alignItems: "center", gap: 10, boxShadow: `3px 3px 0 ${EA.cyan}` }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: isMyTurn ? EA.butter : EA.cyan, boxShadow: `0 0 10px ${isMyTurn ? EA.butter : EA.cyan}`, animation: "ea-pulse 1.2s ease-in-out infinite", flexShrink: 0 }} />
        <span style={{ fontFamily: "var(--font-sans)", fontStyle: "italic", fontSize: 14, fontWeight: 800, color: EA.white }}>
          {isMyTurn ? "À toi de jouer !" : `${opPseudo} réfléchit...`}
        </span>
      </div>
    );
  }

  function PlayerCard({ isMe, align }: { isMe: boolean; align: "left" | "right" }) {
    const pid = isMe ? myId : opponentId;
    const isActive = pid === currentTurn && !isFinished;
    const isWinner = winnerId === pid;
    const pseudo = isMe ? myPseudo : opPseudo;
    const bgColor = isMe ? EA.pink : EA.cyan;
    const shadowColor = isMe ? EA.cyan : EA.pink;
    const textColor = isMe ? EA.white : EA.ink;
    const avatarBg = isMe ? EA.butter : EA.pink;
    const rotation = isMe ? "rotate(-1deg)" : "rotate(1.5deg)";
    const tagText = isActive ? (isMe ? "TON TOUR" : "SON TOUR") : isWinner ? "🏆 GAGNE" : null;
    const tagRotate = isMe ? "rotate(-8deg)" : "rotate(8deg)";
    const tagSide = isMe
      ? { left: align === "left" ? -10 : "auto", right: align === "right" ? -10 : "auto" }
      : { right: align === "right" ? -10 : "auto", left: align === "left" ? -10 : "auto" };
    const discColor = isMe ? myColor : opColor;

    return (
      <div style={{ position: "relative", display: "inline-block" }}>
        {tagText && (
          <div style={{ position: "absolute", top: -14, ...tagSide, zIndex: 5, background: EA.butter, border: `2px solid ${EA.ink}`, padding: "3px 12px", borderRadius: 999, fontFamily: "var(--font-display)", fontSize: 13, color: EA.ink, letterSpacing: 0.6, transform: tagRotate, boxShadow: `2px 2px 0 ${EA.ink}`, whiteSpace: "nowrap" }}>
            {tagText}
          </div>
        )}
        <div style={{ background: bgColor, border: `2.5px solid ${EA.ink}`, borderRadius: 24, padding: "20px 24px", display: "flex", flexDirection: "column", alignItems: "center", gap: 12, transform: rotation, boxShadow: `4px 4px 0 ${shadowColor}`, opacity: !isActive && !isFinished ? 0.6 : 1, transition: "opacity 0.3s", minWidth: 140 }}>
          <Avatar name={pseudo} color={avatarBg} ring={EA.ink} size={64} src={isMe ? myAvatarUrl : opAvatarUrl} />
          <div style={{ fontFamily: "var(--font-display)", fontSize: 18, color: textColor, transform: "skewX(-4deg)", lineHeight: 1, textAlign: "center" }}>{pseudo.toUpperCase()}</div>
          <div style={{ width: 28, height: 28, borderRadius: "50%", background: discColor, border: `2.5px solid ${EA.ink}`, boxShadow: `2px 2px 0 ${EA.ink}` }} />
        </div>
      </div>
    );
  }

  // ── DESKTOP ────────────────────────────────────────────────────────────────
  if (desktop) {
    return (
      <div style={{ position: "relative", minHeight: "100dvh", background: EA.violet, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <RulesButton gameType="puissance4" />
        <div aria-hidden style={{ position: "absolute", inset: 0, opacity: 0.3, backgroundImage: `radial-gradient(circle, rgba(0,212,232,0.5) 1.2px, transparent 1.6px) 0 0 / 16px 16px` }} />
        <SvgBlob color={EA.pink} style={{ width: 560, height: 480, top: -210, left: -170, opacity: 0.6, animation: "ea-float 6s ease-in-out infinite" }} />
        <SvgBlob color={EA.cyan} style={{ width: 500, height: 420, bottom: -170, right: -150, opacity: 0.5, animation: "ea-float 8s ease-in-out infinite reverse" }} path="M 50 30 Q 90 5 140 30 Q 195 50 180 110 Q 175 175 110 175 Q 30 180 25 120 Q 10 60 50 30 Z" />
        <Star color={EA.butter} size={36} style={{ top: "7%", right: "5%", transform: "rotate(15deg)", animation: "ea-spin-slow 10s linear infinite" }} />
        <Star color={EA.white} size={20} style={{ bottom: "10%", left: "4%", animation: "ea-float 6s ease-in-out infinite" }} />
        <Star color={EA.cyan} size={16} style={{ top: "50%", right: "3%", animation: "ea-spin-slow 14s linear infinite reverse" }} />

        <div style={{ position: "relative", zIndex: 5, flex: 1, maxWidth: 1280, width: "100%", margin: "0 auto", display: "flex", flexDirection: "column" }}>
          <div style={{ textAlign: "center", padding: "28px 40px 0" }}>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 900, color: EA.cyan, textTransform: "uppercase", letterSpacing: 2 }}>JEU EN COURS</div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 64, color: EA.white, transform: "skewX(-8deg)", textShadow: `4px 4px 0 ${EA.pink}`, lineHeight: 1, marginTop: 4 }}>PUISSANCE 4 !</div>
          </div>

          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 56, padding: "20px 60px 40px" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
              <PlayerCard isMe align="left" />
              {isMyTurn && !isFinished && (
                <div style={{ fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 900, color: EA.butter, letterSpacing: 1, textTransform: "uppercase", animation: "ea-pulse 1.2s ease-in-out infinite" }}>
                  Choisis une colonne !
                </div>
              )}
            </div>

            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 24 }}>
              <Board cellSize={62} />
              <TurnPill />
            </div>

            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
              <PlayerCard isMe={false} align="right" />
              {!isMyTurn && !isFinished && (
                <div style={{ fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 800, color: "rgba(255,255,255,0.45)", letterSpacing: 1, fontStyle: "italic" }}>
                  En train de réfléchir...
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── MOBILE ─────────────────────────────────────────────────────────────────
  const meActive = isMyTurn && !isFinished;
  const opActive = !isMyTurn && !isFinished;

  return (
    <div style={{ position: "relative", minHeight: "100dvh", background: EA.violet, overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <RulesButton gameType="puissance4" />
      <div aria-hidden style={{ position: "absolute", inset: 0, opacity: 0.3, backgroundImage: `radial-gradient(circle, rgba(0,212,232,0.5) 1.2px, transparent 1.6px) 0 0 / 16px 16px` }} />
      <SvgBlob color={EA.pink} style={{ width: 200, height: 180, top: -80, left: -60, opacity: 0.85, animation: "ea-float 4s ease-in-out infinite" }} />
      <SvgBlob color={EA.cyan} style={{ width: 180, height: 160, bottom: -60, right: -40, opacity: 0.85, animation: "ea-float 6s ease-in-out infinite reverse" }} path="M 50 30 Q 90 5 140 30 Q 195 50 180 110 Q 175 175 110 175 Q 30 180 25 120 Q 10 60 50 30 Z" />
      <Star color={EA.butter} size={18} style={{ top: "30%", right: 16, transform: "rotate(15deg)", animation: "ea-spin-slow 10s linear infinite" }} />

      <div style={{ position: "relative", zIndex: 5, flex: 1, display: "flex", flexDirection: "column", padding: "16px 12px 20px", gap: 12 }}>
        {/* Title */}
        <div style={{ textAlign: "center", flexShrink: 0 }}>
          <div style={{ fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 900, color: EA.cyan, textTransform: "uppercase", letterSpacing: 2 }}>JEU EN COURS</div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 30, color: EA.white, transform: "skewX(-8deg)", textShadow: `3px 3px 0 ${EA.pink}`, lineHeight: 1 }}>PUISSANCE 4 !</div>
        </div>

        {/* Player headers */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexShrink: 0 }}>
          <div style={{ flex: 1, position: "relative" }}>
            {meActive && <div style={{ position: "absolute", top: -10, left: -6, zIndex: 5, background: EA.butter, border: `2px solid ${EA.ink}`, padding: "2px 7px", borderRadius: 999, fontFamily: "var(--font-display)", fontSize: 9, color: EA.ink, letterSpacing: 0.6, transform: "rotate(-8deg)", boxShadow: `2px 2px 0 ${EA.ink}` }}>TON TOUR</div>}
            <div style={{ background: EA.pink, border: `2.5px solid ${EA.ink}`, borderRadius: 18, padding: "8px 10px", display: "flex", alignItems: "center", gap: 8, transform: "rotate(-1deg)", boxShadow: `3px 3px 0 ${EA.cyan}`, opacity: !meActive && !isFinished ? 0.65 : 1 }}>
              <Avatar name={myPseudo} color={EA.butter} ring={EA.ink} size={30} src={myAvatarUrl} />
              <div>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 12, color: EA.white, transform: "skewX(-4deg)", lineHeight: 1 }}>{myPseudo.toUpperCase()}</div>
                <div style={{ width: 14, height: 14, borderRadius: "50%", background: myColor, border: `2px solid ${EA.ink}`, marginTop: 3 }} />
              </div>
            </div>
          </div>
          <div style={{ flexShrink: 0, background: EA.violetDeep, border: `2.5px solid ${EA.ink}`, borderRadius: 14, padding: "5px 8px", fontFamily: "var(--font-display)", fontSize: 14, color: EA.cyan, transform: "skewX(-8deg)", boxShadow: `2px 2px 0 ${EA.pink}` }}>
            {board.filter(c => c === myId).length}—{board.filter(c => c === opponentId).length}
          </div>
          <div style={{ flex: 1, position: "relative" }}>
            {opActive && <div style={{ position: "absolute", top: -10, right: -6, zIndex: 5, background: EA.butter, border: `2px solid ${EA.ink}`, padding: "2px 7px", borderRadius: 999, fontFamily: "var(--font-display)", fontSize: 9, color: EA.ink, letterSpacing: 0.6, transform: "rotate(8deg)", boxShadow: `2px 2px 0 ${EA.ink}` }}>SON TOUR</div>}
            <div style={{ background: EA.cyan, border: `2.5px solid ${EA.ink}`, borderRadius: 18, padding: "8px 10px", display: "flex", alignItems: "center", gap: 8, transform: "rotate(1.5deg)", boxShadow: `3px 3px 0 ${EA.pink}`, opacity: !opActive && !isFinished ? 0.65 : 1 }}>
              <Avatar name={opPseudo} color={EA.pink} ring={EA.ink} size={30} src={opAvatarUrl} />
              <div>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 12, color: EA.ink, transform: "skewX(-4deg)", lineHeight: 1 }}>{opPseudo.toUpperCase()}</div>
                <div style={{ width: 14, height: 14, borderRadius: "50%", background: opColor, border: `2px solid ${EA.ink}`, marginTop: 3 }} />
              </div>
            </div>
          </div>
        </div>

        {/* Board */}
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", minHeight: 0 }}>
          <div style={{ width: "100%", display: "flex", justifyContent: "center" }}>
            <Board cellSize={40} />
          </div>
        </div>

        {/* Turn pill */}
        <div style={{ textAlign: "center", flexShrink: 0 }}>
          <TurnPill />
        </div>
      </div>
      <GameChat gameId={gameId} myId={myId} myPseudo={myPseudo} opponentId={opponentId} opponentPseudo={opPseudo} />
    </div>
  );
}

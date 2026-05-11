"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { EA } from "@/lib/design";
import { Avatar } from "@/components/ui/avatar";
import { Star } from "@/components/ui/star";
import { SvgBlob } from "@/components/ui/blob";
import { submitMorpionMove } from "./actions";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import type { MorpionState, GameStatus } from "@/types/database";

const WINNING_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

function getWinningLine(board: (string | null)[]): number[] | null {
  for (const line of WINNING_LINES) {
    const [a, b, c] = line;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return line;
  }
  return null;
}

function CellX({ size = "70%" }: { size?: string }) {
  return (
    <svg viewBox="0 0 60 60" style={{ width: size, height: size }}>
      <path d="M 12 12 L 48 48 M 48 12 L 12 48" stroke={EA.pink} strokeWidth="9" strokeLinecap="round" fill="none" />
    </svg>
  );
}

function CellO({ size = "70%" }: { size?: string }) {
  return (
    <svg viewBox="0 0 60 60" style={{ width: size, height: size }}>
      <circle cx="30" cy="30" r="18" stroke={EA.cyan} strokeWidth="9" fill="none" />
    </svg>
  );
}

interface Props {
  gameId: string;
  myId: string;
  p1Id: string;
  p2Id: string;
  p1Pseudo: string;
  p2Pseudo: string;
  initialState: MorpionState;
  initialStatus: GameStatus;
  initialCurrentTurn: string | null;
  initialWinnerId: string | null;
}

export function MorpionClient({ gameId, myId, p1Id, p2Id, p1Pseudo, p2Pseudo, initialState, initialStatus, initialCurrentTurn, initialWinnerId }: Props) {
  const router = useRouter();
  const desktop = useIsDesktop();
  const opponentId = myId === p1Id ? p2Id : p1Id;
  const myPseudo = myId === p1Id ? p1Pseudo : p2Pseudo;
  const opPseudo = myId === p1Id ? p2Pseudo : p1Pseudo;
  const iAmP1 = myId === p1Id;

  const [board, setBoard] = useState<(string | null)[]>(initialState.board ?? Array(9).fill(null));
  const [currentTurn, setCurrentTurn] = useState<string | null>(initialCurrentTurn ?? p1Id);
  const [gameStatus, setGameStatus] = useState<GameStatus>(initialStatus);
  const [winnerId, setWinnerId] = useState<string | null>(initialWinnerId);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (initialStatus === "finished") router.push(`/result?game_id=${gameId}`);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const supabase = createClient();
    const sub = supabase
      .channel(`morpion-${gameId}`)
      .on("postgres_changes", {
        event: "UPDATE", schema: "public", table: "games",
        filter: `id=eq.${gameId}`,
      }, (payload) => {
        const updated = payload.new as { state: unknown; status: string; current_turn: string | null; winner_id: string | null };
        const raw = updated.state as Record<string, unknown>;
        const newState: MorpionState = raw && "board" in raw
          ? (raw as unknown as MorpionState)
          : { board: Array(9).fill(null), scores: {} };
        setBoard(newState.board ?? Array(9).fill(null));
        setCurrentTurn(updated.current_turn);
        setGameStatus(updated.status as GameStatus);
        setWinnerId(updated.winner_id);
        if (updated.status === "finished") {
          setTimeout(() => router.push(`/result?game_id=${gameId}`), 1800);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [gameId, router]);

  const isMyTurn = currentTurn === myId;
  const isFinished = gameStatus === "finished";
  const isDraw = isFinished && !winnerId;
  const winLine = winnerId ? getWinningLine(board) : null;

  async function handleCellClick(idx: number) {
    if (!isMyTurn || board[idx] !== null || submitting || isFinished) return;
    setSubmitting(true);
    const newBoard = [...board];
    newBoard[idx] = myId;
    setBoard(newBoard);
    setCurrentTurn(opponentId);
    try { await submitMorpionMove(gameId, idx); } finally { setSubmitting(false); }
  }

  function cellMark(cellValue: string | null, svgSize?: string) {
    if (!cellValue) return null;
    return cellValue === p1Id ? <CellX size={svgSize} /> : <CellO size={svgSize} />;
  }

  // ── Board (shared, size configurable) ─────────────────────────────────────
  function Board({ cellSize = 90 }: { cellSize?: number }) {
    return (
      <div style={{
        background: EA.violetDeep, border: `3px solid ${EA.ink}`,
        borderRadius: 26, padding: 14,
        display: "grid", gridTemplateColumns: "repeat(3, 1fr)",
        gap: 10,
        boxShadow: `5px 5px 0 ${EA.pink}, 5px 5px 0 1px ${EA.ink}`,
        position: "relative",
      }}>
        <div aria-hidden style={{ position: "absolute", inset: 6, borderRadius: 22, backgroundImage: `radial-gradient(circle, rgba(0,212,232,0.25) 0.9px, transparent 1.3px) 0 0 / 10px 10px`, pointerEvents: "none" }} />
        {board.map((cell, idx) => {
          const isWinCell = winLine?.includes(idx) ?? false;
          const isEmpty = cell === null;
          const canClick = isEmpty && isMyTurn && !isFinished && !submitting;
          const accentColor = idx % 2 === 0 ? EA.cyan : EA.pink;
          return (
            <button
              key={idx}
              onClick={() => handleCellClick(idx)}
              disabled={!canClick}
              style={{
                width: cellSize, height: cellSize,
                background: isWinCell ? EA.butter : EA.white,
                border: `2.5px solid ${EA.ink}`,
                borderRadius: 18,
                display: "flex", alignItems: "center", justifyContent: "center",
                position: "relative",
                boxShadow: `3px 3px 0 ${isWinCell ? EA.pink : accentColor}`,
                cursor: canClick ? "pointer" : "default",
                transition: "transform 0.1s",
                flexShrink: 0,
              }}
              onMouseEnter={e => { if (canClick) e.currentTarget.style.transform = "scale(1.06)"; }}
              onMouseLeave={e => { e.currentTarget.style.transform = ""; }}
            >
              {cellMark(cell)}
              {isEmpty && canClick && (
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", opacity: 0, transition: "opacity 0.15s" }}
                  onMouseEnter={e => { e.currentTarget.style.opacity = "0.3"; }}
                  onMouseLeave={e => { e.currentTarget.style.opacity = "0"; }}
                >
                  {iAmP1 ? <CellX /> : <CellO />}
                </div>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  // ── Turn pill ──────────────────────────────────────────────────────────────
  function TurnPill() {
    if (isFinished) {
      return (
        <div style={{ background: isDraw ? `rgba(255,233,74,0.15)` : winnerId === myId ? `rgba(0,212,232,0.15)` : `rgba(255,30,140,0.15)`, border: `2px solid ${isDraw ? EA.butter : winnerId === myId ? EA.cyan : EA.pink}`, borderRadius: 999, padding: "8px 20px", display: "inline-flex", alignItems: "center", gap: 8, boxShadow: `3px 3px 0 ${isDraw ? EA.butter : winnerId === myId ? EA.cyan : EA.pink}` }}>
          <span style={{ fontFamily: "var(--font-display)", fontSize: 18, color: isDraw ? EA.butter : winnerId === myId ? EA.cyan : EA.pink, transform: "skewX(-6deg)" }}>
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

  // ── Player card ────────────────────────────────────────────────────────────
  function PlayerCard({ isMe, align }: { isMe: boolean; align: "left" | "right" }) {
    const isActive = (isMe ? myId : opponentId) === currentTurn && !isFinished;
    const isWinner = winnerId === (isMe ? myId : opponentId);
    const pseudo = isMe ? myPseudo : opPseudo;
    const mark = isMe ? (iAmP1 ? "×" : "○") : (iAmP1 ? "○" : "×");
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

    return (
      <div style={{ position: "relative", display: "inline-block" }}>
        {tagText && (
          <div style={{ position: "absolute", top: -12, ...tagSide, zIndex: 5, background: EA.butter, border: `2px solid ${EA.ink}`, padding: "2px 8px", borderRadius: 999, fontFamily: "var(--font-display)", fontSize: 10, color: EA.ink, letterSpacing: 0.6, transform: tagRotate, boxShadow: `2px 2px 0 ${EA.ink}`, whiteSpace: "nowrap" }}>
            {tagText}
          </div>
        )}
        <div style={{ background: bgColor, border: `2.5px solid ${EA.ink}`, borderRadius: 20, padding: "14px 18px", display: "flex", flexDirection: "column", alignItems: "center", gap: 10, transform: rotation, boxShadow: `4px 4px 0 ${shadowColor}`, opacity: !isActive && !isFinished ? 0.6 : 1, transition: "opacity 0.3s", minWidth: 120 }}>
          <Avatar name={pseudo} color={avatarBg} ring={EA.ink} size={52} />
          <div style={{ fontFamily: "var(--font-display)", fontSize: 15, color: textColor, transform: "skewX(-4deg)", lineHeight: 1, textAlign: "center" }}>{pseudo.toUpperCase()}</div>
          <div style={{ fontFamily: "var(--font-sans)", fontSize: 28, fontWeight: 900, color: textColor, lineHeight: 1 }}>{mark}</div>
        </div>
      </div>
    );
  }

  // ── DESKTOP LAYOUT ─────────────────────────────────────────────────────────
  if (desktop) {
    return (
      <div style={{ position: "relative", minHeight: "100dvh", background: EA.violet, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {/* BG */}
        <div aria-hidden style={{ position: "absolute", inset: 0, opacity: 0.3, backgroundImage: `radial-gradient(circle, rgba(0,212,232,0.5) 1.2px, transparent 1.6px) 0 0 / 16px 16px` }} />
        <SvgBlob color={EA.pink} style={{ width: 380, height: 320, top: -120, left: -100, opacity: 0.6 }} />
        <SvgBlob color={EA.cyan} style={{ width: 340, height: 280, bottom: -100, right: -80, opacity: 0.5 }} path="M 50 30 Q 90 5 140 30 Q 195 50 180 110 Q 175 175 110 175 Q 30 180 25 120 Q 10 60 50 30 Z" />
        <Star color={EA.butter} size={20} style={{ top: "8%", right: "6%", transform: "rotate(15deg)" }} />
        <Star color={EA.white} size={14} style={{ bottom: "12%", left: "5%" }} />

        {/* Header */}
        <div style={{ position: "relative", zIndex: 10, textAlign: "center", padding: "28px 40px 0" }}>
          <div style={{ fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 900, color: EA.cyan, textTransform: "uppercase", letterSpacing: 2 }}>JEU EN COURS</div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 48, color: EA.white, transform: "skewX(-8deg)", textShadow: `4px 4px 0 ${EA.pink}`, lineHeight: 1, marginTop: 4 }}>MORPION !</div>
        </div>

        {/* Main 3-column */}
        <div style={{ position: "relative", zIndex: 5, flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 48, padding: "24px 60px 40px" }}>
          {/* Left — Me */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
            <PlayerCard isMe align="left" />
            {isMyTurn && !isFinished && (
              <div style={{ fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 900, color: EA.butter, letterSpacing: 1, textTransform: "uppercase", animation: "ea-pulse 1.2s ease-in-out infinite" }}>
                Clique sur une case !
              </div>
            )}
          </div>

          {/* Center — Board + turn pill */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 24 }}>
            <Board cellSize={120} />
            <TurnPill />
          </div>

          {/* Right — Opponent */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
            <PlayerCard isMe={false} align="right" />
            {!isMyTurn && !isFinished && (
              <div style={{ fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,0.45)", letterSpacing: 1, fontStyle: "italic" }}>
                En train de réfléchir...
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── MOBILE LAYOUT ──────────────────────────────────────────────────────────
  return (
    <div style={{ position: "absolute", inset: 0, background: EA.violet, overflow: "hidden" }}>
      <div aria-hidden style={{ position: "absolute", inset: 0, opacity: 0.3, backgroundImage: `radial-gradient(circle, rgba(0,212,232,0.5) 1.2px, transparent 1.6px) 0 0 / 16px 16px` }} />
      <SvgBlob color={EA.pink} style={{ width: 220, height: 200, top: -90, left: -70, opacity: 0.85 }} />
      <SvgBlob color={EA.cyan} style={{ width: 200, height: 180, bottom: -70, right: -50, opacity: 0.85 }} path="M 50 30 Q 90 5 140 30 Q 195 50 180 110 Q 175 175 110 175 Q 30 180 25 120 Q 10 60 50 30 Z" />
      <Star color={EA.butter} size={20} style={{ top: 230, right: 18, transform: "rotate(15deg)" }} />
      <Star color={EA.white} size={14} style={{ top: 280, left: 14 }} />

      <div style={{ position: "absolute", top: 64, left: 0, right: 0, textAlign: "center", zIndex: 5 }}>
        <div style={{ fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 900, color: EA.cyan, textTransform: "uppercase", letterSpacing: 2 }}>JEU EN COURS</div>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 36, color: EA.white, transform: "skewX(-8deg)", textShadow: `3px 3px 0 ${EA.pink}`, marginTop: 4, lineHeight: 1 }}>MORPION !</div>
      </div>

      {/* Mobile player headers */}
      <div style={{ position: "absolute", top: 150, left: 16, right: 16, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, zIndex: 5 }}>
        {(() => {
          const meActive = isMyTurn && !isFinished;
          const opActive = !isMyTurn && !isFinished;
          return (
            <>
              <div style={{ flex: 1, position: "relative" }}>
                {meActive && <div style={{ position: "absolute", top: -10, left: -6, zIndex: 5, background: EA.butter, border: `2px solid ${EA.ink}`, padding: "2px 7px", borderRadius: 999, fontFamily: "var(--font-display)", fontSize: 9, color: EA.ink, letterSpacing: 0.6, transform: "rotate(-8deg)", boxShadow: `2px 2px 0 ${EA.ink}` }}>TON TOUR</div>}
                <div style={{ background: EA.pink, border: `2.5px solid ${EA.ink}`, borderRadius: 18, padding: "8px 12px", display: "flex", alignItems: "center", gap: 8, transform: "rotate(-1deg)", boxShadow: `3px 3px 0 ${EA.cyan}`, opacity: !meActive && !isFinished ? 0.65 : 1 }}>
                  <Avatar name={myPseudo} color={EA.butter} ring={EA.ink} size={32} />
                  <div>
                    <div style={{ fontFamily: "var(--font-display)", fontSize: 13, color: EA.white, transform: "skewX(-4deg)", lineHeight: 1 }}>{myPseudo.toUpperCase()}</div>
                    <div style={{ fontFamily: "var(--font-sans)", fontSize: 16, fontWeight: 900, color: EA.white, marginTop: 1, lineHeight: 1 }}>{iAmP1 ? "×" : "○"}</div>
                  </div>
                </div>
              </div>
              <div style={{ flexShrink: 0, background: EA.violetDeep, border: `2.5px solid ${EA.ink}`, borderRadius: 14, padding: "6px 10px", fontFamily: "var(--font-display)", fontSize: 16, color: EA.cyan, transform: "skewX(-8deg)", boxShadow: `2px 2px 0 ${EA.pink}` }}>
                {board.filter(c => c === myId).length}—{board.filter(c => c === opponentId).length}
              </div>
              <div style={{ flex: 1, position: "relative" }}>
                {opActive && <div style={{ position: "absolute", top: -10, right: -6, zIndex: 5, background: EA.butter, border: `2px solid ${EA.ink}`, padding: "2px 7px", borderRadius: 999, fontFamily: "var(--font-display)", fontSize: 9, color: EA.ink, letterSpacing: 0.6, transform: "rotate(8deg)", boxShadow: `2px 2px 0 ${EA.ink}` }}>SON TOUR</div>}
                <div style={{ background: EA.cyan, border: `2.5px solid ${EA.ink}`, borderRadius: 18, padding: "8px 12px", display: "flex", alignItems: "center", gap: 8, transform: "rotate(1.5deg)", boxShadow: `3px 3px 0 ${EA.pink}`, opacity: !opActive && !isFinished ? 0.65 : 1 }}>
                  <Avatar name={opPseudo} color={EA.pink} ring={EA.ink} size={32} />
                  <div>
                    <div style={{ fontFamily: "var(--font-display)", fontSize: 13, color: EA.ink, transform: "skewX(-4deg)", lineHeight: 1 }}>{opPseudo.toUpperCase()}</div>
                    <div style={{ fontFamily: "var(--font-sans)", fontSize: 16, fontWeight: 900, color: EA.ink, marginTop: 1, lineHeight: 1 }}>{iAmP1 ? "○" : "×"}</div>
                  </div>
                </div>
              </div>
            </>
          );
        })()}
      </div>

      <div style={{ position: "absolute", left: 24, right: 24, top: 240, zIndex: 5 }}>
        <Board cellSize={90} />
      </div>

      <div style={{ position: "absolute", bottom: 80, left: 24, right: 24, textAlign: "center", zIndex: 5 }}>
        <TurnPill />
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { EA } from "@/lib/design";
import { Avatar } from "@/components/ui/avatar";
import { Star } from "@/components/ui/star";
import { submitMorpionMove } from "./actions";
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
  const opponentId = myId === p1Id ? p2Id : p1Id;
  const myPseudo = myId === p1Id ? p1Pseudo : p2Pseudo;
  const opPseudo = myId === p1Id ? p2Pseudo : p1Pseudo;

  // p1 = X (cyan), p2 = O (pink)
  const myMark = myId === p1Id ? "X" : "O";
  const opMark = myId === p1Id ? "O" : "X";
  const myColor = myId === p1Id ? EA.cyan : EA.pink;
  const opColor = myId === p1Id ? EA.pink : EA.cyan;

  const [board, setBoard] = useState<(string | null)[]>(initialState.board ?? Array(9).fill(null));
  const [currentTurn, setCurrentTurn] = useState<string | null>(initialCurrentTurn);
  const [gameStatus, setGameStatus] = useState<GameStatus>(initialStatus);
  const [winnerId, setWinnerId] = useState<string | null>(initialWinnerId);
  const [submitting, setSubmitting] = useState(false);

  // Redirect if finished on mount
  useEffect(() => {
    if (initialStatus === "finished") {
      router.push(`/result?game_id=${gameId}`);
    }
    // p1 always goes first
    if (!initialCurrentTurn && initialStatus !== "finished") {
      setCurrentTurn(p1Id);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const supabase = createClient();
    const sub = supabase
      .channel(`morpion-${gameId}`)
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "games",
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

  async function handleCellClick(idx: number) {
    if (!isMyTurn || board[idx] !== null || submitting || gameStatus === "finished") return;
    setSubmitting(true);
    // Optimistic update
    const newBoard = [...board];
    newBoard[idx] = myId;
    setBoard(newBoard);
    setCurrentTurn(opponentId);
    try {
      await submitMorpionMove(gameId, idx);
    } finally {
      setSubmitting(false);
    }
  }

  const winLine = winnerId ? getWinningLine(board) : null;
  const isDraw = gameStatus === "finished" && !winnerId;
  const isFinished = gameStatus === "finished";

  function getCellContent(cellValue: string | null) {
    if (!cellValue) return null;
    const isP1 = cellValue === p1Id;
    return (
      <span style={{
        fontFamily: "var(--font-display)",
        fontSize: 28,
        color: isP1 ? EA.cyan : EA.pink,
        transform: "skewX(-6deg)",
        display: "block",
        animation: "ea-fade-in 0.2s ease-out",
      }}>
        {isP1 ? "✕" : "○"}
      </span>
    );
  }

  return (
    <div style={{ position: "relative", minHeight: "100dvh", background: EA.violet, overflow: "hidden" }}>
      {/* Dot bg */}
      <div aria-hidden style={{
        position: "absolute", inset: 0, opacity: 0.25,
        backgroundImage: "radial-gradient(circle, rgba(0,212,232,0.6) 1.4px, transparent 1.8px)",
        backgroundSize: "16px 16px",
      }} />

      <Star color={EA.butter} size={14} style={{ top: 60, right: 28, animation: "ea-spin-slow 8s linear infinite" }} />
      <Star color={EA.pink} size={10} style={{ top: 130, left: 18 }} />

      {/* Header */}
      <div style={{ position: "relative", zIndex: 10, padding: "20px 20px 0" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: 9, fontWeight: 900, color: EA.cyan, textTransform: "uppercase", letterSpacing: 2 }}>
              MORPION
            </div>
            <div style={{
              fontFamily: "var(--font-display)", fontSize: 13,
              color: isFinished ? (isDraw ? EA.butter : winnerId === myId ? EA.cyan : EA.pink) : "rgba(255,255,255,0.6)",
              transform: "skewX(-6deg)", marginTop: 1,
            }}>
              {isFinished
                ? (isDraw ? "MATCH NUL !" : winnerId === myId ? "VICTOIRE !" : "DÉFAITE !")
                : isMyTurn ? "À TON TOUR !" : `Tour de ${opPseudo}...`}
            </div>
          </div>
          {/* Turn indicator */}
          <div style={{
            background: isMyTurn ? myColor : opColor,
            border: `2px solid ${EA.ink}`,
            borderRadius: 999, padding: "4px 12px",
            fontFamily: "var(--font-display)", fontSize: 11,
            color: EA.ink, transform: "skewX(-6deg)",
            transition: "background 0.3s",
          }}>
            {isMyTurn ? myMark : opMark} JOUE
          </div>
        </div>
      </div>

      {/* Player bar */}
      <div style={{
        position: "relative", zIndex: 10,
        margin: "14px 20px 0",
        background: EA.violetDeep, border: `2.5px solid ${EA.ink}`,
        borderRadius: 14, padding: "10px 14px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        boxShadow: `3px 3px 0 ${EA.ink}`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Avatar name={myPseudo} color={EA.butter} ring={isMyTurn ? myColor : "transparent"} size={34} />
          <div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 10, color: EA.white, transform: "skewX(-4deg)" }}>
              {myPseudo.toUpperCase()}
            </div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 14, color: myColor, transform: "skewX(-4deg)", lineHeight: 1 }}>
              {myMark}
            </div>
          </div>
        </div>

        <div style={{ fontFamily: "var(--font-display)", fontSize: 11, color: "rgba(255,255,255,0.4)", transform: "skewX(-4deg)" }}>
          VS
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexDirection: "row-reverse" }}>
          <Avatar name={opPseudo} color={EA.pink} ring={!isMyTurn && !isFinished ? opColor : "transparent"} size={34} />
          <div style={{ textAlign: "right" }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 10, color: "rgba(255,255,255,0.6)", transform: "skewX(-4deg)" }}>
              {opPseudo.toUpperCase()}
            </div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 14, color: opColor, transform: "skewX(-4deg)", lineHeight: 1 }}>
              {opMark}
            </div>
          </div>
        </div>
      </div>

      {/* Morpion board */}
      <div style={{ position: "relative", zIndex: 10, margin: "24px 20px 0", display: "flex", justifyContent: "center" }}>
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(3, 1fr)",
          gap: 0,
          background: EA.ink,
          border: `3px solid ${EA.ink}`,
          borderRadius: 16,
          overflow: "hidden",
          boxShadow: `5px 5px 0 ${EA.ink}`,
          width: "min(320px, 100%)",
        }}>
          {board.map((cell, idx) => {
            const isWinCell = winLine?.includes(idx) ?? false;
            const isEmpty = cell === null;
            const canClick = isEmpty && isMyTurn && !isFinished && !submitting;

            return (
              <button
                key={idx}
                onClick={() => handleCellClick(idx)}
                disabled={!canClick}
                style={{
                  aspectRatio: "1",
                  background: isWinCell
                    ? (winnerId === myId ? `rgba(0,212,232,0.2)` : `rgba(255,30,140,0.2)`)
                    : EA.violetDeep,
                  border: "none",
                  borderRight: (idx % 3 < 2) ? `2.5px solid ${EA.ink}` : "none",
                  borderBottom: (idx < 6) ? `2.5px solid ${EA.ink}` : "none",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: canClick ? "pointer" : "default",
                  transition: "background 0.2s",
                  position: "relative",
                  minHeight: 90,
                }}
              >
                {isEmpty && canClick && (
                  <span style={{
                    fontFamily: "var(--font-display)",
                    fontSize: 22,
                    color: `${myColor}40`,
                    opacity: 0,
                    transition: "opacity 0.15s",
                  }}
                    onMouseEnter={e => { e.currentTarget.style.opacity = "1"; }}
                    onMouseLeave={e => { e.currentTarget.style.opacity = "0"; }}
                  >
                    {myMark === "X" ? "✕" : "○"}
                  </span>
                )}
                {getCellContent(cell)}
                {isWinCell && (
                  <div style={{
                    position: "absolute", inset: 0,
                    background: winnerId === myId ? `rgba(0,212,232,0.12)` : `rgba(255,30,140,0.12)`,
                    animation: "ea-pulse 0.6s ease-out",
                  }} />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Waiting indicator */}
      {!isMyTurn && !isFinished && (
        <div style={{
          position: "relative", zIndex: 10,
          margin: "18px 20px 0",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        }}>
          <div style={{ fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 800, color: "rgba(255,255,255,0.5)", fontStyle: "italic" }}>
            {opPseudo} réfléchit
          </div>
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              width: 6, height: 6, borderRadius: "50%",
              background: opColor, border: `1.5px solid ${EA.ink}`,
              animation: `ea-bounce 1.2s ease-in-out infinite ${i * 0.2}s`,
            }} />
          ))}
        </div>
      )}

      {/* Finish overlay message */}
      {isFinished && (
        <div style={{
          position: "relative", zIndex: 10,
          margin: "20px 20px 0",
          background: isDraw ? `rgba(255,233,74,0.15)` : winnerId === myId ? `rgba(0,212,232,0.15)` : `rgba(255,30,140,0.15)`,
          border: `2.5px solid ${isDraw ? EA.butter : winnerId === myId ? EA.cyan : EA.pink}`,
          borderRadius: 16, padding: "16px",
          textAlign: "center",
          animation: "ea-fade-in 0.4s ease-out",
        }}>
          <div style={{
            fontFamily: "var(--font-display)", fontSize: 20,
            color: isDraw ? EA.butter : winnerId === myId ? EA.cyan : EA.pink,
            transform: "skewX(-6deg)",
          }}>
            {isDraw ? "🤝 MATCH NUL !" : winnerId === myId ? "🏆 VICTOIRE !" : "💀 DÉFAITE !"}
          </div>
          <div style={{ fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,0.5)", marginTop: 6 }}>
            Redirection vers les résultats...
          </div>
        </div>
      )}
    </div>
  );
}

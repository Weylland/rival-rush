"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { EA } from "@/lib/design";
import { Avatar } from "@/components/ui/avatar";
import { SvgBlob } from "@/components/ui/blob";
import { useOpponentWatcher } from "@/hooks/useOpponentWatcher";
import { useGameSounds } from "@/hooks/useGameSounds";
import { RulesButton } from "@/components/ui/rules-button";
import {
  legalMoves,
  applyMove,
  isInCheck,
  pieceColor,
  pieceType,
  type ChessState,
  type PieceType,
} from "@/lib/chess";
import { submitChessMove, claimChessTimeout } from "./actions";
import type { GameStatus } from "@/types/database";

// ── Piece rendering ───────────────────────────────────────────────────────────

const UNICODE: Record<string, string> = {
  wK: "♔", wQ: "♕", wR: "♖", wB: "♗", wN: "♘", wP: "♙",
  bK: "♚", bQ: "♛", bR: "♜", bB: "♝", bN: "♞", bP: "♟",
};

const PROMO_PIECES: PieceType[] = ["Q", "R", "B", "N"];
const PROMO_LABELS: Record<PieceType, string> = { Q: "♕ Dame", R: "♖ Tour", B: "♗ Fou", N: "♘ Cavalier", K: "", P: "" };

const TIME_LABEL: Record<number, string> = { 60: "⚡ Bullet", 180: "🔥 Blitz", 600: "♟ Rapide" };

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function Clock({ seconds, active }: { seconds: number | null; active: boolean }) {
  if (seconds === null) return null;
  const low = seconds < 30;
  const danger = seconds < 10;
  return (
    <div style={{
      fontFamily: "var(--font-display)",
      fontSize: 20,
      minWidth: 58,
      textAlign: "right",
      color: danger ? "#ff1e8c" : low ? "#ffe94a" : "rgba(255,255,255,0.9)",
      animation: danger && active ? "ea-pulse 0.5s ease-in-out infinite alternate" : "none",
      flexShrink: 0,
    }}>
      {formatTime(seconds)}
    </div>
  );
}

// Light square: warm tan — Dark square: deep purple (EA theme)
const SQ_LIGHT = "#d4b896";
const SQ_DARK = "#6442a8";

function squareColor(idx: number): string {
  return ((Math.floor(idx / 8) + (idx % 8)) % 2 === 0) ? SQ_LIGHT : SQ_DARK;
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  gameId: string;
  myId: string;
  p1Id: string;
  p2Id: string;
  p1Pseudo: string;
  p2Pseudo: string;
  p1AvatarUrl: string | null;
  p2AvatarUrl: string | null;
  initialState: ChessState;
  initialStatus: GameStatus;
  initialCurrentTurn: string | null;
  initialWinnerId: string | null;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ChessClient({
  gameId, myId, p1Id, p2Id,
  p1Pseudo, p2Pseudo, p1AvatarUrl, p2AvatarUrl,
  initialState, initialStatus, initialCurrentTurn, initialWinnerId,
}: Props) {
  const router = useRouter();
  const opponentId = myId === p1Id ? p2Id : p1Id;
  const myPseudo = myId === p1Id ? p1Pseudo : p2Pseudo;
  const opPseudo = myId === p1Id ? p2Pseudo : p1Pseudo;
  const myAvatarUrl = myId === p1Id ? p1AvatarUrl : p2AvatarUrl;
  const opAvatarUrl = myId === p1Id ? p2AvatarUrl : p1AvatarUrl;
  // White = p1 (challenger), Black = p2 (challenged)
  const iAmWhite = myId === p1Id;
  // Board is flipped for black so my pieces are always at the bottom
  const flipBoard = !iAmWhite;

  const [chessState, setChessState] = useState<ChessState>(initialState);
  const [currentTurn, setCurrentTurn] = useState<string | null>(initialCurrentTurn ?? p1Id);
  const [gameStatus, setGameStatus] = useState<GameStatus>(initialStatus);
  const [winnerId, setWinnerId] = useState<string | null>(initialWinnerId);
  const [selected, setSelected] = useState<number | null>(null);
  const [moves, setMoves] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [pendingPromo, setPendingPromo] = useState<{ from: number; to: number } | null>(null);

  const isFinishedRef = useRef(initialStatus === "finished");
  const forfeitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timeoutClaimedRef = useRef(false);

  const isFinished = gameStatus === "finished";

  // Running countdown — only for the current player's clock
  const [runningTime, setRunningTime] = useState<number | null>(null);

  useEffect(() => { isFinishedRef.current = gameStatus === "finished"; }, [gameStatus]);
  useOpponentWatcher({ gameId, opponentId, isFinishedRef });
  const { play } = useGameSounds();

  // Clock countdown
  useEffect(() => {
    if (!chessState.timeControl || !chessState.timeLeft || !chessState.lastMoveAt || isFinished) {
      setRunningTime(null);
      return;
    }
    const baseTime = new Date(chessState.lastMoveAt).getTime();
    const baseRemaining = chessState.timeLeft[currentTurn ?? ""] ?? chessState.timeControl;

    const update = () => {
      const elapsed = (Date.now() - baseTime) / 1000;
      setRunningTime(Math.max(0, baseRemaining - elapsed));
    };
    update();
    const interval = setInterval(update, 200);
    return () => clearInterval(interval);
  }, [chessState.lastMoveAt, chessState.timeLeft, currentTurn, isFinished]); // eslint-disable-line react-hooks/exhaustive-deps

  // Timeout trigger
  useEffect(() => {
    if (runningTime !== null && runningTime <= 0 && !isFinished && !timeoutClaimedRef.current) {
      timeoutClaimedRef.current = true;
      claimChessTimeout(gameId).then(res => {
        if (!res.ok) timeoutClaimedRef.current = false;
      });
    }
  }, [runningTime, isFinished, gameId]);

  // Presence + forfeit
  useEffect(() => {
    if (forfeitTimerRef.current) { clearTimeout(forfeitTimerRef.current); forfeitTimerRef.current = null; }
    const supabase = createClient();
    const updatePresence = () =>
      supabase.from("presence").upsert({ player_id: myId, pseudo: myPseudo, status: "in-game", updated_at: new Date().toISOString() }).then(() => {});
    updatePresence();
    const heartbeat = setInterval(updatePresence, 30_000);
    return () => {
      clearInterval(heartbeat);
      supabase.from("presence").update({ status: "online", updated_at: new Date().toISOString() }).eq("player_id", myId).then(() => {});
      if (!isFinishedRef.current) {
        forfeitTimerRef.current = setTimeout(() => {
          forfeitTimerRef.current = null;
          fetch("/api/forfeit", { method: "POST", body: JSON.stringify({ gameId }), headers: { "Content-Type": "application/json" }, keepalive: true });
        }, 500);
      }
    };
  }, [myId, gameId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Redirect if already finished
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
      .channel(`chess-${gameId}`)
      .on("postgres_changes", {
        event: "UPDATE", schema: "public", table: "games",
        filter: `id=eq.${gameId}`,
      }, (payload) => {
        const updated = payload.new as { state: unknown; status: string; current_turn: string | null; winner_id: string | null };
        const raw = updated.state as Record<string, unknown>;
        const newState: ChessState = (raw && "board" in raw) ? (raw as unknown as ChessState) : chessState;
        setChessState(newState);
        setCurrentTurn(updated.current_turn);
        setGameStatus(updated.status as GameStatus);
        setWinnerId(updated.winner_id);
        setSelected(null);
        setMoves([]);
        timeoutClaimedRef.current = false;
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
  const myColor = iAmWhite ? "w" : "b";
  const turnColor = currentTurn === p1Id ? "w" : "b";
  const kingInCheck = isInCheck(chessState.board, turnColor) && !isFinished;

  // Clock display values
  const myStoredTime = chessState.timeLeft?.[myId] ?? null;
  const opStoredTime = chessState.timeLeft?.[opponentId] ?? null;
  const myDisplayTime = chessState.timeControl
    ? (currentTurn === myId ? runningTime : myStoredTime)
    : null;
  const opDisplayTime = chessState.timeControl
    ? (currentTurn === opponentId ? runningTime : opStoredTime)
    : null;
  const timeLabel = chessState.timeControl ? (TIME_LABEL[chessState.timeControl] ?? `${Math.round(chessState.timeControl / 60)} min`) : null;

  // Board index from display position
  function displayToBoard(dRow: number, dCol: number): number {
    return flipBoard ? (7 - dRow) * 8 + (7 - dCol) : dRow * 8 + dCol;
  }

  function handleSquareClick(boardIdx: number) {
    if (!isMyTurn || submitting || isFinished) return;
    const piece = chessState.board[boardIdx];
    const isMyPiece = piece && pieceColor(piece) === myColor;

    if (selected === null) {
      if (!isMyPiece) return;
      const legal = legalMoves(chessState, boardIdx);
      setSelected(boardIdx);
      setMoves(legal);
    } else {
      if (moves.includes(boardIdx)) {
        // Check promotion
        const movingPiece = chessState.board[selected];
        const destRow = Math.floor(boardIdx / 8);
        const isPromo = movingPiece === `${myColor}P` && ((myColor === "w" && destRow === 0) || (myColor === "b" && destRow === 7));
        if (isPromo) {
          setPendingPromo({ from: selected, to: boardIdx });
          setSelected(null);
          setMoves([]);
        } else {
          doMove(selected, boardIdx, "Q");
        }
      } else if (isMyPiece && boardIdx !== selected) {
        const legal = legalMoves(chessState, boardIdx);
        setSelected(boardIdx);
        setMoves(legal);
      } else {
        setSelected(null);
        setMoves([]);
      }
    }
  }

  function doMove(from: number, to: number, promo: PieceType) {
    // Optimistic update
    const newState = applyMove(chessState, from, to, promo);
    setChessState(newState);
    setCurrentTurn(opponentId);
    setSelected(null);
    setMoves([]);
    setPendingPromo(null);
    play("move");

    setSubmitting(true);
    submitChessMove(gameId, from, to, promo).then(res => {
      if (!res.ok) {
        // Revert on failure — reload fresh state
        router.refresh();
      }
    }).finally(() => setSubmitting(false));
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const playerBarStyle = (isMe: boolean): React.CSSProperties => ({
    display: "flex", alignItems: "center", gap: 10,
    padding: "8px 12px",
    background: isMe ? "rgba(0,212,232,0.08)" : "rgba(255,255,255,0.04)",
    border: `2px solid ${isMe ? EA.cyan : "rgba(255,255,255,0.12)"}`,
    borderRadius: 14,
    boxShadow: isMe ? `2px 2px 0 ${EA.cyan}` : "none",
  });

  const colorLabel = iAmWhite ? "⬜ Blancs" : "⬛ Noirs";
  const opColorLabel = iAmWhite ? "⬛ Noirs" : "⬜ Blancs";

  return (
    <div style={{ minHeight: "100dvh", background: EA.violet, position: "relative", overflow: "hidden" }}>
      <SvgBlob color={EA.cyan} style={{ width: 300, height: 260, top: -100, right: -80, opacity: 0.25, animation: "ea-float 9s ease-in-out infinite" }} />
      <SvgBlob color={EA.pink} style={{ width: 240, height: 200, bottom: -80, left: -60, opacity: 0.2, animation: "ea-float 11s ease-in-out infinite reverse" }} />

      <div style={{ position: "relative", zIndex: 5, maxWidth: 520, margin: "0 auto", padding: "16px 16px 40px", display: "flex", flexDirection: "column", gap: 12 }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 28, color: EA.white, transform: "skewX(-8deg)", textShadow: `2px 2px 0 ${EA.cyan}`, lineHeight: 1 }}>
                ÉCHECS
              </div>
              {timeLabel && (
                <div style={{ fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 900, color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: 1 }}>
                  {timeLabel}
                </div>
              )}
            </div>
            {kingInCheck && (
              <div style={{
                fontFamily: "var(--font-display)", fontSize: 12, color: EA.ink,
                background: EA.pink, border: `2px solid ${EA.ink}`,
                borderRadius: 999, padding: "3px 10px", animation: "ea-pulse 0.8s ease-in-out infinite alternate",
              }}>
                ÉCHEC !
              </div>
            )}
          </div>
          <RulesButton gameType="chess" />
        </div>

        {/* Opponent bar */}
        <div style={playerBarStyle(false)}>
          <Avatar name={opPseudo} src={opAvatarUrl} color={EA.pink} size={32} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 16, color: EA.white }}>{opPseudo.toUpperCase()}</div>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.4)" }}>{opColorLabel}</div>
          </div>
          {!isFinished && currentTurn === opponentId && (
            <div style={{ fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 900, color: EA.pink, animation: "ea-pulse 1s ease-in-out infinite alternate", flexShrink: 0 }}>
              joue…
            </div>
          )}
          <Clock seconds={opDisplayTime} active={currentTurn === opponentId} />
        </div>

        {/* Board */}
        <div style={{
          width: "min(416px, calc(100vw - 32px))",
          alignSelf: "center",
          display: "grid",
          gridTemplateColumns: "repeat(8, 1fr)",
          border: `3px solid ${EA.ink}`,
          borderRadius: 6,
          overflow: "hidden",
          boxShadow: `4px 4px 0 ${EA.cyan}, 4px 4px 0 1px ${EA.ink}`,
          userSelect: "none",
        }}>
          {Array.from({ length: 64 }, (_, displayIdx) => {
            const dRow = Math.floor(displayIdx / 8);
            const dCol = displayIdx % 8;
            const boardIdx = displayToBoard(dRow, dCol);
            const piece = chessState.board[boardIdx];
            const isSelected = selected === boardIdx;
            const isLegal = moves.includes(boardIdx);
            const isLastFrom = chessState.lastMove?.from === boardIdx;
            const isLastTo = chessState.lastMove?.to === boardIdx;
            const isKingInCheck = kingInCheck && piece === `${turnColor}K`;

            let bg = squareColor(boardIdx);
            if (isSelected) bg = EA.cyan;
            else if (isLastFrom || isLastTo) bg = "rgba(255,220,50,0.45)";
            if (isKingInCheck) bg = "rgba(255,30,140,0.7)";

            const pColor = piece ? pieceColor(piece) : null;
            const pieceStyle: React.CSSProperties = {
              fontSize: "clamp(22px, 6vw, 34px)",
              lineHeight: 1,
              color: pColor === "w" ? "#f8f4e8" : "#1a0a2e",
              textShadow: pColor === "w"
                ? "0 0 4px rgba(0,0,0,0.9), 0 1px 3px rgba(0,0,0,0.7)"
                : "0 0 4px rgba(255,255,255,0.7), 0 1px 2px rgba(255,255,255,0.4)",
              pointerEvents: "none",
            };

            return (
              <div
                key={displayIdx}
                onClick={() => handleSquareClick(boardIdx)}
                style={{
                  aspectRatio: "1/1",
                  background: bg,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: (isMyTurn && !isFinished && !submitting) ? "pointer" : "default",
                  position: "relative",
                  transition: "background 0.1s",
                }}
              >
                {/* Legal move indicator */}
                {isLegal && !piece && (
                  <div style={{
                    width: "32%", height: "32%", borderRadius: "50%",
                    background: "rgba(0,212,232,0.6)",
                    pointerEvents: "none",
                  }} />
                )}
                {isLegal && piece && !isSelected && (
                  <div style={{
                    position: "absolute", inset: 2,
                    borderRadius: 3,
                    border: `3px solid rgba(0,212,232,0.8)`,
                    pointerEvents: "none",
                  }} />
                )}
                {/* Piece */}
                {piece && <span style={pieceStyle}>{UNICODE[piece]}</span>}
              </div>
            );
          })}
        </div>

        {/* My bar */}
        <div style={playerBarStyle(true)}>
          <Avatar name={myPseudo} src={myAvatarUrl} color={EA.cyan} size={32} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 16, color: EA.white }}>{myPseudo.toUpperCase()}</div>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.4)" }}>{colorLabel}</div>
          </div>
          {!isFinished && isMyTurn && (
            <div style={{ fontFamily: "var(--font-display)", fontSize: 13, color: EA.cyan, transform: "skewX(-4deg)", flexShrink: 0 }}>
              TON TOUR
            </div>
          )}
          <Clock seconds={myDisplayTime} active={isMyTurn} />
        </div>

        {/* Turn / status info */}
        <div style={{
          textAlign: "center",
          fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 700,
          color: "rgba(255,255,255,0.35)",
        }}>
          {isFinished
            ? winnerId === myId ? "🏆 Victoire !" : winnerId ? "💀 Défaite" : "🤝 Match nul"
            : selected !== null
              ? `${moves.length} coup${moves.length > 1 ? "s" : ""} possible${moves.length > 1 ? "s" : ""} — clique la destination`
              : isMyTurn
                ? "Sélectionne une pièce"
                : "Attends ton adversaire…"
          }
        </div>

      </div>

      {/* Promotion modal */}
      {pendingPromo && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 100,
          background: "rgba(10,8,30,0.9)",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: 20,
        }}>
          <div style={{
            background: "rgba(26,18,58,0.97)",
            border: `2.5px solid ${EA.ink}`,
            borderRadius: 24, padding: "24px 20px",
            boxShadow: `6px 6px 0 ${EA.butter}`,
            width: "100%", maxWidth: 320,
          }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 22, color: EA.white, transform: "skewX(-6deg)", marginBottom: 6 }}>
              Promotion !
            </div>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.4)", marginBottom: 20 }}>
              Choisis la pièce de remplacement
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
              {PROMO_PIECES.map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => doMove(pendingPromo.from, pendingPromo.to, p)}
                  style={{
                    background: "rgba(255,255,255,0.08)",
                    border: `2px solid ${EA.ink}`, borderRadius: 14,
                    padding: "12px 0",
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                    cursor: "pointer",
                  }}
                >
                  <span style={{
                    fontSize: 30,
                    color: myColor === "w" ? "#f8f4e8" : "#1a0a2e",
                    textShadow: myColor === "w"
                      ? "0 0 4px rgba(0,0,0,0.9)"
                      : "0 0 4px rgba(255,255,255,0.7)",
                  }}>{UNICODE[`${myColor}${p}`]}</span>
                  <span style={{ fontFamily: "var(--font-sans)", fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.5)" }}>
                    {PROMO_LABELS[p].split(" ")[1]}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

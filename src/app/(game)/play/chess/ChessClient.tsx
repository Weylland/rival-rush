"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { createClient } from "@/lib/supabase/client";
import { EA } from "@/lib/design";
import { Avatar } from "@/components/ui/avatar";
import { SvgBlob } from "@/components/ui/blob";
import { useOpponentWatcher } from "@/hooks/useOpponentWatcher";
import { useGameSounds } from "@/hooks/useGameSounds";
import { useGamePresence } from "@/hooks/useGamePresence";
import { resolveDuo } from "@/lib/players";
import { RulesButton } from "@/components/ui/rules-button";
import { useGameOpponent } from "@/app/(game)/chat/ChatSystem";
import { PreventLeave } from "@/components/PreventLeave";
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
import {
  UNICODE, PROMO_PIECES, PROMO_LABELS, TIME_LABEL,
  Clock, SQ_DARK, squareColor,
} from "./components/board-ui";

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
  const desktop = useIsDesktop();
  const { opponentId, myPseudo, opPseudo, myAvatarUrl, opAvatarUrl } = resolveDuo({ myId, p1Id, p2Id, p1Pseudo, p2Pseudo, p1AvatarUrl, p2AvatarUrl });
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
  const [dragState, setDragState] = useState<{
    from: number; piece: string;
    x: number; y: number; startX: number; startY: number;
  } | null>(null);

  const isFinishedRef = useRef(initialStatus === "finished");
  const timeoutClaimedRef = useRef(false);
  const boardRef = useRef<HTMLDivElement>(null);

  const isFinished = gameStatus === "finished";

  // Running countdown — only for the current player's clock
  const [runningTime, setRunningTime] = useState<number | null>(null);

  useEffect(() => { isFinishedRef.current = gameStatus === "finished"; }, [gameStatus]);
  useOpponentWatcher({ gameId, opponentId, isFinishedRef });
  useGameOpponent(opponentId, opPseudo);
  useGamePresence({ gameId, myId, myPseudo, gameType: "chess", initialFinished: initialStatus === "finished", isFinishedRef });
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
          setTimeout(() => router.replace(`/result?game_id=${gameId}`), 4000);
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

  // Carré du board sous le curseur (clientX/Y)
  function squareAtPoint(clientX: number, clientY: number): number | null {
    if (!boardRef.current) return null;
    const rect = boardRef.current.getBoundingClientRect();
    const col = Math.floor(((clientX - rect.left) / rect.width) * 8);
    const row = Math.floor(((clientY - rect.top) / rect.height) * 8);
    if (col < 0 || col > 7 || row < 0 || row > 7) return null;
    return displayToBoard(row, col);
  }

  function tryExecuteMove(from: number, to: number) {
    const movingPiece = chessState.board[from];
    const destRow = Math.floor(to / 8);
    const isPromo = movingPiece === `${myColor}P` &&
      ((myColor === "w" && destRow === 0) || (myColor === "b" && destRow === 7));
    if (isPromo) {
      setPendingPromo({ from, to });
      setSelected(null);
      setMoves([]);
    } else {
      doMove(from, to, "Q");
    }
  }

  function handleBoardPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (!isMyTurn || submitting || isFinished) return;
    const boardIdx = squareAtPoint(e.clientX, e.clientY);
    if (boardIdx === null) return;
    const piece = chessState.board[boardIdx];
    const isMyPiece = piece && pieceColor(piece) === myColor;
    if (!isMyPiece) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const legal = legalMoves(chessState, boardIdx);
    setSelected(boardIdx);
    setMoves(legal);
    setDragState({ from: boardIdx, piece, x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY });
  }

  function handleBoardPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragState) return;
    setDragState(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : null);
  }

  function handleBoardPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragState) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    const wasDragging =
      Math.abs(dragState.x - dragState.startX) > 5 ||
      Math.abs(dragState.y - dragState.startY) > 5;
    const targetIdx = squareAtPoint(e.clientX, e.clientY);
    setDragState(null);

    if (!wasDragging) {
      // Click : pièce déjà sélectionnée, attente du 2ème clic
      return;
    }
    // Drag terminé
    if (targetIdx !== null && targetIdx !== dragState.from && moves.includes(targetIdx)) {
      tryExecuteMove(dragState.from, targetIdx);
    } else {
      setSelected(null);
      setMoves([]);
    }
  }

  function handleBoardClick(e: React.MouseEvent<HTMLDivElement>) {
    // Gère le 2ème clic (destination) après sélection par clic ou drag annulé
    if (!isMyTurn || submitting || isFinished) return;
    const boardIdx = squareAtPoint(e.clientX, e.clientY);
    if (boardIdx === null) return;
    const piece = chessState.board[boardIdx];
    const isMyPiece = piece && pieceColor(piece) === myColor;

    if (selected === null) {
      // Sélection initiale si onPointerDown n'a pas pu (ne devrait pas arriver)
      if (!isMyPiece) return;
      setSelected(boardIdx);
      setMoves(legalMoves(chessState, boardIdx));
    } else if (moves.includes(boardIdx)) {
      tryExecuteMove(selected, boardIdx);
    } else if (isMyPiece && boardIdx !== selected) {
      setSelected(boardIdx);
      setMoves(legalMoves(chessState, boardIdx));
    } else {
      setSelected(null);
      setMoves([]);
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

  const colorLabel = iAmWhite ? "⬜ Blancs" : "⬛ Noirs";
  const opColorLabel = iAmWhite ? "⬛ Noirs" : "⬜ Blancs";

  // Desktop: board fills available height, capped at 680px square
  // Outline 8-directional : lisibilité garantie sur n'importe quel fond
  // Pièces blanches : crème avec outline noir net
  const whiteOutline = "1px 0 0 #111,-1px 0 0 #111,0 1px 0 #111,0 -1px 0 #111,1px 1px 0 #111,-1px 1px 0 #111,1px -1px 0 #111,-1px -1px 0 #111,0 0 8px rgba(0,0,0,0.6)";
  // Pièces noires : noir profond avec outline blanc éclatant
  const blackOutline = "1px 0 0 #fff,-1px 0 0 #fff,0 1px 0 #fff,0 -1px 0 #fff,1px 1px 0 #fff,-1px 1px 0 #fff,1px -1px 0 #fff,-1px -1px 0 #fff,0 0 8px rgba(255,255,255,0.4)";

  const boardSize = desktop
    ? "min(660px, calc(100dvh - 300px), calc(100vw - 120px))"
    : "min(480px, calc(100vw - 32px))";

  // Barre joueur — active = c'est son tour
  const PlayerBar = ({ isMe, isActive, pseudo, avatarUrl, clabel, time }: {
    isMe: boolean; isActive: boolean; pseudo: string; avatarUrl: string | null;
    clabel: string; time: number | null;
  }) => {
    const color = isMe ? EA.cyan : EA.pink;
    return (
      <div style={{
        display: "flex", alignItems: "center",
        gap: desktop ? 14 : 10,
        padding: desktop ? "10px 14px" : "8px 12px",
        background: isActive ? `${color}30` : "rgba(255,255,255,0.04)",
        border: `3px solid ${isActive ? color : "rgba(255,255,255,0.08)"}`,
        borderRadius: 16,
        boxShadow: isActive ? `4px 4px 0 ${color}, 4px 4px 0 1px ${EA.ink}` : "none",
        opacity: isFinished ? 0.75 : isActive ? 1 : 0.5,
        transition: "all 0.3s ease",
        width: desktop ? boardSize : undefined,
      }}>
        <Avatar name={pseudo} src={avatarUrl} color={color} size={desktop ? 44 : 34} ring={isActive ? EA.ink : "transparent"} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: desktop ? 20 : 15, color: EA.white, lineHeight: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {pseudo.toUpperCase()}
          </div>
          <div style={{ fontFamily: "var(--font-sans)", fontSize: desktop ? 11 : 10, fontWeight: 700, color: "rgba(255,255,255,0.45)", marginTop: 2 }}>
            {clabel}
          </div>
        </div>
        {/* Badge tour — pill EA quand c'est actif */}
        {!isFinished && isActive && (
          <div style={{
            fontFamily: "var(--font-display)",
            fontSize: desktop ? 13 : 11,
            color: EA.ink,
            background: color,
            border: `2px solid ${EA.ink}`,
            borderRadius: 999,
            padding: desktop ? "4px 14px" : "3px 10px",
            flexShrink: 0,
            letterSpacing: 0.5,
            transform: "skewX(-4deg)",
            boxShadow: `2px 2px 0 ${EA.ink}`,
            animation: "ea-pulse 1s ease-in-out infinite alternate",
          }}>
            {isMe ? "TON TOUR ▶" : "joue…"}
          </div>
        )}
        <Clock seconds={time} active={isActive} />
      </div>
    );
  };

  const statusText = isFinished
    ? winnerId === myId ? "🏆 Victoire !" : winnerId ? "💀 Défaite !" : "🤝 Match nul !"
    : selected !== null
      ? `${moves.length} coup${moves.length > 1 ? "s" : ""} possible${moves.length > 1 ? "s" : ""} — clique la destination`
      : isMyTurn
        ? "Sélectionne une pièce"
        : "Attends ton adversaire…";

  const isDragging = dragState !== null && (
    Math.abs(dragState.x - dragState.startX) > 5 ||
    Math.abs(dragState.y - dragState.startY) > 5
  );
  // Pièces dimensionnées par rapport au PLATEAU (container query cqw) → toujours
  // proportionnelles, même quand la fenêtre change de taille (le plateau est borné
  // par min(dvh, vw), les pièces doivent suivre le plateau, pas le viewport).
  const pieceFs = "clamp(16px, 9cqw, 60px)";
  // Pièce fantôme rendue via portal (hors du container) : taille basée sur le viewport.
  const floatPieceFs = desktop ? "clamp(28px, 4.5vw, 56px)" : "clamp(22px, 7vw, 40px)";

  const board = (
    <div
      ref={boardRef}
      onPointerDown={handleBoardPointerDown}
      onPointerMove={handleBoardPointerMove}
      onPointerUp={handleBoardPointerUp}
      onClick={handleBoardClick}
      style={{
        width: boardSize,
        flexShrink: 0,
        display: "grid",
        gridTemplateColumns: "repeat(8, 1fr)",
        containerType: "inline-size",
        border: `3px solid ${EA.ink}`,
        borderRadius: 6,
        overflow: "hidden",
        boxShadow: `4px 4px 0 ${EA.cyan}, 4px 4px 0 1px ${EA.ink}`,
        userSelect: "none",
        cursor: isDragging ? "grabbing" : "default",
        touchAction: "none",
      }}
    >
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
        const isDragSource = dragState?.from === boardIdx && isDragging;

        let bg = squareColor(boardIdx);
        if (isSelected) bg = EA.cyan;
        else if (isLastFrom || isLastTo) bg = "rgba(255,220,50,0.45)";
        if (isKingInCheck) bg = "rgba(255,30,140,0.7)";

        const pColor = piece ? pieceColor(piece) : null;
        const isCanMove = isMyTurn && !isFinished && !submitting && piece && pieceColor(piece) === myColor;
        // Disque de fond pour garantir lisibilité quelle que soit la couleur de la case
        const discBg = pColor === "w" ? "rgba(255,250,230,0.96)" : "rgba(8,2,22,0.94)";
        const pieceStyle: React.CSSProperties = {
          fontSize: pieceFs,
          lineHeight: 1,
          // Pièces blanches : sombre sur fond clair / Pièces noires : clair sur fond sombre
          color: pColor === "w" ? "#1a0a2e" : "#f0e8ff",
          pointerEvents: "none",
          cursor: isCanMove ? (isDragging ? "grabbing" : "grab") : "default",
          position: "relative", zIndex: 1,
        };

        return (
          <div
            key={displayIdx}
            style={{
              aspectRatio: "1/1",
              background: bg,
              display: "flex", alignItems: "center", justifyContent: "center",
              position: "relative",
              transition: "background 0.1s",
            }}
          >
            {isLegal && !piece && (
              <div style={{
                width: "32%", height: "32%", borderRadius: "50%",
                background: "rgba(0,212,232,0.6)",
                pointerEvents: "none",
              }} />
            )}
            {isLegal && piece && !isSelected && (
              <div style={{
                position: "absolute", inset: 2, borderRadius: 3,
                border: `3px solid rgba(0,212,232,0.8)`,
                pointerEvents: "none",
              }} />
            )}
            {piece && (
              <div style={{
                position: "relative",
                display: "flex", alignItems: "center", justifyContent: "center",
                width: "82%", height: "82%",
                borderRadius: "50%",
                background: isDragSource ? "transparent" : discBg,
                boxShadow: isDragSource ? "none" : pColor === "w"
                  ? "0 1px 4px rgba(0,0,0,0.35)"
                  : "0 1px 4px rgba(0,0,0,0.6)",
                opacity: isDragSource ? 0.15 : 1,
                transition: "opacity 0.1s",
                pointerEvents: "none",
                flexShrink: 0,
              }}>
                <span style={pieceStyle}>{UNICODE[piece]}</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  // Pièce fantôme qui suit le curseur pendant le drag
  const floatingPiece = isDragging && dragState && typeof document !== "undefined"
    ? createPortal(
        <div style={{
          position: "fixed",
          left: dragState.x,
          top: dragState.y,
          transform: "translate(-50%, -60%)",
          width: `calc(${floatPieceFs} * 1.6)`,
          height: `calc(${floatPieceFs} * 1.6)`,
          borderRadius: "50%",
          background: pieceColor(dragState.piece) === "w" ? "rgba(255,250,230,0.97)" : "rgba(8,2,22,0.95)",
          boxShadow: "0 6px 20px rgba(0,0,0,0.5)",
          display: "flex", alignItems: "center", justifyContent: "center",
          pointerEvents: "none",
          zIndex: 9999,
          userSelect: "none",
        }}>
          <span style={{
            fontSize: floatPieceFs,
            lineHeight: 1,
            color: pieceColor(dragState.piece) === "w" ? "#1a0a2e" : "#f0e8ff",
            pointerEvents: "none",
          }}>
            {UNICODE[dragState.piece]}
          </span>
        </div>,
        document.body,
      )
    : null;

  return (
    <div style={{ minHeight: "100dvh", background: EA.violet, position: "relative", overflow: "hidden" }}>
      <SvgBlob color={EA.cyan} style={{ width: 300, height: 260, top: -100, right: -80, opacity: 0.25, animation: "ea-float 9s ease-in-out infinite" }} />
      <SvgBlob color={EA.pink} style={{ width: 240, height: 200, bottom: -80, left: -60, opacity: 0.2, animation: "ea-float 11s ease-in-out infinite reverse" }} />

      {desktop ? (
        /* ── Desktop : centré horizontalement + verticalement ── */
        <div style={{
          position: "relative", zIndex: 5,
          minHeight: "100dvh",
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          gap: 10, padding: "20px 40px",
        }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 4, alignSelf: "stretch", justifyContent: "center" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 32, color: EA.white, transform: "skewX(-8deg)", textShadow: `2px 2px 0 ${EA.cyan}`, lineHeight: 1 }}>
                ÉCHECS
              </div>
              {timeLabel && (
                <div style={{ fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 900, color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: 1 }}>
                  {timeLabel}
                </div>
              )}
            </div>
            {kingInCheck && (
              <div style={{
                fontFamily: "var(--font-display)", fontSize: 13, color: EA.ink,
                background: EA.pink, border: `2px solid ${EA.ink}`,
                borderRadius: 999, padding: "4px 14px", animation: "ea-pulse 0.8s ease-in-out infinite alternate",
              }}>
                ÉCHEC !
              </div>
            )}
            <RulesButton gameType="chess" />
          </div>

          <PlayerBar isMe={false} isActive={!isFinished && currentTurn === opponentId} pseudo={opPseudo} avatarUrl={opAvatarUrl} clabel={opColorLabel} time={opDisplayTime} />
          {board}
          <PlayerBar isMe={true} isActive={!isFinished && isMyTurn} pseudo={myPseudo} avatarUrl={myAvatarUrl} clabel={colorLabel} time={myDisplayTime} />

          <div style={{ fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.35)" }}>
            {statusText}
          </div>
        </div>
      ) : (
        /* ── Mobile : colonne scrollable ── */
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

          <PlayerBar isMe={false} isActive={!isFinished && currentTurn === opponentId} pseudo={opPseudo} avatarUrl={opAvatarUrl} clabel={opColorLabel} time={opDisplayTime} />
          <div style={{ alignSelf: "center", width: boardSize }}>{board}</div>
          <PlayerBar isMe={true} isActive={!isFinished && isMyTurn} pseudo={myPseudo} avatarUrl={myAvatarUrl} clabel={colorLabel} time={myDisplayTime} />

          <div style={{ textAlign: "center", fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.35)" }}>
            {statusText}
          </div>
        </div>
      )}

      {floatingPiece}

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
                    color: myColor === "w" ? "#fffef5" : "#160c30",
                    textShadow: myColor === "w" ? whiteOutline : blackOutline,
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
      <PreventLeave enabled={!isFinished} gameId={gameId} />
    </div>
  );
}

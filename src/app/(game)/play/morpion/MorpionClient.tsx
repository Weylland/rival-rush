"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { EA } from "@/lib/design";
import { Avatar } from "@/components/ui/avatar";
import { Star } from "@/components/ui/star";
import { SvgBlob } from "@/components/ui/blob";
import { submitMorpionMove } from "./actions";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { useOpponentWatcher } from "@/hooks/useOpponentWatcher";
import { useGameSounds } from "@/hooks/useGameSounds";
import { useGamePresence } from "@/hooks/useGamePresence";
import { RulesButton } from "@/components/ui/rules-button";
import { useGameOpponent } from "@/app/(game)/chat/ChatSystem";
import { PreventLeave } from "@/components/PreventLeave";
import { resolveDuo } from "@/lib/players";
import { tictactoeWinningLine } from "@/lib/games/tictactoe";
import type { MorpionState, GameStatus } from "@/types/database";
import { Board } from "./components/Board";
import { TurnPill } from "./components/TurnPill";
import { PlayerCard } from "./components/PlayerCard";

interface Props {
  gameId: string;
  myId: string;
  p1Id: string;
  p2Id: string;
  p1Pseudo: string;
  p2Pseudo: string;
  p1AvatarUrl: string | null;
  p2AvatarUrl: string | null;
  initialState: MorpionState;
  initialStatus: GameStatus;
  initialCurrentTurn: string | null;
  initialWinnerId: string | null;
}

export function MorpionClient({ gameId, myId, p1Id, p2Id, p1Pseudo, p2Pseudo, p1AvatarUrl, p2AvatarUrl, initialState, initialStatus, initialCurrentTurn, initialWinnerId }: Props) {
  const router = useRouter();
  const desktop = useIsDesktop();
  const { iAmP1, opponentId, myPseudo, opPseudo, myAvatarUrl, opAvatarUrl } = resolveDuo({ myId, p1Id, p2Id, p1Pseudo, p2Pseudo, p1AvatarUrl, p2AvatarUrl });

  const [board, setBoard] = useState<(string | null)[]>(initialState.board ?? Array(9).fill(null));
  const [currentTurn, setCurrentTurn] = useState<string | null>(initialCurrentTurn ?? p1Id);
  const [gameStatus, setGameStatus] = useState<GameStatus>(initialStatus);
  const [winnerId, setWinnerId] = useState<string | null>(initialWinnerId);
  const [submitting, setSubmitting] = useState(false);
  const isFinishedRef = useRef<boolean>(initialStatus === "finished");

  useEffect(() => {
    isFinishedRef.current = gameStatus === "finished";
  }, [gameStatus]);

  useOpponentWatcher({ gameId, opponentId, isFinishedRef });
  useGameOpponent(opponentId, opPseudo);
  useGamePresence({ gameId, myId, myPseudo, gameType: "morpion", initialFinished: initialStatus === "finished", isFinishedRef });
  const { play } = useGameSounds();

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
  const isFinished = gameStatus === "finished";
  const isDraw = isFinished && !winnerId;
  const iWon = winnerId === myId;
  const winLine = winnerId ? tictactoeWinningLine(board) : null;

  async function handleCellClick(idx: number) {
    if (!isMyTurn || board[idx] !== null || submitting || isFinished) return;
    play("move");
    setSubmitting(true);
    const newBoard = [...board];
    newBoard[idx] = myId;
    setBoard(newBoard);
    setCurrentTurn(opponentId);
    try { await submitMorpionMove(gameId, idx); } finally { setSubmitting(false); }
  }

  const boardEl = (
    <Board
      board={board} winLine={winLine} p1Id={p1Id} iAmP1={iAmP1}
      isMyTurn={isMyTurn} isFinished={isFinished} submitting={submitting}
      onCellClick={handleCellClick}
    />
  );
  const turnPillEl = (
    <TurnPill isFinished={isFinished} isDraw={isDraw} iWon={iWon} isMyTurn={isMyTurn} opPseudo={opPseudo} />
  );

  // ── DESKTOP LAYOUT ─────────────────────────────────────────────────────────
  if (desktop) {
    return (
      <div style={{ position: "relative", minHeight: "100dvh", background: EA.violet, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <RulesButton gameType="morpion" />
        {/* BG */}
        <div aria-hidden style={{ position: "absolute", inset: 0, opacity: 0.3, backgroundImage: `radial-gradient(circle, rgba(0,212,232,0.5) 1.2px, transparent 1.6px) 0 0 / 16px 16px` }} />
        <SvgBlob color={EA.pink} style={{ width: 580, height: 500, top: -230, left: -180, opacity: 0.65, animation: "ea-float 6s ease-in-out infinite" }} />
        <SvgBlob color={EA.cyan} style={{ width: 520, height: 440, bottom: -180, right: -160, opacity: 0.55, animation: "ea-float 8s ease-in-out infinite reverse" }} path="M 50 30 Q 90 5 140 30 Q 195 50 180 110 Q 175 175 110 175 Q 30 180 25 120 Q 10 60 50 30 Z" />
        <SvgBlob color={EA.butter} style={{ width: 340, height: 300, top: "35%", right: -140, opacity: 0.2, animation: "ea-float 11s ease-in-out infinite" }} />
        <Star color={EA.butter} size={38} style={{ top: "7%", right: "5%", transform: "rotate(15deg)", animation: "ea-spin-slow 10s linear infinite" }} />
        <Star color={EA.white} size={22} style={{ bottom: "10%", left: "4%", animation: "ea-float 6s ease-in-out infinite" }} />
        <Star color={EA.cyan} size={18} style={{ top: "45%", right: "3%", animation: "ea-spin-slow 14s linear infinite reverse" }} />
        <Star color={EA.pink} size={14} style={{ bottom: "28%", right: "6%", transform: "rotate(-15deg)", animation: "ea-float 8s ease-in-out infinite" }} />
        <Star color={EA.butter} size={12} style={{ top: "25%", left: "3%", animation: "ea-spin-slow 9s linear infinite" }} />

        {/* Content wrapper — max-width, bg stays full-screen */}
        <div style={{ position: "relative", zIndex: 5, flex: 1, maxWidth: 1280, width: "100%", margin: "0 auto", display: "flex", flexDirection: "column" }}>
        {/* Header */}
        <div style={{ textAlign: "center", padding: "32px 40px 0" }}>
          <div style={{ fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 900, color: EA.cyan, textTransform: "uppercase", letterSpacing: 2 }}>JEU EN COURS</div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 72, color: EA.white, transform: "skewX(-8deg)", textShadow: `4px 4px 0 ${EA.pink}`, lineHeight: 1, marginTop: 4 }}>MORPION !</div>
        </div>

        {/* Main 3-column */}
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 64, padding: "28px 60px 48px" }}>
          {/* Left — Me */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
            <PlayerCard
              pseudo={myPseudo} avatarUrl={myAvatarUrl} mark={iAmP1 ? "×" : "○"} isMe align="left"
              isActive={currentTurn === myId && !isFinished} isWinner={winnerId === myId} isFinished={isFinished}
            />
            {isMyTurn && !isFinished && (
              <div style={{ fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 900, color: EA.butter, letterSpacing: 1, textTransform: "uppercase", animation: "ea-pulse 1.2s ease-in-out infinite" }}>
                Clique sur une case !
              </div>
            )}
          </div>

          {/* Center — Board + turn pill */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 28, flex: "0 1 480px", minWidth: 0 }}>
            {boardEl}
            {turnPillEl}
          </div>

          {/* Right — Opponent */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
            <PlayerCard
              pseudo={opPseudo} avatarUrl={opAvatarUrl} mark={iAmP1 ? "○" : "×"} isMe={false} align="right"
              isActive={currentTurn === opponentId && !isFinished} isWinner={winnerId === opponentId} isFinished={isFinished}
            />
            {!isMyTurn && !isFinished && (
              <div style={{ fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 800, color: "rgba(255,255,255,0.45)", letterSpacing: 1, fontStyle: "italic" }}>
                En train de réfléchir...
              </div>
            )}
          </div>
        </div>
        </div>{/* end max-width wrapper */}
      </div>
    );
  }

  // ── MOBILE LAYOUT ──────────────────────────────────────────────────────────
  const meActive = isMyTurn && !isFinished;
  const opActive = !isMyTurn && !isFinished;

  return (
    <div style={{ position: "relative", minHeight: "100dvh", background: EA.violet, overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <RulesButton gameType="morpion" />
      <div aria-hidden style={{ position: "absolute", inset: 0, opacity: 0.3, backgroundImage: `radial-gradient(circle, rgba(0,212,232,0.5) 1.2px, transparent 1.6px) 0 0 / 16px 16px` }} />
      <SvgBlob color={EA.pink} style={{ width: 220, height: 200, top: -90, left: -70, opacity: 0.85, animation: "ea-float 4s ease-in-out infinite" }} />
      <SvgBlob color={EA.cyan} style={{ width: 200, height: 180, bottom: -70, right: -50, opacity: 0.85, animation: "ea-float 6s ease-in-out infinite reverse" }} path="M 50 30 Q 90 5 140 30 Q 195 50 180 110 Q 175 175 110 175 Q 30 180 25 120 Q 10 60 50 30 Z" />
      <Star color={EA.butter} size={20} style={{ top: "35%", right: 18, transform: "rotate(15deg)", animation: "ea-spin-slow 10s linear infinite" }} />
      <Star color={EA.white} size={14} style={{ top: "42%", left: 14, animation: "ea-float 5s ease-in-out infinite" }} />

      {/* All content in flex column — no absolute offsets */}
      <div style={{ position: "relative", zIndex: 5, flex: 1, display: "flex", flexDirection: "column", padding: "20px 16px 24px", gap: 16 }}>

        {/* Title */}
        <div style={{ textAlign: "center", flexShrink: 0 }}>
          <div style={{ fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 900, color: EA.cyan, textTransform: "uppercase", letterSpacing: 2 }}>JEU EN COURS</div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 36, color: EA.white, transform: "skewX(-8deg)", textShadow: `3px 3px 0 ${EA.pink}`, lineHeight: 1 }}>MORPION !</div>
        </div>

        {/* Player headers */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexShrink: 0 }}>
          <div style={{ flex: 1, minWidth: 0, position: "relative" }}>
            {meActive && <div style={{ position: "absolute", top: -10, left: -6, zIndex: 5, background: EA.butter, border: `2px solid ${EA.ink}`, padding: "2px 7px", borderRadius: 999, fontFamily: "var(--font-display)", fontSize: 9, color: EA.ink, letterSpacing: 0.6, transform: "rotate(-8deg)", boxShadow: `2px 2px 0 ${EA.ink}` }}>TON TOUR</div>}
            <div style={{ background: EA.pink, border: `2.5px solid ${EA.ink}`, borderRadius: 18, padding: "8px 12px", display: "flex", alignItems: "center", gap: 8, minWidth: 0, transform: "rotate(-1deg)", boxShadow: `3px 3px 0 ${EA.cyan}`, opacity: !meActive && !isFinished ? 0.65 : 1 }}>
              <Avatar name={myPseudo} color={EA.butter} ring={EA.ink} size={32} src={myAvatarUrl} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 13, color: EA.white, transform: "skewX(-4deg)", lineHeight: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{myPseudo.toUpperCase()}</div>
                <div style={{ fontFamily: "var(--font-sans)", fontSize: 16, fontWeight: 900, color: EA.white, marginTop: 1, lineHeight: 1 }}>{iAmP1 ? "×" : "○"}</div>
              </div>
            </div>
          </div>
          <div style={{ flexShrink: 0, background: EA.violetDeep, border: `2.5px solid ${EA.ink}`, borderRadius: 14, padding: "6px 10px", fontFamily: "var(--font-display)", fontSize: 16, color: EA.cyan, transform: "skewX(-8deg)", boxShadow: `2px 2px 0 ${EA.pink}` }}>
            {board.filter(c => c === myId).length}—{board.filter(c => c === opponentId).length}
          </div>
          <div style={{ flex: 1, minWidth: 0, position: "relative" }}>
            {opActive && <div style={{ position: "absolute", top: -10, right: -6, zIndex: 5, background: EA.butter, border: `2px solid ${EA.ink}`, padding: "2px 7px", borderRadius: 999, fontFamily: "var(--font-display)", fontSize: 9, color: EA.ink, letterSpacing: 0.6, transform: "rotate(8deg)", boxShadow: `2px 2px 0 ${EA.ink}` }}>SON TOUR</div>}
            <div style={{ background: EA.cyan, border: `2.5px solid ${EA.ink}`, borderRadius: 18, padding: "8px 12px", display: "flex", alignItems: "center", gap: 8, minWidth: 0, transform: "rotate(1.5deg)", boxShadow: `3px 3px 0 ${EA.pink}`, opacity: !opActive && !isFinished ? 0.65 : 1 }}>
              <Avatar name={opPseudo} color={EA.pink} ring={EA.ink} size={32} src={opAvatarUrl} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 13, color: EA.ink, transform: "skewX(-4deg)", lineHeight: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{opPseudo.toUpperCase()}</div>
                <div style={{ fontFamily: "var(--font-sans)", fontSize: 16, fontWeight: 900, color: EA.ink, marginTop: 1, lineHeight: 1 }}>{iAmP1 ? "○" : "×"}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Board — fills remaining space, max square */}
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", minHeight: 0 }}>
          <div style={{ width: "min(100%, 85dvh - 220px)", maxWidth: 380 }}>
            {boardEl}
          </div>
        </div>

        {/* Turn pill */}
        <div style={{ textAlign: "center", flexShrink: 0 }}>
          {turnPillEl}
        </div>
      </div>
      <PreventLeave enabled={!isFinished} gameId={gameId} />
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { EA } from "@/lib/design";
import { useGameOpponent } from "@/app/(game)/chat/ChatSystem";
import { PreventLeave } from "@/components/PreventLeave";
import { RulesButton } from "@/components/ui/rules-button";
import { submitGuess } from "./actions";
import { useOpponentWatcher } from "@/hooks/useOpponentWatcher";
import { useGameSounds } from "@/hooks/useGameSounds";
import { useGamePresence } from "@/hooks/useGamePresence";
import { resolveDuo } from "@/lib/players";
import { getHeat } from "./components/heat";
import { PlayerScore } from "./components/PlayerScore";
import type { PlusOuMoinsState, PlusOuMoinsGuess, GameStatus } from "@/types/database";

// ── Props ──────────────────────────────────────────────────────────────────────

interface Props {
  gameId: string;
  myId: string;
  p1Id: string;
  p2Id: string;
  p1Pseudo: string;
  p2Pseudo: string;
  p1AvatarUrl: string | null;
  p2AvatarUrl: string | null;
  initialState: PlusOuMoinsState;
  initialStatus: GameStatus;
  initialCurrentTurn: string | null;
  initialWinnerId: string | null;
}

// ── Component ──────────────────────────────────────────────────────────────────

export function PlusOuMoinsClient({
  gameId, myId, p1Id, p2Id,
  p1Pseudo, p2Pseudo, p1AvatarUrl, p2AvatarUrl,
  initialState, initialStatus, initialCurrentTurn,
}: Props) {
  const router = useRouter();
  const { opponentId, myPseudo, opPseudo, myAvatarUrl, opAvatarUrl } = resolveDuo({ myId, p1Id, p2Id, p1Pseudo, p2Pseudo, p1AvatarUrl, p2AvatarUrl });

  const [state, setState] = useState<PlusOuMoinsState>(initialState);
  const [currentTurn, setCurrentTurn] = useState<string | null>(initialCurrentTurn);
  const [gameStatus, setGameStatus] = useState<GameStatus>(initialStatus);
  const [inputValue, setInputValue] = useState<number>(() =>
    Math.floor((initialState.range_min + initialState.range_max) / 2)
  );
  const [submitting, setSubmitting] = useState(false);
  const [lastFeedback, setLastFeedback] = useState<{ value: number; feedback: "plus" | "moins" | "exact" } | null>(null);
  const [flashRound, setFlashRound] = useState(false);

  const isFinishedRef = useRef(initialStatus === "finished");

  const isMyTurn  = currentTurn === myId;
  const isFinished = gameStatus === "finished";

  useEffect(() => { isFinishedRef.current = isFinished; }, [isFinished]);
  useOpponentWatcher({ gameId, opponentId, isFinishedRef });
  useGameOpponent(opponentId, opPseudo);
  useGamePresence({ gameId, myId, myPseudo, gameType: "plus-ou-moins", initialFinished: initialStatus === "finished", isFinishedRef });
  const { play } = useGameSounds();

  // Realtime
  useEffect(() => {
    const supabase = createClient();
    const sub = supabase
      .channel(`plus-ou-moins-${gameId}`)
      .on("postgres_changes", {
        event: "UPDATE", schema: "public", table: "games",
        filter: `id=eq.${gameId}`,
      }, (payload) => {
        const updated = payload.new as { state: unknown; status: string; current_turn: string | null; winner_id: string | null };
        const newState = updated.state as PlusOuMoinsState;
        const prevRound = state.current_round;

        setState(newState);
        setCurrentTurn(updated.current_turn);
        setGameStatus(updated.status as GameStatus);

        // Dernier coup
        const last = newState.guesses[newState.guesses.length - 1];
        if (last) {
          setLastFeedback({ value: last.value, feedback: last.feedback });
          setTimeout(() => setLastFeedback(null), 3000);
        }

        // Nouveau round
        if (newState.current_round > prevRound) {
          setFlashRound(true);
          setTimeout(() => setFlashRound(false), 600);
          play("reveal");
        }

        // Reset input au milieu du nouveau range
        setInputValue(Math.floor((newState.range_min + newState.range_max) / 2));

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

  async function handleSubmit() {
    if (!isMyTurn || submitting || isFinished) return;
    if (inputValue < state.range_min || inputValue > state.range_max) return;
    setSubmitting(true);
    play("move");
    const res = await submitGuess(gameId, inputValue);
    if (!res.ok) console.error(res.error);
    setSubmitting(false);
  }

  function nudge(delta: number) {
    setInputValue(v => Math.max(state.range_min, Math.min(state.range_max, v + delta)));
  }

  // ── Données dérivées ─────────────────────────────────────────────────────────

  const { range_min, range_max, guesses, scores, current_round } = state;
  const myScore = scores[myId] ?? 0;
  const opScore = scores[opponentId] ?? 0;
  const rangeSize = range_max - range_min; // 0 quand trouvé

  // Dernier coup de l'adversaire (pour afficher chaleur)
  const lastOpGuess: PlusOuMoinsGuess | undefined = [...guesses].reverse().find(g => g.player_id === opponentId && g.feedback !== "exact");
  const lastMyGuess: PlusOuMoinsGuess | undefined = [...guesses].reverse().find(g => g.player_id === myId && g.feedback !== "exact");
  const lastAnyGuess = guesses[guesses.length - 1];
  // Proxy de chaleur : la moitié du range restant (plus le range est étroit, plus on est proche)
  const heatDistance = lastAnyGuess ? Math.floor(rangeSize / 2) : 50;
  const heat = getHeat(heatDistance);
  const showHeat = rangeSize < 99 && lastAnyGuess && lastAnyGuess.feedback !== "exact";

  // Barre de range
  const barStart  = (range_min - 1) / 99;  // 0 à 1
  const barWidth  = (range_max - range_min) / 99; // 0 à 1
  const barTension = rangeSize <= 10; // range étroite = tension

  // Guesses sur la barre (hors "exact")
  const barGuesses = guesses.filter(g => g.feedback !== "exact").slice(-10);

  // Derniers coups visibles
  const visibleGuesses = guesses.slice(-5).reverse();

  return (
    <div style={{
      minHeight: "100dvh",
      background: EA.violet,
      display: "flex", flexDirection: "column",
      alignItems: "center",
      padding: "20px 16px 60px",
      gap: 16,
      position: "relative",
      overflow: "hidden",
    }}>

      {/* Dot grid */}
      <div aria-hidden style={{
        position: "fixed", inset: 0,
        backgroundImage: `radial-gradient(circle, rgba(0,212,232,0.15) 1.2px, transparent 1.6px)`,
        backgroundSize: "18px 18px",
        pointerEvents: "none", zIndex: 0,
      }} />

      {/* Blob déco (couleur selon chaleur) */}
      <svg viewBox="0 0 200 200" aria-hidden style={{ position: "fixed", width: 360, height: 280, top: -130, right: -100, opacity: 0.3, pointerEvents: "none", zIndex: 0 }} preserveAspectRatio="none">
        <path d="M 40 60 Q 30 20 80 25 Q 140 10 165 50 Q 195 90 175 140 Q 155 185 100 180 Q 40 190 25 140 Q 5 95 40 60 Z" fill={showHeat ? heat.color : EA.cyan} style={{ transition: "fill 0.8s" }} />
      </svg>
      <svg viewBox="0 0 200 200" aria-hidden style={{ position: "fixed", width: 300, height: 240, bottom: -100, left: -80, opacity: 0.22, pointerEvents: "none", zIndex: 0 }} preserveAspectRatio="none">
        <path d="M 50 30 Q 90 5 140 30 Q 195 50 180 110 Q 175 175 110 175 Q 30 180 25 120 Q 10 60 50 30 Z" fill={EA.pink} />
      </svg>

      {/* ── HEADER : joueurs + scores ── */}
      <div style={{
        width: "100%", maxWidth: 480,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        position: "relative", zIndex: 2,
      }}>
        {/* Moi */}
        <PlayerScore pseudo={myPseudo} avatarUrl={myAvatarUrl} score={myScore} accent={EA.cyan} avatarColor={EA.butter} active={isMyTurn && !isFinished} />

        {/* Centre */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <div style={{
            background: EA.violetDeep, border: `2px solid ${EA.ink}`,
            borderRadius: 999, padding: "4px 14px",
            fontFamily: "var(--font-display)", fontSize: 11, color: EA.cyan, letterSpacing: 1.4,
            boxShadow: `2px 2px 0 ${EA.pink}`,
            animation: flashRound ? "pom-flash 0.4s ease" : "none",
          }}>
            MANCHE {current_round} / 3
          </div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 16, color: "rgba(255,255,255,0.4)", transform: "skewX(-8deg)" }}>VS</div>
        </div>

        {/* Adversaire */}
        <PlayerScore pseudo={opPseudo} avatarUrl={opAvatarUrl} score={opScore} accent={EA.pink} avatarColor={EA.pink} active={!isMyTurn && !isFinished} />
      </div>

      {/* ── BARRE DE RANGE ── */}
      <div style={{
        width: "100%", maxWidth: 480,
        position: "relative", zIndex: 2,
        background: "rgba(255,255,255,0.06)",
        border: `2px solid ${barTension ? (showHeat ? heat.color : EA.pink) : "rgba(255,255,255,0.12)"}`,
        borderRadius: 20, padding: "16px 16px 14px",
        boxShadow: barTension ? `0 0 20px rgba(255,30,140,0.2)` : "none",
        transition: "border-color 0.4s, box-shadow 0.4s",
      }}>
        {/* Labels min/max */}
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 13, color: "rgba(255,255,255,0.4)" }}>1</div>
          <div style={{ fontFamily: "var(--font-sans)", fontSize: 10, fontWeight: 900, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: 1 }}>
            zone valide : {range_min} – {range_max}
          </div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 13, color: "rgba(255,255,255,0.4)" }}>100</div>
        </div>

        {/* Barre */}
        <div style={{ position: "relative", height: 16, borderRadius: 999, background: "rgba(255,255,255,0.08)", overflow: "visible" }}>
          {/* Zone valide */}
          <div style={{
            position: "absolute",
            left: `${barStart * 100}%`,
            width: `${Math.max(barWidth * 100, 1)}%`,
            height: "100%",
            background: showHeat
              ? `linear-gradient(90deg, ${heat.color}99, ${heat.color})`
              : `linear-gradient(90deg, ${EA.cyan}99, ${EA.cyan})`,
            borderRadius: 999,
            boxShadow: showHeat ? `0 0 12px ${heat.glow}` : `0 0 8px rgba(0,212,232,0.4)`,
            transition: "left 0.4s ease, width 0.4s ease, background 0.6s, box-shadow 0.6s",
          }} />

          {/* Dots des coups sur la barre */}
          {barGuesses.map((g, i) => {
            const pos = (g.value - 1) / 99;
            const isMe = g.player_id === myId;
            return (
              <div
                key={i}
                title={`${isMe ? myPseudo : opPseudo}: ${g.value}`}
                style={{
                  position: "absolute",
                  left: `${pos * 100}%`,
                  top: "50%",
                  transform: "translate(-50%, -50%)",
                  width: 10, height: 10,
                  borderRadius: "50%",
                  background: isMe ? EA.butter : EA.pink,
                  border: `2px solid ${EA.ink}`,
                  zIndex: 3,
                }}
              />
            );
          })}
        </div>

        {/* Pourcentage restant */}
        <div style={{ display: "flex", justifyContent: "center", marginTop: 8 }}>
          <div style={{
            fontFamily: "var(--font-sans)", fontSize: 10, fontWeight: 900,
            color: barTension ? (showHeat ? heat.color : EA.pink) : "rgba(255,255,255,0.35)",
            textTransform: "uppercase", letterSpacing: 1.2,
            transition: "color 0.4s",
            animation: barTension ? "pom-pulse 1.5s ease-in-out infinite" : "none",
          }}>
            {rangeSize} nombre{rangeSize > 1 ? "s" : ""} possible{rangeSize > 1 ? "s" : ""}
          </div>
        </div>
      </div>

      {/* ── THERMOMÈTRE / FEEDBACK ── */}
      <div style={{
        width: "100%", maxWidth: 480,
        position: "relative", zIndex: 2,
        minHeight: 72,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        gap: 6,
      }}>
        {lastFeedback && lastFeedback.feedback !== "exact" && (
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
            animation: "pom-pop 0.3s cubic-bezier(0.175,0.885,0.32,1.6)",
          }}>
            {/* Feedback principal */}
            <div style={{
              fontFamily: "var(--font-display)", fontSize: 36,
              color: lastFeedback.feedback === "plus" ? EA.cyan : EA.pink,
              transform: "skewX(-6deg)",
              textShadow: `3px 3px 0 ${EA.ink}`,
              letterSpacing: 2,
            }}>
              {lastFeedback.feedback === "plus" ? "PLUS ↑" : "MOINS ↓"}
            </div>
            {/* Chaleur */}
            {showHeat && (
              <div style={{
                display: "flex", alignItems: "center", gap: 8,
                background: `${heat.color}22`,
                border: `2px solid ${heat.color}88`,
                borderRadius: 999, padding: "4px 16px",
                animation: heatDistance <= 3 ? "pom-pulse 1s ease-in-out infinite" : "none",
              }}>
                <span style={{ fontSize: 18 }}>{heat.emoji}</span>
                <span style={{ fontFamily: "var(--font-display)", fontSize: 16, color: heat.color, transform: "skewX(-4deg)" }}>
                  {heat.label}
                </span>
              </div>
            )}
          </div>
        )}

        {lastFeedback?.feedback === "exact" && (
          <div style={{
            fontFamily: "var(--font-display)", fontSize: 36,
            color: EA.butter,
            transform: "skewX(-6deg) rotate(-2deg)",
            textShadow: `3px 3px 0 ${EA.ink}`,
            animation: "pom-pop 0.3s cubic-bezier(0.175,0.885,0.32,1.6)",
          }}>
            🎯 TROUVÉ !
          </div>
        )}

        {!lastFeedback && !isFinished && (
          <div style={{
            fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 700,
            color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: 1.2,
          }}>
            {isMyTurn ? "⚔ À toi de deviner" : `💭 ${opPseudo} devine…`}
          </div>
        )}
      </div>

      {/* ── HISTORIQUE des coups ── */}
      {visibleGuesses.length > 0 && (
        <div style={{
          width: "100%", maxWidth: 480,
          position: "relative", zIndex: 2,
          display: "flex", flexDirection: "column", gap: 6,
        }}>
          <div style={{ fontFamily: "var(--font-sans)", fontSize: 10, fontWeight: 900, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: 1.5, textAlign: "center" }}>
            Derniers coups
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center" }}>
            {visibleGuesses.map((g, i) => {
              const isMe = g.player_id === myId;
              const feedbackColor = g.feedback === "exact" ? EA.butter : g.feedback === "plus" ? EA.cyan : EA.pink;
              const feedbackIcon = g.feedback === "exact" ? "🎯" : g.feedback === "plus" ? "↑" : "↓";
              return (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: 5,
                  background: isMe ? "rgba(255,233,74,0.1)" : "rgba(255,30,140,0.1)",
                  border: `1.5px solid ${isMe ? "rgba(255,233,74,0.3)" : "rgba(255,30,140,0.3)"}`,
                  borderRadius: 999, padding: "4px 12px",
                }}>
                  <span style={{ fontFamily: "var(--font-sans)", fontSize: 10, fontWeight: 900, color: isMe ? EA.butter : EA.pink }}>
                    {isMe ? "Toi" : opPseudo.slice(0, 4)}
                  </span>
                  <span style={{ fontFamily: "var(--font-display)", fontSize: 14, color: EA.white }}>{g.value}</span>
                  <span style={{ fontFamily: "var(--font-display)", fontSize: 13, color: feedbackColor }}>{feedbackIcon}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── ZONE DE SAISIE ── */}
      {!isFinished && (
        <div style={{
          width: "100%", maxWidth: 480,
          position: "relative", zIndex: 2,
          background: isMyTurn ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.03)",
          border: `2.5px solid ${isMyTurn ? EA.cyan : "rgba(255,255,255,0.1)"}`,
          borderRadius: 24, padding: "20px 16px 18px",
          boxShadow: isMyTurn ? `0 0 24px rgba(0,212,232,0.15)` : "none",
          transition: "all 0.3s",
        }}>
          {/* Nombre affiché */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            gap: 0, marginBottom: 14,
          }}>
            {/* Boutons -10 / -1 */}
            <div style={{ display: "flex", gap: 6 }}>
              {[-10, -1].map(d => (
                <button
                  key={d}
                  type="button"
                  onClick={() => nudge(d)}
                  disabled={!isMyTurn || inputValue + d < state.range_min}
                  style={{
                    width: 44, height: 44,
                    borderRadius: 12,
                    background: !isMyTurn ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.1)",
                    border: `2px solid ${!isMyTurn ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.2)"}`,
                    color: !isMyTurn ? "rgba(255,255,255,0.2)" : EA.white,
                    fontFamily: "var(--font-display)", fontSize: 14,
                    cursor: !isMyTurn ? "not-allowed" : "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "background 0.15s",
                  }}
                >
                  {d}
                </button>
              ))}
            </div>

            {/* Valeur centrale */}
            <div style={{
              flex: 1, textAlign: "center",
              fontFamily: "var(--font-display)", fontSize: 64,
              color: isMyTurn ? EA.white : "rgba(255,255,255,0.3)",
              transform: "skewX(-6deg)",
              textShadow: isMyTurn ? `3px 3px 0 ${EA.violetDeep}` : "none",
              lineHeight: 1,
              transition: "color 0.3s",
              userSelect: "none",
            }}>
              {inputValue}
            </div>

            {/* Boutons +1 / +10 */}
            <div style={{ display: "flex", gap: 6 }}>
              {[1, 10].map(d => (
                <button
                  key={d}
                  type="button"
                  onClick={() => nudge(d)}
                  disabled={!isMyTurn || inputValue + d > state.range_max}
                  style={{
                    width: 44, height: 44,
                    borderRadius: 12,
                    background: !isMyTurn ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.1)",
                    border: `2px solid ${!isMyTurn ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.2)"}`,
                    color: !isMyTurn ? "rgba(255,255,255,0.2)" : EA.white,
                    fontFamily: "var(--font-display)", fontSize: 14,
                    cursor: !isMyTurn ? "not-allowed" : "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "background 0.15s",
                  }}
                >
                  +{d}
                </button>
              ))}
            </div>
          </div>

          {/* Slider */}
          {isMyTurn && (
            <input
              type="range"
              min={state.range_min}
              max={state.range_max}
              value={inputValue}
              onChange={e => setInputValue(Number(e.target.value))}
              style={{
                width: "100%", marginBottom: 14,
                accentColor: EA.cyan,
                cursor: "pointer",
              }}
            />
          )}

          {/* Bouton deviner */}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!isMyTurn || submitting}
            style={{
              width: "100%",
              padding: "16px 0 14px",
              borderRadius: 18,
              background: !isMyTurn ? "rgba(255,255,255,0.06)" : submitting ? EA.cyan : EA.cyan,
              border: `3px solid ${!isMyTurn ? "rgba(255,255,255,0.1)" : EA.ink}`,
              boxShadow: !isMyTurn ? "none" : `5px 5px 0 ${EA.pink}, 5px 5px 0 1px ${EA.ink}`,
              transform: !isMyTurn ? "none" : "skewX(-4deg)",
              cursor: !isMyTurn ? "not-allowed" : submitting ? "wait" : "pointer",
              transition: "all 0.15s",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
            }}
          >
            <span style={{
              fontFamily: "var(--font-display)", fontSize: 20,
              color: !isMyTurn ? "rgba(255,255,255,0.2)" : EA.ink,
              letterSpacing: 1.5,
              transform: "skewX(4deg)",
            }}>
              {submitting ? "…" : !isMyTurn ? `Tour de ${opPseudo}` : "🎯 DEVINER !"}
            </span>
          </button>

          {/* Mini-hint range */}
          {isMyTurn && (
            <div style={{
              marginTop: 10, textAlign: "center",
              fontFamily: "var(--font-sans)", fontSize: 10, fontWeight: 700,
              color: "rgba(255,255,255,0.35)", letterSpacing: 0.8,
            }}>
              Le nombre est entre {state.range_min} et {state.range_max}
            </div>
          )}
        </div>
      )}

      {/* ── GUIDE DES DERNIERS COUPS adversaire ── */}
      {lastOpGuess && !isMyTurn && !isFinished && (
        <div style={{
          position: "relative", zIndex: 2,
          background: "rgba(255,30,140,0.1)",
          border: `1.5px solid rgba(255,30,140,0.3)`,
          borderRadius: 999, padding: "5px 16px",
          fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 800,
          color: "rgba(255,255,255,0.5)",
        }}>
          Dernier coup de {opPseudo} : {lastOpGuess.value} ({lastOpGuess.feedback === "plus" ? "↑ trop bas" : "↓ trop haut"})
        </div>
      )}
      {lastMyGuess && isMyTurn && !isFinished && !lastFeedback && (
        <div style={{
          position: "relative", zIndex: 2,
          background: "rgba(255,233,74,0.08)",
          border: `1.5px solid rgba(255,233,74,0.25)`,
          borderRadius: 999, padding: "5px 16px",
          fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 800,
          color: "rgba(255,255,255,0.5)",
        }}>
          Ton dernier : {lastMyGuess.value} ({lastMyGuess.feedback === "plus" ? "↑ trop bas" : "↓ trop haut"})
        </div>
      )}

      <RulesButton gameType="plus-ou-moins" />
      <PreventLeave enabled={!isFinished} gameId={gameId} />

      <style>{`
        @keyframes pom-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @keyframes pom-pop {
          0% { transform: scale(0.7) skewX(-6deg); opacity: 0; }
          100% { transform: scale(1) skewX(-6deg); opacity: 1; }
        }
        @keyframes pom-flash {
          0%, 100% { background: rgba(26,15,94,1); }
          50% { background: rgba(255,233,74,0.3); }
        }
        input[type=range] {
          -webkit-appearance: none;
          height: 6px;
          border-radius: 3px;
          background: rgba(255,255,255,0.15);
          outline: none;
        }
        input[type=range]::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 22px; height: 22px;
          border-radius: 50%;
          background: ${EA.cyan};
          border: 3px solid ${EA.ink};
          cursor: pointer;
          box-shadow: 0 0 8px rgba(0,212,232,0.5);
        }
      `}</style>
    </div>
  );
}

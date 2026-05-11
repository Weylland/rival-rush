"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { EA } from "@/lib/design";
import { sendChallenge } from "@/app/(game)/lobby/actions";
import { Avatar } from "@/components/ui/avatar";
import { SvgBlob } from "@/components/ui/blob";
import { Star } from "@/components/ui/star";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import type { PFCState } from "@/types/database";

type PFCMove = "pierre" | "feuille" | "ciseaux";
const MOVE_EMOJI: Record<PFCMove, string> = { pierre: "✊", feuille: "✋", ciseaux: "✂️" };

interface Props {
  myId: string;
  p1Id: string;
  p2Id: string;
  p1Pseudo: string;
  p2Pseudo: string;
  winnerId: string | null;
  gameType: "pfc" | "morpion" | "puissance4";
  pfcState: PFCState | null;
  opponentId: string;
  opponentPseudo: string;
}

export function ResultClient({ myId, p1Id, p2Id, p1Pseudo, p2Pseudo, winnerId, gameType, pfcState, opponentId, opponentPseudo }: Props) {
  const router = useRouter();
  const desktop = useIsDesktop();
  const [rematchPending, startRematch] = useTransition();
  const myPseudo = myId === p1Id ? p1Pseudo : p2Pseudo;
  const opPseudo = myId === p1Id ? p2Pseudo : p1Pseudo;

  const isWin = winnerId === myId;
  const isDraw = winnerId === null;
  const isLose = !isWin && !isDraw;

  const outcome = isDraw ? "ÉGALITÉ !" : isWin ? "VICTOIRE !" : "DÉFAITE !";
  const outcomeColor = isDraw ? EA.butter : isWin ? EA.cyan : EA.pink;
  const outcomeSubtitle = isDraw
    ? "Personne ne capitule ici"
    : isWin
    ? `${opPseudo} n'a rien vu venir`
    : `${myPseudo} se vengera la prochaine fois`;

  const myScore = pfcState?.scores?.[myId] ?? 0;
  const opScore = pfcState?.scores?.[opponentId] ?? 0;

  const d = desktop;

  return (
    <div style={{ position: "relative", minHeight: "100dvh", background: EA.violet, overflow: "hidden" }}>
      <div aria-hidden style={{
        position: "absolute", inset: 0, opacity: 0.25,
        backgroundImage: "radial-gradient(circle, rgba(0,212,232,0.6) 1.4px, transparent 1.8px)",
        backgroundSize: "16px 16px",
      }} />

      <SvgBlob color={isWin ? EA.cyan : EA.pink} style={{ width: d ? 580 : 320, height: d ? 500 : 280, top: -160, right: -120, opacity: 0.75, animation: "ea-float 5s ease-in-out infinite" }} />
      <SvgBlob color={EA.butter} style={{ width: d ? 500 : 300, height: d ? 440 : 260, bottom: -160, left: -120, opacity: 0.65, animation: "ea-float 7s ease-in-out infinite reverse" }}
        path="M 50 30 Q 90 5 140 30 Q 195 50 180 110 Q 175 175 110 175 Q 30 180 25 120 Q 10 60 50 30 Z" />
      <SvgBlob color={EA.violetMid} style={{ width: d ? 360 : 220, height: d ? 320 : 200, top: "38%", left: -140, opacity: 0.5, animation: "ea-float 9s ease-in-out infinite" }}
        path="M 40 20 Q 80 0 130 25 Q 190 55 170 120 Q 155 180 85 175 Q 15 170 10 105 Q -5 45 40 20 Z" />

      <Star color={EA.butter} size={d ? 36 : 22} style={{ top: "8%", left: "6%", animation: "ea-spin-slow 10s linear infinite" }} />
      <Star color={EA.white} size={d ? 22 : 15} style={{ top: "6%", right: "8%", animation: "ea-spin-slow 14s linear infinite reverse" }} />
      <Star color={EA.cyan} size={d ? 18 : 13} style={{ bottom: "22%", right: "6%", transform: "rotate(20deg)", animation: "ea-float 5s ease-in-out infinite" }} />
      <Star color={EA.pink} size={d ? 16 : 11} style={{ top: "30%", right: "5%", animation: "ea-spin-slow 8s linear infinite" }} />
      <Star color={EA.butter} size={d ? 14 : 10} style={{ bottom: "10%", left: "8%", transform: "rotate(-15deg)" }} />
      <Star color={EA.white} size={d ? 12 : 9} style={{ top: "55%", left: "5%", animation: "ea-float 6s ease-in-out infinite reverse" }} />

      {/* Centered content wrapper */}
      <div style={{
        position: "relative", zIndex: 10,
        maxWidth: d ? 640 : "100%",
        margin: "0 auto",
        padding: d ? "80px 48px 120px" : "60px 24px 100px",
        display: "flex", flexDirection: "column", alignItems: "center", gap: 0,
      }}>

        {/* Outcome badge */}
        <div style={{
          background: outcomeColor, border: `3px solid ${EA.ink}`,
          borderRadius: 999, padding: d ? "14px 40px" : "10px 28px",
          fontFamily: "var(--font-display)", fontSize: d ? 42 : 28,
          color: EA.ink, transform: "skewX(-10deg) rotate(-2deg)",
          boxShadow: `5px 5px 0 ${EA.ink}`,
          animation: "ea-pulse 1.5s ease-in-out 3",
          marginBottom: d ? 16 : 12,
        }}>
          {isWin ? "🏆 " : isDraw ? "🤝 " : "💀 "}{outcome}
        </div>

        <div style={{
          fontFamily: "var(--font-sans)", fontSize: d ? 18 : 13, fontWeight: 800,
          color: "rgba(255,255,255,0.7)", textAlign: "center", marginBottom: d ? 40 : 32,
          fontStyle: "italic",
        }}>
          {outcomeSubtitle}
        </div>

        {/* Score card */}
        <div style={{
          width: "100%", background: EA.violetDeep, border: `2.5px solid ${EA.ink}`,
          borderRadius: d ? 28 : 20, padding: d ? "28px 24px" : "20px 16px",
          boxShadow: `5px 5px 0 ${EA.ink}`,
          marginBottom: d ? 24 : 20,
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: d ? 12 : 8 }}>
              <Avatar name={myPseudo} color={EA.butter} ring={isWin ? EA.cyan : "rgba(255,255,255,0.3)"} size={d ? 84 : 60} />
              <div style={{ fontFamily: "var(--font-display)", fontSize: d ? 20 : 13, color: EA.white, transform: "skewX(-4deg)" }}>
                {myPseudo.toUpperCase()}
              </div>
              {gameType === "pfc" && (
                <div style={{ fontFamily: "var(--font-display)", fontSize: d ? 52 : 36, color: isWin ? EA.cyan : isLose ? "rgba(255,255,255,0.4)" : EA.butter, transform: "skewX(-6deg)", lineHeight: 1 }}>
                  {myScore}
                </div>
              )}
            </div>

            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: d ? 8 : 4 }}>
              <div style={{
                fontFamily: "var(--font-display)", fontSize: d ? 26 : 20, color: EA.pink,
                transform: "skewX(-8deg) rotate(-4deg)",
                background: "rgba(255,30,140,0.15)", border: `2px solid ${EA.pink}`,
                width: d ? 60 : 44, height: d ? 60 : 44, borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>VS</div>
              <div style={{ fontFamily: "var(--font-sans)", fontSize: d ? 12 : 9, fontWeight: 900, color: "rgba(255,255,255,0.3)", letterSpacing: 2 }}>
                SCORE FINAL
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: d ? 12 : 8 }}>
              <Avatar name={opPseudo} color={EA.pink} ring={isLose ? EA.pink : "rgba(255,255,255,0.3)"} size={d ? 84 : 60} />
              <div style={{ fontFamily: "var(--font-display)", fontSize: d ? 20 : 13, color: "rgba(255,255,255,0.6)", transform: "skewX(-4deg)" }}>
                {opPseudo.toUpperCase()}
              </div>
              {gameType === "pfc" && (
                <div style={{ fontFamily: "var(--font-display)", fontSize: d ? 52 : 36, color: isLose ? EA.pink : "rgba(255,255,255,0.4)", transform: "skewX(-6deg)", lineHeight: 1 }}>
                  {opScore}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* PFC round breakdown */}
        {gameType === "pfc" && pfcState && pfcState.rounds.filter(r => Object.keys(r.moves).length === 2).length > 0 && (
          <div style={{
            width: "100%", background: EA.violetDeep, border: `2.5px solid ${EA.ink}`,
            borderRadius: d ? 20 : 16, padding: d ? "18px 20px" : "14px 14px",
            boxShadow: `3px 3px 0 ${EA.ink}`,
            marginBottom: d ? 36 : 28,
          }}>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: d ? 12 : 9, fontWeight: 900, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: 2, marginBottom: d ? 14 : 10 }}>
              Détail des manches
            </div>
            {pfcState.rounds.filter(r => Object.keys(r.moves).length === 2).map(r => {
              const myM = r.moves[myId] as PFCMove | undefined;
              const opM = r.moves[opponentId] as PFCMove | undefined;
              const rWin = r.winner_id === myId;
              const rDraw = !r.winner_id;
              return (
                <div key={r.round} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: d ? "12px 0" : "8px 0",
                  borderBottom: r.round < pfcState.rounds.filter(r2 => Object.keys(r2.moves).length === 2).length
                    ? `1px solid rgba(255,255,255,0.08)` : "none",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: d ? 10 : 6 }}>
                    <span style={{ fontFamily: "var(--font-display)", fontSize: d ? 13 : 9, color: "rgba(255,255,255,0.3)", width: d ? 24 : 16 }}>M{r.round}</span>
                    <span style={{ fontSize: d ? 32 : 22 }}>{myM ? MOVE_EMOJI[myM] : "?"}</span>
                  </div>
                  <div style={{
                    fontFamily: "var(--font-display)", fontSize: d ? 16 : 10,
                    color: rDraw ? EA.butter : rWin ? EA.cyan : EA.pink,
                    letterSpacing: 1,
                  }}>
                    {rDraw ? "ÉGAL" : rWin ? "WIN" : "LOSE"}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: d ? 10 : 6, justifyContent: "flex-end" }}>
                    <span style={{ fontSize: d ? 32 : 22 }}>{opM ? MOVE_EMOJI[opM] : "?"}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: "flex", flexDirection: "column", gap: d ? 14 : 10, width: "100%" }}>
          <button
            onClick={() => {
              startRematch(async () => {
                await sendChallenge(opponentId, gameType);
              });
            }}
            disabled={rematchPending}
            style={{
              background: EA.butter, border: `2.5px solid ${EA.ink}`,
              borderRadius: d ? 18 : 14, padding: d ? "18px 32px" : "14px 24px",
              fontFamily: "var(--font-display)", fontSize: d ? 22 : 16,
              color: EA.ink, transform: "skewX(-6deg)",
              boxShadow: rematchPending ? "none" : `4px 4px 0 ${EA.pink}, 4px 4px 0 1px ${EA.ink}`,
              cursor: rematchPending ? "wait" : "pointer",
              opacity: rematchPending ? 0.7 : 1,
              transition: "transform 0.1s, box-shadow 0.1s",
            }}
            onMouseDown={e => { if (!rematchPending) { e.currentTarget.style.transform = "skewX(-6deg) translate(4px,4px)"; e.currentTarget.style.boxShadow = "none"; } }}
            onMouseUp={e => { if (!rematchPending) { e.currentTarget.style.transform = "skewX(-6deg)"; e.currentTarget.style.boxShadow = `4px 4px 0 ${EA.pink}, 4px 4px 0 1px ${EA.ink}`; } }}
          >
            <span style={{ display: "inline-block", transform: "skewX(6deg)" }}>
              ⚔ REVANCHE vs {opponentPseudo.toUpperCase()}
            </span>
          </button>
          <button
            onClick={() => router.push("/lobby")}
            style={{
              background: EA.cyan, border: `2.5px solid ${EA.ink}`,
              borderRadius: d ? 18 : 14, padding: d ? "16px 32px" : "12px 24px",
              fontFamily: "var(--font-display)", fontSize: d ? 18 : 14,
              color: EA.ink, transform: "skewX(-6deg)",
              boxShadow: `3px 3px 0 ${EA.ink}`,
              cursor: "pointer",
              transition: "transform 0.1s, box-shadow 0.1s",
            }}
            onMouseDown={e => { e.currentTarget.style.transform = "skewX(-6deg) translate(3px,3px)"; e.currentTarget.style.boxShadow = "none"; }}
            onMouseUp={e => { e.currentTarget.style.transform = "skewX(-6deg)"; e.currentTarget.style.boxShadow = `3px 3px 0 ${EA.ink}`; }}
          >
            🏠 RETOUR AU LOBBY
          </button>
          <button
            onClick={() => router.push("/ranking")}
            style={{
              background: "transparent", border: `2px solid rgba(255,255,255,0.3)`,
              borderRadius: d ? 18 : 14, padding: d ? "14px 32px" : "10px 24px",
              fontFamily: "var(--font-display)", fontSize: d ? 16 : 13,
              color: "rgba(255,255,255,0.6)", transform: "skewX(-6deg)",
              cursor: "pointer",
            }}
          >
            📊 CLASSEMENT
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { EA } from "@/lib/design";
import { Avatar } from "@/components/ui/avatar";
import { SvgBlob } from "@/components/ui/blob";
import { Star } from "@/components/ui/star";
import type { PFCState } from "@/types/database";

type PFCMove = "pierre" | "feuille" | "ciseaux";
const MOVE_EMOJI: Record<PFCMove, string> = { pierre: "🪨", feuille: "📄", ciseaux: "✂️" };

interface Props {
  myId: string;
  p1Id: string;
  p2Id: string;
  p1Pseudo: string;
  p2Pseudo: string;
  winnerId: string | null;
  gameType: "pfc" | "morpion";
  pfcState: PFCState | null;
}

export function ResultClient({ myId, p1Id, p2Id, p1Pseudo, p2Pseudo, winnerId, gameType, pfcState }: Props) {
  const router = useRouter();
  const opponentId = myId === p1Id ? p2Id : p1Id;
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

  return (
    <div style={{ position: "relative", minHeight: "100dvh", background: EA.violet, overflow: "hidden" }}>
      {/* Dot bg */}
      <div aria-hidden style={{
        position: "absolute", inset: 0, opacity: 0.25,
        backgroundImage: "radial-gradient(circle, rgba(0,212,232,0.6) 1.4px, transparent 1.8px)",
        backgroundSize: "16px 16px",
      }} />

      <SvgBlob color={isWin ? EA.cyan : EA.pink} style={{ width: 300, height: 280, top: -120, right: -100, opacity: 0.7, animation: "ea-float 5s ease-in-out infinite" }} />
      <SvgBlob color={EA.butter} style={{ width: 260, height: 240, bottom: -120, left: -100, opacity: 0.6, animation: "ea-float 6s ease-in-out infinite reverse" }}
        path="M 50 30 Q 90 5 140 30 Q 195 50 180 110 Q 175 175 110 175 Q 30 180 25 120 Q 10 60 50 30 Z" />

      <Star color={EA.butter} size={18} style={{ top: 80, left: 30, animation: "ea-spin-slow 10s linear infinite" }} />
      <Star color={EA.white} size={12} style={{ top: 140, right: 24 }} />
      <Star color={EA.cyan} size={10} style={{ bottom: 160, right: 40, transform: "rotate(20deg)" }} />

      <div style={{ position: "relative", zIndex: 10, padding: "60px 24px 100px", display: "flex", flexDirection: "column", alignItems: "center", gap: 0 }}>

        {/* Outcome badge */}
        <div style={{
          background: outcomeColor, border: `3px solid ${EA.ink}`,
          borderRadius: 999, padding: "10px 28px",
          fontFamily: "var(--font-display)", fontSize: 28,
          color: EA.ink, transform: "skewX(-10deg) rotate(-2deg)",
          boxShadow: `5px 5px 0 ${EA.ink}`,
          animation: "ea-pulse 1.5s ease-in-out 3",
          marginBottom: 12,
        }}>
          {isWin ? "🏆 " : isDraw ? "🤝 " : "💀 "}{outcome}
        </div>

        <div style={{
          fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 800,
          color: "rgba(255,255,255,0.7)", textAlign: "center", marginBottom: 32,
          fontStyle: "italic",
        }}>
          {outcomeSubtitle}
        </div>

        {/* Score card */}
        <div style={{
          width: "100%", background: EA.violetDeep, border: `2.5px solid ${EA.ink}`,
          borderRadius: 20, padding: "20px 16px",
          boxShadow: `5px 5px 0 ${EA.ink}`,
          marginBottom: 20,
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              <Avatar name={myPseudo} color={EA.butter} ring={isWin ? EA.cyan : "rgba(255,255,255,0.3)"} size={60} />
              <div style={{ fontFamily: "var(--font-display)", fontSize: 13, color: EA.white, transform: "skewX(-4deg)" }}>
                {myPseudo.toUpperCase()}
              </div>
              {gameType === "pfc" && (
                <div style={{ fontFamily: "var(--font-display)", fontSize: 36, color: isWin ? EA.cyan : isLose ? "rgba(255,255,255,0.4)" : EA.butter, transform: "skewX(-6deg)", lineHeight: 1 }}>
                  {myScore}
                </div>
              )}
            </div>

            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <div style={{
                fontFamily: "var(--font-display)", fontSize: 20, color: EA.pink,
                transform: "skewX(-8deg) rotate(-4deg)",
                background: "rgba(255,30,140,0.15)", border: `2px solid ${EA.pink}`,
                width: 44, height: 44, borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>VS</div>
              <div style={{ fontFamily: "var(--font-sans)", fontSize: 9, fontWeight: 900, color: "rgba(255,255,255,0.3)", letterSpacing: 2 }}>
                SCORE FINAL
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              <Avatar name={opPseudo} color={EA.pink} ring={isLose ? EA.pink : "rgba(255,255,255,0.3)"} size={60} />
              <div style={{ fontFamily: "var(--font-display)", fontSize: 13, color: "rgba(255,255,255,0.6)", transform: "skewX(-4deg)" }}>
                {opPseudo.toUpperCase()}
              </div>
              {gameType === "pfc" && (
                <div style={{ fontFamily: "var(--font-display)", fontSize: 36, color: isLose ? EA.pink : "rgba(255,255,255,0.4)", transform: "skewX(-6deg)", lineHeight: 1 }}>
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
            borderRadius: 16, padding: "14px 14px",
            boxShadow: `3px 3px 0 ${EA.ink}`,
            marginBottom: 28,
          }}>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: 9, fontWeight: 900, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: 2, marginBottom: 10 }}>
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
                  padding: "8px 0",
                  borderBottom: r.round < pfcState.rounds.filter(r2 => Object.keys(r2.moves).length === 2).length
                    ? `1px solid rgba(255,255,255,0.08)` : "none",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontFamily: "var(--font-display)", fontSize: 9, color: "rgba(255,255,255,0.3)", width: 16 }}>M{r.round}</span>
                    <span style={{ fontSize: 22 }}>{myM ? MOVE_EMOJI[myM] : "?"}</span>
                  </div>
                  <div style={{
                    fontFamily: "var(--font-display)", fontSize: 10,
                    color: rDraw ? EA.butter : rWin ? EA.cyan : EA.pink,
                    letterSpacing: 1,
                  }}>
                    {rDraw ? "ÉGAL" : rWin ? "WIN" : "LOSE"}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end" }}>
                    <span style={{ fontSize: 22 }}>{opM ? MOVE_EMOJI[opM] : "?"}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%" }}>
          <button
            onClick={() => router.push("/lobby")}
            style={{
              background: EA.cyan, border: `2.5px solid ${EA.ink}`,
              borderRadius: 14, padding: "14px 24px",
              fontFamily: "var(--font-display)", fontSize: 16,
              color: EA.ink, transform: "skewX(-6deg)",
              boxShadow: `4px 4px 0 ${EA.ink}`,
              cursor: "pointer",
              transition: "transform 0.1s, box-shadow 0.1s",
            }}
            onMouseDown={e => {
              e.currentTarget.style.transform = "skewX(-6deg) translate(4px,4px)";
              e.currentTarget.style.boxShadow = "none";
            }}
            onMouseUp={e => {
              e.currentTarget.style.transform = "skewX(-6deg)";
              e.currentTarget.style.boxShadow = `4px 4px 0 ${EA.ink}`;
            }}
          >
            🏠 RETOUR AU LOBBY
          </button>
          <button
            onClick={() => router.push("/ranking")}
            style={{
              background: "transparent", border: `2px solid rgba(255,255,255,0.3)`,
              borderRadius: 14, padding: "12px 24px",
              fontFamily: "var(--font-display)", fontSize: 14,
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

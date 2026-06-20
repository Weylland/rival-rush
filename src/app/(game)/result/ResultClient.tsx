"use client";

import { Fragment, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMemo, useTransition } from "react";
import { EA } from "@/lib/design";
import { sendChallenge } from "@/app/(game)/lobby/actions";
import { Avatar } from "@/components/ui/avatar";
import { SvgBlob } from "@/components/ui/blob";
import { Star } from "@/components/ui/star";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import type { PFCState } from "@/types/database";

// ── Feux d'artifice ───────────────────────────────────────────────────────────

const FW_COLORS = [EA.cyan, EA.pink, EA.butter, "#FF8C00", "#C084FC", "#00FF88", "#FF6B6B", EA.white];
// Positions de lancement (x%) et hauteur d'explosion (y% depuis le haut)
const LAUNCH_X  = [8, 18, 30, 46, 60, 74, 86, 93];
const BURST_Y   = [8, 15, 10, 18, 12, 9, 20, 14];

const ROCKET_DUR = 0.9;  // secondes montée
const BURST_DUR  = 1.5;  // secondes explosion

interface RocketData {
  id: string; x: number; burstY: number; delay: number;
  color: string; trailH: number;
  particles: { tx: number; ty: number; size: number; color: string; shape: string; pid: string }[];
}

function Fireworks() {
  const rockets = useMemo<RocketData[]>(() => {
    const result: RocketData[] = [];
    const DIRS = 20;
    for (let wave = 0; wave < 3; wave++) {
      for (let i = 0; i < LAUNCH_X.length; i++) {
        const color  = FW_COLORS[(i + wave * 3) % FW_COLORS.length];
        const x      = LAUNCH_X[i] + (Math.random() * 4 - 2);
        const burstY = BURST_Y[i % BURST_Y.length] + Math.random() * 6;
        const delay  = wave * 2.2 + i * 0.16 + Math.random() * 0.08;
        const trailH = 18 + Math.random() * 10;
        const dist   = 90 + Math.random() * 80;
        const particles: RocketData["particles"] = [];
        for (let d = 0; d < DIRS; d++) {
          const angle = (d / DIRS) * 360 + Math.random() * 7;
          const rad   = (angle * Math.PI) / 180;
          const pDist = dist + Math.random() * 55;
          const pColor = Math.random() > 0.35 ? color : FW_COLORS[Math.floor(Math.random() * FW_COLORS.length)];
          particles.push({
            tx: Math.cos(rad) * pDist, ty: Math.sin(rad) * pDist,
            size: 4 + Math.random() * 8,
            color: pColor,
            shape: d % 4 === 0 ? "2px" : "50%",
            pid: `p${wave}-${i}-${d}`,
          });
        }
        result.push({ id: `r${wave}-${i}`, x, burstY, delay, color, trailH, particles });
      }
    }
    return result;
  }, []);

  return (
    <div aria-hidden style={{ position: "fixed", inset: 0, zIndex: 15, pointerEvents: "none", overflow: "hidden" }}>
      <style>{`
        @keyframes fw-rocket {
          0%   { transform: translateY(100vh) scaleY(1); opacity: 0.9; }
          85%  { opacity: 1; }
          100% { transform: translateY(0) scaleY(1); opacity: 0; }
        }
        @keyframes fw-burst {
          0%   { transform: translate(0,0) scale(0); opacity: 0; }
          8%   { transform: translate(0,0) scale(2.5); opacity: 1; }
          55%  { opacity: 1; }
          100% { transform: translate(var(--fw-tx), var(--fw-ty)) scale(0.1); opacity: 0; }
        }
      `}</style>
      {rockets.map(r => (
        <Fragment key={r.id}>
          {/* Fusée qui monte */}
          <div style={{
            position: "absolute",
            left: `${r.x}%`,
            top: `${r.burstY}%`,
            width: 4, height: r.trailH,
            borderRadius: 2,
            background: `linear-gradient(to bottom, transparent, ${r.color})`,
            boxShadow: `0 0 10px 3px ${r.color}`,
            transformOrigin: "center top",
            animation: `fw-rocket ${ROCKET_DUR}s ease-in ${r.delay}s both`,
          }} />
          {/* Explosion */}
          {r.particles.map(p => (
            <div
              key={p.pid}
              style={{
                position: "absolute",
                left: `${r.x}%`,
                top: `${r.burstY}%`,
                width: p.size, height: p.size,
                borderRadius: p.shape,
                background: p.color,
                boxShadow: `0 0 7px 2px ${p.color}`,
                animation: `fw-burst ${BURST_DUR}s ease-out ${r.delay + ROCKET_DUR}s both`,
                "--fw-tx": `${p.tx}px`,
                "--fw-ty": `${p.ty}px`,
              } as React.CSSProperties}
            />
          ))}
        </Fragment>
      ))}
    </div>
  );
}

// ── Pluie de défaite ──────────────────────────────────────────────────────────

const LOSE_EMOJIS = ["😭","😭","😭","😢","😢","💔","💔","😭","😢","😭","💔","😭","😢","😭","💔","😭","😢","😢","💔","😭","😢","😭","💔","😢","😭"];

function LoseRain() {
  const drops = useMemo(() =>
    LOSE_EMOJIS.map((emoji, i) => ({
      emoji,
      x: 1 + (i * 3.9) % 97,
      delay: i * 0.12 + Math.random() * 0.15,
      duration: 1.4 + Math.random() * 1.0,
      size: 28 + Math.random() * 24,
      rotate: -30 + Math.random() * 60,
    }))
  , []);

  return (
    <div aria-hidden style={{ position: "fixed", inset: 0, zIndex: 15, pointerEvents: "none", overflow: "hidden" }}>
      {drops.map((d, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: `${d.x}%`,
            top: -60,
            fontSize: d.size,
            willChange: "top, opacity",
            animation: `lose-fall ${d.duration}s ease-in ${d.delay}s both`,
            transform: `rotate(${d.rotate}deg)`,
          }}
        >
          {d.emoji}
        </div>
      ))}
      <style>{`
        @keyframes lose-fall {
          0%   { top: -60px; opacity: 1; }
          75%  { opacity: 0.9; }
          100% { top: 108vh;  opacity: 0; }
        }
      `}</style>
    </div>
  );
}

// ── Croix rouge perdant ───────────────────────────────────────────────────────

function RedX({ size }: { size: number }) {
  const thickness = Math.round(size * 0.14);
  const len       = Math.round(size * 0.72);
  return (
    <div style={{
      position: "absolute", inset: 0, zIndex: 4,
      display: "flex", alignItems: "center", justifyContent: "center",
      animation: "x-stamp 0.35s cubic-bezier(0.175,0.885,0.32,1.6) 0.45s both",
    }}>
      <div style={{ position: "relative", width: len, height: len }}>
        {/* Barre \ */}
        <div style={{
          position: "absolute", top: "50%", left: "50%",
          width: len, height: thickness,
          background: "#FF1515",
          borderRadius: thickness,
          boxShadow: `0 0 12px rgba(255,21,21,0.9), 0 0 24px rgba(255,21,21,0.5)`,
          transform: "translate(-50%,-50%) rotate(45deg)",
        }} />
        {/* Barre / */}
        <div style={{
          position: "absolute", top: "50%", left: "50%",
          width: len, height: thickness,
          background: "#FF1515",
          borderRadius: thickness,
          boxShadow: `0 0 12px rgba(255,21,21,0.9), 0 0 24px rgba(255,21,21,0.5)`,
          transform: "translate(-50%,-50%) rotate(-45deg)",
        }} />
      </div>
    </div>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────

type PFCMove = "pierre" | "feuille" | "ciseaux";
const MOVE_EMOJI: Record<PFCMove, string> = { pierre: "✊", feuille: "✋", ciseaux: "✂️" };

interface Props {
  myId: string;
  p1Id: string;
  p2Id: string;
  p1Pseudo: string;
  p2Pseudo: string;
  p1AvatarUrl: string | null;
  p2AvatarUrl: string | null;
  p1AvatarColor: string | null;
  p2AvatarColor: string | null;
  winnerId: string | null;
  gameType: "pfc" | "morpion" | "puissance4" | "reflexe" | "naval" | "chess";
  pfcState: PFCState | null;
  opponentId: string;
  opponentPseudo: string;
  roomCode?: string | null;
  roomName?: string | null;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ResultClient({ myId, p1Id, p2Id, p1Pseudo, p2Pseudo, p1AvatarUrl, p2AvatarUrl, p1AvatarColor, p2AvatarColor, winnerId, gameType, pfcState, opponentId, opponentPseudo, roomCode, roomName }: Props) {
  const router = useRouter();
  const desktop = useIsDesktop();

  // Intercepte le bouton retour du navigateur : quelle que soit l'historique,
  // retour depuis l'écran résultat → lobby (jamais vers la page de jeu)
  useEffect(() => {
    history.pushState(null, "", window.location.href);
    const handlePopState = () => {
      router.replace(roomCode ? `/room/${roomCode}` : "/lobby");
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [router, roomCode]);
  const [rematchPending, startRematch] = useTransition();
  const myPseudo   = myId === p1Id ? p1Pseudo : p2Pseudo;
  const opPseudo   = myId === p1Id ? p2Pseudo : p1Pseudo;
  const myAvatarUrl = myId === p1Id ? p1AvatarUrl : p2AvatarUrl;
  const opAvatarUrl = myId === p1Id ? p2AvatarUrl : p1AvatarUrl;
  const myAvatarColor = myId === p1Id ? p1AvatarColor : p2AvatarColor;
  const opAvatarColor = myId === p1Id ? p2AvatarColor : p1AvatarColor;

  const isWin  = winnerId === myId;
  const isDraw = winnerId === null;
  const isLose = !isWin && !isDraw;

  const outcome      = isDraw ? "ÉGALITÉ !" : isWin ? "VICTOIRE !" : "DÉFAITE !";
  const outcomeColor = isDraw ? EA.butter : isWin ? EA.cyan : EA.pink;
  const outcomeSubtitle = isDraw
    ? "Personne ne capitule ici"
    : isWin
    ? `${opPseudo} n'a rien vu venir`
    : `${myPseudo} se vengera la prochaine fois`;

  const myScore = pfcState?.scores?.[myId] ?? 0;
  const opScore = pfcState?.scores?.[opponentId] ?? 0;
  const avatarSize = desktop ? 84 : 60;

  const d = desktop;

  // Couronne centrée sur le haut du cercle, légèrement inclinée selon le joueur
  function Crown({ side }: { side: "left" | "right" }) {
    const size = d ? 38 : 30;
    const rot  = side === "left" ? -16 : 16;
    return (
      <div style={{
        position: "absolute",
        top: -(size * 0.62),
        left: "50%",
        zIndex: 5,
        animation: "crown-drop 0.55s cubic-bezier(0.175,0.885,0.32,1.6) 0.3s both",
      }}>
        <span style={{
          display: "block",
          fontSize: size,
          lineHeight: 1,
          transform: `rotate(${rot}deg)`,
          filter: "drop-shadow(0 2px 10px rgba(255,233,74,0.95)) drop-shadow(0 0 6px #FFE94A)",
        }}>👑</span>
      </div>
    );
  }

  return (
    <div style={{ position: "relative", minHeight: "100dvh", background: EA.violet, overflow: "hidden" }}>
      {isWin  && <Fireworks />}
      {isLose && <LoseRain />}

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
          {isWin ? "🏆 " : isDraw ? "🤝 " : "❌ "}{outcome}
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
          borderRadius: d ? 28 : 20, padding: d ? "32px 24px 24px" : "24px 16px 16px",
          boxShadow: `5px 5px 0 ${EA.ink}`,
          marginBottom: d ? 24 : 20,
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>

            {/* ── MOI (gauche) ── */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: d ? 12 : 8 }}>
              <div style={{ position: "relative", display: "inline-block" }}>
                {isWin  && <Crown side="left" />}
                {isLose && <RedX size={avatarSize} />}
                <Avatar
                  name={myPseudo} src={myAvatarUrl}
                  color={myAvatarColor ?? EA.butter}
                  ring={isWin ? EA.cyan : isLose ? "#FF1515" : "rgba(255,255,255,0.3)"}
                  size={avatarSize}
                />
              </div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: d ? 20 : 13, color: EA.white, transform: "skewX(-4deg)" }}>
                {myPseudo.toUpperCase()}
              </div>
              {gameType === "pfc" && (
                <div style={{ fontFamily: "var(--font-display)", fontSize: d ? 52 : 36, color: isWin ? EA.cyan : isLose ? "rgba(255,255,255,0.4)" : EA.butter, transform: "skewX(-6deg)", lineHeight: 1 }}>
                  {myScore}
                </div>
              )}
            </div>

            {/* VS */}
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

            {/* ── ADVERSAIRE (droite) ── */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: d ? 12 : 8 }}>
              <div style={{ position: "relative", display: "inline-block" }}>
                {isLose && <Crown side="right" />}
                {isWin  && <RedX size={avatarSize} />}
                <Avatar
                  name={opPseudo} src={opAvatarUrl}
                  color={opAvatarColor ?? EA.pink}
                  ring={isLose ? EA.cyan : isWin ? "#FF1515" : "rgba(255,255,255,0.3)"}
                  size={avatarSize}
                />
              </div>
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
              const myM  = r.moves[myId] as PFCMove | undefined;
              const opM  = r.moves[opponentId] as PFCMove | undefined;
              const rWin  = r.winner_id === myId;
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
                  <div style={{ fontFamily: "var(--font-display)", fontSize: d ? 16 : 10, color: rDraw ? EA.butter : rWin ? EA.cyan : EA.pink, letterSpacing: 1 }}>
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
            onClick={() => { startRematch(async () => { await sendChallenge(opponentId, gameType); }); }}
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
            onClick={() => router.replace(roomCode ? `/room/${roomCode}` : "/lobby")}
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
            <span style={{ display: "inline-block", transform: "skewX(6deg)" }}>
              🏠 {roomCode ? `RETOUR À ${(roomName ?? roomCode).toUpperCase()}` : "RETOUR AU LOBBY"}
            </span>
          </button>
          <button
            onClick={() => router.replace(roomCode ? `/room/${roomCode}?tab=ranking` : "/ranking")}
            style={{
              background: "transparent", border: `2px solid rgba(255,255,255,0.3)`,
              borderRadius: d ? 18 : 14, padding: d ? "14px 32px" : "10px 24px",
              fontFamily: "var(--font-display)", fontSize: d ? 16 : 13,
              color: "rgba(255,255,255,0.6)", transform: "skewX(-6deg)",
              cursor: "pointer",
            }}
          >
            <span style={{ display: "inline-block", transform: "skewX(6deg)" }}>
              📊 {roomCode ? "CLASSEMENT DE LA SALLE" : "CLASSEMENT"}
            </span>
          </button>
        </div>
      </div>

      <style>{`
        @keyframes crown-drop {
          0%   { transform: translateX(-50%) translateY(-28px) scale(0); opacity: 0; }
          55%  { transform: translateX(-50%) translateY(5px) scale(1.3); opacity: 1; }
          100% { transform: translateX(-50%) translateY(0) scale(1); opacity: 1; }
        }
        @keyframes x-stamp {
          0%   { transform: scale(0) rotate(-20deg); opacity: 0; }
          60%  { transform: scale(1.15) rotate(3deg); opacity: 1; }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

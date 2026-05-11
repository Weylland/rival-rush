"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { cancelChallenge } from "@/app/(game)/lobby/actions";
import { EA } from "@/lib/design";
import { Avatar } from "@/components/ui/avatar";
import { SvgBlob } from "@/components/ui/blob";
import { Star } from "@/components/ui/star";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import type { GameType } from "@/types/database";

const TIPS = [
  "Au PFC, observe le rythme de l'adversaire 👀",
  "Au Morpion, les coins valent de l'or 🎯",
  "La victoire sourit aux audacieux ⚡",
  "Garde ton calme, c'est là que tout se joue 🧠",
];

interface Props {
  challengeId: string;
  myPseudo: string;
  opponentPseudo: string;
  gameType: GameType;
}

export function WaitingClient({ challengeId, myPseudo, opponentPseudo, gameType }: Props) {
  const router = useRouter();
  const desktop = useIsDesktop();
  const [, startTransition] = useTransition();
  const tip = TIPS[Math.floor(Math.random() * TIPS.length)];

  useEffect(() => {
    const supabase = createClient();
    const sub = supabase
      .channel(`challenge-${challengeId}`)
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "challenges",
        filter: `id=eq.${challengeId}`,
      }, (payload) => {
        const updated = payload.new as { status: string };
        if (updated.status === "declined" || updated.status === "cancelled") {
          router.push("/lobby");
        }
      })
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "games",
        filter: `challenge_id=eq.${challengeId}`,
      }, (payload) => {
        const game = payload.new as { id: string; game_type: GameType };
        router.push(`/play/${game.game_type}?game_id=${game.id}`);
      })
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [challengeId, router]);

  return (
    <div style={{ position: "relative", minHeight: "100dvh", background: EA.violet, overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <div aria-hidden style={{
        position: "absolute", inset: 0, opacity: 0.3,
        backgroundImage: "radial-gradient(circle, rgba(0,212,232,0.5) 1.4px, transparent 1.8px)",
        backgroundSize: "16px 16px",
      }} />
      <SvgBlob color={EA.pink} style={{ width: desktop ? 560 : 300, height: desktop ? 480 : 260, top: -160, right: -130, opacity: 0.8, animation: "ea-float 4s ease-in-out infinite" }} />
      <SvgBlob color={EA.cyan} style={{ width: desktop ? 480 : 280, height: desktop ? 420 : 240, bottom: -160, left: -120, opacity: 0.75, animation: "ea-float 6s ease-in-out infinite reverse" }}
        path="M 50 30 Q 90 5 140 30 Q 195 50 180 110 Q 175 175 110 175 Q 30 180 25 120 Q 10 60 50 30 Z" />
      <SvgBlob color={EA.butter} style={{ width: desktop ? 320 : 200, height: desktop ? 280 : 180, top: "40%", left: -120, opacity: 0.35, animation: "ea-float 9s ease-in-out infinite" }}
        path="M 40 20 Q 80 0 130 25 Q 190 55 170 120 Q 155 180 85 175 Q 15 170 10 105 Q -5 45 40 20 Z" />
      <Star color={EA.butter} size={desktop ? 34 : 20} style={{ top: "10%", left: "6%", animation: "ea-spin-slow 12s linear infinite" }} />
      <Star color={EA.white} size={desktop ? 20 : 14} style={{ top: "7%", right: "8%", animation: "ea-spin-slow 16s linear infinite reverse" }} />
      <Star color={EA.cyan} size={desktop ? 18 : 12} style={{ bottom: "20%", right: "6%", animation: "ea-float 5s ease-in-out infinite" }} />
      <Star color={EA.pink} size={desktop ? 15 : 10} style={{ top: "35%", right: "5%", animation: "ea-spin-slow 10s linear infinite" }} />
      <Star color={EA.butter} size={desktop ? 13 : 9} style={{ bottom: "8%", left: "9%", transform: "rotate(-20deg)" }} />

      {/* Centered content */}
      <div style={{
        position: "relative", zIndex: 10,
        maxWidth: desktop ? 640 : "100%",
        margin: "0 auto",
        flex: 1,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        padding: desktop ? "60px 48px" : "60px 24px",
        gap: desktop ? 40 : 28,
      }}>

        {/* Title */}
        <div style={{ textAlign: "center" }}>
          <div style={{ fontFamily: "var(--font-sans)", fontSize: desktop ? 14 : 11, fontWeight: 900, color: EA.cyan, textTransform: "uppercase", letterSpacing: 2 }}>
            MATCHMAKING
          </div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: desktop ? 52 : 28, color: EA.white, transform: "skewX(-8deg)", textShadow: `3px 3px 0 ${EA.pink}`, marginTop: 4 }}>
            ON ATTEND...
          </div>
        </div>

        {/* Players VS */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: desktop ? 40 : 12, width: "100%" }}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: desktop ? 10 : 6 }}>
            <Avatar name={myPseudo} color={EA.butter} ring={EA.cyan} size={desktop ? 96 : 72} />
            <div style={{ fontFamily: "var(--font-display)", fontSize: desktop ? 22 : 15, color: EA.white, transform: "skewX(-4deg)" }}>
              {myPseudo.toUpperCase()}
            </div>
            <div style={{ background: EA.cyan, border: `2px solid ${EA.ink}`, borderRadius: 999, padding: desktop ? "5px 16px" : "3px 10px", fontFamily: "var(--font-display)", fontSize: desktop ? 14 : 10, color: EA.ink, letterSpacing: 1, boxShadow: `2px 2px 0 ${EA.ink}` }}>
              ✓ PRÊT·E
            </div>
          </div>

          <div style={{
            width: desktop ? 72 : 50, height: desktop ? 72 : 50, borderRadius: "50%",
            background: EA.pink, border: `2.5px solid ${EA.ink}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "var(--font-display)", fontSize: desktop ? 26 : 18, color: EA.white,
            transform: "skewX(-8deg) rotate(-6deg)",
            boxShadow: `3px 3px 0 ${EA.butter}`, flexShrink: 0,
          }}>VS</div>

          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: desktop ? 10 : 6 }}>
            <div style={{
              width: desktop ? 96 : 72, height: desktop ? 96 : 72, borderRadius: "50%",
              background: "rgba(255,255,255,0.15)",
              border: `2.5px dashed ${EA.cyan}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: "var(--font-display)", fontSize: desktop ? 40 : 28, color: EA.cyan,
              animation: "ea-pulse 1.4s ease-in-out infinite",
            }}>?</div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: desktop ? 22 : 15, color: "rgba(255,255,255,0.5)", transform: "skewX(-4deg)" }}>
              {opponentPseudo.toUpperCase()}
            </div>
            <div style={{ background: "rgba(26,15,94,0.55)", border: `2px solid ${EA.ink}`, borderRadius: 999, padding: desktop ? "5px 16px" : "3px 10px", fontFamily: "var(--font-display)", fontSize: desktop ? 14 : 10, color: EA.cyan, letterSpacing: 1 }}>
              ⏳ ARRIVE
            </div>
          </div>
        </div>

        {/* Loading dots */}
        <div style={{ display: "flex", justifyContent: "center", gap: desktop ? 14 : 10 }}>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{
              width: desktop ? 18 : 14, height: desktop ? 18 : 14, borderRadius: "50%",
              background: i === 0 ? EA.cyan : i === 1 ? EA.pink : EA.butter,
              border: `2px solid ${EA.ink}`,
              animation: `ea-bounce 1.2s ease-in-out infinite ${i * 0.2}s`,
            }} />
          ))}
        </div>

        <div style={{ fontFamily: "var(--font-sans)", fontStyle: "italic", fontSize: desktop ? 18 : 14, fontWeight: 800, color: EA.white, opacity: 0.85, textAlign: "center" }}>
          {opponentPseudo} se connecte au match...
        </div>

        {/* Tip */}
        <div style={{
          width: "100%",
          background: EA.violetDeep, border: `2.5px solid ${EA.ink}`,
          borderRadius: desktop ? 22 : 18, padding: desktop ? "16px 20px" : "12px 14px",
          display: "flex", alignItems: "center", gap: desktop ? 14 : 10,
          boxShadow: `4px 4px 0 ${EA.cyan}`,
        }}>
          <div style={{ background: EA.butter, border: `2px solid ${EA.ink}`, width: desktop ? 44 : 32, height: desktop ? 44 : 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: desktop ? 22 : 16, flexShrink: 0 }}>💡</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: desktop ? 16 : 12, color: EA.cyan, letterSpacing: 1 }}>ASTUCE</div>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: desktop ? 15 : 11, fontWeight: 800, color: EA.white, opacity: 0.85, marginTop: 1 }}>{tip}</div>
          </div>
        </div>

        <button
          onClick={() => {
            startTransition(async () => {
              await cancelChallenge(challengeId);
              router.push("/lobby");
            });
          }}
          style={{
            background: "none", border: "none", cursor: "pointer",
            fontFamily: "var(--font-sans)", fontSize: desktop ? 15 : 12, fontWeight: 800,
            color: "rgba(255,255,255,0.55)", textDecoration: "underline",
          }}>
          Annuler le défi
        </button>
      </div>
    </div>
  );
}

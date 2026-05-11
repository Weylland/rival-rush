"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { EA } from "@/lib/design";
import { Avatar } from "@/components/ui/avatar";
import { SvgBlob } from "@/components/ui/blob";
import { Star } from "@/components/ui/star";
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
  const tip = TIPS[Math.floor(Math.random() * TIPS.length)];

  useEffect(() => {
    const supabase = createClient();

    // Watch for challenge acceptance → game created
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
    <div style={{ position: "relative", minHeight: "100dvh", background: EA.violet, overflow: "hidden" }}>
      <div aria-hidden style={{
        position: "absolute", inset: 0, opacity: 0.3,
        backgroundImage: "radial-gradient(circle, rgba(0,212,232,0.5) 1.4px, transparent 1.8px)",
        backgroundSize: "16px 16px",
      }} />

      <SvgBlob color={EA.pink} style={{ width: 280, height: 260, top: -100, right: -90, opacity: 0.85, animation: "ea-float 4s ease-in-out infinite" }} />
      <SvgBlob color={EA.cyan} style={{ width: 240, height: 220, bottom: -100, left: -80, opacity: 0.85, animation: "ea-float 5s ease-in-out infinite reverse" }}
        path="M 50 30 Q 90 5 140 30 Q 195 50 180 110 Q 175 175 110 175 Q 30 180 25 120 Q 10 60 50 30 Z" />

      <div style={{ position: "absolute", top: 60, left: 0, right: 0, textAlign: "center", zIndex: 10 }}>
        <div style={{ fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 900, color: EA.cyan, textTransform: "uppercase", letterSpacing: 2 }}>
          MATCHMAKING
        </div>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 28, color: EA.white, transform: "skewX(-8deg)", textShadow: `3px 3px 0 ${EA.pink}`, marginTop: 4 }}>
          ON ATTEND...
        </div>
      </div>

      <div style={{
        position: "absolute", top: 180, left: 24, right: 24,
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, zIndex: 10,
      }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
          <Avatar name={myPseudo} color={EA.butter} ring={EA.cyan} size={72} />
          <div style={{ fontFamily: "var(--font-display)", fontSize: 15, color: EA.white, transform: "skewX(-4deg)" }}>
            {myPseudo.toUpperCase()}
          </div>
          <div style={{ background: EA.cyan, border: `2px solid ${EA.ink}`, borderRadius: 999, padding: "3px 10px", fontFamily: "var(--font-display)", fontSize: 10, color: EA.ink, letterSpacing: 1, boxShadow: `2px 2px 0 ${EA.ink}` }}>
            ✓ PRÊT·E
          </div>
        </div>

        <div style={{
          width: 50, height: 50, borderRadius: "50%",
          background: EA.pink, border: `2.5px solid ${EA.ink}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: "var(--font-display)", fontSize: 18, color: EA.white,
          transform: "skewX(-8deg) rotate(-6deg)",
          boxShadow: `3px 3px 0 ${EA.butter}`, flexShrink: 0,
        }}>VS</div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
          <div style={{
            width: 72, height: 72, borderRadius: "50%",
            background: "rgba(255,255,255,0.15)",
            border: `2.5px dashed ${EA.cyan}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "var(--font-display)", fontSize: 28, color: EA.cyan,
            animation: "ea-pulse 1.4s ease-in-out infinite",
          }}>?</div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 15, color: "rgba(255,255,255,0.5)", transform: "skewX(-4deg)" }}>
            {opponentPseudo.toUpperCase()}
          </div>
          <div style={{ background: "rgba(26,15,94,0.55)", border: `2px solid ${EA.ink}`, borderRadius: 999, padding: "3px 10px", fontFamily: "var(--font-display)", fontSize: 10, color: EA.cyan, letterSpacing: 1 }}>
            ⏳ ARRIVE
          </div>
        </div>
      </div>

      {/* Loading dots */}
      <div style={{ position: "absolute", top: 360, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 10, zIndex: 10 }}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{
            width: 14, height: 14, borderRadius: "50%",
            background: i === 0 ? EA.cyan : i === 1 ? EA.pink : EA.butter,
            border: `2px solid ${EA.ink}`,
            animation: `ea-bounce 1.2s ease-in-out infinite ${i * 0.2}s`,
          }} />
        ))}
      </div>

      <div style={{ position: "absolute", top: 405, left: 0, right: 0, textAlign: "center", zIndex: 10 }}>
        <div style={{ fontFamily: "var(--font-sans)", fontStyle: "italic", fontSize: 14, fontWeight: 800, color: EA.white, opacity: 0.85 }}>
          {opponentPseudo} se connecte au match...
        </div>
      </div>

      {/* Tip */}
      <div style={{
        position: "absolute", bottom: 80, left: 24, right: 24,
        background: EA.violetDeep, border: `2.5px solid ${EA.ink}`,
        borderRadius: 18, padding: "12px 14px",
        display: "flex", alignItems: "center", gap: 10,
        boxShadow: `4px 4px 0 ${EA.cyan}`, zIndex: 10,
      }}>
        <div style={{ background: EA.butter, border: `2px solid ${EA.ink}`, width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>💡</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 12, color: EA.cyan, letterSpacing: 1 }}>ASTUCE</div>
          <div style={{ fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 800, color: EA.white, opacity: 0.85, marginTop: 1 }}>{tip}</div>
        </div>
      </div>

      <button
        onClick={() => router.push("/lobby")}
        style={{
          position: "absolute", bottom: 30, left: 0, right: 0,
          textAlign: "center", zIndex: 10,
          background: "none", border: "none", cursor: "pointer",
          fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 800,
          color: "rgba(255,255,255,0.55)", textDecoration: "underline",
        }}>
        Annuler le défi
      </button>

      <Star color={EA.butter} size={16} style={{ top: 140, left: 30, transform: "rotate(20deg)" }} />
      <Star color={EA.white} size={12} style={{ top: 100, right: 40 }} />
    </div>
  );
}

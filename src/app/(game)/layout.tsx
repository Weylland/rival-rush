"use client";

import { useEffect, useState, type ReactNode } from "react";
import { EA } from "@/lib/design";

const PHONE_W = 375;
const PHONE_H = 740;

function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div style={{
      position: "relative",
      width: PHONE_W,
      height: PHONE_H,
      borderRadius: 36,
      overflow: "hidden",
      border: "2.5px solid rgba(255,255,255,0.12)",
      boxShadow: [
        `0 0 0 8px rgba(26,15,94,0.7)`,
        `0 0 0 10px rgba(255,255,255,0.06)`,
        `0 0 80px rgba(0,212,232,0.25)`,
        `0 40px 100px rgba(0,0,0,0.6)`,
      ].join(", "),
    }}>
      {/* URL bar */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, zIndex: 200,
        height: 40,
        background: "rgba(10,6,36,0.96)",
        borderBottom: "1px solid rgba(255,255,255,0.07)",
        display: "flex", alignItems: "center", padding: "0 12px", gap: 8,
      }}>
        <svg width="10" height="12" viewBox="0 0 10 12" fill="none" aria-hidden>
          <rect x="1" y="5" width="8" height="6" rx="1.5" stroke="rgba(255,255,255,0.4)" strokeWidth="1"/>
          <path d="M3 5V3a2 2 0 014 0v2" stroke="rgba(255,255,255,0.4)" strokeWidth="1" fill="none"/>
        </svg>
        <div style={{
          flex: 1, height: 26, background: "rgba(255,255,255,0.07)",
          borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: "system-ui, sans-serif", fontSize: 11, color: "rgba(255,255,255,0.45)",
          letterSpacing: 0.3,
        }}>
          expression-arena.fr
        </div>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
          <circle cx="3" cy="8" r="1.2" fill="rgba(255,255,255,0.35)"/>
          <circle cx="8" cy="8" r="1.2" fill="rgba(255,255,255,0.35)"/>
          <circle cx="13" cy="8" r="1.2" fill="rgba(255,255,255,0.35)"/>
        </svg>
      </div>
      {/* Game content */}
      <div style={{ position: "absolute", top: 40, left: 0, right: 0, bottom: 0, overflow: "hidden" }}>
        {children}
      </div>
    </div>
  );
}

function DesktopLayout({ children }: { children: ReactNode }) {
  return (
    <div style={{
      minHeight: "100dvh",
      background: "#09051f",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Huge watermark */}
      <div aria-hidden style={{
        position: "absolute",
        fontFamily: "var(--font-display)",
        fontSize: "22vw",
        fontWeight: 900,
        color: "rgba(45,27,142,0.18)",
        letterSpacing: "-0.02em",
        transform: "rotate(-12deg) translateY(10%)",
        whiteSpace: "nowrap",
        userSelect: "none",
        pointerEvents: "none",
        lineHeight: 1,
      }}>
        EA
      </div>

      {/* Dot pattern */}
      <div aria-hidden style={{
        position: "absolute", inset: 0, opacity: 0.35,
        backgroundImage: `radial-gradient(circle, rgba(0,212,232,0.4) 1.1px, transparent 1.5px) 0 0 / 20px 20px`,
      }} />

      {/* Background blobs */}
      <svg viewBox="0 0 200 200" aria-hidden style={{ position: "absolute", width: 560, height: 480, top: -180, left: -160, opacity: 0.5, pointerEvents: "none" }} preserveAspectRatio="none">
        <path d="M 40 60 Q 30 20 80 25 Q 140 10 165 50 Q 195 90 175 140 Q 155 185 100 180 Q 40 190 25 140 Q 5 95 40 60 Z" fill={EA.pink} />
      </svg>
      <svg viewBox="0 0 200 200" aria-hidden style={{ position: "absolute", width: 480, height: 420, bottom: -160, right: -120, opacity: 0.45, pointerEvents: "none" }} preserveAspectRatio="none">
        <path d="M 50 30 Q 90 5 140 30 Q 195 50 180 110 Q 175 175 110 175 Q 30 180 25 120 Q 10 60 50 30 Z" fill={EA.cyan} />
      </svg>
      <svg viewBox="0 0 200 200" aria-hidden style={{ position: "absolute", width: 320, height: 280, bottom: -80, left: 80, opacity: 0.3, pointerEvents: "none" }} preserveAspectRatio="none">
        <path d="M 40 60 Q 30 20 80 25 Q 140 10 165 50 Q 195 90 175 140 Q 155 185 100 180 Q 40 190 25 140 Q 5 95 40 60 Z" fill={EA.butter} />
      </svg>

      {/* Stars scattered */}
      {[
        { size: 24, top: "12%", left: "8%", rot: 20, color: EA.butter },
        { size: 14, top: "28%", left: "14%", rot: -10, color: EA.white },
        { size: 18, top: "65%", left: "6%", rot: 45, color: EA.cyan },
        { size: 12, top: "80%", left: "18%", rot: 5, color: EA.pink },
        { size: 22, top: "10%", right: "10%", rot: -20, color: EA.cyan },
        { size: 16, top: "35%", right: "8%", rot: 30, color: EA.butter },
        { size: 20, top: "70%", right: "12%", rot: -5, color: EA.white },
        { size: 10, top: "88%", right: "22%", rot: 15, color: EA.pink },
      ].map((s, i) => {
        const r = s.size / 2;
        const inner = s.size / 8;
        const path = `M ${r} 0 L ${r+inner} ${r-inner} L ${s.size} ${r} L ${r+inner} ${r+inner} L ${r} ${s.size} L ${r-inner} ${r+inner} L 0 ${r} L ${r-inner} ${r-inner} Z`;
        return (
          <svg key={i} aria-hidden width={s.size} height={s.size} viewBox={`0 0 ${s.size} ${s.size}`}
            style={{ position: "absolute", top: s.top, left: (s as { left?: string }).left, right: (s as { right?: string }).right, transform: `rotate(${s.rot}deg)`, opacity: 0.7, pointerEvents: "none" }}>
            <path d={path} fill={s.color} />
          </svg>
        );
      })}

      {/* Left panel */}
      <div style={{
        display: "flex", flexDirection: "column", justifyContent: "center",
        alignItems: "flex-end", gap: 20,
        paddingRight: 48, flex: 1, maxWidth: 340,
        position: "relative", zIndex: 2,
      }}>
        <div>
          <div style={{
            fontFamily: "var(--font-sans)", fontSize: 10, fontWeight: 900,
            color: EA.cyan, textTransform: "uppercase", letterSpacing: 3,
            marginBottom: 6, textAlign: "right",
          }}>Mini-jeux en duel</div>
          <div style={{
            fontFamily: "var(--font-display)", fontSize: 52, lineHeight: 0.9,
            color: EA.white, transform: "skewX(-8deg)",
            textShadow: `4px 4px 0 ${EA.pink}`, textAlign: "right",
          }}>
            EXPRESSION<br />ARENA
          </div>
        </div>

        <div style={{
          background: EA.pink, border: `2.5px solid ${EA.ink}`,
          borderRadius: 14, padding: "10px 18px",
          transform: "skewX(-6deg) rotate(-2deg)",
          boxShadow: `4px 4px 0 ${EA.cyan}, 4px 4px 0 1px ${EA.ink}`,
        }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 15, color: EA.white, transform: "skewX(6deg)" }}>
            ✊ PFC · ✕○ MORPION
          </div>
        </div>

        <div style={{
          background: "rgba(26,15,94,0.6)", border: `2px solid rgba(0,212,232,0.3)`,
          borderRadius: 12, padding: "10px 16px", textAlign: "right",
          backdropFilter: "blur(8px)",
        }}>
          <div style={{ fontFamily: "var(--font-sans)", fontSize: 10, fontWeight: 900, color: EA.cyan, letterSpacing: 2, textTransform: "uppercase" }}>
            Fête de l&apos;Expression
          </div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 20, color: EA.butter, transform: "skewX(-4deg)", marginTop: 2 }}>
            20 JUIN 2026
          </div>
        </div>

        {/* Squiggle deco */}
        <svg width={80} height={30} viewBox="0 0 80 30" aria-hidden style={{ opacity: 0.6 }}>
          <path d="M 5 15 Q 20 5 30 15 T 55 15 T 80 15" stroke={EA.pink} strokeWidth="3" fill="none" strokeLinecap="round" />
        </svg>
      </div>

      {/* Phone frame */}
      <div style={{ position: "relative", zIndex: 10, flexShrink: 0 }}>
        <PhoneFrame>{children}</PhoneFrame>
        {/* Glow under phone */}
        <div aria-hidden style={{
          position: "absolute", bottom: -30, left: "50%", transform: "translateX(-50%)",
          width: 300, height: 40,
          background: EA.cyan,
          filter: "blur(40px)",
          opacity: 0.25,
          pointerEvents: "none",
        }} />
      </div>

      {/* Right panel */}
      <div style={{
        display: "flex", flexDirection: "column", justifyContent: "center",
        alignItems: "flex-start", gap: 20,
        paddingLeft: 48, flex: 1, maxWidth: 340,
        position: "relative", zIndex: 2,
      }}>
        {/* Score/promo chips */}
        <div style={{
          background: EA.butter, border: `2.5px solid ${EA.ink}`,
          borderRadius: 14, padding: "12px 18px",
          transform: "skewX(-6deg) rotate(2deg)",
          boxShadow: `4px 4px 0 ${EA.ink}`,
        }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 13, color: EA.ink, transform: "skewX(6deg)" }}>
            🏆 Victoire = +3 pts
          </div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 13, color: EA.ink, transform: "skewX(6deg)" }}>
            🤝 Nul = +1 pt
          </div>
        </div>

        <div style={{
          background: EA.violetDeep, border: `2.5px solid rgba(0,212,232,0.5)`,
          borderRadius: 14, padding: "12px 18px",
          boxShadow: `0 0 30px rgba(0,212,232,0.2)`,
        }}>
          <div style={{ fontFamily: "var(--font-sans)", fontSize: 9, fontWeight: 900, color: EA.cyan, letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 }}>
            Jeux disponibles
          </div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 16, color: EA.white, transform: "skewX(-4deg)" }}>
            ✊ Pierre Feuille Ciseaux
          </div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 16, color: EA.white, transform: "skewX(-4deg)" }}>
            ✕ Morpion
          </div>
        </div>

        {/* Y2K deco text */}
        <div style={{
          fontFamily: "var(--font-display)", fontSize: 11, color: "rgba(255,255,255,0.2)",
          letterSpacing: 3, textTransform: "uppercase",
          transform: "rotate(90deg) translateY(-20px)",
          whiteSpace: "nowrap",
        }}>
          PLAY · WIN · REPEAT
        </div>

        <svg width={80} height={30} viewBox="0 0 80 30" aria-hidden style={{ opacity: 0.6 }}>
          <path d="M 5 15 Q 20 5 30 15 T 55 15 T 80 15" stroke={EA.cyan} strokeWidth="3" fill="none" strokeLinecap="round" />
        </svg>
      </div>
    </div>
  );
}

export default function GameLayout({ children }: { children: ReactNode }) {
  const [desktop, setDesktop] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 960px)");
    setDesktop(mq.matches);
    const handler = (e: MediaQueryListEvent) => setDesktop(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  if (!desktop) {
    return (
      <div style={{ minHeight: "100dvh", position: "relative", overflow: "hidden" }}>
        {children}
      </div>
    );
  }

  return <DesktopLayout>{children}</DesktopLayout>;
}

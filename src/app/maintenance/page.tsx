import { EA } from "@/lib/design";

export default function MaintenancePage() {
  return (
    <div style={{
      minHeight: "100dvh",
      background: EA.violet,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px",
      position: "relative",
      overflow: "hidden",
      fontFamily: "var(--font-sans), system-ui, sans-serif",
    }}>
      {/* Dot grid */}
      <div aria-hidden style={{
        position: "absolute", inset: 0, opacity: 0.2,
        backgroundImage: "radial-gradient(circle, rgba(0,212,232,0.6) 1.4px, transparent 1.8px)",
        backgroundSize: "18px 18px",
      }} />

      {/* Blobs */}
      <div aria-hidden style={{
        position: "absolute", top: -200, right: -150,
        width: 500, height: 440, borderRadius: "60% 40% 70% 30% / 50% 60% 40% 50%",
        background: EA.cyan, opacity: 0.12, animation: "ea-float 6s ease-in-out infinite",
      }} />
      <div aria-hidden style={{
        position: "absolute", bottom: -180, left: -120,
        width: 420, height: 380, borderRadius: "40% 60% 30% 70% / 60% 40% 50% 50%",
        background: EA.pink, opacity: 0.1, animation: "ea-float 8s ease-in-out infinite reverse",
      }} />

      <div style={{
        position: "relative", zIndex: 10,
        maxWidth: 480, width: "100%",
        display: "flex", flexDirection: "column", alignItems: "center", gap: 28,
        textAlign: "center",
      }}>
        {/* Logo */}
        <div style={{
          fontFamily: "var(--font-display), system-ui, sans-serif",
          fontSize: 42, color: EA.white,
          transform: "skewX(-6deg)",
          textShadow: `4px 4px 0 ${EA.pink}`,
        }}>
          RIVAL<span style={{ color: EA.cyan }}>RUSH</span>
        </div>

        {/* Badge */}
        <div style={{
          background: EA.butter,
          border: `3px solid ${EA.ink}`,
          borderRadius: 999,
          padding: "12px 32px",
          fontFamily: "var(--font-display), system-ui, sans-serif",
          fontSize: 22,
          color: EA.ink,
          transform: "skewX(-8deg) rotate(-1.5deg)",
          boxShadow: `5px 5px 0 ${EA.ink}`,
        }}>
          🔧 MAINTENANCE
        </div>

        {/* Card */}
        <div style={{
          background: "rgba(255,255,255,0.05)",
          border: `2.5px solid rgba(255,255,255,0.12)`,
          borderRadius: 24,
          padding: "32px 28px",
          width: "100%",
          boxShadow: `0 0 40px rgba(0,212,232,0.08)`,
        }}>
          <div style={{
            fontSize: 52, marginBottom: 16, lineHeight: 1,
          }}>
            ⚔️
          </div>
          <div style={{
            fontFamily: "var(--font-display), system-ui, sans-serif",
            fontSize: 26, color: EA.white,
            transform: "skewX(-4deg)",
            marginBottom: 12,
          }}>
            On prépare l&apos;arène !
          </div>
          <div style={{
            fontSize: 15, fontWeight: 700,
            color: "rgba(255,255,255,0.6)",
            lineHeight: 1.6,
          }}>
            Le site est temporairement indisponible.<br />
            Reviens très bientôt pour t&apos;affronter.
          </div>
        </div>

        {/* Bottom */}
        <div style={{
          fontSize: 12, fontWeight: 700,
          color: "rgba(255,255,255,0.25)",
          letterSpacing: 1,
        }}>
          RIVAL-RUSH.COM
        </div>

        {/* Lien admin discret — comme WordPress */}
        <a
          href="/admin"
          style={{
            fontSize: 11, fontWeight: 600,
            color: "rgba(255,255,255,0.12)",
            textDecoration: "none",
            letterSpacing: 0.5,
          }}
        >
          ·
        </a>
      </div>

      <style>{`
        @keyframes ea-float {
          0%, 100% { transform: translateY(0); }
          50%       { transform: translateY(-18px); }
        }
      `}</style>
    </div>
  );
}

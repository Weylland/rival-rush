import Link from "next/link";
import { EA } from "@/lib/design";

export default function NotFound() {
  return (
    <div style={{
      minHeight: "100dvh",
      background: EA.violetDeep,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px",
      gap: 24,
      textAlign: "center",
    }}>
      {/* Glyph */}
      <div style={{
        fontFamily: "var(--font-righteous)",
        fontSize: "clamp(96px, 25vw, 160px)",
        lineHeight: 1,
        color: EA.pink,
        textShadow: `6px 6px 0 ${EA.cyan}`,
        transform: "skewX(-8deg)",
        userSelect: "none",
      }}>
        404
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "center" }}>
        <div style={{
          fontFamily: "var(--font-righteous)",
          fontSize: "clamp(18px, 5vw, 28px)",
          color: EA.white,
          transform: "skewX(-4deg)",
        }}>
          PAGE INTROUVABLE
        </div>
        <div style={{
          fontFamily: "var(--font-nunito)",
          fontSize: 14,
          fontWeight: 700,
          color: "rgba(255,255,255,0.45)",
          maxWidth: 300,
          lineHeight: 1.5,
        }}>
          Cette page n'existe pas ou a été supprimée.
        </div>
      </div>

      <Link
        href="/lobby"
        style={{
          fontFamily: "var(--font-righteous)",
          fontSize: 15,
          color: EA.ink,
          background: EA.cyan,
          border: `2.5px solid ${EA.ink}`,
          borderRadius: 999,
          padding: "14px 32px",
          textDecoration: "none",
          boxShadow: `4px 4px 0 ${EA.pink}`,
          transform: "skewX(-4deg)",
          display: "inline-block",
          transition: "transform 0.1s, box-shadow 0.1s",
          letterSpacing: 0.5,
        }}
      >
        <span style={{ display: "inline-block", transform: "skewX(4deg)" }}>
          ← RETOUR AU LOBBY
        </span>
      </Link>
    </div>
  );
}

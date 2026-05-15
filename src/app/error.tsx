"use client";

import { useEffect } from "react";
import { EA } from "@/lib/design";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

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
        fontSize: "clamp(80px, 20vw, 130px)",
        lineHeight: 1,
        color: EA.butter,
        textShadow: `6px 6px 0 ${EA.pink}`,
        transform: "skewX(-8deg)",
        userSelect: "none",
      }}>
        500
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "center" }}>
        <div style={{
          fontFamily: "var(--font-righteous)",
          fontSize: "clamp(16px, 5vw, 24px)",
          color: EA.white,
          transform: "skewX(-4deg)",
        }}>
          ERREUR SERVEUR
        </div>
        <div style={{
          fontFamily: "var(--font-nunito)",
          fontSize: 14,
          fontWeight: 700,
          color: "rgba(255,255,255,0.45)",
          maxWidth: 320,
          lineHeight: 1.5,
        }}>
          Quelque chose s'est mal passé de notre côté. Réessaie dans quelques secondes.
        </div>
        {error.digest && (
          <div style={{
            fontFamily: "var(--font-nunito)",
            fontSize: 11,
            fontWeight: 700,
            color: "rgba(255,255,255,0.2)",
            marginTop: 4,
          }}>
            Référence : {error.digest}
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
        <button
          onClick={reset}
          style={{
            fontFamily: "var(--font-righteous)",
            fontSize: 14,
            color: EA.ink,
            background: EA.butter,
            border: `2.5px solid ${EA.ink}`,
            borderRadius: 999,
            padding: "13px 28px",
            cursor: "pointer",
            boxShadow: `4px 4px 0 ${EA.pink}`,
            transform: "skewX(-4deg)",
            letterSpacing: 0.5,
          }}
        >
          <span style={{ display: "inline-block", transform: "skewX(4deg)" }}>
            ↺ RÉESSAYER
          </span>
        </button>

        <a
          href="/lobby"
          style={{
            fontFamily: "var(--font-righteous)",
            fontSize: 14,
            color: EA.white,
            background: "rgba(255,255,255,0.08)",
            border: `2.5px solid rgba(255,255,255,0.2)`,
            borderRadius: 999,
            padding: "13px 28px",
            textDecoration: "none",
            transform: "skewX(-4deg)",
            display: "inline-block",
            letterSpacing: 0.5,
          }}
        >
          <span style={{ display: "inline-block", transform: "skewX(4deg)" }}>
            ← LOBBY
          </span>
        </a>
      </div>
    </div>
  );
}

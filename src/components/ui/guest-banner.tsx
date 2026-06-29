"use client";

import Link from "next/link";
import { useState } from "react";
import { RR } from "@/lib/design";

export function GuestBanner() {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <div style={{
      position: "fixed",
      bottom: 16,
      left: "50%",
      transform: "translateX(-50%)",
      zIndex: 200,
      width: "calc(100% - 32px)",
      maxWidth: 480,
      background: RR.violetDeep,
      border: `2.5px solid ${RR.pink}`,
      borderRadius: 16,
      boxShadow: `4px 4px 0 ${RR.pink}`,
      padding: "14px 16px",
      display: "flex",
      alignItems: "center",
      gap: 12,
    }}>
      <span style={{ fontSize: 22, flexShrink: 0 }}>👻</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: "var(--font-sans)",
          fontSize: 13,
          fontWeight: 800,
          color: RR.white,
          lineHeight: 1.4,
        }}>
          Compte invité — temporaire
        </div>
        <div style={{
          fontFamily: "var(--font-sans)",
          fontSize: 11,
          fontWeight: 700,
          color: "rgba(255,255,255,0.5)",
          marginTop: 2,
        }}>
          Tes données seront supprimées après la soirée.
        </div>
      </div>
      <Link
        href="/settings"
        style={{
          flexShrink: 0,
          fontFamily: "var(--font-display)",
          fontSize: 12,
          color: RR.violetDeep,
          background: RR.pink,
          border: `2px solid ${RR.ink}`,
          borderRadius: 999,
          padding: "8px 14px",
          textDecoration: "none",
          textTransform: "uppercase",
          boxShadow: `2px 2px 0 ${RR.ink}`,
          transform: "skewX(-4deg)",
          display: "inline-block",
          whiteSpace: "nowrap",
        }}
      >
        <span style={{ display: "inline-block", transform: "skewX(4deg)" }}>
          Créer un compte →
        </span>
      </Link>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Fermer"
        style={{
          flexShrink: 0,
          background: "none",
          border: "none",
          color: "rgba(255,255,255,0.35)",
          cursor: "pointer",
          fontSize: 16,
          padding: 4,
          lineHeight: 1,
        }}
      >
        ✕
      </button>
    </div>
  );
}

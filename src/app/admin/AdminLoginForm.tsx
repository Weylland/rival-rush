"use client";

import { useActionState } from "react";
import { adminLogin } from "./actions";
import { EA } from "@/lib/design";

export function AdminLoginForm() {
  const [error, action, pending] = useActionState<string | null, FormData>(adminLogin, null);

  return (
    <div style={{ position: "relative", minHeight: "100dvh", background: EA.violet, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div aria-hidden style={{
        position: "absolute", inset: 0, opacity: 0.25,
        backgroundImage: "radial-gradient(circle, rgba(0,212,232,0.5) 1.4px, transparent 1.8px)",
        backgroundSize: "16px 16px",
      }} />

      <div style={{
        position: "relative", zIndex: 10,
        width: "100%", maxWidth: 360,
        margin: "0 auto", padding: "0 24px",
        boxSizing: "border-box",
      }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 900, color: EA.pink, textTransform: "uppercase", letterSpacing: 2 }}>
            ACCÈS RESTREINT
          </div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 36, color: EA.white, transform: "skewX(-8deg)", textShadow: `3px 3px 0 ${EA.pink}`, marginTop: 4 }}>
            ADMIN
          </div>
        </div>

        <form action={action} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{
            background: EA.white,
            border: `2.5px solid ${EA.ink}`,
            borderRadius: 16,
            boxShadow: `4px 4px 0 ${EA.pink}`,
          }}>
            <input
              name="secret"
              type="password"
              placeholder="Mot de passe admin"
              required
              autoFocus
              style={{
                display: "block", width: "100%",
                padding: "14px 16px",
                background: "transparent", border: "none", outline: "none",
                fontFamily: "var(--font-sans)", fontSize: 16, fontWeight: 800,
                color: EA.ink, boxSizing: "border-box",
              }}
            />
          </div>

          {error && (
            <div style={{
              background: "rgba(255,30,140,0.15)", border: `2px solid ${EA.pink}`,
              borderRadius: 12, padding: "10px 14px",
              fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 800,
              color: EA.white, textAlign: "center",
            }}>{error}</div>
          )}

          <button
            type="submit"
            disabled={pending}
            style={{
              fontFamily: "var(--font-display)", fontSize: 18,
              color: EA.ink, background: EA.butter,
              border: `2.5px solid ${EA.ink}`, borderRadius: 999,
              padding: "14px 0", textTransform: "uppercase", letterSpacing: 0.8,
              cursor: pending ? "wait" : "pointer",
              boxShadow: `4px 4px 0 ${EA.pink}, 4px 4px 0 1px ${EA.ink}`,
              transform: "skewX(-4deg)",
              opacity: pending ? 0.7 : 1,
            }}>
            <span style={{ display: "inline-block", transform: "skewX(4deg)" }}>
              {pending ? "..." : "🔑 Entrer"}
            </span>
          </button>
        </form>
      </div>
    </div>
  );
}

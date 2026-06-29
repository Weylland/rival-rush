"use client";

import { useActionState } from "react";
import { RR } from "@/lib/design";
import { signinToAdmin, type AuthState } from "./actions";

export function AdminLoginPage() {
  const [state, action, pending] = useActionState<AuthState, FormData>(signinToAdmin, null);

  return (
    <div style={{
      minHeight: "100dvh",
      background: "#060114",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
      fontFamily: "var(--font-sans), system-ui, sans-serif",
    }}>
      {/* Dot grid */}
      <div aria-hidden style={{
        position: "fixed", inset: 0, opacity: 0.1,
        backgroundImage: "radial-gradient(circle, rgba(0,212,232,0.5) 1px, transparent 1.4px)",
        backgroundSize: "22px 22px",
        pointerEvents: "none",
      }} />

      <div style={{
        position: "relative", zIndex: 10,
        width: "100%", maxWidth: 380,
        display: "flex", flexDirection: "column", gap: 28,
      }}>
        {/* Header */}
        <div style={{ textAlign: "center" }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16, margin: "0 auto 16px",
            background: `linear-gradient(135deg, ${RR.cyan} 0%, ${RR.pink} 100%)`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 24,
            boxShadow: `0 8px 32px rgba(255,30,140,0.4)`,
          }}>◆</div>
          <div style={{
            fontFamily: "var(--font-display)",
            fontSize: 22, color: RR.white,
            transform: "skewX(-4deg)",
            letterSpacing: 0.5,
          }}>ADMIN PANEL</div>
          <div style={{
            fontFamily: "var(--font-sans)",
            fontSize: 12, fontWeight: 700,
            color: "rgba(255,255,255,0.4)",
            marginTop: 4,
            letterSpacing: 1.5,
            textTransform: "uppercase",
          }}>Accès restreint</div>
        </div>

        {/* Form */}
        <form action={action} style={{
          background: "rgba(255,255,255,0.03)",
          border: `1.5px solid rgba(255,255,255,0.08)`,
          borderRadius: 20,
          padding: "28px 24px",
          display: "flex", flexDirection: "column", gap: 16,
          boxShadow: `0 0 40px rgba(0,212,232,0.06)`,
        }}>
          <div>
            <label style={{
              display: "block",
              fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 800,
              color: RR.cyan, textTransform: "uppercase", letterSpacing: 1.5,
              marginBottom: 8,
            }}>Email</label>
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="admin@exemple.com"
              style={{
                display: "block", width: "100%", boxSizing: "border-box",
                padding: "11px 14px",
                background: "rgba(255,255,255,0.06)",
                border: `1.5px solid rgba(255,255,255,0.12)`,
                borderRadius: 12, outline: "none",
                fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 700,
                color: RR.white,
                transition: "border-color .15s",
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = RR.cyan; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)"; }}
            />
          </div>

          <div>
            <label style={{
              display: "block",
              fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 800,
              color: RR.cyan, textTransform: "uppercase", letterSpacing: 1.5,
              marginBottom: 8,
            }}>Mot de passe</label>
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
              placeholder="••••••••"
              style={{
                display: "block", width: "100%", boxSizing: "border-box",
                padding: "11px 14px",
                background: "rgba(255,255,255,0.06)",
                border: `1.5px solid rgba(255,255,255,0.12)`,
                borderRadius: 12, outline: "none",
                fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 700,
                color: RR.white,
                transition: "border-color .15s",
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = RR.cyan; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)"; }}
            />
          </div>

          {state?.error && (
            <div style={{
              background: "rgba(255,30,140,0.12)",
              border: `1.5px solid rgba(255,30,140,0.35)`,
              borderRadius: 10, padding: "10px 14px",
              fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 700,
              color: RR.pink, textAlign: "center",
            }}>
              {state.error}
            </div>
          )}

          <button
            type="submit"
            disabled={pending}
            style={{
              padding: "13px 0",
              background: pending ? "rgba(0,212,232,0.3)" : RR.cyan,
              border: "none", borderRadius: 12,
              fontFamily: "var(--font-display)", fontSize: 14,
              color: RR.ink, fontWeight: 900, letterSpacing: 0.5,
              cursor: pending ? "not-allowed" : "pointer",
              transition: "opacity .15s",
              opacity: pending ? 0.7 : 1,
            }}
          >
            {pending ? "Connexion…" : "🔑 Connexion admin"}
          </button>
        </form>
      </div>
    </div>
  );
}

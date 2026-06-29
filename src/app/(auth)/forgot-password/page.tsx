"use client";

import { useActionState } from "react";
import Link from "next/link";
import { requestPasswordReset } from "./actions";
import { RR } from "@/lib/design";
import { RRButton } from "@/components/ui/rr-button";

export default function ForgotPasswordPage() {
  const [state, action, pending] = useActionState(requestPasswordReset, null);

  return (
    <div style={{ position: "relative", minHeight: "100dvh", background: RR.violet, overflow: "hidden" }}>
      <div aria-hidden style={{
        position: "absolute", inset: 0, opacity: 0.35,
        backgroundImage: "radial-gradient(circle, rgba(0,212,232,0.5) 1.4px, transparent 1.8px)",
        backgroundSize: "16px 16px",
      }} />

      <div style={{
        position: "relative", zIndex: 10,
        width: "100%", maxWidth: 420,
        margin: "0 auto", padding: "60px 20px 24px",
        boxSizing: "border-box",
        display: "flex", flexDirection: "column", gap: 20,
      }}>
        <div style={{ textAlign: "center" }}>
          <div style={{
            fontFamily: "var(--font-display)", fontSize: 36,
            color: RR.white, transform: "skewX(-8deg)",
            textShadow: `3px 3px 0 ${RR.pink}`,
          }}>
            MOT DE PASSE
          </div>
          <div style={{
            fontFamily: "var(--font-display)", fontSize: 36,
            color: RR.cyan, transform: "skewX(-8deg)",
            textShadow: `3px 3px 0 ${RR.violetDeep}`,
            marginTop: -4,
          }}>
            OUBLIÉ ?
          </div>
          <div style={{
            fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 700,
            color: "rgba(255,255,255,0.55)", marginTop: 10, lineHeight: 1.5,
          }}>
            Entre ton email et on t'envoie un lien pour réinitialiser ton mot de passe.
          </div>
        </div>

        {state?.success ? (
          <div style={{
            background: "rgba(30,226,154,0.15)", border: `2px solid #1ee29a`,
            borderRadius: 16, padding: "20px",
            textAlign: "center",
          }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>📬</div>
            <div style={{
              fontFamily: "var(--font-display)", fontSize: 18, color: RR.white, marginBottom: 6,
            }}>
              Email envoyé !
            </div>
            <div style={{
              fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 700,
              color: "rgba(255,255,255,0.6)", lineHeight: 1.5,
            }}>
              Si un compte existe avec cet email, tu recevras un lien dans quelques instants. Vérifie tes spams.
            </div>
          </div>
        ) : (
          <form action={action} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <div style={{
                fontFamily: "var(--font-display)", fontSize: 12, letterSpacing: 1.4,
                color: RR.cyan, textTransform: "uppercase", marginBottom: 6, marginLeft: 14,
              }}>Email</div>
              <div style={{
                background: RR.white, border: `2.5px solid ${RR.ink}`,
                borderRadius: 16, boxShadow: `4px 4px 0 ${RR.cyan}`,
              }}>
                <input
                  name="email"
                  type="email"
                  placeholder="toi@exemple.com"
                  required
                  autoFocus
                  style={{
                    display: "block", width: "100%",
                    padding: "12px 16px", background: "transparent",
                    border: "none", outline: "none",
                    fontFamily: "var(--font-sans)", fontSize: 16,
                    fontWeight: 800, color: RR.ink, boxSizing: "border-box",
                  }}
                />
              </div>
            </div>

            {state?.error && (
              <div style={{
                background: "rgba(255,30,140,0.15)", border: `2px solid ${RR.pink}`,
                borderRadius: 12, padding: "10px 14px",
                fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 800,
                color: RR.white, textAlign: "center",
              }}>
                {state.error}
              </div>
            )}

            <RRButton
              type="submit"
              full
              size="lg"
              color={RR.pink}
              shadow={RR.cyan}
              disabled={pending}
              style={{ opacity: pending ? 0.7 : 1 }}
            >
              {pending ? "Envoi…" : "📨 Envoyer le lien"}
            </RRButton>
          </form>
        )}

        <div style={{ textAlign: "center" }}>
          <Link href="/login" style={{
            fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 800,
            color: RR.cyan, textDecoration: "underline", textUnderlineOffset: 3,
          }}>
            ← Retour à la connexion
          </Link>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { RR } from "@/lib/design";
import { RRButton } from "@/components/ui/rr-button";
import { PasswordInput } from "@/components/ui/password-input";

// RRButton used for the submit button below

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [ready, setReady] = useState(false);
  const [exchangeError, setExchangeError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, setPending] = useState(false);

  // Exchange the PKCE code for a session when the page loads
  useEffect(() => {
    const code = searchParams.get("code");
    if (!code) {
      setExchangeError("Lien invalide ou expiré. Demande un nouveau lien.");
      return;
    }
    const supabase = createClient();
    supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
      if (error) {
        setExchangeError("Lien invalide ou expiré. Demande un nouveau lien.");
      } else {
        setReady(true);
      }
    });
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const password = (form.elements.namedItem("password") as HTMLInputElement).value;
    const confirm = (form.elements.namedItem("confirm") as HTMLInputElement).value;

    if (password.length < 6) {
      setSubmitError("Le mot de passe doit faire au moins 6 caractères.");
      return;
    }
    if (password !== confirm) {
      setSubmitError("Les mots de passe ne correspondent pas.");
      return;
    }

    setPending(true);
    setSubmitError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setSubmitError(error.message);
      setPending(false);
    } else {
      setSuccess(true);
      setTimeout(() => router.push("/lobby"), 2000);
    }
  }

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
          }}>NOUVEAU</div>
          <div style={{
            fontFamily: "var(--font-display)", fontSize: 36,
            color: RR.cyan, transform: "skewX(-8deg)",
            textShadow: `3px 3px 0 ${RR.violetDeep}`,
            marginTop: -4,
          }}>MOT DE PASSE</div>
        </div>

        {success && (
          <div style={{
            background: "rgba(30,226,154,0.15)", border: `2px solid #1ee29a`,
            borderRadius: 16, padding: "20px", textAlign: "center",
          }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>✅</div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 18, color: RR.white }}>
              Mot de passe modifié !
            </div>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.55)", marginTop: 6 }}>
              Redirection en cours…
            </div>
          </div>
        )}

        {!success && exchangeError && (
          <div style={{
            background: "rgba(255,30,140,0.15)", border: `2px solid ${RR.pink}`,
            borderRadius: 16, padding: "20px", textAlign: "center",
            display: "flex", flexDirection: "column", gap: 14,
          }}>
            <div style={{ fontSize: 32 }}>⚠️</div>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 800, color: RR.white }}>
              {exchangeError}
            </div>
            <a
              href="/forgot-password"
              style={{
                display: "inline-block",
                fontFamily: "var(--font-display)", fontSize: 16, letterSpacing: 0.6,
                color: RR.white, background: RR.pink,
                border: `2px solid ${RR.ink}`, borderRadius: 999,
                padding: "14px 24px", textDecoration: "none",
                textAlign: "center",
                boxShadow: `4px 4px 0 ${RR.cyan}, 4px 4px 0 1px ${RR.ink}`,
                transform: "skewX(-4deg)", textTransform: "uppercase",
              }}
            >
              <span style={{ display: "inline-block", transform: "skewX(4deg)" }}>
                Demander un nouveau lien
              </span>
            </a>
          </div>
        )}

        {!success && !exchangeError && !ready && (
          <div style={{ textAlign: "center", fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.45)" }}>
            Vérification du lien…
          </div>
        )}

        {!success && ready && (
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <div style={{
                fontFamily: "var(--font-display)", fontSize: 12, letterSpacing: 1.4,
                color: RR.cyan, textTransform: "uppercase", marginBottom: 6, marginLeft: 14,
              }}>Nouveau mot de passe</div>
              <PasswordInput
                name="password"
                placeholder="Au moins 6 caractères"
                required
                autoFocus
                wrapperStyle={{
                  background: RR.white, border: `2.5px solid ${RR.ink}`,
                  borderRadius: 16, boxShadow: `4px 4px 0 ${RR.cyan}`,
                }}
                style={{
                  display: "block", width: "100%",
                  padding: "12px 16px", background: "transparent",
                  border: "none", outline: "none",
                  fontFamily: "var(--font-sans)", fontSize: 16,
                  fontWeight: 800, color: RR.ink, boxSizing: "border-box",
                }}
              />
            </div>

            <div>
              <div style={{
                fontFamily: "var(--font-display)", fontSize: 12, letterSpacing: 1.4,
                color: RR.cyan, textTransform: "uppercase", marginBottom: 6, marginLeft: 14,
              }}>Confirmer le mot de passe</div>
              <PasswordInput
                name="confirm"
                placeholder="Répète le mot de passe"
                required
                wrapperStyle={{
                  background: RR.white, border: `2.5px solid ${RR.ink}`,
                  borderRadius: 16, boxShadow: `4px 4px 0 ${RR.pink}`,
                }}
                style={{
                  display: "block", width: "100%",
                  padding: "12px 16px", background: "transparent",
                  border: "none", outline: "none",
                  fontFamily: "var(--font-sans)", fontSize: 16,
                  fontWeight: 800, color: RR.ink, boxSizing: "border-box",
                }}
              />
            </div>

            {submitError && (
              <div style={{
                background: "rgba(255,30,140,0.15)", border: `2px solid ${RR.pink}`,
                borderRadius: 12, padding: "10px 14px",
                fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 800,
                color: RR.white, textAlign: "center",
              }}>
                {submitError}
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
              {pending ? "Sauvegarde…" : "🔐 Enregistrer le mot de passe"}
            </RRButton>
          </form>
        )}
      </div>
    </div>
  );
}

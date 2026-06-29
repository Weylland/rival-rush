"use client";

import { useActionState, useState } from "react";
import { signup, signin, signinAsGuest, type AuthState } from "./actions";
import { RRButton } from "@/components/ui/rr-button";
import { PasswordInput } from "@/components/ui/password-input";
import { RR } from "@/lib/design";

function TabSwitch({ active, onSwitch }: { active: "signup" | "signin"; onSwitch: (t: "signup" | "signin") => void }) {
  return (
    <div style={{
      display: "flex", gap: 6,
      background: "rgba(26,15,94,0.65)",
      border: `2.5px solid ${RR.ink}`,
      borderRadius: 999,
      padding: 5,
      boxShadow: `3px 3px 0 ${RR.cyan}`,
      width: "100%",
    }}>
      {(["signup", "signin"] as const).map((tab) => {
        const isActive = active === tab;
        return (
          <button
            key={tab}
            type="button"
            onClick={() => onSwitch(tab)}
            style={{
              flex: isActive ? 1.4 : 1,
              textAlign: "center",
              background: isActive ? RR.pink : "transparent",
              border: "none",
              borderRadius: 999,
              padding: "11px 0",
              fontFamily: "var(--font-display)",
              fontSize: isActive ? 16 : 13,
              color: isActive ? RR.white : "rgba(255,255,255,0.6)",
              letterSpacing: 1,
              boxShadow: isActive ? `2px 2px 0 ${RR.cyan}` : "none",
              transform: isActive ? "skewX(-4deg)" : "none",
              cursor: "pointer",
              transition: "all 0.15s",
            }}
          >
            {tab === "signup" ? "✨ INSCRIPTION" : "CONNEXION"}
          </button>
        );
      })}
    </div>
  );
}

function FieldY2K({
  label,
  name,
  placeholder,
  type = "text",
  hint,
}: {
  label: string;
  name: string;
  placeholder: string;
  type?: string;
  hint?: string;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ width: "100%" }}>
      <div style={{
        fontFamily: "var(--font-display)",
        fontSize: 12, letterSpacing: 1.4,
        color: RR.cyan,
        textTransform: "uppercase",
        marginBottom: 6,
        marginLeft: 14,
        display: "flex", justifyContent: "space-between",
        paddingRight: 14,
      }}>
        <span>{label}</span>
        {hint && <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 10 }}>{hint}</span>}
      </div>
      <div style={{
        background: RR.white,
        border: `2.5px solid ${RR.ink}`,
        borderRadius: 16,
        boxShadow: focused ? `4px 4px 0 ${RR.pink}` : `4px 4px 0 ${RR.cyan}`,
        transition: "box-shadow 0.15s",
      }}>
        <input
          name={name}
          type={type}
          placeholder={placeholder}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          required
          style={{
            display: "block",
            width: "100%",
            padding: "12px 16px",
            background: "transparent",
            border: "none",
            outline: "none",
            fontFamily: "var(--font-sans)",
            fontSize: 16,
            fontWeight: 800,
            color: RR.ink,
          }}
        />
      </div>
    </div>
  );
}

function LogoMark({ size = 72 }: { size?: number }) {
  const r = size / 2;
  const inner = size / 8;
  const starPath = (s: number) => {
    const sr = s / 2;
    const si = s / 8;
    return `M ${sr} 0 L ${sr + si} ${sr - si} L ${s} ${sr} L ${sr + si} ${sr + si} L ${sr} ${s} L ${sr - si} ${sr + si} L 0 ${sr} L ${sr - si} ${sr - si} Z`;
  };
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ position: "absolute" }} aria-hidden>
        <path d={starPath(size)} fill={RR.cyan} />
        <path
          d={starPath(size * 0.7)}
          fill={RR.pink}
          transform={`translate(${size * 0.15}, ${size * 0.15}) rotate(22, ${size * 0.35}, ${size * 0.35})`}
        />
      </svg>
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "var(--font-display)",
        fontSize: size * 0.35,
        color: RR.ink,
        transform: "skewX(-8deg)",
        textShadow: `2px 2px 0 ${RR.white}`,
      }}>RR</div>
    </div>
  );
}

export function LoginForm({ qrSvg, appUrl }: { qrSvg: string | null; appUrl: string | null }) {
  const [tab, setTab] = useState<"signup" | "signin">("signup");
  const [signupState, signupAction, signupPending] = useActionState<AuthState, FormData>(signup, null);
  const [signinState, signinAction, signinPending] = useActionState<AuthState, FormData>(signin, null);
  const [guestState, guestAction, guestPending]   = useActionState<AuthState, FormData>(signinAsGuest, null);

  const state = tab === "signup" ? signupState : signinState;
  const action = tab === "signup" ? signupAction : signinAction;
  const pending = tab === "signup" ? signupPending : signinPending;

  return (
    <div style={{ position: "relative", minHeight: "100dvh", overflow: "hidden" }}>
      {/* Fond violet + dots */}
      <div style={{ position: "absolute", inset: 0, background: RR.violet }} />
      <div aria-hidden style={{
        position: "absolute", inset: 0, opacity: 0.35,
        backgroundImage: "radial-gradient(circle, rgba(0,212,232,0.5) 1.4px, transparent 1.8px)",
        backgroundSize: "16px 16px",
      }} />

      {/* Blobs */}
      <svg viewBox="0 0 200 200" style={{ position: "absolute", width: 260, height: 240, top: -90, right: -90, opacity: 0.95 }} preserveAspectRatio="none" aria-hidden>
        <path d="M 40 60 Q 30 20 80 25 Q 140 10 165 50 Q 195 90 175 140 Q 155 185 100 180 Q 40 190 25 140 Q 5 95 40 60 Z" fill={RR.pink} />
      </svg>
      <svg viewBox="0 0 200 200" style={{ position: "absolute", width: 200, height: 200, bottom: -80, left: -60, opacity: 0.85 }} preserveAspectRatio="none" aria-hidden>
        <path d="M 50 30 Q 90 5 140 30 Q 195 50 180 110 Q 175 175 110 175 Q 30 180 25 120 Q 10 60 50 30 Z" fill={RR.cyan} />
      </svg>

      {/* Décos */}
      <svg width="70" height="26" viewBox="0 0 60 60" style={{ position: "absolute", top: 130, left: 24 }} aria-hidden>
        <path d="M 5 30 Q 15 10 25 30 T 45 30 T 60 30" stroke={RR.butter} strokeWidth="3" fill="none" strokeLinecap="round" />
      </svg>

      {/* Logo + titre */}
      <div style={{
        position: "relative", zIndex: 10,
        padding: "24px 24px 0",
        display: "flex", flexDirection: "column",
        alignItems: "center", gap: 4,
        width: "100%", maxWidth: 480,
        margin: "0 auto", boxSizing: "border-box",
      }}>
        <LogoMark size={72} />
        <div style={{
          fontFamily: "var(--font-display)",
          fontSize: 32, lineHeight: 0.9, textAlign: "center",
          color: RR.white, transform: "skewX(-8deg)",
          textShadow: `3px 3px 0 ${RR.pink}`,
          marginTop: 8,
        }}>RIVAL</div>
        <div style={{
          fontFamily: "var(--font-display)",
          fontSize: 32, lineHeight: 0.9,
          color: RR.cyan, transform: "skewX(-8deg)",
          textShadow: `3px 3px 0 ${RR.violetDeep}`,
          marginTop: -2,
        }}>RUSH</div>
        <div style={{
          fontFamily: "var(--font-sans)",
          fontSize: 11, fontWeight: 800, fontStyle: "italic",
          color: RR.white, opacity: 0.85,
          marginTop: 4,
          background: RR.violetDeep,
          padding: "3px 10px",
          borderRadius: 20,
          transform: "rotate(-2deg)",
        }}>✦ Mini-jeux en duel ✦</div>
      </div>

      {/* Form */}
      <div style={{
        position: "relative", zIndex: 10,
        width: "100%", maxWidth: 440,
        margin: "20px auto 0",
        padding: "0 20px",
        boxSizing: "border-box",
        display: "flex", flexDirection: "column", gap: 14,
      }}>
        <TabSwitch active={tab} onSwitch={setTab} />

        <form action={action} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {tab === "signup" && (
            <FieldY2K
              label="Choisis ton pseudo"
              name="pseudo"
              placeholder="DJ Nadia..."
              hint="visible au lobby"
            />
          )}
          <FieldY2K
            label="Email"
            name="email"
            placeholder="toi@exemple.com"
            type="email"
          />
          <div style={{ width: "100%" }}>
            <div style={{
              fontFamily: "var(--font-display)",
              fontSize: 12, letterSpacing: 1.4,
              color: RR.cyan, textTransform: "uppercase",
              marginBottom: 6, marginLeft: 14,
            }}>Mot de passe</div>
            <PasswordInput
              name="password"
              placeholder="Top secret"
              required
              wrapperStyle={{
                background: RR.white,
                border: `2.5px solid ${RR.ink}`,
                borderRadius: 16,
                boxShadow: `4px 4px 0 ${RR.cyan}`,
              }}
              style={{
                display: "block",
                width: "100%",
                padding: "12px 16px",
                background: "transparent",
                border: "none",
                outline: "none",
                fontFamily: "var(--font-sans)",
                fontSize: 16,
                fontWeight: 800,
                color: RR.ink,
                boxSizing: "border-box",
              }}
            />
          </div>

          {state?.error && (
            <div style={{
              background: "rgba(255,30,140,0.15)",
              border: `2px solid ${RR.pink}`,
              borderRadius: 12,
              padding: "10px 14px",
              fontFamily: "var(--font-sans)",
              fontSize: 13, fontWeight: 800,
              color: RR.white,
              textAlign: "center",
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
            style={{ marginTop: 6, opacity: pending ? 0.7 : 1 }}
          >
            {pending
              ? "..."
              : tab === "signup"
              ? "🎉 Créer mon compte"
              : "🎮 Se connecter"}
          </RRButton>

          {tab === "signup" && (
            <p style={{
              fontFamily: "var(--font-sans)",
              fontSize: 11, fontWeight: 700,
              color: "rgba(255,255,255,0.4)",
              textAlign: "center",
              margin: 0,
              lineHeight: 1.5,
            }}>
              En créant un compte, tu acceptes nos{" "}
              <a href="/legal/cgu" style={{ color: "rgba(255,255,255,0.6)", textDecoration: "underline" }}>CGU</a>
              {" "}et notre{" "}
              <a href="/legal/privacy" style={{ color: "rgba(255,255,255,0.6)", textDecoration: "underline" }}>politique de confidentialité</a>.
            </p>
          )}
        </form>

        {/* Mode invité */}
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          margin: "4px 0",
        }}>
          <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.12)" }} />
          <span style={{ fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.35)" }}>
            ou sans créer de compte
          </span>
          <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.12)" }} />
        </div>
        <form action={guestAction} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ position: "relative" }}>
            <input
              name="pseudo"
              type="text"
              placeholder="Ton pseudo (optionnel)"
              maxLength={20}
              style={{
                display: "block", width: "100%", boxSizing: "border-box",
                padding: "11px 16px",
                background: "rgba(255,255,255,0.07)",
                border: `2px solid rgba(255,255,255,0.18)`,
                borderRadius: 14, outline: "none",
                fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 700,
                color: RR.white,
              }}
            />
            <span style={{
              position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)",
              fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 800,
              color: "rgba(255,255,255,0.25)", pointerEvents: "none",
            }}>#????</span>
          </div>
          <RRButton
            type="submit"
            full
            size="md"
            color={RR.violet}
            shadow={RR.cyan}
            disabled={guestPending}
            style={{ opacity: guestPending ? 0.7 : 1 }}
          >
            {guestPending ? "..." : "👻 Jouer en invité (sans compte)"}
          </RRButton>
          {guestState?.error && (
            <div style={{
              fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 700,
              color: RR.pink, textAlign: "center",
            }}>
              {guestState.error}
            </div>
          )}
        </form>

        <div style={{
          textAlign: "center",
          fontFamily: "var(--font-sans)",
          fontSize: 12, fontWeight: 700,
          color: "rgba(255,255,255,0.7)",
        }}>
          {tab === "signup" ? (
            <>Déjà inscrit·e ?{" "}
              <button type="button" onClick={() => setTab("signin")} style={{
                background: "none", border: "none", cursor: "pointer",
                color: RR.cyan, textDecoration: "underline", fontWeight: 900,
                fontFamily: "var(--font-sans)", fontSize: 12,
              }}>Connecte-toi</button>
            </>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "center" }}>
              <span>Pas encore de compte ?{" "}
                <button type="button" onClick={() => setTab("signup")} style={{
                  background: "none", border: "none", cursor: "pointer",
                  color: RR.cyan, textDecoration: "underline", fontWeight: 900,
                  fontFamily: "var(--font-sans)", fontSize: 12,
                }}>Inscris-toi</button>
              </span>
              <a href="/forgot-password" style={{
                color: "rgba(255,255,255,0.45)", fontSize: 12, fontWeight: 700,
                textDecoration: "underline", textUnderlineOffset: 3,
              }}>
                Mot de passe oublié ?
              </a>
            </div>
          )}
        </div>

        <div style={{ marginTop: 20, textAlign: "center" }}>
          <a
            href="/contact"
            style={{
              fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 800,
              color: "rgba(255,255,255,0.35)", textDecoration: "underline",
              textUnderlineOffset: 3, letterSpacing: 0.5,
            }}
          >
            Un problème ? Contacte-moi →
          </a>
        </div>

        {qrSvg && (
          <div style={{
            marginTop: 28,
            display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
            background: "rgba(26,15,94,0.55)", border: `2px dashed ${RR.cyan}`,
            borderRadius: 20, padding: "16px 20px",
          }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 11, color: RR.cyan, letterSpacing: 1.6, textTransform: "uppercase" }}>
              📱 Rejoins depuis ton téléphone
            </div>
            <div
              style={{ width: 120, height: 120, borderRadius: 12, overflow: "hidden" }}
              dangerouslySetInnerHTML={{ __html: qrSvg }}
            />
            {appUrl && (
              <div style={{ fontFamily: "var(--font-sans)", fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.5)" }}>
                {appUrl}
              </div>
            )}
          </div>
        )}

        <div style={{ height: 24 }} />
      </div>
    </div>
  );
}

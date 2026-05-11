"use client";

import { useActionState, useState } from "react";
import { signup, signin, type AuthState } from "./actions";
import { EAButton } from "@/components/ui/ea-button";
import { EA } from "@/lib/design";

function TabSwitch({ active, onSwitch }: { active: "signup" | "signin"; onSwitch: (t: "signup" | "signin") => void }) {
  return (
    <div style={{
      display: "flex", gap: 6,
      background: "rgba(26,15,94,0.65)",
      border: `2.5px solid ${EA.ink}`,
      borderRadius: 999,
      padding: 5,
      boxShadow: `3px 3px 0 ${EA.cyan}`,
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
              background: isActive ? EA.pink : "transparent",
              border: "none",
              borderRadius: 999,
              padding: "11px 0",
              fontFamily: "var(--font-display)",
              fontSize: isActive ? 16 : 13,
              color: isActive ? EA.white : "rgba(255,255,255,0.6)",
              letterSpacing: 1,
              boxShadow: isActive ? `2px 2px 0 ${EA.cyan}` : "none",
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
        color: EA.cyan,
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
        background: EA.white,
        border: `2.5px solid ${EA.ink}`,
        borderRadius: 16,
        boxShadow: focused ? `4px 4px 0 ${EA.pink}` : `4px 4px 0 ${EA.cyan}`,
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
            color: EA.ink,
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
        <path d={starPath(size)} fill={EA.cyan} />
        <path
          d={starPath(size * 0.7)}
          fill={EA.pink}
          transform={`translate(${size * 0.15}, ${size * 0.15}) rotate(22, ${size * 0.35}, ${size * 0.35})`}
        />
      </svg>
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "var(--font-display)",
        fontSize: size * 0.35,
        color: EA.ink,
        transform: "skewX(-8deg)",
        textShadow: `2px 2px 0 ${EA.white}`,
      }}>EA</div>
    </div>
  );
}

export function LoginForm({ qrSvg, appUrl }: { qrSvg: string | null; appUrl: string | null }) {
  const [tab, setTab] = useState<"signup" | "signin">("signup");
  const [signupState, signupAction, signupPending] = useActionState<AuthState, FormData>(signup, null);
  const [signinState, signinAction, signinPending] = useActionState<AuthState, FormData>(signin, null);

  const state = tab === "signup" ? signupState : signinState;
  const action = tab === "signup" ? signupAction : signinAction;
  const pending = tab === "signup" ? signupPending : signinPending;

  return (
    <div style={{ position: "relative", minHeight: "100dvh", overflow: "hidden" }}>
      {/* Fond violet + dots */}
      <div style={{ position: "absolute", inset: 0, background: EA.violet }} />
      <div aria-hidden style={{
        position: "absolute", inset: 0, opacity: 0.35,
        backgroundImage: "radial-gradient(circle, rgba(0,212,232,0.5) 1.4px, transparent 1.8px)",
        backgroundSize: "16px 16px",
      }} />

      {/* Blobs */}
      <svg viewBox="0 0 200 200" style={{ position: "absolute", width: 260, height: 240, top: -90, right: -90, opacity: 0.95 }} preserveAspectRatio="none" aria-hidden>
        <path d="M 40 60 Q 30 20 80 25 Q 140 10 165 50 Q 195 90 175 140 Q 155 185 100 180 Q 40 190 25 140 Q 5 95 40 60 Z" fill={EA.pink} />
      </svg>
      <svg viewBox="0 0 200 200" style={{ position: "absolute", width: 200, height: 200, bottom: -80, left: -60, opacity: 0.85 }} preserveAspectRatio="none" aria-hidden>
        <path d="M 50 30 Q 90 5 140 30 Q 195 50 180 110 Q 175 175 110 175 Q 30 180 25 120 Q 10 60 50 30 Z" fill={EA.cyan} />
      </svg>

      {/* Décos */}
      <svg width="70" height="26" viewBox="0 0 60 60" style={{ position: "absolute", top: 130, left: 24 }} aria-hidden>
        <path d="M 5 30 Q 15 10 25 30 T 45 30 T 60 30" stroke={EA.butter} strokeWidth="3" fill="none" strokeLinecap="round" />
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
          color: EA.white, transform: "skewX(-8deg)",
          textShadow: `3px 3px 0 ${EA.pink}`,
          marginTop: 8,
        }}>EXPRESSION</div>
        <div style={{
          fontFamily: "var(--font-display)",
          fontSize: 32, lineHeight: 0.9,
          color: EA.cyan, transform: "skewX(-8deg)",
          textShadow: `3px 3px 0 ${EA.violetDeep}`,
          marginTop: -2,
        }}>ARENA</div>
        <div style={{
          fontFamily: "var(--font-sans)",
          fontSize: 11, fontWeight: 800, fontStyle: "italic",
          color: EA.white, opacity: 0.85,
          marginTop: 4,
          background: EA.violetDeep,
          padding: "3px 10px",
          borderRadius: 20,
          transform: "rotate(-2deg)",
        }}>✦ Fête de l'Expression · 20 juin ✦</div>
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
          <FieldY2K
            label="Choisis ton pseudo"
            name="pseudo"
            placeholder="DJ Nadia..."
            hint="visible au lobby"
          />
          <FieldY2K
            label="Mot de passe"
            name="password"
            placeholder="Top secret"
            type="password"
          />

          {state?.error && (
            <div style={{
              background: "rgba(255,30,140,0.15)",
              border: `2px solid ${EA.pink}`,
              borderRadius: 12,
              padding: "10px 14px",
              fontFamily: "var(--font-sans)",
              fontSize: 13, fontWeight: 800,
              color: EA.white,
              textAlign: "center",
            }}>
              {state.error}
            </div>
          )}

          <EAButton
            type="submit"
            full
            size="lg"
            color={EA.pink}
            shadow={EA.cyan}
            disabled={pending}
            style={{ marginTop: 6, opacity: pending ? 0.7 : 1 }}
          >
            {pending
              ? "..."
              : tab === "signup"
              ? "🎉 Créer mon compte"
              : "🎮 Se connecter"}
          </EAButton>
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
                color: EA.cyan, textDecoration: "underline", fontWeight: 900,
                fontFamily: "var(--font-sans)", fontSize: 12,
              }}>Connecte-toi</button>
            </>
          ) : (
            <>Pas encore de compte ?{" "}
              <button type="button" onClick={() => setTab("signup")} style={{
                background: "none", border: "none", cursor: "pointer",
                color: EA.cyan, textDecoration: "underline", fontWeight: 900,
                fontFamily: "var(--font-sans)", fontSize: 12,
              }}>Inscris-toi</button>
            </>
          )}
        </div>

        {qrSvg && (
          <div style={{
            marginTop: 28,
            display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
            background: "rgba(26,15,94,0.55)", border: `2px dashed ${EA.cyan}`,
            borderRadius: 20, padding: "16px 20px",
          }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 11, color: EA.cyan, letterSpacing: 1.6, textTransform: "uppercase" }}>
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
      </div>
    </div>
  );
}

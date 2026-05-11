"use client";

import { useActionState, useState } from "react";
import { sendContact } from "./actions";
import { EA } from "@/lib/design";
import type { ContactState } from "./actions";

function FocusInput({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{ fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 900, color: EA.cyan, textTransform: "uppercase", letterSpacing: 1.5 }}>
        {label}
      </label>
      <input
        {...props}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          fontFamily: "var(--font-sans)", fontSize: 15, fontWeight: 700,
          color: EA.white, background: "rgba(255,255,255,0.06)",
          border: `2px solid ${focused ? EA.cyan : EA.ink}`,
          borderRadius: 12, padding: "13px 16px", outline: "none",
          width: "100%", boxSizing: "border-box", transition: "border-color .15s",
        }}
      />
    </div>
  );
}

function FocusTextarea({ label, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{ fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 900, color: EA.cyan, textTransform: "uppercase", letterSpacing: 1.5 }}>
        {label}
      </label>
      <textarea
        {...props}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          fontFamily: "var(--font-sans)", fontSize: 15, fontWeight: 700,
          color: EA.white, background: "rgba(255,255,255,0.06)",
          border: `2px solid ${focused ? EA.cyan : EA.ink}`,
          borderRadius: 12, padding: "13px 16px", outline: "none",
          width: "100%", boxSizing: "border-box", transition: "border-color .15s",
          resize: "vertical", minHeight: 140,
        }}
      />
    </div>
  );
}

export function ContactForm() {
  const [state, action, pending] = useActionState<ContactState, FormData>(sendContact, null);

  if (state?.success) {
    return (
      <div style={{
        background: "rgba(0,212,232,0.1)", border: `2.5px solid ${EA.cyan}`,
        borderRadius: 20, padding: "40px 24px", textAlign: "center",
        boxShadow: `4px 4px 0 ${EA.cyan}`,
      }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 24, color: EA.white, transform: "skewX(-4deg)" }}>
          Message envoyé !
        </div>
        <div style={{ fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.55)", marginTop: 10 }}>
          Je te répondrai à ton adresse email dès que possible.
        </div>
      </div>
    );
  }

  return (
    <form action={action} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Honeypot — invisible pour les humains */}
      <input name="website" type="text" tabIndex={-1} aria-hidden style={{ display: "none" }} />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <FocusInput label="Nom *" name="name" placeholder="Ton prénom" required maxLength={60} />
        <FocusInput label="Email *" name="email" type="email" placeholder="toi@exemple.com" required />
      </div>

      <FocusInput label="Sujet" name="subject" placeholder="À quel sujet ?" maxLength={100} />

      <FocusTextarea label="Message *" name="message" placeholder="Ton message..." required minLength={10} maxLength={2000} />

      {state?.error && (
        <div style={{
          padding: "12px 16px", borderRadius: 10,
          background: "rgba(255,30,140,0.15)", border: `2px solid ${EA.pink}`,
          fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 800, color: EA.white,
        }}>
          {state.error}
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        style={{
          fontFamily: "var(--font-display)", fontSize: 16,
          color: EA.violetDeep, background: pending ? "rgba(255,255,255,0.2)" : EA.cyan,
          border: `2px solid ${EA.ink}`, borderRadius: 999,
          padding: "15px 32px", cursor: pending ? "wait" : "pointer",
          boxShadow: pending ? "none" : `4px 4px 0 ${EA.ink}`,
          transform: "skewX(-4deg)", textTransform: "uppercase",
          transition: "all .1s", opacity: pending ? 0.6 : 1,
          alignSelf: "flex-start",
        }}
      >
        <span style={{ display: "inline-block", transform: "skewX(4deg)" }}>
          {pending ? "Envoi en cours..." : "Envoyer →"}
        </span>
      </button>
    </form>
  );
}

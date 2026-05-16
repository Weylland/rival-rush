"use client";

import { useState } from "react";

interface Props extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Style de fond appliqué au wrapper. Facultatif, utile pour LoginForm */
  wrapperStyle?: React.CSSProperties;
}

/**
 * Champ mot de passe avec bouton œil pour afficher/masquer.
 * Accepte tous les attributs HTML d'un <input>.
 */
export function PasswordInput({ wrapperStyle, style, ...rest }: Props) {
  const [show, setShow] = useState(false);

  return (
    <div style={{ position: "relative", ...wrapperStyle }}>
      <input
        {...rest}
        type={show ? "text" : "password"}
        style={{
          paddingRight: 44,
          ...style,
        }}
      />
      <button
        type="button"
        aria-label={show ? "Masquer le mot de passe" : "Afficher le mot de passe"}
        onClick={() => setShow((v) => !v)}
        style={{
          position: "absolute",
          right: 12,
          top: "50%",
          transform: "translateY(-50%)",
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: 4,
          color: show ? "inherit" : "rgba(128,128,128,0.7)",
          opacity: show ? 1 : 0.6,
          transition: "opacity .15s",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          lineHeight: 1,
        }}
        tabIndex={-1}
      >
        {show ? (
          /* œil barré */
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
            <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
            <line x1="1" y1="1" x2="23" y2="23" />
          </svg>
        ) : (
          /* œil ouvert */
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )}
      </button>
    </div>
  );
}

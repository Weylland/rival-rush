"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { EA } from "@/lib/design";

interface Props {
  /** Actif seulement pendant la partie — désactiver quand isFinished */
  enabled: boolean;
}

export function PreventLeave({ enabled }: Props) {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (!enabled) return;

    // Bloque refresh / fermeture d'onglet
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };

    // Bloque le bouton retour : on repousse un état dans l'historique,
    // puis on intercepte le popstate pour afficher notre modal
    history.pushState(null, "", window.location.href);
    const handlePopState = () => {
      history.pushState(null, "", window.location.href);
      setShowModal(true);
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("popstate", handlePopState);
    };
  }, [enabled]);

  if (!showModal) return null;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "rgba(10,8,30,0.85)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 24,
    }}>
      <div style={{
        background: EA.violetDeep,
        border: `3px solid ${EA.ink}`,
        borderRadius: 24,
        padding: "28px 24px",
        maxWidth: 320, width: "100%",
        boxShadow: `6px 6px 0 ${EA.pink}, 6px 6px 0 1px ${EA.ink}`,
        position: "relative",
      }}>
        {/* Dot bg */}
        <div aria-hidden style={{
          position: "absolute", inset: 4, borderRadius: 20,
          backgroundImage: "radial-gradient(circle, rgba(0,212,232,0.3) 1px, transparent 1.4px)",
          backgroundSize: "12px 12px", pointerEvents: "none",
        }} />

        <div style={{ position: "relative", zIndex: 2, textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🚪</div>
          <div style={{
            fontFamily: "var(--font-display)", fontSize: 24, color: EA.white,
            transform: "skewX(-6deg)", textShadow: `3px 3px 0 ${EA.pink}`,
            marginBottom: 8,
          }}>
            QUITTER ?
          </div>
          <div style={{
            fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 700,
            color: "rgba(255,255,255,0.6)", lineHeight: 1.5, marginBottom: 24,
          }}>
            Si tu quittes maintenant,<br />la partie sera comptée comme un abandon.
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <button
              onClick={() => setShowModal(false)}
              style={{
                fontFamily: "var(--font-display)", fontSize: 16,
                color: EA.violetDeep, background: EA.cyan,
                border: `2.5px solid ${EA.ink}`, borderRadius: 999,
                padding: "13px 0", cursor: "pointer",
                boxShadow: `3px 3px 0 ${EA.ink}`,
                transform: "skewX(-4deg)", textTransform: "uppercase",
                width: "100%",
              }}
            >
              <span style={{ display: "inline-block", transform: "skewX(4deg)" }}>
                ⚔ Continuer la partie
              </span>
            </button>

            <button
              onClick={() => router.push("/lobby")}
              style={{
                fontFamily: "var(--font-display)", fontSize: 14,
                color: "rgba(255,255,255,0.5)", background: "none",
                border: `2px solid rgba(255,255,255,0.2)`, borderRadius: 999,
                padding: "11px 0", cursor: "pointer",
                width: "100%", textTransform: "uppercase",
              }}
            >
              <span>Abandonner</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

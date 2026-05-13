"use client";

import { useEffect, useState } from "react";
import { subscribePush } from "@/lib/push-client";
import { EA } from "@/lib/design";

const PROMPTED_KEY = "ea_notif_prompted";

export function NotifPrompt() {
  const [visible, setVisible] = useState(false);
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    if (typeof Notification === "undefined") return;
    if (Notification.permission !== "default") return;
    if (localStorage.getItem(PROMPTED_KEY)) return;

    // Petit délai pour laisser la page se charger
    const t = setTimeout(() => setVisible(true), 1500);
    return () => clearTimeout(t);
  }, []);

  async function handleActivate() {
    setRequesting(true);
    const result = await Notification.requestPermission();
    localStorage.setItem(PROMPTED_KEY, "true");
    if (result === "granted") {
      await subscribePush();
    } else {
      localStorage.setItem("ea_notif_enabled", "false");
    }
    setVisible(false);
  }

  function handleLater() {
    localStorage.setItem(PROMPTED_KEY, "true");
    localStorage.setItem("ea_notif_enabled", "false");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div style={{
      position: "fixed", inset: 0,
      background: "rgba(26,15,94,0.7)",
      zIndex: 100,
      display: "flex", alignItems: "flex-start", justifyContent: "center",
    }}>
      {/* Label haut */}
      <div style={{
        position: "absolute", top: 30, left: "50%", transform: "translateX(-50%) rotate(-1.5deg)",
        background: EA.cyan, border: `2.5px solid ${EA.ink}`,
        borderRadius: 16, padding: "8px 18px",
        fontFamily: "var(--font-display)", fontSize: 12, color: EA.ink, letterSpacing: 1.4,
        boxShadow: `4px 4px 0 ${EA.butter}`,
        whiteSpace: "nowrap",
      }}>
        🔔 NOTIFICATIONS
      </div>

      {/* Card */}
      <div style={{
        position: "absolute", left: "50%", top: 100, transform: "translateX(-50%)",
        width: "min(420px, calc(100% - 32px))",
        background: EA.cyan, border: `3px solid ${EA.ink}`,
        borderRadius: 28, padding: "24px 18px 20px",
        boxShadow: `6px 6px 0 ${EA.pink}, 6px 6px 0 1px ${EA.ink}`,
      }}>
        {/* Dot pattern */}
        <div aria-hidden style={{
          position: "absolute", inset: 4, borderRadius: 24,
          backgroundImage: "radial-gradient(circle, rgba(26,15,94,0.25) 1px, transparent 1.4px)",
          backgroundSize: "12px 12px", pointerEvents: "none",
        }} />

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, position: "relative", zIndex: 2 }}>
          {/* Icône */}
          <div style={{ position: "relative", marginBottom: 4 }}>
            <div style={{
              position: "absolute", inset: -8, borderRadius: "50%",
              border: `3px dashed ${EA.butter}`,
              animation: "ea-spin 8s linear infinite",
            }} />
            <div style={{
              width: 84, height: 84, borderRadius: "50%",
              background: EA.violetDeep, border: `3px solid ${EA.ink}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 40,
              boxShadow: `4px 4px 0 ${EA.butter}`,
            }}>🔔</div>
          </div>

          <div style={{
            fontFamily: "var(--font-display)", fontSize: 26,
            color: EA.ink, transform: "skewX(-8deg)",
            textShadow: `2px 2px 0 ${EA.white}`,
            textAlign: "center",
          }}>
            RESTE DANS LA PARTIE !
          </div>

          {/* Explication */}
          <div style={{
            background: EA.violetDeep, border: `2.5px solid ${EA.ink}`,
            borderRadius: 16, padding: "12px 16px",
            boxShadow: `3px 3px 0 ${EA.butter}`,
            transform: "rotate(-0.5deg)",
            width: "100%",
          }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                { icon: "📬", text: "Reçois un défi même si tu as fermé l'appli" },
                { icon: "⚡", text: "Réponds avant que le temps ne s'écoule" },
                { icon: "🔕", text: "Tu peux les désactiver à tout moment dans les réglages" },
              ].map(({ icon, text }) => (
                <div key={text} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <span style={{ fontSize: 16, flexShrink: 0 }}>{icon}</span>
                  <span style={{ fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.8)", lineHeight: 1.5 }}>
                    {text}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Boutons */}
          <div style={{ display: "flex", gap: 10, marginTop: 8, width: "100%" }}>
            <button
              onClick={handleLater}
              disabled={requesting}
              style={{
                flex: 1, fontFamily: "var(--font-display)", fontSize: 14,
                color: EA.white, background: EA.violetDeep,
                border: `2.5px solid ${EA.ink}`, borderRadius: 999,
                padding: "12px 0", textTransform: "uppercase", letterSpacing: 0.8,
                cursor: "pointer", boxShadow: `3px 3px 0 ${EA.ink}`,
              }}>
              Plus tard
            </button>
            <button
              onClick={handleActivate}
              disabled={requesting}
              style={{
                flex: 1.4, fontFamily: "var(--font-display)", fontSize: 16,
                color: EA.ink, background: EA.butter,
                border: `2.5px solid ${EA.ink}`, borderRadius: 999,
                padding: "12px 0", textTransform: "uppercase", letterSpacing: 0.8,
                cursor: requesting ? "wait" : "pointer",
                boxShadow: `4px 4px 0 ${EA.pink}, 4px 4px 0 1px ${EA.ink}`,
                transform: "skewX(-4deg)",
                opacity: requesting ? 0.7 : 1,
              }}>
              <span style={{ display: "inline-block", transform: "skewX(4deg)" }}>
                {requesting ? "..." : "🔔 Activer !"}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { EA } from "@/lib/design";
import type { GameType } from "@/types/database";

const RULES: Record<GameType, { title: string; icon: string; items: { icon: string; text: string }[] }> = {
  pfc: {
    title: "Pierre Feuille Ciseaux",
    icon: "✊✋✌",
    items: [
      { icon: "🤝", text: "Choix simultanés : Pierre, Feuille ou Ciseaux" },
      { icon: "⚔", text: "Pierre > Ciseaux · Ciseaux > Feuille · Feuille > Pierre" },
      { icon: "🔄", text: "Choix identiques = manche nulle, on rejoue" },
      { icon: "🏆", text: "Premier à 2 victoires de manche gagne (max 3 manches)" },
    ],
  },
  morpion: {
    title: "Morpion",
    icon: "⨯⭕⨯",
    items: [
      { icon: "📐", text: "Grille 3×3 — le challenger joue × en premier" },
      { icon: "🔄", text: "Tour par tour : clique sur une case vide" },
      { icon: "🏆", text: "Aligner 3 symboles (horizontal, vertical ou diagonal) pour gagner" },
      { icon: "🤝", text: "Grille pleine sans alignement = match nul" },
    ],
  },
  puissance4: {
    title: "Puissance 4",
    icon: "🔴🟡🔴",
    items: [
      { icon: "📐", text: "Grille 7×6 — le challenger joue en premier" },
      { icon: "⬇", text: "Tour par tour : clique sur une colonne, le jeton tombe en bas" },
      { icon: "🏆", text: "Aligner 4 jetons (horizontal, vertical ou diagonal) pour gagner" },
      { icon: "🤝", text: "Grille pleine sans alignement = match nul" },
    ],
  },
};

export function RulesButton({ gameType }: { gameType: GameType }) {
  const [open, setOpen] = useState(false);
  const rules = RULES[gameType];

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Règles du jeu"
        style={{
          position: "fixed", bottom: 16, right: 16, zIndex: 100,
          height: 36, borderRadius: 999,
          background: EA.violetDeep, border: `2.5px solid ${EA.cyan}`,
          color: EA.cyan, cursor: "pointer",
          display: "flex", alignItems: "center", gap: 6, padding: "0 12px",
          fontFamily: "var(--font-display)", fontSize: 13,
          boxShadow: `3px 3px 0 ${EA.cyan}`,
          letterSpacing: 0.5,
        }}
      >
        <span style={{ fontFamily: "var(--font-display)", fontSize: 15, lineHeight: 1 }}>?</span>
        Règles
      </button>

      {open && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(26,15,94,0.75)", zIndex: 60, display: "flex", alignItems: "flex-end", justifyContent: "center", padding: "0 12px 20px" }}
          onClick={() => setOpen(false)}
        >
          <div
            style={{
              width: "100%", maxWidth: 440,
              background: EA.violetDeep, border: `2.5px solid ${EA.ink}`,
              borderRadius: 24, padding: "20px 18px",
              boxShadow: `5px 5px 0 ${EA.cyan}, 5px 5px 0 1px ${EA.ink}`,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 24, lineHeight: 1 }}>{rules.icon}</span>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 18, color: EA.white, transform: "skewX(-4deg)" }}>
                  {rules.title.toUpperCase()}
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", fontSize: 22, cursor: "pointer", lineHeight: 1, padding: 4 }}
              >×</button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {rules.items.map(({ icon, text }, i) => (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <span style={{ fontSize: 14, flexShrink: 0, marginTop: 2 }}>{icon}</span>
                  <span style={{ fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.8)", lineHeight: 1.5 }}>{text}</span>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 16, display: "flex", gap: 8, justifyContent: "flex-end", borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 14 }}>
              <div style={{ fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.3)" }}>
                Victoire +3pts · Nul +1pt
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

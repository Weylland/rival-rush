"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { EA } from "@/lib/design";
import type { GameType } from "@/types/database";

const RULES: Record<GameType, { title: string; icon: string; items: { icon: string; text: string }[] }> = {
  naval: {
    title: "Bataille Navale",
    icon: "🚢⚓🎯",
    items: [
      { icon: "🎲", text: "Bateaux placés aléatoirement : Porte-avions (5), Croiseur (4), 2×Destroyer/Sous-marin (3), Torpilleur (2)" },
      { icon: "🎯", text: "Tour par tour : clique sur la grille ennemie pour tirer" },
      { icon: "🔥", text: "Touché = rejoue pas, c'est l'adversaire qui joue ensuite" },
      { icon: "💥", text: "Coulé = tout le navire est révélé" },
      { icon: "🏆", text: "Coule toute la flotte ennemie (17 cases) pour gagner" },
    ],
  },
  reflexe: {
    title: "Tap de réflexe",
    icon: "⚡⚡⚡",
    items: [
      { icon: "⚡", text: "Un joueur arme la manche en appuyant sur ARMER" },
      { icon: "👀", text: "Délai aléatoire 2-5s, puis le signal s'affiche" },
      { icon: "🖐", text: "Tapez le plus vite possible dès le signal !" },
      { icon: "⚠", text: "Taper avant le signal = faux départ, manche rejouée" },
      { icon: "🏆", text: "Premier à 2 manches gagne le match" },
    ],
  },
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
  chess: {
    title: "Échecs",
    icon: "♟♔♛",
    items: [
      { icon: "⬜", text: "Blancs (le challenger) jouent en premier — tour par tour" },
      { icon: "♟", text: "Clique ta pièce pour voir ses coups légaux, puis clique la destination" },
      { icon: "⚠", text: "Tu ne peux pas te mettre en échec — si plus aucun coup légal : mat ou pat" },
      { icon: "👑", text: "Pion promu à la dernière rangée : choisis Dame, Tour, Fou ou Cavalier" },
      { icon: "🏰", text: "Roque et prise en passant supportés — pat = match nul" },
      { icon: "⏱", text: "Cadences : ⚡ Bullet 1 min · 🔥 Blitz 3 min · ♟ Rapide 10 min · ∞ Illimité" },
      { icon: "💀", text: "Temps écoulé = défaite — les deux horloges sont visibles sur le plateau" },
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
  mastermind: {
    title: "Mastermind 🎨",
    icon: "🎨🔴🟡",
    items: [
      { icon: "🎨", text: "Le serveur génère un code secret de 4 couleurs (répétitions possibles)" },
      { icon: "🔄", text: "Tour par tour : propose une combinaison de 4 couleurs" },
      { icon: "⚫", text: "Peg noir = bonne couleur à la bonne place" },
      { icon: "⚪", text: "Peg blanc = bonne couleur mais mauvaise place" },
      { icon: "🏆", text: "Premier à trouver le code (4 noirs) gagne · 12 essais max puis nul" },
    ],
  },
  pig: {
    title: "Jeu du Cochon 🐷",
    icon: "🎲🐷🎲",
    items: [
      { icon: "🎲", text: "Chacun son tour : lance le dé autant de fois que tu veux" },
      { icon: "💀", text: "Tu fais 1 → tu perds tous tes points de ce tour et c'est au suivant" },
      { icon: "🏦", text: "Tu peux \"Banquer\" à tout moment pour sécuriser tes points du tour" },
      { icon: "🏆", text: "Premier à atteindre 100 points gagne la partie" },
    ],
  },
  "plus-ou-moins": {
    title: "Plus ou Moins 🔢",
    icon: "🔢🎯🔥",
    items: [
      { icon: "🔢", text: "Un nombre mystère entre 1 et 100 est tiré au sort" },
      { icon: "🔄", text: "Tour par tour : propose un nombre dans la zone valide" },
      { icon: "↑", text: "PLUS → ton nombre est trop bas, monte" },
      { icon: "↓", text: "MOINS → ton nombre est trop haut, descend" },
      { icon: "🌡️", text: "Le thermomètre montre si tu brûles ou si tu gèles !" },
      { icon: "🏆", text: "Premier à trouver le nombre gagne la manche — meilleur des 3 manches" },
    ],
  },
  "duel-des": {
    title: "Duel de Dés 🎲",
    icon: "🎲🎲🎲",
    items: [
      { icon: "🎲", text: "Chaque manche : les deux joueurs lancent leur dé simultanément" },
      { icon: "🏆", text: "Le plus haut l'emporte — égalité ? Personne ne marque, on passe à la suivante" },
      { icon: "👁️", text: "Tu vois si l'adversaire a lancé, mais pas sa valeur — suspens garanti !" },
      { icon: "🥇", text: "Premier à remporter 3 manches gagne le match" },
    ],
  },
  nim: {
    title: "Nim 🔥",
    icon: "🔥🔥🔥",
    items: [
      { icon: "🎲", text: "Tas aléatoire de 15 à 25 allumettes — impossible de connaître l'avantage à l'avance" },
      { icon: "✋", text: "Chacun son tour : prends 1, 2 ou 3 allumettes" },
      { icon: "💀", text: "Règle misère : celui qui prend la DERNIÈRE allumette PERD" },
      { icon: "🧠", text: "La stratégie parfaite existe mais le tas aléatoire et la règle misère la rendent imprévisible" },
    ],
  },
};

export function RulesButton({ gameType }: { gameType: GameType }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const rules = RULES[gameType];

  useEffect(() => { setMounted(true); }, []);

  if (!mounted) return null;

  return createPortal(
    <>
      <button
        onClick={() => setOpen(true)}
        title="Règles du jeu"
        style={{
          position: "fixed", bottom: 16, right: 16, zIndex: 200,
          width: 36, height: 36, borderRadius: "50%",
          background: EA.violetDeep, border: `2.5px solid ${EA.cyan}`,
          color: EA.cyan, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: "var(--font-display)", fontSize: 16,
          boxShadow: `3px 3px 0 ${EA.cyan}`,
        }}
      >?</button>

      {open && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(26,15,94,0.75)", zIndex: 201, display: "flex", alignItems: "flex-end", justifyContent: "center", padding: "0 12px 20px" }}
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

            <div style={{ marginTop: 16, borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 14 }}>
              <div style={{ fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.3)" }}>
                Victoire +3pts · Nul +1pt
              </div>
            </div>
          </div>
        </div>
      )}
    </>,
    document.body,
  );
}

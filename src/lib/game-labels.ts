import type { GameType } from "@/types/database";

export const GAME_LABELS: Record<GameType, string> & Record<string, string> = {
  pfc:            "Pierre Feuille Ciseaux",
  morpion:        "Morpion",
  puissance4:     "Puissance 4",
  reflexe:        "Réflexe ⚡",
  naval:          "Bataille Navale",
  chess:          "Échecs ♟",
  nim:            "Nim 🔥",
  pig:            "Jeu du Cochon 🐷",
  mastermind:     "Mastermind 🎨",
  "plus-ou-moins": "Plus ou Moins 🔢",
  "duel-des":     "Duel de Dés 🎲",
};

export const ALL_GAME_TYPES = Object.keys(GAME_LABELS) as GameType[];

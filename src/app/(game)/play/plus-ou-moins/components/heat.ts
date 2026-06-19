import { EA } from "@/lib/design";

/** Échelle "chaud/froid" selon la distance au nombre secret. */
export function getHeat(distance: number): { color: string; glow: string; label: string; emoji: string } {
  if (distance > 30) return { color: "#4A90D9", glow: "rgba(74,144,217,0.5)", label: "GLACIAL", emoji: "❄️" };
  if (distance > 15) return { color: EA.cyan, glow: "rgba(0,212,232,0.4)", label: "FROID", emoji: "🌡️" };
  if (distance > 7) return { color: EA.butter, glow: "rgba(255,233,74,0.4)", label: "TIÈDE", emoji: "☀️" };
  if (distance > 3) return { color: "#FF8C00", glow: "rgba(255,140,0,0.5)", label: "CHAUD !", emoji: "🔥" };
  return { color: EA.pink, glow: "rgba(255,30,140,0.6)", label: "BRÛLANT !!", emoji: "🌋" };
}

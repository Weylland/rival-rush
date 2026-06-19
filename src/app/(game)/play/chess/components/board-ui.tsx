import type { PieceType } from "@/lib/chess";

// ── Piece rendering ───────────────────────────────────────────────────────────

export const UNICODE: Record<string, string> = {
  wK: "♔", wQ: "♕", wR: "♖", wB: "♗", wN: "♘", wP: "♙",
  bK: "♚", bQ: "♛", bR: "♜", bB: "♝", bN: "♞", bP: "♟",
};

export const PROMO_PIECES: PieceType[] = ["Q", "R", "B", "N"];
export const PROMO_LABELS: Record<PieceType, string> = { Q: "♕ Dame", R: "♖ Tour", B: "♗ Fou", N: "♘ Cavalier", K: "", P: "" };

export const TIME_LABEL: Record<number, string> = { 60: "⚡ Bullet", 180: "🔥 Blitz", 600: "♟ Rapide" };

export function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export function Clock({ seconds, active }: { seconds: number | null; active: boolean }) {
  if (seconds === null) return null;
  const low = seconds < 30;
  const danger = seconds < 10;
  return (
    <div style={{
      fontFamily: "var(--font-display)",
      fontSize: 20,
      minWidth: 58,
      textAlign: "right",
      color: danger ? "#ff1e8c" : low ? "#ffe94a" : "rgba(255,255,255,0.9)",
      animation: danger && active ? "ea-pulse 0.5s ease-in-out infinite alternate" : "none",
      flexShrink: 0,
    }}>
      {formatTime(seconds)}
    </div>
  );
}

// Light square: warm tan — Dark square: mid-purple (more contrast than before)
export const SQ_LIGHT = "#e8d5b0";
export const SQ_DARK = "#7c56c8";

export function squareColor(idx: number): string {
  return ((Math.floor(idx / 8) + (idx % 8)) % 2 === 0) ? SQ_LIGHT : SQ_DARK;
}

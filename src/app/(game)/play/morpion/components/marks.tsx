import { EA } from "@/lib/design";

export function CellX({ size = "70%" }: { size?: string }) {
  return (
    <svg viewBox="0 0 60 60" style={{ width: size, height: size }}>
      <path d="M 12 12 L 48 48 M 48 12 L 12 48" stroke={EA.pink} strokeWidth="9" strokeLinecap="round" fill="none" />
    </svg>
  );
}

export function CellO({ size = "70%" }: { size?: string }) {
  return (
    <svg viewBox="0 0 60 60" style={{ width: size, height: size }}>
      <circle cx="30" cy="30" r="18" stroke={EA.cyan} strokeWidth="9" fill="none" />
    </svg>
  );
}

/** Marque d'une case selon le joueur qui l'occupe (p1 = ×, p2 = ○). */
export function CellMark({ cellValue, p1Id, size }: { cellValue: string | null; p1Id: string; size?: string }) {
  if (!cellValue) return null;
  return cellValue === p1Id ? <CellX size={size} /> : <CellO size={size} />;
}

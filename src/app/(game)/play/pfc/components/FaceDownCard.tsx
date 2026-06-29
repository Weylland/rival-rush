import { RR } from "@/lib/design";

export function FaceDownCard({ chose, height = 96 }: { chose: boolean; height?: number }) {
  return (
    <div style={{
      height,
      background: chose
        ? `repeating-linear-gradient(45deg, ${RR.pink} 0 12px, ${RR.violetDeep} 12px 24px)`
        : `repeating-linear-gradient(45deg, rgba(255,30,140,0.3) 0 12px, ${RR.violetDeep} 12px 24px)`,
      border: `2.5px solid ${RR.ink}`,
      borderRadius: 18,
      display: "flex", alignItems: "center", justifyContent: "center",
      boxShadow: `inset 0 0 0 4px ${RR.violet}`,
    }}>
      <div style={{
        background: chose ? RR.cyan : "rgba(255,255,255,0.15)",
        border: `2px solid ${RR.ink}`,
        borderRadius: 999, padding: "6px 14px",
        fontFamily: "var(--font-display)", fontSize: 14,
        color: chose ? RR.ink : "rgba(255,255,255,0.5)",
        transform: "skewX(-4deg) rotate(-3deg)",
        boxShadow: chose ? `2px 2px 0 ${RR.ink}` : "none",
      }}>
        {chose ? "✓ A CHOISI" : "?? CACHÉ ??"}
      </div>
    </div>
  );
}

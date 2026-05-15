import { EA } from "@/lib/design";

// Generic neutral fallback — specific routes have their own loading.tsx
export default function GameLoading() {
  return (
    <div style={{
      minHeight: "100dvh",
      background: EA.violet,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }}>
      <svg width={48} height={48} viewBox="0 0 48 48" aria-label="Chargement…" role="status">
        <circle cx={24} cy={24} r={20} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={4} />
        <circle
          cx={24} cy={24} r={20} fill="none"
          stroke={EA.cyan} strokeWidth={4} strokeLinecap="round"
          strokeDasharray="80 45"
          style={{ transformOrigin: "center", animation: "ea-spin 0.9s linear infinite" }}
        />
        <style>{`@keyframes ea-spin { to { transform: rotate(360deg); } }`}</style>
      </svg>
    </div>
  );
}

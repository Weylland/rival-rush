import { RR } from "@/lib/design";

export default function RootLoading() {
  return (
    <div style={{
      minHeight: "100dvh",
      background: RR.violetDeep,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }}>
      <Spinner />
    </div>
  );
}

function Spinner() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
      <svg width={48} height={48} viewBox="0 0 48 48" aria-label="Chargement…" role="status">
        <circle
          cx={24} cy={24} r={20}
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth={4}
        />
        <circle
          cx={24} cy={24} r={20}
          fill="none"
          stroke={RR.cyan}
          strokeWidth={4}
          strokeLinecap="round"
          strokeDasharray="80 45"
          style={{ transformOrigin: "center", animation: "rr-spin 0.9s linear infinite" }}
        />
        <style>{`@keyframes rr-spin { to { transform: rotate(360deg); } }`}</style>
      </svg>
      <div style={{
        fontFamily: "var(--font-righteous)",
        fontSize: 13,
        color: "rgba(255,255,255,0.35)",
        letterSpacing: 2,
        textTransform: "uppercase",
      }}>
        Chargement…
      </div>
    </div>
  );
}

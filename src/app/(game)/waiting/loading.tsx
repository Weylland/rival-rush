import { RR } from "@/lib/design";

function Bone({ w = "100%", h = 20, radius = 8 }: { w?: string | number; h?: number; radius?: number }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: radius,
      background: "rgba(255,255,255,0.07)",
      animation: "rr-pulse 1.4s ease-in-out infinite",
    }} />
  );
}

export default function WaitingLoading() {
  return (
    <div style={{
      minHeight: "100dvh",
      background: RR.violet,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 32,
      padding: "24px 20px",
    }}>
      <style>{`@keyframes rr-pulse { 0%,100%{opacity:.45} 50%{opacity:1} }`}</style>

      {/* Title */}
      <Bone w={200} h={28} radius={10} />

      {/* VS card */}
      <div style={{
        width: "100%", maxWidth: 400,
        background: "rgba(255,255,255,0.04)",
        border: "2.5px solid rgba(255,255,255,0.08)",
        borderRadius: 28, padding: "28px 24px",
        display: "flex", alignItems: "center", gap: 20,
      }}>
        {/* Player 1 */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
          <Bone w={64} h={64} radius={32} />
          <Bone w="70%" h={16} radius={6} />
        </div>

        {/* VS */}
        <div style={{
          width: 48, height: 48, borderRadius: "50%",
          background: "rgba(255,255,255,0.06)",
          border: "2px solid rgba(255,255,255,0.1)",
          flexShrink: 0,
        }} />

        {/* Player 2 */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
          <Bone w={64} h={64} radius={32} />
          <Bone w="70%" h={16} radius={6} />
        </div>
      </div>

      {/* Game type badge */}
      <Bone w={160} h={44} radius={22} />

      {/* Cancel button area */}
      <Bone w={140} h={40} radius={999} />
    </div>
  );
}

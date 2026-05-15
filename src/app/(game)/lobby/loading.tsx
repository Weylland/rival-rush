import { EA } from "@/lib/design";

function Bone({ w = "100%", h = 20, radius = 8 }: { w?: string | number; h?: number; radius?: number }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: radius,
      background: "rgba(255,255,255,0.07)",
      animation: "ea-pulse 1.4s ease-in-out infinite",
    }} />
  );
}

export default function LobbyLoading() {
  return (
    <div style={{
      minHeight: "100dvh",
      background: EA.violet,
      padding: "8px 20px 0",
      maxWidth: 680,
      margin: "0 auto",
      display: "flex",
      flexDirection: "column",
      gap: 0,
    }}>
      <style>{`@keyframes ea-pulse { 0%,100%{opacity:.45} 50%{opacity:1} }`}</style>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 8, paddingBottom: 20 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Bone w={80} h={12} radius={6} />
          <Bone w={160} h={36} radius={10} />
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <Bone w={52} h={52} radius={14} />
          <Bone w={36} h={36} radius={18} />
          <Bone w={36} h={36} radius={18} />
        </div>
      </div>

      {/* Tab bar */}
      <Bone h={46} radius={999} />

      {/* Search bar */}
      <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
        <Bone h={38} radius={14} />
        <Bone w={90} h={38} radius={12} />
      </div>

      {/* Player rows */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 16 }}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} style={{
            background: "rgba(255,255,255,0.05)",
            border: "2.5px solid rgba(255,255,255,0.07)",
            borderRadius: 22, padding: "12px 14px",
            display: "flex", alignItems: "center", gap: 12,
          }}>
            <Bone w={44} h={44} radius={22} />
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 7 }}>
              <Bone w={`${45 + i * 8}%`} h={16} radius={6} />
              <Bone w={`${25 + i * 5}%`} h={11} radius={5} />
            </div>
            <Bone w={72} h={34} radius={999} />
          </div>
        ))}
      </div>
    </div>
  );
}

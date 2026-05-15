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

export default function ResultLoading() {
  return (
    <div style={{
      minHeight: "100dvh",
      background: EA.violetDeep,
      padding: "24px 20px",
      maxWidth: 480,
      margin: "0 auto",
      display: "flex",
      flexDirection: "column",
      gap: 16,
      alignItems: "center",
    }}>
      <style>{`@keyframes ea-pulse { 0%,100%{opacity:.45} 50%{opacity:1} }`}</style>

      {/* Result badge (victoire / défaite / nul) */}
      <Bone w={220} h={52} radius={20} />

      {/* Players face-off */}
      <div style={{
        width: "100%",
        background: "rgba(255,255,255,0.04)",
        border: "2.5px solid rgba(255,255,255,0.08)",
        borderRadius: 24, padding: "24px 20px",
        display: "flex", alignItems: "center", gap: 16,
      }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
          <Bone w={72} h={72} radius={36} />
          <Bone w="65%" h={16} radius={6} />
          <Bone w="45%" h={28} radius={10} />
        </div>
        <Bone w={32} h={32} radius={4} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
          <Bone w={72} h={72} radius={36} />
          <Bone w="65%" h={16} radius={6} />
          <Bone w="45%" h={28} radius={10} />
        </div>
      </div>

      {/* Stats row */}
      <div style={{ width: "100%", display: "flex", gap: 10 }}>
        {[1, 2, 3].map(i => (
          <div key={i} style={{
            flex: 1,
            background: "rgba(255,255,255,0.04)",
            border: "2px solid rgba(255,255,255,0.07)",
            borderRadius: 16, padding: "14px 10px",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
          }}>
            <Bone w="50%" h={24} radius={8} />
            <Bone w="70%" h={12} radius={5} />
          </div>
        ))}
      </div>

      {/* Action buttons */}
      <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
        <Bone h={52} radius={999} />
        <Bone h={44} radius={999} />
      </div>
    </div>
  );
}

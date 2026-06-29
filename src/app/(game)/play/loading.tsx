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

export default function PlayLoading() {
  return (
    <div style={{
      minHeight: "100dvh",
      background: RR.violetDeep,
      padding: "16px 16px 24px",
      maxWidth: 520,
      margin: "0 auto",
      display: "flex",
      flexDirection: "column",
      gap: 12,
    }}>
      <style>{`@keyframes rr-pulse { 0%,100%{opacity:.45} 50%{opacity:1} }`}</style>

      {/* Top bar: back + title + rules */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Bone w={36} h={36} radius={18} />
        <Bone w={140} h={24} radius={10} />
        <Bone w={36} h={36} radius={18} />
      </div>

      {/* Score header */}
      <div style={{
        background: "rgba(255,255,255,0.04)",
        border: "2px solid rgba(255,255,255,0.07)",
        borderRadius: 20, padding: "14px 16px",
        display: "flex", alignItems: "center", gap: 12,
      }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <Bone w={40} h={40} radius={20} />
          <Bone w="60%" h={14} radius={6} />
        </div>
        <Bone w={48} h={32} radius={10} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <Bone w={40} h={40} radius={20} />
          <Bone w="60%" h={14} radius={6} />
        </div>
      </div>

      {/* Turn indicator */}
      <Bone h={36} radius={999} />

      {/* Game board area */}
      <div style={{
        background: "rgba(255,255,255,0.04)",
        border: "2px solid rgba(255,255,255,0.07)",
        borderRadius: 24,
        flex: 1,
        minHeight: 240,
        padding: 20,
        display: "flex",
        flexDirection: "column",
        gap: 14,
        alignItems: "center",
        justifyContent: "center",
      }}>
        <div style={{ display: "flex", gap: 12, width: "100%" }}>
          {[1, 2, 3].map(i => (
            <Bone key={i} h={80} radius={16} />
          ))}
        </div>
        <div style={{ display: "flex", gap: 12, width: "100%" }}>
          {[1, 2, 3].map(i => (
            <Bone key={i} h={80} radius={16} />
          ))}
        </div>
        <div style={{ display: "flex", gap: 12, width: "100%" }}>
          {[1, 2, 3].map(i => (
            <Bone key={i} h={80} radius={16} />
          ))}
        </div>
      </div>
    </div>
  );
}

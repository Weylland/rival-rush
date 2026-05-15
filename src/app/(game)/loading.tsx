import { EA } from "@/lib/design";

// Skeleton block helper
function Bone({ w = "100%", h = 20, radius = 8 }: { w?: string | number; h?: number; radius?: number }) {
  return (
    <div style={{
      width: w,
      height: h,
      borderRadius: radius,
      background: "rgba(255,255,255,0.07)",
      animation: "ea-pulse 1.4s ease-in-out infinite",
    }} />
  );
}

export default function GameLoading() {
  return (
    <div style={{
      minHeight: "100dvh",
      background: EA.violetDeep,
      padding: "24px 16px",
      maxWidth: 480,
      margin: "0 auto",
      display: "flex",
      flexDirection: "column",
      gap: 16,
    }}>
      <style>{`
        @keyframes ea-pulse {
          0%, 100% { opacity: 0.5; }
          50%        { opacity: 1;   }
        }
      `}</style>

      {/* Header bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Bone w={120} h={28} radius={12} />
        <Bone w={40} h={40} radius={20} />
      </div>

      {/* Main card */}
      <div style={{
        background: "rgba(255,255,255,0.04)",
        border: "2px solid rgba(255,255,255,0.07)",
        borderRadius: 20,
        padding: "20px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}>
        <Bone h={32} radius={10} />
        <Bone w="70%" h={18} />
        <Bone w="50%" h={18} />
      </div>

      {/* Player rows */}
      {[1, 2, 3].map(i => (
        <div key={i} style={{
          background: "rgba(255,255,255,0.04)",
          border: "2px solid rgba(255,255,255,0.07)",
          borderRadius: 16,
          padding: "14px 16px",
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}>
          <Bone w={44} h={44} radius={22} />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
            <Bone w="55%" h={16} />
            <Bone w="35%" h={12} />
          </div>
          <Bone w={64} h={32} radius={999} />
        </div>
      ))}
    </div>
  );
}

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

export default function RoomLoading() {
  return (
    <div style={{
      minHeight: "100dvh",
      background: RR.violet,
      padding: "12px 16px 100px",
      maxWidth: 700,
      margin: "0 auto",
      display: "flex",
      flexDirection: "column",
      gap: 14,
    }}>
      <style>{`@keyframes rr-pulse { 0%,100%{opacity:.45} 50%{opacity:1} }`}</style>

      {/* Room header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 4 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
          <Bone w={90} h={11} radius={5} />
          <Bone w="60%" h={34} radius={10} />
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
          <Bone w={80} h={36} radius={12} />
          <Bone w={34} h={34} radius={17} />
        </div>
      </div>

      {/* My stats bar */}
      <div style={{
        background: "rgba(255,255,255,0.04)",
        border: "2px solid rgba(255,255,255,0.08)",
        borderRadius: 16, padding: "12px 16px",
        display: "flex", gap: 16, alignItems: "center",
      }}>
        <Bone w={40} h={40} radius={20} />
        <div style={{ flex: 1 }}>
          <Bone w="30%" h={10} radius={5} />
          <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
            {[1, 2, 3, 4].map(i => (
              <div key={i} style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <Bone w={28} h={20} radius={6} />
                <Bone w={20} h={9} radius={4} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Bone h={44} radius={999} />

      {/* Member rows */}
      {[1, 2, 3].map(i => (
        <div key={i} style={{
          background: "rgba(255,255,255,0.05)",
          border: "2.5px solid rgba(255,255,255,0.07)",
          borderRadius: 20, padding: "11px 14px",
          display: "flex", alignItems: "center", gap: 12,
        }}>
          <Bone w={40} h={40} radius={20} />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 7 }}>
            <Bone w={`${40 + i * 12}%`} h={15} radius={6} />
            <Bone w={`${25 + i * 7}%`} h={10} radius={5} />
          </div>
          <Bone w={68} h={32} radius={999} />
          <Bone w={30} h={30} radius={15} />
        </div>
      ))}
    </div>
  );
}

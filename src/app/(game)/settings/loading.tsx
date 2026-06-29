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

function Section({ rows = 2 }: { rows?: number }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.04)",
      border: "2px solid rgba(255,255,255,0.08)",
      borderRadius: 20, padding: "18px 16px",
      display: "flex", flexDirection: "column", gap: 14,
    }}>
      <Bone w="40%" h={14} radius={6} />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Bone w="30%" h={11} radius={5} />
          <Bone h={42} radius={12} />
        </div>
      ))}
      <Bone h={44} radius={999} />
    </div>
  );
}

export default function SettingsLoading() {
  return (
    <div style={{
      minHeight: "100dvh",
      background: RR.violetDeep,
      padding: "32px 20px 80px",
      maxWidth: 520,
      margin: "0 auto",
      display: "flex",
      flexDirection: "column",
      gap: 20,
    }}>
      <style>{`@keyframes rr-pulse { 0%,100%{opacity:.45} 50%{opacity:1} }`}</style>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 8 }}>
        <Bone w={40} h={40} radius={20} />
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <Bone w={60} h={11} radius={5} />
          <Bone w={140} h={32} radius={10} />
        </div>
      </div>

      {/* Avatar section */}
      <div style={{
        background: "rgba(255,255,255,0.04)",
        border: "2px solid rgba(255,255,255,0.08)",
        borderRadius: 20, padding: "18px 16px",
        display: "flex", alignItems: "center", gap: 16,
      }}>
        <Bone w={72} h={72} radius={36} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
          <Bone w="50%" h={14} radius={6} />
          <Bone h={38} radius={10} />
        </div>
      </div>

      {/* Pseudo form */}
      <Section rows={1} />

      {/* Password form */}
      <Section rows={2} />

      {/* Danger zone */}
      <div style={{
        background: "rgba(255,30,140,0.06)",
        border: "2px solid rgba(255,30,140,0.2)",
        borderRadius: 20, padding: "18px 16px",
        display: "flex", flexDirection: "column", gap: 12,
      }}>
        <Bone w="35%" h={14} radius={6} />
        <Bone h={44} radius={999} />
      </div>
    </div>
  );
}

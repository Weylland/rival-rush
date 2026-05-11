import type { ReactNode } from "react";

export default function GameLayout({ children }: { children: ReactNode }) {
  return (
    <div style={{
      minHeight: "100dvh",
      background: "#0D0829",
      display: "flex",
      alignItems: "flex-start",
      justifyContent: "center",
    }}>
      <div style={{
        width: "100%",
        maxWidth: 480,
        minHeight: "100dvh",
        position: "relative",
        overflow: "hidden",
      }}>
        {children}
      </div>
    </div>
  );
}

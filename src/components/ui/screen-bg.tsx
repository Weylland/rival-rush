import { EA } from "@/lib/design";

interface ScreenBgProps {
  children?: React.ReactNode;
}

export function ScreenBg({ children }: ScreenBgProps) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: EA.violet,
        overflow: "hidden",
      }}
    >
      {/* dot pattern */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0.35,
          backgroundImage:
            "radial-gradient(circle, rgba(0,212,232,0.5) 1.4px, transparent 1.8px)",
          backgroundSize: "16px 16px",
        }}
      />
      {children}
    </div>
  );
}

"use client";

import { RR } from "@/lib/design";

interface RRButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  color?: string;
  ink?: string;
  shadow?: string;
  full?: boolean;
  size?: "sm" | "md" | "lg";
}

export function RRButton({
  children,
  color = RR.pink,
  ink = RR.white,
  shadow = RR.cyan,
  full = false,
  size = "md",
  style,
  ...rest
}: RRButtonProps) {
  const pad =
    size === "sm" ? "10px 18px" : size === "lg" ? "18px 30px" : "14px 24px";
  const fs = size === "sm" ? 14 : size === "lg" ? 20 : 16;

  return (
    <button
      {...rest}
      style={{
        fontFamily: "var(--font-display)",
        fontSize: fs,
        letterSpacing: 0.6,
        color: ink,
        background: color,
        border: `2px solid ${RR.ink}`,
        borderRadius: 999,
        padding: pad,
        width: full ? "100%" : "auto",
        cursor: "pointer",
        boxShadow: `4px 4px 0 ${shadow}, 4px 4px 0 1px ${RR.ink}`,
        transform: "skewX(-4deg)",
        textTransform: "uppercase",
        ...style,
      }}
    >
      <span style={{ display: "inline-block", transform: "skewX(4deg)" }}>
        {children}
      </span>
    </button>
  );
}

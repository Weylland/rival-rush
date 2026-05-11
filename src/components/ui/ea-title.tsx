interface EATitleProps {
  children: React.ReactNode;
  color?: string;
  shadow?: string;
  size?: number;
  italic?: boolean;
  style?: React.CSSProperties;
  className?: string;
}

export function EATitle({
  children,
  color = "#fff",
  shadow = "#FF1E8C",
  size = 28,
  italic = true,
  style = {},
  className,
}: EATitleProps) {
  return (
    <div
      className={className}
      style={{
        fontFamily: "var(--font-display)",
        fontSize: size,
        lineHeight: 1,
        color,
        transform: italic ? "skewX(-8deg)" : "none",
        textShadow: `3px 3px 0 ${shadow}`,
        letterSpacing: 0.5,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

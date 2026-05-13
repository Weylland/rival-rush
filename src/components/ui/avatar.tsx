import { EA } from "@/lib/design";

interface AvatarProps {
  name?: string;
  src?: string | null;
  color?: string;
  size?: number;
  ring?: string;
}

export function Avatar({
  name = "?",
  src,
  color = EA.cyan,
  size = 44,
  ring = EA.pink,
}: AvatarProps) {
  const circleStyle: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: "50%",
    background: color,
    border: `2.5px solid ${ring}`,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    boxShadow: `2px 2px 0 ${EA.ink}`,
    overflow: "hidden",
  };

  if (src?.startsWith("preset:")) {
    return (
      <div style={circleStyle}>
        <span style={{ fontSize: size * 0.48, lineHeight: 1, userSelect: "none" }}>
          {src.slice(7)}
        </span>
      </div>
    );
  }

  if (src) {
    return (
      <div style={{ ...circleStyle, padding: 0 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={name}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      </div>
    );
  }

  const initial = (name || "?").trim().charAt(0).toUpperCase();
  return (
    <div style={{ ...circleStyle, fontFamily: "var(--font-display)", fontSize: size * 0.45, color: EA.ink }}>
      {initial}
    </div>
  );
}

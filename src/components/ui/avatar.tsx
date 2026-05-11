import { EA } from "@/lib/design";

interface AvatarProps {
  name?: string;
  color?: string;
  size?: number;
  ring?: string;
}

export function Avatar({
  name = "?",
  color = EA.cyan,
  size = 44,
  ring = EA.pink,
}: AvatarProps) {
  const initial = (name || "?").trim().charAt(0).toUpperCase();
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: color,
        border: `2.5px solid ${ring}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "var(--font-display)",
        fontSize: size * 0.45,
        color: EA.ink,
        flexShrink: 0,
        boxShadow: `2px 2px 0 ${EA.ink}`,
      }}
    >
      {initial}
    </div>
  );
}

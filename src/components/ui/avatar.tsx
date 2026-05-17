"use client";

import { useState } from "react";
import { EA } from "@/lib/design";

const PODIUM_RING_COLORS = ["#FFD700", "#C0C0C0", "#CD7F32"] as const;

interface AvatarProps {
  name?: string;
  src?: string | null;
  color?: string;
  size?: number;
  ring?: string;
  podiumRank?: 0 | 1 | 2;
}

export function Avatar({
  name = "?",
  src,
  color = EA.cyan,
  size = 44,
  ring = EA.pink,
  podiumRank,
}: AvatarProps) {
  const [imgError, setImgError] = useState(false);

  const podiumColor = podiumRank !== undefined ? PODIUM_RING_COLORS[podiumRank] : null;

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
    // anneau podium : ring coloré → gap sombre → halo extérieur
    boxShadow: podiumColor
      ? `0 0 0 3px ${podiumColor}, 0 0 0 5.5px rgba(0,0,0,0.65), 0 0 18px 4px ${podiumColor}88`
      : `2px 2px 0 ${EA.ink}`,
    overflow: "hidden",
  };

  // Emoji preset
  if (src?.startsWith("preset:")) {
    return (
      <div style={circleStyle}>
        <span style={{ fontSize: size * 0.48, lineHeight: 1, userSelect: "none" }}>
          {src.slice(7)}
        </span>
      </div>
    );
  }

  // Image URL — avec fallback sur l'initiale si l'image échoue
  if (src && !imgError) {
    return (
      <div style={{ ...circleStyle, padding: 0 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={name}
          onError={() => setImgError(true)}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      </div>
    );
  }

  // Fallback initiale
  const initial = (name || "?").trim().charAt(0).toUpperCase();
  return (
    <div style={{ ...circleStyle, fontFamily: "var(--font-display)", fontSize: size * 0.45, color: EA.ink }}>
      {initial}
    </div>
  );
}

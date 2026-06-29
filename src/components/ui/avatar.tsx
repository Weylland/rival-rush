"use client";

import { useState } from "react";
import { RR } from "@/lib/design";
import { AvatarRankFrame } from "./avatar-rank-frame";

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
  color = RR.cyan,
  size = 44,
  ring = RR.pink,
  podiumRank,
}: AvatarProps) {
  const [imgError, setImgError] = useState(false);

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
    boxShadow: `2px 2px 0 ${RR.ink}`,
    overflow: "hidden",
  };

  function renderContent() {
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

    // Image URL — fallback sur l'initiale si erreur
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
      <div style={{ ...circleStyle, fontFamily: "var(--font-display)", fontSize: size * 0.45, color: RR.ink }}>
        {initial}
      </div>
    );
  }

  if (podiumRank !== undefined) {
    return (
      <div style={{ position: "relative", flexShrink: 0, width: size, height: size }}>
        {renderContent()}
        <AvatarRankFrame rank={podiumRank} size={size} />
      </div>
    );
  }

  return renderContent();
}

import { ImageResponse } from "next/og";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: 14,
          background: "#1a0f5e",
          border: "3px solid #00d4e8",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Pink diagonal slash */}
        <div
          style={{
            position: "absolute",
            width: 3,
            height: 56,
            background: "#ff1e8c",
            transform: "rotate(-8deg) translateX(2px)",
            borderRadius: 2,
            opacity: 0.9,
          }}
        />
        {/* E */}
        <div
          style={{
            fontFamily: "sans-serif",
            fontWeight: 900,
            fontSize: 34,
            color: "#ffffff",
            marginRight: 2,
            transform: "skewX(-8deg)",
            lineHeight: 1,
          }}
        >
          E
        </div>
        {/* A */}
        <div
          style={{
            fontFamily: "sans-serif",
            fontWeight: 900,
            fontSize: 34,
            color: "#00d4e8",
            marginLeft: 2,
            transform: "skewX(-8deg)",
            lineHeight: 1,
          }}
        >
          A
        </div>
        {/* Star top-right */}
        <div
          style={{
            position: "absolute",
            top: 4,
            right: 5,
            fontSize: 11,
            lineHeight: 1,
          }}
        >
          ★
        </div>
      </div>
    ),
    { ...size },
  );
}

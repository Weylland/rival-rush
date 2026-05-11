interface BlobProps {
  color: string;
  w?: number;
  h?: number;
  style?: React.CSSProperties;
  br?: string;
}

export function Blob({
  color,
  w = 200,
  h = 200,
  style = {},
  br = "63% 37% 54% 46% / 41% 51% 49% 59%",
}: BlobProps) {
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        width: w,
        height: h,
        background: color,
        borderRadius: br,
        ...style,
      }}
    />
  );
}

interface SvgBlobProps {
  color: string;
  style?: React.CSSProperties;
  path?: string;
  viewBox?: string;
}

const DEFAULT_PATH =
  "M 40 60 Q 30 20 80 25 Q 140 10 165 50 Q 195 90 175 140 Q 155 185 100 180 Q 40 190 25 140 Q 5 95 40 60 Z";

export function SvgBlob({
  color,
  style = {},
  path,
  viewBox = "0 0 200 200",
}: SvgBlobProps) {
  return (
    <svg
      viewBox={viewBox}
      style={{ position: "absolute", ...style }}
      preserveAspectRatio="none"
      aria-hidden
    >
      <path d={path ?? DEFAULT_PATH} fill={color} />
    </svg>
  );
}

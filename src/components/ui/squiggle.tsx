interface SquiggleProps {
  color?: string;
  style?: React.CSSProperties;
  w?: number;
  h?: number;
  sw?: number;
}

export function Squiggle({
  color = "#fff",
  style = {},
  w = 60,
  h = 60,
  sw = 3,
}: SquiggleProps) {
  return (
    <svg
      width={w}
      height={h}
      viewBox="0 0 60 60"
      style={{ position: "absolute", ...style }}
      aria-hidden
    >
      <path
        d="M 5 30 Q 15 10 25 30 T 45 30 T 60 30"
        stroke={color}
        strokeWidth={sw}
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}

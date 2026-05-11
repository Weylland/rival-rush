interface StarProps {
  color?: string;
  size?: number;
  style?: React.CSSProperties;
}

export function Star({ color = "#00D4E8", size = 30, style = {} }: StarProps) {
  const r = size / 2;
  const inner = size / 8;
  const path = `M ${r} 0 L ${r + inner} ${r - inner} L ${size} ${r} L ${r + inner} ${r + inner} L ${r} ${size} L ${r - inner} ${r + inner} L 0 ${r} L ${r - inner} ${r - inner} Z`;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ position: "absolute", ...style }}
      aria-hidden
    >
      <path d={path} fill={color} />
    </svg>
  );
}

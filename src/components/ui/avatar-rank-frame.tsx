"use client";

import { useId } from "react";

// Coordonnées polaires → cartésiennes (0° = haut, sens horaire)
function pt(cx: number, cy: number, r: number, deg: number): [number, number] {
  const a = (deg - 90) * Math.PI / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}
function s(cx: number, cy: number, r: number, deg: number) {
  const [x, y] = pt(cx, cy, r, deg);
  return `${x.toFixed(2)},${y.toFixed(2)}`;
}

// ── Gold frame — 8 spikes + 4 diamonds ────────────────────────────────────────

function GoldFrame({ cx, cy, aR, uid }: { cx: number; cy: number; aR: number; uid: string }) {
  const thick = aR * 0.22;
  const rI = aR + 3;
  const rM = rI + thick / 2;
  const rO = rI + thick;
  const spike = aR * 0.45;

  // 8 spikes
  const spikes = Array.from({ length: 8 }, (_, i) => {
    const angle = i * 45;
    const half = 11;
    return `${s(cx, cy, rO + spike, angle)} ${s(cx, cy, rO - 1, angle - half)} ${s(cx, cy, rO - 1, angle + half)}`;
  });

  // 4 diamonds at cardinal points (on ring outer edge)
  const gemR = rO + spike * 0.28;
  const gemS = thick * 0.52;
  const gems = [0, 90, 180, 270].map(angle => {
    const [gx, gy] = pt(cx, cy, gemR, angle);
    return { gx, gy, angle };
  });

  return (
    <>
      <defs>
        <radialGradient id={`${uid}g`} cx="38%" cy="30%" r="70%">
          <stop offset="0%"   stopColor="#FFFDE7" />
          <stop offset="25%"  stopColor="#FFD700" />
          <stop offset="60%"  stopColor="#F9A825" />
          <stop offset="100%" stopColor="#E65100" />
        </radialGradient>
        <radialGradient id={`${uid}gG`} cx="30%" cy="25%" r="75%">
          <stop offset="0%"   stopColor="#FFFFFF" />
          <stop offset="45%"  stopColor="#FFD700" />
          <stop offset="100%" stopColor="#FF8F00" />
        </radialGradient>
        <filter id={`${uid}gF`} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation={aR * 0.07} result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* Halo animé */}
      <circle cx={cx} cy={cy} r={rO + spike + 4} fill="none" stroke="#FFD700" strokeWidth="1.5" opacity="0.2">
        <animate attributeName="opacity" values="0.1;0.45;0.1" dur="2.8s" repeatCount="indefinite" />
      </circle>

      {/* Spikes */}
      {spikes.map((pts, i) => (
        <polygon key={i} points={pts} fill={`url(#${uid}g)`} filter={`url(#${uid}gF)`} />
      ))}

      {/* Anneau principal */}
      <circle cx={cx} cy={cy} r={rM} fill="none"
        stroke={`url(#${uid}g)`} strokeWidth={thick}
        filter={`url(#${uid}gF)`} />

      {/* Highlight interne */}
      <circle cx={cx} cy={cy} r={rM} fill="none"
        stroke="#FFFDE7" strokeWidth="1"
        strokeDasharray={`${rM * 0.15} ${rM * 0.08}`}
        opacity="0.55" />

      {/* Gems en losange aux 4 points cardinaux */}
      {gems.map(({ gx, gy, angle }, i) => (
        <rect key={i}
          x={gx - gemS} y={gy - gemS}
          width={gemS * 2} height={gemS * 2}
          fill={`url(#${uid}gG)`}
          transform={`rotate(45 ${gx} ${gy})`}
          filter={`url(#${uid}gF)`}
        />
      ))}

      {/* Anneau intérieur fin */}
      <circle cx={cx} cy={cy} r={aR + 1.5} fill="none" stroke="#FFF9C4" strokeWidth="1" opacity="0.45" />
    </>
  );
}

// ── Silver frame — 6 lames + anneau segmenté ──────────────────────────────────

function SilverFrame({ cx, cy, aR, uid }: { cx: number; cy: number; aR: number; uid: string }) {
  const thick = aR * 0.19;
  const rI = aR + 3;
  const rM = rI + thick / 2;
  const rO = rI + thick;
  const blade = aR * 0.36;
  const gap = 16; // degrés de séparation entre les lames

  const bladeAngles = [0, 60, 120, 180, 240, 300];

  // Arcs entre les lames
  const arcs = bladeAngles.map((angle, i) => {
    const next = bladeAngles[(i + 1) % 6];
    const from = s(cx, cy, rM, angle + gap);
    const to   = s(cx, cy, rM, next - gap);
    return { from, to, rM };
  });

  return (
    <>
      <defs>
        <linearGradient id={`${uid}s`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor="#FFFFFF" />
          <stop offset="30%"  stopColor="#E0E0E0" />
          <stop offset="60%"  stopColor="#9E9E9E" />
          <stop offset="100%" stopColor="#BDBDBD" />
        </linearGradient>
        <filter id={`${uid}sF`} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation={aR * 0.06} result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* Halo */}
      <circle cx={cx} cy={cy} r={rO + blade + 3} fill="none" stroke="#C0C0C0" strokeWidth="1.5" opacity="0.18" />

      {/* Arcs de l'anneau */}
      {arcs.map(({ from, to, rM: r }, i) => (
        <path key={i}
          d={`M ${from} A ${r} ${r} 0 0 1 ${to}`}
          fill="none" stroke={`url(#${uid}s)`}
          strokeWidth={thick} strokeLinecap="round"
          filter={`url(#${uid}sF)`} />
      ))}

      {/* Lames aux 6 positions */}
      {bladeAngles.map((angle, i) => {
        const tip  = s(cx, cy, rO + blade, angle);
        const bL   = s(cx, cy, rO,     angle - 9);
        const bR   = s(cx, cy, rO,     angle + 9);
        const iL   = s(cx, cy, rI + 2, angle - 5);
        const iR   = s(cx, cy, rI + 2, angle + 5);
        return (
          <polygon key={i}
            points={`${tip} ${bL} ${iL} ${iR} ${bR}`}
            fill={`url(#${uid}s)`}
            filter={`url(#${uid}sF)`} />
        );
      })}

      {/* Petits cercles entre les lames */}
      {bladeAngles.map((angle, i) => {
        const [bx, by] = pt(cx, cy, rM, angle + 30);
        return (
          <circle key={i} cx={bx} cy={by} r={thick * 0.35}
            fill={`url(#${uid}s)`} filter={`url(#${uid}sF)`} />
        );
      })}

      {/* Anneau intérieur fin */}
      <circle cx={cx} cy={cy} r={aR + 1.5} fill="none" stroke="#FFFFFF" strokeWidth="1" opacity="0.4" />
    </>
  );
}

// ── Bronze frame — anneau continu + 4 flammes ──────────────────────────────────

function BronzeFrame({ cx, cy, aR, uid }: { cx: number; cy: number; aR: number; uid: string }) {
  const thick = aR * 0.20;
  const rI = aR + 3;
  const rM = rI + thick / 2;
  const rO = rI + thick;
  const flame = aR * 0.32;

  // 4 flammes / gouttes aux points cardinaux
  const accents = [0, 90, 180, 270].map(angle => {
    const tip  = s(cx, cy, rO + flame, angle);
    const bL   = s(cx, cy, rO - 1,   angle - 13);
    const bR   = s(cx, cy, rO - 1,   angle + 13);
    const mL   = s(cx, cy, rO + flame * 0.5, angle - 7);
    const mR   = s(cx, cy, rO + flame * 0.5, angle + 7);
    return `${tip} ${mL} ${bL} ${bR} ${mR}`;
  });

  // Petits losanges entre les flammes
  const gems = [45, 135, 225, 315].map(angle => {
    const [gx, gy] = pt(cx, cy, rO + flame * 0.18, angle);
    const gs = thick * 0.38;
    return { gx, gy, gs };
  });

  return (
    <>
      <defs>
        <radialGradient id={`${uid}b`} cx="40%" cy="30%" r="70%">
          <stop offset="0%"   stopColor="#FFCC80" />
          <stop offset="30%"  stopColor="#CD7F32" />
          <stop offset="65%"  stopColor="#8D4E2B" />
          <stop offset="100%" stopColor="#6D3012" />
        </radialGradient>
        <filter id={`${uid}bF`} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation={aR * 0.06} result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* Halo */}
      <circle cx={cx} cy={cy} r={rO + flame + 3} fill="none" stroke="#CD7F32" strokeWidth="1.5" opacity="0.18" />

      {/* Anneau principal */}
      <circle cx={cx} cy={cy} r={rM} fill="none"
        stroke={`url(#${uid}b)`} strokeWidth={thick}
        filter={`url(#${uid}bF)`} />

      {/* Highlight */}
      <circle cx={cx} cy={cy} r={rM} fill="none"
        stroke="#FFCC80"
        strokeWidth="1"
        strokeDasharray={`${rM * 0.12} ${rM * 0.1}`}
        opacity="0.5" />

      {/* Flammes aux 4 points cardinaux */}
      {accents.map((pts, i) => (
        <polygon key={i} points={pts}
          fill={`url(#${uid}b)`}
          filter={`url(#${uid}bF)`} />
      ))}

      {/* Petits losanges entre les flammes */}
      {gems.map(({ gx, gy, gs }, i) => (
        <rect key={i}
          x={gx - gs} y={gy - gs}
          width={gs * 2} height={gs * 2}
          fill={`url(#${uid}b)`}
          transform={`rotate(45 ${gx} ${gy})`}
          filter={`url(#${uid}bF)`}
        />
      ))}

      {/* Anneau intérieur fin */}
      <circle cx={cx} cy={cy} r={aR + 1.5} fill="none" stroke="#FFCC80" strokeWidth="1" opacity="0.4" />
    </>
  );
}

// ── Composant public ──────────────────────────────────────────────────────────

export function AvatarRankFrame({ rank, size }: { rank: 0 | 1 | 2; size: number }) {
  const rawUid = useId();
  const uid = rawUid.replace(/:/g, "u");
  const aR  = size / 2;
  const pad = Math.max(12, Math.round(aR * 0.75));
  const total = size + pad * 2;
  const cx = total / 2;
  const cy = total / 2;

  return (
    <svg
      width={total}
      height={total}
      style={{
        position: "absolute",
        top: -pad, left: -pad,
        pointerEvents: "none",
        zIndex: 10,
        overflow: "visible",
      }}
    >
      {rank === 0 && <GoldFrame   cx={cx} cy={cy} aR={aR} uid={uid} />}
      {rank === 1 && <SilverFrame cx={cx} cy={cy} aR={aR} uid={uid} />}
      {rank === 2 && <BronzeFrame cx={cx} cy={cy} aR={aR} uid={uid} />}
    </svg>
  );
}

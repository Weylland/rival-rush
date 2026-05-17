"use client";

import { useId } from "react";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Coordonnées d'un point sur un cercle (0° = haut, sens horaire, coords écran) */
function xy(cx: number, cy: number, r: number, deg: number): [number, number] {
  const a = (deg - 90) * Math.PI / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}
const f = (n: number) => n.toFixed(2);
const p = (x: number, y: number) => `${f(x)},${f(y)}`;

/** Arc SVG en C (fromDeg → toDeg en passant par le haut, grande arc horaire) */
function arc(cx: number, cy: number, r: number, fromDeg: number, toDeg: number) {
  const [sx, sy] = xy(cx, cy, r, fromDeg);
  const [ex, ey] = xy(cx, cy, r, toDeg);
  return `M ${p(sx, sy)} A ${f(r)} ${f(r)} 0 1 1 ${p(ex, ey)}`;
}

/**
 * Corne organique pointant vers -y (haut) dans l'espace local.
 * curlDx : décalage horizontal de la pointe (négatif = gauche, positif = droite)
 */
function horn(w: number, h: number, curlDx = 0): string {
  const tx = curlDx, ty = -h;
  return [
    `M ${f(-w)},0`,
    `C ${f(-w * 1.4)},${f(-h * 0.22)} ${f(tx - w * 0.4)},${f(-h * 0.72)} ${f(tx)},${f(ty)}`,
    `C ${f(tx + w * 0.4)},${f(-h * 0.72)} ${f(w * 1.4)},${f(-h * 0.22)} ${f(w)},0`,
    "Z",
  ].join(" ");
}

/** Lame angulaire (pour silver) */
function blade(w: number, h: number, lean: number): string {
  return [
    `M ${f(-w)},0`,
    `L ${f(-w * 0.05 + lean)},${f(-h)}`,
    `L ${f(w * 0.15 + lean)},${f(-h * 0.86)}`,
    `L ${f(w)},0`,
    "Z",
  ].join(" ");
}

/** Goutte/teardrop arrondie (pour bronze) */
function drop(w: number, h: number): string {
  return [
    `M ${f(-w)},0`,
    `C ${f(-w * 1.3)},${f(-h * 0.28)} ${f(-w * 0.55)},${f(-h)} 0,${f(-h)}`,
    `C ${f(w * 0.55)},${f(-h)} ${f(w * 1.3)},${f(-h * 0.28)} ${f(w)},0`,
    "Z",
  ].join(" ");
}

/** Losange */
function gem(cx: number, cy: number, s: number): string {
  return `M ${p(cx, cy - s)} L ${p(cx + s * 0.65, cy)} L ${p(cx, cy + s * 0.8)} L ${p(cx - s * 0.65, cy)} Z`;
}

// ─── Gold frame (🥇) ─────────────────────────────────────────────────────────
// Grand C doré, 2 grandes cornes organiques vers le haut, gems aux cardinaux

function GoldFrame({ cx, cy, aR, uid }: { cx: number; cy: number; aR: number; uid: string }) {
  const thick = Math.max(4.5, aR * 0.21);
  const rM    = aR + 4 + thick / 2;

  // Cornes à ±30° du sommet (330° et 30°)
  // direction sortante = (deg - 90)° depuis +x → rotation template = outwardDeg - 270°
  const hornDeg  = 32;
  const lRot = (360 - hornDeg) - 90 - 270; // -30 → simplifié : -(hornDeg)
  const rRot = hornDeg - 90 - 270 + 360;   // = hornDeg (ex: 32°)
  const [lhx, lhy] = xy(cx, cy, rM, 360 - hornDeg);
  const [rhx, rhy] = xy(cx, cy, rM, hornDeg);
  const hW = aR * 0.25, hH = aR * 0.62;

  // Gems
  const [gx0, gy0] = xy(cx, cy, rM, 0);      // top center
  const [gxL, gyL] = xy(cx, cy, rM, 305);    // left accent
  const [gxR, gyR] = xy(cx, cy, rM, 55);     // right accent
  const gs = aR * 0.14, gs2 = aR * 0.09;

  return (
    <>
      <defs>
        <linearGradient id={`${uid}g`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor="#FFFDE7" />
          <stop offset="22%"  stopColor="#FFD700" />
          <stop offset="55%"  stopColor="#F57F17" />
          <stop offset="80%"  stopColor="#FFD700" />
          <stop offset="100%" stopColor="#FFFDE7" />
        </linearGradient>
        <linearGradient id={`${uid}gh`} x1="20%" y1="100%" x2="80%" y2="0%">
          <stop offset="0%"   stopColor="#BF6000" />
          <stop offset="35%"  stopColor="#FFD700" />
          <stop offset="65%"  stopColor="#FFF9C4" />
          <stop offset="100%" stopColor="#FFD700" />
        </linearGradient>
        <radialGradient id={`${uid}gg`} cx="35%" cy="28%" r="72%">
          <stop offset="0%"   stopColor="#FFFFFF" />
          <stop offset="40%"  stopColor="#FFE57F" />
          <stop offset="100%" stopColor="#E65100" />
        </radialGradient>
        <filter id={`${uid}gf`} x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation={aR * 0.09} result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id={`${uid}gg2`} x="-120%" y="-120%" width="340%" height="340%">
          <feGaussianBlur stdDeviation={aR * 0.18} result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* Halo pulsant */}
      <path d={arc(cx, cy, rM + thick * 0.7 + 2, 232, 128)} fill="none"
        stroke="#FFD700" strokeWidth={thick * 0.6} strokeLinecap="round" opacity="0.22">
        <animate attributeName="opacity" values="0.1;0.42;0.1" dur="2.6s" repeatCount="indefinite" />
      </path>

      {/* Cornes principales */}
      <path d={horn(hW, hH, -hW * 0.28)}
        transform={`translate(${f(lhx)},${f(lhy)}) rotate(${f(-hornDeg)})`}
        fill={`url(#${uid}gh)`} filter={`url(#${uid}gf)`} />
      <path d={horn(hW, hH, hW * 0.28)}
        transform={`translate(${f(rhx)},${f(rhy)}) rotate(${f(hornDeg)})`}
        fill={`url(#${uid}gh)`} filter={`url(#${uid}gf)`} />

      {/* Arc principal */}
      <path d={arc(cx, cy, rM, 232, 128)} fill="none"
        stroke={`url(#${uid}g)`} strokeWidth={thick} strokeLinecap="round"
        filter={`url(#${uid}gf)`} />

      {/* Ligne de reflet interne */}
      <path d={arc(cx, cy, rM - thick * 0.28, 234, 126)} fill="none"
        stroke="#FFFDE7" strokeWidth={thick * 0.14} strokeLinecap="round" opacity="0.65" />

      {/* Gem central (sommet) */}
      <path d={gem(gx0, gy0, gs)} fill={`url(#${uid}gg)`} filter={`url(#${uid}gg2)`} />

      {/* Petits gems latéraux */}
      <path d={gem(gxL, gyL, gs2)} fill={`url(#${uid}gg)`} filter={`url(#${uid}gf)`} />
      <path d={gem(gxR, gyR, gs2)} fill={`url(#${uid}gg)`} filter={`url(#${uid}gf)`} />

      {/* Bord interne lumineux */}
      <circle cx={cx} cy={cy} r={aR + 1.5} fill="none" stroke="#FFD700" strokeWidth="1" opacity="0.38" />
    </>
  );
}

// ─── Silver frame (🥈) ───────────────────────────────────────────────────────
// C argenté, 2 lames angulaires style armure, gem en pointe au sommet

function SilverFrame({ cx, cy, aR, uid }: { cx: number; cy: number; aR: number; uid: string }) {
  const thick = Math.max(4.5, aR * 0.20);
  const rM    = aR + 4 + thick / 2;

  const bladeDeg = 38;
  const bW = aR * 0.32, bH = aR * 0.52;
  const [lbx, lby] = xy(cx, cy, rM, 360 - bladeDeg);
  const [rbx, rby] = xy(cx, cy, rM, bladeDeg);

  // Gem au sommet
  const [gx0, gy0] = xy(cx, cy, rM, 0);
  const gs = aR * 0.13;

  // Petits rivets le long de l'arc
  const rivetAngles = [340, 310, 270, 230, 200, 160, 130, 100, 60, 20];
  const rivetR = aR * 0.055;

  return (
    <>
      <defs>
        <linearGradient id={`${uid}s`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor="#FFFFFF" />
          <stop offset="28%"  stopColor="#E0E0E0" />
          <stop offset="58%"  stopColor="#9E9E9E" />
          <stop offset="82%"  stopColor="#E0E0E0" />
          <stop offset="100%" stopColor="#FFFFFF" />
        </linearGradient>
        <linearGradient id={`${uid}sb`} x1="0%" y1="100%" x2="50%" y2="0%">
          <stop offset="0%"   stopColor="#616161" />
          <stop offset="40%"  stopColor="#E0E0E0" />
          <stop offset="70%"  stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#BDBDBD" />
        </linearGradient>
        <radialGradient id={`${uid}sg`} cx="32%" cy="25%" r="75%">
          <stop offset="0%"   stopColor="#FFFFFF" />
          <stop offset="45%"  stopColor="#CFD8DC" />
          <stop offset="100%" stopColor="#546E7A" />
        </radialGradient>
        <filter id={`${uid}sf`} x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation={aR * 0.08} result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id={`${uid}sg2`} x="-120%" y="-120%" width="340%" height="340%">
          <feGaussianBlur stdDeviation={aR * 0.16} result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* Lames angulaires gauche */}
      <path d={blade(bW, bH, -bW * 0.15)}
        transform={`translate(${f(lbx)},${f(lby)}) rotate(${f(-bladeDeg)})`}
        fill={`url(#${uid}sb)`} filter={`url(#${uid}sf)`} />
      {/* Lames angulaires droite */}
      <path d={blade(bW, bH, bW * 0.15)}
        transform={`translate(${f(rbx)},${f(rby)}) rotate(${f(bladeDeg)})`}
        fill={`url(#${uid}sb)`} filter={`url(#${uid}sf)`} />

      {/* Arc principal */}
      <path d={arc(cx, cy, rM, 236, 124)} fill="none"
        stroke={`url(#${uid}s)`} strokeWidth={thick} strokeLinecap="butt"
        filter={`url(#${uid}sf)`} />

      {/* Reflet interne */}
      <path d={arc(cx, cy, rM - thick * 0.3, 237, 123)} fill="none"
        stroke="#FFFFFF" strokeWidth={thick * 0.14} strokeLinecap="butt" opacity="0.55" />

      {/* Rivets / détails */}
      {rivetAngles.map((deg, i) => {
        const [rx, ry] = xy(cx, cy, rM, deg);
        return <circle key={i} cx={rx} cy={ry} r={rivetR}
          fill={`url(#${uid}s)`} filter={`url(#${uid}sf)`} />;
      })}

      {/* Gem sommet (losange effilé vertical) */}
      <path d={gem(gx0, gy0, gs)} fill={`url(#${uid}sg)`} filter={`url(#${uid}sg2)`} />

      {/* Bord interne */}
      <circle cx={cx} cy={cy} r={aR + 1.5} fill="none" stroke="#BDBDBD" strokeWidth="1" opacity="0.4" />
    </>
  );
}

// ─── Bronze frame (🥉) ───────────────────────────────────────────────────────
// C bronze, 2 gouttes/cornes arrondies, anneau avec motif en pointillé

function BronzeFrame({ cx, cy, aR, uid }: { cx: number; cy: number; aR: number; uid: string }) {
  const thick = Math.max(4, aR * 0.19);
  const rM    = aR + 4 + thick / 2;

  const dropDeg = 42;
  const dW = aR * 0.20, dH = aR * 0.44;
  const [ldx, ldy] = xy(cx, cy, rM, 360 - dropDeg);
  const [rdx, rdy] = xy(cx, cy, rM, dropDeg);

  // Petits losanges aux 4 points intermédiaires
  const accentAngles = [330, 270, 210, 150, 90];
  const as = aR * 0.075;

  return (
    <>
      <defs>
        <linearGradient id={`${uid}b`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor="#FFCC80" />
          <stop offset="25%"  stopColor="#CD7F32" />
          <stop offset="60%"  stopColor="#8D4E2B" />
          <stop offset="82%"  stopColor="#CD7F32" />
          <stop offset="100%" stopColor="#FFCC80" />
        </linearGradient>
        <linearGradient id={`${uid}bd`} x1="10%" y1="100%" x2="50%" y2="0%">
          <stop offset="0%"   stopColor="#5D3012" />
          <stop offset="38%"  stopColor="#CD7F32" />
          <stop offset="68%"  stopColor="#FFCC80" />
          <stop offset="100%" stopColor="#CD7F32" />
        </linearGradient>
        <radialGradient id={`${uid}ba`} cx="38%" cy="28%" r="72%">
          <stop offset="0%"   stopColor="#FFE0B2" />
          <stop offset="48%"  stopColor="#CD7F32" />
          <stop offset="100%" stopColor="#4E2900" />
        </radialGradient>
        <filter id={`${uid}bf`} x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation={aR * 0.08} result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id={`${uid}bg`} x="-120%" y="-120%" width="340%" height="340%">
          <feGaussianBlur stdDeviation={aR * 0.15} result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* Halo doux */}
      <path d={arc(cx, cy, rM + thick * 0.6 + 2, 240, 120)} fill="none"
        stroke="#CD7F32" strokeWidth={thick * 0.55} strokeLinecap="round" opacity="0.18" />

      {/* Gouttes gauche/droite */}
      <path d={drop(dW, dH)}
        transform={`translate(${f(ldx)},${f(ldy)}) rotate(${f(-dropDeg)})`}
        fill={`url(#${uid}bd)`} filter={`url(#${uid}bf)`} />
      <path d={drop(dW, dH)}
        transform={`translate(${f(rdx)},${f(rdy)}) rotate(${f(dropDeg)})`}
        fill={`url(#${uid}bd)`} filter={`url(#${uid}bf)`} />

      {/* Arc principal */}
      <path d={arc(cx, cy, rM, 240, 120)} fill="none"
        stroke={`url(#${uid}b)`} strokeWidth={thick} strokeLinecap="round"
        filter={`url(#${uid}bf)`} />

      {/* Pointillé décoratif sur l'arc */}
      <path d={arc(cx, cy, rM, 240, 120)} fill="none"
        stroke="#FFCC80"
        strokeWidth={thick * 0.13}
        strokeDasharray={`${rM * 0.13} ${rM * 0.09}`}
        strokeLinecap="round"
        opacity="0.55" />

      {/* Accents losange */}
      {accentAngles.map((deg, i) => {
        const [ax, ay] = xy(cx, cy, rM, deg);
        return <path key={i} d={gem(ax, ay, as)}
          fill={`url(#${uid}ba)`} filter={`url(#${uid}bf)`} />;
      })}

      {/* Bord interne */}
      <circle cx={cx} cy={cy} r={aR + 1.5} fill="none" stroke="#FFCC80" strokeWidth="1" opacity="0.38" />
    </>
  );
}

// ─── Export ───────────────────────────────────────────────────────────────────

export function AvatarRankFrame({ rank, size }: { rank: 0 | 1 | 2; size: number }) {
  const rawUid = useId();
  const uid    = rawUid.replace(/:/g, "u");
  const aR     = size / 2;
  const pad    = Math.max(14, Math.round(aR * 0.92));
  const total  = size + pad * 2;
  const cx     = total / 2;
  const cy     = total / 2;

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

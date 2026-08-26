/**
 * Grafiken fuer das Hauptmenue - alles als Inline-SVG, ohne Bilddateien.
 * So bleibt der Build klein und die Motive nehmen die Themefarben an.
 */

/** Ein Flutlichtmast mit Lichtkegel. */
function Floodlight({ x, flip }: { x: number; flip?: boolean }) {
  const dir = flip ? -1 : 1;
  return (
    <g transform={`translate(${x} 0)`}>
      <rect x={-3} y={44} width={6} height={82} fill="#1b2942" />
      <rect x={-24} y={26} width={48} height={20} rx="3" fill="#22334f" />
      {[-16, -5.5, 5.5, 16].map((lx) => (
        <circle key={lx} cx={lx} cy={36} r="4.4" fill="#ffeeb8" className="lamp" />
      ))}
      <path d={`M ${dir * -28} 46 L ${dir * 140} 260 L ${dir * -84} 260 Z`}
        fill="url(#beam)" className="beam" />
    </g>
  );
}

/**
 * Stadion bei Flutlicht als Kopfbild des Menues.
 *
 * Alles gezeichnet, keine Bilddatei: So bleibt der Build klein, das Motiv
 * skaliert verlustfrei und nimmt die Themefarben an. Die Zuschauerraenge sind
 * ein Muster statt tausender Einzelpunkte - sonst wuerde das Zeichnen teuer.
 */
export function PitchBackdrop() {
  return (
    <svg className="hero-pitch" viewBox="0 0 800 330" preserveAspectRatio="xMidYMid slice"
      aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#060c18" />
          <stop offset="70%" stopColor="#0d1b30" />
          <stop offset="100%" stopColor="#132743" />
        </linearGradient>
        <linearGradient id="beam" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffeeb8" stopOpacity="0.20" />
          <stop offset="100%" stopColor="#ffeeb8" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="grass" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0d5a2e" />
          <stop offset="100%" stopColor="#06371c" />
        </linearGradient>
        <linearGradient id="stand" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#16233a" />
          <stop offset="100%" stopColor="#0b1424" />
        </linearGradient>
        {/* Zuschauer: versetzte Punktreihen in gedaempften Farben. */}
        <pattern id="crowd" width="14" height="10" patternUnits="userSpaceOnUse">
          <circle cx="3" cy="3" r="1.7" fill="#8ea3c4" opacity="0.55" />
          <circle cx="10" cy="8" r="1.7" fill="#c9d6ea" opacity="0.4" />
          <circle cx="10" cy="3" r="1.5" fill="#37d67a" opacity="0.22" />
          <circle cx="3" cy="8" r="1.5" fill="#f5c542" opacity="0.18" />
        </pattern>
        <pattern id="mow" width="80" height="200" patternUnits="userSpaceOnUse">
          <rect width="40" height="200" fill="rgba(255,255,255,0.035)" />
        </pattern>
      </defs>

      <rect width="800" height="330" fill="url(#sky)" />

      {/* Gegengerade mit Rang und Publikum */}
      <path d="M 0 128 L 800 128 L 800 196 L 0 196 Z" fill="url(#stand)" />
      <path d="M 40 134 L 760 134 L 780 180 L 20 180 Z" fill="url(#crowd)" />
      <path d="M 0 124 L 800 124 L 800 131 L 0 131 Z" fill="#0a1220" />

      {/* Dachkante */}
      <path d="M 0 128 L 90 100 L 710 100 L 800 128 Z" fill="#0a1220" />
      <path d="M 90 100 L 710 100 L 710 106 L 90 106 Z" fill="#1b2942" />

      <Floodlight x={118} />
      <Floodlight x={682} flip />

      {/* Rasen in leichter Perspektive */}
      <path d="M -40 196 L 840 196 L 800 330 L 0 330 Z" fill="url(#grass)" />
      <path d="M -40 196 L 840 196 L 800 330 L 0 330 Z" fill="url(#mow)" />

      {/* Linien: Grundlinie, Mittellinie, Anstosskreis */}
      <g fill="none" stroke="rgba(255,255,255,0.34)" strokeWidth="2.4">
        <path d="M 400 196 L 400 330" />
        <ellipse cx="400" cy="278" rx="112" ry="36" />
        <path d="M -40 196 L 840 196" strokeWidth="2" opacity="0.55" />
      </g>
      <ellipse cx="400" cy="278" rx="4" ry="2" fill="rgba(255,255,255,0.5)" />

      {/* Vereinzelte Blitzlichter im Rang */}
      {[[130, 148], [305, 166], [470, 142], [640, 170], [214, 173], [560, 152]].map(
        ([fx, fy], i) => (
          <circle key={i} cx={fx} cy={fy} r="2.6" fill="#ffffff"
            className="flash" style={{ animationDelay: `${i * 1.7}s` }} />
        ),
      )}
    </svg>
  );
}

/** Der Ball wandert langsam ueber den Kopfbereich. */
export function DriftingBall() {
  return (
    <svg className="hero-ball" viewBox="0 0 40 40" aria-hidden="true" focusable="false">
      <circle cx="20" cy="20" r="17" fill="#f4f7fb" stroke="rgba(0,0,0,0.35)" strokeWidth="1.5" />
      <g fill="#16253d">
        <path d="M20 8 l5.6 4.1 -2.1 6.6 h-7 l-2.1 -6.6 Z" />
        <path d="M9.2 17.6 l2.2 6.6 -4.6 3.1 A13 13 0 0 1 5.2 20 Z" />
        <path d="M30.8 17.6 l4 2.4 a13 13 0 0 1 -1.6 6.9 l-4.6 -3.1 Z" />
        <path d="M14.6 26.4 h10.8 l1.9 5.6 a13 13 0 0 1 -14.6 0 Z" />
      </g>
    </svg>
  );
}

export type MenuIcon = 'boot' | 'table' | 'trophy';

/** Kleine Sinnbilder fuer die drei Punkte unter "Was dich erwartet". */
export function FeatureIcon({ icon }: { icon: MenuIcon }) {
  const common = {
    viewBox: '0 0 48 48',
    'aria-hidden': true as const,
    focusable: 'false' as const,
    className: 'feature-icon',
  };

  if (icon === 'boot') {
    return (
      <svg {...common}>
        <circle cx="24" cy="24" r="21" fill="rgba(55,214,122,0.12)" />
        <path d="M11 30 h16 l8 -5 4 5 v5 H11 Z" fill="none" stroke="var(--accent)"
          strokeWidth="2.4" strokeLinejoin="round" />
        <path d="M13 35 v3 M20 35 v3 M27 35 v3 M34 35 v3" stroke="var(--accent)"
          strokeWidth="2" strokeLinecap="round" />
        <path d="M14 30 v-8" stroke="var(--accent)" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
    );
  }

  if (icon === 'table') {
    return (
      <svg {...common}>
        <circle cx="24" cy="24" r="21" fill="rgba(43,183,255,0.12)" />
        <g stroke="var(--accent-2)" strokeWidth="2.4" strokeLinecap="round">
          <path d="M13 17 h22" />
          <path d="M13 24 h22" />
          <path d="M13 31 h22" />
        </g>
        <circle cx="17" cy="17" r="2.6" fill="var(--accent-2)" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <circle cx="24" cy="24" r="21" fill="rgba(245,197,66,0.12)" />
      <path d="M17 12 h14 v8 a7 7 0 0 1 -14 0 Z" fill="none" stroke="var(--gold)"
        strokeWidth="2.4" strokeLinejoin="round" />
      <path d="M17 14 h-4 v3 a4 4 0 0 0 4 4 M31 14 h4 v3 a4 4 0 0 1 -4 4"
        fill="none" stroke="var(--gold)" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M24 27 v5 M20 36 h8" fill="none" stroke="var(--gold)"
        strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

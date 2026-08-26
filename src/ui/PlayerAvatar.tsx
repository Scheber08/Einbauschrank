/**
 * Spielerkopf als SVG, aus den bei der Erstellung gewaehlten Merkmalen.
 *
 * Das Aussehen wird beim Anlegen der Karriere eingestellt, war danach aber
 * nirgends zu sehen - in der Seitenleiste standen nur die Initialen. Der
 * Avatar macht daraus ein Gesicht, das die ganze Laufbahn ueber mitlaeuft.
 */
import type { Appearance } from '../engine/types';

/** Gemeinsame Paletten fuer Erstellung und Anzeige. */
export const SKIN_TONES = ['#f3d3b6', '#e5b48c', '#c78f63', '#9b6440', '#6f4326', '#4a2c1a'];
export const HAIR_COLORS = ['#2b2118', '#5b3a1e', '#a86b2c', '#d8b46a', '#8e8e8e', '#1a1a1a'];

const DEFAULT_LOOK: Appearance = {
  skinTone: 1, hairStyle: 1, hairColor: HAIR_COLORS[0],
  beard: 0, eyeColor: '#3b2a1c', boots: '#ffffff',
};

/** Haaransatz je Frisurstufe: 0 = kahl, hoehere Stufen = mehr Volumen. */
function hairPath(style: number): string | null {
  switch (Math.max(0, Math.min(4, style))) {
    case 0: return null;
    case 1: return 'M 26 30 q 24 -18 48 0 q -6 -22 -24 -22 q -18 0 -24 22 Z';
    case 2: return 'M 24 34 q 26 -22 52 0 q -2 -28 -26 -28 q -24 0 -26 28 Z';
    case 3: return 'M 23 40 q 27 -26 54 0 q 2 -32 -27 -32 q -29 0 -27 32 Z M 23 40 q -3 12 2 20 l 4 -18 Z';
    default:
      return 'M 22 44 q 28 -30 56 0 q 4 -36 -28 -36 q -32 0 -28 36 Z '
        + 'M 22 40 q -5 16 1 26 l 5 -22 Z M 78 40 q 5 16 -1 26 l -5 -22 Z';
  }
}

export default function PlayerAvatar(
  { look, jersey, trim, size = 96, name }:
  {
    look?: Appearance;
    /** Trikotfarben des Vereins. */
    jersey?: string;
    trim?: string;
    size?: number;
    name?: string;
  },
) {
  const a = look ?? DEFAULT_LOOK;
  const skin = SKIN_TONES[Math.max(0, Math.min(SKIN_TONES.length - 1, a.skinTone))] ?? SKIN_TONES[1];
  const hair = a.hairColor || HAIR_COLORS[0];
  const shirt = jersey ?? '#2f4f78';
  const collar = trim ?? '#ffffff';
  const hairD = hairPath(a.hairStyle);
  const beard = Math.max(0, Math.min(3, a.beard ?? 0));

  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className="avatar-svg"
      role="img" aria-label={name ? `Portraet ${name}` : 'Spielerportraet'}>
      <defs>
        <clipPath id="avatar-clip"><circle cx="50" cy="50" r="49" /></clipPath>
      </defs>
      <g clipPath="url(#avatar-clip)">
        <circle cx="50" cy="50" r="49" fill="#0d1626" />

        {/* Schultern im Trikot */}
        <path d="M 16 100 q 4 -26 34 -26 q 30 0 34 26 Z" fill={shirt} />
        <path d="M 50 74 l -7 6 l 7 8 l 7 -8 Z" fill={collar} opacity="0.9" />

        {/* Hals und Kopf */}
        <rect x="43" y="60" width="14" height="16" rx="6" fill={skin} />
        <ellipse cx="50" cy="45" rx="20" ry="23" fill={skin} />

        {/* Ohren */}
        <ellipse cx="30" cy="46" rx="3.4" ry="5" fill={skin} />
        <ellipse cx="70" cy="46" rx="3.4" ry="5" fill={skin} />

        {/* Bart */}
        {beard > 0 && (
          <path
            d={beard === 1
              ? 'M 42 58 q 8 5 16 0 q -2 6 -8 6 q -6 0 -8 -6 Z'
              : beard === 2
                ? 'M 33 48 q 3 20 17 20 q 14 0 17 -20 q -6 14 -17 14 q -11 0 -17 -14 Z'
                : 'M 31 44 q 1 26 19 26 q 18 0 19 -26 q -4 20 -19 20 q -15 0 -19 -20 Z'}
            fill={hair} opacity="0.92" />
        )}

        {/* Augen und Mund */}
        <ellipse cx="42" cy="44" rx="2.6" ry="3" fill={a.eyeColor || '#3b2a1c'} />
        <ellipse cx="58" cy="44" rx="2.6" ry="3" fill={a.eyeColor || '#3b2a1c'} />
        <path d="M 44 55 q 6 4 12 0" fill="none" stroke="rgba(0,0,0,0.4)"
          strokeWidth="1.6" strokeLinecap="round" />

        {/* Haare zuletzt, damit sie ueber der Stirn liegen */}
        {hairD && <path d={hairD} fill={hair} />}
      </g>
      <circle cx="50" cy="50" r="48" fill="none" stroke="rgba(255,255,255,0.16)" strokeWidth="2" />
    </svg>
  );
}

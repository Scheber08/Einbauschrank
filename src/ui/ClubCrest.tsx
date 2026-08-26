/**
 * Vereinswappen als SVG, erzeugt aus Vereinsfarben und Id.
 * Jeder Verein bekommt so ein wiedererkennbares Zeichen, ohne Bilddateien.
 */
import {
  crestLabel, crestStyle, type CrestClub, type CrestPattern,
} from '../engine/identity';

/** Fuellmuster innerhalb der Wappenform. */
function Pattern(
  { pattern, primary, secondary }:
  { pattern: CrestPattern; primary: string; secondary: string },
) {
  switch (pattern) {
    case 'stripes':
      return (
        <>
          <rect x={0} y={0} width={100} height={100} fill={primary} />
          {[14, 42, 70].map((x) => (
            <rect key={x} x={x} y={0} width={14} height={100} fill={secondary} />
          ))}
        </>
      );
    case 'halves':
      return (
        <>
          <rect x={0} y={0} width={50} height={100} fill={primary} />
          <rect x={50} y={0} width={50} height={100} fill={secondary} />
        </>
      );
    case 'sash':
      return (
        <>
          <rect x={0} y={0} width={100} height={100} fill={primary} />
          <path d="M -10 70 L 70 -10 L 100 20 L 20 100 Z" fill={secondary} />
        </>
      );
    case 'hoop':
      return (
        <>
          <rect x={0} y={0} width={100} height={100} fill={primary} />
          <rect x={0} y={30} width={100} height={22} fill={secondary} />
        </>
      );
    case 'chevron':
      return (
        <>
          <rect x={0} y={0} width={100} height={100} fill={primary} />
          <path d="M 50 18 L 100 62 L 100 96 L 50 52 L 0 96 L 0 62 Z" fill={secondary} />
        </>
      );
    default:
      return <rect x={0} y={0} width={100} height={100} fill={primary} />;
  }
}

/** Umriss der Wappenform als Clip-Pfad. */
function shapePath(shape: string): string {
  switch (shape) {
    case 'round':
      return 'M 50 2 A 48 48 0 1 1 49.9 2 Z';
    case 'diamond':
      return 'M 50 0 L 100 50 L 50 100 L 0 50 Z';
    case 'banner':
      return 'M 4 4 L 96 4 L 96 74 L 50 98 L 4 74 Z';
    default: // shield
      return 'M 6 6 L 94 6 L 94 52 C 94 78 72 92 50 99 C 28 92 6 78 6 52 Z';
  }
}

export default function ClubCrest(
  { club, size = 34, title }: { club: CrestClub; size?: number; title?: boolean },
) {
  const style = crestStyle(club);
  const [primary, secondary] = club.colors;
  const label = crestLabel(club);
  const clipId = `crest-${club.id}`;
  // Schriftgroesse an die Kuerzellaenge anpassen, damit nichts ueberlaeuft.
  const fontSize = label.length >= 4 ? 30 : label.length === 3 ? 36 : 44;

  return (
    <svg width={size} height={size} viewBox="0 0 100 108" role="img"
      aria-label={`Wappen ${club.name}`} style={{ flex: '0 0 auto', display: 'block' }}>
      <defs>
        <clipPath id={clipId}><path d={shapePath(style.shape)} /></clipPath>
      </defs>

      {style.star && (
        <path d="M 50 100 l 3.2 6.5 l 7.2 1 l -5.2 5.1 l 1.2 7.2 l -6.4 -3.4 l -6.4 3.4 l 1.2 -7.2 l -5.2 -5.1 l 7.2 -1 Z"
          fill="#f0c419" transform="translate(0,-104) scale(0.62) translate(31,0)" />
      )}

      <g clipPath={`url(#${clipId})`}>
        <Pattern pattern={style.pattern} primary={primary} secondary={secondary} />
        {/* leichter Glanz von oben */}
        <rect x={0} y={0} width={100} height={44} fill="rgba(255,255,255,0.1)" />
      </g>
      <path d={shapePath(style.shape)} fill="none" stroke="rgba(0,0,0,0.55)" strokeWidth={4} />
      <path d={shapePath(style.shape)} fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth={1.5} />

      <text x={50} y={58} textAnchor="middle" dominantBaseline="middle"
        fontSize={fontSize} fontWeight={800} fill="#fff"
        stroke="rgba(0,0,0,0.55)" strokeWidth={1.2} paintOrder="stroke"
        fontFamily="system-ui, sans-serif">
        {label}
      </text>
      {title && (
        <text x={50} y={86} textAnchor="middle" fontSize={13} fill="rgba(255,255,255,0.85)"
          fontFamily="system-ui, sans-serif">{style.founded}</text>
      )}
    </svg>
  );
}

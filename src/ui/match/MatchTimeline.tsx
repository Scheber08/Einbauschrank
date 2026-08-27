/**
 * Grafischer Spielverlauf (Konzept Abschnitt 57).
 *
 * Zwei Ansichten aus denselben Ereignissen:
 *  - eine Zeitachse mit den Treffern, Karten und Wechseln beider Mannschaften
 *  - ein Druckverlauf, der zeigt, wer in welcher Phase die Abschluesse hatte
 *
 * Beides beantwortet die Frage, die eine durchlaufende Textliste offen laesst:
 * Wie ist dieses Spiel eigentlich verlaufen?
 */
import { useLocale } from '../../i18n/useLocale';
import { t } from '../../i18n';
import type { LiveEvent } from '../../engine/matchTypes';

const W = 640;
const AXIS_Y = 46;
const MARK_R = 7;

/** Ereignisse, die auf der Achse einen Marker bekommen. */
const MARKED: Partial<Record<LiveEvent['type'], 'goal' | 'yellow' | 'red' | 'sub' | 'miss'>> = {
  goal: 'goal',
  ownGoal: 'goal',
  yellow: 'yellow',
  secondYellow: 'red',
  red: 'red',
  sub: 'sub',
  penaltyMiss: 'miss',
};

function markColour(kind: string, user: boolean): string {
  if (user) return 'var(--gold)';
  switch (kind) {
    case 'goal': return 'var(--accent)';
    case 'yellow': return '#f5c542';
    case 'red': return 'var(--bad)';
    case 'miss': return 'var(--warn)';
    default: return 'var(--dim)';
  }
}

export default function MatchTimeline(
  { events, minute, fullTime, homeShort, awayShort }:
  {
    events: LiveEvent[];
    /** Aktuelle Spielminute - der bereits gespielte Teil wird eingefaerbt. */
    minute: number;
    /** Spieldauer, meist 90, nach Verlaengerung 120. */
    fullTime: number;
    homeShort: string;
    awayShort: string;
  },
) {
  // Damit die Beschriftung dem Sprachwechsel folgt.
  useLocale();
  const span = Math.max(90, fullTime);
  const x = (m: number) => 30 + (Math.min(m, span) / span) * (W - 60);

  const marks = events
    .filter((e) => MARKED[e.type] && e.side)
    .map((e, i) => ({
      key: `${e.minute}-${e.type}-${i}`,
      kind: MARKED[e.type]!,
      minute: e.minute,
      home: e.side === 'home',
      user: !!e.user,
      text: e.text,
    }));

  // Druckverlauf: Abschluesse je Fuenfzehnminutenabschnitt und Seite.
  const buckets = Math.ceil(span / 15);
  const pressure = Array.from({ length: buckets }, () => ({ home: 0, away: 0 }));
  for (const e of events) {
    if (e.type !== 'goal' && e.type !== 'miss' && e.type !== 'save' && e.type !== 'chance') continue;
    if (!e.side) continue;
    const b = Math.min(buckets - 1, Math.floor(Math.max(0, e.minute - 1) / 15));
    if (e.side === 'home') pressure[b].home++;
    else pressure[b].away++;
  }
  const peak = Math.max(1, ...pressure.map((p) => Math.max(p.home, p.away)));

  return (
    <svg viewBox={`0 0 ${W} 150`} className="timeline-svg"
      role="img" aria-label={t('ms.timeline')}>
      {/* Achse */}
      <line x1={30} y1={AXIS_Y} x2={W - 30} y2={AXIS_Y}
        stroke="var(--border)" strokeWidth="2" strokeLinecap="round" />
      <line x1={30} y1={AXIS_Y} x2={x(minute)} y2={AXIS_Y}
        stroke="var(--accent-2)" strokeWidth="2" strokeLinecap="round" opacity="0.75" />

      {/* Halbzeitmarke und Beschriftung */}
      {[0, 45, 90].filter((m) => m <= span).map((m) => (
        <g key={m}>
          <line x1={x(m)} y1={AXIS_Y - 6} x2={x(m)} y2={AXIS_Y + 6}
            stroke="var(--border)" strokeWidth="1.5" />
          <text x={x(m)} y={AXIS_Y + 20} textAnchor="middle" fontSize="10"
            fill="var(--dim)" fontFamily="system-ui, sans-serif">{m}.</text>
        </g>
      ))}

      <text x={4} y={AXIS_Y - 14} fontSize="10" fill="var(--accent)" fontWeight="700"
        fontFamily="system-ui, sans-serif">{homeShort}</text>
      <text x={4} y={AXIS_Y + 26} fontSize="10" fill="var(--accent-2)" fontWeight="700"
        fontFamily="system-ui, sans-serif">{awayShort}</text>

      {/* Marker: Heim oberhalb, Gast unterhalb der Achse */}
      {marks.map((m) => {
        const cx = x(m.minute);
        const cy = m.home ? AXIS_Y - 18 : AXIS_Y + 18;
        const colour = markColour(m.kind, m.user);
        return (
          <g key={m.key}>
            <title>{`${m.minute}. ${m.text}`}</title>
            <line x1={cx} y1={AXIS_Y} x2={cx} y2={m.home ? cy + 5 : cy - 5}
              stroke={colour} strokeWidth="1.2" opacity="0.6" />
            {m.kind === 'yellow' || m.kind === 'red' ? (
              <rect x={cx - 3.5} y={cy - 5} width={7} height={10} rx="1.5" fill={colour} />
            ) : m.kind === 'sub' ? (
              <path d={`M ${cx - 4} ${cy + 3} h 8 M ${cx + 1} ${cy} l 3 3 l -3 3`}
                stroke={colour} strokeWidth="1.6" fill="none" strokeLinecap="round" />
            ) : (
              <circle cx={cx} cy={cy} r={m.kind === 'goal' ? MARK_R : MARK_R - 2}
                fill={m.kind === 'goal' ? colour : 'none'}
                stroke={colour} strokeWidth="1.8" />
            )}
          </g>
        );
      })}

      {/* Druckverlauf */}
      <text x={4} y={96} fontSize="9" fill="var(--dim)"
        fontFamily="system-ui, sans-serif">Druck</text>
      {pressure.map((p, i) => {
        const bw = (W - 60) / buckets;
        const bx = 30 + i * bw;
        const hh = (p.home / peak) * 22;
        const ah = (p.away / peak) * 22;
        return (
          <g key={i}>
            <rect x={bx + 1} y={112 - hh} width={bw - 2} height={hh}
              fill="var(--accent)" opacity="0.75" rx="1.5" />
            <rect x={bx + 1} y={114} width={bw - 2} height={ah}
              fill="var(--accent-2)" opacity="0.75" rx="1.5" />
          </g>
        );
      })}
      <line x1={30} y1={113} x2={W - 30} y2={113}
        stroke="var(--border-soft)" strokeWidth="1" />
    </svg>
  );
}

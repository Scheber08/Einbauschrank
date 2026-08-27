/**
 * Attributprofil als Netzdiagramm.
 *
 * Die 54 Einzelwerte sagen wenig ueber den Spielertyp - fuenf Gruppenmittel
 * dagegen sofort: technisch veranlagt, koerperlich stark, defensiv geschult.
 * Die Torwartgruppe erscheint nur bei Torhuetern, sonst zoege sie das Netz
 * bei jedem Feldspieler auf null.
 */
import { useLocale } from '../i18n/useLocale';
import { ATTR_GROUPS, type AttrKey } from '../engine/attributes';
import type { Player } from '../engine/types';
import { t } from '../i18n';

const SIZE = 220;
const CX = SIZE / 2;
const CY = SIZE / 2;
const R = 78;

function groupAverage(attrs: Player['attrs'], keys: readonly AttrKey[]): number {
  if (keys.length === 0) return 0;
  let sum = 0;
  for (const k of keys) sum += attrs[k] ?? 0;
  return sum / keys.length;
}

/** Punkt auf der Achse i von n, Wert 0-100. */
function point(i: number, n: number, value: number): [number, number] {
  const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
  const r = (Math.max(4, value) / 100) * R;
  return [CX + Math.cos(angle) * r, CY + Math.sin(angle) * r];
}

export default function AttributeRadar(
  { player, compareTo, compareLabel }:
  {
    player: Player;
    /** Optionaler Vergleichswert je Gruppe, etwa der Kaderdurchschnitt. */
    compareTo?: Player;
    compareLabel?: string;
  },
) {
  // Damit die Beschriftung dem Sprachwechsel folgt.
  useLocale();
  const isKeeper = player.position === 'TW';
  const groups = ATTR_GROUPS.filter((g) => (g.key === 'goalkeeping' ? isKeeper : true));
  const n = groups.length;

  const values = groups.map((g) => groupAverage(player.attrs, g.attrs));
  const shape = values.map((v, i) => point(i, n, v).join(',')).join(' ');
  const compare = compareTo
    ? groups.map((g, i) => point(i, n, groupAverage(compareTo.attrs, g.attrs)).join(',')).join(' ')
    : null;

  return (
    <div className="radar-wrap">
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="radar"
        role="img" aria-label={t('player.attributeProfile')}>
        {/* Netzringe */}
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <polygon key={f}
            points={groups.map((_, i) => point(i, n, f * 100).join(',')).join(' ')}
            fill="none" stroke="var(--border-soft)" strokeWidth="1" />
        ))}
        {/* Achsen */}
        {groups.map((g, i) => {
          const [x, y] = point(i, n, 100);
          return <line key={g.key} x1={CX} y1={CY} x2={x} y2={y}
            stroke="var(--border-soft)" strokeWidth="1" />;
        })}

        {compare && (
          <polygon points={compare} fill="rgba(142,163,196,0.12)"
            stroke="var(--muted)" strokeWidth="1.4" strokeDasharray="4 3" />
        )}

        <polygon points={shape} fill="rgba(55,214,122,0.22)"
          stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" />

        {values.map((v, i) => {
          const [x, y] = point(i, n, v);
          return <circle key={i} cx={x} cy={y} r="3.2" fill="var(--accent)" />;
        })}

        {/* Beschriftung */}
        {groups.map((g, i) => {
          const [x, y] = point(i, n, 132);
          const anchor = Math.abs(x - CX) < 12 ? 'middle' : x > CX ? 'start' : 'end';
          return (
            <text key={g.key} x={x} y={y} textAnchor={anchor} dominantBaseline="middle"
              fontSize="10.5" fill="var(--muted)" fontFamily="system-ui, sans-serif">
              {t(g.label)}
              <tspan x={x} dy="12" fill="var(--text)" fontWeight="700">
                {Math.round(values[i])}
              </tspan>
            </text>
          );
        })}
      </svg>
      {compareLabel && (
        <div className="radar-legend tiny">
          <span><i className="swatch own" /> {player.lastName}</span>
          <span><i className="swatch other" /> {compareLabel}</span>
        </div>
      )}
    </div>
  );
}

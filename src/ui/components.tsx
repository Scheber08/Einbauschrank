/** Wiederverwendbare Bausteine der Oberflaeche. */
import type { ReactNode } from 'react';
import { ATTR_LABELS, attrTone, type AttrKey, type Attributes } from '../engine/attributes';
import type { TableRow } from '../engine/types';
import { t, tDecimal, tNumber } from '../i18n';

export function Panel(
  { title, action, children, className }:
  { title?: string; action?: ReactNode; children: ReactNode; className?: string },
) {
  return (
    <section className={`panel ${className ?? ''}`}>
      {(title || action) && (
        <div className="panel-head">
          {title ? <h3>{title}</h3> : <span />}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, tone }: { label: string; value: ReactNode; tone?: string }) {
  return (
    <div className="stat">
      <div className="value" style={tone ? { color: tone } : undefined}>{value}</div>
      <div className="label">{label}</div>
    </div>
  );
}

export function Bar({ value, max = 100, color }: { value: number; max?: number; color?: string }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="bar">
      <span style={{ width: `${pct}%`, background: color ?? barColor(pct) }} />
    </div>
  );
}

/**
 * Farbe eines Balkens nach seinem Fuellstand.
 *
 * Der Mittelbereich war ein kaltes Blau und stach aus der warmen Palette
 * heraus. Er ist jetzt ein gedecktes Kupfer - die Reihe laeuft damit
 * durchgehend von Rot ueber Bernstein zu Gruen und bleibt trotzdem in
 * fuenf Stufen unterscheidbar.
 */
export function barColor(pct: number): string {
  if (pct < 30) return '#c0483a';
  if (pct < 50) return '#cf8a24';
  if (pct < 70) return '#b8763a';
  if (pct < 88) return '#4faa63';
  return '#e0b338';
}

export function Meter({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div style={{ marginBottom: '0.55rem' }}>
      <div className="row between tiny muted" style={{ marginBottom: 3 }}>
        <span>{label}</span>
        <span className="mono">{Math.round(value)}{hint ? ` ${hint}` : ''}</span>
      </div>
      <Bar value={value} />
    </div>
  );
}

export function FormDots({ form }: { form: TableRow['form'] }) {
  return (
    <span className="form-dots">
      {form.length === 0 && <span className="dim tiny">-</span>}
      {form.map((f, i) => <i key={i} className={f}>{f}</i>)}
    </span>
  );
}

export function AttrList({ attrs, keys, compare }: {
  attrs: Attributes; keys: readonly AttrKey[]; compare?: Attributes;
}) {
  return (
    <div>
      {keys.map((key) => {
        const value = attrs[key];
        const tone = attrTone(value);
        const diff = compare ? value - compare[key] : 0;
        return (
          <div className="attr-row" key={key}>
            <span className="muted">{t(ATTR_LABELS[key])}</span>
            <span className={`v t-${tone}`}>{value}</span>
            <span className="row" style={{ gap: 4, flexWrap: 'nowrap' }}>
              <span className="attr-bar" style={{ flex: 1 }}>
                <span className={`b-${tone}`} style={{ width: `${value}%` }} />
              </span>
              {diff !== 0 && (
                <span className="tiny" style={{ color: diff > 0 ? '#7ce6a5' : '#ff9aa6', width: 20 }}>
                  {diff > 0 ? `+${diff}` : diff}
                </span>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function Pill({ children, tone }: { children: ReactNode; tone?: 'good' | 'bad' | 'warn' }) {
  return <span className={`pill ${tone ?? ''}`}>{children}</span>;
}

export function Empty({ text }: { text: string }) {
  return <p className="dim small center" style={{ padding: '1.2rem 0' }}>{text}</p>;
}

// --- Formatierung ------------------------------------------------------

/**
 * Geldbetrag in lesbarer Kurzform.
 *
 * Die Abkuerzungen standen hier fest auf Deutsch ("Mio", "Tsd") - im
 * englischen Spiel stand also ueberall, wo ein Marktwert oder eine Abloese
 * auftaucht, eine deutsche Einheit. Dasselbe galt fuer die Tausendertrennung
 * und das Dezimalkomma der Noten.
 */
export function money(value: number): string {
  if (value >= 1_000_000) {
    const zahl = tDecimal(value / 1_000_000, value >= 10_000_000 ? 0 : 1);
    return `${zahl} ${t('unit.million')}`;
  }
  if (value >= 1000) return `${tNumber(Math.round(value / 1000))} ${t('unit.thousand')}`;
  return `${tNumber(value)} ${t('unit.euro')}`;
}

export function salary(value: number): string {
  return t('unit.perWeek', { value: tNumber(value) });
}

export function rating(value: number): string {
  return tDecimal(value, 1);
}

export function ratingColor(value: number): string {
  if (value >= 8) return '#f5c542';
  if (value >= 7) return '#7ce6a5';
  if (value >= 6) return '#9fd6ff';
  if (value >= 5) return '#ffb020';
  return '#ff7a86';
}

export function initials(first: string, last: string): string {
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
}

export function shortName(first: string, last: string): string {
  return `${first.charAt(0)}. ${last}`;
}

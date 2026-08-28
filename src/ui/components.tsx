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
 * Zwei Fassungen liegen dahinter. Die erste lief von Rot ueber Bernstein
 * und Kupfer zu Gruen - weil die meisten Werte im mittleren Band liegen,
 * war damit praktisch jeder Balken orange. Die zweite ersetzte die Mitte
 * durch ein neutrales Grau-Blau: das Orange war weg, aber die Oberflaeche
 * auch farblos.
 *
 * Jetzt laeuft die Reihe ueber **fuenf kuehle Farben** - Rosé, Violett,
 * Blau, Tuerkis, Gruen. Bunt genug, dass man Stufen auf einen Blick
 * unterscheidet, und ohne einen einzigen warmen Ton.
 */
export function barColor(pct: number): string {
  if (pct < 25) return '#e2697a';
  if (pct < 45) return '#b98ae8';
  if (pct < 65) return '#5fb2e8';
  if (pct < 85) return '#45c9c0';
  return '#43d99a';
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

/**
 * Farbe einer Spielnote.
 *
 * Dieselbe Reihe wie beim Balken, damit die Oberflaeche eine Sprache
 * spricht: unter fuenf Rosé, darueber Violett, eine Sechs Blau, eine
 * starke Note Tuerkis, eine herausragende Gruen.
 */
export function ratingColor(value: number): string {
  if (value >= 8) return '#43d99a';
  if (value >= 7) return '#45c9c0';
  if (value >= 6) return '#5fb2e8';
  if (value >= 5) return '#b98ae8';
  return '#e2697a';
}

export function initials(first: string, last: string): string {
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
}

export function shortName(first: string, last: string): string {
  return `${first.charAt(0)}. ${last}`;
}

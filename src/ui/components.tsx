/** Wiederverwendbare Bausteine der Oberflaeche. */
import type { ReactNode } from 'react';
import { ATTR_LABELS, attrTone, type AttrKey, type Attributes } from '../engine/attributes';
import type { TableRow } from '../engine/types';

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

export function barColor(pct: number): string {
  if (pct < 30) return '#b8404d';
  if (pct < 50) return '#c98a1c';
  if (pct < 70) return '#3a8fd0';
  if (pct < 88) return '#2fae63';
  return '#d5a71f';
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
            <span className="muted">{ATTR_LABELS[key]}</span>
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

export function money(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)} Mio EUR`;
  if (value >= 1000) return `${Math.round(value / 1000)} Tsd EUR`;
  return `${value} EUR`;
}

export function salary(value: number): string {
  return `${value.toLocaleString('de-DE')} EUR/Woche`;
}

export function rating(value: number): string {
  return value.toFixed(1).replace('.', ',');
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

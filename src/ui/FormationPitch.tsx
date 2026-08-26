/**
 * Aufstellung als Feldgrafik (Konzept Abschnitt 57).
 *
 * Die Positionen werden nicht je Formation von Hand gesetzt, sondern aus den
 * Positionskuerzeln abgeleitet: Jede Position hat eine Reihe und eine
 * Seitenneigung, innerhalb einer Reihe wird gleichmaessig verteilt. So sieht
 * jede der sieben Formationen richtig aus, auch neu hinzugefuegte.
 */
import type { PositionCode } from '../engine/attributes';
import type { Id, Player } from '../engine/types';

/** Tiefe auf dem Feld: 0 = eigene Torlinie, 1 = gegnerisches Tor. */
const ROW: Record<PositionCode, number> = {
  TW: 0.07,
  IV: 0.23, LV: 0.26, RV: 0.26,
  DM: 0.41,
  ZM: 0.53,
  OM: 0.66,
  LA: 0.71, RA: 0.71,
  ST: 0.85,
};

/** Neigung zur Seite: -1 links, 0 zentral, +1 rechts. */
const SIDE: Record<PositionCode, number> = {
  TW: 0, IV: 0, DM: 0, ZM: 0, OM: 0, ST: 0,
  LV: -1, LA: -1,
  RV: 1, RA: 1,
};

export interface PitchSlot {
  playerId: Id;
  position: PositionCode;
}

interface Placed extends PitchSlot {
  x: number;
  y: number;
}

/** Verteilt die Startelf auf das Feld. */
function place(slots: PitchSlot[]): Placed[] {
  const byRow = new Map<number, PitchSlot[]>();
  for (const slot of slots) {
    const row = ROW[slot.position] ?? 0.5;
    // Positionen derselben Kette zusammenfassen (z. B. LV und IV).
    const key = Math.round(row * 20) / 20;
    const list = byRow.get(key);
    if (list) list.push(slot);
    else byRow.set(key, [slot]);
  }

  const out: Placed[] = [];
  for (const [row, list] of byRow) {
    const sorted = [...list].sort((a, b) => (SIDE[a.position] ?? 0) - (SIDE[b.position] ?? 0));
    const n = sorted.length;
    sorted.forEach((slot, i) => {
      // Ein einzelner Spieler steht mittig, sonst gleichmaessig verteilt.
      const x = n === 1 ? 0.5 : 0.12 + (i / (n - 1)) * 0.76;
      out.push({ ...slot, x, y: row });
    });
  }
  return out;
}

export default function FormationPitch(
  { slots, players, colors, formation, userPlayerId, label, compact }:
  {
    slots: PitchSlot[];
    players: Record<Id, Player>;
    /** Trikotfarben [primaer, sekundaer]. */
    colors: [string, string];
    formation?: string;
    userPlayerId?: Id;
    label?: string;
    compact?: boolean;
  },
) {
  const placed = place(slots);
  const W = 300;
  const H = 400;
  const [shirt, trim] = colors;
  const r = compact ? 13 : 15;

  return (
    <figure className="formation">
      {(label || formation) && (
        <figcaption className="formation-head">
          {label && <span className="formation-name">{label}</span>}
          {formation && <span className="pill">{formation}</span>}
        </figcaption>
      )}
      <svg viewBox={`0 0 ${W} ${H}`} className="formation-svg"
        role="img" aria-label={`Aufstellung ${label ?? ''} ${formation ?? ''}`}>
        {/* Rasen */}
        <rect width={W} height={H} rx="8" fill="#0f4d29" />
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <rect key={i} x={0} y={(i * H) / 8} width={W} height={H / 16}
            fill="rgba(255,255,255,0.025)" />
        ))}

        {/* Linien */}
        <g fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth="1.6">
          <rect x={10} y={10} width={W - 20} height={H - 20} rx="3" />
          <line x1={10} y1={H / 2} x2={W - 10} y2={H / 2} />
          <circle cx={W / 2} cy={H / 2} r={42} />
          <rect x={W / 2 - 62} y={H - 10 - 56} width={124} height={56} />
          <rect x={W / 2 - 30} y={H - 10 - 22} width={60} height={22} />
          <rect x={W / 2 - 62} y={10} width={124} height={56} />
          <rect x={W / 2 - 30} y={10} width={60} height={22} />
        </g>
        <circle cx={W / 2} cy={H / 2} r={2.5} fill="rgba(255,255,255,0.4)" />

        {/* Spieler */}
        {placed.map((slot) => {
          const p = players[slot.playerId];
          if (!p) return null;
          const cx = slot.x * W;
          const cy = H - slot.y * H;
          const isUser = !!userPlayerId && slot.playerId === userPlayerId;
          const name = p.lastName || p.firstName;
          return (
            <g key={slot.playerId} className={isUser ? 'pitch-player is-user' : 'pitch-player'}>
              {isUser && (
                <circle cx={cx} cy={cy} r={r + 4} fill="none"
                  stroke="var(--gold)" strokeWidth="2.5" />
              )}
              <circle cx={cx} cy={cy} r={r} fill={shirt}
                stroke="rgba(0,0,0,0.55)" strokeWidth="1.5" />
              <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central"
                fontSize={compact ? 12 : 13} fontWeight={800} fill={trim}
                stroke="rgba(0,0,0,0.35)" strokeWidth={0.6} paintOrder="stroke"
                fontFamily="system-ui, sans-serif">
                {p.shirtNumber}
              </text>
              <text x={cx} y={cy + r + 12} textAnchor="middle"
                fontSize={compact ? 10 : 11} fill="#eaf3ff" fontWeight={isUser ? 750 : 550}
                stroke="rgba(0,0,0,0.6)" strokeWidth={2.2} paintOrder="stroke"
                fontFamily="system-ui, sans-serif">
                {name.length > 12 ? `${name.slice(0, 11)}.` : name}
              </text>
            </g>
          );
        })}
      </svg>
    </figure>
  );
}

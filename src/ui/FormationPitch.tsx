/**
 * Aufstellung als Feldgrafik (Konzept Abschnitt 57).
 *
 * Die Reihen kommen aus dem Formationsnamen: "4-3-3" heisst Torwart plus drei
 * Ketten zu vier, drei und drei. Die Reihenfolge in FORMATION_SLOTS folgt
 * genau dieser Gliederung, von hinten nach vorn.
 *
 * Frueher wurde die Tiefe aus dem Positionskuerzel abgeleitet. Das kann nicht
 * funktionieren, weil dasselbe Kuerzel je nach System etwas anderes meint:
 * `LA` ist im 4-4-2 ein linker Mittelfeldspieler, im 4-3-3 ein Fluegelstuermer.
 * Ein 4-4-2 zerfiel dadurch in zwei Zweierreihen, und die beiden zentralen
 * Mittelfeldspieler landeten an den Seitenlinien.
 *
 * Laesst sich der Name nicht deuten oder passt die Spielerzahl nicht zur
 * Gliederung, greift weiterhin die Einteilung nach Kuerzeln.
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

/**
 * Wie stark zieht es eine zentrale Position in die Mitte ihrer Kette? Ein
 * einzelner Sechser zwischen zwei Achtern gehoert in die Mitte, nicht an den
 * Rand der Dreierreihe.
 */
const PULL: Partial<Record<PositionCode, number>> = { DM: 2, OM: 2 };

/** Feine Tiefenkorrektur innerhalb einer Kette, damit sie nicht wie am Lineal wirkt. */
const NUDGE: Partial<Record<PositionCode, number>> = { DM: -0.035, OM: 0.035 };

/** Torwarttiefe. Tief genug fuer den Strafraum, hoch genug fuer die Namenszeile. */
const GK_DEPTH = 0.12;
/** Vorderste und hinterste Kette der Feldspieler. */
const LINE_BACK = 0.32;
const LINE_FRONT = 0.86;

export interface PitchSlot {
  playerId: Id;
  position: PositionCode;
}

export interface Placed extends PitchSlot {
  x: number;
  y: number;
}

/**
 * Wie breit faechert eine Kette auf? Eine Viererkette nutzt die ganze Breite,
 * ein Sturmduo darf nicht an den Aussenlinien stehen.
 */
function halfWidth(n: number): number {
  return Math.min(0.38, 0.1 + n * 0.07);
}

/** Verteilt eine Kette von links nach rechts. */
function spread(n: number, i: number): number {
  if (n === 1) return 0.5;
  const half = halfWidth(n);
  return 0.5 - half + (i / (n - 1)) * half * 2;
}

/**
 * Ordnet eine Kette von links nach rechts. Aussenpositionen gehen an die
 * Raender, und innerhalb der Zentrale rutschen die zugigsten Rollen in die
 * Mitte - sonst stuende der einzige Sechser einer Dreierreihe am Rand.
 */
function orderLine(line: PitchSlot[]): PitchSlot[] {
  const links = line.filter((s) => (SIDE[s.position] ?? 0) < 0);
  const rechts = line.filter((s) => (SIDE[s.position] ?? 0) > 0);
  const mitte = line.filter((s) => (SIDE[s.position] ?? 0) === 0);

  // Von innen nach aussen fuellen: der staerkste Zug sitzt in der Mitte.
  const nachZug = [...mitte].sort((a, b) => (PULL[b.position] ?? 1) - (PULL[a.position] ?? 1));
  const angeordnet: PitchSlot[] = new Array(nachZug.length);
  const start = Math.floor((nachZug.length - 1) / 2);
  let links_ = start;
  let rechts_ = start + 1;
  nachZug.forEach((slot, i) => {
    if (i === 0) angeordnet[start] = slot;
    else if (i % 2 === 1) angeordnet[rechts_++] = slot;
    else angeordnet[--links_] = slot;
  });

  return [...links, ...angeordnet.filter(Boolean), ...rechts];
}

/**
 * Zerlegt einen Formationsnamen in Kettenstaerken. "4-2-3-1" ergibt
 * [4, 2, 3, 1]. Null, wenn der Name nicht dieser Form entspricht oder die
 * Summe nicht zu den zehn Feldspielern passt.
 */
function parseFormation(name: string | undefined, outfield: number): number[] | null {
  if (!name || !/^[0-9]+(-[0-9]+)+$/.test(name)) return null;
  const ketten = name.split('-').map(Number);
  if (ketten.some((n) => n < 1 || n > 6)) return null;
  if (ketten.reduce((a, b) => a + b, 0) !== outfield) return null;
  return ketten;
}

/**
 * Verteilt die Startelf auf das Feld. Exportiert, weil die Platzierung reine
 * Rechnung ohne React ist und der Rauchtest sie so fuer jede Formation
 * pruefen kann.
 */
export function place(slots: PitchSlot[], formation?: string): Placed[] {
  const torwart = slots.filter((s) => s.position === 'TW');
  const feld = slots.filter((s) => s.position !== 'TW');
  const ketten = parseFormation(formation, feld.length);
  const out: Placed[] = [];

  torwart.forEach((slot) => out.push({ ...slot, x: 0.5, y: GK_DEPTH }));

  if (ketten) {
    // Die Reihenfolge in FORMATION_SLOTS laeuft von hinten nach vorn.
    let gelesen = 0;
    ketten.forEach((groesse, kette) => {
      const tiefe = ketten.length === 1
        ? (LINE_BACK + LINE_FRONT) / 2
        : LINE_BACK + (kette / (ketten.length - 1)) * (LINE_FRONT - LINE_BACK);
      const linie = orderLine(feld.slice(gelesen, gelesen + groesse));
      gelesen += groesse;
      linie.forEach((slot, i) => out.push({
        ...slot,
        x: spread(linie.length, i),
        y: tiefe + (NUDGE[slot.position] ?? 0),
      }));
    });
    return out;
  }

  // Rueckfall: Einteilung nach Positionskuerzeln, wenn der Name nicht passt.
  const byRow = new Map<number, PitchSlot[]>();
  for (const slot of feld) {
    const row = ROW[slot.position] ?? 0.5;
    const key = Math.round(row * 20) / 20;
    const list = byRow.get(key);
    if (list) list.push(slot);
    else byRow.set(key, [slot]);
  }
  for (const [row, list] of byRow) {
    const linie = orderLine(list);
    linie.forEach((slot, i) => out.push({ ...slot, x: spread(linie.length, i), y: row }));
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
  const placed = place(slots, formation);
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
              {/* Die Namenszeile wird in das Feld hineingezogen, sonst laufen
                  lange Namen an den Aussenbahnen ueber den Rand hinaus. */}
              <text x={Math.max(34, Math.min(W - 34, cx))} y={cy + r + 12}
                textAnchor="middle"
                fontSize={compact ? 10 : 11} fill="#eaf3ff" fontWeight={isUser ? 750 : 550}
                stroke="rgba(0,0,0,0.6)" strokeWidth={2.2} paintOrder="stroke"
                fontFamily="system-ui, sans-serif">
                {name.length > 11 ? `${name.slice(0, 10)}.` : name}
              </text>
            </g>
          );
        })}
      </svg>
    </figure>
  );
}

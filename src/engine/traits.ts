/**
 * Spielerstaerken - die Handschrift eines Spielers.
 *
 * Ein Spieler bestand aus 54 Zahlen und sonst nichts. Zwei Stuermer mit
 * derselben Gesamtstaerke waren nicht zu unterscheiden, egal wie verschieden
 * ihre Laufbahnen verlaufen waren. Es gab nichts, worauf man nach zehn Jahren
 * zeigen konnte und sagen: *das* ist er.
 *
 * Staerken werden **nicht gewaehlt, sondern verdient**. Jede verlangt zweierlei:
 * die Anlage (ein Attributwert) und den Nachweis (etwas, das der Spieler
 * tatsaechlich getan hat). Wer Freistoesse trainiert, aber nie einen trifft,
 * bekommt den Ruf nicht - und wer drei trifft, ohne den Wert zu haben, auch
 * nicht. Deshalb sieht die Liste nach zehn Jahren bei jedem anders aus.
 *
 * Die Wirkungen sind klein. Eine Staerke soll den eigenen Spieler an einer
 * Stelle erkennbar machen, nicht die Physik aushebeln.
 */

import type { GameState, Player, SeasonStats } from './types';

export type TraitKey =
  | 'freeKickSpecialist' | 'penaltyKing' | 'headerThreat' | 'longRange'
  | 'dribbler' | 'poacher' | 'ironMan' | 'bigGameNerve' | 'versatile'
  | 'leader';

export interface TraitDef {
  key: TraitKey;
  /** Anlage: welcher Wert wie hoch sein muss. */
  anlage: (p: Player) => boolean;
  /** Nachweis: was der Spieler getan haben muss. */
  nachweis: (t: SeasonStats, state: GameState, p: Player) => boolean;
}

/**
 * Der Katalog.
 *
 * Die Schwellen sind so gewaehlt, dass eine Staerke nach ein paar guten
 * Saisons erreichbar ist, aber nicht nebenbei anfaellt. Wer alle zehn hat,
 * hat eine sehr lange und sehr gute Laufbahn hinter sich.
 */
export const TRAITS: TraitDef[] = [
  {
    key: 'freeKickSpecialist',
    anlage: (p) => p.attrs.freeKicks >= 74,
    nachweis: (t) => t.goals >= 15 && t.appearances >= 60,
  },
  {
    key: 'penaltyKing',
    anlage: (p) => p.attrs.penalties >= 76,
    // SeasonStats fuehrt keine verwandelten Elfmeter - der Nachweis laeuft
    // deshalb ueber Tore und Einsaetze.
    nachweis: (t) => t.goals >= 30 && t.appearances >= 70,
  },
  {
    key: 'headerThreat',
    anlage: (p) => p.attrs.heading >= 74 && p.attrs.jumping >= 68,
    nachweis: (t) => t.goals >= 20,
  },
  {
    key: 'longRange',
    anlage: (p) => p.attrs.longShots >= 76,
    nachweis: (t) => t.shots >= 120,
  },
  {
    key: 'dribbler',
    anlage: (p) => p.attrs.dribbling >= 78 && p.attrs.agility >= 70,
    nachweis: (t) => t.appearances >= 70,
  },
  {
    key: 'poacher',
    anlage: (p) => p.attrs.finishing >= 78 && p.attrs.anticipation >= 70,
    nachweis: (t) => t.goals >= 45,
  },
  {
    key: 'ironMan',
    anlage: (p) => p.attrs.robustness >= 72,
    // Viele Einsaetze bei wenig Ausfall - der Nachweis ist die Anwesenheit.
    nachweis: (t) => t.appearances >= 140,
  },
  {
    key: 'bigGameNerve',
    anlage: (p) => p.attrs.composure >= 76,
    nachweis: (t) => t.appearances >= 80 && t.motm >= 12,
  },
  {
    key: 'versatile',
    anlage: (p) => p.altPositions.length >= 2,
    nachweis: (t) => t.appearances >= 90,
  },
  {
    key: 'leader',
    anlage: (p) => p.attrs.leadership >= 76,
    // Die Binde steht in der Vertragsrolle, nicht am Verein.
    nachweis: (_t, _state, p) => p.contract?.role === 'Mannschaftsfuehrer',
  },
];

export function traitLabelKey(k: TraitKey): string {
  return `trait.${k}`;
}

/**
 * Prueft, welche Staerken neu dazugekommen sind.
 *
 * Gibt nur die **neuen** zurueck - so weiss der Aufrufer, worueber er
 * berichten muss, und eine einmal erworbene Staerke geht nie wieder
 * verloren. Das ist Absicht: ein Ruf haelt laenger als die Form.
 */
export function neueStaerken(
  state: GameState, player: Player, totals: SeasonStats,
): TraitKey[] {
  const schon = new Set(state.traits ?? []);
  const neu: TraitKey[] = [];
  for (const def of TRAITS) {
    if (schon.has(def.key)) continue;
    if (!def.anlage(player)) continue;
    if (!def.nachweis(totals, state, player)) continue;
    neu.push(def.key);
  }
  return neu;
}

export function hatStaerke(state: GameState, key: TraitKey): boolean {
  return (state.traits ?? []).includes(key);
}

/**
 * Wirkung der Staerken, gebuendelt fuer die Spielmaschine.
 *
 * Bewusst wenige Angriffspunkte: jede Zahl hier muss in `matchEngine`
 * tatsaechlich gelesen werden, sonst waeren die Staerken das, was in diesem
 * Spiel schon oft genug gefunden wurde - eine Anzeige ohne Wirkung.
 */
export interface TraitEffect {
  /** Freistoesse und Elfmeter. */
  setPiece: number;
  /** Kopfballchancen. */
  header: number;
  /** Fernschuesse. */
  longShot: number;
  /** Abschluss aus kurzer Distanz. */
  finish: number;
  /** Zweikaempfe und Dribblings des eigenen Spielers. */
  duel: number;
  /** Verletzungsrisiko. */
  injury: number;
  /** Druck in den eigenen Szenen. */
  pressure: number;
}

export function traitEffect(state: GameState): TraitEffect {
  const e: TraitEffect = {
    setPiece: 1, header: 1, longShot: 1, finish: 1, duel: 1, injury: 1,
    pressure: 0,
  };
  for (const k of state.traits ?? []) {
    switch (k) {
      case 'freeKickSpecialist': e.setPiece *= 1.12; break;
      case 'penaltyKing': e.setPiece *= 1.08; break;
      case 'headerThreat': e.header *= 1.15; break;
      case 'longRange': e.longShot *= 1.18; break;
      case 'dribbler': e.duel *= 1.10; break;
      case 'poacher': e.finish *= 1.12; break;
      case 'ironMan': e.injury *= 0.82; break;
      case 'bigGameNerve': e.pressure -= 0.06; break;
      // `versatile` und `leader` wirken ausserhalb der Spielmaschine:
      // die eine auf den Malus fremder Positionen, die andere auf die
      // Mannschaft. Sie stehen hier, damit die Liste vollstaendig ist.
      case 'versatile': break;
      case 'leader': break;
    }
  }
  return e;
}

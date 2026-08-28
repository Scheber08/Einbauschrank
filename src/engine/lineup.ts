/** Aufstellung und Mannschaftsstaerken (Konzept Abschnitt 28 und 29). */
import { keeperOutfield, POSITION_LINE, effectiveOverall, type PositionCode } from './attributes';
import { FORMATION_SLOTS } from './worldGen';
import { clamp } from './rng';
import { FormationKey, SQUAD_ROLE_ORDER, type Club, type Id, type Player, type TacticStyle } from './types';

export interface LineupSlot {
  playerId: Id;
  position: PositionCode;
  rating: number;
}

export interface Lineup {
  clubId: Id;
  formation: string;
  starters: LineupSlot[];
  bench: Id[];
  /** Mannschaftsstaerken fuer die Simulation. */
  attack: number;
  midfield: number;
  defence: number;
  keeper: number;
  tactic: TacticStyle;
}

export function isAvailable(p: Player): boolean {
  return !p.injury && p.suspension <= 0;
}

/** Wie gut passt ein Spieler heute auf diesen Platz? */
export function slotScore(p: Player, slot: PositionCode, coachRelation: number): number {
  const base = effectiveOverall(p.attrs, p.position, p.altPositions, slot);
  const formFactor = 0.86 + (p.form / 100) * 0.28;
  const fitFactor = 0.7 + (p.fitness / 100) * 0.3;
  const roleBonus = SQUAD_ROLE_ORDER.indexOf(p.contract?.role ?? 'Ergaenzungsspieler') * 1.4;
  const relationBonus = p.isUser ? (coachRelation - 50) * 0.12 : 0;
  // Talente werden mitgenommen: viel ungenutztes Potenzial bringt einen
  // Kaderplatz eher als einen Startelfplatz.
  const prospectBonus = Math.max(0, p.potential - base) * 0.12;
  return base * formFactor * fitFactor + roleBonus + relationBonus + prospectBonus;
}

export interface LineupOptions {
  /** Beziehung des eigenen Spielers zum Trainer, 0-100. */
  coachRelation: number;
  /** Rotation bei englischen Wochen: Spieler mit wenig Fitness bleiben draussen. */
  rotate?: boolean;
  /** Zusatzbonus fuer den eigenen Spieler aus dem Schwierigkeitsgrad. */
  userBonus?: number;
  /**
   * Grundordnung fuer diese eine Partie.
   *
   * Ohne Angabe die des Vereins. Vorher gab es nur die: ein Verein spielte
   * im August dieselbe Ordnung wie im Mai, gegen jeden.
   */
  formation?: FormationKey;
}

/**
 * Waehlt die Startelf. Der Trainer entscheidet - der eigene Spieler
 * konkurriert wie jeder andere um seinen Platz.
 */
export function selectLineup(
  club: Club, squad: Player[], opts: LineupOptions,
): Lineup {
  const aufstellung = opts.formation ?? club.formation;
  const slots = FORMATION_SLOTS[aufstellung];
  const available = squad.filter(isAvailable);
  const used = new Set<Id>();
  const starters: LineupSlot[] = [];

  // Reihenfolge: Torwart, Abwehr, Mittelfeld, Angriff.
  const order = slots
    .map((position, index) => ({ position, index }))
    .sort((a, b) => lineRank(a.position) - lineRank(b.position));

  for (const { position } of order) {
    let best: Player | null = null;
    let bestScore = -Infinity;
    for (const p of available) {
      if (used.has(p.id)) continue;
      if (position === 'TW' && p.position !== 'TW') continue;
      if (position !== 'TW' && p.position === 'TW') continue;
      let score = slotScore(p, position, opts.coachRelation);
      if (p.isUser) score += opts.userBonus ?? 0;
      if (opts.rotate && p.fitness < 72) score -= (72 - p.fitness) * 0.9;
      if (score > bestScore) { bestScore = score; best = p; }
    }
    if (best) {
      used.add(best.id);
      starters.push({ playerId: best.id, position, rating: Math.round(bestScore) });
    }
  }

  // Auf der Bank gilt ein anderer Massstab als in der Startelf: Wer heute
  // spielt, entscheidet die Tagesform - wen der Trainer mitnimmt, entscheidet
  // auch die Entwicklung. Talente sammeln so Kaderluft, ohne dass ein
  // Siebzehnjaehriger einem Stammspieler den Platz wegnimmt.
  const benchScore = (p: Player) =>
    slotScore(p, p.position, opts.coachRelation)
    + (p.isUser ? opts.userBonus ?? 0 : 0)
    + benchProspectBonus(p);
  const bench = available
    .filter((p) => !used.has(p.id))
    .sort((a, b) => benchScore(b) - benchScore(a))
    .slice(0, 9)
    .map((p) => p.id);

  const byId = new Map(squad.map((p) => [p.id, p]));
  const strengths = teamStrength(starters, byId, club.tacticStyle);

  return {
    clubId: club.id,
    formation: aufstellung,
    starters,
    bench,
    tactic: club.tacticStyle,
    ...strengths,
  };
}

/**
 * Zusatzgewicht des Entwicklungspotenzials bei der Kadernominierung.
 * Gilt fuer jeden Spieler gleich - auch fuer die Konkurrenz im eigenen Verein.
 */
function benchProspectBonus(p: Player): number {
  const base = effectiveOverall(p.attrs, p.position, p.altPositions, p.position);
  return Math.max(0, p.potential - base) * 0.22;
}

function lineRank(pos: PositionCode): number {
  const line = POSITION_LINE[pos];
  return line === 'GK' ? 0 : line === 'DEF' ? 1 : line === 'MID' ? 2 : 3;
}

/** Beitrag eines Spielers zu Angriff, Mittelfeld und Abwehr. */
const LINE_CONTRIBUTION: Record<string, [number, number, number]> = {
  GK: [0.02, 0.05, 0.25],
  DEF: [0.14, 0.34, 1.0],
  MID: [0.46, 1.0, 0.42],
  ATT: [1.0, 0.32, 0.08],
};

export function teamStrength(
  starters: LineupSlot[], byId: Map<Id, Player>, tactic: TacticStyle,
): { attack: number; midfield: number; defence: number; keeper: number } {
  let att = 0, attW = 0, mid = 0, midW = 0, def = 0, defW = 0, keeper = 50;
  let twDefence = 0, twMidfield = 0;

  for (const slot of starters) {
    const p = byId.get(slot.playerId);
    if (!p) continue;
    const rating = effectiveOverall(p.attrs, p.position, p.altPositions, slot.position)
      * (0.88 + (p.form / 100) * 0.24)
      * (0.78 + (p.fitness / 100) * 0.22);

    if (slot.position === 'TW') {
      keeper = rating;
      // Coaching organisiert die Abwehr, Abstoss und Abwurf eroeffnen das
      // Spiel. Beides stand im Attributblatt und wirkte nirgends.
      const dazu = keeperOutfield(p.attrs);
      twDefence = dazu.defence;
      twMidfield = dazu.midfield;
      continue;
    }
    const [wa, wm, wd] = LINE_CONTRIBUTION[POSITION_LINE[slot.position]];
    att += rating * wa; attW += wa;
    mid += rating * wm; midW += wm;
    def += rating * wd; defW += wd;
  }

  const result = {
    attack: attW > 0 ? att / attW : 40,
    midfield: (midW > 0 ? mid / midW : 40) + twMidfield,
    defence: (defW > 0 ? def / defW : 40) + twDefence,
    keeper,
  };

  return applyTactic(result, tactic);
}

/** Taktische Identitaet verschiebt die Gewichte (Konzept Abschnitt 28). */
function applyTactic(
  s: { attack: number; midfield: number; defence: number; keeper: number },
  tactic: TacticStyle,
) {
  const mods: Record<TacticStyle, [number, number, number]> = {
    possession: [1.02, 1.1, 0.98],
    counter: [1.06, 0.92, 1.04],
    highPress: [1.06, 1.05, 0.94],
    deepBlock: [0.9, 0.94, 1.12],
    wingPlay: [1.05, 0.99, 0.97],
    direct: [1.04, 0.95, 1.0],
    longBall: [1.0, 0.88, 1.02],
    buildUp: [0.99, 1.07, 1.01],
  };
  const [a, m, d] = mods[tactic];
  return {
    attack: clamp(s.attack * a, 10, 99),
    midfield: clamp(s.midfield * m, 10, 99),
    defence: clamp(s.defence * d, 10, 99),
    keeper: clamp(s.keeper, 10, 99),
  };
}

/** Grobe Gesamtstaerke eines Kaders - fuer Hintergrundspiele und Tabellenprognosen. */
export function quickTeamRating(squad: Player[]): number {
  const available = squad.filter(isAvailable);
  const rated = available
    .map((p) => effectiveOverall(p.attrs, p.position, p.altPositions, p.position) * (0.9 + p.form / 500))
    .sort((a, b) => b - a)
    .slice(0, 11);
  if (rated.length === 0) return 40;
  return rated.reduce((a, b) => a + b, 0) / rated.length;
}

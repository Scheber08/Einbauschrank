/**
 * Attributsystem (Konzept Abschnitt 16).
 * Alle Werte liegen zwischen 1 und 100.
 */
import { clamp } from './rng';

export const TECHNICAL_ATTRS = [
  'ballControl', 'dribbling', 'shortPass', 'longPass', 'crossing', 'finishing',
  'shotPower', 'longShots', 'volleys', 'penalties', 'freeKicks', 'curve',
  'heading', 'firstTouch', 'weakFoot',
] as const;

export const PHYSICAL_ATTRS = [
  'acceleration', 'pace', 'stamina', 'strength', 'jumping', 'agility',
  'balance', 'reactions', 'robustness',
] as const;

export const MENTAL_ATTRS = [
  'vision', 'decisions', 'concentration', 'anticipation', 'composure', 'bravery',
  'teamwork', 'leadership', 'discipline', 'ambition', 'professionalism', 'resilience',
] as const;

export const DEFENSIVE_ATTRS = [
  'defPositioning', 'tackling', 'slideTackle', 'marking', 'interception',
  'pressing', 'defHeading', 'blocking',
] as const;

export const GK_ATTRS = [
  'reflexes', 'handling', 'deflecting', 'gkPositioning', 'rushingOut',
  'oneOnOne', 'crossHandling', 'goalKicks', 'throwing', 'communication',
] as const;

export const ALL_ATTRS = [
  ...TECHNICAL_ATTRS, ...PHYSICAL_ATTRS, ...MENTAL_ATTRS, ...DEFENSIVE_ATTRS, ...GK_ATTRS,
] as const;

export type AttrKey = (typeof ALL_ATTRS)[number];
export type Attributes = Record<AttrKey, number>;

export const ATTR_LABELS: Record<AttrKey, string> = {
  ballControl: 'attr.ballControl', dribbling: 'attr.dribbling', shortPass: 'attr.shortPass',
  longPass: 'attr.longPass', crossing: 'attr.crossing', finishing: 'attr.finishing',
  shotPower: 'attr.shotPower', longShots: 'attr.longShots', volleys: 'attr.volleys',
  penalties: 'attr.penalties', freeKicks: 'attr.freeKicks', curve: 'attr.curve',
  heading: 'attr.heading', firstTouch: 'attr.firstTouch', weakFoot: 'attr.weakFoot',

  acceleration: 'attr.acceleration', pace: 'attr.pace', stamina: 'attr.stamina',
  strength: 'attr.strength', jumping: 'attr.jumping', agility: 'attr.agility',
  balance: 'attr.balance', reactions: 'attr.reactions', robustness: 'attr.robustness',

  vision: 'attr.vision', decisions: 'attr.decisions', concentration: 'attr.concentration',
  anticipation: 'attr.anticipation', composure: 'attr.composure', bravery: 'attr.bravery',
  teamwork: 'attr.teamwork', leadership: 'attr.leadership', discipline: 'attr.discipline',
  ambition: 'attr.ambition', professionalism: 'attr.professionalism', resilience: 'attr.resilience',

  defPositioning: 'attr.defPositioning', tackling: 'attr.tackling', slideTackle: 'attr.slideTackle',
  marking: 'attr.marking', interception: 'attr.interception', pressing: 'attr.pressing',
  defHeading: 'attr.defHeading', blocking: 'attr.blocking',

  reflexes: 'attr.reflexes', handling: 'attr.handling', deflecting: 'attr.deflecting',
  gkPositioning: 'attr.gkPositioning', rushingOut: 'attr.rushingOut', oneOnOne: 'attr.oneOnOne',
  crossHandling: 'attr.crossHandling', goalKicks: 'attr.goalKicks', throwing: 'attr.throwing',
  communication: 'attr.communication',
};

export const ATTR_GROUPS: { key: string; label: string; attrs: readonly AttrKey[] }[] = [
  { key: 'technical', label: 'attrGroup.technical', attrs: TECHNICAL_ATTRS },
  { key: 'physical', label: 'attrGroup.physical', attrs: PHYSICAL_ATTRS },
  { key: 'mental', label: 'attrGroup.mental', attrs: MENTAL_ATTRS },
  { key: 'defensive', label: 'attrGroup.defensive', attrs: DEFENSIVE_ATTRS },
  { key: 'goalkeeping', label: 'attrGroup.goalkeeping', attrs: GK_ATTRS },
];

// --- Positionen (Konzept Abschnitt 14.3) --------------------------------

export const POSITIONS = ['TW', 'IV', 'LV', 'RV', 'DM', 'ZM', 'OM', 'LA', 'RA', 'ST'] as const;
export type PositionCode = (typeof POSITIONS)[number];

export const POSITION_LABELS: Record<PositionCode, string> = {
  TW: 'pos.TW',
  IV: 'pos.IV',
  LV: 'pos.LV',
  RV: 'pos.RV',
  DM: 'pos.DM',
  ZM: 'pos.ZM',
  OM: 'pos.OM',
  LA: 'pos.LA',
  RA: 'pos.RA',
  ST: 'pos.ST',
};

/** Grobe Zuordnung fuer Simulation und Aufstellung. */
export type PositionLine = 'GK' | 'DEF' | 'MID' | 'ATT';

export const POSITION_LINE: Record<PositionCode, PositionLine> = {
  TW: 'GK', IV: 'DEF', LV: 'DEF', RV: 'DEF',
  DM: 'MID', ZM: 'MID', OM: 'MID',
  LA: 'ATT', RA: 'ATT', ST: 'ATT',
};

/** Verwandte Positionen - dort spielt ein Spieler ohne grossen Malus. */
export const POSITION_NEIGHBOURS: Record<PositionCode, PositionCode[]> = {
  TW: [],
  IV: ['LV', 'RV', 'DM'],
  LV: ['IV', 'LA', 'RV'],
  RV: ['IV', 'RA', 'LV'],
  DM: ['ZM', 'IV'],
  ZM: ['DM', 'OM'],
  OM: ['ZM', 'LA', 'RA', 'ST'],
  LA: ['RA', 'OM', 'LV'],
  RA: ['LA', 'OM', 'RV'],
  ST: ['OM', 'LA', 'RA'],
};

type Weights = Partial<Record<AttrKey, number>>;

/**
 * Gewichtung der Attribute je Position. Daraus wird die Gesamtstaerke berechnet.
 * Die Gewichte muessen nicht normiert sein.
 */
export const POSITION_WEIGHTS: Record<PositionCode, Weights> = {
  TW: {
    reflexes: 10, handling: 8, deflecting: 7, gkPositioning: 9, rushingOut: 5,
    oneOnOne: 7, crossHandling: 6, goalKicks: 3, throwing: 3, communication: 4,
    reactions: 7, agility: 5, jumping: 4, concentration: 6, composure: 5, bravery: 3,
  },
  IV: {
    defPositioning: 10, marking: 9, tackling: 9, slideTackle: 4, defHeading: 8, blocking: 6,
    interception: 7, strength: 7, jumping: 6, anticipation: 7, concentration: 6,
    decisions: 5, composure: 4, pace: 4, acceleration: 3, shortPass: 4, longPass: 3,
    ballControl: 3, leadership: 3, bravery: 4, reactions: 4,
  },
  LV: {
    defPositioning: 7, marking: 7, tackling: 7, slideTackle: 4, interception: 6, pressing: 5,
    pace: 8, acceleration: 7, stamina: 8, crossing: 7, shortPass: 5, ballControl: 5,
    dribbling: 4, teamwork: 5, anticipation: 5, decisions: 4, agility: 4, balance: 3,
  },
  RV: {
    defPositioning: 7, marking: 7, tackling: 7, slideTackle: 4, interception: 6, pressing: 5,
    pace: 8, acceleration: 7, stamina: 8, crossing: 7, shortPass: 5, ballControl: 5,
    dribbling: 4, teamwork: 5, anticipation: 5, decisions: 4, agility: 4, balance: 3,
  },
  DM: {
    defPositioning: 8, interception: 8, tackling: 8, slideTackle: 3, marking: 6, pressing: 6,
    shortPass: 8, longPass: 6, ballControl: 6, firstTouch: 5, vision: 5,
    decisions: 7, concentration: 6, teamwork: 7, stamina: 7, strength: 5,
    anticipation: 6, composure: 5,
  },
  ZM: {
    shortPass: 10, longPass: 7, ballControl: 8, firstTouch: 7, vision: 8,
    decisions: 8, teamwork: 7, stamina: 8, dribbling: 5, longShots: 4,
    interception: 5, tackling: 5, defPositioning: 4, composure: 6, agility: 4,
    anticipation: 5, concentration: 5,
  },
  OM: {
    shortPass: 8, ballControl: 9, firstTouch: 8, vision: 9, dribbling: 8,
    finishing: 6, longShots: 6, curve: 5, freeKicks: 4, decisions: 7,
    composure: 6, agility: 7, balance: 6, acceleration: 6, teamwork: 4,
    anticipation: 5, crossing: 4,
  },
  LA: {
    dribbling: 10, pace: 9, acceleration: 9, ballControl: 8, firstTouch: 6,
    crossing: 7, finishing: 6, curve: 5, agility: 8, balance: 7,
    shortPass: 5, vision: 5, stamina: 6, decisions: 4, longShots: 4, pressing: 3,
  },
  RA: {
    dribbling: 10, pace: 9, acceleration: 9, ballControl: 8, firstTouch: 6,
    crossing: 7, finishing: 6, curve: 5, agility: 8, balance: 7,
    shortPass: 5, vision: 5, stamina: 6, decisions: 4, longShots: 4, pressing: 3,
  },
  ST: {
    finishing: 12, shotPower: 7, heading: 7, firstTouch: 8, ballControl: 7,
    composure: 8, anticipation: 8, acceleration: 7, pace: 7, strength: 6,
    jumping: 5, volleys: 4, longShots: 4, dribbling: 5, decisions: 5,
    reactions: 6, shortPass: 4, penalties: 3,
  },
};

/** Gesamtstaerke eines Spielers auf einer bestimmten Position (1-100). */
export function computeOverall(attrs: Attributes, position: PositionCode): number {
  const weights = POSITION_WEIGHTS[position];
  let sum = 0;
  let total = 0;
  for (const key in weights) {
    const w = weights[key as AttrKey]!;
    sum += attrs[key as AttrKey] * w;
    total += w;
  }
  return clamp(Math.round(sum / total), 1, 100);
}

/**
 * Effektive Staerke, wenn ein Spieler ausserhalb seiner Hauptposition spielt.
 * Nebenpositionen kosten wenig, fremde Positionen deutlich mehr.
 */
export function effectiveOverall(
  attrs: Attributes,
  naturalPos: PositionCode,
  altPositions: PositionCode[],
  playedAt: PositionCode,
): number {
  const base = computeOverall(attrs, playedAt);
  if (playedAt === naturalPos) return base;
  if (altPositions.includes(playedAt)) return Math.round(base * 0.96);
  if (POSITION_NEIGHBOURS[naturalPos].includes(playedAt)) return Math.round(base * 0.9);
  if (playedAt === 'TW' || naturalPos === 'TW') return Math.round(base * 0.45);
  return Math.round(base * 0.78);
}

/** Kurzfarbe fuer Attributwerte in der Oberflaeche. */
export function attrTone(value: number): 'poor' | 'ok' | 'good' | 'great' | 'elite' {
  if (value < 40) return 'poor';
  if (value < 58) return 'ok';
  if (value < 72) return 'good';
  if (value < 85) return 'great';
  return 'elite';
}

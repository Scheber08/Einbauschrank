/**
 * Training, Entwicklung, Form und Verletzungen
 * (Konzept Abschnitt 17, 19, 37 und 38).
 */
import {
  ATTR_LABELS, POSITION_WEIGHTS, computeOverall, type AttrKey, type PositionCode,
} from './attributes';
import { ageOn, type GameDate } from './date';
import { Rng, clamp } from './rng';
import type {
  DifficultySettings, Injury, Player, TrainingFocus, TrainingIntensity,
} from './types';

// --- Trainingsarten ----------------------------------------------------

export const TRAINING_LABELS: Record<TrainingFocus, string> = {
  ballControl: 'Ballkontrolle',
  dribbling: 'Dribbling',
  passing: 'Passspiel',
  crossing: 'Flanken',
  shooting: 'Schusstraining',
  freeKicks: 'Freistoesse',
  penalties: 'Elfmeter',
  pace: 'Schnelligkeit',
  strength: 'Kraft',
  stamina: 'Ausdauer',
  agility: 'Beweglichkeit',
  tactics: 'Taktik',
  defending: 'Defensivverhalten',
  heading: 'Kopfball',
  goalkeeping: 'Torwarttraining',
  mental: 'Mentales Training',
  recovery: 'Regeneration',
};

/** Welche Attribute eine Trainingsart verbessert und wie stark. */
export const TRAINING_EFFECTS: Record<TrainingFocus, Partial<Record<AttrKey, number>>> = {
  ballControl: { ballControl: 1, firstTouch: 0.8, dribbling: 0.35 },
  dribbling: { dribbling: 1, agility: 0.5, balance: 0.45, ballControl: 0.35 },
  passing: { shortPass: 1, longPass: 0.7, vision: 0.5, decisions: 0.25 },
  crossing: { crossing: 1, curve: 0.6, longPass: 0.4 },
  shooting: { finishing: 1, shotPower: 0.7, longShots: 0.5, volleys: 0.3 },
  freeKicks: { freeKicks: 1, curve: 0.7, shotPower: 0.3, penalties: 0.2 },
  penalties: { penalties: 1, composure: 0.5, finishing: 0.25 },
  pace: { acceleration: 1, pace: 0.9, agility: 0.3 },
  strength: { strength: 1, jumping: 0.55, robustness: 0.5, balance: 0.3 },
  stamina: { stamina: 1, robustness: 0.4, resilience: 0.3 },
  agility: { agility: 1, balance: 0.7, reactions: 0.5 },
  tactics: { defPositioning: 0.7, decisions: 0.9, teamwork: 0.7, anticipation: 0.6, concentration: 0.4 },
  defending: { tackling: 1, marking: 0.8, interception: 0.7, slideTackle: 0.6, pressing: 0.5, blocking: 0.4, defHeading: 0.4 },
  heading: { heading: 1, defHeading: 0.7, jumping: 0.6 },
  goalkeeping: { reflexes: 1, handling: 0.8, gkPositioning: 0.7, deflecting: 0.6, oneOnOne: 0.5, crossHandling: 0.45, rushingOut: 0.4 },
  mental: { composure: 0.8, concentration: 0.9, decisions: 0.7, resilience: 0.6, professionalism: 0.5, leadership: 0.3 },
  recovery: {},
};

export const INTENSITY_FACTORS: Record<TrainingIntensity, {
  gain: number; fatigue: number; injury: number; morale: number;
}> = {
  'leicht': { gain: 0.55, fatigue: 0.4, injury: 0.5, morale: 0.2 },
  'normal': { gain: 1.0, fatigue: 1.0, injury: 1.0, morale: 0 },
  'intensiv': { gain: 1.45, fatigue: 1.7, injury: 1.7, morale: -0.3 },
  'sehr intensiv': { gain: 1.85, fatigue: 2.4, injury: 2.6, morale: -0.8 },
};

// --- Entwicklung -------------------------------------------------------

export interface TrainingOutcome {
  gains: { attr: AttrKey; label: string; amount: number }[];
  fatigue: number;
  injured: Injury | null;
  overallBefore: number;
  overallAfter: number;
}

/**
 * Grundlagenprogramm des Vereins: die fuer die Position wichtigsten Attribute
 * werden unabhaengig vom gewaehlten Schwerpunkt mittrainiert. Ohne das wuerde
 * ein einzelner Schwerpunkt die Gesamtstaerke kaum bewegen.
 */
function positionProgramme(position: PositionCode): Partial<Record<AttrKey, number>> {
  const weights = POSITION_WEIGHTS[position];
  const max = Math.max(...(Object.values(weights) as number[]));
  const result: Partial<Record<AttrKey, number>> = {};
  for (const key in weights) {
    result[key as AttrKey] = weights[key as AttrKey]! / max;
  }
  return result;
}

/**
 * Eine Trainingswoche des eigenen Spielers.
 * Die Entwicklung haengt von Alter, Potenzial, Trainingsqualitaet,
 * Einsatzzeiten und Professionalitaet ab (Konzept Abschnitt 17).
 */
export function applyTraining(
  rng: Rng, player: Player, focus: TrainingFocus, intensity: TrainingIntensity,
  clubTraining: number, currentDate: GameDate, difficulty: DifficultySettings,
  matchSharpness: number, individualGoal: TrainingFocus | null = null,
): TrainingOutcome {
  const before = computeOverall(player.attrs, player.position);
  const age = ageOn(player.birthDate, currentDate);
  const factors = INTENSITY_FACTORS[intensity];

  const room = Math.max(0, player.potential - before);
  // Junge Spieler mit viel Luft nach oben entwickeln sich am schnellsten.
  let rate = player.growth * difficulty.growthFactor;
  rate *= clamp(room / 12, 0.05, 1.6);
  rate *= age <= 20 ? 1.5 : age <= 23 ? 1.25 : age <= 26 ? 1.0 : age <= 29 ? 0.65 : 0.3;
  rate *= 0.55 + clubTraining / 130;
  rate *= 0.6 + player.attrs.professionalism / 200;
  rate *= 0.65 + (matchSharpness / 100) * 0.55;
  rate *= 0.7 + (player.morale / 100) * 0.45;
  rate *= factors.gain;

  const gains: TrainingOutcome['gains'] = [];

  // Wochenschwerpunkt, individuelles Langzeitziel und Grundlagenprogramm
  // fliessen zusammen, damit sich die Gesamtstaerke spuerbar entwickelt.
  const effects: Partial<Record<AttrKey, number>> = {};
  const merge = (map: Partial<Record<AttrKey, number>>, scale: number) => {
    for (const key in map) {
      const attr = key as AttrKey;
      effects[attr] = (effects[attr] ?? 0) + map[attr]! * scale;
    }
  };
  merge(TRAINING_EFFECTS[focus], 1);
  if (individualGoal && individualGoal !== focus) {
    merge(TRAINING_EFFECTS[individualGoal], 0.45);
  }
  if (focus !== 'recovery') merge(positionProgramme(player.position), 0.3);

  for (const key in effects) {
    const attr = key as AttrKey;
    const weight = effects[attr]!;
    const current = player.attrs[attr];
    // Hohe Werte wachsen langsamer.
    const ceiling = clamp((player.potential + 8 - current) / 22, 0.05, 1.4);
    const amountRaw = rate * weight * ceiling * rng.float(0.35, 1.35) * 0.9;
    const amount = amountRaw > rng.next() ? Math.max(1, Math.round(amountRaw)) : 0;
    if (amount > 0 && current < 99) {
      player.attrs[attr] = clamp(current + amount, 1, 99);
      gains.push({ attr, label: ATTR_LABELS[attr], amount });
    }
  }

  // Alterung: ab 30 lassen koerperliche Werte nach.
  if (age >= 30 && rng.chance(0.35)) {
    const decayable: AttrKey[] = ['acceleration', 'pace', 'stamina', 'agility', 'jumping', 'balance'];
    const attr = rng.pick(decayable);
    const loss = age >= 34 ? rng.int(1, 2) : 1;
    player.attrs[attr] = clamp(player.attrs[attr] - loss, 1, 99);
  }

  // Ermuedung und Verletzungsrisiko
  const fatigue = (2.4 + rng.float(0, 2.2)) * factors.fatigue
    * (1.25 - player.attrs.stamina / 250);
  player.fitness = clamp(player.fitness - fatigue + (focus === 'recovery' ? 12 : 0), 5, 100);
  player.morale = clamp(player.morale + factors.morale + rng.float(-0.5, 0.5), 0, 100);

  let injured: Injury | null = null;
  const injuryRisk = 0.011 * factors.injury * difficulty.injuryFactor
    * (0.5 + player.injuryProneness / 90)
    * (1.5 - player.fitness / 140);
  if (rng.chance(injuryRisk)) {
    injured = rollInjury(rng, player, 'Training');
  }

  gains.sort((a, b) => b.amount - a.amount || a.label.localeCompare(b.label));
  const after = computeOverall(player.attrs, player.position);
  return { gains, fatigue, injured, overallBefore: before, overallAfter: after };
}

/** Entwicklung der computergesteuerten Spieler - einmal pro Saison. */
export function developAiPlayer(rng: Rng, player: Player, currentDate: GameDate, clubTraining: number) {
  const age = ageOn(player.birthDate, currentDate);
  const current = computeOverall(player.attrs, player.position);
  const room = player.potential - current;

  let delta: number;
  if (age <= 21) delta = rng.float(0.5, 4.2) * player.growth * clamp(room / 10, 0.1, 1.5);
  else if (age <= 25) delta = rng.float(0.2, 2.8) * player.growth * clamp(room / 12, 0.05, 1.3);
  else if (age <= 28) delta = rng.float(-0.3, 1.4) * clamp(room / 14, 0.05, 1);
  else if (age <= 31) delta = rng.float(-1.6, 0.6);
  else if (age <= 34) delta = rng.float(-3.2, -0.2);
  else delta = rng.float(-5, -1);

  delta *= 0.7 + clubTraining / 160;

  const rounded = Math.round(delta);
  if (rounded === 0) return;

  const keys = Object.keys(player.attrs) as AttrKey[];
  const relevant = keys.filter((k) => player.attrs[k] > 12);
  for (const k of rng.sample(relevant, Math.min(relevant.length, 14))) {
    player.attrs[k] = clamp(player.attrs[k] + rounded + rng.int(-1, 1), 1, 99);
  }

  // Potenzial kann sich leicht verschieben (Konzept Abschnitt 17).
  if (age <= 22 && rng.chance(0.2)) {
    player.potential = clamp(player.potential + rng.int(-3, 4), current, 97);
  }
}

// --- Verletzungen (Konzept Abschnitt 37) -------------------------------

interface InjuryDef {
  name: string;
  minDays: number;
  maxDays: number;
  severity: Injury['severity'];
  weight: number;
  permanent?: Partial<Record<AttrKey, number>>;
}

const INJURY_TABLE: InjuryDef[] = [
  { name: 'Prellung', minDays: 3, maxDays: 8, severity: 'leicht', weight: 26 },
  { name: 'Zerrung', minDays: 7, maxDays: 18, severity: 'leicht', weight: 22 },
  { name: 'Baenderdehnung', minDays: 14, maxDays: 32, severity: 'mittel', weight: 14 },
  { name: 'Muskelfaserriss', minDays: 21, maxDays: 45, severity: 'mittel', weight: 12 },
  { name: 'Knoechelverletzung', minDays: 18, maxDays: 55, severity: 'mittel', weight: 9 },
  { name: 'Schulterverletzung', minDays: 20, maxDays: 60, severity: 'mittel', weight: 5 },
  { name: 'Gehirnerschuetterung', minDays: 10, maxDays: 24, severity: 'mittel', weight: 4 },
  {
    name: 'Knochenbruch', minDays: 60, maxDays: 120, severity: 'schwer', weight: 4,
    permanent: { robustness: 2 },
  },
  {
    name: 'Kreuzbandriss', minDays: 180, maxDays: 280, severity: 'schwer', weight: 2,
    permanent: { acceleration: 3, pace: 3, agility: 2 },
  },
];

export function rollInjury(rng: Rng, player: Player, _context: string): Injury {
  const def = rng.weighted(INJURY_TABLE, (d) => d.weight);
  const days = rng.int(def.minDays, def.maxDays);
  const injury: Injury = {
    name: def.name,
    daysOut: days,
    totalDays: days,
    severity: def.severity,
    permanentLoss: def.permanent,
  };
  player.injury = injury;
  player.fitness = clamp(player.fitness - 12, 5, 100);
  player.morale = clamp(player.morale - (def.severity === 'schwer' ? 22 : 8), 0, 100);
  return injury;
}

/** Wendet dauerhafte Attributverluste einer schweren Verletzung an. */
export function applyPermanentDamage(player: Player, injury: Injury) {
  if (!injury.permanentLoss) return;
  for (const key in injury.permanentLoss) {
    const attr = key as AttrKey;
    player.attrs[attr] = clamp(player.attrs[attr] - injury.permanentLoss[attr]!, 1, 99);
  }
}

/** Taegliche Fortschreibung: Heilung, Regeneration, Formentwicklung. */
export function advancePlayerDay(rng: Rng, player: Player, hadMatch: boolean) {
  if (player.injury) {
    player.injury.daysOut--;
    if (player.injury.daysOut <= 0) {
      applyPermanentDamage(player, player.injury);
      player.injury = null;
      player.fitness = clamp(player.fitness, 55, 78);
      player.sharpness = clamp(player.sharpness - 18, 10, 100);
      player.morale = clamp(player.morale + 8, 0, 100);
    }
    return;
  }

  if (!hadMatch) {
    const recovery = 3.2 + player.attrs.stamina / 40 + player.attrs.robustness / 60;
    player.fitness = clamp(player.fitness + recovery * rng.float(0.7, 1.2), 5, 100);
  }
  // Spielpraxis geht ohne Einsaetze langsam zurueck.
  player.sharpness = clamp(player.sharpness - 0.35, 0, 100);
}

/** Form und Selbstvertrauen nach einem Einsatz (Konzept Abschnitt 38). */
export function updateFormAfterMatch(
  player: Player, rating: number, minutes: number, won: boolean, drew: boolean,
) {
  const weight = clamp(minutes / 90, 0.2, 1);
  const delta = (rating - 6.6) * 9 * weight;
  player.form = clamp(player.form + delta * 0.5 + (won ? 2 : drew ? 0 : -1.5), 5, 100);
  player.confidence = clamp(player.confidence + delta * 0.42 + (won ? 1.5 : drew ? 0 : -1.2), 5, 100);
  player.morale = clamp(player.morale + (won ? 3.5 : drew ? 0.5 : -3) + (rating - 6.5) * 1.6, 0, 100);
  player.sharpness = clamp(player.sharpness + weight * 12, 0, 100);
}

/** Form driftet ohne Einsaetze zur Mitte zurueck. */
export function driftForm(player: Player) {
  player.form += (50 - player.form) * 0.04;
  player.confidence += (55 - player.confidence) * 0.03;
  player.morale += (55 - player.morale) * 0.02;
}

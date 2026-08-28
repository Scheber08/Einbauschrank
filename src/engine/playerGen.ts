/** Spielergenerierung: Attribute, Potenzial, Marktwert, Vertraege. */
import {
  ALL_ATTRS, GK_ATTRS, POSITION_WEIGHTS, POSITION_NEIGHBOURS, computeOverall,
  type AttrKey, type Attributes, type PositionCode,
} from './attributes';
import { COUNTRY_BY_ID, type CountryDef } from './countries';
import { addDays, ageOn, makeDate, type GameDate } from './date';
import { NAME_POOLS } from './names';
import { NATION_BY_ID, namePoolOf } from './nations';
import { Rng, clamp } from './rng';
import type { Contract, Player, SquadRole } from './types';

const GK_SET = new Set<string>(GK_ATTRS);

/** Attribute, die mit dem Alter reifen bzw. nachlassen. */
const PHYSICAL_DECAY: AttrKey[] = ['acceleration', 'pace', 'agility', 'stamina', 'jumping', 'balance'];
const MENTAL_GROWTH: AttrKey[] = [
  'decisions', 'concentration', 'anticipation', 'composure', 'leadership',
  'professionalism', 'teamwork', 'defPositioning', 'vision',
];

export interface PlayerGenOptions {
  /** Schon vergebene Vollnamen - verhindert zwei gleiche Spieler in einer Welt. */
  vergebeneNamen?: Set<string>;
  ability: number;
  position: PositionCode;
  age: number;
  countryId: string;
  currentDate: GameDate;
  clubId: string | null;
  leagueLevel: number;
  potentialBoost?: number;
  shirtNumber?: number;
}

/**
 * Erzeugt einen Attributsatz, dessen Gesamtstaerke moeglichst genau
 * dem Zielwert entspricht.
 */
export function generateAttributes(
  rng: Rng, target: number, position: PositionCode, country: CountryDef, age: number,
): Attributes {
  const weights = POSITION_WEIGHTS[position];
  const maxWeight = Math.max(...Object.values(weights) as number[]);
  const isKeeper = position === 'TW';

  const attrs = {} as Attributes;

  for (const key of ALL_ATTRS) {
    const w = weights[key] ?? 0;
    let base: number;

    if (w > 0) {
      // Schluesselattribute liegen ueber, Randattribute unter dem Zielwert.
      base = target + (w / maxWeight - 0.55) * 16;
    } else if (GK_SET.has(key)) {
      base = isKeeper ? target * 0.75 : rng.float(4, 16);
    } else if (isKeeper) {
      base = target * 0.45 + rng.float(-6, 6);
    } else {
      base = target * 0.68 + rng.float(-8, 8);
    }

    base += rng.normal(0, 6.5);
    base += (country.attrBias[key] ?? 0) * rng.float(0.4, 1.2);

    // Alterskurve: Koerper reift frueh, Kopf spaet.
    if (PHYSICAL_DECAY.includes(key)) {
      if (age < 20) base -= (20 - age) * 1.4;
      if (age > 29) base -= (age - 29) * 2.1;
    }
    if (MENTAL_GROWTH.includes(key)) {
      base -= Math.max(0, 26 - age) * 1.1;
      if (age > 30) base += 2;
    }
    if (key === 'stamina' && age > 31) base -= (age - 31) * 1.5;
    if (key === 'weakFoot') base = rng.float(20, 85);

    attrs[key] = clamp(Math.round(base), 3, 99);
  }

  // Feinabgleich, damit die Gesamtstaerke den Zielwert trifft.
  for (let pass = 0; pass < 6; pass++) {
    const diff = target - computeOverall(attrs, position);
    if (Math.abs(diff) < 1) break;
    for (const key in weights) {
      const k = key as AttrKey;
      attrs[k] = clamp(Math.round(attrs[k] + diff * 0.85), 3, 99);
    }
  }

  return attrs;
}

function pickAltPositions(rng: Rng, position: PositionCode): PositionCode[] {
  if (position === 'TW') return [];
  const pool = POSITION_NEIGHBOURS[position];
  const count = rng.chance(0.45) ? (rng.chance(0.3) ? 2 : 1) : 0;
  return rng.sample(pool, Math.min(count, pool.length));
}

function pickFoot(rng: Rng, position: PositionCode): 'links' | 'rechts' {
  const leftBias = position === 'LV' || position === 'LA' ? 0.62 : position === 'RV' || position === 'RA' ? 0.1 : 0.22;
  return rng.chance(leftBias) ? 'links' : 'rechts';
}

function physique(rng: Rng, position: PositionCode): { height: number; weight: number } {
  let height: number;
  switch (position) {
    case 'TW': height = rng.int(186, 199); break;
    case 'IV': height = rng.int(183, 196); break;
    case 'ST': height = rng.int(175, 194); break;
    case 'LA': case 'RA': case 'OM': height = rng.int(168, 183); break;
    default: height = rng.int(172, 188);
  }
  const bmi = rng.float(22.2, 24.4);
  return { height, weight: Math.round((bmi * height * height) / 10000) };
}

/**
 * Zieht einen Namen, der noch nicht vergeben ist.
 *
 * Groessere Namenstoepfe allein reichen nicht: Bei 1.500 Spielern je Topf
 * treffen sich zwei Ziehungen nach dem Geburtstagsparadoxon trotzdem
 * regelmaessig. Gemessen nach der Poolvergroesserung: 8 Prozent doppelte
 * Vollnamen, und **jede** der 15 Ligen enthielt mindestens einen.
 *
 * Nach ein paar Versuchen wird aufgegeben - eine Dopplung ist besser als
 * eine Endlosschleife, falls ein Topf einmal wirklich erschoepft ist.
 */
function ziehName(
  rng: Rng, pool: { firstNames: string[]; lastNames: string[] },
  vergeben?: Set<string>,
): { firstName: string; lastName: string } {
  for (let versuch = 0; versuch < 8; versuch++) {
    const firstName = rng.pick(pool.firstNames);
    const lastName = rng.pick(pool.lastNames);
    const voll = `${firstName} ${lastName}`;
    if (!vergeben || !vergeben.has(voll)) {
      vergeben?.add(voll);
      return { firstName, lastName };
    }
  }
  return { firstName: rng.pick(pool.firstNames), lastName: rng.pick(pool.lastNames) };
}

export function createPlayer(rng: Rng, id: string, opts: PlayerGenOptions): Player {
  // countryId ist die Herkunftsnation. Namen und Laender-Eigenheiten haengen
  // am zugeordneten Pool - so bekommt ein Brasilianer iberische Namen, ohne
  // dass es fuer jede Nation ein eigenes Ligasystem braucht.
  const poolId = namePoolOf(opts.countryId);
  const country = COUNTRY_BY_ID[poolId];
  const pool = NAME_POOLS[poolId] ?? NAME_POOLS.falkenland;
  const ability = clamp(Math.round(opts.ability), 12, 96);

  const attrs = generateAttributes(rng, ability, opts.position, country, opts.age);

  // Leichte nationale Neigung obendrauf, falls fuer die Nation hinterlegt.
  const bias = NATION_BY_ID[opts.countryId]?.bias;
  if (bias) {
    for (const [key, delta] of Object.entries(bias)) {
      const k = key as AttrKey;
      attrs[k] = clamp(Math.round(attrs[k] + delta * rng.float(0.3, 1)), 1, 99);
    }
  }

  // Potenzial: junge Spieler haben deutlich mehr Luft nach oben.
  const youthRoom = Math.max(0, 25 - opts.age);
  const potentialGain = youthRoom * rng.float(0.6, 2.3) + rng.float(0, 6) + (opts.potentialBoost ?? 0);
  const potential = clamp(Math.round(ability + potentialGain), ability, 97);

  const birthYear = Number(opts.currentDate.slice(0, 4)) - opts.age;
  const birthDate = addDays(makeDate(birthYear, rng.int(1, 12), rng.int(1, 28)), 0);
  const realAge = ageOn(birthDate, opts.currentDate);

  const { height, weight } = physique(rng, opts.position);
  const marketValue = calcMarketValue(ability, potential, realAge, opts.position, opts.leagueLevel);

  return {
    id,
    clubId: opts.clubId,
    ...ziehName(rng, pool, opts.vergebeneNamen),
    nationality: opts.countryId,
    birthDate,
    position: opts.position,
    altPositions: pickAltPositions(rng, opts.position),
    foot: pickFoot(rng, opts.position),
    height,
    weight,
    shirtNumber: opts.shirtNumber ?? rng.int(2, 39),
    attrs,
    potential,
    growth: rng.float(0.65, 1.4),
    form: rng.int(42, 62),
    morale: rng.int(55, 80),
    fitness: rng.int(88, 100),
    sharpness: rng.int(55, 85),
    confidence: rng.int(45, 70),
    injury: null,
    injuryProneness: clamp(Math.round(rng.normal(35, 18)), 5, 92),
    reputation: clamp(Math.round(ability * 0.75 + (3 - opts.leagueLevel) * 7 + rng.normal(0, 6)), 1, 99),
    marketValue,
    contract: null,
    isUser: false,
    suspension: 0,
    yellowCardsInLeague: 0,
  };
}

/** Marktwert in Euro (Konzept Abschnitt 36). */
export function calcMarketValue(
  ability: number, potential: number, age: number, position: PositionCode, leagueLevel: number,
): number {
  let value = 2600 * Math.exp(ability * 0.1155);

  // Alterskurve
  let ageFactor: number;
  if (age <= 18) ageFactor = 1.25;
  else if (age <= 23) ageFactor = 1.35;
  else if (age <= 27) ageFactor = 1.15;
  else if (age <= 30) ageFactor = 0.85;
  else if (age <= 33) ageFactor = 0.5;
  else ageFactor = 0.22;
  value *= ageFactor;

  // Ungenutztes Potenzial bei jungen Spielern
  if (age < 25) value *= 1 + Math.max(0, potential - ability) * 0.028;

  // Offensivspieler sind teurer
  if (position === 'ST') value *= 1.2;
  else if (position === 'LA' || position === 'RA' || position === 'OM') value *= 1.12;
  else if (position === 'TW') value *= 0.78;

  value *= leagueLevel === 1 ? 1 : leagueLevel === 2 ? 0.6 : 0.35;

  return Math.max(15000, Math.round(value / 5000) * 5000);
}

/** Wochengehalt passend zu Staerke, Liga und Vereinsreputation. */
export function calcSalary(
  ability: number, age: number, leagueLevel: number, clubReputation: number, wealth: number,
): number {
  const levelBase = leagueLevel === 1 ? 1 : leagueLevel === 2 ? 0.32 : 0.12;
  let salary = 120 * Math.exp(ability * 0.0755) * levelBase * wealth;
  salary *= 0.65 + clubReputation / 130;
  if (age < 20) salary *= 0.5;
  else if (age < 23) salary *= 0.78;
  else if (age > 33) salary *= 0.85;
  return Math.max(250, Math.round(salary / 50) * 50);
}

export function makeContract(
  rng: Rng, player: Player, clubId: string, currentDate: GameDate,
  leagueLevel: number, clubReputation: number, wealth: number, role: SquadRole,
): Contract {
  const ability = computeOverall(player.attrs, player.position);
  const age = ageOn(player.birthDate, currentDate);
  const salary = calcSalary(ability, age, leagueLevel, clubReputation, wealth);
  const years = rng.int(1, 4);
  const endYear = Number(currentDate.slice(0, 4)) + years;
  return {
    clubId,
    salary,
    until: makeDate(endYear, 6, 30),
    role,
    goalBonus: Math.round(salary * rng.float(0.15, 0.4)),
    appearanceBonus: Math.round(salary * rng.float(0.05, 0.15)),
  };
}

/** Positionsverteilung eines vollstaendigen Kaders. */
export const SQUAD_TEMPLATE: PositionCode[] = [
  'TW', 'TW', 'TW',
  'IV', 'IV', 'IV', 'IV',
  'LV', 'LV', 'RV', 'RV',
  'DM', 'DM', 'ZM', 'ZM', 'ZM',
  'OM', 'OM',
  'LA', 'LA', 'RA', 'RA',
  'ST', 'ST', 'ST',
];

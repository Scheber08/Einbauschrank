/** Weltgenerator: Laender, Ligen, Vereine und Kader (Konzept Abschnitt 4-6). */
import { computeOverall, type PositionCode } from './attributes';
import { COUNTRIES, COUNTRY_BY_ID, type CountryDef } from './countries';
import { ageOn, type GameDate } from './date';
import { sponsorsFor } from './identity';
import { NAME_POOLS, STADIUM_PLACES, STADIUM_STANDALONE, STADIUM_WORDS } from './names';
import { FOREIGN_NATION_POOL, nationOfGameCountry } from './nations';
import {
  assignSquadNames, deriveShort, leagueLayout, realClub, realCountry, realLeagueName,
  type RealClub,
} from './realData';
import { SQUAD_TEMPLATE, createPlayer, makeContract } from './playerGen';
import { Rng, clamp } from './rng';
import type {
  Club, Competition, Country, FormationKey, Id, Player, SquadRole,
} from './types';

const CLUB_COLORS: [string, string][] = [
  ['#c0392b', '#ffffff'], ['#1e5aa8', '#ffffff'], ['#146b3a', '#ffffff'],
  ['#f0b400', '#101010'], ['#111827', '#e5e7eb'], ['#7c2d8f', '#ffffff'],
  ['#e06a00', '#101010'], ['#0e7490', '#ffffff'], ['#9d174d', '#ffffff'],
  ['#374151', '#f59e0b'], ['#065f46', '#fbbf24'], ['#1f2937', '#ef4444'],
  ['#b91c1c', '#111827'], ['#0369a1', '#facc15'], ['#4d7c0f', '#ffffff'],
  ['#5b21b6', '#a3e635'], ['#831843', '#fde68a'], ['#134e4a', '#ffffff'],
  ['#7f1d1d', '#fef3c7'], ['#1e3a8a', '#f97316'],
];

const FORMATIONS: FormationKey[] = ['4-4-2', '4-3-3', '4-2-3-1', '3-5-2', '3-4-3', '5-3-2', '4-1-4-1'];

export interface WorldGenResult {
  countries: Record<Id, Country>;
  competitions: Record<Id, Competition>;
  clubs: Record<Id, Club>;
  players: Record<Id, Player>;
}

export interface WorldGenOptions {
  /** Laender, die vollstaendig mit Ligen erzeugt werden. */
  fullCountryIds: string[];
  currentDate: GameDate;
  makeId: (prefix: string) => Id;
}

/** Durchschnittliche Kaderstaerke eines Vereins aus seiner Reputation. */
function abilityForReputation(reputation: number): number {
  return clamp(29 + reputation * 0.545, 32, 84);
}

/**
 * Ruf eines Vereins nach Spielklasse und Tabellenrang.
 *
 * Die Spanne wird ueber die vorhandenen Ebenen verteilt, statt drei feste
 * Baender zu benutzen: So bleibt das Gefaelle stimmig, ob ein Land zwei Ligen
 * hat oder sechs. `rank` 0 ist der staerkste Verein seiner Liga.
 */
function reputationBand(
  rng: Rng, level: number, rank: number, levels: number, clubsInLeague: number,
): number {
  const top = 88;
  const bottom = 20;
  const span = (top - bottom) / Math.max(1, levels);
  const ceiling = top - (level - 1) * span;
  // Innerhalb der Liga faellt der Ruf vom ersten bis zum letzten Platz.
  const withinDrop = span * 0.75;
  const value = ceiling - (rank / Math.max(1, clubsInLeague - 1)) * withinDrop;
  return clamp(Math.round(value + rng.normal(0, 2.2)), 8, 95);
}

function makeClubName(rng: Rng, country: CountryDef, city: string): { name: string; short: string } {
  const pool = NAME_POOLS[country.id];
  const prefix = rng.pick(pool.clubPrefixes);
  const suffix = rng.pick(pool.clubSuffixes);
  const parts = [prefix, city, suffix].filter(Boolean);
  const name = parts.join(' ');
  const short = city.slice(0, 3).toUpperCase();
  return { name, short };
}

/**
 * Stadionname und Fassungsvermoegen. Grosse Vereine spielen haeufiger in einer
 * nach dem Sponsor benannten Arena, kleinere in traditionellen Spielstaetten -
 * das macht den Unterschied zwischen den Ligen greifbar.
 */
function makeStadium(
  rng: Rng, city: string, reputation: number, clubId: Id,
): { name: string; capacity: number } {
  const base = 2500 + Math.pow(reputation, 2.05) * 8;
  const capacity = Math.round((base * rng.float(0.8, 1.25)) / 500) * 500;

  const roll = rng.next();
  const sponsorChance = clamp((reputation - 40) / 90, 0, 0.45);
  let name: string;
  if (roll < sponsorChance) {
    name = `${sponsorsFor(clubId, reputation).shirt} Arena`;
  } else if (roll < sponsorChance + 0.2) {
    name = `Stadion an der ${rng.pick(STADIUM_PLACES)}`;
  } else if (roll < sponsorChance + 0.32) {
    name = rng.pick(STADIUM_STANDALONE);
  } else {
    name = `${city} ${rng.pick(STADIUM_WORDS)}`;
  }
  return { name, capacity: clamp(capacity, 2000, 78000) };
}

/** Erzeugt einen kompletten Kader fuer einen Verein. */
function generateSquad(
  rng: Rng, club: Club, level: number, country: CountryDef,
  currentDate: GameDate, makeId: (p: string) => Id,
  realSquad?: RealClub['squad'],
): Player[] {
  const avgAbility = abilityForReputation(club.reputation);
  const players: Player[] = [];
  const usedNumbers = new Set<number>();

  const positions = rng.shuffle(SQUAD_TEMPLATE.slice());
  // Die Nation, die der Liga des Vereins entspricht - die Mehrheit des Kaders.
  const homeNation = nationOfGameCountry(country.id) ?? country.id;
  // Eigene Kadernamen ueberschreiben nur die Namen, niemals die Spielwerte.
  const nameOverrides = realSquad?.length
    ? assignSquadNames(realSquad, positions)
    : null;

  positions.forEach((position, index) => {
    // Die ersten Spieler eines Kaders sind die Stammkraefte.
    const depthPenalty = index < 11 ? rng.float(2, 7) : index < 17 ? rng.float(-3, 2) : rng.float(-12, -4);
    const ability = clamp(avgAbility + depthPenalty + rng.normal(0, 3.5), 18, 93);

    // Altersverteilung: Schwerpunkt zwischen 22 und 29.
    const ageRoll = rng.next();
    let age: number;
    if (ageRoll < 0.16) age = rng.int(17, 20);
    else if (ageRoll < 0.42) age = rng.int(21, 24);
    else if (ageRoll < 0.75) age = rng.int(25, 28);
    else if (ageRoll < 0.93) age = rng.int(29, 32);
    else age = rng.int(33, 37);

    // Auslaendische Spieler: in hoeheren Ligen haeufiger. Die Herkunft kommt
    // aus der Nationenliste, nicht aus den fuenf Ligalaendern - ein Kader
    // ohne einen einzigen Brasilianer waere kein Fussballkader.
    const foreignChance = level === 1 ? 0.3 : level === 2 ? 0.16 : 0.07;
    let nationality = homeNation;
    if (rng.chance(foreignChance)) {
      for (let tries = 0; tries < 8; tries++) {
        const pick = rng.pick(FOREIGN_NATION_POOL);
        if (pick !== homeNation) { nationality = pick; break; }
      }
    }

    let shirtNumber = 0;
    for (let tries = 0; tries < 60; tries++) {
      const n = tries < 40 ? rng.int(1, 45) : rng.int(46, 99);
      if (!usedNumbers.has(n)) { shirtNumber = n; break; }
    }
    usedNumbers.add(shirtNumber);

    const player = createPlayer(rng, makeId('p'), {
      ability,
      position,
      age,
      countryId: nationality,
      currentDate,
      clubId: club.id,
      leagueLevel: level,
      potentialBoost: country.youth > 82 && age < 21 ? rng.float(0, 7) : 0,
      shirtNumber: shirtNumber || 60 + index,
    });

    const override = nameOverrides?.[index];
    if (override) {
      if (override.firstName) player.firstName = override.firstName;
      player.lastName = override.lastName;
      // Eine Herkunft aus der Vorlage schlaegt die gewuerfelte.
      if (override.nation) player.nationality = override.nation;
    }

    const role: SquadRole = index < 6 ? 'Schluesselspieler'
      : index < 11 ? 'Stammspieler'
      : index < 17 ? 'Rotationsspieler'
      : age <= 20 ? 'Nachwuchsspieler' : 'Ergaenzungsspieler';

    player.contract = makeContract(
      rng, player, club.id, currentDate, level, club.reputation, country.wealth, role,
    );
    players.push(player);
  });

  // Kapitaen: erfahrenster Spieler mit hoher Fuehrungsstaerke.
  const captain = players.reduce((best, p) => {
    const score = p.attrs.leadership + ageOn(p.birthDate, currentDate) * 1.5 + computeOverall(p.attrs, p.position) * 0.4;
    const bestScore = best.attrs.leadership + ageOn(best.birthDate, currentDate) * 1.5 + computeOverall(best.attrs, best.position) * 0.4;
    return score > bestScore ? p : best;
  }, players[0]);
  if (captain.contract) captain.contract.role = 'Mannschaftsfuehrer';

  return players;
}

/**
 * Setzt Transfer- und Gehaltsbudget aus dem tatsaechlichen Kader.
 *
 * Vorher standen dort zwei frei gegriffene Formeln, die nie gegen die echten
 * Zahlen gehalten wurden - es las sie ja niemand. Das Gehaltsbudget war
 * linear im Ruf, waehrend Gehaelter exponentiell mit der Spielstaerke wachsen;
 * dadurch lag ausgerechnet der staerkste Verein am weitesten daneben.
 *
 * Aus dem Kader abgeleitet stimmt die Groessenordnung von selbst, auch wenn
 * spaeter an Gehaeltern oder Marktwerten gedreht wird.
 */
function setzeBudgets(club: Club, kader: Player[], rng: Rng) {
  const gehaltslast = kader.reduce((a, p) => a + (p.contract?.salary ?? 0), 0);
  const kaderwert = kader.reduce((a, p) => a + p.marketValue, 0);

  // Spielraum nach oben: Ein Verein wirtschaftet nah an der Grenze. Wer gut
  // gefuehrt ist, hat etwas mehr Luft - das macht Vereine unterscheidbar,
  // ohne dass irgendwo ein weiterer Wert dafuer noetig waere.
  const luft = 1.08 + rng.float(0, 0.22);
  club.wageBudget = Math.max(5000, Math.round(gehaltslast * luft));

  // Transferbudget als Anteil am Kaderwert. Zehn Prozent entsprechen grob
  // dem, was ein Verein in einem Sommer bewegt: genug fuer einen teuren oder
  // mehrere mittlere Spieler, nicht genug fuer einen Umbau.
  const anteil = 0.07 + rng.float(0, 0.07);
  club.budget = Math.max(50000, Math.round(kaderwert * anteil / 10000) * 10000);
}

export function generateWorld(rng: Rng, opts: WorldGenOptions): WorldGenResult {
  const countries: Record<Id, Country> = {};
  const competitions: Record<Id, Competition> = {};
  const clubs: Record<Id, Club> = {};
  const players: Record<Id, Player> = {};

  for (const def of COUNTRIES) {
    countries[def.id] = {
      id: def.id,
      name: realCountry(def.id)?.displayName ?? def.name,
      short: def.short,
      styleBias: def.attrBias,
      reputation: def.reputation,
    };
  }

  for (const countryId of opts.fullCountryIds) {
    const country = COUNTRY_BY_ID[countryId];
    const pool = NAME_POOLS[countryId];
    const cities = rng.shuffle(pool.cities.slice());
    const usedNames = new Set<string>();
    let cityIndex = 0;

    // Aufbau des Ligasystems: aus eigenen Daten, sonst der Standardaufbau.
    const layout = leagueLayout(countryId);
    // Der Rufabstand zwischen den Ebenen haengt daran, wie viele es gibt -
    // bei fuenf Ligen faellt er flacher aus als bei zweien.
    const repStep = layout.length > 1 ? 66 / (layout.length - 1) : 0;

    for (const tier of layout) {
      const level = tier.level;
      const competitionId = `${countryId}-l${level}`;
      const competition: Competition = {
        id: competitionId,
        countryId,
        name: realLeagueName(countryId, level)
          ?? country.leagueNames[level - 1]
          ?? `${country.name} Liga ${level}`,
        short: `${country.short}${level}`,
        type: 'league',
        level,
        clubIds: [],
        reputation: clamp(country.reputation - (level - 1) * repStep, 10, 95),
      };

      for (let rank = 0; rank < tier.clubs; rank++) {
        // Eigenes Datenpaket hat Vorrang; fehlt es, wird wie bisher gewuerfelt.
        const real = realClub(countryId, level, rank);

        const city = real?.city ?? cities[cityIndex++ % cities.length];
        let naming = makeClubName(rng, country, city);
        let guard = 0;
        while (usedNames.has(naming.name) && guard++ < 20) naming = makeClubName(rng, country, city);
        if (real) naming = { name: real.name, short: real.short ?? deriveShort(real.name) };
        usedNames.add(naming.name);

        const reputation = real?.reputation
          ?? reputationBand(rng, level, rank, layout.length, tier.clubs);
        const clubId = opts.makeId('c');
        const stadium = makeStadium(rng, city, reputation, clubId);
        if (real?.stadium) stadium.name = real.stadium;
        if (real?.capacity) stadium.capacity = real.capacity;

        const club: Club = {
          id: clubId,
          countryId,
          leagueId: competitionId,
          name: naming.name,
          short: naming.short,
          city,
          colors: real?.colors ?? CLUB_COLORS[(cityIndex + level) % CLUB_COLORS.length],
          reputation,
          // Vorlaeufige Werte - direkt nach dem Kader werden beide aus den
          // echten Gehaeltern und Marktwerten gesetzt (siehe unten).
          budget: 0,
          wageBudget: 0,
          stadiumName: stadium.name,
          stadiumCapacity: stadium.capacity,
          formation: rng.pick(FORMATIONS),
          tacticStyle: rng.pick(country.tactics),
          training: clamp(Math.round(reputation * 0.7 + country.youth * 0.25 + rng.normal(0, 7)), 15, 95),
          youth: clamp(Math.round(reputation * 0.5 + country.youth * 0.45 + rng.normal(0, 8)), 15, 95),
          managerName: real?.manager
            ?? `${rng.pick(pool.managerFirst)} ${rng.pick(pool.lastNames)}`,
          history: [],
        };

        clubs[clubId] = club;
        competition.clubIds.push(clubId);

        const kader = generateSquad(
          rng, club, level, country, opts.currentDate, opts.makeId, real?.squad,
        );
        for (const p of kader) players[p.id] = p;
        setzeBudgets(club, kader, rng);
      }

      competitions[competitionId] = competition;
    }

    // Nationaler Pokal (Konzept Abschnitt 9)
    const cupId = `${countryId}-cup`;
    competitions[cupId] = {
      id: cupId,
      countryId,
      name: realCountry(countryId)?.cupName ?? country.cupName,
      short: 'Pokal',
      type: 'cup',
      level: 0,
      clubIds: Object.values(clubs).filter((c) => c.countryId === countryId).map((c) => c.id),
      reputation: country.reputation,
    };
  }

  return { countries, competitions, clubs, players };
}

/** Hilfsfunktion: alle Spieler eines Vereins. */
export function squadOf(players: Record<Id, Player>, clubId: Id): Player[] {
  return Object.values(players).filter((p) => p.clubId === clubId);
}

/** Aufstellungsraster je Formation - fuer die Auswahl der Startelf. */
export const FORMATION_SLOTS: Record<FormationKey, PositionCode[]> = {
  '4-4-2': ['TW', 'LV', 'IV', 'IV', 'RV', 'LA', 'ZM', 'ZM', 'RA', 'ST', 'ST'],
  '4-3-3': ['TW', 'LV', 'IV', 'IV', 'RV', 'DM', 'ZM', 'ZM', 'LA', 'ST', 'RA'],
  '4-2-3-1': ['TW', 'LV', 'IV', 'IV', 'RV', 'DM', 'DM', 'LA', 'OM', 'RA', 'ST'],
  '3-5-2': ['TW', 'IV', 'IV', 'IV', 'LV', 'DM', 'ZM', 'ZM', 'RV', 'ST', 'ST'],
  '3-4-3': ['TW', 'IV', 'IV', 'IV', 'LA', 'ZM', 'ZM', 'RA', 'LA', 'ST', 'RA'],
  '5-3-2': ['TW', 'LV', 'IV', 'IV', 'IV', 'RV', 'DM', 'ZM', 'ZM', 'ST', 'ST'],
  '4-1-4-1': ['TW', 'LV', 'IV', 'IV', 'RV', 'DM', 'LA', 'ZM', 'ZM', 'RA', 'ST'],
};

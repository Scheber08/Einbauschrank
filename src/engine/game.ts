/**
 * Spielablauf: Karrierestart, Tageslogik und Spielabwicklung
 * (Konzept Abschnitt 14, 18, 41, 51).
 */
import { computeOverall, POSITION_LINE, type PositionCode } from './attributes';
import { BACKGROUNDS } from './backgrounds';
import { COUNTRY_BY_ID } from './countries';
import {
  addDays, ageOn, formatShort, makeDate, seasonLabel, weekday, type GameDate,
} from './date';
import {
  advancePlayerDay, applyTraining, driftForm, rollInjury, updateFormAfterMatch,
  type TrainingOutcome,
} from './development';
import { buildLifeEvent, type LifeEvent } from './events';
import { addCareerEvent, addNews, makeId, matchesOn } from './ids';
import { selectLineup, type Lineup } from './lineup';
import type { MatchEngineSetup, MatchOutcome } from './matchEngine';
import { simulateLight } from './matchSim';
import { calcMarketValue, calcSalary, generateAttributes } from './playerGen';
import { Rng, clamp, randomSeed } from './rng';
import {
  advanceCup, cupOfCountry, endSeason, leaguesFinished, leaguesOfCountry,
  postSeasonFinished, relegationCompetitionId, scheduleRelegation, sortedTable,
  startSeason, tableKey, type SeasonReport,
} from './season';
import { accumulate, averageRating, statsKey } from './stats';
import { emptyRow } from './table';
import {
  DIFFICULTY_SETTINGS, type Appearance, type BackgroundKey, type Difficulty,
  type Foot, type GameState, type Id, type Match, type Player,
  type PlayerMatchStats, type StoredMatchEvent,
} from './types';
import { generateWorld, squadOf } from './worldGen';

/** In diesem Jahr beginnt die erste Saison. */
const START_YEAR = 2026;
/** Das Land, das in dieser Version vollstaendig simuliert wird. */
export const PLAYABLE_COUNTRY = 'falkenland';

export interface NewGameOptions {
  saveName: string;
  seed?: number;
  difficulty: Difficulty;
  firstName: string;
  lastName: string;
  age: number;
  nationality: string;
  position: PositionCode;
  altPositions: PositionCode[];
  foot: Foot;
  height: number;
  weight: number;
  shirtNumber: number;
  appearance: Appearance;
  background: BackgroundKey;
}

// --- Karrierestart -----------------------------------------------------

export function createNewGame(opts: NewGameOptions): GameState {
  const seed = opts.seed ?? randomSeed();
  const rng = new Rng(seed);
  const startDate = makeDate(START_YEAR, 7, 1);
  const counter = { nextId: 0 };

  const world = generateWorld(rng, {
    fullCountryIds: [PLAYABLE_COUNTRY],
    currentDate: startDate,
    makeId: (prefix) => makeId(counter, prefix),
  });

  const state: GameState = {
    saveId: `save-${seed.toString(36)}-${Date.now().toString(36)}`,
    saveName: opts.saveName,
    seed,
    rngState: rng.state,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    version: 1,
    difficulty: opts.difficulty,
    date: startDate,
    season: START_YEAR,
    seasonPhase: 'preseason',
    userPlayerId: '',
    countries: world.countries,
    competitions: world.competitions,
    clubs: world.clubs,
    players: world.players,
    matches: {},
    matchesByDate: {},
    tables: {},
    seasonStats: {},
    userMatchStats: [],
    news: [],
    careerEvents: [],
    records: {},
    awards: [],
    training: { focus: 'ballControl', intensity: 'normal', individualGoal: null },
    objectives: [],
    coachRelation: 55,
    fanRelation: 50,
    publicImage: 55,
    relationships: {},
    pendingMatchId: null,
    cupState: {},
    offers: [],
    honours: [],
    nextId: counter.nextId,
  };

  const user = createUserPlayer(state, rng, opts);
  state.players[user.id] = user;
  state.userPlayerId = user.id;

  startSeason(state, rng);
  createObjectives(state);

  const club = user.clubId ? state.clubs[user.clubId] : null;
  addCareerEvent(state, 'start', 'Karrierestart',
    `${user.firstName} ${user.lastName} startet bei ${club?.name ?? 'einem Verein'} `
    + `als ${BACKGROUNDS[opts.background].name}.`, { clubId: user.clubId ?? undefined });
  addNews(state, 'season', 'Ein neues Kapitel beginnt',
    `${user.firstName} ${user.lastName} gehoert ab sofort zum Kader von ${club?.name ?? '-'}. `
    + `Die Saison ${seasonLabel(state.season)} steht bevor.`, true);

  state.rngState = rng.state;
  return state;
}

function createUserPlayer(state: GameState, rng: Rng, opts: NewGameOptions): Player {
  const bg = BACKGROUNDS[opts.background];
  const country = COUNTRY_BY_ID[opts.nationality] ?? COUNTRY_BY_ID[PLAYABLE_COUNTRY];

  const baseAbility = clamp(
    { academy: 46, homeClub: 41, street: 43, wonderkid: 55, lateBloomer: 38 }[opts.background]
    + (opts.age - 17) * 2.5 + rng.normal(0, 2),
    28, 66,
  );

  const attrs = generateAttributes(rng, baseAbility, opts.position, country, opts.age);
  for (const key in bg.attrBonus) {
    const attr = key as keyof typeof attrs;
    attrs[attr] = clamp(attrs[attr] + (bg.attrBonus[key] ?? 0), 3, 99);
  }

  const ability = computeOverall(attrs, opts.position);
  const youthRoom = Math.max(0, 25 - opts.age);
  const potential = clamp(
    Math.round(ability + youthRoom * rng.float(1.2, 2.6) + bg.potentialMod + rng.float(0, 5)),
    ability + 2, 97,
  );

  const club = pickStartingClub(state, rng, bg.startLevel, bg.clubReputationBand);
  const league = club ? state.competitions[club.leagueId] : null;
  const level = league?.level ?? 3;

  const birthYear = START_YEAR - opts.age;
  const player: Player = {
    id: makeId(state, 'p'),
    clubId: club?.id ?? null,
    firstName: opts.firstName,
    lastName: opts.lastName,
    nationality: opts.nationality,
    birthDate: makeDate(birthYear, rng.int(1, 12), rng.int(1, 28)),
    position: opts.position,
    altPositions: opts.altPositions,
    foot: opts.foot,
    height: opts.height,
    weight: opts.weight,
    shirtNumber: opts.shirtNumber,
    attrs,
    potential,
    growth: clamp(rng.float(0.95, 1.3) * bg.growthMod, 0.7, 1.7),
    form: 52,
    morale: 72,
    fitness: 96,
    sharpness: 55,
    confidence: 55,
    injury: null,
    injuryProneness: clamp(Math.round(rng.normal(30, 14)), 5, 80),
    reputation: bg.startReputation,
    marketValue: calcMarketValue(ability, potential, opts.age, opts.position, level),
    contract: null,
    isUser: true,
    appearance: opts.appearance,
    background: opts.background,
    suspension: 0,
    yellowCardsInLeague: 0,
  };

  if (club) {
    const countryDef = COUNTRY_BY_ID[club.countryId];
    player.contract = {
      clubId: club.id,
      salary: calcSalary(ability, opts.age, level, club.reputation, countryDef?.wealth ?? 1),
      until: makeDate(START_YEAR + (opts.background === 'wonderkid' ? 4 : 3), 6, 30),
      role: opts.background === 'wonderkid' ? 'Rotationsspieler' : 'Nachwuchsspieler',
      goalBonus: 0,
      appearanceBonus: 0,
    };
    // Rueckennummer freihalten
    const taken = new Set(squadOf(state.players, club.id).map((p) => p.shirtNumber));
    if (taken.has(player.shirtNumber)) {
      for (let n = 2; n < 99; n++) {
        if (!taken.has(n)) { player.shirtNumber = n; break; }
      }
    }
  }

  return player;
}

function pickStartingClub(state: GameState, rng: Rng, level: number, band: [number, number]) {
  const league = leaguesOfCountry(state, PLAYABLE_COUNTRY).find((l) => l.level === level);
  const pool = (league?.clubIds ?? [])
    .map((id) => state.clubs[id])
    .filter((c) => c && c.reputation >= band[0] && c.reputation <= band[1]);
  if (pool.length === 0) {
    const fallback = leaguesOfCountry(state, PLAYABLE_COUNTRY)[level - 1];
    return fallback ? state.clubs[rng.pick(fallback.clubIds)] : undefined;
  }
  return rng.weighted(pool, (c) => c.youth + c.training * 0.5);
}

// --- Saisonziele (Konzept Abschnitt 41) --------------------------------

export function createObjectives(state: GameState) {
  const user = state.players[state.userPlayerId];
  if (!user || !user.clubId) { state.objectives = []; return; }
  const club = state.clubs[user.clubId];
  const league = state.competitions[club.leagueId];
  const ability = computeOverall(user.attrs, user.position);
  const line = POSITION_LINE[user.position];
  const role = user.contract?.role ?? 'Nachwuchsspieler';

  const appearanceTarget = role === 'Nachwuchsspieler' ? 8
    : role === 'Ergaenzungsspieler' ? 14
    : role === 'Rotationsspieler' ? 20 : 27;

  const goalTarget = line === 'ATT' ? Math.max(3, Math.round(ability / 9))
    : line === 'MID' ? Math.max(2, Math.round(ability / 16))
    : 1;

  // Erwarteter Tabellenplatz aus der Vereinsreputation
  const table = league ? sortedTable(state, league.id) : [];
  const rank = league
    ? league.clubIds
      .map((id) => state.clubs[id])
      .sort((a, b) => b.reputation - a.reputation)
      .findIndex((c) => c.id === club.id) + 1
    : 10;
  void table;

  state.objectives = [
    {
      id: 'apps', kind: 'appearances', label: `Mindestens ${appearanceTarget} Pflichtspiele`,
      target: appearanceTarget, current: 0, done: false, failed: false,
      reward: 'Bessere Trainerbeziehung und neue Vertragsangebote',
    },
    {
      id: 'goals', kind: 'goals', label: `${goalTarget} Tore erzielen`,
      target: goalTarget, current: 0, done: false, failed: false,
      reward: 'Hoehere Reputation und Marktwert',
    },
    {
      id: 'rating', kind: 'rating', label: 'Durchschnittsnote von 6,80 erreichen',
      target: 6.8, current: 0, done: false, failed: false,
      reward: 'Aufmerksamkeit groesserer Vereine',
    },
    {
      id: 'team', kind: 'teamPosition',
      label: rank <= 4 ? 'Mit dem Team um den Titel spielen (Platz 1 bis 3)'
        : rank <= 12 ? `Einstelliger Tabellenplatz mit ${club.short}`
        : 'Den Klassenerhalt sichern',
      target: rank <= 4 ? 3 : rank <= 12 ? 9 : 17,
      current: 0, done: false, failed: false,
      reward: 'Praemien und Vereinsansehen',
    },
  ];
}

function updateObjectives(state: GameState) {
  const user = state.players[state.userPlayerId];
  if (!user) return;
  const entries = Object.values(state.seasonStats).filter(
    (s) => s.playerId === state.userPlayerId && s.season === state.season,
  );
  const apps = entries.reduce((a, s) => a + s.appearances, 0);
  const goals = entries.reduce((a, s) => a + s.goals, 0);
  const ratingSum = entries.reduce((a, s) => a + s.ratingSum, 0);
  const avg = apps > 0 ? ratingSum / apps : 0;

  const club = user.clubId ? state.clubs[user.clubId] : null;
  const league = club ? state.competitions[club.leagueId] : null;
  const position = league
    ? sortedTable(state, league.id).findIndex((r) => r.clubId === club!.id) + 1
    : 20;

  for (const obj of state.objectives) {
    switch (obj.kind) {
      case 'appearances': obj.current = apps; obj.done = apps >= obj.target; break;
      case 'goals': obj.current = goals; obj.done = goals >= obj.target; break;
      case 'rating': obj.current = avg; obj.done = avg >= obj.target; break;
      case 'teamPosition':
        obj.current = position;
        obj.done = position > 0 && position <= obj.target;
        break;
      default: break;
    }
  }
}

// --- Tagesablauf -------------------------------------------------------

export interface DayResult {
  date: GameDate;
  matchToPlay: Id | null;
  training: TrainingOutcome | null;
  seasonReport: SeasonReport | null;
  lifeEvent: LifeEvent | null;
  headlines: string[];
}

export function involvesUserClub(state: GameState, match: Match): boolean {
  const user = state.players[state.userPlayerId];
  if (!user?.clubId) return false;
  return match.homeClubId === user.clubId || match.awayClubId === user.clubId;
}

/**
 * Bearbeitet einen Kalendertag. Steht ein Spiel des eigenen Vereins an,
 * wird angehalten, damit der Spieler entscheiden kann.
 */
export function advanceDay(state: GameState): DayResult {
  const rng = new Rng(state.rngState);
  const result: DayResult = {
    date: state.date, matchToPlay: null, training: null, seasonReport: null,
    lifeEvent: null, headlines: [],
  };

  const today = matchesOn(state, state.date).filter((m) => !m.played);
  const userMatch = today.find((m) => involvesUserClub(state, m));

  if (userMatch) {
    state.pendingMatchId = userMatch.id;
    result.matchToPlay = userMatch.id;
    state.rngState = rng.state;
    return result;
  }

  for (const match of today) {
    simulateBackgroundMatch(state, match, rng);
  }

  // Training: einmal pro Woche am Freitag (Abschlusstraining)
  const user = state.players[state.userPlayerId];
  if (user && weekday(state.date) === 5 && !user.injury) {
    const club = user.clubId ? state.clubs[user.clubId] : null;
    result.training = applyTraining(
      rng, user, state.training.focus, state.training.intensity,
      club?.training ?? 50, state.date, DIFFICULTY_SETTINGS[state.difficulty], user.sharpness,
      state.training.individualGoal,
    );
    if (result.training.injured) {
      addNews(state, 'injury', 'Verletzung im Training',
        `${user.lastName} zieht sich im Training eine Verletzung zu `
        + `(${result.training.injured.name}, etwa ${result.training.injured.totalDays} Tage).`, true);
      result.headlines.push(`Verletzung: ${result.training.injured.name}`);
    }
  }

  // Taegliche Regeneration und Formentwicklung
  for (const player of Object.values(state.players)) {
    advancePlayerDay(rng, player, today.length > 0);
    if (weekday(state.date) === 1) driftForm(player);
  }

  // Ereignis ausserhalb des Platzes (Konzept Abschnitt 31): unter der Woche,
  // wenn kein Spiel ansteht und der Spieler fit ist. Haelt den Kalender an.
  if (user && !user.injury && state.seasonPhase === 'inSeason'
    && weekday(state.date) === 3 && rng.chance(0.3)) {
    result.lifeEvent = buildLifeEvent(rng, state.nextId++);
  }

  // Pokalrunden nachziehen
  for (const country of Object.values(state.countries)) {
    const cup = cupOfCountry(state, country.id);
    if (cup) advanceCup(state, rng, cup.id);
  }

  handleSeasonTransitions(state, rng, result);
  updateObjectives(state);

  state.date = addDays(state.date, 1);
  state.rngState = rng.state;
  state.updatedAt = Date.now();
  return result;
}

function handleSeasonTransitions(state: GameState, rng: Rng, result: DayResult) {
  if (state.seasonPhase === 'inSeason' && leaguesFinished(state)) {
    for (const country of Object.values(state.countries)) {
      if (leaguesOfCountry(state, country.id).length > 0) {
        scheduleRelegation(state, rng, country.id);
      }
    }
    addNews(state, 'season', 'Die Liga ist entschieden',
      'Alle Ligaspieltage sind absolviert. Es folgen die Relegationsspiele.', false);
  }

  if (state.seasonPhase === 'postSeason' && postSeasonFinished(state)) {
    const report = endSeason(state, rng);
    result.seasonReport = report;
    createObjectives(state);
    addNews(state, 'season', `Saison ${seasonLabel(report.season)} abgeschlossen`,
      'Die Auswertung der Saison liegt vor. Eine neue Spielzeit beginnt.', true);
  }
}

// --- Hintergrundspiele -------------------------------------------------

function simulateBackgroundMatch(state: GameState, match: Match, rng: Rng) {
  const homeClub = state.clubs[match.homeClubId];
  const awayClub = state.clubs[match.awayClubId];
  if (!homeClub || !awayClub) { match.played = true; return; }

  const homeSquad = squadOf(state.players, homeClub.id);
  const awaySquad = squadOf(state.players, awayClub.id);
  const result = simulateLight(
    rng, match.id, homeClub, awayClub, homeSquad, awaySquad, match.neutralVenue,
  );

  let homeScore = result.homeScore;
  let awayScore = result.awayScore;
  let penalties: [number, number] | null = null;

  if (isKnockout(state, match) && homeScore === awayScore) {
    penalties = shootoutFrom(rng, homeSquad, awaySquad);
  }

  commitMatch(state, match, {
    homeScore, awayScore, penalties,
    stats: result.appearances,
    injuries: result.injuries,
    events: buildLightEvents(state, match, result),
  }, rng);

  for (const s of result.appearances) {
    const p = state.players[s.playerId];
    if (!p) continue;
    p.fitness = clamp(p.fitness - (26 + rng.float(0, 10)) * (s.minutes / 90), 8, 100);
  }
}

function buildLightEvents(
  state: GameState, match: Match,
  result: { scorers: { clubId: Id; playerId: Id; assistId: Id | null; minute: number }[] },
): StoredMatchEvent[] {
  return result.scorers
    .slice()
    .sort((a, b) => a.minute - b.minute)
    .map((g) => {
      const p = state.players[g.playerId];
      return {
        minute: g.minute,
        type: 'goal' as const,
        clubId: g.clubId,
        playerId: g.playerId,
        assistId: g.assistId ?? undefined,
        text: `${p ? `${p.firstName.charAt(0)}. ${p.lastName}` : 'Unbekannt'} trifft.`,
      };
    });
  void match;
}

function isKnockout(state: GameState, match: Match): boolean {
  const comp = state.competitions[match.competitionId];
  return comp?.type === 'cup';
}

function shootoutFrom(rng: Rng, homeSquad: Player[], awaySquad: Player[]): [number, number] {
  const rate = (squad: Player[]) => {
    const takers = squad.slice().sort(
      (a, b) => (b.attrs.penalties + b.attrs.composure) - (a.attrs.penalties + a.attrs.composure));
    return takers.slice(0, 5);
  };
  const h = rate(homeSquad);
  const a = rate(awaySquad);
  const shoot = (p?: Player) => rng.chance(
    p ? clamp(0.58 + p.attrs.penalties / 340, 0.45, 0.93) : 0.7);
  let hs = 0, as = 0;
  for (let i = 0; i < 5; i++) { if (shoot(h[i])) hs++; if (shoot(a[i])) as++; }
  let round = 0;
  while (hs === as && round < 15) {
    if (shoot(h[round % Math.max(1, h.length)])) hs++;
    if (shoot(a[round % Math.max(1, a.length)])) as++;
    round++;
  }
  return [hs, as];
}

// --- Spiel des eigenen Vereins ----------------------------------------

export interface PreparedMatch {
  setup: Omit<MatchEngineSetup, 'rng'>;
  homeLineup: Lineup;
  awayLineup: Lineup;
  userInLineup: boolean;
  userOnBench: boolean;
}

export function prepareUserMatch(
  state: GameState, matchId: Id, interactive: boolean,
): PreparedMatch | null {
  const match = state.matches[matchId];
  if (!match) return null;
  const homeClub = state.clubs[match.homeClubId];
  const awayClub = state.clubs[match.awayClubId];
  if (!homeClub || !awayClub) return null;

  const homeSquad = squadOf(state.players, homeClub.id);
  const awaySquad = squadOf(state.players, awayClub.id);
  const user = state.players[state.userPlayerId];

  const rotate = hasBusyWeek(state, match);
  const homeLineup = selectLineup(homeClub, homeSquad, {
    coachRelation: user?.clubId === homeClub.id ? state.coachRelation : 50,
    rotate,
    userBonus: DIFFICULTY_SETTINGS[state.difficulty].playtimeBonus,
  });
  const awayLineup = selectLineup(awayClub, awaySquad, {
    coachRelation: user?.clubId === awayClub.id ? state.coachRelation : 50,
    rotate,
    userBonus: DIFFICULTY_SETTINGS[state.difficulty].playtimeBonus,
  });

  const userLineup = user?.clubId === homeClub.id ? homeLineup
    : user?.clubId === awayClub.id ? awayLineup : null;
  const userInLineup = !!userLineup?.starters.some((s) => s.playerId === state.userPlayerId);
  const userOnBench = !!userLineup?.bench.includes(state.userPlayerId);

  return {
    setup: {
      matchId: match.id,
      competitionName: state.competitions[match.competitionId]?.name ?? 'Spiel',
      homeClub, awayClub, homeLineup, awayLineup, homeSquad, awaySquad,
      userPlayerId: state.userPlayerId,
      interactive,
      difficulty: DIFFICULTY_SETTINGS[state.difficulty],
      neutral: match.neutralVenue,
      knockout: isKnockout(state, match),
    },
    homeLineup, awayLineup, userInLineup, userOnBench,
  };
}

function hasBusyWeek(state: GameState, match: Match): boolean {
  const user = state.players[state.userPlayerId];
  if (!user?.clubId) return false;
  const from = addDays(match.date, -4);
  for (let i = 0; i <= 4; i++) {
    const d = addDays(from, i);
    if (d === match.date) continue;
    const other = matchesOn(state, d).some(
      (m) => m.homeClubId === user.clubId || m.awayClubId === user.clubId);
    if (other) return true;
  }
  return false;
}

/** Uebernimmt das Ergebnis eines selbst gespielten Spiels. */
export function finishUserMatch(state: GameState, matchId: Id, outcome: MatchOutcome) {
  const rng = new Rng(state.rngState);
  const match = state.matches[matchId];
  if (!match) return;

  commitMatch(state, match, {
    homeScore: outcome.homeScore,
    awayScore: outcome.awayScore,
    penalties: outcome.penalties,
    extraTime: outcome.extraTime,
    stats: outcome.stats,
    injuries: outcome.injuries,
    events: outcome.events.map((e) => ({
      minute: e.minute,
      type: mapEventType(e.type),
      clubId: e.side === 'home' ? match.homeClubId : e.side === 'away' ? match.awayClubId : match.homeClubId,
      playerId: e.playerId,
      assistId: e.assistId,
      text: e.text,
    })).filter((e) => e.type !== null) as StoredMatchEvent[],
    fitnessAfter: outcome.fitnessAfter,
    moraleDelta: outcome.halftimeMoraleDelta,
  }, rng);

  state.pendingMatchId = null;
  state.rngState = rng.state;
}

function mapEventType(t: string): StoredMatchEvent['type'] | null {
  switch (t) {
    case 'goal': return 'goal';
    case 'ownGoal': return 'ownGoal';
    case 'yellow': return 'yellow';
    case 'secondYellow': return 'secondYellow';
    case 'red': return 'red';
    case 'injury': return 'injury';
    case 'sub': return 'sub';
    case 'penaltyMiss': return 'penaltyMiss';
    default: return null;
  }
}

// --- Gemeinsame Ergebnisverarbeitung ----------------------------------

interface CommitInput {
  homeScore: number;
  awayScore: number;
  penalties?: [number, number] | null;
  extraTime?: boolean;
  stats: PlayerMatchStats[];
  injuries: { playerId: Id; days: number }[];
  events?: StoredMatchEvent[];
  fitnessAfter?: Record<Id, number>;
  moraleDelta?: number;
}

function commitMatch(state: GameState, match: Match, input: CommitInput, rng: Rng) {
  match.homeScore = input.homeScore;
  match.awayScore = input.awayScore;
  match.played = true;
  match.penalties = input.penalties ?? undefined;
  match.extraTime = input.extraTime;
  match.events = input.events;

  const homeClub = state.clubs[match.homeClubId];
  const stadium = homeClub?.stadiumCapacity ?? 10000;
  match.attendance = Math.round(stadium * clamp(0.45 + rng.float(0, 0.5), 0.3, 1));

  const comp = state.competitions[match.competitionId];
  const isLeague = comp?.type === 'league';

  if (isLeague) applyResultToTable(state, match);

  const userStats = input.stats.find((s) => s.playerId === state.userPlayerId);
  if (userStats) {
    match.userStats = userStats;
    state.userMatchStats.push(userStats);
  }

  for (const s of input.stats) {
    if (s.minutes <= 0) continue;
    const player = state.players[s.playerId];
    if (!player) continue;

    const isHome = s.clubId === match.homeClubId;
    const teamGoals = isHome ? input.homeScore : input.awayScore;
    const oppGoals = isHome ? input.awayScore : input.homeScore;

    accumulate(state, s, match.season, match.competitionId, isHome, oppGoals === 0);
    updateFormAfterMatch(player, s.rating, s.minutes, teamGoals > oppGoals, teamGoals === oppGoals);

    if (input.fitnessAfter && input.fitnessAfter[s.playerId] !== undefined) {
      player.fitness = clamp(input.fitnessAfter[s.playerId], 5, 100);
    }

    // Sperren (Konzept Abschnitt 44)
    if (s.redCards > 0) player.suspension += 2;
    if (s.yellowCards > 0 && isLeague) {
      player.yellowCardsInLeague += s.yellowCards;
      if (player.yellowCardsInLeague >= 5) {
        player.yellowCardsInLeague = 0;
        player.suspension += 1;
      }
    }
  }

  // Sperren der nicht eingesetzten Spieler abbauen
  for (const clubId of [match.homeClubId, match.awayClubId]) {
    for (const p of squadOf(state.players, clubId)) {
      const played = input.stats.some((s) => s.playerId === p.id && s.minutes > 0);
      if (!played && p.suspension > 0) p.suspension -= 1;
    }
  }

  for (const inj of input.injuries) {
    const p = state.players[inj.playerId];
    if (!p || p.injury) continue;
    const injury = rollInjury(rng, p, 'Spiel');
    injury.daysOut = inj.days;
    injury.totalDays = inj.days;
    if (p.isUser) {
      addNews(state, 'injury', 'Verletzung im Spiel',
        `${p.lastName} faellt voraussichtlich ${inj.days} Tage aus (${injury.name}).`, true);
      addCareerEvent(state, 'injury', 'Verletzung',
        `${injury.name} - etwa ${inj.days} Tage Pause.`);
    }
  }

  if (userStats) handleUserMatchAftermath(state, match, userStats, input);
}

function applyResultToTable(state: GameState, match: Match) {
  const key = tableKey(match.competitionId, match.season);
  const table = state.tables[key] ?? (state.tables[key] = {});
  const home = table[match.homeClubId] ?? (table[match.homeClubId] = emptyRow(match.homeClubId));
  const away = table[match.awayClubId] ?? (table[match.awayClubId] = emptyRow(match.awayClubId));
  const hs = match.homeScore ?? 0;
  const as = match.awayScore ?? 0;

  home.played++; away.played++;
  home.goalsFor += hs; home.goalsAgainst += as;
  away.goalsFor += as; away.goalsAgainst += hs;

  if (hs > as) {
    home.won++; home.points += 3; away.lost++;
    home.form.push('S'); away.form.push('N');
  } else if (hs < as) {
    away.won++; away.points += 3; home.lost++;
    home.form.push('N'); away.form.push('S');
  } else {
    home.drawn++; away.drawn++; home.points++; away.points++;
    home.form.push('U'); away.form.push('U');
  }
  home.form = home.form.slice(-5);
  away.form = away.form.slice(-5);
}

function handleUserMatchAftermath(
  state: GameState, match: Match, s: PlayerMatchStats, input: CommitInput,
) {
  const user = state.players[state.userPlayerId];
  if (!user) return;
  const comp = state.competitions[match.competitionId];
  const opponentId = s.clubId === match.homeClubId ? match.awayClubId : match.homeClubId;
  const opponent = state.clubs[opponentId];
  const scoreText = `${input.homeScore}:${input.awayScore}`;

  // Trainerbeziehung (Konzept Abschnitt 29)
  const relationDelta = (s.rating - 6.5) * 2.2 + (s.motm ? 2 : 0);
  state.coachRelation = clamp(state.coachRelation + relationDelta, 0, 100);
  state.fanRelation = clamp(state.fanRelation + (s.rating - 6.4) * 1.6 + s.goals * 2.2, 0, 100);

  // Nachwirkung der Halbzeitentscheidung auf Moral und Trainerbeziehung.
  if (input.moraleDelta) {
    user.morale = clamp(user.morale + input.moraleDelta, 0, 100);
    state.coachRelation = clamp(state.coachRelation + input.moraleDelta * 0.4, 0, 100);
  }

  // Reputation und Marktwert
  const league = user.clubId ? state.competitions[state.clubs[user.clubId]?.leagueId] : null;
  user.reputation = clamp(
    user.reputation + (s.rating - 6.6) * 0.5 + s.goals * 0.8 + (s.motm ? 0.6 : 0), 1, 99);
  const ability = computeOverall(user.attrs, user.position);
  user.marketValue = calcMarketValue(
    ability, user.potential, ageOn(user.birthDate, state.date), user.position, league?.level ?? 3);

  const career = state.userMatchStats;
  const totalApps = career.length;

  if (totalApps === 1) {
    addCareerEvent(state, 'debut', 'Profidebuet',
      `Erstes Pflichtspiel gegen ${opponent?.name ?? 'den Gegner'} (${scoreText}).`,
      { clubId: user.clubId ?? undefined, competitionId: match.competitionId });
    addNews(state, 'match', 'Debuet gefeiert',
      `${user.firstName} ${user.lastName} gibt sein Pflichtspieldebuet.`, true);
  }

  const careerGoals = career.reduce((a, x) => a + x.goals, 0);
  if (s.goals > 0 && careerGoals === s.goals) {
    addCareerEvent(state, 'firstGoal', 'Erstes Pflichtspieltor',
      `Erstes Tor gegen ${opponent?.name ?? 'den Gegner'} am ${formatShort(match.date)}.`,
      { clubId: user.clubId ?? undefined, competitionId: match.competitionId });
  }
  const careerAssists = career.reduce((a, x) => a + x.assists, 0);
  if (s.assists > 0 && careerAssists === s.assists) {
    addCareerEvent(state, 'firstAssist', 'Erste Vorlage',
      `Erste Torvorlage gegen ${opponent?.name ?? 'den Gegner'}.`,
      { clubId: user.clubId ?? undefined });
  }
  if (s.goals >= 3) {
    addCareerEvent(state, 'hattrick', 'Hattrick',
      `${s.goals} Tore in einem Spiel gegen ${opponent?.name ?? 'den Gegner'} (${scoreText}).`,
      { clubId: user.clubId ?? undefined, competitionId: match.competitionId });
    addNews(state, 'match', 'Hattrick!',
      `${user.lastName} trifft ${s.goals} Mal gegen ${opponent?.name ?? '-'}.`, true);
  }

  const summary = s.goals > 0 || s.assists > 0
    ? `${s.goals} Tore, ${s.assists} Vorlagen, Note ${s.rating.toFixed(1)}`
    : `Note ${s.rating.toFixed(1)} in ${s.minutes} Minuten`;
  addNews(state, 'match',
    `${comp?.short ?? 'Spiel'}: ${state.clubs[match.homeClubId]?.short} ${scoreText} ${state.clubs[match.awayClubId]?.short}`,
    `${user.lastName}: ${summary}.`, s.goals > 0 || s.motm);
}

// --- Hilfen fuer die Oberflaeche --------------------------------------

export function userClub(state: GameState) {
  const user = state.players[state.userPlayerId];
  return user?.clubId ? state.clubs[user.clubId] : null;
}

export function userLeague(state: GameState) {
  const club = userClub(state);
  return club ? state.competitions[club.leagueId] : null;
}

export function nextUserMatch(state: GameState): Match | null {
  const club = userClub(state);
  if (!club) return null;
  const upcoming = Object.values(state.matches)
    .filter((m) => !m.played && (m.homeClubId === club.id || m.awayClubId === club.id))
    .sort((a, b) => a.date.localeCompare(b.date));
  return upcoming[0] ?? null;
}

export function recentUserMatches(state: GameState, limit = 5): Match[] {
  const club = userClub(state);
  if (!club) return [];
  return Object.values(state.matches)
    .filter((m) => m.played && (m.homeClubId === club.id || m.awayClubId === club.id))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, limit);
}

export function userSeasonSummary(state: GameState) {
  const entries = Object.values(state.seasonStats).filter(
    (s) => s.playerId === state.userPlayerId && s.season === state.season);
  const apps = entries.reduce((a, s) => a + s.appearances, 0);
  const ratingSum = entries.reduce((a, s) => a + s.ratingSum, 0);
  return {
    appearances: apps,
    goals: entries.reduce((a, s) => a + s.goals, 0),
    assists: entries.reduce((a, s) => a + s.assists, 0),
    minutes: entries.reduce((a, s) => a + s.minutes, 0),
    avgRating: apps > 0 ? ratingSum / apps : 0,
    entries,
  };
}

export { averageRating, statsKey, relegationCompetitionId, sortedTable, seasonLabel };

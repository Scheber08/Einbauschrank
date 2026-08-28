/**
 * Spielablauf: Karrierestart, Tageslogik und Spielabwicklung
 * (Konzept Abschnitt 14, 18, 41, 51).
 */
import { computeOverall, POSITION_LINE, type PositionCode } from './attributes';
import { BACKGROUNDS } from './backgrounds';
import { COUNTRIES, COUNTRY_BY_ID } from './countries';
import {
  addDays, ageOn, dayOfMonth, formatShort, makeDate, month, seasonLabel, weekday,
  type GameDate,
} from './date';
import {
  advancePlayerDay, applyTraining, driftForm, injuryForDays, updateFormAfterMatch,
  type TrainingOutcome,
} from './development';
import { buildLifeEvent, type LifeEvent } from './events';
import {
  CC_ID, CC_LEAGUE_ROUNDS, advanceChampionsCup, clearOldChampionsCup, startChampionsCup,
} from './international';
import { checkLoanReturn, generateLoanOffers } from './loan';
import { advanceTrophy, clearOldTrophy, startTrophy } from './trophy';
import { isWncYear, playWorldNationsCup, updateNationalStatus } from './national';
import { t, tDecimal, tVariant } from '../i18n';
import { remindContractExpiry } from './contract';
import { checkMatchMilestones } from './milestones';
import { gameCountryOfNation } from './nations';
import type { WncResult } from './types';
import {
  driftRelationships, mentorInfluence, mentorLeft, relationshipMoraleDrift, seedRelationships,
} from './relationships';
import { addCareerEvent, addNews, makeId, matchesOn } from './ids';
import { quickTeamRating, selectLineup, type Lineup } from './lineup';
import { MatchEngine, type MatchEngineSetup, type MatchOutcome } from './matchEngine';
import { autoResolveChallenge } from './ballAction';
import { simulateLight } from './matchSim';
import { calcMarketValue, calcSalary, generateAttributes } from './playerGen';
import { advanceAgent, createAgent } from './agent';
import { socialAfterMatch } from './social';
import { attendanceRoll, expectedAttendance, matchImportance } from './rivalry';
import { matchFormation } from './formation';
import { formatKickoff, matchKickoff } from './kickoff';
import { matchReferee } from './referee';
import { matchWeather, weatherEffect } from './weather';
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
/** Das Startland des Spielers. */
export const PLAYABLE_COUNTRY = 'falkenland';
/** Pseudo-Land fuer internationale Wettbewerbe. */
export const INTERNATIONAL = 'international';

/** Baut einen Index Vereins-ID -> Kader, um wiederholte O(n)-Scans zu sparen. */
export function buildSquadIndex(players: Record<Id, Player>): Map<Id, Player[]> {
  const index = new Map<Id, Player[]>();
  for (const p of Object.values(players)) {
    if (!p.clubId) continue;
    let list = index.get(p.clubId);
    if (!list) { list = []; index.set(p.clubId, list); }
    list.push(p);
  }
  return index;
}

export interface NewGameOptions {
  saveName: string;
  seed?: number;
  difficulty: Difficulty;
  firstName: string;
  lastName: string;
  age: number;
  /** Herkunftsland des Spielers - eine Kennung aus nations.ts. */
  nationality: string;
  /**
   * In welchem Land die Laufbahn beginnt. Fehlt die Angabe, wird das
   * Herkunftsland genommen, sofern es bespielbar ist - so bleiben aeltere
   * Aufrufe gueltig, die beides noch nicht getrennt haben.
   */
  homeCountry?: string;
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
    fullCountryIds: COUNTRIES.map((c) => c.id),
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
    mentorId: null,
    pendingMatchId: null,
    cupState: {},
    offers: [],
    agent: createAgent(rng),
    honours: [],
    nationalCaps: 0,
    nationalGoals: 0,
    nationalNominated: false,
    wncHistory: [],
    nextId: counter.nextId,
  };

  const user = createUserPlayer(state, rng, opts);
  state.players[user.id] = user;
  state.userPlayerId = user.id;

  startSeason(state, rng);
  startChampionsCup(state, rng, null);
  startTrophy(state, rng, null);
  createObjectives(state);
  seedRelationships(state, rng);
  updateNationalStatus(state);

  const club = user.clubId ? state.clubs[user.clubId] : null;
  const spielerName = `${user.firstName} ${user.lastName}`;
  const vereinName = club?.name ?? t('gm.start.clubFallback');
  addCareerEvent(state, 'start', t('gm.start.title'),
    t('gm.start.body', {
      name: spielerName, club: vereinName,
      background: t(BACKGROUNDS[opts.background].name),
    }), { clubId: user.clubId ?? undefined });
  addNews(state, 'season', t('gm.start.news'),
    t('gm.start.newsBody', {
      name: spielerName, club: vereinName, season: seasonLabel(state.season),
    }), true);

  state.rngState = rng.state;
  return state;
}

/**
 * In welchem Land die Laufbahn spielt - nicht zwingend das Herkunftsland.
 * Ohne ausdrueckliche Wahl beginnt man dort, wo die eigene Nation ihr
 * Ligasystem hat; hat sie keines, im Standardland.
 */
export function homeCountryOf(opts: NewGameOptions): string {
  return COUNTRY_BY_ID[opts.homeCountry ?? '']?.id
    ?? COUNTRY_BY_ID[gameCountryOfNation(opts.nationality) ?? '']?.id
    ?? PLAYABLE_COUNTRY;
}

function createUserPlayer(state: GameState, rng: Rng, opts: NewGameOptions): Player {
  const bg = BACKGROUNDS[opts.background];
  // Die Attributneigung richtet sich nach dem Land, in dem er ausgebildet
  // wurde - also dem Spielland, nicht dem Pass.
  const country = COUNTRY_BY_ID[homeCountryOf(opts)];

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

  const club = pickStartingClub(state, rng, bg.startLevel, bg.clubReputationBand, homeCountryOf(opts));
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

/** Startverein im gewaehlten Spielland - nicht mehr fest im Standardland. */
function pickStartingClub(
  state: GameState, rng: Rng, level: number, band: [number, number],
  countryId: string = PLAYABLE_COUNTRY,
) {
  const league = leaguesOfCountry(state, countryId).find((l) => l.level === level);
  const pool = (league?.clubIds ?? [])
    .map((id) => state.clubs[id])
    .filter((c) => c && c.reputation >= band[0] && c.reputation <= band[1]);
  if (pool.length === 0) {
    const fallback = leaguesOfCountry(state, countryId)[level - 1];
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

  // Vorlagen passen zum Mittelfeld besser als ein niedriges Torziel.
  const assistTarget = line === 'MID' ? Math.max(3, Math.round(ability / 13))
    : line === 'ATT' ? Math.max(2, Math.round(ability / 20)) : 1;

  // Die Note haengt an der Rolle. Fest 6,8 fuer alle war eine Dauerabsage:
  // Gemessen ueber sieben Saisons einer starken Laufbahn lagen die
  // Saisonnoten zwischen 6,31 und 6,72, und vergleichbare
  // computergesteuerte Spieler liegen noch darunter. Ein Ziel, das nie
  // faellt, kostet seit der Abrechnung jede Saison Trainerbeziehung.
  const ratingTarget = role === 'Schluesselspieler' || role === 'Mannschaftsfuehrer' ? 6.8
    : role === 'Stammspieler' ? 6.65
    : role === 'Rotationsspieler' ? 6.5 : 6.4;

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
      id: 'apps', kind: 'appearances',
      label: t('obj.apps.label', { n: appearanceTarget }),
      target: appearanceTarget, current: 0, done: false, failed: false,
      reward: t('obj.apps.reward'),
    },
    // Stuermer werden an Toren gemessen, das Mittelfeld an Vorlagen. Vorher
    // bekam ein Zehner ein Torziel von zwei bis vier - eine Vorgabe, die
    // weder fordert noch etwas ueber seine Rolle aussagt.
    line === 'MID'
      ? {
        id: 'assists', kind: 'assists' as const,
        label: t('obj.assists.label', { n: assistTarget }),
        target: assistTarget, current: 0, done: false, failed: false,
        reward: t('obj.assists.reward'),
      }
      : {
        id: 'goals', kind: 'goals' as const,
        label: t('obj.goals.label', { n: goalTarget }),
        target: goalTarget, current: 0, done: false, failed: false,
        reward: t('obj.goals.reward'),
      },
    {
      id: 'rating', kind: 'rating',
      label: t('obj.rating.label', { n: tDecimal(ratingTarget) }),
      target: ratingTarget, current: 0, done: false, failed: false,
      reward: t('obj.rating.reward'),
    },
    {
      id: 'team', kind: 'teamPosition',
      label: rank <= 4 ? t('obj.team.title')
        : rank <= 12 ? t('obj.team.single', { club: club.short })
        : t('obj.team.survive'),
      target: rank <= 4 ? 3 : rank <= 12 ? 9 : 17,
      current: 0, done: false, failed: false,
      reward: t('obj.team.reward'),
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
  const assists = entries.reduce((a, s) => a + s.assists, 0);
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
      case 'assists': obj.current = assists; obj.done = assists >= obj.target; break;
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
  wnc: WncResult | null;
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
    lifeEvent: null, wnc: null, headlines: [],
  };

  const today = matchesOn(state, state.date).filter((m) => !m.played);
  const userMatch = today.find((m) => involvesUserClub(state, m));

  if (userMatch) {
    state.pendingMatchId = userMatch.id;
    result.matchToPlay = userMatch.id;
    announceDerby(state, userMatch);
    state.rngState = rng.state;
    return result;
  }

  if (today.length > 0) {
    // Kader-Index einmal je Tag bauen statt pro Spiel ueber alle Spieler zu scannen.
    const index = buildSquadIndex(state.players);
    const fullCountry = userClub(state)?.countryId ?? PLAYABLE_COUNTRY;
    for (const match of today) {
      const comp = state.competitions[match.competitionId];
      // Volle Detailtiefe fuer das Land des Spielers und internationale Spiele.
      const full = !comp || comp.countryId === fullCountry || comp.countryId === INTERNATIONAL;
      simulateBackgroundMatch(state, match, rng, index, full);
    }
  }

  // Training: einmal pro Woche am Freitag (Abschlusstraining)
  const user = state.players[state.userPlayerId];
  if (user && weekday(state.date) === 5 && !user.injury) {
    const club = user.clubId ? state.clubs[user.clubId] : null;
    result.training = applyTraining(
      rng, user, state.training.focus, state.training.intensity,
      club?.training ?? 50, state.date, DIFFICULTY_SETTINGS[state.difficulty], user.sharpness,
      state.training.individualGoal, mentorInfluence(state),
    );
    if (result.training.injured) {
      addNews(state, 'injury', t('gm.trainInjury.title'),
        t('gm.trainInjury.body', {
          last: user.lastName,
          injury: t(result.training.injured.name),
          n: result.training.injured.totalDays,
        }), true);
      result.headlines.push(t('gm.headline.injury', { injury: t(result.training.injured.name) }));
    }
  }

  // Verlaesst der Mentor den Verein, geht mehr als ein Name aus dem Kader:
  // Sein Trainingsvorteil faellt weg. Das soll man erfahren, nicht nur spueren.
  const ehemaligerMentor = mentorLeft(state);
  if (ehemaligerMentor && user) {
    const mentorName = `${ehemaligerMentor.firstName} ${ehemaligerMentor.lastName}`;
    addNews(state, 'transfer', t('gm.mentorGone.title'),
      t('gm.mentorGone.body', { mentor: mentorName }), true);
    addCareerEvent(state, 'other', t('gm.mentorGone.event'),
      t('gm.mentorGone.eventBody', { mentor: mentorName }));
    user.morale = clamp(user.morale - 6, 0, 100);
  }

  // Der Berater arbeitet im Hintergrund weiter (Konzept Abschnitt 35).
  advanceAgent(state, rng);
  // Endet eine Leihe, kehrt der Spieler zum Stammverein zurueck (Abschnitt 34).
  checkLoanReturn(state, rng);
  // Wintertransferfenster (Abschnitt 34): Wer bis zur Winterpause kaum gespielt
  // hat, muss nicht die ganze Saison auf der Bank sitzen, sondern bekommt schon
  // zur Halbserie Leihangebote. Ohne das dauert der erste Einsatz bei einem
  // Spitzenverein leicht eine komplette Spielzeit.
  if (month(state.date) === 1 && dayOfMonth(state.date) === 3) {
    generateLoanOffers(state, rng);
  }
  // Ein auslaufender Vertrag soll auffallen, bevor er ausgelaufen ist.
  remindContractExpiry(state);

  // Taegliche Regeneration und Formentwicklung. Massgeblich ist, ob der EIGENE
  // Verein heute gespielt hat - nicht, ob irgendwo auf der Welt ein Spiel lief.
  // Sonst wuerde in der Saison (taeglich Spiele) niemand je regenerieren.
  const playedClubs = new Set<Id>();
  for (const m of today) { playedClubs.add(m.homeClubId); playedClubs.add(m.awayClubId); }
  for (const player of Object.values(state.players)) {
    advancePlayerDay(rng, player, player.clubId ? playedClubs.has(player.clubId) : false);
    if (weekday(state.date) === 1) driftForm(player);
  }
  // Montags wirkt das Beziehungsumfeld leicht auf die Moral des Spielers.
  if (user && weekday(state.date) === 1) {
    user.morale = clamp(user.morale + relationshipMoraleDrift(state), 0, 100);
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
  advanceChampionsCup(state, rng);
  advanceTrophy(state);

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
    addNews(state, 'season', t('gm.leagueDone.title'), t('gm.leagueDone.body'), false);
  }

  if (state.seasonPhase === 'postSeason' && postSeasonFinished(state)) {
    const report = endSeason(state, rng);
    result.seasonReport = report;
    // Neue Auflage des internationalen Wettbewerbs mit den Qualifikanten der
    // gerade beendeten Saison.
    clearOldChampionsCup(state);
    startChampionsCup(state, rng, report.season);
    clearOldTrophy(state);
    startTrophy(state, rng, report.season);
    updateNationalStatus(state);
    // World Nations Cup im Sommer eines Turnierjahres.
    if (isWncYear(report.season)) {
      result.wnc = playWorldNationsCup(state, rng);
    }
    createObjectives(state);
    addNews(state, 'season',
      t('gm.seasonDone.title', { season: seasonLabel(report.season) }),
      t('gm.seasonDone.body'), true);
  }
}

/**
 * Vorbericht zu einem bedeutenden Spiel des eigenen Vereins. Ein Derby soll
 * schon vor dem Anpfiff spuerbar sein (Konzept Abschnitt 26).
 */
function announceDerby(state: GameState, match: Match) {
  const importance = matchImportance(state, match);
  if (!importance.derby) return;
  const user = state.players[state.userPlayerId];
  const oppId = user?.clubId === match.homeClubId ? match.awayClubId : match.homeClubId;
  const opponent = state.clubs[oppId];
  if (!opponent) return;
  // Nicht doppelt melden, wenn der Tag mehrfach betreten wird.
  const already = state.news.some(
    (n) => n.date === state.date && n.headline.startsWith(importance.label ?? ''));
  if (already) return;

  addNews(state, 'match',
    t('derby.announce', { label: importance.label ?? '', opponent: opponent.name }),
    importance.derby
      ? t(`derby.text.${importance.derby}`, { opponent: opponent.name })
      : '', true);
}

// --- Hintergrundspiele -------------------------------------------------

function simulateBackgroundMatch(
  state: GameState, match: Match, rng: Rng,
  index: Map<Id, Player[]>, fullDetail: boolean,
) {
  const homeClub = state.clubs[match.homeClubId];
  const awayClub = state.clubs[match.awayClubId];
  if (!homeClub || !awayClub) { match.played = true; return; }

  const homeSquad = index.get(homeClub.id) ?? [];
  const awaySquad = index.get(awayClub.id) ?? [];

  // Niedrige Detailstufe fuer entfernte Ligen (Konzept Abschnitt 56):
  // nur Ergebnis und Tabelle, keine Einzelstatistiken - spart Zeit und Speicher.
  if (!fullDetail) {
    simulateResultOnly(state, match, rng, homeSquad, awaySquad);
    return;
  }

  const result = simulateLight(
    rng, match.id, homeClub, awayClub, homeSquad, awaySquad, match.neutralVenue,
    matchWeather(match.id, match.date),
    matchReferee(match.id, homeClub.countryId).style,
  );

  const homeScore = result.homeScore;
  const awayScore = result.awayScore;
  let penalties: [number, number] | null = null;

  if (isKnockout(state, match) && homeScore === awayScore) {
    penalties = shootoutFrom(rng, homeSquad, awaySquad);
  }

  commitMatch(state, match, {
    homeScore, awayScore, penalties,
    stats: result.appearances,
    injuries: result.injuries,
    events: buildLightEvents(state, match, result),
  }, rng, index);

  for (const s of result.appearances) {
    const p = state.players[s.playerId];
    if (!p) continue;
    p.fitness = clamp(p.fitness - (26 + rng.float(0, 10)) * (s.minutes / 90), 8, 100);
  }
}

/** Ergebnis-nur-Simulation fuer Hintergrundligen ohne Einzelstatistik. */
function simulateResultOnly(
  state: GameState, match: Match, rng: Rng, homeSquad: Player[], awaySquad: Player[],
) {
  const homeRating = quickTeamRating(homeSquad);
  const awayRating = quickTeamRating(awaySquad);
  const diff = (homeRating - awayRating) / 9;
  const advantage = match.neutralVenue ? 0 : 0.26;
  // Dieselbe Wetterwirkung wie in den beiden anderen Tiefen.
  const w = weatherEffect(matchWeather(match.id, match.date));
  const nass = (w.accuracy + w.longShot) / 2;
  const homeScore = rng.poisson(clamp((1.32 + diff * 0.44 + advantage) * nass, 0.18, 5));
  const awayScore = rng.poisson(clamp((1.12 - diff * 0.44) * nass, 0.14, 4.6));

  match.homeScore = homeScore;
  match.awayScore = awayScore;
  match.played = true;
  match.attendance = 0;

  if (isKnockout(state, match) && homeScore === awayScore) {
    match.penalties = shootoutFrom(rng, homeSquad, awaySquad);
  }
  if (state.competitions[match.competitionId]?.type === 'league') {
    applyResultToTable(state, match);
  }

  // Leichte Fitnessbelastung fuer die voraussichtliche Startelf.
  const drain = (squad: Player[]) => {
    for (const p of squad.slice().sort((a, b) => b.fitness - a.fitness).slice(0, 11)) {
      p.fitness = clamp(p.fitness - (24 + rng.float(0, 10)), 8, 100);
    }
  };
  drain(homeSquad);
  drain(awaySquad);

  // Auch in den nur ergebnisorientiert simulierten Ligen verletzen sich Spieler -
  // sonst haetten vier von fuenf Laendern dauerhaft kerngesunde Kader, was
  // Kaderstaerken und Transfers verzerrt. Ein Wurf je Mannschaft genuegt.
  for (const squad of [homeSquad, awaySquad]) {
    if (squad.length === 0 || !rng.chance(0.14)) continue;
    const fit = squad.filter((p) => !p.injury);
    if (fit.length === 0) continue;
    const victim = rng.weighted(fit, (p) => 0.5 + p.injuryProneness / 90);
    const days = Math.max(3, Math.round(rng.normal(16, 14)));
    injuryForDays(rng, victim, days);
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
        text: t('gm.scores', {
          name: p ? `${p.firstName.charAt(0)}. ${p.lastName}` : t('gm.unknownPlayer'),
        }),
      };
    });
  void match;
}

function isKnockout(state: GameState, match: Match): boolean {
  const comp = state.competitions[match.competitionId];
  if (comp?.type !== 'cup') return false;
  // Die Ligaphase des Champions Cup laesst Unentschieden zu.
  if (match.competitionId === CC_ID && (match.matchday ?? 0) <= CC_LEAGUE_ROUNDS) return false;
  return true;
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
  // Was fuer eine Grundordnung an diesem Tag: die des Vereins, oder eine
  // Stufe vorsichtiger beziehungsweise mutiger, je nach Kraefteverhaeltnis
  // und Platz. Vorher spielte jeder Verein immer dieselbe.
  const heimStaerke = quickTeamRating(homeSquad);
  const gastStaerke = quickTeamRating(awaySquad);
  const heimOrdnung = matchFormation({
    basis: homeClub.formation, eigene: heimStaerke, gegner: gastStaerke,
    daheim: !match.neutralVenue, matchId: match.id, clubId: homeClub.id,
  });
  const gastOrdnung = matchFormation({
    basis: awayClub.formation, eigene: gastStaerke, gegner: heimStaerke,
    daheim: false, matchId: match.id, clubId: awayClub.id,
  });

  const homeLineup = selectLineup(homeClub, homeSquad, {
    coachRelation: user?.clubId === homeClub.id ? state.coachRelation : 50,
    rotate,
    userBonus: DIFFICULTY_SETTINGS[state.difficulty].playtimeBonus,
    formation: heimOrdnung,
  });
  const awayLineup = selectLineup(awayClub, awaySquad, {
    coachRelation: user?.clubId === awayClub.id ? state.coachRelation : 50,
    rotate,
    userBonus: DIFFICULTY_SETTINGS[state.difficulty].playtimeBonus,
    formation: gastOrdnung,
  });

  const userLineup = user?.clubId === homeClub.id ? homeLineup
    : user?.clubId === awayClub.id ? awayLineup : null;
  const userInLineup = !!userLineup?.starters.some((s) => s.playerId === state.userPlayerId);
  const userOnBench = !!userLineup?.bench.includes(state.userPlayerId);

  return {
    setup: {
      matchId: match.id,
      competitionName: state.competitions[match.competitionId]?.name ?? t('gm.matchFallback'),
      homeClub, awayClub, homeLineup, awayLineup, homeSquad, awaySquad,
      userPlayerId: state.userPlayerId,
      interactive,
      difficulty: DIFFICULTY_SETTINGS[state.difficulty],
      neutral: match.neutralVenue,
      knockout: isKnockout(state, match),
      relationships: state.relationships,
      importance: matchImportance(state, match),
      attendance: expectedAttendance(state, match, attendanceRoll(match.id)),
      weather: matchWeather(match.id, match.date),
      kickoff: (() => {
        const k = matchKickoff(match.id, match.date);
        return { text: formatKickoff(k), flutlicht: k.flutlicht };
      })(),
      refereeStyle: matchReferee(match.id, homeClub.countryId).style,
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
/**
 * Spielt eine eigene Partie ohne Zutun des Nutzers durch.
 *
 * Genau derselbe Weg wie der Simulationsmodus im Spielbildschirm: volle
 * Spielmaschine, nur ohne Szenen zum Selbstspielen. Wichtig, dass es
 * dieselbe ist - sonst haette ein uebersprungenes Spiel eine andere Physik
 * als ein gespieltes, und der Kalender waere ein zweiter, stiller
 * Schwierigkeitsgrad.
 *
 * Wird vom Kalender gebraucht, wenn man ueber eigene Spieltage hinweg
 * vorspulen will.
 */
export function simulateUserMatch(state: GameState, matchId: Id): MatchOutcome | null {
  const vorbereitet = prepareUserMatch(state, matchId, false);
  if (!vorbereitet) return null;

  const rng = new Rng(state.rngState);
  const engine = new MatchEngine({ ...vorbereitet.setup, rng, interactive: false });
  const user = state.players[state.userPlayerId];
  engine.runToEnd((c) =>
    autoResolveChallenge(c, user, DIFFICULTY_SETTINGS[state.difficulty], rng));
  const ergebnis = engine.finish();
  state.rngState = rng.state;

  finishUserMatch(state, matchId, ergebnis);
  return ergebnis;
}

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

function commitMatch(
  state: GameState, match: Match, input: CommitInput, rng: Rng,
  index?: Map<Id, Player[]>,
) {
  match.homeScore = input.homeScore;
  match.awayScore = input.awayScore;
  match.played = true;
  match.penalties = input.penalties ?? undefined;
  match.extraTime = input.extraTime;
  match.events = input.events;

  // Zuschauerzahl aus Stadion, Zugkraft des Gegners und Bedeutung der Partie.
  match.attendance = expectedAttendance(state, match, attendanceRoll(match.id));

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
    const eigener = player.id === state.userPlayerId;
    if (s.redCards > 0) {
      player.suspension += 2;
      if (eigener) {
        addNews(state, 'match', t('susp.red.title'),
          t('susp.red.body', { last: player.lastName }), true);
        addCareerEvent(state, 'other', t('susp.red.event'),
          t('susp.red.eventBody'));
      }
    }
    if (s.yellowCards > 0 && isLeague) {
      player.yellowCardsInLeague += s.yellowCards;
      if (player.yellowCardsInLeague >= 5) {
        player.yellowCardsInLeague = 0;
        player.suspension += 1;
        if (eigener) {
          addNews(state, 'match', t('susp.fifth.title'),
            t('susp.fifth.body', { last: player.lastName }), true);
        }
      } else if (eigener && player.yellowCardsInLeague === 4) {
        // Die Warnung vor der Sperre ist der eigentliche Spielinhalt: Ab hier
        // kostet jede Verwarnung ein Spiel, und das soll man wissen, bevor es
        // passiert - nicht danach.
          addNews(state, 'match', t('susp.warn.title'),
            t('susp.warn.body', { last: player.lastName }), false);
      }
    }
  }

  // Sperren der nicht eingesetzten Spieler abbauen
  for (const clubId of [match.homeClubId, match.awayClubId]) {
    for (const p of (index?.get(clubId) ?? squadOf(state.players, clubId))) {
      const played = input.stats.some((s) => s.playerId === p.id && s.minutes > 0);
      if (!played && p.suspension > 0) p.suspension -= 1;
    }
  }

  for (const inj of input.injuries) {
    const p = state.players[inj.playerId];
    if (!p || p.injury) continue;
    // Erst steht die Dauer fest, dann die passende Art dazu.
    const injury = injuryForDays(rng, p, inj.days);
    if (p.isUser) {
      addNews(state, 'injury', t('gm.matchInjury.title'),
        t('gm.matchInjury.body', {
          last: p.lastName, n: inj.days, injury: t(injury.name),
        }), true);
      // Nur laengere Ausfaelle gehoeren in die Chronik. Eine Prellung ueber
      // fuenf Tage ist kein Meilenstein und verwaessert die Laufbahn nur.
      if (inj.days >= 21) {
        addCareerEvent(state, 'injury',
          t(inj.days >= 90 ? 'gm.injury.severe' : 'gm.injury.long'),
          t('gm.injury.body', { injury: t(injury.name), n: inj.days }));
      }
    }
  }

  if (userStats) {
    // Gemeinsame Einsatzzeit entwickelt die Beziehungen zu den Mitspielern.
    const user = state.players[state.userPlayerId];
    if (user?.clubId) {
      const teammates = input.stats
        .filter((s) => s.clubId === user.clubId && s.minutes > 0 && s.playerId !== user.id)
        .map((s) => s.playerId);
      driftRelationships(state, teammates, rng);
    }
    handleUserMatchAftermath(state, match, userStats, input, rng);
  }
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
  state: GameState, match: Match, s: PlayerMatchStats, input: CommitInput, rng: Rng,
) {
  const user = state.players[state.userPlayerId];
  if (!user) return;
  const comp = state.competitions[match.competitionId];
  const opponentId = s.clubId === match.homeClubId ? match.awayClubId : match.homeClubId;
  const opponent = state.clubs[opponentId];
  const scoreText = `${input.homeScore}:${input.awayScore}`;

  // Trainerbeziehung und Fansympathie (Konzept Abschnitt 29).
  // Bezugspunkt ist eine durchschnittliche Partie (Note 6,2). Frueher lag die
  // Messlatte bei 6,5 und damit ueber dem, was ein normaler Spieler erreicht -
  // die Beziehung sank dadurch selbst bei solider Leistung jedes Spiel weiter.
  const AVERAGE_RATING = 6.2;
  const coachPerf = (s.rating - AVERAGE_RATING) * 2.4 + (s.motm ? 1.5 : 0);
  const fanPerf = (s.rating - AVERAGE_RATING) * 1.6 + s.goals * 2.2;
  // Je naeher die Beziehung schon am Rand liegt, desto zaeher wird der naechste
  // Schritt in dieselbe Richtung. So pendelt sie sich ein, statt zu driften.
  //
  // Nach OBEN laeuft die Daempfung gegen null: Fruehe Versionen hatten auch
  // hier einen Boden von 0,3, wodurch selbst bei 100 noch etwas dazukam - die
  // Fanbeliebtheit klebte dann dauerhaft am Anschlag und war als Groesse tot.
  // Nach UNTEN bleibt der Boden, damit eine Beziehung immer fallen kann,
  // egal wie gut sie war.
  const damp = (value: number, delta: number) => {
    const raum = delta >= 0 ? 100 - value : value;
    return delta * clamp(raum / 45, delta >= 0 ? 0 : 0.3, 1);
  };
  state.coachRelation = clamp(state.coachRelation + damp(state.coachRelation, coachPerf), 0, 100);
  state.fanRelation = clamp(state.fanRelation + damp(state.fanRelation, fanPerf), 0, 100);

  // Nachwirkung der Halbzeitentscheidung auf Moral und Trainerbeziehung.
  if (input.moraleDelta) {
    user.morale = clamp(user.morale + input.moraleDelta, 0, 100);
    state.coachRelation = clamp(state.coachRelation + input.moraleDelta * 0.4, 0, 100);
  }

  // Die Oeffentlichkeit meldet sich zu Wort (Konzept Abschnitt 40).
  {
    const socialRng = new Rng(state.rngState);
    const own = s.clubId === match.homeClubId ? input.homeScore : input.awayScore;
    const opp = s.clubId === match.homeClubId ? input.awayScore : input.homeScore;
    socialAfterMatch(state, s, own, opp, opponent?.name ?? 'den Gegner', socialRng);
    state.rngState = socialRng.state;
  }

  // Ein Derby wiegt schwerer als ein gewoehnliches Spiel: Der Ausgang schlaegt
  // bei Fans und Moral deutlicher durch (Konzept Abschnitt 26).
  const importance = matchImportance(state, match);
  if (importance.derby && opponent) {
    const ownGoals = s.clubId === match.homeClubId ? input.homeScore : input.awayScore;
    const oppGoals = s.clubId === match.homeClubId ? input.awayScore : input.homeScore;
    const weight = importance.derby === 'city' ? 1 : importance.derby === 'traditional' ? 0.85 : 0.6;
    if (ownGoals > oppGoals) {
      state.fanRelation = clamp(state.fanRelation + 6 * weight, 0, 100);
      user.morale = clamp(user.morale + 7 * weight, 0, 100);
      addNews(state, 'match',
        t('derby.won.title', { label: importance.label ?? '' }),
        tVariant('derby.won.body', rng.next(), { score: scoreText, opponent: opponent.name }), true);
      // Ein eigenes Tor im Derby ist ein Karrieremoment - aber kein Titel.
      // Als `title` verbucht landete es in derselben Reihe wie eine
      // Meisterschaft, und das mehrfach pro Laufbahn.
      //
      // Und nicht jedes Tor: Gemessen bestanden zwei Fuenftel der Chronik aus
      // Derbytoren. Aufgenommen wird deshalb, was auch wirklich ein Moment
      // war - mehrere Tore, oder ein knapper Sieg, den das eigene Tor
      // entschieden hat. Das dritte Tor beim 5:0 gehoert in die Statistik.
      const knapp = ownGoals - oppGoals <= 1;
      const denkwuerdig = s.goals >= 2 || (knapp && s.goals > 0);
      if (denkwuerdig) {
        addCareerEvent(state, 'derby',
          t('derby.goal.title', { label: importance.label ?? '' }),
          t(s.goals === 1 ? 'derby.goal.one' : 'derby.goal.many', {
            n: s.goals, opponent: opponent.name, score: scoreText,
          }), { clubId: user.clubId ?? undefined });
      }
    } else if (ownGoals < oppGoals) {
      state.fanRelation = clamp(state.fanRelation - 5 * weight, 0, 100);
      user.morale = clamp(user.morale - 6 * weight, 0, 100);
      addNews(state, 'match',
        t('derby.lost.title', { label: importance.label ?? '' }),
        tVariant('derby.lost.body', rng.next(), { score: scoreText, opponent: opponent.name }), true);
    }
  }

  // Reputation und Marktwert
  const league = user.clubId ? state.competitions[state.clubs[user.clubId]?.leagueId] : null;
  user.reputation = clamp(
    user.reputation + (s.rating - 6.6) * 0.5 + s.goals * 0.8 + (s.motm ? 0.6 : 0), 1, 99);
  const ability = computeOverall(user.attrs, user.position);
  user.marketValue = calcMarketValue(
    ability, user.potential, ageOn(user.birthDate, state.date), user.position, league?.level ?? 3);

  const gegnerName = opponent?.name ?? t('gm.opponentFallback');
  const career = state.userMatchStats;
  const totalApps = career.length;

  if (totalApps === 1) {
    addCareerEvent(state, 'debut', t('gm.debut.title'),
      t('gm.debut.body', { opponent: gegnerName, score: scoreText }),
      { clubId: user.clubId ?? undefined, competitionId: match.competitionId });
    addNews(state, 'match', t('gm.debut.news'),
      t('gm.debut.newsBody', { name: `${user.firstName} ${user.lastName}` }), true);
  }

  const careerGoals = career.reduce((a, x) => a + x.goals, 0);
  if (s.goals > 0 && careerGoals === s.goals) {
    addCareerEvent(state, 'firstGoal', t('gm.firstGoal.title'),
      t('gm.firstGoal.body', { opponent: gegnerName, date: formatShort(match.date) }),
      { clubId: user.clubId ?? undefined, competitionId: match.competitionId });
  }
  const careerAssists = career.reduce((a, x) => a + x.assists, 0);
  if (s.assists > 0 && careerAssists === s.assists) {
    addCareerEvent(state, 'firstAssist', t('gm.firstAssist.title'),
      t('gm.firstAssist.body', { opponent: gegnerName }),
      { clubId: user.clubId ?? undefined });
  }
  // Laufende Marken: Ohne sie schweigt die Chronik, sobald die Premieren
  // durch sind - und das ist bereits nach wenigen Monaten der Fall.
  checkMatchMilestones(state,
    { apps: totalApps - 1, goals: careerGoals - s.goals, assists: careerAssists - s.assists },
    { apps: totalApps, goals: careerGoals, assists: careerAssists },
    {
      clubId: user.clubId ?? undefined,
      competitionId: match.competitionId,
      clubName: user.clubId ? state.clubs[user.clubId]?.name : undefined,
    }, rng);

  if (s.goals >= 3) {
    addCareerEvent(state, 'hattrick', t('gm.hattrick.title'),
      t('gm.hattrick.body', { n: s.goals, opponent: gegnerName, score: scoreText }),
      { clubId: user.clubId ?? undefined, competitionId: match.competitionId });
    addNews(state, 'match', t('gm.hattrick.news'),
      t('gm.hattrick.newsBody', { last: user.lastName, n: s.goals, opponent: gegnerName }),
      true);
  }

  const summary = s.goals > 0 || s.assists > 0
    ? t('gm.report.withGoals', {
      goals: s.goals, assists: s.assists, rating: tDecimal(s.rating, 1),
    })
    : t('gm.report.plain', { rating: tDecimal(s.rating, 1), minutes: s.minutes });
  addNews(state, 'match',
    t('gm.report.headline', {
      comp: comp?.short ?? t('gm.matchFallback'),
      home: state.clubs[match.homeClubId]?.short ?? '',
      score: scoreText,
      away: state.clubs[match.awayClubId]?.short ?? '',
    }),
    t('gm.report.body', { last: user.lastName, summary }), s.goals > 0 || s.motm);
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

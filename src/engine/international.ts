/**
 * Continental Champions Cup - der internationale Vereinswettbewerb
 * (Konzept Abschnitt 10).
 *
 * Ablauf je Saison:
 *  - 24 Mannschaften qualifizieren sich (Verteilung nach Laendern).
 *  - Ligaphase: acht Spieltage, eine gemeinsame Tabelle.
 *  - K.-o.-Phase: die besten 16 spielen Achtelfinale bis Finale (ein Spiel je
 *    Runde), das Finale in einem neutralen Stadion.
 *
 * Die Ligaphasen-Tabelle wird bei Bedarf aus den gespielten Spielen abgeleitet,
 * damit sie sich nicht mit den nationalen Ligatabellen vermischt.
 */
import { COUNTRIES } from './countries';
import { makeDate, type GameDate } from './date';
import { buildLeagueSchedule } from './fixtures';
import { addCareerEvent, addMatch, addNews, makeId } from './ids';
import { Rng } from './rng';
import { buildTable, sortTable } from './table';
import { leaguesOfCountry, tableKey } from './season';
import type { Club, Competition, GameState, Id, Match, TableRow } from './types';
import { t } from '../i18n';

export const CC_ID = 'cc';
export const CC_NAME = 'Continental Champions Cup';
/** Ab diesem Spieltag beginnt die K.-o.-Phase. */
const KO_BASE = 100;
const LEAGUE_ROUNDS = 8;

/** K.-o.-Runden als Katalogschluessel, nicht als fertiger Text. */
const KO_ROUNDS = ['round.r16', 'round.quarter', 'round.semi', 'round.final'] as const;

/** Startplaetze je Land, nach Laenderreputation absteigend: 5,5,5,5,4 = 24. */
function slotsPerCountry(): Record<Id, number> {
  const ranked = COUNTRIES.slice().sort((a, b) => b.reputation - a.reputation);
  const slots: Record<Id, number> = {};
  ranked.forEach((c, i) => { slots[c.id] = i < 4 ? 5 : 4; });
  return slots;
}

/**
 * Bestimmt die 24 Teilnehmer. In der ersten Saison nach Reputation, danach
 * ueber die Abschlussplatzierung der ersten Ligen der Vorsaison.
 */
export function qualifyForChampionsCup(state: GameState, prevSeason: number | null): Id[] {
  const slots = slotsPerCountry();
  const qualifiers: Id[] = [];

  for (const country of COUNTRIES) {
    const firstLeague = leaguesOfCountry(state, country.id).find((l) => l.level === 1);
    if (!firstLeague) continue;
    const n = slots[country.id] ?? 4;

    let ordered: Id[];
    const prevTable = prevSeason !== null
      ? state.tables[tableKey(firstLeague.id, prevSeason)] : undefined;
    if (prevTable && Object.keys(prevTable).length > 0) {
      const prevMatches = Object.values(state.matches).filter(
        (m) => m.competitionId === firstLeague.id && m.season === prevSeason);
      ordered = sortTable(prevTable, prevMatches).map((r) => r.clubId);
    } else {
      ordered = firstLeague.clubIds
        .map((id) => state.clubs[id])
        .filter(Boolean)
        .sort((a, b) => b.reputation - a.reputation)
        .map((c) => c.id);
    }
    qualifiers.push(...ordered.slice(0, n));
  }

  return qualifiers.slice(0, 24);
}

/** Zwoelf Termine unter der Woche fuer die internationalen Spiele. */
function internationalDates(season: number): GameDate[] {
  const dates: GameDate[] = [];
  // Ligaphase September bis Januar, K.-o. Februar bis Mai.
  const anchors: [number, number][] = [
    [9, 16], [9, 30], [10, 21], [11, 4], [11, 25], [12, 9], [1, 20], [2, 3], // Ligaphase (8)
    [2, 24], [3, 17], [4, 28], [5, 20], // Achtel, Viertel, Halb, Finale
  ];
  for (const [m, d] of anchors) {
    const year = m >= 8 ? season : season + 1;
    dates.push(makeDate(year, m, d));
  }
  return dates;
}

/** Legt den Wettbewerb an und plant die Ligaphase. */
export function startChampionsCup(state: GameState, rng: Rng, prevSeason: number | null) {
  const qualifiers = qualifyForChampionsCup(state, prevSeason);
  if (qualifiers.length < 8) return;

  const competition: Competition = {
    id: CC_ID,
    countryId: 'international',
    name: CC_NAME,
    short: 'CCC',
    type: 'cup',
    level: 0,
    clubIds: qualifiers,
    reputation: 95,
  };
  state.competitions[CC_ID] = competition;

  const dates = internationalDates(state.season);

  // Acht Spieltage aus einer 24er-Turnierrunde: jeder trifft acht verschiedene
  // Gegner, vier Heim- und vier Auswaertsspiele.
  const full = buildLeagueSchedule(rng, {
    competitionId: CC_ID,
    season: state.season,
    clubIds: qualifiers,
    makeId: () => makeId(state, 'm'),
  });
  const leaguePhase = full.filter((m) => m.matchday <= LEAGUE_ROUNDS);
  for (const m of leaguePhase) {
    m.roundName = t('round.leaguePhase');
    m.date = dates[m.matchday - 1];
    addMatch(state, m);
  }

  state.cupState[CC_ID] = { round: 0, alive: qualifiers.slice(), finished: false };

  const userClubId = state.players[state.userPlayerId]?.clubId;
  if (userClubId && qualifiers.includes(userClubId)) {
    addNews(state, 'season',
      t('eu.cc.news', { club: state.clubs[userClubId]?.name ?? '', competition: CC_NAME }),
      t('eu.cc.newsBody'), true);
    addCareerEvent(state, 'international', t('eu.cc.eventTitle'),
      t('eu.cc.eventBody', {
        club: state.clubs[userClubId]?.name ?? '', competition: CC_NAME,
      }), { competitionId: CC_ID });
  }
}

/** Ableitung der Ligaphasen-Tabelle aus den bisher gespielten Spielen. */
export function championsCupTable(state: GameState): TableRow[] {
  const comp = state.competitions[CC_ID];
  if (!comp) return [];
  const matches = Object.values(state.matches).filter(
    (m) => m.competitionId === CC_ID && m.season === state.season
      && (m.matchday ?? 0) <= LEAGUE_ROUNDS);
  return sortTable(buildTable(comp.clubIds, matches), matches);
}

function ccMatch(
  state: GameState, matchday: number, roundName: string, date: GameDate,
  home: Id, away: Id, neutral = false,
): Match {
  return {
    id: makeId(state, 'm'),
    competitionId: CC_ID,
    season: state.season,
    matchday,
    roundName,
    date,
    homeClubId: home,
    awayClubId: away,
    homeScore: null,
    awayScore: null,
    played: false,
    neutralVenue: neutral,
  };
}

/** Sieger eines K.-o.-Spiels (mit Elfmeterschiessen bei Gleichstand). */
function winnerOf(m: Match): Id | null {
  if (!m.played || m.homeScore === null || m.awayScore === null) return null;
  if (m.homeScore > m.awayScore) return m.homeClubId;
  if (m.awayScore > m.homeScore) return m.awayClubId;
  if (m.penalties) return m.penalties[0] > m.penalties[1] ? m.homeClubId : m.awayClubId;
  return m.homeClubId;
}

/**
 * Treibt den Wettbewerb voran: seedet die K.-o.-Phase, sobald die Ligaphase
 * gespielt ist, und laedt die naechste Runde nach jeder K.-o.-Runde.
 * round 0 = Ligaphase, 1..4 = Achtel..Finale.
 */
export function advanceChampionsCup(state: GameState, _rng: Rng): boolean {
  const info = state.cupState[CC_ID];
  if (!info || info.finished) return false;
  const dates = internationalDates(state.season);

  if (info.round === 0) {
    // Warten, bis alle Ligaphasen-Spiele absolviert sind.
    const phase = Object.values(state.matches).filter(
      (m) => m.competitionId === CC_ID && m.season === state.season
        && (m.matchday ?? 0) <= LEAGUE_ROUNDS);
    if (phase.length === 0 || phase.some((m) => !m.played)) return false;

    // Die besten 16 ziehen ins Achtelfinale, gesetzt 1 gegen 16 usw.
    const top16 = championsCupTable(state).slice(0, 16).map((r) => r.clubId);
    if (top16.length < 16) { info.finished = true; return true; }
    const matches: Match[] = [];
    for (let i = 0; i < 8; i++) {
      matches.push(ccMatch(state, KO_BASE, t('round.r16'), dates[8], top16[i], top16[15 - i]));
    }
    for (const m of matches) addMatch(state, m);
    info.round = 1;
    info.alive = top16;
    announcePhase(state, t('round.r16'));
    return true;
  }

  // Laeuft eine K.-o.-Runde noch?
  const roundMatches = Object.values(state.matches).filter(
    (m) => m.competitionId === CC_ID && m.season === state.season
      && m.matchday === KO_BASE + (info.round - 1));
  if (roundMatches.length === 0 || roundMatches.some((m) => !m.played)) return false;

  const winners = roundMatches
    .sort((a, b) => a.id.localeCompare(b.id))
    .map(winnerOf)
    .filter((id): id is Id => !!id);

  if (winners.length <= 1) {
    info.finished = true;
    if (winners[0]) recordChampion(state, winners[0]);
    return true;
  }

  const nextRound = info.round + 1;
  const roundIdx = Math.min(nextRound - 1, KO_ROUNDS.length - 1);
  const roundName = t(KO_ROUNDS[roundIdx]);
  const date = dates[8 + nextRound - 1] ?? dates[dates.length - 1];
  const isFinal = roundIdx === KO_ROUNDS.length - 1;

  const matches: Match[] = [];
  for (let i = 0; i < winners.length; i += 2) {
    if (!winners[i + 1]) break;
    matches.push(ccMatch(state, KO_BASE + info.round, roundName, date,
      winners[i], winners[i + 1], isFinal));
  }
  for (const m of matches) addMatch(state, m);
  info.round = nextRound;
  info.alive = winners;
  announcePhase(state, roundName);
  return true;
}

function announcePhase(state: GameState, roundName: string) {
  const userClubId = state.players[state.userPlayerId]?.clubId;
  const info = state.cupState[CC_ID];
  if (userClubId && info?.alive.includes(userClubId)) {
    addNews(state, 'season',
      t('eu.phase.news', { competition: CC_NAME, round: roundName }),
      t('eu.phase.newsBodyOf', { round: roundName, competition: CC_NAME }), true);
  }
}

function recordChampion(state: GameState, clubId: Id) {
  const club = state.clubs[clubId];
  if (!club) return;
  club.history.push({
    season: state.season, competitionId: CC_ID, played: 0, won: 0, drawn: 0, lost: 0,
    goalsFor: 0, goalsAgainst: 0, points: 0, note: t('honour.winner', { competition: CC_NAME }),
  });
  addNews(state, 'season',
    t('eu.cc.wonNews', { club: club.name, competition: CC_NAME }),
    t('eu.cc.wonNewsBody', { club: club.name }), true);

  const user = state.players[state.userPlayerId];
  if (user && user.clubId === clubId) {
    state.honours.push({ season: state.season, label: t('honour.winner', { competition: CC_NAME }) });
    addCareerEvent(state, 'title', t('eu.cc.wonTitle', { competition: CC_NAME }),
      t('eu.cc.wonBody', { competition: CC_NAME, club: club.name }),
      { clubId, competitionId: CC_ID });
  }
}

/** Entfernt die Spiele des Vorjahres, bevor eine neue Auflage startet. */
export function clearOldChampionsCup(state: GameState) {
  const stale = Object.values(state.matches).filter(
    (m) => m.competitionId === CC_ID && m.season < state.season);
  for (const m of stale) {
    delete state.matches[m.id];
    const list = state.matchesByDate[m.date];
    if (list) state.matchesByDate[m.date] = list.filter((id) => id !== m.id);
  }
}

export { KO_BASE as CC_KO_BASE, LEAGUE_ROUNDS as CC_LEAGUE_ROUNDS };
export type { Club };

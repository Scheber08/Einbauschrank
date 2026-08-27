/**
 * Continental Trophy (Konzept Abschnitt 11).
 *
 * Der zweite europaeische Wettbewerb: Hier spielen die Vereine, die den Sprung
 * in den Champions Cup knapp verpasst haben. Bewusst schlanker als der grosse
 * Bruder - ein reines K.-o.-Turnier mit sechzehn Mannschaften.
 */
import { COUNTRIES } from './countries';
import { makeDate, type GameDate } from './date';
import { addCareerEvent, addMatch, addNews, makeId } from './ids';
import { leaguesOfCountry, tableKey } from './season';
import { sortTable } from './table';
import type { Competition, GameState, Id, Match } from './types';
import { qualifyForChampionsCup } from './international';
import { t } from '../i18n';

export const CT_ID = 'ct';
export const CT_NAME = 'Continental Trophy';
const KO_BASE = 200;
/** K.-o.-Runden als Katalogschluessel, nicht als fertiger Text. */
const ROUNDS = ['round.r16', 'round.quarter', 'round.semi', 'round.final'] as const;

/** Termine der vier Runden - versetzt zu den Spielen des Champions Cup. */
function trophyDates(season: number): GameDate[] {
  const anchors: [number, number][] = [[10, 28], [12, 16], [3, 10], [5, 13]];
  return anchors.map(([m, d]) => makeDate(m >= 8 ? season : season + 1, m, d));
}

/**
 * Die naechstplatzierten Vereine hinter den Champions-Cup-Startern. Wer schon
 * international vertreten ist, spielt hier nicht mit.
 */
export function qualifyForTrophy(state: GameState, prevSeason: number | null): Id[] {
  const inChampionsCup = new Set(qualifyForChampionsCup(state, prevSeason));
  const perCountry = 4;
  const qualifiers: Id[] = [];

  for (const country of COUNTRIES) {
    const firstLeague = leaguesOfCountry(state, country.id).find((l) => l.level === 1);
    if (!firstLeague) continue;

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
    qualifiers.push(...ordered.filter((id) => !inChampionsCup.has(id)).slice(0, perCountry));
  }

  return qualifiers.slice(0, 16);
}

function ctMatch(
  state: GameState, matchday: number, roundName: string, date: GameDate,
  home: Id, away: Id, neutral = false,
): Match {
  return {
    id: makeId(state, 'm'),
    competitionId: CT_ID,
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

/** Legt den Wettbewerb an und setzt das Achtelfinale an. */
export function startTrophy(state: GameState, _rng: unknown, prevSeason: number | null) {
  const qualifiers = qualifyForTrophy(state, prevSeason);
  if (qualifiers.length < 16) return;

  state.competitions[CT_ID] = {
    id: CT_ID,
    countryId: 'international',
    name: CT_NAME,
    short: 'CT',
    type: 'cup',
    level: 0,
    clubIds: qualifiers,
    reputation: 74,
  } satisfies Competition;

  const dates = trophyDates(state.season);
  // Gesetzt: Der Erstplatzierte trifft auf den Letzten des Teilnehmerfelds.
  for (let i = 0; i < 8; i++) {
    addMatch(state, ctMatch(state, KO_BASE, t('round.r16'), dates[0],
      qualifiers[i], qualifiers[15 - i]));
  }
  state.cupState[CT_ID] = { round: 1, alive: qualifiers.slice(), finished: false };

  const userClubId = state.players[state.userPlayerId]?.clubId;
  if (userClubId && qualifiers.includes(userClubId)) {
    addNews(state, 'season',
      t('eu.trophy.news', { club: state.clubs[userClubId]?.name ?? '', competition: CT_NAME }),
      t('eu.trophy.newsBody'), true);
    addCareerEvent(state, 'international', t('eu.trophy.eventTitle'),
      t('eu.trophy.eventBody', {
        club: state.clubs[userClubId]?.name ?? '', competition: CT_NAME,
      }),
      { competitionId: CT_ID });
  }
}

function winnerOf(m: Match): Id | null {
  if (!m.played || m.homeScore === null || m.awayScore === null) return null;
  if (m.homeScore > m.awayScore) return m.homeClubId;
  if (m.awayScore > m.homeScore) return m.awayClubId;
  if (m.penalties) return m.penalties[0] > m.penalties[1] ? m.homeClubId : m.awayClubId;
  return m.homeClubId;
}

/** Setzt die naechste Runde an, sobald die laufende gespielt ist. */
export function advanceTrophy(state: GameState): boolean {
  const info = state.cupState[CT_ID];
  if (!info || info.finished) return false;

  const roundMatches = Object.values(state.matches).filter(
    (m) => m.competitionId === CT_ID && m.season === state.season
      && m.matchday === KO_BASE + (info.round - 1));
  if (roundMatches.length === 0 || roundMatches.some((m) => !m.played)) return false;

  const winners = roundMatches
    .sort((a, b) => a.id.localeCompare(b.id))
    .map(winnerOf)
    .filter((id): id is Id => !!id);

  if (winners.length <= 1) {
    info.finished = true;
    if (winners[0]) recordWinner(state, winners[0]);
    return true;
  }

  const nextRound = info.round + 1;
  const roundIdx = Math.min(nextRound - 1, ROUNDS.length - 1);
  const roundName = t(ROUNDS[roundIdx]);
  const dates = trophyDates(state.season);
  const date = dates[Math.min(nextRound - 1, dates.length - 1)];
  const isFinal = roundIdx === ROUNDS.length - 1;

  for (let i = 0; i < winners.length; i += 2) {
    if (!winners[i + 1]) break;
    addMatch(state, ctMatch(state, KO_BASE + info.round, roundName, date,
      winners[i], winners[i + 1], isFinal));
  }
  info.round = nextRound;
  info.alive = winners;

  const userClubId = state.players[state.userPlayerId]?.clubId;
  if (userClubId && winners.includes(userClubId)) {
    addNews(state, 'season',
      t('eu.phase.news', { competition: CT_NAME, round: roundName }),
      t('eu.phase.newsBodyThe', { round: roundName, competition: CT_NAME }), true);
  }
  return true;
}

function recordWinner(state: GameState, clubId: Id) {
  const club = state.clubs[clubId];
  if (!club) return;
  club.history.push({
    season: state.season, competitionId: CT_ID, played: 0, won: 0, drawn: 0, lost: 0,
    goalsFor: 0, goalsAgainst: 0, points: 0, note: t('honour.winner', { competition: CT_NAME }),
  });
  addNews(state, 'season',
    t('eu.trophy.wonNews', { club: club.name, competition: CT_NAME }),
    t('eu.trophy.wonNewsBody', { club: club.name }), true);

  const user = state.players[state.userPlayerId];
  if (user && user.clubId === clubId) {
    state.honours.push({ season: state.season, label: t('honour.winner', { competition: CT_NAME }) });
    addCareerEvent(state, 'title', t('eu.trophy.wonTitle', { competition: CT_NAME }),
      t('eu.trophy.wonBody', { competition: CT_NAME, club: club.name }),
      { clubId, competitionId: CT_ID });
  }
}

/** Entfernt die Spiele des Vorjahres. */
export function clearOldTrophy(state: GameState) {
  const stale = Object.values(state.matches).filter(
    (m) => m.competitionId === CT_ID && m.season < state.season);
  for (const m of stale) {
    delete state.matches[m.id];
    const list = state.matchesByDate[m.date];
    if (list) state.matchesByDate[m.date] = list.filter((id) => id !== m.id);
  }
}

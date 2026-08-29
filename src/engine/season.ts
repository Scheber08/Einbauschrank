/**
 * Saisonablauf: Spielplan, Pokal, Relegation, Auf- und Abstieg,
 * Auszeichnungen und Transfers (Konzept Abschnitt 8, 9, 34, 50, 51).
 */
import { maybeOfferBetterAgent, resetAgentSeason } from './agent';
import { generateLoanOffers } from './loan';
import { computeOverall, POSITION_LINE } from './attributes';
import { COUNTRY_BY_ID } from './countries';
import { CUP_ROUNDS, drawFirstRound, drawRound, winnersOf } from './cup';
import { addDays, ageOn, makeDate, seasonLabel } from './date';
import { developAiPlayer } from './development';
import { buildLeagueSchedule, cupDates, leagueMatchDates } from './fixtures';
import { addCareerEvent, addMatch, addNews, makeId } from './ids';
import { t, tDecimal, tNumber, tVariant } from '../i18n';
import { fulfilPreContract } from './contract';
import { expireUserContract } from './contract';
import { runManagerChanges } from './manager';
import { resolveObjectives } from './objectives';
import { checkSeasonBest } from './milestones';
import { checkCaptaincy, growLeadership } from './captain';
import { learnAltPosition } from './versatility';
import { bookSigning, buildWageIndex, canSign, resetBudgets } from './finance';
import { calcMarketValue, calcSalary, createPlayer } from './playerGen';
import { checkForcedRetirement } from './retirement';
import { Rng, clamp } from './rng';
import { averageRating, tryRecord } from './stats';
import { buildTable, sortTable } from './table';
import { SQUAD_ROLE_ORDER } from './types';
import type {
  Award, Club, Competition, GameState, Id, Match, Player, Retirement, SeasonStats, SquadRole,
  TransferOffer,
} from './types';

// --- Saisonstart -------------------------------------------------------

export function leaguesOfCountry(state: GameState, countryId: Id): Competition[] {
  return Object.values(state.competitions)
    .filter((c) => c.countryId === countryId && c.type === 'league')
    .sort((a, b) => a.level - b.level);
}

export function cupOfCountry(state: GameState, countryId: Id): Competition | undefined {
  return Object.values(state.competitions).find((c) => c.countryId === countryId && c.type === 'cup');
}

export function tableKey(competitionId: Id, season: number): string {
  return `${competitionId}:${season}`;
}

/** Erstellt Spielplaene fuer eine neue Saison. */
export function startSeason(state: GameState, rng: Rng) {
  const season = state.season;

  for (const country of Object.values(state.countries)) {
    const leagues = leaguesOfCountry(state, country.id);
    if (leagues.length === 0) continue;

    for (const league of leagues) {
      const matches = buildLeagueSchedule(rng, {
        competitionId: league.id,
        season,
        clubIds: league.clubIds,
        makeId: () => makeId(state, 'm'),
      });
      for (const m of matches) addMatch(state, m);
      state.tables[tableKey(league.id, season)] = buildTable(league.clubIds, []);
    }

    const cup = cupOfCountry(state, country.id);
    if (cup) {
      const clubs = cup.clubIds.map((id) => state.clubs[id]).filter(Boolean);
      const dates = cupDates(season, CUP_ROUNDS.length);
      const { matches, byes } = drawFirstRound(
        rng, cup.id, season, clubs, dates[0], () => makeId(state, 'm'),
      );
      for (const m of matches) addMatch(state, m);
      state.cupState[cup.id] = { round: 1, alive: byes, finished: false };
    }
  }

  state.seasonPhase = 'inSeason';
}

/** Legt die naechste Pokalrunde an, sobald die aktuelle gespielt ist. */
export function advanceCup(state: GameState, rng: Rng, cupId: Id): boolean {
  const cupInfo = state.cupState[cupId];
  if (!cupInfo || cupInfo.finished) return false;

  const roundMatches = Object.values(state.matches).filter(
    (m) => m.competitionId === cupId && m.season === state.season && m.matchday === cupInfo.round,
  );
  if (roundMatches.length === 0) return false;
  if (roundMatches.some((m) => !m.played)) return false;

  const winners = [...winnersOf(roundMatches), ...cupInfo.alive];
  cupInfo.alive = [];

  if (winners.length <= 1) {
    cupInfo.finished = true;
    const champion = winners[0];
    if (champion) recordCupWinner(state, cupId, champion);
    return true;
  }

  const nextRound = cupInfo.round + 1;
  if (nextRound > CUP_ROUNDS.length) {
    cupInfo.finished = true;
    return true;
  }

  const dates = cupDates(state.season, CUP_ROUNDS.length);
  const date = dates[Math.min(nextRound - 1, dates.length - 1)];
  const matches = drawRound(
    rng, cupId, state.season, nextRound, winners, state.clubs, date, () => makeId(state, 'm'),
  );
  for (const m of matches) addMatch(state, m);
  cupInfo.round = nextRound;
  return true;
}

function recordCupWinner(state: GameState, cupId: Id, clubId: Id) {
  const cup = state.competitions[cupId];
  const club = state.clubs[clubId];
  if (!cup || !club) return;

  club.history.push({
    season: state.season, competitionId: cupId, played: 0, won: 0, drawn: 0, lost: 0,
    goalsFor: 0, goalsAgainst: 0, points: 0, note: t('rec.cupWinner'),
  });

  addNews(state, 'season',
    t('se.cup.news', { club: club.name, cup: cup.name }),
    t('se.cup.newsBody', {
      club: club.name, season: seasonLabel(state.season), cup: cup.name,
    }), true);

  const user = state.players[state.userPlayerId];
  if (user && user.clubId === clubId) {
    state.honours.push({ season: state.season, label: cup.name });
    addCareerEvent(state, 'title', t('se.cup.title', { cup: cup.name }),
      t('se.cup.body', { club: club.name, cup: cup.name }),
      { clubId, competitionId: cupId });
  }
}

// --- Relegation (Konzept Abschnitt 8) ----------------------------------

export function relegationCompetitionId(countryId: Id): Id {
  return `${countryId}-relegation`;
}

/**
 * Legt die Relegationsspiele an, sobald alle Ligaspiele absolviert sind.
 * Platz 3 der unteren Liga trifft auf Platz 18 der hoeheren Liga.
 */
export function scheduleRelegation(state: GameState, rng: Rng, countryId: Id) {
  const leagues = leaguesOfCountry(state, countryId);
  if (leagues.length < 2) return;

  const compId = relegationCompetitionId(countryId);
  if (!state.competitions[compId]) {
    state.competitions[compId] = {
      id: compId,
      countryId,
      name: t('rec.relegationRound'),
      short: 'REL',
      type: 'cup',
      level: 0,
      clubIds: [],
      reputation: 50,
    };
  }

  const lastMatchday = leagueMatchDates(state.season)[37];
  const firstLeg = addDays(lastMatchday, 4);
  const secondLeg = addDays(lastMatchday, 8);

  for (let i = 0; i < leagues.length - 1; i++) {
    const upper = leagues[i];
    const lower = leagues[i + 1];
    const upperTable = sortedTable(state, upper.id);
    const lowerTable = sortedTable(state, lower.id);
    // Drittletzter der oberen Liga gegen den Dritten der unteren - gemessen an
    // der tatsaechlichen Ligagroesse, nicht an einer festen Zwanzigerliga.
    const upperClub = upperTable[upperTable.length - 3]?.clubId;
    const lowerClub = lowerTable[2]?.clubId;
    if (!upperClub || !lowerClub || upperTable.length < 4) continue;

    // Hinspiel beim unterklassigen Verein
    addMatch(state, {
      id: makeId(state, 'm'), competitionId: compId, season: state.season,
      matchday: 1, roundName: `Relegation ${upper.short}/${lower.short} Hinspiel`,
      date: firstLeg, homeClubId: lowerClub, awayClubId: upperClub,
      homeScore: null, awayScore: null, played: false,
    });
    addMatch(state, {
      id: makeId(state, 'm'), competitionId: compId, season: state.season,
      matchday: 2, roundName: `Relegation ${upper.short}/${lower.short} Rückspiel`,
      date: secondLeg, homeClubId: upperClub, awayClubId: lowerClub,
      homeScore: null, awayScore: null, played: false,
    });
  }

  void rng;
  state.seasonPhase = 'postSeason';
}

/** Ermittelt die Sieger der Relegation ueber beide Spiele. */
function relegationWinners(state: GameState, countryId: Id): Map<string, Id> {
  const compId = relegationCompetitionId(countryId);
  const matches = Object.values(state.matches).filter(
    (m) => m.competitionId === compId && m.season === state.season,
  );
  const ties = new Map<string, Match[]>();
  for (const m of matches) {
    const key = [m.homeClubId, m.awayClubId].sort().join('|');
    if (!ties.has(key)) ties.set(key, []);
    ties.get(key)!.push(m);
  }

  const winners = new Map<string, Id>();
  for (const [key, legs] of ties) {
    if (legs.length < 2 || legs.some((m) => !m.played)) continue;
    const [a, b] = key.split('|');
    let goalsA = 0, goalsB = 0;
    for (const m of legs) {
      if (m.homeScore === null || m.awayScore === null) continue;
      if (m.homeClubId === a) { goalsA += m.homeScore; goalsB += m.awayScore; }
      else { goalsB += m.homeScore; goalsA += m.awayScore; }
    }
    let winner: Id;
    if (goalsA > goalsB) winner = a;
    else if (goalsB > goalsA) winner = b;
    else {
      const last = legs[legs.length - 1];
      winner = last.penalties && last.penalties[0] > last.penalties[1]
        ? last.homeClubId : last.awayClubId;
    }
    winners.set(key, winner);
  }
  return winners;
}

export function sortedTable(state: GameState, competitionId: Id, season = state.season) {
  const table = state.tables[tableKey(competitionId, season)] ?? {};
  const matches = Object.values(state.matches).filter(
    (m) => m.competitionId === competitionId && m.season === season,
  );
  return sortTable(table, matches);
}

// --- Saisonende --------------------------------------------------------

export interface SeasonReport {
  season: number;
  champions: { competitionId: Id; clubId: Id }[];
  promoted: { clubId: Id; fromLevel: number }[];
  relegated: { clubId: Id; fromLevel: number }[];
  awards: Award[];
  userSummary: {
    appearances: number;
    goals: number;
    assists: number;
    avgRating: number;
    objectivesMet: number;
    objectivesTotal: number;
  } | null;
  /** Gesetzt, wenn die Laufbahn mit dieser Saison endet. */
  retirement?: Retirement;
}

export function endSeason(state: GameState, rng: Rng): SeasonReport {
  const report: SeasonReport = {
    season: state.season,
    champions: [], promoted: [], relegated: [], awards: [], userSummary: null,
  };

  // Vor dem Aufraeumen: hat der Spieler sein bisher bestes Torjahr gehabt?
  checkSeasonBest(state);

  for (const country of Object.values(state.countries)) {
    const leagues = leaguesOfCountry(state, country.id);
    if (leagues.length === 0) continue;

    // Meister und Vereinshistorie
    for (const league of leagues) {
      const sorted = sortedTable(state, league.id);
      sorted.forEach((row, index) => {
        const club = state.clubs[row.clubId];
        if (!club) return;
        club.history.push({
          season: state.season, competitionId: league.id, position: index + 1,
          played: row.played, won: row.won, drawn: row.drawn, lost: row.lost,
          goalsFor: row.goalsFor, goalsAgainst: row.goalsAgainst, points: row.points,
        });
      });
      const champion = sorted[0];
      if (champion) {
        report.champions.push({ competitionId: league.id, clubId: champion.clubId });
        announceChampion(state, league, champion.clubId, champion.points);
      }
    }

    applyPromotionRelegation(state, country.id, report);
    report.awards.push(...computeAwards(state, country.id));
  }

  report.userSummary = summariseUserSeason(state);
  // Erst den Bericht bilden, dann die Ziele abrechnen: Der Bericht zeigt die
  // Bilanz, die Abrechnung wirkt auf die kommende Saison.
  resolveObjectives(state);
  updateRecords(state);
  updateUserSquadRole(state);
  // Erst steht die Rolle fest, dann waechst die Fuehrungsstaerke daran, und
  // dann kann sich die Frage nach der Binde ueberhaupt stellen.
  growLeadership(state, rng);
  checkCaptaincy(state, rng);
  // Wer lange genug woanders aufgelaufen ist, kann es jetzt auch.
  learnAltPosition(state);
  ageAndDevelop(state, rng);
  // Trainerwechsel, bevor die Kader umgebaut werden: Der neue Mann soll die
  // kommende Saison praegen, nicht die abgelaufene.
  runManagerChanges(state, rng, new Set(report.relegated.map((r) => r.clubId)));
  // Vor dem Transferfenster: Ein nicht verlaengerter Vertrag endet jetzt
  // wirklich. Der Spieler hatte eine volle Saison und zwei Hinweise Zeit.
  //
  // Wer im Winter einen Vorvertrag unterschrieben hat, wechselt dorthin -
  // dann greift der Ablauf gar nicht erst.
  if (!fulfilPreContract(state)) expireUserContract(state, rng);
  // Neue Saison, neues Geld - und zwar bevor der Markt oeffnet. Gerechnet
  // wird aus dem Kader, nicht aus dem Vorjahreswert: Jede Fortschreibung
  // driftet ueber zwanzig Saisons weg, und die alte Auf-/Abstiegsskalierung
  // mit 1,35 und 0,72 haette einen Fahrstuhlverein binnen weniger Jahre
  // entweder ruiniert oder aufgeblaeht.
  resetBudgets(state, sammleErfolg(state), () => rng.next());
  runTransferWindow(state, rng);
  resetForNewSeason(state, rng);

  // Nach dem Transferfenster steht fest, ob die Laufbahn weitergeht.
  const forced = checkForcedRetirement(state);
  if (forced) {
    report.retirement = forced;
    addNews(state, 'season', t('se.retire.title'),
      forced.reason === 'age'
        ? t('se.retire.age', {
          apps: forced.appearances,
          last: state.players[state.userPlayerId]?.lastName ?? '',
        })
        : t('se.retire.noOffer'), true);
  }

  return report;
}

function announceChampion(state: GameState, league: Competition, clubId: Id, points: number) {
  const club = state.clubs[clubId];
  if (!club) return;
  // Kein Zufallsgeber in dieser Funktion - der Wurf kommt aus Saison und
  // Vereinskennung. Reproduzierbar und je Meisterschaft verschieden.
  const wurf = ((state.season * 31 + clubId.length * 7 + clubId.charCodeAt(clubId.length - 1))
    % 997) / 997;
  addNews(state, 'season',
    tVariant('se.champion.news', wurf, { club: club.name, league: league.name }),
    t('se.champion.newsBody', {
      points, club: club.name, season: seasonLabel(state.season),
    }),
    true);

  const user = state.players[state.userPlayerId];
  if (user && user.clubId === clubId) {
    state.honours.push({ season: state.season, label: t('se.champion.honour', { league: league.name }) });
    addCareerEvent(state, 'title', t('se.champion.title', { league: league.name }),
      t('se.champion.body', { club: club.name }), { clubId, competitionId: league.id });
  }
}

function applyPromotionRelegation(state: GameState, countryId: Id, report: SeasonReport) {
  // Kein Zufallsgeber in dieser Funktion. Der Wurf fuer die Formulierung
  // kommt aus Saison und Land - reproduzierbar und je Saison verschieden.
  const wurf = ((state.season * 17 + countryId.length * 5) % 997) / 997;
  const leagues = leaguesOfCountry(state, countryId);
  const winners = relegationWinners(state, countryId);
  const moves: { clubId: Id; toLeague: Id; fromLevel: number; up: boolean }[] = [];

  for (let i = 0; i < leagues.length; i++) {
    const league = leagues[i];
    const upper = leagues[i - 1];
    const lower = leagues[i + 1];
    const table = sortedTable(state, league.id);

    // Die Plaetze richten sich nach der Ligagroesse, damit auch eine Liga mit
    // achtzehn oder vierundzwanzig Vereinen richtig auf- und absteigt.
    const size = table.length;

    // Direkter Abstieg: die beiden letzten Plaetze.
    if (lower && size >= 4) {
      for (const row of table.slice(size - 2)) {
        moves.push({ clubId: row.clubId, toLeague: lower.id, fromLevel: league.level, up: false });
      }
    }
    // Direkter Aufstieg: die beiden ersten Plaetze.
    if (upper) {
      for (const row of table.slice(0, 2)) {
        moves.push({ clubId: row.clubId, toLeague: upper.id, fromLevel: league.level, up: true });
      }
    }
    // Relegation: Drittletzter gegen den Dritten der Liga darunter.
    if (lower && size >= 4) {
      const upperClub = table[size - 3]?.clubId;
      const lowerTable = sortedTable(state, lower.id);
      const lowerClub = lowerTable[2]?.clubId;
      if (upperClub && lowerClub) {
        const key = [upperClub, lowerClub].sort().join('|');
        const winner = winners.get(key);
        if (winner === lowerClub) {
          moves.push({ clubId: lowerClub, toLeague: league.id, fromLevel: lower.level, up: true });
          moves.push({ clubId: upperClub, toLeague: lower.id, fromLevel: league.level, up: false });
        }
      }
    }
  }

  for (const move of moves) {
    const club = state.clubs[move.clubId];
    const league = state.competitions[move.toLeague];
    if (!club || !league) continue;
    const oldLeague = state.competitions[club.leagueId];
    if (oldLeague) oldLeague.clubIds = oldLeague.clubIds.filter((id) => id !== club.id);
    if (!league.clubIds.includes(club.id)) league.clubIds.push(club.id);
    club.leagueId = league.id;

    // Wirtschaftliche Folgen: nur noch die Reputation. Die Budgets werden
    // kurz darauf ohnehin komplett neu aus dem Kader gerechnet
    // (`resetBudgets`), eine Skalierung hier wuerde nur doppelt wirken und
    // ueber die Jahre wegdriften.
    club.reputation = clamp(Math.round(club.reputation + (move.up ? 6 : -7)), 8, 96);

    if (move.up) report.promoted.push({ clubId: club.id, fromLevel: move.fromLevel });
    else report.relegated.push({ clubId: club.id, fromLevel: move.fromLevel });

    addNews(state, 'season',
      tVariant(move.up ? 'se.promoted.news' : 'se.relegated.news', wurf,
        { club: club.name }),
      t('se.move.body', { club: club.name, league: league.name }),
      state.players[state.userPlayerId]?.clubId === club.id);

    const user = state.players[state.userPlayerId];
    if (user && user.clubId === club.id) {
      addCareerEvent(state, move.up ? 'promotion' : 'relegation',
        t(move.up ? 'se.promoted.title' : 'se.relegated.title'),
        t('se.move.body', { club: club.name, league: league.name }), { clubId: club.id });
      if (move.up) {
        state.honours.push({
          season: state.season, label: t('se.promoted.honour', { league: league.name }),
        });
      }
    }
  }
}

// --- Auszeichnungen (Konzept Abschnitt 50) -----------------------------

function computeAwards(state: GameState, countryId: Id): Award[] {
  const awards: Award[] = [];
  const leagues = leaguesOfCountry(state, countryId);

  for (const league of leagues) {
    const entries = Object.values(state.seasonStats).filter(
      (s) => s.competitionId === league.id && s.season === state.season,
    );
    if (entries.length === 0) continue;

    const push = (type: string, label: string, entry: SeasonStats | undefined, value: string) => {
      if (!entry) return;
      const player = state.players[entry.playerId];
      if (!player) return;
      const award: Award = {
        id: makeId(state, 'a'),
        season: state.season,
        competitionId: league.id,
        type,
        label: `${label} - ${league.name}`,
        playerId: entry.playerId,
        playerName: `${player.firstName} ${player.lastName}`,
        value,
      };
      awards.push(award);
      state.awards.push(award);
      if (entry.playerId === state.userPlayerId) {
        state.honours.push({ season: state.season, label: award.label });
        addCareerEvent(state, 'award', award.label, t('se.award.event', { value }),
          { competitionId: league.id });
        addNews(state, 'award', t('se.award.news', { label: award.label }),
          t('se.award.newsBody', { name: award.playerName, value }), true);
      }
    };

    const scorer = entries.slice().sort((a, b) => b.goals - a.goals || b.assists - a.assists)[0];
    push('topScorer', t('se.award.topScorer'), scorer,
      t('se.award.goalsValue', { n: scorer?.goals ?? 0 }));

    const assister = entries.slice().sort((a, b) => b.assists - a.assists)[0];
    push('topAssists', t('se.award.topAssists'), assister,
      t('se.award.assistsValue', { n: assister?.assists ?? 0 }));

    const eligible = entries.filter((s) => s.appearances >= 18);
    const best = eligible.slice().sort((a, b) => averageRating(b) - averageRating(a))[0];
    push('playerOfSeason', t('se.award.playerOfSeason'), best,
      t('se.award.ratingValue', { rating: tDecimal(averageRating(best ?? entries[0])) }));

    const keepers = eligible.filter((s) => {
      const p = state.players[s.playerId];
      return p && POSITION_LINE[p.position] === 'GK';
    });
    const bestKeeper = keepers.slice().sort(
      (a, b) => b.cleanSheets - a.cleanSheets || averageRating(b) - averageRating(a))[0];
    push('bestKeeper', t('se.award.bestKeeper'), bestKeeper,
      t('se.award.cleanSheetsValue', { n: bestKeeper?.cleanSheets ?? 0 }));

    const youngsters = eligible.filter((s) => {
      const p = state.players[s.playerId];
      return p && ageOn(p.birthDate, state.date) <= 21;
    });
    const bestYoung = youngsters.slice().sort((a, b) => averageRating(b) - averageRating(a))[0];
    push('youngPlayer', t('se.award.youngPlayer'), bestYoung,
      t('se.award.ratingValue', { rating: tDecimal(averageRating(bestYoung ?? entries[0])) }));
  }

  return awards;
}

function summariseUserSeason(state: GameState): SeasonReport['userSummary'] {
  const entries = Object.values(state.seasonStats).filter(
    (s) => s.playerId === state.userPlayerId && s.season === state.season,
  );
  if (entries.length === 0) {
    return { appearances: 0, goals: 0, assists: 0, avgRating: 0, objectivesMet: 0, objectivesTotal: state.objectives.length };
  }
  const appearances = entries.reduce((a, s) => a + s.appearances, 0);
  const ratingSum = entries.reduce((a, s) => a + s.ratingSum, 0);
  return {
    appearances,
    goals: entries.reduce((a, s) => a + s.goals, 0),
    assists: entries.reduce((a, s) => a + s.assists, 0),
    avgRating: appearances > 0 ? ratingSum / appearances : 0,
    objectivesMet: state.objectives.filter((o) => o.done).length,
    objectivesTotal: state.objectives.length,
  };
}

/**
 * Kaderrolle des eigenen Spielers zum Saisonende anpassen (Konzept Abschnitt 29).
 * Ohne das bliebe man dauerhaft "Nachwuchsspieler" und damit bei der Aufstellung
 * ohne Rollenbonus - egal wie gut die Saison lief. Massstab sind Einsatzzeit,
 * Durchschnittsnote und die eigene Staerke im Vergleich zum Kader.
 */
function updateUserSquadRole(state: GameState) {
  const user = state.players[state.userPlayerId];
  if (!user?.contract || !user.clubId) return;

  const entries = Object.values(state.seasonStats).filter(
    (s) => s.playerId === state.userPlayerId && s.season === state.season,
  );
  const appearances = entries.reduce((a, s) => a + s.appearances, 0);
  const starts = entries.reduce((a, s) => a + s.starts, 0);
  const ratingSum = entries.reduce((a, s) => a + s.ratingSum, 0);
  const avgRating = appearances > 0 ? ratingSum / appearances : 0;

  // Rang des Spielers im eigenen Kader (0 = bester Feldspieler).
  const ability = computeOverall(user.attrs, user.position);
  const squad = Object.values(state.players)
    .filter((p) => p.clubId === user.clubId && p.id !== user.id && p.position !== 'TW');
  const better = squad.filter(
    (p) => computeOverall(p.attrs, p.position) > ability,
  ).length;

  // Zielrolle aus Einsatzzeit und Leistung. Wer kaum spielt, rutscht zurueck.
  //
  // Der zweite Weg ueber die Startelfeinsaetze ist der wichtigere: Wer Woche
  // fuer Woche von Anfang an spielt, IST Stammspieler - unabhaengig davon, ob
  // die Note eine absolute Schwelle reisst, die weder Liganiveau noch Position
  // kennt. Ohne diesen Weg blieb ein Spieler mit 37 Startelfeinsaetzen aus 37
  // Spielen dauerhaft "Rotationsspieler" - und wurde deshalb in der
  // Spielsimulation zuerst ausgewechselt.
  const startquote = appearances > 0 ? starts / appearances : 0;
  const stammKraft = starts >= 18 && startquote >= 0.6;
  let target: SquadRole;
  if (appearances >= 25 && (avgRating >= 7.0 || (stammKraft && avgRating >= 6.8))
    && better <= 2) target = 'Schluesselspieler';
  else if ((appearances >= 20 && avgRating >= 6.6) || stammKraft) target = 'Stammspieler';
  else if (appearances >= 12) target = 'Rotationsspieler';
  else if (appearances >= 4) target = 'Ergaenzungsspieler';
  else target = 'Nachwuchsspieler';

  const current = user.contract.role;
  // Der Mannschaftsfuehrer wird nicht automatisch degradiert.
  if (current === 'Mannschaftsfuehrer') return;

  const currentIdx = SQUAD_ROLE_ORDER.indexOf(current);
  const targetIdx = SQUAD_ROLE_ORDER.indexOf(target);
  // Hoechstens eine Stufe pro Saison, in beide Richtungen.
  const nextIdx = clamp(
    targetIdx > currentIdx ? currentIdx + 1 : targetIdx < currentIdx ? currentIdx - 1 : currentIdx,
    0, SQUAD_ROLE_ORDER.length - 1);
  if (nextIdx === currentIdx) return;

  const next = SQUAD_ROLE_ORDER[nextIdx];
  user.contract.role = next;
  const club = state.clubs[user.clubId];
  const up = nextIdx > currentIdx;
  const rolleName = t(`role.${next}`);
  addNews(state, 'coach',
    t(up ? 'se.role.up.news' : 'se.role.down.news'),
    up
      ? t('se.role.up.body', {
        apps: appearances, club: club?.name ?? t('se.clubFallback'),
        role: rolleName,
      })
      : t('se.role.down.body', {
        club: club?.name ?? t('se.clubFallbackCap'), role: rolleName,
      }),
    true);
  if (up) {
    addCareerEvent(state, 'other', t('se.role.title', { role: rolleName }),
      t('se.role.body', {
        club: club?.name ?? t('se.clubFallbackCap'), role: rolleName,
      }));
  }
}

// --- Rekorde -----------------------------------------------------------

function updateRecords(state: GameState) {
  const user = state.players[state.userPlayerId];
  if (!user) return;
  const name = `${user.firstName} ${user.lastName}`;

  const seasonEntries = Object.values(state.seasonStats).filter((s) => s.season === state.season);
  const bestSeasonScorer = seasonEntries.slice().sort((a, b) => b.goals - a.goals)[0];
  if (bestSeasonScorer && bestSeasonScorer.goals > 0) {
    const p = state.players[bestSeasonScorer.playerId];
    tryRecord(state, {
      key: 'mostGoalsInSeason',
      label: t('rec.bestSeasonGoals'),
      scope: t('rec.scopePlayer'),
      holderId: bestSeasonScorer.playerId,
      holderName: p ? `${p.firstName} ${p.lastName}` : t('rec.unknown'),
      value: bestSeasonScorer.goals,
      displayValue: t('rec.goalsValue', { n: bestSeasonScorer.goals }),
    }, state.date);
  }

  const careerEntries = Object.values(state.seasonStats).filter((s) => s.playerId === state.userPlayerId);
  const careerGoals = careerEntries.reduce((a, s) => a + s.goals, 0);
  const careerApps = careerEntries.reduce((a, s) => a + s.appearances, 0);
  tryRecord(state, {
    key: `careerGoals:${state.userPlayerId}`,
    label: t('rec.careerGoals'),
    scope: t('rec.ownCareer'),
    holderId: state.userPlayerId,
    holderName: name,
    value: careerGoals,
    displayValue: t('rec.goalsValue', { n: careerGoals }),
  }, state.date);
  tryRecord(state, {
    key: `careerApps:${state.userPlayerId}`,
    label: t('rec.careerApps'),
    scope: t('rec.ownCareer'),
    holderId: state.userPlayerId,
    holderName: name,
    value: careerApps,
    displayValue: t('rec.appsValue', { n: careerApps }),
  }, state.date);
}

// --- Alterung, Entwicklung, Vertraege ----------------------------------

function ageAndDevelop(state: GameState, rng: Rng) {
  for (const player of Object.values(state.players)) {
    if (player.isUser) continue;
    const club = player.clubId ? state.clubs[player.clubId] : null;
    developAiPlayer(rng, player, state.date, club?.training ?? 50);

    const age = ageOn(player.birthDate, state.date);
    const league = club ? state.competitions[club.leagueId] : null;
    const level = league?.level ?? 3;
    const ability = computeOverall(player.attrs, player.position);
    player.marketValue = calcMarketValue(ability, player.potential, age, player.position, level);
    player.reputation = clamp(Math.round(
      player.reputation * 0.85 + ability * 0.2 + (3 - level) * 3), 1, 99);

    // Karriereende (Konzept Abschnitt 18). Je aelter und je schwaecher, desto
    // wahrscheinlicher der Ruecktritt. Frueher ging es erst ab 35 los - dadurch
    // vergreiste die Welt, weil kaum Kaderplaetze fuer Nachwuchs frei wurden.
    const retireChance = age >= 38 ? 1
      : age >= 32
        ? clamp((age - 31) * 0.17 + Math.max(0, 60 - ability) * 0.012, 0, 0.95)
        : 0;
    if (retireChance > 0 && rng.chance(retireChance)) {
      player.clubId = null;
      player.contract = null;
    }
  }

  // Ersatz fuer zurueckgetretene Spieler und Auffuellen der Kader
  refillSquads(state, rng);
}

function refillSquads(state: GameState, rng: Rng) {
  const byClub = new Map<Id, Player[]>();
  // Die schon vergebenen Namen der ganzen Welt. Ohne dieses Gedaechtnis
  // sammelte der jaehrliche Nachwuchs wieder Dopplungen an: Die Welterzeugung
  // vermied sie, aber jede neue Saison zog blind nach - gemessen nach drei
  // Saisons 221 doppelte Vollnamen und 14 von 15 betroffenen Ligen.
  const vergebeneNamen = new Set<string>();
  for (const p of Object.values(state.players)) {
    vergebeneNamen.add(`${p.firstName} ${p.lastName}`);
    if (!p.clubId) continue;
    if (!byClub.has(p.clubId)) byClub.set(p.clubId, []);
    byClub.get(p.clubId)!.push(p);
  }

  for (const club of Object.values(state.clubs)) {
    const squad = byClub.get(club.id) ?? [];
    const missing = 24 - squad.length;
    if (missing <= 0) continue;
    const league = state.competitions[club.leagueId];
    const level = league?.level ?? 3;
    const country = COUNTRY_BY_ID[club.countryId];

    for (let i = 0; i < missing; i++) {
      const ability = clamp(29 + club.reputation * 0.545 + rng.normal(-6, 5), 20, 82);
      const position = rng.pick(['TW', 'IV', 'LV', 'RV', 'DM', 'ZM', 'OM', 'LA', 'RA', 'ST'] as const);
      const player = createPlayer(rng, makeId(state, 'p'), {
        vergebeneNamen,
        ability,
        position,
        age: rng.int(17, 21),
        countryId: club.countryId,
        currentDate: state.date,
        clubId: club.id,
        leagueLevel: level,
        potentialBoost: rng.float(0, 10),
      });
      player.contract = {
        clubId: club.id,
        salary: calcSalary(ability, 19, level, club.reputation, country?.wealth ?? 1),
        until: makeDate(state.season + 1 + rng.int(1, 3), 6, 30),
        role: 'Nachwuchsspieler',
        goalBonus: 0,
        appearanceBonus: 0,
      };
      state.players[player.id] = player;
    }
  }
}

// --- Transfers (vereinfachte Fassung fuer die erste Version) -----------

/**
 * Wie erfolgreich war jeder Verein? 1 heisst Mittelmass.
 *
 * Der Wert steuert, wie viel Geld ein Verein im naechsten Sommer in der Hand
 * hat. Ohne ihn waere das Budget eine reine Funktion des Kaders - und damit
 * blind gegenueber dem, was in der Saison tatsaechlich passiert ist.
 */
function sammleErfolg(state: GameState): Map<Id, number> {
  const erfolg = new Map<Id, number>();
  for (const comp of Object.values(state.competitions)) {
    if (comp.type !== 'league') continue;
    const tabelle = sortedTable(state, comp.id);
    const anzahl = tabelle.length;
    if (anzahl === 0) continue;
    tabelle.forEach((row, index) => {
      // Erster Platz 1,5 - letzter Platz 0,5.
      erfolg.set(row.clubId, 1.5 - (index / Math.max(1, anzahl - 1)));
    });
  }
  return erfolg;
}

function runTransferWindow(state: GameState, rng: Rng) {
  // Gehaltslast einmal aufbauen und mitfuehren. Je Verein neu zu summieren
  // waere bei 7.500 Spielern und mehreren hundert Wechseln spuerbar langsam.
  const gehaelter = buildWageIndex(state);
  const clubsByLevel = new Map<number, Club[]>();
  for (const club of Object.values(state.clubs)) {
    const level = state.competitions[club.leagueId]?.level ?? 3;
    if (!clubsByLevel.has(level)) clubsByLevel.set(level, []);
    clubsByLevel.get(level)!.push(club);
  }

  const movable = Object.values(state.players).filter(
    (p) => !p.isUser && p.clubId && ageOn(p.birthDate, state.date) < 34,
  );

  for (const player of movable) {
    if (!rng.chance(0.09)) continue;
    const currentClub = state.clubs[player.clubId!];
    if (!currentClub) continue;
    const currentLevel = state.competitions[currentClub.leagueId]?.level ?? 3;
    const ability = computeOverall(player.attrs, player.position);

    // Starke Spieler steigen auf, schwaechere rutschen ab.
    const expectedLevel = ability >= 72 ? 1 : ability >= 58 ? 2 : 3;
    const targetLevel = clamp(
      expectedLevel + (rng.chance(0.3) ? rng.int(-1, 1) : 0), 1, 3);
    const candidates = (clubsByLevel.get(targetLevel) ?? [])
      .filter((c) => c.id !== currentClub.id);
    if (candidates.length === 0) continue;

    const target = rng.weighted(candidates, (c) =>
      Math.max(0.1, 100 - Math.abs(c.reputation - ability * 1.1)));
    const country = COUNTRY_BY_ID[target.countryId];

    // Der Wechsel kostet jetzt Geld. Vorher zog ein Verein beliebig viele
    // Spieler an sich, solange die Reputation passte - ein Transfermarkt
    // ohne jede Bremse. Wer sich den Spieler nicht leisten kann, laesst ihn
    // ziehen; das Angebot geht dann an einen anderen Verein oder gar nicht.
    const neuesGehalt = calcSalary(ability, ageOn(player.birthDate, state.date),
      targetLevel, target.reputation, country?.wealth ?? 1);
    const abloese = Math.round(player.marketValue * rng.float(0.75, 1.3));
    const last = gehaelter.get(target.id) ?? 0;
    // Etwas Toleranz, damit ein Verein sich fuer einen Spieler auch strecken
    // darf - ohne sie waere der Markt starr und ein Aufsteiger chancenlos.
    if (!canSign(target, last, abloese, neuesGehalt, 1.15)) continue;

    const altesGehalt = player.contract?.salary ?? 0;
    bookSigning(target, currentClub, abloese, gehaelter, neuesGehalt, altesGehalt);

    player.clubId = target.id;
    player.contract = {
      clubId: target.id,
      salary: neuesGehalt,
      until: makeDate(state.season + 1 + rng.int(1, 4), 6, 30),
      role: ability >= target.reputation * 0.6 ? 'Stammspieler' : 'Rotationsspieler',
      goalBonus: 0,
      appearanceBonus: 0,
    };
    void currentLevel;
  }

  generateUserOffers(state, rng);
  offerUserRenewal(state, rng);
  // Wer kaum gespielt hat, bekommt Angebote fuer eine Leihe (Abschnitt 34).
  generateLoanOffers(state, rng);
  // Der Berater startet mit frischem Kontingent in die neue Saison; wer sich
  // einen Namen gemacht hat, wird von einem groesseren Namen umworben.
  resetAgentSeason(state);
  maybeOfferBetterAgent(state, rng);
}

/**
 * Verlaengerungsangebot des eigenen Vereins (Konzept Abschnitt 33).
 * Ohne das liefe der Vertrag des Spielers stillschweigend ab und er spielte
 * dauerhaft zum Anfangsgehalt weiter. Das Angebot kommt, sobald der Vertrag
 * in der kommenden Saison endet - und richtet sich nach Leistung und Staerke.
 */
export function offerUserRenewal(state: GameState, rng: Rng) {
  const user = state.players[state.userPlayerId];
  const club = user?.clubId ? state.clubs[user.clubId] : null;
  if (!user?.contract || !club) return;
  // Wer schon woanders unterschrieben hat, bekommt kein Angebot mehr.
  // Sonst koennte man verlaengern und zum Saisonende trotzdem wechseln.
  if (state.preContract) return;

  // Das Angebot muss eine Saison vor dem Ende kommen, nicht in dem Moment,
  // in dem der Vertrag ohnehin ausgelaufen ist. Ein Vertrag "bis 2029" deckt
  // die Saison 2028 ab; das Angebot faellt deshalb am Ende der Saison 2027.
  const endYear = Number(user.contract.until.slice(0, 4));
  if (endYear > state.season + 2) return;

  const ability = computeOverall(user.attrs, user.position);
  const age = ageOn(user.birthDate, state.date);
  const level = state.competitions[club.leagueId]?.level ?? 3;
  const country = COUNTRY_BY_ID[club.countryId];

  const entries = Object.values(state.seasonStats).filter(
    (s) => s.playerId === user.id && s.season === state.season,
  );
  const apps = entries.reduce((a, s) => a + s.appearances, 0);
  const ratingSum = entries.reduce((a, s) => a + s.ratingSum, 0);
  const avgRating = apps > 0 ? ratingSum / apps : 0;

  // Wer gar nicht spielt, bekommt kein neues Angebot - dann muss ein Wechsel her.
  if (apps < 5 && ability < club.reputation * 0.6) return;

  const base = calcSalary(ability, age, level, club.reputation, country?.wealth ?? 1);
  // Ein makelloser Ruf ist dem Verein etwas wert - Trikots, Sponsoren,
  // Ruhe in der Kabine. Der Ausschlag bleibt klein, rund fuenf Prozent.
  const performanceBonus = clamp(
    (1 + (avgRating - 6.4) * 0.12 + apps / 260) * (0.96 + state.publicImage / 1100),
    0.9, 1.55);
  const salary = Math.round(base * performanceBonus * rng.float(1.0, 1.2));
  // Die angebotene Rolle folgt der aktuellen Rolle, mindestens nach Staerke.
  const byAbility: SquadRole = ability >= club.reputation * 0.95 ? 'Schluesselspieler'
    : ability >= club.reputation * 0.72 ? 'Stammspieler'
    : ability >= club.reputation * 0.55 ? 'Rotationsspieler' : 'Ergaenzungsspieler';
  const role = SQUAD_ROLE_ORDER.indexOf(byAbility) > SQUAD_ROLE_ORDER.indexOf(user.contract.role)
    ? byAbility : user.contract.role;

  state.offers.push({
    id: makeId(state, 'o'),
    clubId: club.id,
    fee: 0,
    salary,
    years: age <= 23 ? rng.int(3, 5) : rng.int(2, 4),
    role,
    goalBonus: Math.round(salary * rng.float(0.15, 0.45)),
    pitch: t('se.renewal.pitch', {
      club: club.name, role: t(`role.${role}`), salary: tNumber(user.contract.salary),
    }),
    expiresOn: addDays(state.date, 21),
    leagueLevel: level,
    renewal: true,
  });
  addNews(state, 'contract', t('se.renewal.news', { club: club.name }),
    t('se.renewal.newsBody', {
      salary: tNumber(salary), role: t(`role.${role}`),
    }), true);
}

/** Angebote an den eigenen Spieler nach der Saison (Konzept Abschnitt 34). */
export function generateUserOffers(state: GameState, rng: Rng) {
  state.offers = [];
  const user = state.players[state.userPlayerId];
  if (!user) return;

  const ability = computeOverall(user.attrs, user.position);
  const age = ageOn(user.birthDate, state.date);
  const currentClub = user.clubId ? state.clubs[user.clubId] : null;
  const currentLevel = currentClub ? state.competitions[currentClub.leagueId]?.level ?? 3 : 3;

  const seasonEntries = Object.values(state.seasonStats).filter(
    (s) => s.playerId === user.id && s.season === state.season,
  );
  const apps = seasonEntries.reduce((a, s) => a + s.appearances, 0);
  const goals = seasonEntries.reduce((a, s) => a + s.goals, 0);
  const ratingSum = seasonEntries.reduce((a, s) => a + s.ratingSum, 0);
  const avgRating = apps > 0 ? ratingSum / apps : 0;

  // Interesse haengt von Leistung, Alter, Reputation - und davon, wie man in
  // der Oeffentlichkeit dasteht. Ein Verein holt sich einen Unruheherd nur,
  // wenn die Leistung ihn traegt; bei einem Vorbild greift man lieber zu.
  let interest = (ability - 45) * 0.06 + (avgRating - 6.4) * 0.9 + goals * 0.035
    + (user.reputation - 40) * 0.012 + (state.publicImage - 50) * 0.012;
  if (age <= 21) interest += 0.35;
  if (apps < 8) interest -= 0.7;
  const offerCount = clamp(Math.round(interest), 0, 4);
  if (offerCount <= 0) return;

  // Wer bieten will, muss zahlen koennen. Vorher entschied allein die
  // Reputation, und ein klammer Verein konnte dasselbe Gehalt bieten wie ein
  // Meister - die Angebotskarte war damit eine Frage des Zufalls statt eine
  // Auskunft ueber den Verein.
  const gehaelter = buildWageIndex(state);
  const erwarteteAbloese = user.marketValue;
  const erwartetesGehalt = calcSalary(ability, age, currentLevel, 60, 1);
  const candidates = Object.values(state.clubs).filter((c) => {
    if (c.id === user.clubId) return false;
    const level = state.competitions[c.leagueId]?.level ?? 3;
    if (level > currentLevel + 1) return false;
    const fits = c.reputation >= ability * 0.55 && c.reputation <= ability * 1.5 + 22;
    if (!fits) return false;
    return canSign(c, gehaelter.get(c.id) ?? 0, erwarteteAbloese, erwartetesGehalt, 1.2);
  });
  if (candidates.length === 0) return;

  const chosen = rng.sample(candidates, Math.min(offerCount, candidates.length));
  for (const club of chosen) {
    const level = state.competitions[club.leagueId]?.level ?? 3;
    const country = COUNTRY_BY_ID[club.countryId];
    const salary = Math.round(calcSalary(ability, age, level, club.reputation, country?.wealth ?? 1)
      * rng.float(1.0, 1.35));
    const role = ability >= club.reputation * 0.72 ? 'Stammspieler'
      : ability >= club.reputation * 0.55 ? 'Rotationsspieler' : 'Ergaenzungsspieler';
    const offer: TransferOffer = {
      id: makeId(state, 'o'),
      clubId: club.id,
      // Die Abloese darf das Budget des Vereins nicht sprengen. Ohne diese
      // Deckelung bot ein Verein bis zum 1,6-fachen Marktwert, auch wenn er
      // das Geld nicht hatte - und die Zahl auf der Karte war eine Erfindung.
      fee: Math.round(Math.min(user.marketValue * rng.float(0.8, 1.6), club.budget)
        / 10000) * 10000,
      salary,
      years: rng.int(2, 5),
      role,
      goalBonus: Math.round(salary * rng.float(0.15, 0.45)),
      pitch: buildPitch(state, club, level, role),
      expiresOn: addDays(state.date, 21),
      leagueLevel: level,
    };
    state.offers.push(offer);
  }

  if (state.offers.length > 0) {
    addNews(state, 'transfer',
      t('se.offers.news', { n: state.offers.length }),
      t('se.offers.newsBody'), true);
  }
}

function buildPitch(state: GameState, club: Club, level: number, role: string): string {
  const league = state.competitions[club.leagueId];
  return t(`se.pitch`, {
    club: club.name,
    league: league?.name ?? t(`se.pitch.tier${Math.min(3, Math.max(1, level))}`),
    role: t(`role.${role}`),
    reputation: club.reputation,
    training: club.training,
  });
}

// --- Neue Saison vorbereiten ------------------------------------------

function resetForNewSeason(state: GameState, rng: Rng) {
  state.season += 1;
  state.date = makeDate(state.season, 7, 1);
  state.seasonPhase = 'preseason';

  for (const player of Object.values(state.players)) {
    player.yellowCardsInLeague = 0;
    player.suspension = 0;
    player.fitness = clamp(player.fitness + 25, 60, 100);
    player.sharpness = clamp(player.sharpness - 15, 25, 100);
    player.form = clamp(50 + rng.normal(0, 8), 30, 70);
  }

  pruneOldSeasons(state);
  startSeason(state, rng);
}

/**
 * Wie viele abgeschlossene Saisons vollstaendig im Spielstand bleiben.
 * Drei reichen fuer jede Ansicht im Spiel und lassen Raum fuer Nachschlagen.
 */
const KEEP_SEASONS = 3;

/**
 * Raeumt die Rohdaten laengst vergangener Saisons ab (Konzept Abschnitt 56).
 *
 * Jede Saison legt rund 5.900 Spiele und ueber 10.000 Saisonstatistiken an.
 * Ohne Aufraeumen waechst ein Spielstand ueber eine ganze Laufbahn auf ein
 * Vielfaches an, und weil bei jedem Autosave der komplette Baum kopiert wird,
 * wird das gegen Karriereende spuerbar traege.
 *
 * Erhalten bleibt alles, was das Spiel spaeter noch liest:
 * die Abschlusstabellen, Rekorde, Auszeichnungen und die Chronik liegen
 * ohnehin in eigenen Feldern; die eigene Statistik jeder Saison und die
 * eigenen Spiele bleiben unangetastet. Entfernt werden nur fremde
 * Einzelergebnisse, die keine Ansicht mehr abfragt.
 */
export function pruneOldSeasons(state: GameState) {
  const cutoff = state.season - KEEP_SEASONS;
  if (cutoff < 0) return;

  for (const match of Object.values(state.matches)) {
    if (match.season >= cutoff) continue;
    // Eigene Partien behalten: Sie tragen die Einzelstatistik des Spielers.
    if (match.userStats) continue;
    delete state.matches[match.id];
    const list = state.matchesByDate[match.date];
    if (list) {
      const rest = list.filter((id) => id !== match.id);
      if (rest.length === 0) delete state.matchesByDate[match.date];
      else state.matchesByDate[match.date] = rest;
    }
  }

  for (const [key, entry] of Object.entries(state.seasonStats)) {
    if (entry.season >= cutoff) continue;
    if (entry.playerId === state.userPlayerId) continue;
    delete state.seasonStats[key];
  }
}

/** Prueft, ob alle Ligaspiele der Saison absolviert sind. */
/**
 * Sind alle nationalen Ligaspiele der Saison absolviert? Nur Ligen zaehlen,
 * damit die Relegation angesetzt wird, sobald die Ligen enden - unabhaengig
 * davon, ob Pokale oder der internationale Wettbewerb noch laufen.
 */
export function leaguesFinished(state: GameState): boolean {
  return Object.values(state.matches).every(
    (m) => m.season !== state.season
      || state.competitions[m.competitionId]?.type !== 'league'
      || m.played,
  );
}

/** Prueft, ob auch die Relegation gespielt ist. */
export function postSeasonFinished(state: GameState): boolean {
  return Object.values(state.matches).every((m) => m.season !== state.season || m.played);
}

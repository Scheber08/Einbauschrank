/**
 * Saisonablauf: Spielplan, Pokal, Relegation, Auf- und Abstieg,
 * Auszeichnungen und Transfers (Konzept Abschnitt 8, 9, 34, 50, 51).
 */
import { maybeOfferBetterAgent, resetAgentSeason } from './agent';
import { computeOverall, POSITION_LINE } from './attributes';
import { COUNTRY_BY_ID } from './countries';
import { CUP_ROUNDS, drawFirstRound, drawRound, winnersOf } from './cup';
import { addDays, ageOn, makeDate, seasonLabel } from './date';
import { developAiPlayer } from './development';
import { buildLeagueSchedule, cupDates, leagueMatchDates } from './fixtures';
import { addCareerEvent, addMatch, addNews, makeId } from './ids';
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
    goalsFor: 0, goalsAgainst: 0, points: 0, note: 'Pokalsieger',
  });

  addNews(state, 'season', `${club.name} gewinnt den ${cup.name}`,
    `${club.name} sichert sich in der Saison ${seasonLabel(state.season)} den ${cup.name}.`, true);

  const user = state.players[state.userPlayerId];
  if (user && user.clubId === clubId) {
    state.honours.push({ season: state.season, label: cup.name });
    addCareerEvent(state, 'title', `${cup.name} gewonnen`,
      `Mit ${club.name} den ${cup.name} geholt.`, { clubId, competitionId: cupId });
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
      name: 'Relegation',
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
    const upperClub = upperTable[17]?.clubId;
    const lowerClub = lowerTable[2]?.clubId;
    if (!upperClub || !lowerClub) continue;

    // Hinspiel beim unterklassigen Verein
    addMatch(state, {
      id: makeId(state, 'm'), competitionId: compId, season: state.season,
      matchday: 1, roundName: `Relegation ${upper.short}/${lower.short} Hinspiel`,
      date: firstLeg, homeClubId: lowerClub, awayClubId: upperClub,
      homeScore: null, awayScore: null, played: false,
    });
    addMatch(state, {
      id: makeId(state, 'm'), competitionId: compId, season: state.season,
      matchday: 2, roundName: `Relegation ${upper.short}/${lower.short} Rueckspiel`,
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
  updateRecords(state);
  updateUserSquadRole(state);
  ageAndDevelop(state, rng);
  runTransferWindow(state, rng);
  resetForNewSeason(state, rng);

  // Nach dem Transferfenster steht fest, ob die Laufbahn weitergeht.
  const forced = checkForcedRetirement(state);
  if (forced) {
    report.retirement = forced;
    addNews(state, 'season', 'Das Ende einer Laufbahn',
      forced.reason === 'age'
        ? `Nach ${forced.appearances} Pflichtspielen beendet ${state.players[state.userPlayerId]?.lastName} `
          + 'die aktive Karriere.'
        : 'Es liegt kein Angebot mehr vor. Die aktive Laufbahn endet hier.', true);
  }

  return report;
}

function announceChampion(state: GameState, league: Competition, clubId: Id, points: number) {
  const club = state.clubs[clubId];
  if (!club) return;
  addNews(state, 'season', `${club.name} ist Meister der ${league.name}`,
    `Mit ${points} Punkten sichert sich ${club.name} den Titel in der Saison ${seasonLabel(state.season)}.`,
    true);

  const user = state.players[state.userPlayerId];
  if (user && user.clubId === clubId) {
    state.honours.push({ season: state.season, label: `Meister ${league.name}` });
    addCareerEvent(state, 'title', `Meister der ${league.name}`,
      `Mit ${club.name} die Meisterschaft gewonnen.`, { clubId, competitionId: league.id });
  }
}

function applyPromotionRelegation(state: GameState, countryId: Id, report: SeasonReport) {
  const leagues = leaguesOfCountry(state, countryId);
  const winners = relegationWinners(state, countryId);
  const moves: { clubId: Id; toLeague: Id; fromLevel: number; up: boolean }[] = [];

  for (let i = 0; i < leagues.length; i++) {
    const league = leagues[i];
    const upper = leagues[i - 1];
    const lower = leagues[i + 1];
    const table = sortedTable(state, league.id);

    // Direkter Abstieg: Platz 19 und 20
    if (lower) {
      for (const row of table.slice(18, 20)) {
        moves.push({ clubId: row.clubId, toLeague: lower.id, fromLevel: league.level, up: false });
      }
    }
    // Direkter Aufstieg: Platz 1 und 2
    if (upper) {
      for (const row of table.slice(0, 2)) {
        moves.push({ clubId: row.clubId, toLeague: upper.id, fromLevel: league.level, up: true });
      }
    }
    // Relegation
    if (lower) {
      const upperClub = table[17]?.clubId;
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

    // Wirtschaftliche Folgen
    const factor = move.up ? 1.35 : 0.72;
    club.budget = Math.round(club.budget * factor);
    club.wageBudget = Math.round(club.wageBudget * factor);
    club.reputation = clamp(Math.round(club.reputation + (move.up ? 6 : -7)), 8, 96);

    if (move.up) report.promoted.push({ clubId: club.id, fromLevel: move.fromLevel });
    else report.relegated.push({ clubId: club.id, fromLevel: move.fromLevel });

    addNews(state, 'season',
      move.up ? `${club.name} steigt auf` : `${club.name} steigt ab`,
      `${club.name} spielt kommende Saison in der ${league.name}.`,
      state.players[state.userPlayerId]?.clubId === club.id);

    const user = state.players[state.userPlayerId];
    if (user && user.clubId === club.id) {
      addCareerEvent(state, move.up ? 'promotion' : 'relegation',
        move.up ? 'Aufstieg geschafft' : 'Abstieg hinnehmen muessen',
        `${club.name} spielt kommende Saison in der ${league.name}.`, { clubId: club.id });
      if (move.up) state.honours.push({ season: state.season, label: `Aufstieg in die ${league.name}` });
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
        addCareerEvent(state, 'award', award.label, `Auszeichnung erhalten: ${value}`,
          { competitionId: league.id });
        addNews(state, 'award', `Auszeichnung: ${award.label}`,
          `${award.playerName} wird ausgezeichnet (${value}).`, true);
      }
    };

    const scorer = entries.slice().sort((a, b) => b.goals - a.goals || b.assists - a.assists)[0];
    push('topScorer', 'Torschuetzenkoenig', scorer, `${scorer?.goals ?? 0} Tore`);

    const assister = entries.slice().sort((a, b) => b.assists - a.assists)[0];
    push('topAssists', 'Bester Vorlagengeber', assister, `${assister?.assists ?? 0} Vorlagen`);

    const eligible = entries.filter((s) => s.appearances >= 18);
    const best = eligible.slice().sort((a, b) => averageRating(b) - averageRating(a))[0];
    push('playerOfSeason', 'Spieler des Jahres', best, `Note ${averageRating(best ?? entries[0]).toFixed(2)}`);

    const keepers = eligible.filter((s) => {
      const p = state.players[s.playerId];
      return p && POSITION_LINE[p.position] === 'GK';
    });
    const bestKeeper = keepers.slice().sort(
      (a, b) => b.cleanSheets - a.cleanSheets || averageRating(b) - averageRating(a))[0];
    push('bestKeeper', 'Bester Torwart', bestKeeper, `${bestKeeper?.cleanSheets ?? 0} Spiele ohne Gegentor`);

    const youngsters = eligible.filter((s) => {
      const p = state.players[s.playerId];
      return p && ageOn(p.birthDate, state.date) <= 21;
    });
    const bestYoung = youngsters.slice().sort((a, b) => averageRating(b) - averageRating(a))[0];
    push('youngPlayer', 'Nachwuchsspieler des Jahres', bestYoung,
      `Note ${averageRating(bestYoung ?? entries[0]).toFixed(2)}`);
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
  let target: SquadRole;
  if (appearances >= 25 && avgRating >= 7.0 && better <= 2) target = 'Schluesselspieler';
  else if (appearances >= 20 && avgRating >= 6.6) target = 'Stammspieler';
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
  addNews(state, 'coach',
    up ? 'Neue Rolle im Kader' : 'Rolle im Kader angepasst',
    up
      ? `Nach ${appearances} Einsaetzen plant ${club?.name ?? 'der Verein'} `
        + `kommende Saison als ${next} mit dir.`
      : `${club?.name ?? 'Der Verein'} sieht dich kommende Saison als ${next}. `
        + 'Mehr Einsatzzeit bringt dich zurueck.',
    true);
  if (up) {
    addCareerEvent(state, 'other', `Neue Kaderrolle: ${next}`,
      `${club?.name ?? 'Der Verein'} befoerdert dich zum ${next}.`);
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
      label: 'Meiste Tore in einer Saison',
      scope: 'Spieler',
      holderId: bestSeasonScorer.playerId,
      holderName: p ? `${p.firstName} ${p.lastName}` : 'Unbekannt',
      value: bestSeasonScorer.goals,
      displayValue: `${bestSeasonScorer.goals} Tore`,
    }, state.date);
  }

  const careerEntries = Object.values(state.seasonStats).filter((s) => s.playerId === state.userPlayerId);
  const careerGoals = careerEntries.reduce((a, s) => a + s.goals, 0);
  const careerApps = careerEntries.reduce((a, s) => a + s.appearances, 0);
  tryRecord(state, {
    key: `careerGoals:${state.userPlayerId}`,
    label: 'Karrieretore',
    scope: 'Eigene Karriere',
    holderId: state.userPlayerId,
    holderName: name,
    value: careerGoals,
    displayValue: `${careerGoals} Tore`,
  }, state.date);
  tryRecord(state, {
    key: `careerApps:${state.userPlayerId}`,
    label: 'Karriereeinsaetze',
    scope: 'Eigene Karriere',
    holderId: state.userPlayerId,
    holderName: name,
    value: careerApps,
    displayValue: `${careerApps} Spiele`,
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
  for (const p of Object.values(state.players)) {
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

function runTransferWindow(state: GameState, rng: Rng) {
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

    player.clubId = target.id;
    player.contract = {
      clubId: target.id,
      salary: calcSalary(ability, ageOn(player.birthDate, state.date), targetLevel,
        target.reputation, country?.wealth ?? 1),
      until: makeDate(state.season + 1 + rng.int(1, 4), 6, 30),
      role: ability >= target.reputation * 0.6 ? 'Stammspieler' : 'Rotationsspieler',
      goalBonus: 0,
      appearanceBonus: 0,
    };
    void currentLevel;
  }

  generateUserOffers(state, rng);
  offerUserRenewal(state, rng);
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

  // Nur wenn der Vertrag im kommenden Jahr auslaeuft (Datum ist YYYY-MM-DD).
  const endYear = Number(user.contract.until.slice(0, 4));
  if (endYear > state.season + 1) return;

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
  const performanceBonus = clamp(1 + (avgRating - 6.4) * 0.12 + apps / 260, 0.9, 1.5);
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
    pitch: `${club.name} moechte mit dir verlaengern und plant dich als ${role} ein. `
      + `Bisheriges Gehalt ${user.contract.salary.toLocaleString('de-DE')} Euro pro Woche.`,
    expiresOn: addDays(state.date, 21),
    leagueLevel: level,
    renewal: true,
  });
  addNews(state, 'contract', `${club.name} bietet dir einen neuen Vertrag`,
    `Dein Vertrag laeuft aus. Der Verein legt ein Angebot ueber `
    + `${salary.toLocaleString('de-DE')} Euro pro Woche als ${role} vor.`, true);
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

  // Interesse haengt von Leistung, Alter und Reputation ab.
  let interest = (ability - 45) * 0.06 + (avgRating - 6.4) * 0.9 + goals * 0.035
    + (user.reputation - 40) * 0.012;
  if (age <= 21) interest += 0.35;
  if (apps < 8) interest -= 0.7;
  const offerCount = clamp(Math.round(interest), 0, 4);
  if (offerCount <= 0) return;

  const candidates = Object.values(state.clubs).filter((c) => {
    if (c.id === user.clubId) return false;
    const level = state.competitions[c.leagueId]?.level ?? 3;
    if (level > currentLevel + 1) return false;
    const fits = c.reputation >= ability * 0.55 && c.reputation <= ability * 1.5 + 22;
    return fits;
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
      fee: Math.round(user.marketValue * rng.float(0.8, 1.6) / 10000) * 10000,
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
    addNews(state, 'transfer', `${state.offers.length} Vereine zeigen Interesse`,
      'Nach der Saison liegen neue Angebote vor. Entscheide im Bereich Transfers.', true);
  }
}

function buildPitch(state: GameState, club: Club, level: number, role: string): string {
  const league = state.competitions[club.leagueId];
  const levelText = level === 1 ? 'erste Liga' : level === 2 ? 'zweite Liga' : 'dritte Liga';
  return `${club.name} (${league?.name ?? levelText}) plant dich als ${role} ein. `
    + `Vereinsreputation ${club.reputation}, Trainingsanlagen ${club.training}.`;
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

  startSeason(state, rng);
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

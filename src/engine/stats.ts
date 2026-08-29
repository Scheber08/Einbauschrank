/** Statistikverwaltung, Rekorde und Auszeichnungen (Konzept Abschnitt 43-50). */
import { POSITION_LINE } from './attributes';
import type { GameDate } from './date';
import { seasonLabel } from './date';
import {
  emptySeasonStats, type GameState, type Id, type PlayerMatchStats,
  type RecordEntry, type SeasonStats,
} from './types';

export function statsKey(playerId: Id, season: number, competitionId: Id): string {
  return `${playerId}:${season}:${competitionId}`;
}

export function getSeasonStats(
  state: GameState, playerId: Id, season: number, competitionId: Id, clubId: Id,
): SeasonStats {
  const key = statsKey(playerId, season, competitionId);
  let entry = state.seasonStats[key];
  if (!entry) {
    entry = emptySeasonStats(playerId, season, competitionId, clubId);
    state.seasonStats[key] = entry;
  }
  return entry;
}

/** Uebertraegt eine Einzelspielstatistik in die Saisonwerte. */
export function accumulate(
  state: GameState, s: PlayerMatchStats, season: number, competitionId: Id, isHome: boolean,
  cleanSheet: boolean,
) {
  const entry = getSeasonStats(state, s.playerId, season, competitionId, s.clubId);
  entry.appearances++;
  if (s.started) entry.starts++;
  entry.minutes += s.minutes;
  entry.goals += s.goals;
  entry.assists += s.assists;
  entry.shots += s.shots;
  entry.shotsOnTarget += s.shotsOnTarget;
  entry.passes += s.passes;
  entry.passesCompleted += s.passesCompleted;
  entry.keyPasses += s.keyPasses;
  entry.crosses += s.crosses;
  entry.crossesCompleted += s.crossesCompleted;
  entry.dribbles += s.dribbles;
  entry.dribblesCompleted += s.dribblesCompleted;
  entry.duels += s.duels;
  entry.duelsWon += s.duelsWon;
  entry.tackles += s.tackles;
  entry.interceptions += s.interceptions;
  entry.saves += s.saves;
  entry.goalsConceded += s.goalsConceded;
  entry.yellowCards += s.yellowCards;
  entry.redCards += s.redCards;
  if (s.motm) entry.motm++;
  entry.ratingSum += s.rating;
  if (isHome) { entry.homeAppearances++; entry.homeGoals += s.goals; }
  else entry.awayGoals += s.goals;
  if (cleanSheet && (POSITION_LINE[s.position] === 'GK' || POSITION_LINE[s.position] === 'DEF')
    && s.minutes >= 60) {
    entry.cleanSheets++;
  }
}

export function averageRating(entry: SeasonStats): number {
  return entry.appearances > 0 ? entry.ratingSum / entry.appearances : 0;
}

/** Alle Saisonwerte eines Spielers, optional gefiltert (Konzept Abschnitt 45). */
export interface StatsFilter {
  season?: number;
  competitionId?: Id;
  clubId?: Id;
}

export function collectStats(state: GameState, playerId: Id, filter: StatsFilter = {}): SeasonStats[] {
  return Object.values(state.seasonStats).filter((s) =>
    s.playerId === playerId
    && (filter.season === undefined || s.season === filter.season)
    && (filter.competitionId === undefined || s.competitionId === filter.competitionId)
    && (filter.clubId === undefined || s.clubId === filter.clubId));
}

export function sumStats(entries: SeasonStats[]): SeasonStats {
  const total = emptySeasonStats('', 0, '', '');
  for (const e of entries) {
    total.appearances += e.appearances;
    total.starts += e.starts;
    total.minutes += e.minutes;
    total.goals += e.goals;
    total.assists += e.assists;
    total.shots += e.shots;
    total.shotsOnTarget += e.shotsOnTarget;
    total.passes += e.passes;
    total.passesCompleted += e.passesCompleted;
    total.keyPasses += e.keyPasses;
    total.dribbles += e.dribbles;
    total.dribblesCompleted += e.dribblesCompleted;
    total.duels += e.duels;
    total.duelsWon += e.duelsWon;
    total.tackles += e.tackles;
    total.interceptions += e.interceptions;
    total.saves += e.saves;
    total.cleanSheets += e.cleanSheets;
    total.goalsConceded += e.goalsConceded;
    total.yellowCards += e.yellowCards;
    total.redCards += e.redCards;
    total.motm += e.motm;
    total.ratingSum += e.ratingSum;
    total.homeAppearances += e.homeAppearances;
    total.homeGoals += e.homeGoals;
    total.awayGoals += e.awayGoals;
  }
  return total;
}

/** Torjaegerliste eines Wettbewerbs. */
export function topScorers(
  state: GameState, competitionId: Id, season: number, limit = 20,
): { playerId: Id; goals: number; assists: number; appearances: number }[] {
  return Object.values(state.seasonStats)
    .filter((s) => s.competitionId === competitionId && s.season === season && s.goals > 0)
    .sort((a, b) => b.goals - a.goals || b.assists - a.assists || a.minutes - b.minutes)
    .slice(0, limit)
    .map((s) => ({
      playerId: s.playerId, goals: s.goals, assists: s.assists, appearances: s.appearances,
    }));
}

export function topAssists(
  state: GameState, competitionId: Id, season: number, limit = 20,
) {
  return Object.values(state.seasonStats)
    .filter((s) => s.competitionId === competitionId && s.season === season && s.assists > 0)
    .sort((a, b) => b.assists - a.assists || b.goals - a.goals)
    .slice(0, limit);
}

// --- Rekorde (Konzept Abschnitt 48) ------------------------------------

export interface RecordCandidate {
  key: string;
  label: string;
  scope: string;
  holderId?: Id;
  holderName: string;
  value: number;
  displayValue: string;
}

/**
 * Traegt einen Rekord ein, wenn der Wert den bisherigen uebertrifft.
 * Gibt true zurueck, wenn ein neuer Rekord aufgestellt wurde.
 */
export function tryRecord(
  state: GameState, candidate: RecordCandidate, date: GameDate,
): boolean {
  const existing = state.records[candidate.key];
  if (existing && existing.value >= candidate.value) return false;
  const entry: RecordEntry = {
    key: candidate.key,
    label: candidate.label,
    scope: candidate.scope,
    holderId: candidate.holderId,
    holderName: candidate.holderName,
    value: candidate.value,
    displayValue: candidate.displayValue,
    season: state.season,
    date,
  };
  state.records[candidate.key] = entry;
  return true;
}

export function recordList(state: GameState): RecordEntry[] {
  return Object.values(state.records).sort((a, b) => a.scope.localeCompare(b.scope)
    || a.label.localeCompare(b.label));
}

/** Karrieresumme des eigenen Spielers ueber alle Saisons und Wettbewerbe. */
export function careerTotals(state: GameState): SeasonStats {
  return sumStats(collectStats(state, state.userPlayerId));
}

export function seasonSummaryLabel(season: number): string {
  return seasonLabel(season);
}

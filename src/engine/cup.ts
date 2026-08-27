/** Nationaler Pokalwettbewerb (Konzept Abschnitt 9). */
import type { GameDate } from './date';
import { Rng } from './rng';
import type { Club, Id, Match } from './types';
import { t } from '../i18n';

/**
 * Die Pokalrunden als Schluessel. Der angezeigte Name kommt aus dem
 * Sprachkatalog - frueher stand hier der deutsche Text, und an drei Stellen
 * wurde mit `=== 'Finale'` dagegen verglichen. Solche Vergleiche waeren mit
 * der Uebersetzung stillschweigend falsch geworden.
 */
export const CUP_ROUNDS = [
  'round.preliminary',
  'round.r32',
  'round.r16',
  'round.quarter',
  'round.semi',
  'round.final',
] as const;

export type CupRound = (typeof CUP_ROUNDS)[number];

/**
 * Erste Runde: 60 Vereine. Die vier bestplatzierten Erstligisten sind gesetzt
 * und steigen erst in der zweiten Runde ein, damit 32 Teams uebrig bleiben.
 */
export function drawFirstRound(
  rng: Rng, competitionId: Id, season: number, clubs: Club[],
  date: GameDate, makeId: () => Id,
): { matches: Match[]; byes: Id[] } {
  const sorted = clubs.slice().sort((a, b) => b.reputation - a.reputation);
  const byes = sorted.slice(0, 4).map((c) => c.id);
  const rest = rng.shuffle(sorted.slice(4));

  const matches: Match[] = [];
  for (let i = 0; i < rest.length; i += 2) {
    const a = rest[i];
    const b = rest[i + 1];
    if (!b) { byes.push(a.id); break; }
    // Der unterklassige Verein hat Heimrecht.
    const aLevel = levelOf(a);
    const bLevel = levelOf(b);
    const [home, away] = aLevel >= bLevel ? [a, b] : [b, a];
    matches.push(makeCupMatch(makeId(), competitionId, season, 1, t('round.preliminary'), date, home.id, away.id));
  }
  return { matches, byes };
}

export function drawRound(
  rng: Rng, competitionId: Id, season: number, roundIndex: number,
  clubIds: Id[], clubs: Record<Id, Club>, date: GameDate, makeId: () => Id,
): Match[] {
  const roundIdx = Math.min(roundIndex - 1, CUP_ROUNDS.length - 1);
  const roundName = t(CUP_ROUNDS[roundIdx]);
  const pool = rng.shuffle(clubIds.slice());
  const matches: Match[] = [];
  const isFinal = roundIdx === CUP_ROUNDS.length - 1;

  for (let i = 0; i < pool.length; i += 2) {
    const a = pool[i];
    const b = pool[i + 1];
    if (!b) break;
    const clubA = clubs[a];
    const clubB = clubs[b];
    const [home, away] = isFinal
      ? [a, b]
      : levelOf(clubA) >= levelOf(clubB) ? [a, b] : [b, a];
    const match = makeCupMatch(makeId(), competitionId, season, roundIndex, roundName, date, home, away);
    if (isFinal) match.neutralVenue = true;
    matches.push(match);
  }
  return matches;
}

function makeCupMatch(
  id: Id, competitionId: Id, season: number, matchday: number,
  roundName: string, date: GameDate, homeClubId: Id, awayClubId: Id,
): Match {
  return {
    id, competitionId, season, matchday, roundName, date,
    homeClubId, awayClubId,
    homeScore: null, awayScore: null, played: false,
  };
}

function levelOf(club: Club | undefined): number {
  if (!club) return 3;
  const match = /-l(\d)$/.exec(club.leagueId);
  return match ? Number(match[1]) : 3;
}

/** Ermittelt die Sieger einer gespielten Pokalrunde. */
export function winnersOf(matches: Match[]): Id[] {
  const winners: Id[] = [];
  for (const m of matches) {
    if (!m.played || m.homeScore === null || m.awayScore === null) continue;
    if (m.homeScore > m.awayScore) winners.push(m.homeClubId);
    else if (m.awayScore > m.homeScore) winners.push(m.awayClubId);
    else if (m.penalties) {
      winners.push(m.penalties[0] > m.penalties[1] ? m.homeClubId : m.awayClubId);
    }
  }
  return winners;
}

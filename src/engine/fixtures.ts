/** Spielplanerstellung und Saisonkalender (Konzept Abschnitt 7 und 51). */
import { addDays, makeDate, month, nextWeekday, type GameDate } from './date';
import { Rng } from './rng';
import type { Id, Match } from './types';

/**
 * Kreisverfahren fuer eine einfache Runde.
 * Liefert n-1 Spieltage mit je n/2 Paarungen [heim, auswaerts].
 */
export function roundRobin(teamIds: Id[]): [Id, Id][][] {
  const teams = teamIds.slice();
  if (teams.length % 2 !== 0) teams.push('__bye__');
  const n = teams.length;
  const rounds: [Id, Id][][] = [];
  const fixed = teams[0];
  let rotating = teams.slice(1);

  for (let r = 0; r < n - 1; r++) {
    const pairings: [Id, Id][] = [];
    const order = [fixed, ...rotating];
    for (let i = 0; i < n / 2; i++) {
      const a = order[i];
      const b = order[n - 1 - i];
      if (a === '__bye__' || b === '__bye__') continue;
      // Heimrecht abwechseln, damit nicht immer dasselbe Team beginnt.
      pairings.push(r % 2 === 0 ? [a, b] : [b, a]);
    }
    rounds.push(pairings);
    rotating = [rotating[rotating.length - 1], ...rotating.slice(0, -1)];
  }
  return rounds;
}

/** Alle Samstage einer Saison, ohne Winterpause. */
export function leagueMatchDates(season: number): GameDate[] {
  const dates: GameDate[] = [];
  let d = nextWeekday(makeDate(season, 8, 1), 6); // erster Samstag im August
  const end = makeDate(season + 1, 6, 5);

  while (d < end) {
    const m = month(d);
    const day = Number(d.slice(8, 10));
    const inWinterBreak = (m === 12 && day >= 21) || (m === 1 && day <= 9);
    if (!inWinterBreak) dates.push(d);
    d = addDays(d, 7);
  }
  return dates;
}

/** Mittwochstermine fuer Pokalrunden, verteilt ueber die Saison. */
export function cupDates(season: number, rounds: number): GameDate[] {
  const saturdays = leagueMatchDates(season);
  // Nach welchen Ligaspieltagen eine Pokalrunde stattfindet.
  const anchors = [2, 7, 13, 20, 26, 31, 35, 37].slice(0, rounds);
  return anchors.map((i) => addDays(saturdays[Math.min(i, saturdays.length - 1)], 4));
}

export interface ScheduleOptions {
  competitionId: Id;
  season: number;
  clubIds: Id[];
  makeId: () => Id;
}

/**
 * Hin- und Rueckrunde, 38 Spieltage bei 20 Vereinen.
 * Die Rueckrunde spiegelt die Hinrunde mit vertauschtem Heimrecht.
 */
export function buildLeagueSchedule(rng: Rng, opts: ScheduleOptions): Match[] {
  const clubs = rng.shuffle(opts.clubIds.slice());
  const firstHalf = roundRobin(clubs);
  const dates = leagueMatchDates(opts.season);
  const matches: Match[] = [];

  const allRounds: [Id, Id][][] = [
    ...firstHalf,
    ...firstHalf.map((round) => round.map(([h, a]) => [a, h] as [Id, Id])),
  ];

  allRounds.forEach((round, index) => {
    const date = dates[Math.min(index, dates.length - 1)];
    for (const [homeClubId, awayClubId] of round) {
      matches.push({
        id: opts.makeId(),
        competitionId: opts.competitionId,
        season: opts.season,
        matchday: index + 1,
        date,
        homeClubId,
        awayClubId,
        homeScore: null,
        awayScore: null,
        played: false,
      });
    }
  });

  return matches;
}

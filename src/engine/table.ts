/** Tabellenberechnung mit den Regeln aus Konzept Abschnitt 7. */
import type { Id, Match, TableRow } from './types';

export function emptyRow(clubId: Id): TableRow {
  return {
    clubId, played: 0, won: 0, drawn: 0, lost: 0,
    goalsFor: 0, goalsAgainst: 0, points: 0, form: [],
  };
}

export function buildTable(clubIds: Id[], matches: Match[]): Record<Id, TableRow> {
  const table: Record<Id, TableRow> = {};
  for (const id of clubIds) table[id] = emptyRow(id);

  for (const m of matches) {
    if (!m.played || m.homeScore === null || m.awayScore === null) continue;
    const home = table[m.homeClubId];
    const away = table[m.awayClubId];
    if (!home || !away) continue;

    home.played++; away.played++;
    home.goalsFor += m.homeScore; home.goalsAgainst += m.awayScore;
    away.goalsFor += m.awayScore; away.goalsAgainst += m.homeScore;

    if (m.homeScore > m.awayScore) {
      home.won++; home.points += 3; away.lost++;
      home.form.push('S'); away.form.push('N');
    } else if (m.homeScore < m.awayScore) {
      away.won++; away.points += 3; home.lost++;
      home.form.push('N'); away.form.push('S');
    } else {
      home.drawn++; away.drawn++;
      home.points++; away.points++;
      home.form.push('U'); away.form.push('U');
    }
  }

  for (const row of Object.values(table)) {
    row.form = row.form.slice(-5);
  }
  return table;
}

export function goalDiff(row: TableRow): number {
  return row.goalsFor - row.goalsAgainst;
}

/** Direkter Vergleich zweier Vereine: Punkte, dann Tordifferenz. */
function headToHead(a: Id, b: Id, matches: Match[]): number {
  let ptsA = 0, ptsB = 0, gdA = 0;
  for (const m of matches) {
    if (!m.played || m.homeScore === null || m.awayScore === null) continue;
    const involves = (m.homeClubId === a && m.awayClubId === b) || (m.homeClubId === b && m.awayClubId === a);
    if (!involves) continue;
    const aHome = m.homeClubId === a;
    const aGoals = aHome ? m.homeScore : m.awayScore;
    const bGoals = aHome ? m.awayScore : m.homeScore;
    gdA += aGoals - bGoals;
    if (aGoals > bGoals) ptsA += 3;
    else if (aGoals < bGoals) ptsB += 3;
    else { ptsA++; ptsB++; }
  }
  if (ptsA !== ptsB) return ptsB - ptsA;
  return -gdA;
}

/**
 * Sortiert die Tabelle: Punkte, Tordifferenz, erzielte Tore,
 * direkter Vergleich, Anzahl der Siege.
 */
export function sortTable(table: Record<Id, TableRow>, matches: Match[]): TableRow[] {
  return Object.values(table).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (goalDiff(b) !== goalDiff(a)) return goalDiff(b) - goalDiff(a);
    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
    const h2h = headToHead(a.clubId, b.clubId, matches);
    if (h2h !== 0) return h2h;
    if (b.won !== a.won) return b.won - a.won;
    return a.clubId.localeCompare(b.clubId);
  });
}

export function positionOf(clubId: Id, sorted: TableRow[]): number {
  return sorted.findIndex((r) => r.clubId === clubId) + 1;
}

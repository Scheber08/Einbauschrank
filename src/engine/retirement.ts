/**
 * Abschluss der Spielerlaufbahn (Konzept Abschnitt 2 und 18).
 *
 * Eine Karriere braucht ein Ende: Ab einem gewissen Alter kann der Spieler
 * selbst aufhoeren, irgendwann findet er keinen Verein mehr, und mit 41 ist
 * endgueltig Schluss. Zum Abschluss wird die Laufbahn bewertet.
 */
import { ageOn } from './date';
import { careerTotals } from './stats';
import type { GameState, Id, Retirement } from './types';

/** Ab diesem Alter kann der Spieler freiwillig aufhoeren. */
export const RETIREMENT_MIN_AGE = 33;
/** Mit diesem Alter endet die Laufbahn in jedem Fall. */
export const RETIREMENT_MAX_AGE = 41;

/**
 * Bewertung der Laufbahn. Beruecksichtigt Einsaetze, Tore und Titel -
 * eine lange solide Karriere zaehlt ebenso wie eine kurze glanzvolle.
 */
export function careerStatus(goals: number, apps: number, honours: number): string {
  const score = apps * 0.4 + goals * 2 + honours * 12;
  if (score > 900) return 'Fussballikone';
  if (score > 650) return 'Weltfussballer';
  if (score > 450) return 'Internationaler Superstar';
  if (score > 300) return 'Nationaler Star';
  if (score > 190) return 'Vereinslegende';
  if (score > 120) return 'Publikumsliebling';
  if (score > 60) return 'Stammspieler';
  if (score > 20) return 'Solider Profi';
  return 'Amateur';
}

/** Darf der Spieler jetzt freiwillig zuruecktreten? */
export function canRetire(state: GameState): boolean {
  if (state.retirement) return false;
  const user = state.players[state.userPlayerId];
  if (!user) return false;
  return ageOn(user.birthDate, state.date) >= RETIREMENT_MIN_AGE;
}

/** Alle Vereine, fuer die der Spieler im Lauf der Karriere aufgelaufen ist. */
function clubHistory(state: GameState): string[] {
  const names: string[] = [];
  const seen = new Set<Id>();
  for (const s of state.userMatchStats) {
    if (seen.has(s.clubId)) continue;
    seen.add(s.clubId);
    const club = state.clubs[s.clubId];
    if (club) names.push(club.name);
  }
  const current = state.players[state.userPlayerId]?.clubId;
  if (current && !seen.has(current) && state.clubs[current]) {
    names.push(state.clubs[current].name);
  }
  return names;
}

/**
 * Beendet die Laufbahn und legt die Abschlussbilanz an.
 * Der Spieler verliert seinen Verein - gespielt wird danach nicht mehr.
 */
export function retireUser(state: GameState, reason: Retirement['reason']): Retirement {
  const user = state.players[state.userPlayerId];
  const totals = careerTotals(state);
  const apps = totals.appearances;
  const summary: Retirement = {
    season: state.season,
    date: state.date,
    age: user ? ageOn(user.birthDate, state.date) : 0,
    reason,
    status: careerStatus(totals.goals, apps, state.honours.length),
    appearances: apps,
    goals: totals.goals,
    assists: totals.assists,
    averageRating: apps > 0 ? totals.ratingSum / apps : 0,
    honours: state.honours.length,
    clubs: clubHistory(state),
  };
  state.retirement = summary;
  state.offers = [];
  state.pendingMatchId = null;
  if (user) {
    user.clubId = null;
    user.contract = null;
    user.injury = null;
  }
  return summary;
}

/**
 * Prueft zum Saisonende, ob die Laufbahn unfreiwillig endet: mit 41 in jedem
 * Fall, ohne Verein und ohne Angebote ebenfalls.
 */
export function checkForcedRetirement(state: GameState): Retirement | null {
  if (state.retirement) return null;
  const user = state.players[state.userPlayerId];
  if (!user) return null;
  const age = ageOn(user.birthDate, state.date);
  if (age >= RETIREMENT_MAX_AGE) return retireUser(state, 'age');
  // Kein Verein und niemand bietet etwas an: die Laufbahn endet.
  if (!user.clubId && state.offers.length === 0 && age >= RETIREMENT_MIN_AGE) {
    return retireUser(state, 'noClub');
  }
  return null;
}

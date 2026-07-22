/** Fortlaufende IDs innerhalb eines Spielstands. */
import type { GameDate } from './date';
import type { GameState, Id, Match, NewsCategory } from './types';

export function makeId(state: { nextId: number }, prefix: string): Id {
  state.nextId += 1;
  return `${prefix}${state.nextId}`;
}

/** Fuegt ein Spiel in den Spielplan ein und pflegt den Datumsindex. */
export function addMatch(state: GameState, match: Match) {
  state.matches[match.id] = match;
  if (!state.matchesByDate[match.date]) state.matchesByDate[match.date] = [];
  state.matchesByDate[match.date].push(match.id);
}

export function matchesOn(state: GameState, date: GameDate): Match[] {
  return (state.matchesByDate[date] ?? []).map((id) => state.matches[id]).filter(Boolean);
}

export function addNews(
  state: GameState, category: NewsCategory, headline: string, body: string,
  important = false,
) {
  state.news.unshift({
    id: makeId(state, 'n'),
    date: state.date,
    category,
    headline,
    body,
    read: false,
    important,
  });
  if (state.news.length > 400) state.news.length = 400;
}

export function addCareerEvent(
  state: GameState, type: string, title: string, description: string,
  extra: { clubId?: Id; competitionId?: Id } = {},
) {
  state.careerEvents.push({
    id: makeId(state, 'e'),
    date: state.date,
    type,
    title,
    description,
    ...extra,
  });
}

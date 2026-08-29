/** Fortlaufende IDs innerhalb eines Spielstands. */
import type { GameDate } from './date';
import type { GameState, Id, Match, NewsCategory } from './types';

export function makeId(state: { nextId: number }, prefix: string): Id {
  state.nextId += 1;
  return `${prefix}${state.nextId}`;
}

/**
 * Id fuer reinen Text - Nachrichten und Chronikeintraege.
 *
 * Bewusst ein eigener Zaehler. Aus einer **Spiel**-Id werden Wetter,
 * Schiedsrichter, Anstosszeit und Formation abgeleitet; wer Text aus
 * demselben Zaehler bedient, verschiebt mit jeder zusaetzlichen
 * Meldung den gesamten spaeteren Spielplan. Gemessen: eine einzige neue
 * Genesungsnachricht liess die Zahl der eigenen Spielszenen ueber
 * dreissig Partien auf null fallen - nicht kaputt, nur eine andere Welt.
 */
export function makeTextId(state: { nextTextId?: number }, prefix: string): Id {
  state.nextTextId = (state.nextTextId ?? 0) + 1;
  return `${prefix}t${state.nextTextId}`;
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
    id: makeTextId(state, 'n'),
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
    id: makeTextId(state, 'e'),
    date: state.date,
    type,
    title,
    description,
    ...extra,
  });
}

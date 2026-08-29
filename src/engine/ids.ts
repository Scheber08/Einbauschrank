/** Fortlaufende IDs innerhalb eines Spielstands. */
import type { GameDate } from './date';
import type { GameState, Id, Match, NewsCategory, TransferOffer } from './types';

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

/**
 * Nimmt ein Angebot an - und raeumt dabei auf.
 *
 * Angebote wurden bisher nur angehaengt. Geleert hat die Liste allein
 * `generateUserOffers` nach der Saison; Vertragsverlaengerung,
 * Vorvertrag, Berateranfrage und Leihe kamen einfach obendrauf. Damit
 * standen mehrere Angebote **desselben Vereins** nebeneinander, jedes
 * mit eigenen Zahlen - fuer den Spieler nicht unterscheidbar und nicht
 * erklaerbar.
 *
 * Ein neues Angebot desselben Vereins ersetzt deshalb das alte. Nur
 * ein Vorvertrag steht daneben: Er betrifft die naechste Saison und
 * ist eine andere Entscheidung als ein Wechsel jetzt.
 */
export function addOffer(state: GameState, offer: TransferOffer) {
  state.offers = state.offers.filter((o) => o.clubId !== offer.clubId
    || !!o.preContract !== !!offer.preContract);
  state.offers.push(offer);
}

/**
 * Entfernt abgelaufene Angebote.
 *
 * Jedes Angebot traegt seit je ein `expiresOn` - gelesen hat es
 * niemand. Ein Verein, der vor zwei Jahren einmal gefragt hat, stand
 * damit bis zum Karriereende in der Liste.
 */
export function expireOffers(state: GameState) {
  state.offers = state.offers.filter((o) => o.expiresOn >= state.date);
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

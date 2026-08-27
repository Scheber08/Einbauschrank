/**
 * Laufende Karrieremeilensteine.
 *
 * Die Chronik kannte bisher nur Premieren: Debuet, erstes Tor, erste Vorlage.
 * Waren die durch, schwieg sie - in einer gemessenen Karriere lag der letzte
 * Eintrag drei Jahre zurueck, obwohl der Spieler in der Zeit 189 Pflichtspiele
 * gemacht und 62 Tore geschossen hatte. Diese Marken greifen dauerhaft und
 * halten den Bogen einer Laufbahn sichtbar.
 *
 * Die Abstaende wachsen bewusst mit: Am Anfang faellt oft etwas, spaeter wird
 * jede Marke seltener und dadurch schwerer.
 */
import { t } from '../i18n';
import { addCareerEvent, addNews } from './ids';
import { socialMilestone } from './social';
import type { Rng } from './rng';
import type { GameState, Id, NewsCategory } from './types';

const APP_MARKS = [25, 50, 100, 150, 200, 250, 300, 400, 500, 600, 700, 800];
const GOAL_MARKS = [10, 25, 50, 75, 100, 150, 200, 250, 300, 400, 500];
const ASSIST_MARKS = [10, 25, 50, 75, 100, 150, 200];
const CAP_MARKS = [10, 25, 50, 75, 100, 125, 150];

/** Ab dieser Marke ist es keine Randnotiz mehr, sondern eine Schlagzeile. */
const GROSS = { apps: 100, goals: 50, assists: 50, caps: 50 };

/**
 * Welche Marke wurde mit diesem Spiel ueberschritten? Ein Hattrick kann von 48
 * auf 51 springen, deshalb wird die Spanne geprueft und nicht der Gleichstand.
 * Zurueck kommt die niedrigste getroffene Marke - mehr als eine pro Spiel waere
 * ohnehin nur Rauschen in der Chronik.
 */
function crossed(marks: number[], before: number, after: number): number | null {
  for (const mark of marks) {
    if (before < mark && after >= mark) return mark;
  }
  return null;
}

interface MatchTotals {
  apps: number;
  goals: number;
  assists: number;
}

interface MilestoneContext {
  clubId?: Id;
  competitionId?: Id;
  /** Name des Vereins, fuer den die Marke faellt. */
  clubName?: string;
}

/**
 * Prueft nach einem Pflichtspiel alle laufenden Marken und traegt Treffer in
 * Chronik und Nachrichten ein. `before` sind die Werte ohne dieses Spiel.
 */
export function checkMatchMilestones(
  state: GameState,
  before: MatchTotals,
  after: MatchTotals,
  ctx: MilestoneContext = {},
  rng: Rng | null = null,
) {
  const user = state.players[state.userPlayerId];
  if (!user) return;
  const name = `${user.firstName} ${user.lastName}`;
  const last = user.lastName;
  // Der Zusatz bleibt leer, wenn kein Verein bekannt ist - so passt der Satz
  // in beiden Sprachen, ohne dass es zwei Textvarianten braucht.
  const club = ctx.clubName ? t('ms.inShirtOf', { club: ctx.clubName }) : '';
  const extra = { clubId: ctx.clubId, competitionId: ctx.competitionId };

  const marken: [number | null, string, keyof typeof GROSS, NewsCategory][] = [
    [crossed(APP_MARKS, before.apps, after.apps), 'ms.apps', 'apps', 'match'],
    [crossed(GOAL_MARKS, before.goals, after.goals), 'ms.goals', 'goals', 'match'],
    [crossed(ASSIST_MARKS, before.assists, after.assists), 'ms.assists', 'assists', 'match'],
  ];

  for (const [n, key, schwelle, kategorie] of marken) {
    if (n === null) continue;
    addCareerEvent(state, 'milestone',
      t(`${key}.title`, { n }), t(`${key}.body`, { n, club }), extra);
    addNews(state, kategorie,
      t(`${key}.news`, { n, last }), t(`${key}.newsBody`, { n, name }),
      n >= GROSS[schwelle]);
    // Eine Marke ist Reichweite. Ohne diesen Anschluss meldete der Feed jedes
    // beliebige Spiel, aber nicht das 50. Tor - und die Followerzahl wuchs an
    // der Laufbahn vorbei.
    if (rng) socialMilestone(state, t(`${key}.news`, { n, last }), rng);
  }
}

/** Dasselbe fuer Laenderspiele, die ausserhalb des Ligabetriebs anfallen. */
export function checkCapMilestones(
  state: GameState, before: number, after: number, rng: Rng | null = null,
) {
  const user = state.players[state.userPlayerId];
  if (!user) return;
  const n = crossed(CAP_MARKS, before, after);
  if (n === null) return;
  addCareerEvent(state, 'milestone', t('ms.caps.title', { n }), t('ms.caps.body', { n }));
  addNews(state, 'national',
    t('ms.caps.news', { n, last: user.lastName }),
    t('ms.caps.newsBody', { n, name: `${user.firstName} ${user.lastName}` }),
    n >= GROSS.caps);
  if (rng) socialMilestone(state, t('ms.caps.news', { n, last: user.lastName }), rng);
}

/**
 * Persoenliche Bestmarke einer Saison. Laeuft am Saisonende und meldet sich
 * nur, wenn eine fruehere Saison tatsaechlich uebertroffen wurde - die erste
 * Saison ist per se die beste und waere keine Nachricht wert.
 */
export function checkSeasonBest(state: GameState) {
  const user = state.players[state.userPlayerId];
  if (!user) return;

  const proSaison = new Map<number, number>();
  for (const s of Object.values(state.seasonStats)) {
    if (s.playerId !== user.id) continue;
    proSaison.set(s.season, (proSaison.get(s.season) ?? 0) + s.goals);
  }

  const jetzt = proSaison.get(state.season) ?? 0;
  if (jetzt < 5) return; // Unter fuenf Toren ist keine Bestmarke der Rede wert.

  let bisher = 0;
  for (const [saison, tore] of proSaison) {
    if (saison < state.season && tore > bisher) bisher = tore;
  }
  if (bisher === 0 || jetzt <= bisher) return;

  addCareerEvent(state, 'milestone',
    t('ms.best.title', { n: jetzt }),
    t('ms.best.body', { n: jetzt, diff: jetzt - bisher, old: bisher }));
  addNews(state, 'match',
    t('ms.best.news', { last: user.lastName }),
    t('ms.best.newsBody', { n: jetzt }), true);
}

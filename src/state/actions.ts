/** Aktionen, die den Spielstand veraendern. */
import { ensureAgent, startAgentTask } from '../engine/agent';
import { ageOn, makeDate } from '../engine/date';
import {
  advanceDay, createNewGame, createObjectives, userClub,
  type DayResult, type NewGameOptions,
} from '../engine/game';
import { applyLifeChoice, type LifeEvent } from '../engine/events';
import { addCareerEvent, addNews } from '../engine/ids';
import { calcMarketValue } from '../engine/playerGen';
import { Rng } from '../engine/rng';
import { seedRelationships } from '../engine/relationships';
import { acceptLoan } from '../engine/loan';
import { retireUser } from '../engine/retirement';
import { publishDraft } from '../engine/social';
import { getLastSaveId, listSaves, loadGame, rememberLastSave, saveGame } from '../engine/save';
import type { SeasonReport } from '../engine/season';
import { computeOverall } from '../engine/attributes';
import type { AgentTaskKind, TrainingFocus, TrainingIntensity } from '../engine/types';
import { commit, getState, setState, showToast } from './store';

export async function startNewCareer(opts: NewGameOptions) {
  setState({ busy: 'Fussballwelt wird erzeugt...' });
  // Kurze Pause, damit die Oberflaeche den Ladehinweis zeichnen kann.
  await new Promise((r) => setTimeout(r, 30));
  const game = createNewGame(opts);
  await saveGame(game);
  rememberLastSave(game.saveId);
  setState({ game, screen: 'career', tab: 'overview', busy: null, version: 0 });
}

export async function loadCareer(saveId: string) {
  setState({ busy: 'Spielstand wird geladen...' });
  const game = await loadGame(saveId);
  if (!game) {
    setState({ busy: null });
    showToast('Spielstand konnte nicht geladen werden.', 'bad');
    return;
  }
  rememberLastSave(saveId);
  setState({ game, screen: 'career', tab: 'overview', busy: null });
}

export async function continueLastCareer(): Promise<boolean> {
  const last = getLastSaveId();
  const saves = await listSaves();
  const target = saves.find((s) => s.saveId === last) ?? saves[0];
  if (!target) return false;
  await loadCareer(target.saveId);
  return true;
}

export async function saveCurrent(silent = false) {
  const game = getState().game;
  if (!game) return;
  await saveGame(game);
  rememberLastSave(game.saveId);
  if (!silent) showToast('Spielstand gespeichert.', 'good');
}

export function backToMenu() {
  setState({ screen: 'menu', game: null });
}

// --- Kalender ----------------------------------------------------------

export interface AdvanceSummary {
  days: number;
  matchToPlay: string | null;
  seasonReport: SeasonReport | null;
  training: DayResult['training'];
  lifeEvent: DayResult['lifeEvent'];
  wnc: DayResult['wnc'];
}

/**
 * Spult den Kalender vor, bis ein Spiel des eigenen Vereins ansteht
 * oder das Tageslimit erreicht ist.
 */
export function advanceCalendar(maxDays = 60): AdvanceSummary {
  const game = getState().game;
  if (!game) return { days: 0, matchToPlay: null, seasonReport: null, training: null, lifeEvent: null, wnc: null };

  let days = 0;
  let seasonReport: SeasonReport | null = null;
  let training: DayResult['training'] = null;
  let wnc: DayResult['wnc'] = null;

  for (let i = 0; i < maxDays; i++) {
    const result = advanceDay(game);
    if (result.seasonReport) seasonReport = result.seasonReport;
    if (result.training) training = result.training;
    if (result.wnc) wnc = result.wnc;
    if (result.matchToPlay) {
      commit();
      return { days, matchToPlay: result.matchToPlay, seasonReport, training, lifeEvent: null, wnc };
    }
    days++;
    if (result.lifeEvent) {
      commit();
      void saveCurrent(true);
      return { days, matchToPlay: null, seasonReport, training, lifeEvent: result.lifeEvent, wnc };
    }
    if (result.training || result.seasonReport) break;
  }

  commit();
  void saveCurrent(true);
  return { days, matchToPlay: null, seasonReport, training, lifeEvent: null, wnc };
}

/** Einen einzelnen Tag weiterschalten. */
export function advanceOneDay(): AdvanceSummary {
  return advanceCalendar(1);
}

export function applyLifeEvent(event: LifeEvent, optionId: string) {
  const game = getState().game;
  if (!game) return null;
  const option = applyLifeChoice(game, event, optionId);
  commit();
  void saveCurrent(true);
  return option;
}

// --- Training ----------------------------------------------------------

export function setTraining(focus: TrainingFocus, intensity: TrainingIntensity) {
  const game = getState().game;
  if (!game) return;
  game.training.focus = focus;
  game.training.intensity = intensity;
  commit();
}

export function setIndividualGoal(goal: TrainingFocus | null) {
  const game = getState().game;
  if (!game) return;
  game.training.individualGoal = goal;
  commit();
}

// --- Transfers ---------------------------------------------------------

export function acceptOffer(offerId: string) {
  const game = getState().game;
  if (!game) return;
  const offer = game.offers.find((o) => o.id === offerId);
  const user = game.players[game.userPlayerId];
  const club = offer ? game.clubs[offer.clubId] : null;
  if (!offer || !user || !club) return;

  // Leihe: Der Stammverein bleibt bestehen, die Rueckkehr ist vereinbart.
  if (offer.loan) {
    if (acceptLoan(game, offer)) {
      const relRng = new Rng(game.rngState);
      seedRelationships(game, relRng);
      game.rngState = relRng.state;
      createObjectives(game);
      commit();
      void saveCurrent(true);
      showToast(`Leihe zu ${club.name} vereinbart.`, 'good');
    }
    return;
  }

  // Verlaengerung beim eigenen Verein: nur der Vertrag wird neu, das Umfeld
  // (Beziehungen, Trainer, Fans) bleibt bestehen.
  if (offer.renewal || offer.clubId === user.clubId) {
    user.contract = {
      clubId: club.id,
      salary: offer.salary,
      until: makeDate(game.season + offer.years, 6, 30),
      role: offer.role,
      goalBonus: offer.goalBonus,
      appearanceBonus: Math.round(offer.salary * 0.1),
      releaseClause: offer.releaseClause,
    };
    game.offers = [];
    addCareerEvent(game, 'contract', `Vertrag bei ${club.name} verlaengert`,
      `Neuer Vertrag bis ${game.season + offer.years}. Rolle: ${offer.role}, `
      + `Gehalt ${offer.salary.toLocaleString('de-DE')} Euro pro Woche.`,
      { clubId: club.id });
    addNews(game, 'contract', `${user.lastName} verlaengert bei ${club.name}`,
      `Die Zukunft ist geklaert: neuer Vertrag bis ${game.season + offer.years}.`, true);
    commit();
    void saveCurrent(true);
    showToast(`Vertrag bei ${club.name} verlaengert.`, 'good');
    return;
  }

  const oldClub = userClub(game);
  user.clubId = club.id;
  user.contract = {
    clubId: club.id,
    salary: offer.salary,
    until: makeDate(game.season + offer.years, 6, 30),
    role: offer.role,
    goalBonus: offer.goalBonus,
    appearanceBonus: Math.round(offer.salary * 0.1),
    releaseClause: offer.releaseClause,
  };
  const ability = computeOverall(user.attrs, user.position);
  user.marketValue = calcMarketValue(
    ability, user.potential, ageOn(user.birthDate, game.date), user.position, offer.leagueLevel);
  user.reputation = Math.min(99, user.reputation + (offer.leagueLevel === 1 ? 6 : 3));

  game.coachRelation = 55;
  game.fanRelation = 50;
  game.offers = [];

  // Neuer Verein, neues Umfeld: Beziehungen von vorn.
  const relRng = new Rng(game.rngState);
  seedRelationships(game, relRng);
  game.rngState = relRng.state;

  addCareerEvent(game, 'transfer', `Wechsel zu ${club.name}`,
    `Von ${oldClub?.name ?? 'vereinslos'} zu ${club.name} gewechselt. `
    + `Rolle: ${offer.role}, Gehalt ${offer.salary.toLocaleString('de-DE')} Euro pro Woche.`,
    { clubId: club.id });
  addNews(game, 'transfer', `${user.lastName} wechselt zu ${club.name}`,
    `Der Transfer ist perfekt. Ablöse etwa ${(offer.fee / 1_000_000).toFixed(1)} Millionen Euro.`, true);

  createObjectives(game);
  commit();
  void saveCurrent(true);
  showToast(`Wechsel zu ${club.name} abgeschlossen.`, 'good');
}

/** Veroeffentlicht einen eigenen Beitrag (Konzept Abschnitt 40). */
export function postSocial(optionId: string) {
  const game = getState().game;
  if (!game) return;
  const rng = new Rng(game.rngState);
  const option = publishDraft(game, optionId, rng);
  game.rngState = rng.state;
  commit();
  void saveCurrent(true);
  if (option?.text) showToast('Beitrag veroeffentlicht.', 'good');
  else showToast('Du haeltst dich zurueck.', 'info');
}

/** Beauftragt den Berater (Konzept Abschnitt 35). */
export function requestAgentTask(kind: AgentTaskKind) {
  const game = getState().game;
  if (!game) return;
  const rng = new Rng(game.rngState);
  ensureAgent(game, rng);
  game.rngState = rng.state;
  if (!startAgentTask(game, kind)) {
    showToast('Dein Berater kann das gerade nicht uebernehmen.', 'bad');
    return;
  }
  commit();
  void saveCurrent(true);
  showToast('Auftrag erteilt. Dein Berater meldet sich.', 'info');
}

/** Freiwilliger Ruecktritt vom aktiven Sport (Konzept Abschnitt 2). */
export function retireCareer() {
  const game = getState().game;
  if (!game || game.retirement) return;
  const user = game.players[game.userPlayerId];
  const summary = retireUser(game, 'choice');
  addCareerEvent(game, 'title', 'Ende der Laufbahn',
    `${summary.appearances} Pflichtspiele, ${summary.goals} Tore, ${summary.honours} Titel. `
    + `Abschluss als ${summary.status}.`, {});
  addNews(game, 'season', `${user?.lastName ?? 'Der Spieler'} beendet die Karriere`,
    `Nach ${summary.appearances} Pflichtspielen ist Schluss. Bilanz: ${summary.goals} Tore, `
    + `${summary.assists} Vorlagen, ${summary.honours} Titel.`, true);
  commit();
  void saveCurrent(true);
  showToast(`Laufbahn beendet - ${summary.status}.`, 'good');
}

export function declineAllOffers() {
  const game = getState().game;
  if (!game) return;
  const user = game.players[game.userPlayerId];
  game.offers = [];
  if (user) {
    addNews(game, 'transfer', `${user.lastName} bleibt`,
      'Alle vorliegenden Angebote wurden abgelehnt. Der Fokus liegt auf dem aktuellen Verein.', false);
  }
  game.coachRelation = Math.min(100, game.coachRelation + 4);
  commit();
  showToast('Angebote abgelehnt.', 'info');
}

/** Vertragsverlaengerung beim aktuellen Verein. */
export function renewContract(years: number) {
  const game = getState().game;
  if (!game) return;
  const user = game.players[game.userPlayerId];
  const club = userClub(game);
  if (!user || !club || !user.contract) return;

  const rng = new Rng(game.rngState);
  const ability = computeOverall(user.attrs, user.position);
  const raise = 1 + Math.max(0, (ability - 45) / 100) + rng.float(0, 0.25);
  user.contract.salary = Math.round(user.contract.salary * raise / 50) * 50;
  user.contract.until = makeDate(game.season + years, 6, 30);
  game.rngState = rng.state;

  addCareerEvent(game, 'contract', 'Vertrag verlaengert',
    `Neuer Vertrag bei ${club.name} bis ${game.season + years}.`, { clubId: club.id });
  commit();
  void saveCurrent(true);
  showToast('Vertrag verlaengert.', 'good');
}

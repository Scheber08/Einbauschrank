/** Aktionen, die den Spielstand veraendern. */
import { ensureAgent, startAgentTask } from '../engine/agent';
import {
  addDays, ageOn, isBefore, makeDate, type GameDate,
} from '../engine/date';
import {
  advanceDay, createNewGame, createObjectives, simulateUserMatch, userClub,
  type DayResult, type NewGameOptions,
} from '../engine/game';
import { applyLifeChoice, type LifeEvent } from '../engine/events';
import { addCareerEvent, addNews } from '../engine/ids';
import { calcMarketValue } from '../engine/playerGen';
import { bookSigning } from '../engine/finance';
import { dropCaptaincyOnTransfer } from '../engine/captain';
import { t, tDecimal, tNumber } from '../i18n';
import { Rng } from '../engine/rng';
import { seedRelationships } from '../engine/relationships';
import { acceptLoan } from '../engine/loan';
import { retireUser } from '../engine/retirement';
import { publishDraft } from '../engine/social';
import { getLastSaveId, listSaves, loadGame, rememberLastSave, saveGame } from '../engine/save';
import type { SeasonReport } from '../engine/season';
import {
  MAX_EXTRA_SESSIONS,
  type Lifestyle, type SetPieceClaim, type TransferWish,
} from '../engine/choices';
import { computeOverall } from '../engine/attributes';
import type { AgentTaskKind, TrainingFocus, TrainingIntensity } from '../engine/types';
import {
  commit, getState, setState, showToast, type SkipSummary,
} from './store';

export async function startNewCareer(opts: NewGameOptions) {
  setState({ busy: t('act.creatingWorld') });
  // Kurze Pause, damit die Oberflaeche den Ladehinweis zeichnen kann.
  await new Promise((r) => setTimeout(r, 30));
  const game = createNewGame(opts);
  await saveGame(game);
  rememberLastSave(game.saveId);
  setState({ game, screen: 'career', tab: 'overview', busy: null, version: 0 });
}

export async function loadCareer(saveId: string) {
  setState({ busy: t('act.loading') });
  const game = await loadGame(saveId);
  if (!game) {
    setState({ busy: null });
    showToast(t('act.loadFailed'), 'bad');
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
  if (!silent) showToast(t('act.saved'), 'good');
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
/** Wie viele Tage ein Sprung hoechstens umfasst - eine ganze Saison plus Rand. */
const MAX_SPRUNG = 400;

/**
 * Spult bis zu einem Datum vor.
 *
 * Der bisherige Kalender kannte nur "weiter, bis irgendetwas passiert". Wer
 * drei Wochen ueberspringen wollte, musste dreissig Mal klicken. Hier wird
 * ein Ziel gesetzt und der Rest laeuft durch.
 *
 * Angehalten wird nur bei Dingen, die eine Entscheidung verlangen: eigene
 * Spiele (wenn man sie selbst spielen will), Ereignisse abseits des Platzes,
 * Saisonwechsel, Karriereende. Trainingsberichte und Meldungen halten den
 * Sprung nicht an - sie wirken trotzdem und stehen hinterher im
 * Sammelbericht. Sonst waere das Vorspulen kein Vorspulen.
 */
export function advanceUntil(
  ziel: GameDate,
  opts: {
    eigeneSimulieren?: boolean;
    /**
     * Ereignisse abseits des Platzes ueberspringen statt anzuhalten.
     *
     * Nur fuer den Sprung ueber eine ganze Saison gedacht. Wer eine Saison
     * am Stueck ueberspringt, will nicht zwoelfmal nach einer Entscheidung
     * gefragt werden - er verzichtet bewusst darauf. Denselben Weg geht
     * "Direkt zum Anpfiff" schon lange.
     */
    ereignisseUeberspringen?: boolean;
  } = {},
): SkipSummary {
  const game = getState().game;
  const leer: SkipSummary = {
    days: 0, von: ziel, bis: ziel, eigeneSpiele: [], trainingsPlus: 0,
    meldungen: 0, grund: 'ziel', matchToPlay: null, lifeEvent: null,
    seasonReport: null, wnc: null,
    staerkeVorher: 0, staerkeNachher: 0, potenzialVorher: 0, potenzialNachher: 0,
    tore: 0, vorlagen: 0, schnittnote: 0,
  };
  if (!game) return leer;

  const spieler = game.players[game.userPlayerId];
  const von = game.date;
  const meldungenVorher = game.news.length;
  const bericht: SkipSummary = {
    ...leer, von, bis: von, eigeneSpiele: [],
    staerkeVorher: spieler ? computeOverall(spieler.attrs, spieler.position) : 0,
    potenzialVorher: spieler?.potential ?? 0,
  };

  for (let i = 0; i < MAX_SPRUNG; i++) {
    if (!isBefore(game.date, ziel)) { bericht.grund = 'ziel'; break; }
    if (game.retirement) { bericht.grund = 'ende'; break; }

    const tag = advanceDay(game);

    if (tag.matchToPlay) {
      if (!opts.eigeneSimulieren) {
        bericht.matchToPlay = tag.matchToPlay;
        bericht.grund = 'spiel';
        break;
      }
      const partie = game.matches[tag.matchToPlay];
      const eigenerVerein = game.players[game.userPlayerId]?.clubId;
      const daheim = partie?.homeClubId === eigenerVerein;
      const gegnerId = daheim ? partie?.awayClubId : partie?.homeClubId;
      const datum = partie?.date ?? game.date;
      const ergebnis = simulateUserMatch(game, tag.matchToPlay);
      if (ergebnis) {
        const eigene = game.matches[tag.matchToPlay]?.userStats ?? null;
        bericht.eigeneSpiele.push({
          matchId: tag.matchToPlay,
          datum,
          gegner: (gegnerId ? game.clubs[gegnerId]?.name : '') ?? '',
          daheim,
          tore: daheim ? ergebnis.homeScore : ergebnis.awayScore,
          gegentore: daheim ? ergebnis.awayScore : ergebnis.homeScore,
          note: eigene?.rating ?? null,
          eigeneTore: eigene?.goals ?? 0,
          vorlagen: eigene?.assists ?? 0,
        });
      } else {
        // Laesst sich nicht simulieren - dann eben anhalten, statt in einer
        // Schleife auf demselben Tag zu bleiben.
        bericht.matchToPlay = tag.matchToPlay;
        bericht.grund = 'spiel';
        break;
      }
      continue;
    }

    bericht.days++;
    bericht.bis = game.date;
    if (tag.wnc) bericht.wnc = tag.wnc;
    if (tag.training) {
      // `gains` ist eine Liste von Eintraegen, kein Zahlenverzeichnis - ein
      // Object.values darueber haette still nur Nullen summiert und der
      // Sammelbericht haette dauerhaft "kein Fortschritt" gemeldet.
      for (const zuwachs of tag.training.gains) {
        bericht.trainingsPlus += zuwachs.amount;
      }
    }
    if (tag.lifeEvent && !opts.ereignisseUeberspringen) {
      bericht.lifeEvent = tag.lifeEvent;
      bericht.grund = 'ereignis';
      break;
    }
    if (tag.seasonReport) {
      bericht.seasonReport = tag.seasonReport;
      bericht.grund = 'saison';
      break;
    }
  }

  bericht.bis = game.date;
  bericht.meldungen = Math.max(0, game.news.length - meldungenVorher);

  const danach = game.players[game.userPlayerId];
  bericht.staerkeNachher = danach
    ? computeOverall(danach.attrs, danach.position) : bericht.staerkeVorher;
  bericht.potenzialNachher = danach?.potential ?? bericht.potenzialVorher;
  bericht.tore = bericht.eigeneSpiele.reduce((a, p) => a + p.eigeneTore, 0);
  bericht.vorlagen = bericht.eigeneSpiele.reduce((a, p) => a + p.vorlagen, 0);
  const benotet = bericht.eigeneSpiele.filter((p) => p.note !== null);
  bericht.schnittnote = benotet.length > 0
    ? benotet.reduce((a, p) => a + (p.note ?? 0), 0) / benotet.length : 0;
  if (bericht.grund === 'ziel' && isBefore(game.date, ziel)) bericht.grund = 'grenze';

  commit();
  void saveCurrent(true);
  // In den Zustand, damit die Schale ihn anzeigen kann - auch dann, wenn
  // der Sprung an einem Ereignis endet und der Reiter wechselt.
  setState({ skipReport: bericht });
  return bericht;
}

/**
 * Spielt die laufende Saison in einem Zug zu Ende.
 *
 * Der Kalender konnte bis zu einem Datum vorspulen, hielt dabei aber an
 * jedem eigenen Spiel und jeder Entscheidung an. Fuer eine ganze Saison
 * waren das drei Dutzend Unterbrechungen - der Sprung war moeglich, aber
 * niemand hat ihn gemacht.
 *
 * Hier wird durchgezogen: eigene Spiele werden simuliert, Entscheidungen
 * abseits des Platzes ausgelassen. Angehalten wird nur am Saisonende, am
 * Karriereende und an der Sicherheitsgrenze. Was dabei passiert ist,
 * steht hinterher im Bericht - sonst waere eine ganze Saison ein
 * schwarzes Loch.
 */
export function advanceSeason(): SkipSummary {
  const game = getState().game;
  // Ohne Spielstand gibt es nichts zu ueberspringen - `advanceUntil`
  // liefert dafuer einen leeren Bericht zurueck.
  if (!game) return advanceUntil('2000-01-01');
  // Weit genug fuer jede Saison; die Schleife bricht am Saisonbericht ab.
  return advanceUntil(addDays(game.date, MAX_SPRUNG - 1), {
    eigeneSimulieren: true,
    ereignisseUeberspringen: true,
  });
}

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

/**
 * Spult ohne Zwischenstopps bis zum naechsten eigenen Spiel vor.
 *
 * Unterschied zu `advanceCalendar`: Trainingsberichte halten den Kalender
 * nicht an - das Training wirkt weiterhin, nur die Aufstellung der
 * verbesserten Werte entfaellt. Ereignisse abseits des Platzes werden dabei
 * ausgelassen; wer direkt zum Anpfiff will, verzichtet auf diese
 * Entscheidungen. Beim Saisonwechsel wird trotzdem angehalten, sonst liefe
 * der Saisonbericht mit allen Auszeichnungen unbemerkt vorbei.
 */
export function advanceToMatch(maxDays = 400): AdvanceSummary {
  const game = getState().game;
  if (!game) {
    return { days: 0, matchToPlay: null, seasonReport: null, training: null, lifeEvent: null, wnc: null };
  }

  let days = 0;
  let seasonReport: SeasonReport | null = null;
  let wnc: DayResult['wnc'] = null;

  for (let i = 0; i < maxDays; i++) {
    const result = advanceDay(game);
    // Das Training wirkt in advanceDay, sein Bericht wird hier bewusst verworfen.
    if (result.wnc) wnc = result.wnc;
    if (result.matchToPlay) {
      commit();
      return { days, matchToPlay: result.matchToPlay, seasonReport, training: null, lifeEvent: null, wnc };
    }
    days++;
    // Saisonende ist zu wichtig, um daran vorbeizuspulen.
    if (result.seasonReport) {
      seasonReport = result.seasonReport;
      break;
    }
  }

  commit();
  void saveCurrent(true);
  return { days, matchToPlay: null, seasonReport, training: null, lifeEvent: null, wnc };
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

/**
 * Die Lebensweise abseits des Platzes.
 *
 * Bis hierher gab es genau drei Stellschrauben - Trainingsschwerpunkt,
 * individuelles Ziel und Berateraufträge. Alles andere passierte mit einem.
 */
export function setLifestyle(lifestyle: Lifestyle) {
  const game = getState().game;
  if (!game) return;
  game.lifestyle = lifestyle;
  commit();
  void saveCurrent(true);
}

/** Zusatzeinheiten je Woche. Mehr Entwicklung, mehr Muedigkeit, mehr Risiko. */
export function setExtraSessions(sessions: number) {
  const game = getState().game;
  if (!game) return;
  game.extraSessions = Math.max(0, Math.min(MAX_EXTRA_SESSIONS, Math.round(sessions)));
  commit();
  void saveCurrent(true);
}

/** Welche Standards der Spieler fuer sich beansprucht. */
export function setSetPieceClaim(claim: SetPieceClaim) {
  const game = getState().game;
  if (!game) return;
  game.setPieceClaim = claim;
  commit();
  void saveCurrent(true);
}

/**
 * Der Wechselwunsch mit Zielvorgabe.
 *
 * Der Berater konnte schon immer einen Verein suchen - er wusste nur nicht,
 * wonach. Wer in die erste Liga will, wollte das schon immer und konnte es
 * niemandem sagen.
 */
export function setTransferWish(wish: TransferWish | null) {
  const game = getState().game;
  if (!game) return;
  game.transferWish = wish ?? undefined;
  commit();
  void saveCurrent(true);
}

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
      showToast(t('act.loanAgreed', { club: club.name }), 'good');
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
    addCareerEvent(game, 'contract', t('act.renewed.title', { club: club.name }),
      t('act.renewed.body', {
        until: game.season + offer.years,
        role: t(`role.${offer.role}`),
        salary: tNumber(offer.salary),
      }),
      { clubId: club.id });
    addNews(game, 'contract',
      t('act.renewed.headline', { player: user.lastName, club: club.name }),
      t('act.renewed.news', { until: game.season + offer.years }), true);
    commit();
    void saveCurrent(true);
    showToast(t('act.renewed.toast', { club: club.name }), 'good');
    return;
  }

  const oldClub = userClub(game);
  // Die Binde bleibt beim alten Verein - sonst haette die neue Mannschaft
  // am ersten Tag zwei Spielfuehrer.
  dropCaptaincyOnTransfer(user);
  // Der Wechsel kostet den neuen Verein Geld und bringt es dem alten. Ohne
  // diese Buchung waere das Budget nur eine Schranke fuer die KI, waehrend der
  // eigene Transfer die Wirtschaft unberuehrt liesse - und ein Verein koennte
  // den Spieler beliebig oft fuer dieselben Mittel holen.
  bookSigning(club, oldClub, offer.fee, null, offer.salary,
    user.contract ? user.contract.salary : 0);
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

  addCareerEvent(game, 'transfer', t('act.transfer.title', { club: club.name }),
    t('act.transfer.body', {
      from: oldClub?.name ?? t('act.noClub'),
      to: club.name,
      role: t(`role.${offer.role}`),
      salary: tNumber(offer.salary),
    }),
    { clubId: club.id });
  addNews(game, 'transfer', `${user.lastName} wechselt zu ${club.name}`,
    t('act.transfer.newsBody', { fee: tDecimal(offer.fee / 1_000_000) }), true);

  createObjectives(game);
  commit();
  void saveCurrent(true);
  showToast(t('act.transfer.toast', { club: club.name }), 'good');
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
  if (option?.text) showToast(t('act.posted'), 'good');
  else showToast(t('act.stayedQuiet'), 'info');
}

/** Beauftragt den Berater (Konzept Abschnitt 35). */
export function requestAgentTask(kind: AgentTaskKind) {
  const game = getState().game;
  if (!game) return;
  const rng = new Rng(game.rngState);
  ensureAgent(game, rng);
  game.rngState = rng.state;
  if (!startAgentTask(game, kind)) {
    showToast(t('act.agentBusy'), 'bad');
    return;
  }
  commit();
  void saveCurrent(true);
  showToast(t('act.agentBriefed'), 'info');
}

/** Freiwilliger Ruecktritt vom aktiven Sport (Konzept Abschnitt 2). */
export function retireCareer() {
  const game = getState().game;
  if (!game || game.retirement) return;
  const user = game.players[game.userPlayerId];
  const summary = retireUser(game, 'choice');
  addCareerEvent(game, 'title', t('act.retire.title'),
    t('act.retire.body', {
      apps: summary.appearances, goals: summary.goals,
      honours: summary.honours, status: summary.status,
    }), {});
  addNews(game, 'season',
    t('act.retire.news', { last: user?.lastName ?? t('act.thePlayer') }),
    t('act.retire.newsBody', {
      apps: summary.appearances, goals: summary.goals,
      assists: summary.assists, honours: summary.honours,
    }), true);
  commit();
  void saveCurrent(true);
  showToast(t('act.retire.toast', { status: summary.status }), 'good');
}

export function declineAllOffers() {
  const game = getState().game;
  if (!game) return;
  const user = game.players[game.userPlayerId];
  game.offers = [];
  if (user) {
    addNews(game, 'transfer', t('act.declined.title', { last: user.lastName }),
      t('act.declined.body'), false);
  }
  game.coachRelation = Math.min(100, game.coachRelation + 4);
  commit();
  showToast(t('act.declined.toast'), 'info');
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

  addCareerEvent(game, 'contract', t('act.extend.title'),
    t('act.extend.body', { club: club.name, until: game.season + years }),
    { clubId: club.id });
  commit();
  void saveCurrent(true);
  showToast(t('act.extend.toast'), 'good');
}

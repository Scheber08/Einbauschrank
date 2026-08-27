/**
 * Leihgeschaefte (Konzept Abschnitt 34).
 *
 * Wer beim eigenen Verein kaum spielt, sammelt anderswo Spielpraxis. Eine
 * Leihe laeuft bis zum Saisonende; danach kehrt der Spieler zu seinem
 * Stammverein zurueck - mit dem Vertrag, den er dort hatte.
 */
import { COUNTRY_BY_ID } from './countries';
import { buildWageIndex, canSign } from './finance';
import { dropCaptaincyOnTransfer } from './captain';
import { computeOverall } from './attributes';
import { ageOn, makeDate } from './date';
import { addCareerEvent, addNews } from './ids';
import { calcSalary } from './playerGen';
import { Rng, clamp } from './rng';
import type { GameState, TransferOffer } from './types';
import { t, tDecimal } from '../i18n';

/** Wie viele Einsaetze als "zu wenig" gelten, um eine Leihe zu rechtfertigen. */
const FEW_APPEARANCES = 9;

/**
 * Leihangebote entstehen fuer junge Spieler, die zu selten zum Zug kommen.
 * Sie kommen von Vereinen aus tieferen Spielklassen, die Einsatzzeit bieten.
 */
export function generateLoanOffers(state: GameState, rng: Rng) {
  const user = state.players[state.userPlayerId];
  if (!user?.clubId || state.loan || state.retirement) return;
  const age = ageOn(user.birthDate, state.date);
  if (age > 24) return;

  const entries = Object.values(state.seasonStats).filter(
    (s) => s.playerId === user.id && s.season === state.season,
  );
  const apps = entries.reduce((a, s) => a + s.appearances, 0);
  if (apps > FEW_APPEARANCES) return;

  const home = state.clubs[user.clubId];
  const homeLevel = home ? state.competitions[home.leagueId]?.level ?? 3 : 3;
  const ability = computeOverall(user.attrs, user.position);

  // Vereine eine Klasse tiefer (oder in derselben, falls schon unterste Liga),
  // die einen Spieler dieses Kalibers gebrauchen koennen.
  // Auch eine Leihe kostet den aufnehmenden Verein Gehalt. Eine Abloese faellt
  // nicht an, deshalb wird nur der Gehaltsrahmen geprueft - mit etwas mehr
  // Toleranz als bei einem Kauf, weil eine Leihe fuer eine Saison gilt und
  // typischerweise nur ein Teil des Gehalts uebernommen wird.
  const gehaelter = buildWageIndex(state);
  const targets = Object.values(state.clubs).filter((c) => {
    if (c.id === user.clubId) return false;
    const level = state.competitions[c.leagueId]?.level ?? 3;
    if (level < homeLevel) return false;
    if (level > homeLevel + 1) return false;
    if (!(c.reputation <= ability * 1.15 + 12 && c.reputation >= ability * 0.45)) return false;
    const country = COUNTRY_BY_ID[c.countryId];
    const gehalt = Math.round(
      calcSalary(ability, age, level, c.reputation, country?.wealth ?? 1) * 0.85);
    return canSign(c, gehaelter.get(c.id) ?? 0, 0, gehalt, 1.3);
  });
  if (targets.length === 0) return;

  const count = Math.min(rng.int(1, 2), targets.length);
  for (const club of rng.sample(targets, count)) {
    const level = state.competitions[club.leagueId]?.level ?? 3;
    const country = COUNTRY_BY_ID[club.countryId];
    // Bei einer Leihe zahlt der aufnehmende Verein einen Teil des Gehalts.
    const salary = Math.round(
      calcSalary(ability, age, level, club.reputation, country?.wealth ?? 1) * rng.float(0.7, 1.0),
    );
    state.offers.push({
      id: `o-loan-${state.nextId++}`,
      clubId: club.id,
      fee: 0,
      salary,
      years: 1,
      role: 'Stammspieler',
      goalBonus: Math.round(salary * 0.2),
      pitch: t('loan.pitch', { club: club.name }),
      expiresOn: makeDate(state.season + 1, 8, 20),
      leagueLevel: level,
      loan: true,
    } satisfies TransferOffer);
  }

  addNews(state, 'transfer', t('loan.offers.title'), t('loan.offers.body'), true);
}

/** Wechselt den Spieler leihweise zum aufnehmenden Verein. */
export function acceptLoan(state: GameState, offer: TransferOffer): boolean {
  const user = state.players[state.userPlayerId];
  const club = state.clubs[offer.clubId];
  if (!user?.contract || !user.clubId || !club) return false;

  state.loan = {
    parentClubId: user.clubId,
    parentSalary: user.contract.salary,
    parentRole: user.contract.role,
    parentUntil: user.contract.until,
    // Leihen enden zum Saisonende - Rueckkehr im Sommer.
    until: makeDate(state.season + 1, 6, 30),
  };

  const parentName = state.clubs[user.clubId]?.name ?? t('loan.yourClub');
  // Auch eine Leihe nimmt die Binde: Beim aufnehmenden Verein ist man Gast.
  dropCaptaincyOnTransfer(user);
  user.clubId = club.id;
  user.contract = {
    clubId: club.id,
    salary: offer.salary,
    until: state.loan.until,
    role: offer.role,
    goalBonus: offer.goalBonus,
    appearanceBonus: Math.round(offer.salary * 0.1),
  };
  state.offers = [];
  state.coachRelation = 55;
  state.fanRelation = 50;

  addNews(state, 'transfer', t('loan.start.title', { club: club.name }),
    t('loan.start.news', { club: club.name, parent: parentName }), true);
  addCareerEvent(state, 'transfer', t('loan.start.title', { club: club.name }),
    t('loan.start.body', { parent: parentName }), { clubId: club.id });
  return true;
}

/**
 * Beendet eine abgelaufene Leihe. Der Spieler kehrt mit seinem alten Vertrag
 * zum Stammverein zurueck - wer ueberzeugt hat, bekommt dort mehr Vertrauen.
 */
export function checkLoanReturn(state: GameState, rng: Rng): boolean {
  const loan = state.loan;
  if (!loan || state.date < loan.until) return false;
  const user = state.players[state.userPlayerId];
  const parent = state.clubs[loan.parentClubId];
  if (!user || !parent) { state.loan = undefined; return false; }

  // Leistung waehrend der Leihe bewerten.
  const entries = Object.values(state.seasonStats).filter(
    (s) => s.playerId === user.id && s.season === state.season,
  );
  const apps = entries.reduce((a, s) => a + s.appearances, 0);
  const ratingSum = entries.reduce((a, s) => a + s.ratingSum, 0);
  const avg = apps > 0 ? ratingSum / apps : 0;
  const ueberzeugt = apps >= 15 && avg >= 6.5;

  user.clubId = parent.id;
  user.contract = {
    clubId: parent.id,
    salary: loan.parentSalary,
    until: loan.parentUntil,
    role: loan.parentRole,
    goalBonus: Math.round(loan.parentSalary * 0.2),
    appearanceBonus: Math.round(loan.parentSalary * 0.1),
  };
  state.loan = undefined;
  // Beim Stammverein beginnt das Verhaeltnis nicht bei null, aber neu.
  state.coachRelation = clamp(55 + (ueberzeugt ? 12 : -5) + rng.float(-3, 3), 0, 100);
  state.fanRelation = 50;

  addNews(state, 'transfer', t('loan.back.title', { club: parent.name }),
    ueberzeugt
      ? t('loan.back.convincedFull', { apps, avg: tDecimal(avg) })
      : t('loan.back.plain'), true);
  addCareerEvent(state, 'transfer', t('loan.back.title', { club: parent.name }),
    t('loan.back.body', { apps }), { clubId: parent.id });
  return true;
}

/**
 * Vertragsablauf beim eigenen Spieler.
 *
 * Vorher war ein Vertragsende folgenlos: `offerUserRenewal` legte ein Angebot
 * vor, aber wer es ignorierte, spielte unbegrenzt zum Anfangsgehalt weiter. In
 * einer gemessenen Karriere stand im Jahr 2031 noch ein Vertrag "bis 2029",
 * das Wochengehalt seit dem 17. Lebensjahr unveraendert bei 850 Euro - und das,
 * obwohl gleichzeitig ein Angebot ueber 19.361 Euro auf dem Tisch lag. Damit
 * war die wichtigste Entscheidung einer Laufbahn ohne jedes Gewicht.
 *
 * Jetzt endet der Vertrag wirklich. Der Spieler wechselt abloesefrei dorthin,
 * wo man ihn haben will - zu schlechteren Bedingungen, als er selbst haette
 * aushandeln koennen. Wer sich kuemmert, faehrt besser; wer nichts tut,
 * verliert die Kontrolle, aber nicht die Laufbahn. Findet sich gar kein Verein,
 * greift die vorhandene Pruefung auf ein erzwungenes Karriereende.
 */
import { t, tNumber } from '../i18n';
import { computeOverall } from './attributes';
import { COUNTRY_BY_ID } from './countries';
import { buildWageIndex, canSign } from './finance';
import { dropCaptaincyOnTransfer } from './captain';
import { ageOn, makeDate, month } from './date';
import { addCareerEvent, addNews } from './ids';
import { calcSalary } from './playerGen';
import { Rng, clamp } from './rng';
import type { Club, GameState } from './types';

/** Endjahr des laufenden Vertrags, oder null wenn kein Vertrag besteht. */
export function contractEndYear(state: GameState): number | null {
  const user = state.players[state.userPlayerId];
  if (!user?.contract) return null;
  return Number(user.contract.until.slice(0, 4));
}

/**
 * Laeuft der Vertrag am Ende der laufenden Saison aus? Genau dann liegt auch
 * das Verlaengerungsangebot des Vereins vor.
 */
export function isFinalContractSeason(state: GameState): boolean {
  const end = contractEndYear(state);
  return end !== null && end <= state.season + 1;
}

/**
 * Erinnert waehrend der letzten Vertragssaison daran, dass eine Entscheidung
 * ansteht. Ohne diese Hinweise faellt das Vertragsende zwischen den
 * Spielberichten schlicht nicht auf.
 */
export function remindContractExpiry(state: GameState) {
  const user = state.players[state.userPlayerId];
  const club = user?.clubId ? state.clubs[user.clubId] : null;
  if (!user?.contract || !club) return;
  const end = contractEndYear(state);
  if (end === null || end > state.season + 1) return;

  // Zwei Erinnerungen pro Saison: zum Start und zur Winterpause.
  const m = month(state.date);
  const marke = m === 8 ? 'sommer' : m === 1 ? 'winter' : null;
  if (!marke) return;

  const schluessel = `vertrag-${end}-${marke}`;
  if (state.contractReminders?.includes(schluessel)) return;
  state.contractReminders = [...(state.contractReminders ?? []), schluessel];

  const vorsilbe = marke === 'sommer' ? 'ct.remindSummer' : 'ct.remindWinter';
  addNews(state, 'contract',
    t(`${vorsilbe}.title`),
    t(`${vorsilbe}.body`, { club: club.name }), true);
}

/**
 * Sucht einen Verein, der einen abloesefreien Spieler dieser Staerke nimmt.
 * Bewusst eine Stufe unter dem, was ein ausgehandelter Wechsel gebracht haette:
 * Wer sich nicht kuemmert, landet nicht beim Spitzenreiter.
 */
function findFreeAgentClub(
  state: GameState, rng: Rng, ability: number,
  exclude: string | null, heimatLand: string | null, alter: number,
) {
  // Abloesefrei heisst kostenlos in der Anschaffung, nicht im Unterhalt. Ohne
  // die Gehaltspruefung landete ein Spieler ausgerechnet auf dem Weg, den er
  // sich nicht aussucht, bei einem Verein, der ihn nicht bezahlen kann.
  const gehaelter = buildWageIndex(state);
  const kandidaten: Club[] = [];
  for (const club of Object.values(state.clubs)) {
    if (club.id === exclude) continue;
    // Vereine, deren Ruf ungefaehr zur Staerke passt - ohne den Aufschlag,
    // den ein selbst verhandelter Wechsel mitbringt.
    if (Math.abs(club.reputation - ability * 0.9) > 18) continue;
    const level = state.competitions[club.leagueId]?.level ?? 3;
    const country = COUNTRY_BY_ID[club.countryId];
    const gehalt = Math.round(
      calcSalary(ability, alter, level, club.reputation, country?.wealth ?? 1) * 0.82);
    if (!canSign(club, gehaelter.get(club.id) ?? 0, 0, gehalt, 1.15)) continue;
    kandidaten.push(club);
  }
  if (kandidaten.length === 0) return null;
  // Das bisherige Land wiegt schwerer: Ein Wechsel ins Ausland soll
  // vorkommen, aber nicht der Normalfall sein, wenn man nichts entscheidet.
  return rng.weighted(kandidaten, (c) => {
    const passung = Math.max(0.1, 100 - Math.abs(c.reputation - ability * 0.9));
    return c.countryId === heimatLand ? passung * 3 : passung;
  });
}

/**
 * Laesst einen nicht verlaengerten Vertrag auslaufen. Wird am Saisonende
 * aufgerufen, nachdem der Spieler eine volle Saison Zeit hatte zu handeln.
 *
 * Zur Datumsrechnung: Ein Vertrag "bis 2029-06-30" deckt die Saison 2028/29
 * ab, die im Spielstand die Saison 2028 ist. Er endet also am Ende der
 * Saison `end - 1` - nicht erst der Saison `end`.
 */
export function expireUserContract(state: GameState, rng: Rng) {
  const user = state.players[state.userPlayerId];
  if (!user?.contract) return;
  const end = contractEndYear(state);
  if (end === null || end > state.season + 1) return;

  const altClub = user.clubId ? state.clubs[user.clubId] : null;
  const ability = computeOverall(user.attrs, user.position);
  const alter = ageOn(user.birthDate, state.date);

  const ziel = findFreeAgentClub(
    state, rng, ability, user.clubId ?? null, altClub?.countryId ?? null, alter);

  // Die Spielfuehrerbinde gehoert zum Verein, nicht zum Spieler.
  dropCaptaincyOnTransfer(user);
  user.contract = null;
  user.clubId = null;

  if (!ziel) {
    // Kein Abnehmer. Die vorhandene Pruefung auf ein Karriereende uebernimmt.
    const name = altClub?.name ?? t('ct.oldClubFallback');
    addNews(state, 'contract', t('ct.noClub.title'),
      t('ct.noClub.body', { club: name }), true);
    addCareerEvent(state, 'contract', t('ct.expired.title'),
      t('ct.expired.body', { club: name }));
    return;
  }

  const level = state.competitions[ziel.leagueId]?.level ?? 3;
  const country = COUNTRY_BY_ID[ziel.countryId];
  // Abloesefrei heisst hier auch: spuerbar unter Wert.
  const salary = Math.round(
    calcSalary(ability, alter, level, ziel.reputation, country?.wealth ?? 1) * 0.82);

  user.clubId = ziel.id;
  user.contract = {
    clubId: ziel.id,
    salary,
    until: makeDate(state.season + 1 + rng.int(2, 3), 6, 30),
    role: ability >= ziel.reputation * 0.8 ? 'Stammspieler' : 'Rotationsspieler',
    goalBonus: 0,
    appearanceBonus: 0,
  };

  // Neues Umfeld, das man sich nicht ausgesucht hat.
  state.coachRelation = clamp(45 + rng.float(-5, 5), 1, 99);
  state.fanRelation = clamp(45 + rng.float(-5, 5), 1, 99);
  user.reputation = clamp(user.reputation - 2, 1, 99);

  const altName = altClub?.name ?? t('ct.oldClubFallback');
  const lohn = tNumber(salary);
  addNews(state, 'contract',
    t('ct.free.news', { last: user.lastName, club: ziel.name }),
    t('ct.free.newsBody', { old: altName, club: ziel.name, salary: lohn }), true);
  addCareerEvent(state, 'transfer',
    t('ct.free.title', { club: ziel.name }),
    t('ct.free.body', { old: altName, club: ziel.name, age: alter, salary: lohn }),
    { clubId: ziel.id });
}


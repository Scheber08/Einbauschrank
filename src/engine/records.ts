/**
 * Bestehende Ligarekorde beim Karrierestart (Konzept Abschnitt 48).
 *
 * Ohne sie war jede Bestmarke am Ende der ersten Saison eine Bestmarke -
 * die Rekordliste fuellte sich mit dem, was gerade passiert war, und es
 * gab nichts zu jagen. Ein Karrierespiel lebt aber davon, dass eine Zahl
 * schon dasteht, bevor man anfaengt.
 *
 * Die **Zahlen** sind an echten Bestmarken orientiert und deshalb
 * realistisch schwer: Vierzig Tore in einer Saison der obersten
 * Spielklasse schafft niemand nebenbei. Die **Namen** sind erfunden und
 * werden aus dem Namenstopf des jeweiligen Landes gezogen - es steht also
 * keine reale Person im Spiel, und nichts davon gelangt als Klarname ins
 * Repository.
 */
import { NAME_POOLS } from './names';
import { Rng } from './rng';
import { t } from '../i18n';
import { tryRecord } from './stats';
import type { GameState } from './types';

/** Bestmarken je Spielklasse: Tore und Vorlagen in einer Saison. */
export const START_RECORDS: Record<number, { tore: number; vorlagen: number }> = {
  1: { tore: 40, vorlagen: 21 },
  2: { tore: 31, vorlagen: 18 },
  3: { tore: 27, vorlagen: 16 },
};

/** Schluessel der Ligarekorde - auch anderswo gebraucht. */
export function ligaRekordSchluessel(compId: string) {
  return { tore: `leagueGoals:${compId}`, vorlagen: `leagueAssists:${compId}` };
}

/**
 * Legt die Bestmarken jeder Liga an. Einmal beim Karrierestart.
 *
 * Der Halter ist erfunden, passt aber zum Land - ein Rekord mit einem
 * Namen, der dort niemand sein koennte, faellt sofort auf.
 */
export function seedRecords(state: GameState) {
  // Eigener Strom: Die Rekordhalter duerfen den Spielverlauf nicht
  // verschieben.
  const rng = new Rng(0x5bf03635 ^ (state.season * 40503));
  for (const comp of Object.values(state.competitions)) {
    if (comp.type !== 'league') continue;
    const marke = START_RECORDS[comp.level] ?? START_RECORDS[3];
    const pool = NAME_POOLS[comp.countryId] ?? Object.values(NAME_POOLS)[0];
    const schluessel = ligaRekordSchluessel(comp.id);
    const name = () => `${rng.pick(pool.firstNames)} ${rng.pick(pool.lastNames)}`;
    // Ein paar Jahre zurueck - eine Bestmarke von gestern waere keine.
    const jahr = state.season - rng.int(3, 24);
    tryRecord(state, {
      key: schluessel.tore,
      label: t('rec.leagueGoals', { league: comp.name }),
      scope: comp.name,
      holderName: name(),
      value: marke.tore,
      displayValue: t('rec.goalsValue', { n: marke.tore }),
    }, `${jahr}-06-30`);
    tryRecord(state, {
      key: schluessel.vorlagen,
      label: t('rec.leagueAssists', { league: comp.name }),
      scope: comp.name,
      holderName: name(),
      value: marke.vorlagen,
      displayValue: t('rec.assistsValue', { n: marke.vorlagen }),
    }, `${state.season - rng.int(3, 24)}-06-30`);
  }
}

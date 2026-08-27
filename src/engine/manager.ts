/**
 * Trainerwechsel.
 *
 * Vereine hatten bisher einen `managerName`, der sich nie aenderte - der
 * Trainer war unsterblich. Dabei ist er die eine Person, deren Urteil
 * entscheidet, ob man spielt: `slotScore` in lineup.ts zieht `coachRelation`
 * direkt in die Aufstellung ein.
 *
 * Ein Trainerwechsel ist deshalb der klassische Moment einer Laufbahn, in dem
 * sich die eigene Lage aendert, ohne dass man etwas falsch gemacht hat. Wer
 * unter dem alten Trainer gesetzt war, muss sich neu beweisen - und wer auf der
 * Bank sass, bekommt eine zweite Chance.
 *
 * Gewechselt wird nur zum Saisonende. Ein Rauswurf mitten in der Serie waere
 * realistischer, wuerde aber den Spielplan und die laufenden Ziele stoeren.
 */
import { t } from '../i18n';
import { COUNTRY_BY_ID } from './countries';
import { addCareerEvent, addNews } from './ids';
import { tableKey } from './season';
import { NAME_POOLS } from './names';
import { Rng, clamp } from './rng';
import type { Club, GameState, Id } from './types';

/** Grundrisiko fuer einen Wechsel, auch wenn die Saison ordentlich lief. */
const GRUNDRISIKO = 0.07;

/** Ein neuer Name aus dem Pool des Vereinslandes. */
function neuerTrainerName(rng: Rng, club: Club): string {
  const country = COUNTRY_BY_ID[club.countryId];
  const pool = NAME_POOLS[country?.id ?? ''] ?? NAME_POOLS.falkenland;
  return `${rng.pick(pool.managerFirst)} ${rng.pick(pool.lastNames)}`;
}

/**
 * Wie weit ist der Verein hinter dem zurueckgeblieben, was sein Ruf erwarten
 * liess? Positiv heisst enttaeuscht, negativ heisst uebertroffen.
 */
function rueckstand(
  platzierung: Map<Id, number>, erwartet: Map<Id, number>, clubId: Id,
): number {
  const ist = platzierung.get(clubId);
  const soll = erwartet.get(clubId);
  if (ist === undefined || soll === undefined) return 0;
  return ist - soll;
}

/**
 * Prueft am Saisonende alle Vereine auf einen Trainerwechsel und fuehrt ihn
 * durch. Fuer den eigenen Verein wird die Trainerbeziehung neu gewuerfelt.
 */
export function runManagerChanges(state: GameState, rng: Rng, absteiger: Set<Id>) {
  const user = state.players[state.userPlayerId];

  for (const league of Object.values(state.competitions)) {
    if (league.type !== 'league') continue;
    const tabelle = state.tables[tableKey(league.id, state.season)];
    if (!tabelle) continue;

    // Ist-Platzierung aus der Abschlusstabelle.
    const platzierung = new Map<Id, number>();
    const zeilen = Object.values(tabelle).sort((a, b) =>
      b.points - a.points
      || (b.goalsFor - b.goalsAgainst) - (a.goalsFor - a.goalsAgainst)
      || b.goalsFor - a.goalsFor);
    zeilen.forEach((row, i) => platzierung.set(row.clubId, i + 1));

    // Soll-Platzierung nach Ruf: Der teuerste Kader soll vorne stehen.
    const erwartet = new Map<Id, number>();
    [...league.clubIds]
      .map((id) => state.clubs[id])
      .filter((c): c is Club => !!c)
      .sort((a, b) => b.reputation - a.reputation)
      .forEach((club, i) => erwartet.set(club.id, i + 1));

    for (const clubId of league.clubIds) {
      const club = state.clubs[clubId];
      if (!club) continue;

      const differenz = rueckstand(platzierung, erwartet, clubId);
      // Enttaeuschung kostet den Job, ein Abstieg fast immer.
      let risiko = GRUNDRISIKO + Math.max(0, differenz) * 0.035;
      if (absteiger.has(clubId)) risiko += 0.4;
      // Wer uebertroffen hat, sitzt fest im Sattel.
      if (differenz < -2) risiko *= 0.35;

      if (!rng.chance(clamp(risiko, 0, 0.85))) continue;

      const alter = club.managerName;
      club.managerName = neuerTrainerName(rng, club);
      if (club.managerName === alter) continue;

      const eigenerVerein = user?.clubId === clubId;
      if (eigenerVerein) {
        // Der neue Trainer bringt eine eigene Meinung mit. Sie kann besser
        // ausfallen als die des Vorgaengers - oder deutlich schlechter.
        const vorher = state.coachRelation;
        // Der Neue kennt den Spieler nur aus der Zeitung. Ein guter Ruf
        // verschafft Vorschuss, ein schlechter Misstrauen.
        const eindruck = 50 + (state.publicImage - 50) * 0.25;
        state.coachRelation = clamp(eindruck + rng.float(-14, 14), 5, 95);
        const richtung = t(state.coachRelation > vorher ? 'mg.better' : 'mg.worse');

        addNews(state, 'coach',
          t('mg.own.news', { club: club.name, name: club.managerName }),
          t('mg.own.newsBody', { old: alter, direction: richtung }), true);
        addCareerEvent(state, 'coach',
          t('mg.own.title', { name: club.managerName }),
          t('mg.own.body', { old: alter, club: club.name, name: club.managerName }),
          { clubId });
      } else if (absteiger.has(clubId) || differenz > 5) {
        // Nur die auffaelligen Wechsel melden, sonst rauscht das Postfach zu.
        addNews(state, 'transfer',
          t('mg.other.news', { club: club.name }),
          t('mg.other.newsBody', { old: alter, name: club.managerName }), false);
      }
    }
  }
}

/**
 * Der Schiedsrichter.
 *
 * Er kam bisher nur in Textbausteinen vor ("Der Schiedsrichter zeigt Gelb") -
 * als Figur gab es ihn nicht. Jede Partie wurde nach demselben Massstab
 * gepfiffen: 5,5 Prozent Kartenwahrscheinlichkeit je Minute, drei Prozent
 * davon glatt Rot, 55 Prozent der Elfmeter fuer die Heimmannschaft. Wer
 * pfiff, machte keinen Unterschied.
 *
 * Dabei ist der Schiedsrichter eine der wenigen Groessen, ueber die ein
 * Spieler vor dem Anpfiff nachdenkt: Bei einem Kleinlichen laesst man das
 * harte Einsteigen sein, bei einem, der laufen laesst, geht mehr.
 *
 * Wie Wetter und Kulisse wird er nicht gewuerfelt, sondern aus der
 * Partiekennung abgeleitet - so sehen Vorbereitung, Oberflaeche und
 * Abrechnung denselben Mann, ohne dass ein Zufallsgeber durchgereicht werden
 * muss.
 */

import { NAME_POOLS } from './names';

export type RefereeStyle =
  | 'balanced' | 'strict' | 'lenient' | 'cardHappy' | 'homer';

/**
 * Wie er pfeift. Alles ist ein Vielfaches des bisherigen Verhaltens, 1 heisst
 * also: genau wie vorher.
 */
export interface RefereeEffect {
  /** Wie oft er ueberhaupt unterbricht. */
  fouls: number;
  /** Wie schnell er dafuer in die Tasche greift. */
  cards: number;
  /** Neigung zum glatten Platzverweis. */
  red: number;
  /** Wie sehr die Raenge ihn ziehen, 0 bis 1. */
  homeBias: number;
}

/**
 * Der Anteil gepfiffener Vergehen, die eine Karte nach sich ziehen.
 *
 * Vorher war das keine eigene Groesse: Jedes Vergehen aus `rollDiscipline`
 * gab eine Karte, Fouls und Karten waren dieselbe Zahl. Getrennt bleibt das
 * Produkt fuer den unauffaelligen Schiedsrichter gleich (0.11 mal 0.5 sind
 * die alten 0.055), aber die Statistik im Spielbericht stimmt endlich: mehr
 * Fouls als Karten, so wie im Fussball.
 */
export const CARD_SHARE = 0.5;

const EFFECTS: Record<RefereeStyle, RefereeEffect> = {
  balanced: { fouls: 1.00, cards: 1.00, red: 1.0, homeBias: 0.20 },
  strict: { fouls: 1.35, cards: 1.15, red: 1.05, homeBias: 0.10 },
  lenient: { fouls: 0.70, cards: 0.72, red: 0.7, homeBias: 0.20 },
  cardHappy: { fouls: 1.10, cards: 1.45, red: 1.15, homeBias: 0.15 },
  homer: { fouls: 1.00, cards: 1.00, red: 0.9, homeBias: 0.75 },
};

export function refereeEffect(style: RefereeStyle | undefined): RefereeEffect {
  return EFFECTS[style ?? 'balanced'];
}

/** Der Mann, der die Partie leitet. */
export interface Referee {
  name: string;
  style: RefereeStyle;
}

/** Ein Wurf zwischen 0 und 1, der nur an Kennung und Zweck haengt. */
function roll(matchId: string, salz: number): number {
  let h = 17 + salz * 101;
  for (let i = 0; i < matchId.length; i++) {
    h = (h * 41 + matchId.charCodeAt(i)) % 100003;
  }
  return (h % 983) / 983;
}

/**
 * Haeufigkeiten der Spielarten. Der unauffaellige Schiedsrichter ist der
 * Normalfall - wenn jede Partie einen Charakterkopf haette, waere keiner mehr
 * einer.
 */
const VERTEILUNG: [RefereeStyle, number][] = [
  ['balanced', 46],
  ['strict', 16],
  ['lenient', 16],
  ['cardHappy', 13],
  ['homer', 9],
];

export function matchReferee(matchId: string, countryId: string): Referee {
  const summe = VERTEILUNG.reduce((a, [, g]) => a + g, 0);
  let ziel = roll(matchId, 1) * summe;
  let style: RefereeStyle = 'balanced';
  for (const [s, g] of VERTEILUNG) {
    ziel -= g;
    if (ziel <= 0) { style = s; break; }
  }

  // Der Name kommt aus demselben Vorrat wie Spieler und Trainer - erfundene
  // Leute, passend zum Land des Heimvereins.
  const pool = NAME_POOLS[countryId] ?? NAME_POOLS.falkenland;
  const vor = pool.firstNames[Math.floor(roll(matchId, 2) * pool.firstNames.length)];
  const nach = pool.lastNames[Math.floor(roll(matchId, 3) * pool.lastNames.length)];

  return { name: `${vor} ${nach}`, style };
}

/** Katalogschluessel fuer die kurze Bezeichnung der Spielart. */
export function refereeLabelKey(style: RefereeStyle): string {
  return `referee.${style}`;
}

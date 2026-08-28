/**
 * Die Anstosszeit.
 *
 * Eine Partie hatte bisher nur ein Datum. Ein Freitagabend unter Flutlicht
 * und ein Sonntagmittag waren dieselbe Sache - im Kalender, im Spielbericht
 * und in der Stimmung. Dabei ist die Anstosszeit das erste, was ein Fan von
 * einem Spieltag weiss, noch vor dem Gegner.
 *
 * Wie Wetter, Kulisse und Schiedsrichter wird sie nicht gewuerfelt, sondern
 * aus Partiekennung und Wochentag abgeleitet: Kalender, Vorbereitung und
 * Spielbericht nennen dieselbe Uhrzeit, ohne dass irgendwo ein Zufallsgeber
 * durchgereicht werden muesste.
 */

import type { GameDate } from './date';
import { weekday } from './date';

/** Minuten seit Mitternacht, damit sich Zeiten vergleichen lassen. */
export interface Kickoff {
  stunde: number;
  minute: number;
  /** Spielt die Partie unter Flutlicht? */
  flutlicht: boolean;
}

/** Ein Wurf zwischen 0 und 1, der nur an der Partiekennung haengt. */
function roll(matchId: string): number {
  let h = 23;
  for (let i = 0; i < matchId.length; i++) {
    h = (h * 43 + matchId.charCodeAt(i)) % 100057;
  }
  return (h % 971) / 971;
}

/**
 * Uebliche Anstosszeiten je Wochentag, mit Gewichten.
 *
 * Samstagnachmittag ist der Normalfall, alles andere die Ausnahme - so, wie
 * ein Spielplan tatsaechlich aussieht.
 */
const ZEITEN: Record<number, [number, number, number][]> = {
  // Sonntag
  0: [[13, 30, 30], [15, 30, 40], [17, 30, 30]],
  1: [[19, 0, 40], [20, 30, 60]],
  2: [[18, 45, 45], [20, 45, 55]],
  3: [[18, 45, 45], [20, 45, 55]],
  4: [[19, 0, 40], [20, 30, 60]],
  // Freitag
  5: [[18, 30, 30], [20, 30, 70]],
  // Samstag
  6: [[13, 0, 12], [15, 30, 58], [18, 30, 22], [20, 30, 8]],
};

/** Ab dieser Stunde brennt das Flutlicht - im Winter frueher. */
function flutlichtAb(datum: GameDate): number {
  const monat = Number(datum.slice(5, 7)) || 6;
  // Von Mai bis August wird es spaet dunkel, im Winter frueh.
  if (monat >= 5 && monat <= 8) return 20;
  if (monat === 4 || monat === 9) return 19;
  return 16;
}

export function matchKickoff(matchId: string, datum: GameDate): Kickoff {
  const tag = weekday(datum);
  const moeglich = ZEITEN[tag] ?? ZEITEN[6];
  const summe = moeglich.reduce((a, [, , g]) => a + g, 0);

  let ziel = roll(matchId) * summe;
  let gewaehlt = moeglich[moeglich.length - 1];
  for (const eintrag of moeglich) {
    ziel -= eintrag[2];
    if (ziel <= 0) { gewaehlt = eintrag; break; }
  }

  const [stunde, minute] = gewaehlt;
  return { stunde, minute, flutlicht: stunde >= flutlichtAb(datum) };
}

/** Als Uhrzeit, in beiden Sprachen gleich geschrieben. */
export function formatKickoff(k: Kickoff): string {
  return `${String(k.stunde).padStart(2, '0')}:${String(k.minute).padStart(2, '0')}`;
}

/**
 * Wie die Anstosszeit auf die Zuschauerzahl wirkt.
 *
 * Abendspiele unter der Woche fuellen die Raenge schlechter als der
 * Samstagnachmittag, ein Freitagabend dagegen etwas besser. Die Spanne ist
 * bewusst schmal: die Uhrzeit faerbt den Abend, sie entscheidet ihn nicht.
 */
export function kickoffAuslastung(k: Kickoff, datum: GameDate): number {
  const tag = weekday(datum);
  // Werktags unter der Woche kommen weniger Leute.
  if (tag >= 1 && tag <= 4) return 0.9;
  if (tag === 5) return 1.04;
  // Ein frueher Sonntagmittag ist der unbeliebteste Termin.
  if (tag === 0 && k.stunde < 14) return 0.93;
  return 1;
}

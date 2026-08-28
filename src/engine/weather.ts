/**
 * Das Wetter am Spieltag.
 *
 * Bis hierher war jeder Spieltag wettertechnisch derselbe: Ein Januarspiel
 * im Schneetreiben und ein Augustnachmittag bei 34 Grad liefen ueber genau
 * dieselben Zahlen. Das Wetter ist die billigste Abwechslung, die Fussball
 * kennt - es aendert das Bild, das Tempo und die Fehlerquote, ohne dass der
 * Spieler etwas dafuer tun oder verstehen muss.
 *
 * Es wird nicht gewuerfelt, sondern aus Partiekennung und Monat abgeleitet:
 * Vorbereitung, Oberflaeche und Abrechnung sehen dasselbe Wetter, ohne dass
 * irgendwo ein Zufallsgeber durchgereicht werden muesste. Dasselbe Muster
 * wie `attendanceRoll` und `trv`.
 */

import type { GameDate } from './date';

export type Weather =
  | 'clear' | 'cloudy' | 'rain' | 'downpour' | 'wind'
  | 'heat' | 'cold' | 'snow' | 'fog';

/** Wie sich das Wetter auf das Spiel legt. 1 heisst: aendert nichts. */
export interface WeatherEffect {
  /** Zielgenauigkeit der Abschluesse. */
  accuracy: number;
  /** Qualitaet von Fernschuessen - Wind und nasse Baelle trueben sie. */
  longShot: number;
  /** Kraftverbrauch. Hitze zehrt, Kaelte kaum. */
  stamina: number;
}

const NEUTRAL: WeatherEffect = { accuracy: 1, longShot: 1, stamina: 1 };

/**
 * Die Zahlen sind bewusst klein. Wetter soll den Nachmittag faerben, nicht
 * das Ergebnis bestimmen - ein Schneespiel bleibt ein Fussballspiel.
 */
const EFFECTS: Record<Weather, WeatherEffect> = {
  clear: NEUTRAL,
  cloudy: NEUTRAL,
  rain: { accuracy: 0.96, longShot: 0.94, stamina: 1.02 },
  downpour: { accuracy: 0.90, longShot: 0.86, stamina: 1.06 },
  wind: { accuracy: 0.93, longShot: 0.82, stamina: 1.03 },
  heat: { accuracy: 0.98, longShot: 0.97, stamina: 1.18 },
  cold: { accuracy: 0.98, longShot: 0.98, stamina: 0.97 },
  snow: { accuracy: 0.88, longShot: 0.85, stamina: 1.10 },
  fog: { accuracy: 0.95, longShot: 0.88, stamina: 1.00 },
};

export function weatherEffect(w: Weather | undefined): WeatherEffect {
  return w ? EFFECTS[w] : NEUTRAL;
}

/**
 * Gewichte je Monat, Nordhalbkugel. Die Summe muss nicht 1 ergeben, es wird
 * anteilig gezogen - so lassen sich einzelne Monate anpassen, ohne den Rest
 * nachrechnen zu muessen.
 */
const SEASON: Record<number, Partial<Record<Weather, number>>> = {
  1: { cold: 34, snow: 14, rain: 16, fog: 12, cloudy: 18, clear: 6 },
  2: { cold: 30, snow: 10, rain: 18, fog: 10, cloudy: 20, clear: 8, wind: 4 },
  3: { cold: 16, rain: 20, wind: 14, cloudy: 26, clear: 20, fog: 4 },
  4: { rain: 22, wind: 12, cloudy: 26, clear: 32, downpour: 6, cold: 2 },
  5: { rain: 16, wind: 8, cloudy: 22, clear: 44, downpour: 6, heat: 4 },
  6: { rain: 10, cloudy: 18, clear: 48, downpour: 8, heat: 16 },
  7: { rain: 8, cloudy: 14, clear: 46, downpour: 8, heat: 24 },
  8: { rain: 8, cloudy: 16, clear: 44, downpour: 10, heat: 22 },
  9: { rain: 18, wind: 10, cloudy: 26, clear: 34, downpour: 6, heat: 6 },
  10: { rain: 24, wind: 14, cloudy: 28, clear: 20, fog: 10, cold: 4 },
  11: { rain: 24, wind: 14, cloudy: 26, clear: 10, fog: 16, cold: 10 },
  12: { cold: 28, snow: 10, rain: 20, fog: 14, cloudy: 20, clear: 8 },
};

/** Ein Wurf zwischen 0 und 1, der nur an der Partiekennung haengt. */
function roll(matchId: string): number {
  let h = 13;
  for (let i = 0; i < matchId.length; i++) {
    h = (h * 37 + matchId.charCodeAt(i)) % 100019;
  }
  return (h % 991) / 991;
}

/** Das Wetter einer Partie. Immer dasselbe fuer dieselbe Partie. */
export function matchWeather(matchId: string, date: GameDate): Weather {
  const monat = Number(date.slice(5, 7)) || 1;
  const gewichte = SEASON[monat] ?? SEASON[4];
  const eintraege = Object.entries(gewichte) as [Weather, number][];
  const summe = eintraege.reduce((a, [, g]) => a + g, 0);

  let ziel = roll(matchId) * summe;
  for (const [w, g] of eintraege) {
    ziel -= g;
    if (ziel <= 0) return w;
  }
  return 'cloudy';
}

/** Katalogschluessel fuer die kurze Bezeichnung. */
export function weatherLabelKey(w: Weather): string {
  return `weather.${w}`;
}

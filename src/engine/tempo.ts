/**
 * Wie sich ein Spiel ueber neunzig Minuten anfuehlt.
 *
 * `ATTACK_PROB` war eine Konstante: Minute 3 und Minute 88 waren gleich
 * wahrscheinlich, in jeder Partie, immer. Damit plaetscherte jedes Spiel
 * gleichmaessig durch - es gab keine Druckphasen, keine zaehe Mitte, keine
 * wilde Schlussphase. Zwei Partien mit demselben Ergebnis fuehlten sich
 * deshalb identisch an, obwohl im Fussball genau das den Unterschied macht.
 *
 * Zwei Dinge stecken hier drin. Die **Minutenkurve** ist fest und bildet ab,
 * dass Tore spaet haeufiger fallen als frueh - muede Beine, Risiko im
 * Rueckstand, offene Raeume. Der **Schwung** ist der zufaellige Teil: er
 * driftet ueber die Partie und laesst mal die eine, mal die andere
 * Mannschaft draufsatteln.
 */

import { clamp } from './rng';
import type { Rng } from './rng';
import type { Challenge } from './matchTypes';
import type { DifficultySettings } from './types';

/** Gewicht der ersten Minute. */
const START = 0.70;
/** Wie stark es bis zum Schlusspfiff ansteigt. */
const ANSTIEG = 0.62;
/**
 * Mittel ueber eine Partie. Es wird herausgerechnet, damit die Kurve die
 * Chancen nur **umverteilt** und nicht insgesamt mehr davon erzeugt - sonst
 * waere aus einer Abwechslung heimlich eine Torflut geworden.
 */
const MITTEL = START + ANSTIEG / 2;

/**
 * Wie wahrscheinlich in dieser Minute etwas passiert, im Mittel 1.
 *
 * Von rund 0,69 in der Anfangsphase auf rund 1,31 in der Schlussphase. Das
 * entspricht ungefaehr der echten Verteilung: knapp ein Achtel der Tore
 * faellt in den ersten fuenfzehn Minuten, gut ein Fuenftel in den letzten.
 */
export function minutenGewicht(minute: number): number {
  const m = Math.min(Math.max(minute, 1), 95);
  return (START + (m / 95) * ANSTIEG) / MITTEL;
}

/** Groesstes vorkommendes Gewicht - fuer die Ziehung unten. */
const MAX_GEWICHT = (START + ANSTIEG) / MITTEL;

/**
 * Zieht eine Torminute nach derselben Kurve.
 *
 * Die schnelle Simulation wuerfelte die Minute gleichverteilt, es fielen dort
 * also genauso viele Tore in der zweiten wie in der achtzigsten Minute. Ohne
 * das hier haetten Hintergrundpartien eine andere Torverteilung als die
 * eigenen - in den Statistiken der Liga waere das aufgefallen.
 */
export function zieheTorminute(rng: Rng): number {
  for (let i = 0; i < 12; i++) {
    const m = rng.int(1, 94);
    if (rng.chance(minutenGewicht(m) / MAX_GEWICHT)) return m;
  }
  return rng.int(1, 94);
}

/**
 * Der Schwung einer Partie.
 *
 * Ein Wert zwischen -1 (die Gaeste sind drueber) und +1 (die Heimmannschaft
 * ist drueber), der sich langsam bewegt. Er kehrt von selbst zur Mitte
 * zurueck, damit keine Mannschaft neunzig Minuten am Stueck drueckt.
 */
export class Schwung {
  /** Aktuelle Neigung, -1 bis 1. */
  wert = 0;
  /** Wie wild es gerade zugeht, 0,55 bis 1,6. */
  tempo = 1;

  /** Eine Minute weiter. */
  tick(rng: Rng) {
    // Rueckkehr zur Mitte plus ein kleiner Stoss - ein Zufallsweg, der nicht
    // davonlaeuft.
    this.wert = clampWert(this.wert * 0.94 + rng.normal(0, 0.06));
    this.tempo = clampTempo(this.tempo + rng.normal(0, 0.09) - (this.tempo - 1) * 0.07);
  }

  /** Ein Tor gibt Auftrieb - die Mannschaft, die trifft, macht weiter. */
  tor(fuerHeim: boolean) {
    this.wert = clampWert(this.wert + (fuerHeim ? 0.3 : -0.3));
    // Nach einem Tor wird es kurz offener.
    this.tempo = clampTempo(this.tempo + 0.12);
  }

  /** Ein Platzverweis kippt die Partie deutlicher als alles andere. */
  platzverweis(gegenHeim: boolean) {
    this.wert = clampWert(this.wert + (gegenHeim ? -0.45 : 0.45));
  }

  /** Gesamtfaktor auf die Ereignisdichte dieser Minute. */
  dichte(minute: number): number {
    return this.tempo * minutenGewicht(minute);
  }

  /** Wie stark die Heimmannschaft gerade am Ball ist, als Faktor um 1. */
  heimAnteil(): number {
    return 1 + this.wert * 0.35;
  }
}

function clampWert(v: number): number {
  return Math.max(-1, Math.min(1, v));
}

function clampTempo(v: number): number {
  return Math.max(0.55, Math.min(1.6, v));
}

/**
 * Wie viele Sekunden bleiben, bis der Gegner da ist.
 * 0 bedeutet: keine Hetze - bei ruhendem Ball wartet der Gegner ebenfalls.
 *
 * Ohne diese Uhr liesse sich jede Szene beliebig lange auspendeln; genau das
 * nimmt einer Grosschance die Spannung. Der Wert ist bewusst grosszuegig -
 * es geht um Druck, nicht um Hektik.
 *
 * Steht hier und nicht in der Oberflaeche: wie lange man Zeit hat, ist
 * eine Spielregel. In einer React-Datei kam kein Rauchtest daran.
 */
export function pressureSeconds(challenge: Challenge, difficulty: DifficultySettings): number {
  if (challenge.kind === 'penalty' || challenge.kind === 'freeKick') return 0;
  // Die Uhr laeuft ueber die ganze Szene, also ueber Richtung, Kraft und
  // Ballkontakt zusammen.
  //
  // Sie ist grosszuegiger als frueher, weil das Ablaufen jetzt teuer ist:
  // Vorher wurde mit dem gespielt, was gerade eingestellt war - ein
  // ueberhasteter Abschluss, aber immerhin einer. Jetzt ist der Ball weg.
  // Wer bestraft wird, muss vorher auch wirklich Zeit gehabt haben.
  // Wer mehr Hektik will, senkt BASE; wer mehr Ruhe will, erhoeht sie.
  const BASE = 12;
  return clamp((BASE - challenge.pressure * 3.4) / difficulty.meterSpeed, 5.5, 17);
}

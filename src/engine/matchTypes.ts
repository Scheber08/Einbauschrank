/** Typen fuer Spielsimulation und interaktive Highlights. */
import type { PositionCode } from './attributes';
import type { Id } from './types';

export type ChallengeKind =
  | 'shot' | 'longShot' | 'header' | 'oneOnOne' | 'volley'
  | 'pass' | 'throughBall' | 'cross'
  | 'dribble' | 'duel' | 'interception'
  | 'penalty' | 'freeKick' | 'save' | 'penaltySave';

export interface ChallengeTarget {
  id: Id;
  name: string;
  shirtNumber: number;
  position: PositionCode;
  /** Position im Szenenkoordinatensystem (Meter, Tormitte = x 0 / y 0). */
  x: number;
  y: number;
  /** Wie eng gedeckt, 0 = frei, 1 = zugestellt. */
  marked: number;
  /** Abschlussstaerke des Mitspielers, fuer die Folgeaktion. */
  finishing: number;
}

/** Eine Spielsituation, die der Spieler selbst uebernehmen kann. */
export interface Challenge {
  id: string;
  kind: ChallengeKind;
  minute: number;
  title: string;
  hint: string;
  /** Entfernung zum Tor in Metern. */
  distance: number;
  /** Seitlicher Versatz zur Tormitte in Metern (negativ = links). */
  offset: number;
  /** Gegnerdruck 0-1. */
  pressure: number;
  /** Torwartqualitaet 0-100. */
  keeper: number;
  /** Qualitaet des direkten Gegenspielers 0-100. */
  opponent: number;
  /**
   * Wie entschlossen sich die Abwehr in den Ball wirft, 0-100.
   *
   * Aus `blocking` und `bravery` der Feldspieler. Beide Werte standen
   * im Attributblatt, liessen sich trainieren und kosteten
   * Trainingszeit - gelesen hat sie keine einzige Regel. Fehlt die
   * Angabe, bleibt es beim bisherigen Verhalten.
   */
  blockSkill?: number;
  /** Erwartete Torwahrscheinlichkeit der Ausgangssituation. */
  xg: number;
  bigChance: boolean;
  scoreline: [number, number];
  homeName: string;
  awayName: string;
  userSide: 'home' | 'away';
  targets?: ChallengeTarget[];
  /** Anzahl Spieler in der Mauer (Freistoss). */
  wall?: number;
  /** Kommt der Schuss von links oder rechts (Torwartszene)? */
  incoming?: {
    speed: number;
    curve: number;
    power: number;
    /** Tatsaechliche Zielrichtung des Schuetzen auf der Torlinie, in Metern. */
    aimX?: number;
    /**
     * Was die Koerperhaltung des Schuetzen verraet - die vermutete Richtung.
     * Je besser der Schuetze, desto ungenauer der Hinweis.
     */
    tell?: number;
  };
}

export type ChallengeOutcome =
  // `ballLost`: der Spieler hat zu lange gebraucht. Kein Abschluss, kein
  // Pass - der Gegner hat den Ball. Gilt fuer jede Szenenart.
  | 'ballLost'
  | 'goal' | 'saved' | 'offTarget' | 'blocked' | 'post'
  | 'assist' | 'passCompleted' | 'passLost'
  | 'dribbleWon' | 'dribbleLost' | 'foulSuffered'
  | 'duelWon' | 'duelLost' | 'foulCommitted'
  | 'saveMade' | 'goalConceded' | 'caught';

export interface ChallengeResult {
  outcome: ChallengeOutcome;
  /** Qualitaet der Eingabe, 0-1. Fliesst in Bewertung und Entwicklung ein. */
  quality: number;
  /** Bei Paessen: wer wurde angespielt. */
  targetId?: Id;
  /** Zusatzinfo fuer den Spielbericht. */
  detail?: string;
}

export type LiveEventType =
  | 'kickoff' | 'halftime' | 'fulltime' | 'goal' | 'ownGoal' | 'chance'
  | 'save' | 'miss' | 'yellow' | 'secondYellow' | 'red' | 'injury'
  | 'sub' | 'penaltyAwarded' | 'penaltyMiss' | 'note' | 'extraTime' | 'shootout';

export interface LiveEvent {
  minute: number;
  type: LiveEventType;
  side: 'home' | 'away' | null;
  playerId?: Id;
  assistId?: Id;
  text: string;
  /** Betrifft das Ereignis den eigenen Spieler? */
  user?: boolean;
  /**
   * Aus welcher Art Situation das Ereignis entstand - Kopfball, Fernschuss,
   * Eins gegen eins. Der Ticker kann es benennen, und es macht nachpruefbar,
   * welche Chancen ein Torwart haelt.
   */
  chanceKind?: string;
  score?: [number, number];
}

export interface StepResult {
  events: LiveEvent[];
  pending: Challenge | null;
  finished: boolean;
  minute: number;
}

/**
 * Ballsteuerung und Aktionsberechnung (Konzept Abschnitt 22 und 23).
 *
 * Koordinatensystem der Spielszene, alle Angaben in Metern:
 *   x  seitlich, 0 = Tormitte, negativ = links
 *   y  Tiefe, 0 = Torlinie, positive Werte = weiter vom Tor entfernt
 *   z  Hoehe ueber dem Rasen
 */
import { Rng, clamp } from './rng';
import type { ChallengeOutcome, ChallengeResult, Challenge } from './matchTypes';
import type { DifficultySettings, Player } from './types';

export const GOAL_HALF_WIDTH = 3.66;
export const CROSSBAR = 2.44;
const GRAVITY = 9.81;
const DT = 1 / 120;
/**
 * Luftwiderstand. Die Verzoegerung waechst mit dem Quadrat der Geschwindigkeit:
 * a = k * v^2. Der Wert entspricht ungefaehr einem Fussball
 * (0,43 kg, cw rund 0,25) und kostet einem 25-m/s-Schuss etwa ein Viertel
 * seiner Geschwindigkeit pro Sekunde.
 */
const DRAG = 0.0132;
/** Rollreibung auf Rasen je Simulationsschritt. */
const ROLL_FRICTION = 0.996;
/**
 * Staerke des Magnus-Effekts. Bei maximalem seitlichem Kontakt und hohem
 * Effetwert kruemmt sich die Flugbahn ueber 20 Meter um rund drei Meter.
 */
const SPIN_FACTOR = 6;

// --- Eingabe -----------------------------------------------------------

export interface BallInput {
  /** Zielpunkt der gezogenen Richtungslinie. */
  aimX: number;
  aimY: number;
  /** Kraft aus der Kraftanzeige, 0-1. */
  power: number;
  /** Ballkontaktpunkt, -1 bis 1. contactY positiv = Oberseite. */
  contactX: number;
  contactY: number;
}

export interface TrajectoryPoint {
  x: number;
  y: number;
  z: number;
  t: number;
}

export interface Flight {
  points: TrajectoryPoint[];
  /** Punkt, an dem der Ball die Torlinie kreuzt - null wenn er sie nie erreicht. */
  crossing: { x: number; z: number; t: number; speed: number } | null;
  /** Endpunkt der Flugbahn. */
  end: TrajectoryPoint;
  launchSpeed: number;
}

export interface FlightParams {
  startX: number;
  startY: number;
  aimX: number;
  aimY: number;
  power: number;
  contactX: number;
  contactY: number;
  /** Schusskraft-Attribut, 1-100. */
  shotPower: number;
  /** Effet-Attribut, 1-100. */
  curve: number;
  /** Maximale Flugzeit in Sekunden. */
  maxTime?: number;
}

/**
 * Integriert die Flugbahn mit Schwerkraft, Luftwiderstand und Magnus-Effekt.
 * Der Ballkontaktpunkt bestimmt Steigung (Unterseite) und Effet (Seite).
 */
export function simulateBallFlight(p: FlightParams): Flight {
  const dx = p.aimX - p.startX;
  const dy = p.aimY - p.startY;
  const horiz = Math.hypot(dx, dy) || 1;
  const dirX = dx / horiz;
  const dirY = dy / horiz;

  /*
   * Abflugwinkel aus dem Ballkontaktpunkt.
   * Die Mitte des Balls ergibt bewusst schon rund neun Grad: ein Schuss aus
   * 25 Metern braucht etwa 14 Grad, um das Tor in Kopfhoehe zu erreichen.
   * Waere die Mitte flach, muesste man jeden Schuss von unten treffen.
   *   Mitte        rund  9 Grad  - normaler Schuss
   *   Unterseite   bis  26 Grad  - Lupfer, Flanke, hoher Pass
   *   Oberseite    rund  2 Grad  - flacher Ball, Bodenpass
   */
  const lift = Math.max(0, -p.contactY);
  const topspin = Math.max(0, p.contactY);
  const launchAngle = clamp(0.16 + lift * 0.30 - topspin * 0.13, 0, 0.55);

  const speed = (7.5 + p.power * 20) * (0.74 + p.shotPower / 250);

  let x = p.startX;
  let y = p.startY;
  let z = 0.11;
  let vx = dirX * speed * Math.cos(launchAngle);
  let vy = dirY * speed * Math.cos(launchAngle);
  let vz = speed * Math.sin(launchAngle);

  // Seitlicher Ballkontakt erzeugt Drall und damit eine gekruemmte Flugbahn.
  const spin = p.contactX * (0.35 + p.curve / 145);

  const points: TrajectoryPoint[] = [{ x, y, z, t: 0 }];
  let crossing: Flight['crossing'] = null;
  // Grosszuegig bemessen: flache Baelle rollen die letzten Meter aus.
  const maxTime = p.maxTime ?? 5;
  let t = 0;

  while (t < maxTime) {
    const prevY = y;
    const prevX = x;
    const prevZ = z;

    const v = Math.hypot(vx, vy, vz) || 1;
    // Luftwiderstand: Verzoegerung proportional zum Quadrat der Geschwindigkeit
    const drag = DRAG * v;
    vx -= vx * drag * DT;
    vy -= vy * drag * DT;
    vz -= vz * drag * DT;

    // Magnus-Effekt wirkt senkrecht zur Bewegungsrichtung in der Ebene
    const horizSpeed = Math.hypot(vx, vy) || 1;
    const perpX = -vy / horizSpeed;
    const perpY = vx / horizSpeed;
    const magnus = spin * SPIN_FACTOR * (horizSpeed / 25);
    vx += perpX * magnus * DT;
    vy += perpY * magnus * DT;

    // Topspin drueckt den Ball nach unten
    vz -= (GRAVITY + topspin * 7) * DT;

    x += vx * DT;
    y += vy * DT;
    z += vz * DT;
    t += DT;

    if (z <= 0) {
      z = 0;
      if (Math.abs(vz) > 1.4) {
        // Aufsprung: ein Teil der Energie geht verloren
        vz = -vz * 0.55;
        vx *= 0.9;
        vy *= 0.9;
      } else {
        vz = 0;
        vx *= ROLL_FRICTION;
        vy *= ROLL_FRICTION;
      }
    }

    // Torlinie ueberquert?
    if (crossing === null && prevY > 0 && y <= 0) {
      const ratio = prevY / Math.max(1e-6, prevY - y);
      crossing = {
        x: prevX + (x - prevX) * ratio,
        z: prevZ + (z - prevZ) * ratio,
        t,
        speed: Math.hypot(vx, vy, vz),
      };
    }

    points.push({ x, y, z, t });

    if (y < -3 || Math.abs(x) > 45 || (z === 0 && Math.hypot(vx, vy) < 0.6)) break;
  }

  return { points, crossing, end: points[points.length - 1], launchSpeed: speed };
}

// --- Ausfuehrungsfehler ------------------------------------------------

export interface ExecutionContext {
  player: Player;
  /** Gegnerdruck, 0-1. */
  pressure: number;
  difficulty: DifficultySettings;
  rng: Rng;
  /** Relevante Technikattribute fuer diese Aktion. */
  skill: number;
  /** Wird der schwache Fuss benutzt? */
  weakFoot: boolean;
}

/**
 * Verrauscht die Eingabe abhaengig von Attributen, Druck und Verfassung.
 * Eine gute Eingabe erhoeht die Erfolgschance, garantiert sie aber nicht
 * (Konzept Abschnitt 23).
 */
export function applyExecutionError(input: BallInput, ctx: ExecutionContext): BallInput {
  const p = ctx.player;
  const condition = (p.form / 100) * 0.4 + (p.fitness / 100) * 0.35 + (p.confidence / 100) * 0.25;
  let errorScale = (1 - ctx.skill / 100) * (0.55 + ctx.pressure * 0.85);
  errorScale *= 1.25 - condition * 0.5;
  errorScale /= ctx.difficulty.targetSize;
  if (ctx.weakFoot) errorScale *= 1 + (100 - p.attrs.weakFoot) / 90;
  errorScale = clamp(errorScale, 0.04, 2.2);

  const aimSpread = errorScale * 2.6;
  return {
    aimX: input.aimX + ctx.rng.normal(0, aimSpread),
    aimY: input.aimY + ctx.rng.normal(0, aimSpread * 0.4),
    power: clamp(input.power + ctx.rng.normal(0, errorScale * 0.11), 0.05, 1),
    contactX: clamp(input.contactX + ctx.rng.normal(0, errorScale * 0.22), -1, 1),
    contactY: clamp(input.contactY + ctx.rng.normal(0, errorScale * 0.22), -1, 1),
  };
}

// --- Bewertung der Eingabe ---------------------------------------------

/**
 * Wie gut war die Eingabe des Spielers, unabhaengig vom Zufall?
 * Der Wert fliesst in Spielbewertung und Entwicklung ein.
 */
export function rateShotInput(input: BallInput, distance: number): number {
  // Zielt der Spieler ueberhaupt aufs Tor und dabei moeglichst in die Ecke?
  const inFrame = Math.abs(input.aimX) <= GOAL_HALF_WIDTH ? 1 : 0;
  const cornerBonus = inFrame
    ? clamp(Math.abs(input.aimX) / GOAL_HALF_WIDTH, 0, 1) * 0.8 + 0.2
    : 0;

  // Passende Kraft zur Entfernung
  const idealPower = clamp(0.28 + distance / 42, 0.25, 0.95);
  const powerScore = clamp(1 - Math.abs(input.power - idealPower) / 0.42, 0, 1);

  // Sinnvoller Ballkontakt: nicht zu weit unten (Ball fliegt drueber)
  const contactScore = clamp(1 - Math.abs(input.contactY + 0.15) / 0.85, 0, 1) * 0.6
    + clamp(1 - Math.abs(input.contactX) / 1.3, 0, 1) * 0.4;

  return clamp(cornerBonus * 0.45 + powerScore * 0.35 + contactScore * 0.2, 0, 1);
}

// --- Torwart -----------------------------------------------------------

export interface KeeperResult {
  saved: boolean;
  caught: boolean;
  diveX: number;
  diveZ: number;
}

/**
 * Entscheidet, ob der Torwart einen Schuss erreicht.
 * Reichweite haengt von Reflexen, Beweglichkeit und der verbleibenden Zeit ab.
 */
export function keeperAttempt(
  rng: Rng, keeperRating: number, crossing: { x: number; z: number; t: number; speed: number },
  distance: number, telegraphed: number,
): KeeperResult {
  // Der Torwart deckt die kurze Ecke leicht ab.
  const startX = clamp(crossing.x * 0.18, -1.4, 1.4);

  // Antizipation: wie gut liest er die Richtung?
  const readsIt = rng.chance(clamp(0.25 + keeperRating / 190 + telegraphed * 0.3, 0.15, 0.92));
  const guessX = readsIt
    ? crossing.x + rng.normal(0, 0.75)
    : startX + rng.normal(0, 3.2);

  // Verfuegbare Zeit bis der Ball die Linie erreicht
  const flightTime = Math.max(0.16, crossing.t);
  const reactionDelay = clamp(0.34 - keeperRating / 420, 0.11, 0.34);
  const usable = Math.max(0, flightTime - reactionDelay);

  // Reichweite in Metern
  const reach = 0.72 + (0.9 + keeperRating / 60) * Math.min(usable, 0.85) * 2.1;

  const dx = Math.abs(crossing.x - guessX);
  // Hohe Baelle sind schwerer zu erreichen als flache
  const heightPenalty = crossing.z > 1.5 ? (crossing.z - 1.5) * 0.7 : 0;
  const cornerPenalty = Math.abs(crossing.x) > 2.9 ? (Math.abs(crossing.x) - 2.9) * 0.55 : 0;
  const speedPenalty = crossing.speed > 24 ? (crossing.speed - 24) * 0.035 : 0;
  const effectiveReach = Math.max(0.2, reach - heightPenalty - cornerPenalty - speedPenalty);

  // Aus kurzer Distanz bleibt kaum Zeit
  const closeRange = distance < 8 ? 0.72 : 1;

  const saved = dx <= effectiveReach * closeRange;
  const caught = saved && rng.chance(clamp(0.28 + keeperRating / 260 - crossing.speed / 130, 0.05, 0.75));

  return { saved, caught, diveX: guessX, diveZ: crossing.z };
}

// --- Abschluss ---------------------------------------------------------

export interface ShotResolution {
  outcome: ChallengeOutcome;
  flight: Flight;
  keeper: KeeperResult | null;
  quality: number;
  /** Wo der Ball die Torlinie kreuzt, fuer die Darstellung. */
  crossing: { x: number; z: number } | null;
}

export function resolveShot(
  input: BallInput, challenge: Challenge, player: Player,
  difficulty: DifficultySettings, rng: Rng,
): ShotResolution {
  const isHeader = challenge.kind === 'header';
  const isPenalty = challenge.kind === 'penalty';
  const isFreeKick = challenge.kind === 'freeKick';

  const skill = isHeader
    ? (player.attrs.heading * 0.6 + player.attrs.finishing * 0.4)
    : isPenalty
      ? (player.attrs.penalties * 0.65 + player.attrs.composure * 0.35)
      : isFreeKick
        ? (player.attrs.freeKicks * 0.6 + player.attrs.curve * 0.25 + player.attrs.shotPower * 0.15)
        : challenge.kind === 'longShot'
          ? (player.attrs.longShots * 0.55 + player.attrs.shotPower * 0.25 + player.attrs.finishing * 0.2)
          : (player.attrs.finishing * 0.6 + player.attrs.ballControl * 0.2 + player.attrs.composure * 0.2);

  // Steht der Ball auf der Seite des schwachen Fusses?
  const strongIsLeft = player.foot === 'links';
  const weakFoot = !isHeader && ((challenge.offset > 3 && strongIsLeft) || (challenge.offset < -3 && !strongIsLeft))
    && rng.chance(0.55);

  const quality = rateShotInput(input, challenge.distance);

  const noisy = applyExecutionError(input, {
    player, pressure: isPenalty ? 0.2 : challenge.pressure, difficulty, rng, skill, weakFoot,
  });

  const flight = simulateBallFlight({
    startX: challenge.offset,
    startY: challenge.distance,
    aimX: noisy.aimX,
    aimY: noisy.aimY,
    power: noisy.power,
    contactX: noisy.contactX,
    contactY: noisy.contactY,
    shotPower: isHeader ? player.attrs.heading : player.attrs.shotPower,
    curve: player.attrs.curve,
  });

  if (!flight.crossing) {
    return { outcome: 'offTarget', flight, keeper: null, quality, crossing: null };
  }

  const { x, z } = flight.crossing;
  const post = GOAL_HALF_WIDTH;

  // Blockade durch Verteidiger oder Mauer
  if (!isPenalty) {
    const blockChance = isFreeKick
      ? (challenge.wall ?? 0) * 0.045
      : challenge.pressure * 0.22 * (challenge.distance > 18 ? 1.4 : 0.8);
    if (rng.chance(clamp(blockChance, 0, 0.45))) {
      return { outcome: 'blocked', flight, keeper: null, quality, crossing: { x, z } };
    }
  }

  const hitsFrame = (Math.abs(Math.abs(x) - post) < 0.16 && z <= CROSSBAR + 0.16)
    || (Math.abs(z - CROSSBAR) < 0.16 && Math.abs(x) <= post + 0.16);
  // Ein flach am Boden rollender Ball ist ebenfalls im Tor - deshalb kein z > 0.
  const onTarget = Math.abs(x) < post && z < CROSSBAR;

  if (hitsFrame && !onTarget) {
    return { outcome: 'post', flight, keeper: null, quality, crossing: { x, z } };
  }
  if (!onTarget) {
    return { outcome: 'offTarget', flight, keeper: null, quality, crossing: { x, z } };
  }

  // Wie stark verraet die Koerperhaltung die Richtung?
  const telegraphed = clamp(0.35 - player.attrs.composure / 300 + (isPenalty ? 0.15 : 0), 0, 0.6);
  const keeper = keeperAttempt(rng, challenge.keeper, flight.crossing, challenge.distance, telegraphed);

  if (keeper.saved) {
    return { outcome: 'saved', flight, keeper, quality, crossing: { x, z } };
  }
  return { outcome: 'goal', flight, keeper, quality, crossing: { x, z } };
}

/**
 * Erklaert das Ergebnis eines Abschlusses, damit der Spieler die Mechanik lernt
 * statt nur ein Ergebnis vorgesetzt zu bekommen.
 */
export function describeShot(
  resolution: ShotResolution, input: BallInput, distance: number,
): string {
  const c = resolution.crossing;
  const idealPower = clamp(0.28 + distance / 42, 0.25, 0.95);

  switch (resolution.outcome) {
    case 'goal':
      if (c && Math.abs(c.x) > 2.6) return 'Perfekt ins lange Eck gesetzt.';
      if (c && c.z < 0.5) return 'Flach und platziert - dagegen ist der Torwart machtlos.';
      return 'Sauber getroffen und verwandelt.';

    case 'post':
      return 'Aluminium. Wenige Zentimeter weiter nach innen und der Ball ist drin.';

    case 'blocked':
      return input.contactY < -0.3
        ? 'Ein Verteidiger blockt. Ein flacherer Ball haette den Weg gefunden.'
        : 'Ein Verteidiger stand im Schussweg.';

    case 'saved':
      if (c && Math.abs(c.x) < 1.4) {
        return 'Zu zentral gezielt - der Torwart musste sich kaum bewegen. Ziele naeher an den Pfosten.';
      }
      if (input.power < idealPower - 0.15) {
        return 'Gute Ecke, aber zu wenig Druck hinter dem Ball. Der Torwart hatte Zeit.';
      }
      return 'Starke Parade. Da war nicht viel zu machen.';

    case 'offTarget':
      if (!c) {
        return 'Der Ball erreicht die Torlinie gar nicht. Es fehlte deutlich an Kraft.';
      }
      if (c.z > CROSSBAR) {
        return input.contactY < -0.25
          ? 'Zu hoch. Du hast den Ball zu weit unten getroffen - er steigt zu stark.'
          : 'Zu hoch angesetzt. Weniger Kraft oder ein Kontakt weiter oben haelt den Ball flach.';
      }
      if (Math.abs(c.x) > GOAL_HALF_WIDTH) {
        const side = c.x > 0 ? 'rechts' : 'links';
        return Math.abs(input.contactX) > 0.45
          ? `Der Effet traegt den Ball ${side} am Tor vorbei. Weniger seitlicher Kontakt.`
          : `${side === 'rechts' ? 'Rechts' : 'Links'} vorbei. Die Richtung war zu weit aussen.`;
      }
      return 'Knapp daneben.';

    default:
      return '';
  }
}

// --- Pass --------------------------------------------------------------

export interface PassResolution {
  outcome: ChallengeOutcome;
  flight: Flight;
  quality: number;
  targetId: string;
  /** Abweichung vom Mitspieler in Metern. */
  error: number;
}

export function resolvePass(
  input: BallInput, challenge: Challenge, player: Player,
  targetId: string, difficulty: DifficultySettings, rng: Rng,
): PassResolution {
  const target = challenge.targets?.find((t) => t.id === targetId) ?? challenge.targets?.[0];
  const startX = challenge.offset;
  const startY = challenge.distance;

  const passDistance = target
    ? Math.hypot(target.x - startX, target.y - startY)
    : 15;
  const isLong = passDistance > 22;
  const isLofted = input.contactY < -0.35;

  const skill = isLofted || isLong
    ? (player.attrs.longPass * 0.6 + player.attrs.vision * 0.25 + player.attrs.curve * 0.15)
    : (player.attrs.shortPass * 0.6 + player.attrs.vision * 0.3 + player.attrs.ballControl * 0.1);

  const noisy = applyExecutionError(input, {
    player, pressure: challenge.pressure, difficulty, rng, skill, weakFoot: false,
  });

  const flight = simulateBallFlight({
    startX, startY,
    aimX: noisy.aimX, aimY: noisy.aimY,
    power: noisy.power,
    contactX: noisy.contactX, contactY: noisy.contactY,
    shotPower: player.attrs.longPass,
    curve: player.attrs.curve,
    maxTime: 2.6,
  });

  // Wo kommt der Ball ungefaehr an?
  const landing = findLanding(flight, target ? Math.hypot(target.x, target.y) : passDistance);
  const error = target ? Math.hypot(landing.x - target.x, landing.y - target.y) : 99;

  // Eingabequalitaet: wie genau war die Richtung und wie passend die Kraft?
  const aimError = target ? Math.hypot(input.aimX - target.x, input.aimY - target.y) : 20;
  const idealPower = clamp(0.18 + passDistance / 45, 0.15, 0.95);
  const quality = clamp(
    (1 - clamp(aimError / 12, 0, 1)) * 0.6
    + (1 - clamp(Math.abs(input.power - idealPower) / 0.4, 0, 1)) * 0.4,
    0, 1,
  );

  // Abfangen durch die Deckung
  const marked = target?.marked ?? 0.5;
  const interceptChance = clamp(
    marked * 0.42 + clamp(error / 9, 0, 1) * 0.4 + challenge.pressure * 0.1
    - player.attrs.vision / 400,
    0.02, 0.93,
  );

  if (error > 6.5 || rng.chance(interceptChance)) {
    return { outcome: 'passLost', flight, quality, targetId: target?.id ?? '', error };
  }
  return { outcome: 'passCompleted', flight, quality, targetId: target?.id ?? '', error };
}

function findLanding(flight: Flight, expectedRange: number): { x: number; y: number } {
  // Erster Bodenkontakt nach dem Abspiel, sonst der Punkt in Zielentfernung.
  for (let i = 3; i < flight.points.length; i++) {
    const p = flight.points[i];
    if (p.z <= 0.05) return { x: p.x, y: p.y };
  }
  let best = flight.points[flight.points.length - 1];
  let bestDiff = Infinity;
  for (const p of flight.points) {
    const d = Math.abs(Math.hypot(p.x, p.y) - expectedRange);
    if (d < bestDiff) { bestDiff = d; best = p; }
  }
  return { x: best.x, y: best.y };
}

// --- Zweikampf und Dribbling ------------------------------------------

export interface TimingInput {
  /** Abweichung vom idealen Zeitpunkt in Sekunden. Negativ = zu frueh. */
  offset: number;
  /** Optionale Richtungswahl beim Dribbling, -1 links bis 1 rechts. */
  direction?: number;
}

export function resolveDuel(
  timing: TimingInput, challenge: Challenge, player: Player,
  difficulty: DifficultySettings, rng: Rng,
): ChallengeResult {
  const skill = player.attrs.tackling * 0.45 + player.attrs.anticipation * 0.25
    + player.attrs.defPositioning * 0.2 + player.attrs.reactions * 0.1;

  // Trefferfenster in Sekunden
  const window = (0.1 + skill / 520) * difficulty.targetSize;
  const dev = Math.abs(timing.offset);
  const quality = clamp(1 - dev / (window * 2.6), 0, 1);

  // Grundchance aus Attributen gegen den Gegenspieler
  const attrEdge = clamp(0.5 + (skill - challenge.opponent) / 140, 0.12, 0.9);
  const inputWeight = difficulty.inputWeight;
  const success = attrEdge * (1 - inputWeight) + quality * inputWeight;

  if (dev <= window && rng.chance(clamp(success + 0.18, 0.05, 0.96))) {
    return { outcome: 'duelWon', quality, detail: 'Ball sauber erobert' };
  }
  if (timing.offset > window) {
    // Zu spaet: der Gegner ist schon vorbei, es folgt meist ein Foul.
    return rng.chance(clamp(0.65 - player.attrs.discipline / 400, 0.3, 0.85))
      ? { outcome: 'foulCommitted', quality, detail: 'Zu spaet gekommen' }
      : { outcome: 'duelLost', quality, detail: 'Zu spaet gekommen' };
  }
  return { outcome: 'duelLost', quality, detail: 'Zu frueh angegangen' };
}

/**
 * Dribblingbewegungen (Konzept Abschnitt 24).
 * Anspruchsvollere Finten haben ein engeres Zeitfenster, bringen dafuer
 * aber einen deutlichen Vorteil. Sie werden ueber den Dribblingwert freigeschaltet.
 */
export interface DribbleMove {
  key: string;
  name: string;
  description: string;
  /** Ab diesem Dribblingwert verfuegbar. */
  requires: number;
  /** Multiplikator fuer das Zeitfenster. */
  windowScale: number;
  /** Zuschlag auf die Erfolgschance. */
  edge: number;
}

export const DRIBBLE_MOVES: DribbleMove[] = [
  {
    key: 'push', name: 'Ball vorlegen', requires: 0, windowScale: 1.45, edge: -0.07,
    description: 'Einfach und sicher, bringt aber wenig Raumgewinn.',
  },
  {
    key: 'feint', name: 'Koerpertaeuschung', requires: 35, windowScale: 1.15, edge: 0.01,
    description: 'Solide Standardfinte mit gutem Zeitfenster.',
  },
  {
    key: 'stepover', name: 'Uebersteiger', requires: 50, windowScale: 1.0, edge: 0.06,
    description: 'Klassisch und wirkungsvoll, verlangt sauberes Timing.',
  },
  {
    key: 'roll', name: 'Ballrolle', requires: 62, windowScale: 0.88, edge: 0.1,
    description: 'Enges Fenster, dafuer kommst du sofort in den freien Raum.',
  },
  {
    key: 'elastico', name: 'Elastico', requires: 74, windowScale: 0.74, edge: 0.16,
    description: 'Sehr schwer zu verteidigen, verzeiht aber keine Fehler.',
  },
  {
    key: 'heel', name: 'Hackentrick', requires: 84, windowScale: 0.68, edge: 0.19,
    description: 'Nur fuer Ausnahmetechniker. Grosses Risiko, grosse Wirkung.',
  },
];

export function availableMoves(dribbling: number): DribbleMove[] {
  return DRIBBLE_MOVES.filter((m) => dribbling >= m.requires);
}

export function resolveDribble(
  timing: TimingInput, challenge: Challenge, player: Player,
  difficulty: DifficultySettings, rng: Rng, move?: DribbleMove,
): ChallengeResult {
  const skill = player.attrs.dribbling * 0.45 + player.attrs.agility * 0.2
    + player.attrs.balance * 0.15 + player.attrs.ballControl * 0.2;
  const window = (0.12 + skill / 480) * difficulty.targetSize * (move?.windowScale ?? 1);
  const dev = Math.abs(timing.offset);
  const quality = clamp(1 - dev / (window * 2.4), 0, 1);

  const attrEdge = clamp(
    0.45 + (skill - challenge.opponent) / 130 + (move?.edge ?? 0), 0.1, 0.92,
  );
  const success = attrEdge * (1 - difficulty.inputWeight) + quality * difficulty.inputWeight;

  if (rng.chance(clamp(success, 0.04, 0.95))) {
    return {
      outcome: 'dribbleWon', quality,
      detail: move ? `${move.name} sitzt` : 'Gegenspieler ausgespielt',
    };
  }
  if (rng.chance(0.22)) {
    return { outcome: 'foulSuffered', quality, detail: 'Der Gegner kommt zu spaet - Freistoss' };
  }
  return {
    outcome: 'dribbleLost', quality,
    detail: dev > window * 1.6
      ? (timing.offset > 0 ? 'Zu spaet angesetzt' : 'Zu frueh angesetzt')
      : 'Der Verteidiger liest die Bewegung',
  };
}

// --- Torwartszene aus Sicht des eigenen Spielers -----------------------

export interface SaveInput {
  /** Gewaehlte Sprungrichtung in Metern relativ zur Tormitte. */
  diveX: number;
  /** Gewaehlte Hoehe in Metern. */
  diveZ: number;
  /** Abweichung vom idealen Absprungzeitpunkt in Sekunden. */
  timing: number;
}

export interface SaveResolution {
  outcome: ChallengeOutcome;
  quality: number;
  crossing: { x: number; z: number };
  flight: Flight;
}

export function resolveSave(
  input: SaveInput, challenge: Challenge, keeper: Player,
  difficulty: DifficultySettings, rng: Rng,
): SaveResolution {
  // Der Schuss wird aus der Sicht des Torwarts erzeugt.
  const shooterQuality = challenge.opponent;
  const aimX = clamp(rng.normal(0, GOAL_HALF_WIDTH * 0.55), -GOAL_HALF_WIDTH * 1.15, GOAL_HALF_WIDTH * 1.15);
  const contactY = rng.float(-0.55, 0.3);
  const contactX = (challenge.incoming?.curve ?? 0) * 0.8;
  const power = clamp(0.45 + shooterQuality / 220 + rng.float(-0.12, 0.2), 0.25, 1);

  const flight = simulateBallFlight({
    startX: challenge.offset,
    startY: challenge.distance,
    aimX,
    aimY: 0,
    power,
    contactX,
    contactY,
    shotPower: challenge.incoming?.power ?? 70,
    curve: Math.abs(contactX) * 100,
  });

  const crossing = flight.crossing ?? { x: aimX, z: 1, t: 0.5, speed: 25 };
  const onTarget = Math.abs(crossing.x) < GOAL_HALF_WIDTH && crossing.z < CROSSBAR;

  if (!onTarget) {
    return { outcome: 'saveMade', quality: 0.5, crossing, flight };
  }

  const skill = keeper.attrs.reflexes * 0.4 + keeper.attrs.agility * 0.2
    + keeper.attrs.gkPositioning * 0.2 + keeper.attrs.handling * 0.2;

  // Reichweite um die gewaehlte Sprungposition
  const timingPenalty = clamp(1 - Math.abs(input.timing) / 0.35, 0, 1);
  const reach = (0.85 + skill / 62) * difficulty.targetSize * (0.55 + timingPenalty * 0.55);
  const dx = Math.abs(crossing.x - input.diveX);
  const dz = Math.abs(crossing.z - input.diveZ);
  const dist = Math.hypot(dx, dz * 1.25);

  const quality = clamp(1 - dist / (reach * 2.2), 0, 1) * 0.7 + timingPenalty * 0.3;

  const speedPenalty = crossing.speed > 25 ? (crossing.speed - 25) * 0.03 : 0;
  const reachable = dist <= Math.max(0.3, reach - speedPenalty);

  if (reachable) {
    const caught = rng.chance(clamp(0.3 + keeper.attrs.handling / 250 - crossing.speed / 120, 0.05, 0.8));
    return { outcome: caught ? 'caught' : 'saveMade', quality, crossing, flight };
  }
  return { outcome: 'goalConceded', quality, crossing, flight };
}

// --- Automatische Aufloesung (Simulationsmodus) ------------------------

/**
 * Loest eine Situation ohne Zutun des Spielers auf.
 * Wird verwendet, wenn der Nutzer das Spiel simulieren laesst.
 */
export function autoResolveChallenge(
  challenge: Challenge, player: Player, _difficulty: DifficultySettings, rng: Rng,
): ChallengeResult {
  switch (challenge.kind) {
    case 'duel': case 'interception': {
      const skill = player.attrs.tackling * 0.5 + player.attrs.anticipation * 0.3
        + player.attrs.defPositioning * 0.2;
      const p = clamp(0.42 + (skill - challenge.opponent) / 150, 0.12, 0.85);
      if (rng.chance(p)) return { outcome: 'duelWon', quality: 0.5 };
      return rng.chance(0.3)
        ? { outcome: 'foulCommitted', quality: 0.35 }
        : { outcome: 'duelLost', quality: 0.35 };
    }
    case 'dribble': {
      const skill = player.attrs.dribbling * 0.6 + player.attrs.agility * 0.4;
      const p = clamp(0.4 + (skill - challenge.opponent) / 150, 0.1, 0.88);
      return rng.chance(p)
        ? { outcome: 'dribbleWon', quality: 0.5 }
        : { outcome: 'dribbleLost', quality: 0.35 };
    }
    case 'pass': case 'throughBall': case 'cross': {
      const skill = player.attrs.shortPass * 0.5 + player.attrs.vision * 0.5;
      const p = clamp(0.5 + skill / 260 - challenge.pressure * 0.25, 0.2, 0.94);
      const target = challenge.targets?.[0];
      return rng.chance(p)
        ? { outcome: 'passCompleted', quality: 0.5, targetId: target?.id }
        : { outcome: 'passLost', quality: 0.3, targetId: target?.id };
    }
    case 'save': case 'penaltySave': {
      const skill = player.attrs.reflexes * 0.5 + player.attrs.gkPositioning * 0.3
        + player.attrs.handling * 0.2;
      const base = challenge.kind === 'penaltySave' ? 0.2 : clamp(1 - challenge.xg * 1.5, 0.25, 0.9);
      const p = clamp(base + skill / 400, 0.08, 0.93);
      return rng.chance(p)
        ? { outcome: rng.chance(0.4) ? 'caught' : 'saveMade', quality: 0.5 }
        : { outcome: 'goalConceded', quality: 0.3 };
    }
    default: {
      // Abschluesse
      const finishing = challenge.kind === 'header' ? player.attrs.heading
        : challenge.kind === 'penalty' ? player.attrs.penalties
        : challenge.kind === 'longShot' ? player.attrs.longShots
        : player.attrs.finishing;
      const goalProb = challenge.kind === 'penalty'
        ? clamp(0.6 + finishing / 320, 0.45, 0.92)
        : clamp(challenge.xg * (0.75 + finishing / 180) * (1.25 - challenge.keeper / 210), 0.02, 0.9);
      if (rng.chance(goalProb)) return { outcome: 'goal', quality: 0.5 };
      const r = rng.next();
      if (r < 0.4) return { outcome: 'saved', quality: 0.4 };
      if (r < 0.78) return { outcome: 'offTarget', quality: 0.3 };
      if (r < 0.93) return { outcome: 'blocked', quality: 0.35 };
      return { outcome: 'post', quality: 0.45 };
    }
  }
}

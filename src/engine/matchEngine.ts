/**
 * Interaktiver Spielmotor (Konzept Abschnitt 20 und 27).
 * Simuliert Minute fuer Minute und haelt an, sobald der eigene Spieler
 * eine Schluesselsituation hat, die selbst gespielt werden kann.
 */
import { CARD_SHARE, refereeEffect, type RefereeStyle } from './referee';
import {
  claimsFreeKicks, claimsPenalties, type SetPieceClaim,
} from './choices';
import type { TraitEffect } from './traits';
import { Schwung } from './tempo';
import { weatherEffect, type Weather } from './weather';
import {
  defensiveSkill, keeperSkill, tempo, POSITION_LINE, effectiveOverall,
  type KeeperSituation,
} from './attributes';
import { GOAL_HALF_WIDTH } from './ballAction';
import type { Lineup } from './lineup';
import {
  computeRating, expectedGoals, finishingModifier, keeperModifier,
  pickCreator, pickShooter, type OnPitchPlayer,
} from './matchSim';
import type {
  Challenge, ChallengeResult, ChallengeTarget, LiveEvent, StepResult,
} from './matchTypes';
import { t, tVariant } from '../i18n';
import type { MatchImportance } from './rivalry';
import { Rng, clamp } from './rng';
import {
  emptyMatchStats, type Club, type DifficultySettings, type Id, type Player,
  type PlayerMatchStats,
} from './types';

type Side = 'home' | 'away';

export interface MatchEngineSetup {
  matchId: Id;
  competitionName: string;
  homeClub: Club;
  awayClub: Club;
  homeLineup: Lineup;
  awayLineup: Lineup;
  homeSquad: Player[];
  awaySquad: Player[];
  userPlayerId: Id | null;
  /** Highlights selbst spielen oder alles simulieren lassen. */
  interactive: boolean;
  /**
   * 'own' zeigt nur Situationen mit Ballaktion des eigenen Spielers.
   * 'all' bindet den Spieler zusaetzlich ohne Ball ein: mehr Zweikaempfe und
   *  Klaerungen gegnerischer Grosschancen (Konzept Abschnitt 20.3).
   */
  highlightMode?: 'own' | 'all';
  difficulty: DifficultySettings;
  rng: Rng;
  neutral?: boolean;
  /** K.-o.-Spiel: Verlaengerung und Elfmeterschiessen bei Gleichstand. */
  knockout?: boolean;
  /** Beziehungen des eigenen Spielers: gute Freunde werden oefter angespielt. */
  relationships?: Record<Id, number>;
  /** Bedeutung der Partie: Derby, Spitzenspiel, Pokal (Konzept Abschnitt 26). */
  importance?: MatchImportance;
  /** Erwartete Zuschauerzahl - fuer die Atmosphaere in den Szenen. */
  attendance?: number;
  /** Wetter am Spieltag. Faerbt Zielgenauigkeit, Fernschuesse und Kraft. */
  weather?: Weather;
  /** Anstosszeit als Text, und ob unter Flutlicht gespielt wird. */
  kickoff?: { text: string; flutlicht: boolean };
  /** Spielart des Schiedsrichters: Pfiffe, Karten, Naehe zum Publikum. */
  refereeStyle?: RefereeStyle;
  /**
   * Verletzungsrisiko des eigenen Spielers aus seinen Entscheidungen.
   *
   * Lebensweise und Zusatzeinheiten wirken auch auf dem Platz - sonst
   * waere "auch mal aus" im Spiel folgenlos.
   */
  ownInjuryRisk?: number;
  /**
   * Welche Standards der eigene Spieler fuer sich beansprucht.
   *
   * Wer sie einfordert, tritt auch dann an, wenn er nicht der beste
   * Schuetze ist - der Trainer laesst ihn, solange der Abstand ertraeglich
   * bleibt. Weit darunter kostet es die Kabine.
   */
  setPieceClaim?: SetPieceClaim;
  /**
   * Wirkung der erworbenen Staerken des eigenen Spielers.
   *
   * Klein gehalten: eine Staerke soll ihn an einer Stelle erkennbar
   * machen, nicht die Physik aushebeln.
   */
  traits?: TraitEffect;
}

export interface MatchOutcome {
  homeScore: number;
  awayScore: number;
  extraTime: boolean;
  penalties: [number, number] | null;
  stats: PlayerMatchStats[];
  events: LiveEvent[];
  injuries: { playerId: Id; days: number }[];
  fitnessAfter: Record<Id, number>;
  motmId: Id | null;
  /** Durchschnittliche Eingabequalitaet des Nutzers, 0-1. */
  userInputQuality: number | null;
  /** Moraleffekt der Halbzeitentscheidung, nach dem Spiel anzuwenden. */
  halftimeMoraleDelta: number;
}

/** Aufsummierte Mannschaftswerte fuer den Team-Vergleich im Spielbericht. */
export interface TeamStatTotals {
  shots: number;
  shotsOnTarget: number;
  passes: number;
  passesCompleted: number;
  fouls: number;
  cards: number;
}

interface PendingContext {
  type: 'shot' | 'longShot' | 'header' | 'oneOnOne' | 'pass' | 'cross' | 'duel'
    | 'save' | 'penalty' | 'freeKick' | 'dribble' | 'block';
  attackingSide: Side;
  xg: number;
  distance: number;
  offset: number;
  shooterId?: Id;
  assistId?: Id;
  targets?: ChallengeTarget[];
  /** Bei Torwartszenen: wer schiesst. */
  opponentId?: Id;
  /** Bei einer Klaerung: Daten, um den Schuss fortzusetzen, falls sie misslingt. */
  blockKind?: string;
  blockBigChance?: boolean;
  blockInputBonus?: number;
}

const ATTACK_PROB = 0.40;
/** Obergrenze selbst gespielter Situationen je Modus, damit ein Spiel zuegig bleibt. */
/**
 * Wie oft ein Spieler auf diesem Platz aussen durchkommt und flankt.
 *
 * Ausgelagert und ausgefuehrt, damit der Rauchtest die Regel selbst
 * pruefen kann. Ueber die Aufstellung ginge das nicht: welchen Platz der
 * Trainer vergibt, haengt am ganzen Kader - gemessen stand ein
 * Rechtsaussen mit Bestwerten in fuenf von fuenf Spielen als
 * Linksverteidiger auf dem Platz, und ein junger Spieler sitzt ohnehin
 * auf der Bank.
 *
 * Zentrale Plaetze bekommen bewusst einen kleinen Wert statt null: Auch
 * ein Zehner bringt gelegentlich einen Ball von halbrechts herein.
 */
export const CROSS_CHANCE_TABELLE: Partial<Record<string, number>> = {
  LA: 0.45, RA: 0.45, LV: 0.26, RV: 0.26, OM: 0.06, ZM: 0.03,
};

const MAX_USER_CHALLENGES_OWN = 8;
const MAX_USER_CHALLENGES_ALL = 12;

/** Spielausrichtung des eigenen Spielers waehrend der Partie. */
export type Mentality = 'attack' | 'balanced' | 'contain' | 'conserve';

/** Katalogschluessel je Ausrichtung - uebersetzt wird bei der Anzeige. */
export const MENTALITY_LABELS: Record<Mentality, string> = {
  attack: 'me.stance.attack',
  balanced: 'me.stance.balanced',
  contain: 'me.stance.contain',
  conserve: 'me.stance.conserve',
};

interface MentalityEffect {
  /** Faktor auf offensive Beteiligung (Dribbling, Abschluss suchen). */
  attack: number;
  /** Faktor auf defensive Beteiligung (Zweikaempfe, Klaerungen). */
  defend: number;
  /** Faktor auf den Fitnessverbrauch. */
  effort: number;
}

/**
 * Wie stark der eigene Spieler bei ausbalancierter Ausrichtung in Szenen
 * gezogen wird. 0 hiesse: einer von elf - dann bleiben zu wenige Momente
 * uebrig, um eine Partie selbst zu praegen.
 */
const USER_FOCUS = 0.16;

const MENTALITY_EFFECTS: Record<Mentality, MentalityEffect> = {
  attack: { attack: 1.55, defend: 0.6, effort: 1.25 },
  balanced: { attack: 1.0, defend: 1.0, effort: 1.0 },
  contain: { attack: 0.55, defend: 1.5, effort: 1.1 },
  conserve: { attack: 0.5, defend: 0.6, effort: 0.68 },
};

/** Eine waehlbare Reaktion auf die Traineransprache in der Halbzeit. */
export interface HalftimeOption {
  id: string;
  label: string;
  description: string;
  /** Faktoren auf Angriff und Abwehr des eigenen Teams in der zweiten Haelfte. */
  attackMod: number;
  defenceMod: number;
  /** Zusaetzlicher Kraftaufwand des Teams in der zweiten Haelfte. */
  effortMod: number;
  /** Moralveraenderung des eigenen Spielers (nach dem Spiel wirksam). */
  moraleDelta: number;
  /** Wirkt die Fuehrungsstaerke des Spielers verstaerkend? */
  leadership?: boolean;
}

export interface HalftimeDecision {
  scoreline: [number, number];
  userSide: Side;
  /** Ist der eigene Spieler zur Pause auf dem Platz? */
  onPitch: boolean;
  coachMessage: string;
  options: HalftimeOption[];
}

/** Entscheidung bei einer Verletzung des eigenen Spielers (Abschnitt 37). */
export interface InjuryDecision {
  minute: number;
  /** Voraussichtliche Ausfalldauer bei sofortiger Auswechslung. */
  estimatedDays: number;
  severity: 'leicht' | 'mittel' | 'schwer';
  /** Kann der Spieler noch gewechselt werden? Sonst nur weiterspielen. */
  canSubstitute: boolean;
}

export class MatchEngine {
  readonly setup: MatchEngineSetup;
  minute = 0;
  homeScore = 0;
  awayScore = 0;
  finished = false;
  extraTime = false;
  penalties: [number, number] | null = null;
  events: LiveEvent[] = [];
  pending: Challenge | null = null;

  private rng: Rng;
  private onPitch: Record<Side, OnPitchPlayer[]> = { home: [], away: [] };
  private bench: Record<Side, Player[]> = { home: [], away: [] };
  private stats = new Map<Id, PlayerMatchStats>();
  private liveFitness = new Map<Id, number>();
  private subsUsed: Record<Side, number> = { home: 0, away: 0 };
  private yellows = new Map<Id, number>();
  /**
   * Schwung und Tempo der Partie.
   *
   * Vorher war die Ereignisdichte eine Konstante - Minute 3 und Minute 88
   * gleich wahrscheinlich, in jeder Partie. Damit hatte kein Spiel eine
   * Druckphase, eine zaehe Mitte oder eine wilde Schlussphase.
   */
  private schwung = new Schwung();
  /** In welcher Minute zuletzt eine Phase im Ticker stand. */
  private letztePhasenzeile = -20;
  private sentOff = new Set<Id>();
  private injuries: { playerId: Id; days: number }[] = [];
  private pendingCtx: PendingContext | null = null;
  private fullTime = 90;
  private stoppage = 0;
  private userChallenges = 0;
  private userQualitySum = 0;
  private userQualityCount = 0;
  private squadById = new Map<Id, Player>();
  private mentality: Mentality = 'balanced';
  /** Wartet auf die Halbzeitentscheidung des Spielers. */
  pendingHalftime: HalftimeDecision | null = null;
  private halftimeDone = false;
  private secondHalfAttackMod = 1;
  private secondHalfDefenceMod = 1;
  private secondHalfEffortMod = 1;
  private halftimeMoraleDelta = 0;
  /** Wartet auf die Verletzungsentscheidung des Spielers. */
  pendingInjury: InjuryDecision | null = null;
  private knockDays = 0;
  private aggravationRisk = 0;

  constructor(setup: MatchEngineSetup) {
    this.setup = setup;
    this.rng = setup.rng;
    this.stoppage = this.rng.int(2, 6);
    this.fullTime = 90 + this.stoppage;

    for (const p of [...setup.homeSquad, ...setup.awaySquad]) {
      this.squadById.set(p.id, p);
      this.liveFitness.set(p.id, p.fitness);
    }

    this.initSide('home', setup.homeLineup, setup.homeSquad, setup.homeClub.id);
    this.initSide('away', setup.awayLineup, setup.awaySquad, setup.awayClub.id);
  }

  private initSide(side: Side, lineup: Lineup, squad: Player[], clubId: Id) {
    const byId = new Map(squad.map((p) => [p.id, p]));
    for (const slot of lineup.starters) {
      const player = byId.get(slot.playerId);
      if (!player) continue;
      this.onPitch[side].push({
        player,
        slot: slot.position,
        rating: effectiveOverall(player.attrs, player.position, player.altPositions, slot.position),
      });
      const st = emptyMatchStats(player.id, this.setup.matchId, clubId, slot.position);
      st.started = true;
      this.stats.set(player.id, st);
    }
    this.bench[side] = lineup.bench.map((id) => byId.get(id)).filter(Boolean) as Player[];
  }

  // --- Zugriffshilfen ----------------------------------------------------

  private get allHighlights(): boolean {
    return this.setup.highlightMode === 'all';
  }

  /** Ausrichtung zwischen zwei Situationen aendern. */
  setMentality(m: Mentality) {
    this.mentality = m;
  }

  get currentMentality(): Mentality {
    return this.mentality;
  }

  /**
   * Regulaeres Spielende inklusive Nachspielzeit, nach Verlaengerung 120plus.
   * Die Verlaufsgrafik braucht die Gesamtdauer, um die Zeitachse zu skalieren.
   */
  get scheduledEnd(): number {
    return this.fullTime;
  }

  /** Aktuelle Live-Fitness des eigenen Spielers, fuer Anzeige und Tests. */
  get userLiveFitness(): number {
    const id = this.setup.userPlayerId;
    return id ? this.liveFitness.get(id) ?? 100 : 100;
  }

  /** Aktuelle Halbzeit-Faktoren auf die zweite Haelfte, fuer Tests. */
  get secondHalfMods(): { attack: number; defence: number } {
    return { attack: this.secondHalfAttackMod, defence: this.secondHalfDefenceMod };
  }

  private get attackFactor(): number {
    return MENTALITY_EFFECTS[this.mentality].attack;
  }

  private get defendFactor(): number {
    return MENTALITY_EFFECTS[this.mentality].defend;
  }

  private get maxChallenges(): number {
    return this.allHighlights ? MAX_USER_CHALLENGES_ALL : MAX_USER_CHALLENGES_OWN;
  }

  get userSide(): Side | null {
    const id = this.setup.userPlayerId;
    if (!id) return null;
    if (this.setup.homeSquad.some((p) => p.id === id)) return 'home';
    if (this.setup.awaySquad.some((p) => p.id === id)) return 'away';
    return null;
  }

  get userOnPitch(): OnPitchPlayer | null {
    const id = this.setup.userPlayerId;
    if (!id) return null;
    const side = this.userSide;
    if (!side) return null;
    return this.onPitch[side].find((o) => o.player.id === id) ?? null;
  }

  get userStats(): PlayerMatchStats | null {
    const id = this.setup.userPlayerId;
    return id ? this.stats.get(id) ?? null : null;
  }

  get score(): [number, number] {
    return [this.homeScore, this.awayScore];
  }

  /**
   * Mannschaftswerte beider Teams, aufsummiert aus den Spielerstatistiken.
   * Schuesse/Schuesse aufs Tor sind bereits waehrend des Spiels vollstaendig;
   * das Passvolumen (Ballbesitz) wird erst bei finish() aufgefuellt.
   */
  get teamStats(): { home: TeamStatTotals; away: TeamStatTotals } {
    const empty = (): TeamStatTotals =>
      ({ shots: 0, shotsOnTarget: 0, passes: 0, passesCompleted: 0, fouls: 0, cards: 0 });
    const home = empty();
    const away = empty();
    const homeId = this.setup.homeClub.id;
    for (const s of this.stats.values()) {
      const t = s.clubId === homeId ? home : away;
      t.shots += s.shots;
      t.shotsOnTarget += s.shotsOnTarget;
      t.passes += s.passes;
      t.passesCompleted += s.passesCompleted;
      t.fouls += s.fouls;
      t.cards += s.yellowCards + s.redCards;
    }
    return { home, away };
  }

  private clubId(side: Side): Id {
    return side === 'home' ? this.setup.homeClub.id : this.setup.awayClub.id;
  }

  private clubName(side: Side): string {
    return side === 'home' ? this.setup.homeClub.name : this.setup.awayClub.name;
  }

  private lineup(side: Side): Lineup {
    return side === 'home' ? this.setup.homeLineup : this.setup.awayLineup;
  }

  private other(side: Side): Side {
    return side === 'home' ? 'away' : 'home';
  }

  private statOf(playerId: Id, side: Side, slot: OnPitchPlayer['slot']): PlayerMatchStats {
    let st = this.stats.get(playerId);
    if (!st) {
      st = emptyMatchStats(playerId, this.setup.matchId, this.clubId(side), slot);
      this.stats.set(playerId, st);
    }
    return st;
  }

  private name(playerId: Id): string {
    const p = this.squadById.get(playerId);
    return p ? `${p.firstName.charAt(0)}. ${p.lastName}` : t('me.unknownPlayer');
  }

  private emit(evts: LiveEvent[], e: Omit<LiveEvent, 'score'>) {
    evts.push({ ...e, score: [this.homeScore, this.awayScore] });
  }

  /**
   * Torwartstaerke fuer eine bestimmte Situation.
   *
   * `strengthOf(side).keeper` ist eine einzige Zahl aus der Gesamtstaerke -
   * sieben der zehn Torwartwerte machten damit nirgends einen Unterschied.
   * Hier wird daraus eine situative Zahl: der Grundwert bleibt die Form- und
   * Fitnessgewichtete Staerke, das Profil verschiebt ihn.
   */
  private keeperFor(side: Side, situation: KeeperSituation): number {
    const basis = this.strengthOf(side).keeper;
    const tw = this.onPitch[side].find((o) => o.slot === 'TW');
    if (!tw) return basis;
    const profil = keeperSkill(tw.player.attrs, situation);
    const schnitt = keeperSkill(tw.player.attrs, 'shot');
    // Nur die Abweichung vom eigenen Grundprofil verschiebt den Wert, damit
    // die Gesamtbalance der Torwartstaerke unangetastet bleibt.
    return clamp(basis + (profil - schnitt) * 0.8, 10, 99);
  }

  /** Aktuelle Mannschaftsstaerke unter Beruecksichtigung von Platzverweisen. */
  private strengthOf(side: Side) {
    const base = this.lineup(side);
    const missing = 11 - this.onPitch[side].length;
    const penalty = Math.pow(0.9, Math.max(0, missing));
    // Muedigkeit im Spielverlauf
    const avgFit = this.onPitch[side].reduce(
      (sum, o) => sum + (this.liveFitness.get(o.player.id) ?? 80), 0,
    ) / Math.max(1, this.onPitch[side].length);
    const fitFactor = 0.82 + (avgFit / 100) * 0.18;
    // Die Halbzeitentscheidung wirkt nur auf das eigene Team in der 2. Haelfte.
    const atkMod = side === this.userSide ? this.secondHalfAttackMod : 1;
    const defMod = side === this.userSide ? this.secondHalfDefenceMod : 1;
    return {
      attack: base.attack * penalty * fitFactor * atkMod,
      midfield: base.midfield * penalty * fitFactor * ((atkMod + defMod) / 2),
      defence: base.defence * penalty * fitFactor * defMod,
      keeper: base.keeper,
    };
  }

  // --- Hauptschleife -----------------------------------------------------

  /** Eine Spielminute weiterrechnen. Neue Ereignisse landen auch in this.events. */
  step(): StepResult {
    const result = this.stepInternal();
    if (result.events.length > 0) this.events.push(...result.events);
    return result;
  }

  private stepInternal(): StepResult {
    if (this.finished) {
      return { events: [], pending: null, finished: true, minute: this.minute };
    }
    if (this.pending || this.pendingHalftime || this.pendingInjury) {
      return { events: [], pending: this.pending, finished: false, minute: this.minute };
    }

    const evts: LiveEvent[] = [];

    if (this.minute === 0) {
      this.emit(evts, {
        minute: 0, type: 'kickoff', side: null,
        text: tVariant('live.kickoff', this.rng.next(), { home: this.setup.homeClub.name, away: this.setup.awayClub.name })
          + (this.setup.kickoff?.flutlicht
            ? ' ' + tVariant('live.floodlight', this.rng.next())
            : '')
          + (this.setup.weather
            ? ' ' + tVariant(`live.weather.${this.setup.weather}`, this.rng.next())
            : ''),
      });
    }

    this.minute++;
    this.drainFitness();

    if (this.minute === 46) {
      this.emit(evts, {
        minute: 45, type: 'halftime', side: null,
        text: tVariant('live.halftime', this.rng.next(), { score: `${this.homeScore}:${this.awayScore}` }),
      });
      // Bei einem interaktiven Spiel entscheidet der Spieler in der Pause.
      if (this.setup.interactive && this.userSide && !this.halftimeDone) {
        this.pendingHalftime = this.buildHalftimeDecision(this.userSide);
        this.halftimeDone = true;
        return { events: evts, pending: null, finished: false, minute: this.minute };
      }
    }

    if ([46, 58, 64, 70, 76, 82, 100, 110].includes(this.minute)) {
      this.considerSubstitutions('home', evts);
      this.considerSubstitutions('away', evts);
    }

    // Der Schwung laeuft weiter, bevor irgendetwas gewuerfelt wird.
    this.schwung.tick(this.rng);
    this.meldePhase(evts);
    this.rollEcke(evts);

    this.rollDiscipline(evts);
    this.rollInjury(evts);
    if (this.pendingInjury) {
      return { events: evts, pending: null, finished: false, minute: this.minute };
    }
    this.rollAggravation(evts);

    // Elfmeter sind selten und werden gesondert behandelt. Die 0.55 waren
    // schon immer eine stille Heimneigung - jetzt haengt sie am Mann und an
    // der Kulisse statt fest im Code zu stehen.
    if (this.rng.chance(0.0026)) {
      const side: Side = this.rng.chance(0.55 + this.heimNeigung()) ? 'home' : 'away';
      this.awardPenalty(side, evts);
      if (this.pending) return { events: evts, pending: this.pending, finished: false, minute: this.minute };
    } else if (this.rng.chance(0.016)) {
      this.awardFreeKick(this.pickAttackingSide(), evts);
      if (this.pending) return { events: evts, pending: this.pending, finished: false, minute: this.minute };
    } else if (this.rng.chance(clamp(
      ATTACK_PROB * this.schwung.dichte(this.minute), 0.08, 0.9))) {
      const side = this.pickAttackingSide();
      this.runAttack(side, evts);
      if (this.pending) return { events: evts, pending: this.pending, finished: false, minute: this.minute };
    }

    if (this.minute >= this.fullTime) {
      this.handleFullTime(evts);
    }

    return { events: evts, pending: null, finished: this.finished, minute: this.minute };
  }

  // --- Halbzeit (Konzept Abschnitt 18 und 29) ---------------------------

  /** Erstellt die Traineransprache und die Antwortoptionen nach Spielstand. */
  private buildHalftimeDecision(side: Side): HalftimeDecision {
    const own = side === 'home' ? this.homeScore : this.awayScore;
    const opp = side === 'home' ? this.awayScore : this.homeScore;
    const diff = own - opp;
    const onPitch = !!this.userOnPitch;

    let coachMessage: string;
    let options: HalftimeOption[];

    const pushOption: HalftimeOption = {
      id: 'push', label: t('me.ht.push.label'),
      description: t('me.ht.push.desc'),
      attackMod: 1.16, defenceMod: 0.9, effortMod: 1.2, moraleDelta: 1,
    };
    const holdOption: HalftimeOption = {
      id: 'hold', label: t('me.ht.hold.label'),
      description: t('me.ht.hold.desc'),
      attackMod: 0.9, defenceMod: 1.15, effortMod: 1.0, moraleDelta: 0,
    };
    const balancedOption: HalftimeOption = {
      id: 'balanced', label: t('me.ht.balanced.label'),
      description: t('me.ht.balanced.desc'),
      attackMod: 1.0, defenceMod: 1.0, effortMod: 1.0, moraleDelta: 0,
    };
    const rallyOption: HalftimeOption = {
      id: 'rally', label: t('me.ht.rally.label'),
      description: t('me.ht.rally.desc'),
      attackMod: 1.1, defenceMod: 1.05, effortMod: 1.05, moraleDelta: 3, leadership: true,
    };

    if (diff > 0) {
      coachMessage = diff >= 2
        ? tVariant('me.ht.leadBig', this.rng.next())
        : tVariant('me.ht.leadNarrow', this.rng.next());
      options = [holdOption, balancedOption, pushOption, rallyOption];
    } else if (diff < 0) {
      coachMessage = diff <= -2
        ? tVariant('me.ht.behindBig', this.rng.next())
        : tVariant('me.ht.behindNarrow', this.rng.next());
      options = [pushOption, rallyOption, balancedOption, holdOption];
    } else {
      coachMessage = tVariant('me.ht.level', this.rng.next());
      options = [balancedOption, pushOption, holdOption, rallyOption];
    }

    return { scoreline: [this.homeScore, this.awayScore], userSide: side, onPitch, coachMessage, options };
  }

  /** Wendet die gewaehlte Halbzeitreaktion an und setzt das Spiel fort. */
  resolveHalftime(optionId: string): LiveEvent[] {
    const decision = this.pendingHalftime;
    this.pendingHalftime = null;
    if (!decision) return [];
    const option = decision.options.find((o) => o.id === optionId) ?? decision.options[0];

    let attackMod = option.attackMod;
    let defenceMod = option.defenceMod;
    let morale = option.moraleDelta;

    // Fuehrungsstaerke verstaerkt eine Ansprache - oder laesst sie verpuffen.
    if (option.leadership) {
      const leader = this.userOnPitch?.player
        ?? this.squadById.get(this.setup.userPlayerId ?? '');
      const lead = leader?.attrs.leadership ?? 40;
      const factor = (lead - 55) / 100; // -0.5 .. +0.45
      attackMod += factor * 0.14;
      defenceMod += factor * 0.08;
      morale += Math.round(factor * 4);
    }

    this.secondHalfAttackMod = clamp(attackMod, 0.8, 1.35);
    this.secondHalfDefenceMod = clamp(defenceMod, 0.8, 1.35);
    this.secondHalfEffortMod = option.effortMod;
    this.halftimeMoraleDelta = clamp(morale, -3, 6);

    const evts: LiveEvent[] = [];
    this.emit(evts, {
      minute: this.minute, type: 'note', side: decision.userSide, user: true,
      text: t('live.halftimeChoice', { choice: option.label }),
    });
    this.events.push(...evts);
    return evts;
  }

  private handleFullTime(evts: LiveEvent[]) {
    const drawn = this.homeScore === this.awayScore;
    if (this.setup.knockout && drawn && !this.extraTime) {
      this.extraTime = true;
      this.fullTime = 120 + this.rng.int(1, 4);
      this.emit(evts, {
        minute: this.minute, type: 'extraTime', side: null,
        text: t('live.extraTime'),
      });
      return;
    }
    if (this.setup.knockout && drawn && this.extraTime) {
      this.emit(evts, {
        minute: this.minute, type: 'shootout', side: null,
        text: t('live.shootout'),
      });
    }
    this.emit(evts, {
      minute: this.minute, type: 'fulltime', side: null,
      text: tVariant('live.fulltime', this.rng.next(), { home: this.setup.homeClub.name, away: this.setup.awayClub.name, score: `${this.homeScore}:${this.awayScore}` }),
    });
    this.finished = true;
  }

  private drainFitness() {
    const userId = this.setup.userPlayerId;
    const effort = MENTALITY_EFFECTS[this.mentality].effort;
    for (const side of ['home', 'away'] as Side[]) {
      // Eine offensive Halbzeitansage kostet das ganze eigene Team mehr Kraft.
      const teamEffort = side === this.userSide ? this.secondHalfEffortMod : 1;
      for (const o of this.onPitch[side]) {
        const stamina = o.player.attrs.stamina;
        // Hitze zehrt deutlich, Kaelte kaum - deshalb haengt der Verbrauch
        // mit am Wetter.
        let drain = (0.28 + (100 - stamina) / 100 * 0.3) * teamEffort
          * this.wetter.stamina;
        // Die eigene Ausrichtung steuert, wie viel Kraft der Spieler laesst.
        if (o.player.id === userId) drain *= effort;
        const current = this.liveFitness.get(o.player.id) ?? 90;
        this.liveFitness.set(o.player.id, clamp(current - drain, 10, 100));
        const st = this.stats.get(o.player.id);
        if (st) st.minutes++;
      }
    }
  }

  /**
   * Wie voll das Stadion ist, 0 bis 1.
   *
   * Ohne Angabe eine mittelgut besuchte Partie - so bleibt der Wert auch
   * dann brauchbar, wenn die Partie ohne Zuschauerzahl aufgesetzt wurde.
   */
  private auslastung(): number {
    const platz = this.setup.homeClub.stadiumCapacity;
    if (this.setup.attendance == null || !platz) return 0.6;
    return clamp(this.setup.attendance / platz, 0, 1);
  }

  /**
   * Heimvorteil im Ballbesitz.
   *
   * Vorher ein fester Faktor 1.08, der auch auf neutralem Platz griff. Jetzt
   * traegt ihn das Publikum: leeres Rund 1.03, ausverkauft 1.15. Ein
   * Pokalfinale auf neutralem Boden kennt keinen Heimvorteil mehr.
   */
  private heimfaktor(): number {
    if (this.setup.neutral) return 1;
    return 1.03 + this.auslastung() * 0.12;
  }

  private pickAttackingSide(): Side {
    const h = this.strengthOf('home');
    const a = this.strengthOf('away');
    // Staerke, Heimvorteil und der Schwung der Partie zusammen: wer gerade
    // drueber ist, hat den Ball haeufiger.
    const heim = this.heimfaktor() * this.schwung.heimAnteil();
    const homeShare = (h.midfield * heim) / (h.midfield * heim + a.midfield);
    return this.rng.chance(homeShare) ? 'home' : 'away';
  }

  /**
   * Ecken.
   *
   * Im Ticker gab es sie nicht - eine Partie bestand aus Schuessen, Paraden
   * und Fouls, dazwischen nichts. Dabei ist die Ecke der haeufigste
   * Standard ueberhaupt und faerbt eine Druckphase, ohne dass gleich etwas
   * passieren muss.
   */
  private rollEcke(evts: LiveEvent[]) {
    // Wer drueckt, holt mehr Ecken heraus - der Schwung entscheidet mit.
    if (!this.rng.chance(0.05 * this.schwung.dichte(this.minute))) return;
    const side: Side = this.rng.chance(0.5 + this.schwung.wert * 0.3) ? 'home' : 'away';
    this.emit(evts, {
      minute: this.minute, type: 'note', side,
      text: tVariant('live.corner', this.rng.next(), { club: this.clubName(side) }),
    });
    // Aus etwa jeder fuenften Ecke wird eine Kopfballchance.
    if (this.rng.chance(0.22)) {
      this.continueAttack(side, evts, { xgBonus: 1.1, guaranteedShot: true });
    }
  }

  /**
   * Eine Zeile, wenn sich die Partie merklich dreht.
   *
   * Ohne sie waere der Schwung eine Mechanik, die man nur an den Zahlen
   * ablesen koennte. Hoechstens alle zwoelf Minuten, sonst kommentiert der
   * Ticker sich selbst zu Tode.
   */
  private meldePhase(evts: LiveEvent[]) {
    if (this.minute - this.letztePhasenzeile < 12) return;
    if (this.minute < 8 || this.minute > this.fullTime - 2) return;

    const w = this.schwung.wert;
    const tempo = this.schwung.tempo;
    let schluessel: string | null = null;
    let verein = '';

    if (Math.abs(w) > 0.42) {
      schluessel = 'live.phase.pressure';
      verein = this.clubName(w > 0 ? 'home' : 'away');
    } else if (tempo > 1.3) {
      schluessel = 'live.phase.open';
    } else if (tempo < 0.72) {
      schluessel = 'live.phase.quiet';
    }
    if (!schluessel) return;

    this.letztePhasenzeile = this.minute;
    this.emit(evts, {
      minute: this.minute, type: 'note', side: null,
      text: tVariant(schluessel, this.rng.next(), { club: verein }),
    });
  }

  // --- Angriffe ----------------------------------------------------------

  private runAttack(side: Side, evts: LiveEvent[]) {
    const defSide = this.other(side);

    // Defensivhighlight des eigenen Spielers, bevor der Angriff Fahrt aufnimmt.
    if (this.tryDefensiveChallenge(defSide, side)) return;

    // Dribbling des eigenen Spielers im Aufbau (Konzept Abschnitt 24).
    if (this.tryCrossChallenge(side)) return;
    if (this.tryDribbleChallenge(side)) return;

    this.continueAttack(side, evts);
  }

  /**
   * Setzt einen Angriff fort.
   * xgBonus verbessert die Situation, etwa nach einem gelungenen Dribbling
   * oder einem starken Zuspiel. preferShooterId bevorzugt einen Abschlussspieler.
   */
  private continueAttack(
    side: Side, evts: LiveEvent[],
    opts: { xgBonus?: number; preferShooterId?: Id; guaranteedShot?: boolean } = {},
  ) {
    const atk = this.strengthOf(side);
    const def = this.strengthOf(this.other(side));
    const balance = atk.attack / (atk.attack + def.defence);

    // Nicht jeder Angriff endet mit einem Abschluss.
    if (!opts.guaranteedShot && !this.rng.chance(0.26 + balance * 0.58)) {
      this.registerPossessionLoss(side);
      return;
    }

    const chance = this.makeChance(balance, opts.xgBonus ?? 1);
    const squad = this.onPitch[side];
    if (squad.length === 0) return;

    // Nach einem gelungenen Dribbling schliesst meist derselbe Spieler ab.
    const preferred = opts.preferShooterId
      ? squad.find((o) => o.player.id === opts.preferShooterId)
      : undefined;
    let shooter = preferred && this.rng.chance(0.68)
      ? preferred
      : pickShooter(this.rng, squad, chance.kind);
    // Ausrichtung "Nach vorne" schiebt Abschluesse zum eigenen Spieler, "Defensiv"
    // und "Schonen" ueberlassen sie eher den Mitspielern.
    if (!preferred) shooter = this.biasShooterToUser(side, shooter, chance.kind);
    const creator = shooter === preferred
      ? null
      : this.rng.chance(0.66) ? pickCreator(this.rng, squad, shooter.player.id) : null;

    const userId = this.setup.userPlayerId;
    const canInteract = this.setup.interactive
      && this.userSide === side
      && this.userChallenges < this.maxChallenges;

    // Eigener Spieler schliesst ab
    if (canInteract && userId && shooter.player.id === userId) {
      this.startChallenge(this.buildShotChallenge(side, chance, creator?.player.id), {
        type: chance.kind === 'longShot' ? 'longShot' : chance.kind === 'header' ? 'header'
          : chance.kind === 'oneOnOne' ? 'oneOnOne' : 'shot',
        attackingSide: side,
        xg: chance.xg,
        distance: chance.distance,
        offset: chance.offset,
        shooterId: userId,
        assistId: creator?.player.id,
      });
      return;
    }

    // Eigener Spieler legt auf
    if (canInteract && userId && creator && creator.player.id === userId) {
      const targets = this.buildPassTargets(side, shooter);
      // Von aussen wird geflankt, nicht flach aufgelegt.
      //
      // Die Szenenart "cross" gab es bisher nur auf dem Papier: Der
      // Resolver behandelte sie, die Oberflaeche kannte sie - erzeugt hat
      // sie niemand. Ein Aussenspieler bekam dieselbe Szene wie ein
      // Zehner, und `crossing` war ein Attribut ohne Wirkung.
      if (this.flanktVonAussen(userId)) {
        const flanke = this.buildCrossChallenge(side, chance, targets);
        this.startChallenge(flanke, {
          type: 'cross',
          attackingSide: side,
          xg: chance.xg,
          distance: flanke.distance,
          offset: flanke.offset,
          shooterId: shooter.player.id,
          targets,
        });
        return;
      }
      this.startChallenge(this.buildPassChallenge(side, chance, targets), {
        type: 'pass',
        attackingSide: side,
        xg: chance.xg,
        distance: chance.distance,
        offset: chance.offset,
        shooterId: shooter.player.id,
        targets,
      });
      return;
    }

    this.resolveShot(side, shooter, creator, chance, evts, 1);
  }

  /**
   * Verschiebt die Abschlusswahl je nach Ausrichtung Richtung eigener Spieler
   * (oder von ihm weg). Nur wirksam, wenn der Spieler ein plausibler Abschluss-
   * spieler auf dem Feld ist.
   */
  private biasShooterToUser(side: Side, shooter: OnPitchPlayer, kind: 'shot' | 'longShot' | 'header' | 'oneOnOne'): OnPitchPlayer {
    const userId = this.setup.userPlayerId;
    if (!userId || this.userSide !== side) return shooter;
    const user = this.onPitch[side].find((o) => o.player.id === userId);
    if (!user || user.slot === 'TW') return shooter;
    const line = POSITION_LINE[user.slot];
    if (line === 'DEF') return shooter; // Verteidiger schliessen selten ab

    // Grundfokus: Erzaehlt wird die Laufbahn dieses einen Spielers, also sucht
    // er den Abschluss etwas haeufiger als ein beliebiger Mitspieler. Die
    // Ausrichtung verschiebt das nach oben oder unten; defensiv eingestellt
    // faellt der Fokus auf null und der Ball geht wieder an die anderen.
    const swapToUser = clamp(USER_FOCUS + (this.attackFactor - 1) * 0.5, 0, 0.45);
    const swapAway = clamp((1 - this.attackFactor) * 0.5, 0, 0.4);

    if (shooter.player.id !== userId && swapToUser > 0 && this.rng.chance(swapToUser)) {
      return user;
    }
    if (shooter.player.id === userId && swapAway > 0 && this.rng.chance(swapAway)) {
      const others = this.onPitch[side].filter((o) => o.player.id !== userId && o.slot !== 'TW');
      if (others.length) return pickShooter(this.rng, others, kind);
    }
    return shooter;
  }

  private makeChance(balance: number, xgBonus = 1) {
    const roll = this.rng.next();
    let kind: 'shot' | 'longShot' | 'header' | 'oneOnOne';
    let distance: number;

    if (roll < 0.30) { kind = 'longShot'; distance = this.rng.float(19, 32); }
    else if (roll < 0.64) { kind = 'shot'; distance = this.rng.float(12, 19); }
    else if (roll < 0.80) { kind = 'header'; distance = this.rng.float(4, 12); }
    else if (roll < 0.94) { kind = 'shot'; distance = this.rng.float(6, 13); }
    else { kind = 'oneOnOne'; distance = this.rng.float(7, 14); }

    const offset = this.rng.normal(0, distance * 0.42);
    let xg = expectedGoals(distance, offset, kind === 'header');
    if (kind === 'oneOnOne') xg = clamp(xg * 1.9, 0.12, 0.62);
    xg *= 0.72 + balance * 0.6;
    xg *= xgBonus;
    // Aus der Distanz macht das Wetter am meisten aus: ein Ball, der im Wind
    // steht oder auf nassem Rasen aufsetzt, kommt selten dort an, wo er soll.
    if (kind === 'longShot') xg *= this.wetter.longShot;
    xg = clamp(xg, 0.01, 0.82);

    return { kind, distance, offset, xg, bigChance: xg >= 0.27 };
  }

  private registerPossessionLoss(side: Side) {
    const squad = this.onPitch[side];
    if (squad.length === 0) return;
    const o = this.rng.pick(squad);
    const st = this.stats.get(o.player.id);
    if (st) {
      st.possessionLost++;
      st.passes += this.rng.int(0, 2);
      st.passesCompleted += this.rng.int(0, 1);
    }
  }

  /**
   * Statistische Aufloesung eines Abschlusses.
   * inputBonus kommt aus einer erfolgreichen Vorlage des eigenen Spielers.
   */
  private resolveShot(
    side: Side,
    shooter: OnPitchPlayer,
    creator: OnPitchPlayer | null,
    chance: { kind: string; distance: number; offset: number; xg: number; bigChance: boolean },
    evts: LiveEvent[],
    inputBonus: number,
  ) {
    const st = this.statOf(shooter.player.id, side, shooter.slot);
    st.shots++;
    if (chance.bigChance) st.bigChances++;

    // Klaerung durch den eigenen Feldspieler, bevor der Schuss faellt
    // (Konzept Abschnitt 20.3, nur im Modus "Alle Szenen").
    if (this.tryBlockChallenge(side, shooter, creator, chance, inputBonus)) return;

    this.resolveShotOnGoal(side, shooter, creator, chance, inputBonus, evts);
  }

  /**
   * Bietet dem eigenen Feldspieler eine Klaerung an, wenn der Gegner eine
   * gefaehrliche Chance hat. Gibt true zurueck, wenn eine Situation startet.
   */
  private tryBlockChallenge(
    side: Side,
    shooter: OnPitchPlayer,
    creator: OnPitchPlayer | null,
    chance: { kind: string; distance: number; offset: number; xg: number; bigChance: boolean },
    inputBonus: number,
  ): boolean {
    if (!this.allHighlights || !this.setup.interactive) return false;
    if (chance.xg < 0.18) return false;
    const defSide = this.other(side);
    if (this.userSide !== defSide) return false;
    if (this.userChallenges >= this.maxChallenges) return false;
    const user = this.userOnPitch;
    if (!user || user.slot === 'TW') return false;

    // Verteidiger werfen sich haeufig dazwischen, Stuermer kaum.
    const line = POSITION_LINE[user.slot];
    const prob = (line === 'DEF' ? 0.82 : user.slot === 'DM' ? 0.6 : line === 'MID' ? 0.4 : 0.14)
      * this.defendFactor;
    if (!this.rng.chance(prob)) return false;

    this.startChallenge({
      ...this.baseChallenge(defSide, 'duel'),
      title: t('me.ch.clearance.title'),
      hint: t('me.ch.clearance.hint'),
      distance: chance.distance,
      offset: chance.offset,
      pressure: 0.6,
      opponent: shooter.rating,
      xg: chance.xg,
      bigChance: chance.bigChance,
    }, {
      type: 'block',
      attackingSide: side,
      xg: chance.xg,
      distance: chance.distance,
      offset: chance.offset,
      shooterId: shooter.player.id,
      assistId: creator?.player.id,
      blockKind: chance.kind,
      blockBigChance: chance.bigChance,
      blockInputBonus: inputBonus,
    });
    return true;
  }

  /** Aufloesung eines Abschlusses ab dem Genauigkeits-Check. */
  private resolveShotOnGoal(
    side: Side,
    shooter: OnPitchPlayer,
    creator: OnPitchPlayer | null,
    chance: { kind: string; distance: number; offset: number; xg: number; bigChance: boolean },
    inputBonus: number,
    evts: LiveEvent[],
  ) {
    const st = this.statOf(shooter.player.id, side, shooter.slot);
    const defSide = this.other(side);
    // Welche Werte des Torwarts zaehlen, haengt an der Art der Chance.
    const keeperRating = this.keeperFor(
      defSide, (chance.kind as KeeperSituation) ?? 'shot');

    // Ist der Schuss auf dem Tor? Bei Wind, Regen und Schnee seltener.
    const accuracy = (0.32 + shooter.player.attrs.finishing / 230
      + (inputBonus - 1) * 0.18) * this.wetter.accuracy;
    const onTarget = this.rng.chance(clamp(accuracy, 0.2, 0.85));

    if (!onTarget) {
      const blocked = this.rng.chance(0.36);
      if (blocked) {
        const blocker = this.rng.pick(this.onPitch[defSide].filter((o) => o.slot !== 'TW'));
        if (blocker) this.statOf(blocker.player.id, defSide, blocker.slot).blocks++;
      }
      // Nicht jeder Fehlschuss ist gleich weit weg. Ein Pfostentreffer ist
      // der Moment, ueber den nach dem Spiel geredet wird - im Ticker stand
      // dafuer bisher dasselbe "daneben" wie fuer einen Schuss ins Nichts.
      const aluminium = !blocked && this.rng.chance(0.09);
      this.emit(evts, {
        minute: this.minute, type: 'miss', side,
        playerId: shooter.player.id,
        chanceKind: chance.kind,
        text: blocked
          ? tVariant('live.shotBlockedLate', this.rng.next(), { player: this.name(shooter.player.id) })
          : aluminium
            ? tVariant('live.woodwork', this.rng.next(), { player: this.name(shooter.player.id) })
            : tVariant('live.shotWide', this.rng.next(), { player: this.name(shooter.player.id) }),
      });
      return;
    }

    st.shotsOnTarget++;

    // Torwartszene des eigenen Spielers
    const userId = this.setup.userPlayerId;
    if (this.setup.interactive && userId && this.userSide === defSide
      && this.userChallenges < this.maxChallenges) {
      const userPitch = this.userOnPitch;
      if (userPitch && userPitch.slot === 'TW') {
        this.startChallenge(this.buildSaveChallenge(defSide, chance, shooter), {
          type: 'save',
          attackingSide: side,
          xg: chance.xg,
          distance: chance.distance,
          offset: chance.offset,
          shooterId: shooter.player.id,
          assistId: creator?.player.id,
          opponentId: shooter.player.id,
        });
        return;
      }
    }

    // Die Staerken des eigenen Spielers wirken nur auf seine eigenen
    // Abschluesse - ein Kopfballungeheuer macht nicht die ganze Mannschaft
    // kopfballstark.
    const goalProb = clamp(
      chance.xg * finishingModifier(shooter.player) * keeperModifier(keeperRating) * inputBonus
      * this.staerkeFuer(shooter, chance.kind, chance.distance)
      / Math.max(0.25, 0.55),
      0.02, 0.94,
    );

    this.finishShot(side, shooter, creator, goalProb, chance.bigChance, evts,
      chance.kind, chance.distance);
  }

  /** Schliesst einen Abschluss ab: Tor oder Parade des Torhueters. */
  private finishShot(
    side: Side, shooter: OnPitchPlayer, creator: OnPitchPlayer | null,
    goalProb: number, bigChance: boolean, evts: LiveEvent[],
    kind?: string, distance?: number,
  ) {
    if (this.rng.chance(goalProb)) {
      this.scoreGoal(side, shooter, creator, evts, bigChance, kind, distance);
    } else {
      const gk = this.onPitch[this.other(side)].find((o) => o.slot === 'TW');
      if (gk) this.statOf(gk.player.id, this.other(side), 'TW').saves++;
      this.emit(evts, {
        minute: this.minute, type: 'save', side,
        playerId: shooter.player.id,
        chanceKind: kind,
        text: tVariant('live.keeperSave', this.rng.next(), { player: this.name(shooter.player.id) }),
      });
    }
  }

  /**
   * Welche Sorte Torzeile zu dieser Situation passt.
   *
   * Die Angabe lag laengst vor und wurde nur weggeworfen: ein Hammer aus
   * 28 Metern, ein Kopfball und ein Abstauber aus fuenf Metern lasen sich
   * alle als "TOR fuer X! Y."
   */
  private torArt(kind?: string, distance?: number): string {
    const d = distance ?? 16;
    if (kind === 'header') return 'header';
    if (kind === 'oneOnOne') return 'oneOnOne';
    if (kind === 'longShot' || d >= 24) return 'longShot';
    if (d <= 8) return 'close';
    return 'normal';
  }

  private scoreGoal(
    side: Side, shooter: OnPitchPlayer, creator: OnPitchPlayer | null,
    evts: LiveEvent[], bigChance: boolean, kind?: string, distance?: number,
  ) {
    // Ein Tor, das keines war. Selten genug, dass es weh tut, und haeufiger
    // bei Baellen in die Tiefe als bei einem Kopfball aus dem Gewuehl.
    const tiefe = kind === 'oneOnOne' ? 0.075 : 0.028;
    if (this.rng.chance(tiefe)) {
      this.emit(evts, {
        minute: this.minute, type: 'miss', side,
        playerId: shooter.player.id,
        user: shooter.player.id === this.setup.userPlayerId,
        text: tVariant('live.offside', this.rng.next(),
          { player: this.name(shooter.player.id) }),
      });
      return;
    }
    if (side === 'home') this.homeScore++; else this.awayScore++;
    // Wer trifft, macht meistens weiter - und offener wird es sowieso.
    this.schwung.tor(side === 'home');
    const st = this.statOf(shooter.player.id, side, shooter.slot);
    st.goals++;
    if (bigChance) st.bigChancesScored++;
    if (creator) {
      const cs = this.statOf(creator.player.id, side, creator.slot);
      cs.assists++;
      cs.keyPasses++;
    }
    const defSide = this.other(side);
    const gk = this.onPitch[defSide].find((o) => o.slot === 'TW');
    if (gk) this.statOf(gk.player.id, defSide, 'TW').goalsConceded++;

    const assistText = creator
      ? tVariant('live.assistBy', this.rng.next(),
        { player: this.name(creator.player.id) })
      : '';
    this.emit(evts, {
      minute: this.minute, type: 'goal', side,
      playerId: shooter.player.id,
      assistId: creator?.player.id,
      chanceKind: kind,
      user: shooter.player.id === this.setup.userPlayerId,
      text: tVariant(`live.goal.${this.torArt(kind, distance)}`, this.rng.next(),
        {
          club: this.clubName(side),
          scorer: this.name(shooter.player.id),
          assist: assistText,
          m: Math.round(distance ?? 16),
        }),
    });
  }

  // --- Elfmeter ----------------------------------------------------------

  /**
   * Gibt den Ball dem eigenen Spieler, wenn er den Standard beansprucht.
   *
   * Der Trainer laesst ihn schiessen, solange er nicht weiter als
   * `toleranz` hinter dem eigentlichen Schuetzen liegt. Weiter darunter
   * setzt sich niemand durch - und genau deshalb ist die Forderung eine
   * Entscheidung und kein Schalter.
   */
  private beansprucht(
    side: Side, standard: OnPitchPlayer, wert: (p: Player) => number,
    fordert: boolean, toleranz: number,
  ): OnPitchPlayer {
    if (!fordert || this.userSide !== side) return standard;
    const user = this.userOnPitch;
    if (!user || user.slot === 'TW') return standard;
    if (user.player.id === standard.player.id) return standard;
    return wert(user.player) >= wert(standard.player) - toleranz ? user : standard;
  }

  /**
   * Zuschlag aus den Staerken des eigenen Spielers fuer diesen Abschluss.
   *
   * Greift nur, wenn er selbst schiesst - sonst wuerde seine Handschrift
   * auf die ganze Mannschaft abfaerben.
   */
  private staerkeFuer(
    shooter: OnPitchPlayer, kind: string, distance: number,
  ): number {
    if (shooter.player.id !== this.setup.userPlayerId) return 1;
    const s = this.setup.traits;
    if (!s) return 1;
    if (kind === 'header') return s.header;
    if (kind === 'longShot' || distance >= 24) return s.longShot;
    if (distance <= 10) return s.finish;
    return 1;
  }

  private awardPenalty(side: Side, evts: LiveEvent[]) {
    const squad = this.onPitch[side];
    if (squad.length === 0) return;
    let taker = squad.reduce((best, o) =>
      o.player.attrs.penalties > best.player.attrs.penalties ? o : best, squad[0]);
    // Wer den Ball einfordert, bekommt ihn - solange er nicht weit unter
    // dem besten Schuetzen liegt. Vorher trat immer der Beste an, und der
    // Wunsch des Spielers kam nirgends vor.
    taker = this.beansprucht(side, taker, (p) => p.attrs.penalties,
      claimsPenalties(this.setup.setPieceClaim), 12);

    this.emit(evts, {
      minute: this.minute, type: 'penaltyAwarded', side,
      text: tVariant('live.penalty', this.rng.next(), { club: this.clubName(side) }),
    });

    const userId = this.setup.userPlayerId;
    const defSide = this.other(side);

    if (this.setup.interactive && userId && this.userSide === side) {
      const userPitch = this.userOnPitch;
      // Der eigene Spieler tritt an, wenn er der beste Schuetze auf dem Platz ist.
      if (userPitch && (taker.player.id === userId
        || userPitch.player.attrs.penalties >= taker.player.attrs.penalties - 4)) {
        this.startChallenge(this.buildPenaltyChallenge(side), {
          type: 'penalty', attackingSide: side, xg: 0.78, distance: 11, offset: 0,
          shooterId: userId,
        });
        return;
      }
    }

    if (this.setup.interactive && userId && this.userSide === defSide) {
      const userPitch = this.userOnPitch;
      if (userPitch && userPitch.slot === 'TW') {
        this.startChallenge(this.buildPenaltySaveChallenge(defSide, taker), {
          type: 'save', attackingSide: side, xg: 0.78, distance: 11, offset: 0,
          shooterId: taker.player.id, opponentId: taker.player.id,
        });
        return;
      }
    }

    const st = this.statOf(taker.player.id, side, taker.slot);
    st.shots++; st.shotsOnTarget++;
    const success = this.rng.chance(clamp(0.62 + taker.player.attrs.penalties / 330, 0.5, 0.92));
    if (success) {
      st.penaltiesScored++;
      this.scoreGoal(side, taker, null, evts, true);
    } else {
      st.penaltiesMissed++;
      this.emit(evts, {
        minute: this.minute, type: 'penaltyMiss', side,
        playerId: taker.player.id,
        text: tVariant('live.penaltyMissed', this.rng.next(), { player: this.name(taker.player.id) }),
      });
    }
  }

  // --- Dribbling (Konzept Abschnitt 24) ---------------------------------

  /** Chance je Position, dass der eigene Spieler in ein Dribbling geraet. */
  private static DRIBBLE_CHANCE: Partial<Record<string, number>> = {
    LA: 0.20, RA: 0.20, OM: 0.16, ST: 0.12, ZM: 0.07, DM: 0.04,
    LV: 0.07, RV: 0.07, IV: 0.02,
  };

  /** Wie oft ein Spieler auf dieser Position aussen durchkommt. */
  // Ein Spiel gibt dem Nutzer acht Szenen. Bei 0,17 kam ein Rechtsaussen
  // in dreissig Spielen auf zehn Flanken - fuenf Prozent seiner Momente,
  // fuer seine Hauptaufgabe zu wenig.
  private static readonly CROSS_CHANCE = CROSS_CHANCE_TABELLE;

  /**
   * Der eigene Spieler kommt aussen durch und flankt.
   *
   * Eigener Ausloeser, nicht bloss eine Spielart der Vorlage: Am
   * Vorlagenzweig allein haengend kam die Flanke in dreissig Spielen genau
   * einmal vor, weil ein Fluegelspieler selten der ausgewiesene
   * Vorbereiter einer Grosschance ist. Aussen durchzukommen ist aber kein
   * seltener Ausnahmefall, sondern seine Hauptaufgabe.
   */
  private tryCrossChallenge(side: Side): boolean {
    if (!this.setup.interactive) return false;
    if (this.userSide !== side) return false;
    if (this.userChallenges >= this.maxChallenges) return false;
    const user = this.userOnPitch;
    if (!user || user.slot === 'TW') return false;

    const base = MatchEngine.CROSS_CHANCE[user.slot] ?? 0;
    if (base <= 0) return false;
    // Wer flanken kann und schnell ist, kommt oefter in die Lage dazu.
    const koennen = 0.6
      + (user.player.attrs.crossing * 0.6 + tempo(user.player.attrs) * 0.4) / 130;
    if (!this.rng.chance(clamp(base * koennen * this.attackFactor, 0.01, 0.42))) {
      return false;
    }

    const abnehmer = this.onPitch[side]
      .filter((o) => o.slot !== 'TW' && o.player.id !== this.setup.userPlayerId);
    if (abnehmer.length === 0) return false;
    // Wer im Strafraum wartet: Stuermer zuerst, dann wer sonst mit vorn ist.
    const vorne = abnehmer.filter((o) => o.slot === 'ST' || o.slot === 'OM');
    const bester = vorne.length
      ? this.rng.weighted(vorne, (o) => 1 + o.player.attrs.heading / 40)
      : this.rng.pick(abnehmer);
    const targets = this.buildPassTargets(side, bester);

    // Aus dem Lauf heraus, ohne dass vorher eine Grosschance stand: die
    // Torgefahr entsteht erst durch die Flanke selbst.
    const lage = {
      distance: this.rng.float(6, 18),
      offset: 0,
      xg: clamp(this.rng.float(0.05, 0.16) * this.attackFactor, 0.03, 0.3),
      bigChance: false,
    };
    const flanke = this.buildCrossChallenge(side, lage, targets);
    this.startChallenge(flanke, {
      type: 'cross',
      attackingSide: side,
      xg: lage.xg,
      distance: flanke.distance,
      offset: flanke.offset,
      shooterId: bester.player.id,
      targets,
    });
    return true;
  }

  private tryDribbleChallenge(side: Side): boolean {
    if (!this.setup.interactive) return false;
    if (this.userSide !== side) return false;
    if (this.userChallenges >= this.maxChallenges) return false;
    const user = this.userOnPitch;
    if (!user || user.slot === 'TW') return false;

    const base = MatchEngine.DRIBBLE_CHANCE[user.slot] ?? 0.03;
    // Gute Dribbler kommen haeufiger in solche Situationen - und schnelle,
    // denn wer sich loest, hat den Zweikampf ueberhaupt erst.
    const skillFactor = 0.6
      + (user.player.attrs.dribbling * 0.6 + tempo(user.player.attrs) * 0.4) / 125;
    if (!this.rng.chance(clamp(base * skillFactor * this.attackFactor, 0.01, 0.5))) return false;

    const defenders = this.onPitch[this.other(side)].filter((o) => o.slot !== 'TW');
    if (defenders.length === 0) return false;
    const opponent = this.rng.pick(defenders);

    // Ein antrittsschneller Angreifer gegen einen langsamen Verteidiger hat
    // es leichter. Im Modell stand davon nichts: nur die Gesamtstaerke des
    // Gegenspielers zaehlte, egal wie die beiden zueinander passen.
    const tempoVorteil = clamp(
      (tempo(user.player.attrs) - tempo(opponent.player.attrs)) * 0.25, -12, 12);
    const gegner = clamp(opponent.rating - tempoVorteil, 10, 99);

    const distance = this.rng.float(14, 34);
    const offset = this.rng.normal(0, 12);

    this.startChallenge({
      ...this.baseChallenge(side, 'dribble'),
      title: t('me.ch.dribble.title'),
      hint: t('me.ch.dribble.hint'),
      distance,
      offset,
      pressure: this.withImportance(clamp(0.35 + gegner / 180, 0.2, 0.95)),
      opponent: gegner,
      xg: 0,
      bigChance: false,
    }, {
      type: 'dribble',
      attackingSide: side,
      xg: 0,
      distance,
      offset,
      opponentId: opponent.player.id,
    });
    return true;
  }

  // --- Freistoesse (Konzept Abschnitt 22 und 64) ------------------------

  private awardFreeKick(side: Side, evts: LiveEvent[]) {
    const squad = this.onPitch[side];
    if (squad.length === 0) return;

    const distance = this.rng.float(17, 31);
    const offset = this.rng.normal(0, 9);
    const wall = clamp(Math.round(5 - Math.abs(offset) / 9), 2, 5);

    // Die beiden besten Schuetzen der Mannschaft teilen sich die Standards.
    const ranked = squad.slice().sort(
      (a, b) => b.player.attrs.freeKicks - a.player.attrs.freeKicks);
    const taker = this.beansprucht(side, ranked[0], (p) => p.attrs.freeKicks,
      claimsFreeKicks(this.setup.setPieceClaim), 8);

    this.emit(evts, {
      minute: this.minute, type: 'note', side,
      text: tVariant('live.freeKick', this.rng.next(), { club: this.clubName(side), m: Math.round(distance) }),
    });

    const userId = this.setup.userPlayerId;
    if (this.setup.interactive && userId && this.userSide === side
      && this.userChallenges < this.maxChallenges) {
      const user = this.userOnPitch;
      // Wer zu den beiden besten Schuetzen gehoert, darf antreten.
      // Ueber das Freistosstraining laesst sich dieser Platz erarbeiten.
      if (user && ranked.slice(0, 2).some((o) => o.player.id === userId)) {
        const xg = clamp(expectedGoals(distance, offset) * 1.35, 0.02, 0.22);
        this.startChallenge({
          ...this.baseChallenge(side, 'freeKick'),
          title: t('me.ch.freeKick.title'),
          hint: t('me.ch.freeKick.hint'),
          distance,
          offset,
          pressure: 0.15,
          opponent: this.strengthOf(this.other(side)).defence,
          xg,
          bigChance: false,
          wall,
        }, {
          type: 'freeKick', attackingSide: side, xg, distance, offset, shooterId: userId,
        });
        return;
      }
    }

    // Statistische Aufloesung
    const st = this.statOf(taker.player.id, side, taker.slot);
    st.shots++;
    const quality = taker.player.attrs.freeKicks * 0.6 + taker.player.attrs.curve * 0.4;
    const keeperRating = this.keeperFor(this.other(side), 'longShot');
    const goalProb = clamp(
      expectedGoals(distance, offset) * (0.5 + quality / 90) * keeperModifier(keeperRating),
      0.005, 0.3,
    );
    if (this.rng.chance(goalProb)) {
      st.shotsOnTarget++;
      this.scoreGoal(side, taker, null, evts, false);
    } else if (this.rng.chance(0.4)) {
      st.shotsOnTarget++;
      const gk = this.onPitch[this.other(side)].find((o) => o.slot === 'TW');
      if (gk) this.statOf(gk.player.id, this.other(side), 'TW').saves++;
      this.emit(evts, {
        minute: this.minute, type: 'save', side, playerId: taker.player.id,
        text: tVariant('live.freeKickForcesSave', this.rng.next(), { player: this.name(taker.player.id) }),
      });
    } else {
      this.emit(evts, {
        minute: this.minute, type: 'miss', side, playerId: taker.player.id,
        text: tVariant('live.freeKickMissed', this.rng.next(), { player: this.name(taker.player.id) }),
      });
    }
  }

  // --- Defensive Highlights ---------------------------------------------

  private tryDefensiveChallenge(defSide: Side, attackingSide: Side): boolean {
    if (!this.setup.interactive) return false;
    if (this.userSide !== defSide) return false;
    if (this.userChallenges >= this.maxChallenges) return false;
    const user = this.userOnPitch;
    if (!user || user.slot === 'TW') return false;

    const line = POSITION_LINE[user.slot];
    let base = line === 'DEF' ? 0.20 : user.slot === 'DM' ? 0.15 : line === 'MID' ? 0.09 : 0.03;
    // Im Modus "Alle Szenen" ist der Spieler auch ohne Ball staerker eingebunden.
    // Der Zuwachs bleibt moderat, weil Klaerungen am Schuss dazukommen.
    if (this.allHighlights) base *= 1.3;
    base *= this.defendFactor;
    // Wer gut steht, abfaengt und schnell ist, ist ueberhaupt erst dort, wo
    // der Zweikampf stattfindet. Bisher haing das allein an der Position.
    base *= clamp(0.6 + (defensiveSkill(user.player.attrs) * 0.6
      + tempo(user.player.attrs) * 0.4) / 150, 0.55, 1.45);
    if (!this.rng.chance(base)) return false;

    const attacker = this.rng.pick(this.onPitch[attackingSide].filter((o) => o.slot !== 'TW'));
    if (!attacker) return false;

    this.startChallenge({
      id: `ch-${this.minute}-duel`,
      kind: 'duel',
      minute: this.minute,
      title: t('me.ch.duel.title'),
      hint: t('me.ch.duel.hint'),
      distance: this.rng.float(22, 45),
      offset: this.rng.normal(0, 14),
      pressure: 0.5,
      keeper: this.strengthOf(defSide).keeper,
      opponent: attacker.rating,
      xg: 0,
      bigChance: false,
      scoreline: this.score,
      homeName: this.setup.homeClub.name,
      awayName: this.setup.awayClub.name,
      userSide: defSide,
    }, {
      type: 'duel',
      attackingSide,
      xg: 0,
      distance: 30,
      offset: 0,
      opponentId: attacker.player.id,
    });
    return true;
  }

  // --- Challenge-Aufbau --------------------------------------------------

  private startChallenge(challenge: Challenge, ctx: PendingContext) {
    this.pending = challenge;
    this.pendingCtx = ctx;
    this.userChallenges++;
  }

  /**
   * Erhoeht den Gegnerdruck in bedeutenden Partien: Ein Derby oder ein
   * Spitzenspiel wird auch in den Szenen spuerbar (Konzept Abschnitt 26).
   */
  /**
   * Druck einer Szene: Bedeutung der Partie **und** Spielweise des Gegners.
   *
   * Gegen eine hoch pressende Mannschaft bleibt weniger Zeit am Ball, gegen
   * einen tiefen Block mehr - dafuer sind dort die Raeume zu, was sich in
   * der Chancenqualitaet niederschlaegt. Ohne diesen Zusatz fuehlte sich
   * jeder Gegner gleich an.
   */
  /**
   * Wetterwirkung dieser Partie. Einmal nachgeschlagen statt in jeder
   * Szene - das Wetter aendert sich waehrend eines Spiels nicht.
   */
  private get wetter() {
    return weatherEffect(this.setup.weather);
  }

  /** Wie der Mann heute pfeift. Aendert sich waehrend eines Spiels ebenso wenig. */
  private get schiri() {
    return refereeEffect(this.setup.refereeStyle);
  }

  /**
   * Wie stark der Schiedsrichter zur Heimmannschaft neigt, 0 bis 0.5.
   *
   * Ein publikumsnaher Unparteiischer wird von einem vollen Haus getragen,
   * in einem halbleeren Rund bleibt davon wenig uebrig. Deshalb haengt die
   * Neigung an der Auslastung - und auf neutralem Platz ist sie weg.
   */
  private heimNeigung(): number {
    if (this.setup.neutral) return 0;
    return this.schiri.homeBias * this.auslastung() * 0.28;
  }

  private withImportance(base: number): number {
    return clamp(
      base + (this.setup.importance?.pressure ?? 0) + this.gegnerDruck()
        + this.publikumsDruck() + (this.setup.traits?.pressure ?? 0),
      0.1, 0.97);
  }

  /**
   * Was die Raenge mit dem eigenen Spieler machen.
   *
   * Auswaerts vor vollem Haus wird es laut und eng, daheim traegt einen das
   * Publikum ein Stueck. Auf neutralem Platz ist beides weg.
   */
  private publikumsDruck(): number {
    if (!this.userSide || this.setup.neutral) return 0;
    const voll = this.auslastung();
    return this.userSide === 'home' ? -0.05 * voll : 0.10 * voll;
  }

  /** Druckzuschlag aus der Spielweise des gegnerischen Vereins. */
  private gegnerDruck(): number {
    if (!this.userSide) return 0;
    const gegner = this.userSide === 'home' ? this.setup.awayClub : this.setup.homeClub;
    const mods: Record<string, number> = {
      highPress: 0.12,
      counter: 0.04,
      direct: 0.02,
      possession: 0.02,
      wingPlay: 0.01,
      buildUp: 0,
      longBall: -0.02,
      deepBlock: -0.06,
    };
    return mods[gegner.tacticStyle] ?? 0;
  }

  private baseChallenge(side: Side, kind: Challenge['kind']): Omit<Challenge, 'title' | 'hint' | 'distance' | 'offset' | 'xg' | 'bigChance' | 'pressure' | 'opponent'> {
    return {
      id: `ch-${this.minute}-${kind}-${this.userChallenges}`,
      kind,
      minute: this.minute,
      keeper: this.strengthOf(this.other(side)).keeper,
      scoreline: this.score,
      homeName: this.setup.homeClub.name,
      awayName: this.setup.awayClub.name,
      userSide: side,
    };
  }

  private buildShotChallenge(
    side: Side,
    chance: { kind: string; distance: number; offset: number; xg: number; bigChance: boolean },
    assistId: Id | undefined,
  ): Challenge {
    const kind = chance.kind === 'longShot' ? 'longShot'
      : chance.kind === 'header' ? 'header'
      : chance.kind === 'oneOnOne' ? 'oneOnOne' : 'shot';
    const titles: Record<string, string> = {
      shot: t('me.ch.shot.title'),
      longShot: t('me.ch.longShot.title'),
      header: t('me.ch.header.title'),
      oneOnOne: t('me.ch.oneOnOne.title'),
    };
    const hints: Record<string, string> = {
      shot: t('me.ch.shot.hint'),
      longShot: t('me.ch.longShot.hint'),
      freeKick: t('me.ch.freeKickShot.hint'),
      header: t('me.ch.header.hint'),
      oneOnOne: t('me.ch.oneOnOne.hint'),
    };
    return {
      ...this.baseChallenge(side, kind),
      title: titles[kind],
      hint: hints[kind],
      distance: chance.distance,
      offset: chance.offset,
      pressure: this.withImportance(
        clamp(this.strengthOf(this.other(side)).defence / 110 + this.rng.float(-0.15, 0.2), 0.1, 0.95)),
      opponent: this.strengthOf(this.other(side)).defence,
      xg: chance.xg,
      bigChance: chance.bigChance,
      ...(assistId ? {} : {}),
    };
  }

  private buildPassTargets(side: Side, preferred: OnPitchPlayer): ChallengeTarget[] {
    const pool = this.onPitch[side]
      .filter((o) => o.slot !== 'TW' && o.player.id !== this.setup.userPlayerId);
    // Gute Freunde bieten sich dem Spieler haeufiger an, Rivalen seltener
    // (Konzept Abschnitt 30).
    //
    // Das `Math.max(0, ...)` hier hat die halbe Kabine stumm geschaltet: Ein
    // Rivale, den die Kaderliste ausdruecklich als solchen ausweist und dessen
    // Verhaeltnis mit jedem Spiel weiter abrutscht, bot sich exakt so oft an
    // wie ein beliebiger Mitspieler. Damit war die negative Haelfte des
    // Beziehungssystems reine Anzeige.
    //
    // Der bevorzugte Anspielpunkt bleibt unberuehrt - wer frei steht, steht
    // frei, auch wenn man sich nicht mag.
    const rel = this.setup.relationships;
    const rest = pool.filter((o) => o.player.id !== preferred.player.id);
    const others = rel
      ? this.sampleWeighted(rest, 3,
        (o) => clamp(1 + (rel[o.player.id] ?? 0) / 30, 0.25, 4))
      : this.rng.sample(rest, 3);
    const chosen = [preferred, ...others];
    return chosen.filter(Boolean).map((o, i) => {
      const isPreferred = i === 0;
      const distance = isPreferred ? this.rng.float(7, 16) : this.rng.float(9, 26);
      const lateral = this.rng.normal(0, isPreferred ? 9 : 15);
      return {
        id: o.player.id,
        name: `${o.player.firstName.charAt(0)}. ${o.player.lastName}`,
        shirtNumber: o.player.shirtNumber,
        position: o.slot,
        x: clamp(lateral, -30, 30),
        y: distance,
        marked: clamp(isPreferred ? this.rng.float(0.15, 0.6) : this.rng.float(0.25, 0.9), 0, 1),
        finishing: o.player.attrs.finishing,
      };
    });
  }

  /** Zieht n Elemente gewichtet ohne Zuruecklegen. */
  private sampleWeighted<T>(items: T[], n: number, weightOf: (item: T) => number): T[] {
    const pool = items.slice();
    const result: T[] = [];
    while (result.length < n && pool.length > 0) {
      const pick = this.rng.weighted(pool, weightOf);
      result.push(pick);
      pool.splice(pool.indexOf(pick), 1);
    }
    return result;
  }

  /**
   * Steht der eigene Spieler auf der Aussenbahn?
   *
   * Aussenstuermer flanken fast immer, Aussenverteidiger oft - beide
   * kommen dort hin, wo eine Flanke die naheliegende Loesung ist. Alles
   * andere legt flach ab.
   */
  private flanktVonAussen(userId: Id): boolean {
    const eigen = this.onPitch[this.userSide!]?.find((o) => o.player.id === userId);
    if (!eigen) return false;
    if (eigen.slot === 'LA' || eigen.slot === 'RA') return this.rng.chance(0.72);
    if (eigen.slot === 'LV' || eigen.slot === 'RV') return this.rng.chance(0.55);
    return false;
  }

  /**
   * Die Flanke: von der Seitenlinie in den Strafraum.
   *
   * Anders als beim flachen Zuspiel steht der Ball weit aussen und die
   * Abnehmer stehen im Sechzehner. Das macht die Szene raeumlich zu einer
   * anderen Aufgabe - lange Bahn quer statt kurzer Ball nach vorn.
   */
  private buildCrossChallenge(
    side: Side,
    chance: { distance: number; offset: number; xg: number; bigChance: boolean },
    targets: ChallengeTarget[],
  ): Challenge {
    const aussen = this.rng.chance(0.5) ? 1 : -1;
    return {
      ...this.baseChallenge(side, 'cross'),
      title: t('me.ch.cross.title'),
      hint: t('me.ch.cross.hint'),
      // Von der Grundlinie bis zur Strafraumkante, weit auf dem Fluegel.
      distance: clamp(chance.distance * 0.5 + this.rng.float(4, 14), 4, 24),
      offset: aussen * this.rng.float(17, 27),
      pressure: this.withImportance(
        clamp(this.strengthOf(this.other(side)).defence / 130 + this.rng.float(-0.15, 0.15),
          0.05, 0.85)),
      opponent: this.strengthOf(this.other(side)).defence,
      xg: chance.xg,
      bigChance: chance.bigChance,
      targets,
    };
  }

  private buildPassChallenge(
    side: Side,
    chance: { distance: number; offset: number; xg: number; bigChance: boolean },
    targets: ChallengeTarget[],
  ): Challenge {
    return {
      ...this.baseChallenge(side, 'pass'),
      title: t('me.ch.assist.title'),
      hint: t('me.ch.assist.hint'),
      distance: chance.distance,
      offset: chance.offset,
      pressure: this.withImportance(
        clamp(this.strengthOf(this.other(side)).midfield / 120 + this.rng.float(-0.1, 0.2), 0.1, 0.95)),
      opponent: this.strengthOf(this.other(side)).defence,
      xg: chance.xg,
      bigChance: chance.bigChance,
      targets,
    };
  }

  private buildPenaltyChallenge(side: Side): Challenge {
    return {
      ...this.baseChallenge(side, 'penalty'),
      title: t('me.ch.penalty.title'),
      hint: t('me.ch.penalty.hint'),
      distance: 11,
      offset: 0,
      pressure: 0.35,
      opponent: this.strengthOf(this.other(side)).keeper,
      xg: 0.78,
      bigChance: true,
    };
  }

  private buildSaveChallenge(
    defSide: Side,
    chance: { distance: number; offset: number; xg: number; bigChance: boolean },
    shooter: OnPitchPlayer,
  ): Challenge {
    return {
      ...this.baseChallenge(defSide, 'save'),
      title: t('me.ch.save.title'),
      hint: t('me.ch.save.hint'),
      distance: chance.distance,
      offset: chance.offset,
      pressure: 0.5,
      opponent: shooter.rating,
      xg: chance.xg,
      bigChance: chance.bigChance,
      incoming: this.buildIncoming(shooter),
    };
  }

  /**
   * Der Schuss steht schon vor der Entscheidung des Torwarts fest, damit dieser
   * die Koerperhaltung lesen kann. Der Hinweis ist absichtlich ungenau - je
   * besser der Schuetze, desto weniger verraet er (Konzept Abschnitt 25).
   */
  private buildIncoming(shooter: OnPitchPlayer): NonNullable<Challenge['incoming']> {
    // Breiter gestreut als zuvor, damit die Ecken wirklich angespielt werden und
    // Mittestehenbleiben keine dominante Strategie mehr ist.
    const aimX = clamp(
      this.rng.normal(0, GOAL_HALF_WIDTH * 0.78),
      -GOAL_HALF_WIDTH * 1.1, GOAL_HALF_WIDTH * 1.1,
    );
    // Der Hinweis ist bewusst grob: Er engt die Ecke ein, nimmt die
    // Entscheidung aber nicht ab.
    const deception = 0.85 + (shooter.player.attrs.composure ?? 50) / 80;
    return {
      speed: clamp(18 + shooter.player.attrs.shotPower / 4, 18, 42),
      curve: this.rng.float(-1, 1) * (shooter.player.attrs.curve / 100),
      power: shooter.player.attrs.shotPower,
      aimX,
      tell: clamp(aimX + this.rng.normal(0, deception), -GOAL_HALF_WIDTH * 1.3, GOAL_HALF_WIDTH * 1.3),
    };
  }

  private buildPenaltySaveChallenge(defSide: Side, taker: OnPitchPlayer): Challenge {
    return {
      ...this.baseChallenge(defSide, 'penaltySave'),
      title: t('me.ch.penaltySave.title'),
      hint: t('me.ch.penaltySave.hint'),
      distance: 11,
      offset: 0,
      pressure: 0.4,
      opponent: taker.player.attrs.penalties,
      xg: 0.78,
      bigChance: true,
      incoming: {
        speed: clamp(20 + taker.player.attrs.shotPower / 5, 20, 38),
        curve: this.rng.float(-0.6, 0.6),
        power: taker.player.attrs.shotPower,
      },
    };
  }

  // --- Aufloesung interaktiver Situationen -------------------------------

  resolve(result: ChallengeResult): LiveEvent[] {
    const ctx = this.pendingCtx;
    const challenge = this.pending;
    this.pending = null;
    this.pendingCtx = null;
    if (!ctx || !challenge) return [];

    this.userQualitySum += result.quality;
    this.userQualityCount++;

    const evts: LiveEvent[] = [];
    const userId = this.setup.userPlayerId!;
    const side = ctx.attackingSide;
    const userSide = this.userSide!;
    const user = this.userOnPitch;
    if (!user) return evts;

    const st = this.statOf(userId, userSide, user.slot);

    // Zu lange gezoegert: der Ball ist weg. Das gilt fuer jede Szenenart
    // und wird deshalb hier abgefangen - nicht in den einzelnen
    // Auswertungen, die sonst einen Schuss oder Pass verbuchen wuerden,
    // den es nie gab.
    if (result.outcome === 'ballLost') {
      st.possessionLost++;
      this.emit(evts, {
        minute: this.minute, type: 'note', side, playerId: user.player.id, user: true,
        text: tVariant('live.tooSlow', this.rng.next(), { player: this.name(user.player.id) }),
      });
      if (this.minute >= this.fullTime && !this.finished) this.handleFullTime(evts);
      this.events.push(...evts);
      return evts;
    }

    switch (ctx.type) {
      case 'shot': case 'longShot': case 'header': case 'oneOnOne':
        this.applyShotResult(result, ctx, user, st, evts);
        break;
      case 'penalty':
        this.applyPenaltyResult(result, user, st, evts);
        break;
      case 'freeKick':
        this.applyFreeKickResult(result, ctx, user, st, evts);
        break;
      case 'pass':
        // In der Vorlagen-Szene darf der Nutzer auch selbst abschliessen. Dann
        // liefert die Szene einen Schuss-Ausgang (goal/saved/...) statt eines
        // Pass-Ausgangs und wird als eigener Abschluss verbucht.
        if (result.outcome === 'passCompleted' || result.outcome === 'passLost') {
          this.applyPassResult(result, ctx, user, st, evts, side);
        } else {
          this.applyShotResult(result, ctx, user, st, evts);
        }
        break;
      case 'cross':
        this.applyCrossResult(result, ctx, user, st, evts, side);
        break;
      case 'duel':
        this.applyDuelResult(result, ctx, user, st, evts);
        break;
      case 'block':
        this.applyBlockResult(result, ctx, user, st, evts);
        break;
      case 'dribble':
        this.applyDribbleResult(result, ctx, user, st, evts);
        break;
      case 'save':
        this.applySaveResult(result, ctx, user, st, evts);
        break;
      default:
        break;
    }

    if (this.minute >= this.fullTime && !this.finished) this.handleFullTime(evts);
    this.events.push(...evts);
    return evts;
  }

  private applyShotResult(
    result: ChallengeResult, ctx: PendingContext,
    user: OnPitchPlayer, st: PlayerMatchStats, evts: LiveEvent[],
  ) {
    st.shots++;
    if (ctx.xg >= 0.27) st.bigChances++;
    const side = this.userSide!;
    const defSide = this.other(side);
    const gk = this.onPitch[defSide].find((o) => o.slot === 'TW');
    const creator = ctx.assistId
      ? this.onPitch[side].find((o) => o.player.id === ctx.assistId) ?? null
      : null;

    switch (result.outcome) {
      case 'goal':
        st.shotsOnTarget++;
        if (ctx.xg >= 0.27) st.bigChancesScored++;
        this.scoreGoal(side, user, creator, evts, ctx.xg >= 0.27);
        break;
      case 'saved':
        st.shotsOnTarget++;
        if (gk) this.statOf(gk.player.id, defSide, 'TW').saves++;
        this.emit(evts, {
          minute: this.minute, type: 'save', side, playerId: user.player.id, user: true,
          text: tVariant('live.userForcesSave', this.rng.next(), { player: this.name(user.player.id) }),
        });
        break;
      case 'post':
        st.shotsOnTarget++;
        this.emit(evts, {
          minute: this.minute, type: 'miss', side, playerId: user.player.id, user: true,
          text: tVariant('live.woodwork', this.rng.next(), { player: this.name(user.player.id) }),
        });
        break;
      case 'blocked': {
        const blocker = this.onPitch[defSide].filter((o) => o.slot !== 'TW');
        if (blocker.length) {
          const b = this.rng.pick(blocker);
          this.statOf(b.player.id, defSide, b.slot).blocks++;
        }
        this.emit(evts, {
          minute: this.minute, type: 'miss', side, playerId: user.player.id, user: true,
          text: tVariant('live.shotBlocked', this.rng.next(), { player: this.name(user.player.id) }),
        });
        break;
      }
      default:
        this.emit(evts, {
          minute: this.minute, type: 'miss', side, playerId: user.player.id, user: true,
          text: tVariant('live.userWide', this.rng.next(), { player: this.name(user.player.id) }),
        });
    }
  }

  private applyPenaltyResult(
    result: ChallengeResult, user: OnPitchPlayer, st: PlayerMatchStats, evts: LiveEvent[],
  ) {
    const side = this.userSide!;
    st.shots++;
    if (result.outcome === 'goal') {
      st.shotsOnTarget++;
      st.penaltiesScored++;
      this.scoreGoal(side, user, null, evts, true);
    } else {
      st.penaltiesMissed++;
      if (result.outcome === 'saved') st.shotsOnTarget++;
      this.emit(evts, {
        minute: this.minute, type: 'penaltyMiss', side, playerId: user.player.id, user: true,
        text: tVariant('live.userPenaltyMissed', this.rng.next(), { player: this.name(user.player.id) }),
      });
    }
  }

  private applyFreeKickResult(
    result: ChallengeResult, ctx: PendingContext,
    user: OnPitchPlayer, st: PlayerMatchStats, evts: LiveEvent[],
  ) {
    const side = this.userSide!;
    const defSide = this.other(side);
    st.shots++;

    switch (result.outcome) {
      case 'goal':
        st.shotsOnTarget++;
        this.scoreGoal(side, user, null, evts, ctx.xg >= 0.27);
        this.emit(evts, {
          minute: this.minute, type: 'note', side, playerId: user.player.id, user: true,
          text: tVariant('live.freeKickGoal', this.rng.next(), { player: this.name(user.player.id) }),
        });
        break;
      case 'saved': {
        st.shotsOnTarget++;
        const gk = this.onPitch[defSide].find((o) => o.slot === 'TW');
        if (gk) this.statOf(gk.player.id, defSide, 'TW').saves++;
        this.emit(evts, {
          minute: this.minute, type: 'save', side, playerId: user.player.id, user: true,
          text: tVariant('live.freeKickSaved', this.rng.next(), { player: this.name(user.player.id) }),
        });
        break;
      }
      case 'blocked':
        this.emit(evts, {
          minute: this.minute, type: 'miss', side, playerId: user.player.id, user: true,
          text: tVariant('live.freeKickWall', this.rng.next(), { player: this.name(user.player.id) }),
        });
        break;
      case 'post':
        st.shotsOnTarget++;
        this.emit(evts, {
          minute: this.minute, type: 'miss', side, playerId: user.player.id, user: true,
          text: tVariant('live.freeKickPost', this.rng.next(), { player: this.name(user.player.id) }),
        });
        break;
      default:
        this.emit(evts, {
          minute: this.minute, type: 'miss', side, playerId: user.player.id, user: true,
          text: tVariant('live.freeKickWide', this.rng.next(), { player: this.name(user.player.id) }),
        });
    }
  }

  private applyDribbleResult(
    result: ChallengeResult, ctx: PendingContext,
    user: OnPitchPlayer, st: PlayerMatchStats, evts: LiveEvent[],
  ) {
    const side = this.userSide!;
    st.dribbles++;
    st.duels++;

    if (result.outcome === 'dribbleWon') {
      st.dribblesCompleted++;
      st.duelsWon++;
      this.emit(evts, {
        minute: this.minute, type: 'note', side, playerId: user.player.id, user: true,
        text: tVariant('live.dribblePast', this.rng.next(), { player: this.name(user.player.id) }),
      });
      // Nach dem gewonnenen Dribbling entsteht eine bessere Situation.
      this.continueAttack(side, evts, {
        xgBonus: 1.35,
        preferShooterId: user.player.id,
        guaranteedShot: true,
      });
      return;
    }

    if (result.outcome === 'foulSuffered') {
      st.foulsDrawn++;
      const opponent = ctx.opponentId;
      if (opponent) {
        const defSide = this.other(side);
        const o = this.onPitch[defSide].find((x) => x.player.id === opponent);
        if (o) this.statOf(o.player.id, defSide, o.slot).fouls++;
      }
      this.emit(evts, {
        minute: this.minute, type: 'note', side, playerId: user.player.id, user: true,
        text: tVariant('live.fouledDribbling', this.rng.next(), { player: this.name(user.player.id) }),
      });
      // Aus dem Foul kann ein gefaehrlicher Freistoss entstehen.
      if (ctx.distance < 30 && this.rng.chance(0.45)) this.awardFreeKick(side, evts);
      return;
    }

    st.possessionLost++;
    this.emit(evts, {
      minute: this.minute, type: 'note', side, playerId: user.player.id, user: true,
      text: tVariant('live.dribbleLost', this.rng.next(), { player: this.name(user.player.id) }),
    });
  }

  /** Klaerung eines gefaehrlichen Gegnerschusses (Modus "Alle Szenen"). */
  private applyBlockResult(
    result: ChallengeResult, ctx: PendingContext,
    user: OnPitchPlayer, st: PlayerMatchStats, evts: LiveEvent[],
  ) {
    const defSide = this.userSide!;
    const side = ctx.attackingSide;
    const shooter = this.onPitch[side].find((o) => o.player.id === ctx.shooterId);

    if (result.outcome === 'duelWon') {
      st.blocks++;
      this.emit(evts, {
        minute: this.minute, type: 'save', side: defSide, playerId: user.player.id, user: true,
        text: tVariant('live.blockClear', this.rng.next(), { player: this.name(user.player.id) }),
      });
      return;
    }

    if (result.outcome === 'foulCommitted') {
      st.fouls++;
      // Ein Foul im eigenen Strafraumbereich kann teuer werden.
      if (ctx.distance < 17 && this.rng.chance(0.5)) {
        this.awardPenalty(side, evts);
      } else {
        this.emit(evts, {
          minute: this.minute, type: 'note', side: defSide, playerId: user.player.id, user: true,
          text: tVariant('live.lateFoul', this.rng.next(), { player: this.name(user.player.id) }),
        });
      }
      return;
    }

    // Block misslungen: der Schuss laeuft ganz normal weiter.
    this.emit(evts, {
      minute: this.minute, type: 'note', side: defSide, playerId: user.player.id, user: true,
      text: tVariant('live.slipPast', this.rng.next(), { player: this.name(user.player.id) }),
    });
    if (shooter) {
      const creator = ctx.assistId
        ? this.onPitch[side].find((o) => o.player.id === ctx.assistId) ?? null : null;
      this.resolveShotOnGoal(side, shooter, creator, {
        kind: ctx.blockKind ?? 'shot',
        distance: ctx.distance,
        offset: ctx.offset,
        xg: ctx.xg,
        bigChance: ctx.blockBigChance ?? false,
      }, ctx.blockInputBonus ?? 1, evts);
    }
  }

  private applyPassResult(
    result: ChallengeResult, ctx: PendingContext,
    user: OnPitchPlayer, st: PlayerMatchStats, evts: LiveEvent[], side: Side,
  ) {
    st.passes++;
    if (result.outcome === 'passLost') {
      st.possessionLost++;
      this.emit(evts, {
        minute: this.minute, type: 'note', side, playerId: user.player.id, user: true,
        text: tVariant('live.lostInBuildup', this.rng.next(), { player: this.name(user.player.id) }),
      });
      return;
    }

    st.passesCompleted++;
    const targetId = result.targetId ?? ctx.shooterId;
    const receiver = this.onPitch[side].find((o) => o.player.id === targetId);
    if (!receiver) return;

    st.keyPasses++;
    // Die Qualitaet des Passes verbessert die Abschlusssituation.
    const bonus = clamp(0.7 + result.quality * 0.9, 0.6, 1.65);
    const chance = {
      kind: 'shot',
      distance: ctx.distance,
      offset: ctx.offset,
      xg: clamp(ctx.xg * bonus, 0.02, 0.82),
      bigChance: ctx.xg * bonus >= 0.27,
    };
    const before = side === 'home' ? this.homeScore : this.awayScore;
    this.resolveShot(side, receiver, user, chance, evts, bonus);
    const after = side === 'home' ? this.homeScore : this.awayScore;
    if (after === before) {
      // Kein Tor: der Schluesselpass zaehlt trotzdem.
      this.emit(evts, {
        minute: this.minute, type: 'chance', side, playerId: user.player.id, user: true,
        text: tVariant('live.assistWasted', this.rng.next(), { player: this.name(user.player.id) }),
      });
    }
  }

  /**
   * Die Flanke auswerten.
   *
   * Nah am Zuspiel, aber mit eigener Buchfuehrung und eigener Folge: Aus
   * einer Flanke wird ein Kopfball, nicht ein Schuss aus dem Lauf. `crosses`
   * und `crossesCompleted` standen bis hierher in der Statistik und wurden
   * nirgends hochgezaehlt - jeder Spieler hatte null Flanken, immer.
   */
  private applyCrossResult(
    result: ChallengeResult, ctx: PendingContext,
    user: OnPitchPlayer, st: PlayerMatchStats, evts: LiveEvent[], side: Side,
  ) {
    st.crosses++;
    if (result.outcome === 'passLost') {
      st.possessionLost++;
      this.emit(evts, {
        minute: this.minute, type: 'note', side, playerId: user.player.id, user: true,
        text: tVariant('live.crossCleared', this.rng.next(),
          { player: this.name(user.player.id) }),
      });
      return;
    }

    st.crossesCompleted++;
    st.passes++;
    st.passesCompleted++;
    const targetId = result.targetId ?? ctx.shooterId;
    const receiver = this.onPitch[side].find((o) => o.player.id === targetId);
    if (!receiver) return;

    st.keyPasses++;
    // Eine angekommene Flanke wird zum Kopfball - wie hoch die Chance ist,
    // haengt daran, wie gut sie geschlagen war und wer da hochsteigt.
    const bonus = clamp(0.7 + result.quality * 0.9, 0.6, 1.65);
    const kopfstark = clamp(receiver.player.attrs.heading / 100, 0.4, 1.3);
    const chance = {
      kind: 'header',
      distance: clamp(this.rng.float(4, 13), 3, 16),
      offset: this.rng.normal(0, 4),
      xg: clamp(ctx.xg * bonus * kopfstark, 0.02, 0.78),
      bigChance: ctx.xg * bonus * kopfstark >= 0.27,
    };
    const before = side === "home" ? this.homeScore : this.awayScore;
    this.resolveShot(side, receiver, user, chance, evts, bonus);
    const after = side === "home" ? this.homeScore : this.awayScore;
    if (after === before) {
      this.emit(evts, {
        minute: this.minute, type: 'chance', side, playerId: user.player.id, user: true,
        text: tVariant('live.crossWasted', this.rng.next(),
          { player: this.name(user.player.id) }),
      });
    }
  }

  private applyDuelResult(
    result: ChallengeResult, ctx: PendingContext,
    user: OnPitchPlayer, st: PlayerMatchStats, evts: LiveEvent[],
  ) {
    const defSide = this.userSide!;
    st.duels++;

    if (result.outcome === 'duelWon') {
      st.duelsWon++;
      st.tackles++;
      this.emit(evts, {
        minute: this.minute, type: 'note', side: defSide, playerId: user.player.id, user: true,
        text: tVariant('live.strongClear', this.rng.next(), { player: this.name(user.player.id) }),
      });
      return;
    }

    if (result.outcome === 'foulCommitted') {
      st.fouls++;
      const cardRisk = clamp(
        (0.32 - result.quality * 0.25) * this.schiri.cards, 0.05, 0.6);
      if (this.rng.chance(cardRisk)) {
        this.giveCard(user.player.id, defSide, evts, false);
      } else {
        this.emit(evts, {
          minute: this.minute, type: 'note', side: defSide, playerId: user.player.id, user: true,
          text: tVariant('live.stopsWithFoul', this.rng.next(), { player: this.name(user.player.id) }),
        });
      }
      return;
    }

    // Zweikampf verloren - der Angriff laeuft weiter.
    this.emit(evts, {
      minute: this.minute, type: 'note', side: defSide, playerId: user.player.id, user: true,
      text: tVariant('live.beaten', this.rng.next(), { player: this.name(user.player.id) }),
    });
    this.continueAttack(ctx.attackingSide, evts);
  }

  private applySaveResult(
    result: ChallengeResult, ctx: PendingContext,
    user: OnPitchPlayer, st: PlayerMatchStats, evts: LiveEvent[],
  ) {
    const defSide = this.userSide!;
    const side = ctx.attackingSide;
    const shooter = this.onPitch[side].find((o) => o.player.id === ctx.shooterId);
    const shooterStats = shooter ? this.statOf(shooter.player.id, side, shooter.slot) : null;

    if (result.outcome === 'goalConceded') {
      if (shooter) {
        const creator = ctx.assistId
          ? this.onPitch[side].find((o) => o.player.id === ctx.assistId) ?? null : null;
        if (shooterStats && ctx.type === 'save' && challengeWasPenalty(ctx)) shooterStats.penaltiesScored++;
        this.scoreGoal(side, shooter, creator, evts, ctx.xg >= 0.27);
      }
      return;
    }

    st.saves++;
    if (challengeWasPenalty(ctx)) {
      st.penaltiesSaved++;
      if (shooterStats) shooterStats.penaltiesMissed++;
      this.emit(evts, {
        minute: this.minute, type: 'save', side: defSide, playerId: user.player.id, user: true,
        text: tVariant('live.penaltySaved', this.rng.next(), { player: this.name(user.player.id) }),
      });
      return;
    }
    this.emit(evts, {
      minute: this.minute, type: 'save', side: defSide, playerId: user.player.id, user: true,
      text: result.outcome === 'caught'
        ? tVariant('live.keeperCaught', this.rng.next(), { player: this.name(user.player.id) })
        : tVariant('live.keeperParade', this.rng.next(), { player: this.name(user.player.id) }),
    });
  }

  // --- Karten, Verletzungen, Wechsel -------------------------------------

  /**
   * Vergehen und Karte sind zwei Entscheidungen, nicht eine.
   *
   * Vorher gab jedes gepfiffene Vergehen eine Karte - Fouls und Karten
   * waren im Spielbericht dieselbe Zahl. Getrennt bleibt das Produkt fuer
   * den unauffaelligen Schiedsrichter gleich (0.11 mal 0.5 sind die alten
   * 0.055), und wer pfeift, macht endlich einen Unterschied.
   */
  private rollDiscipline(evts: LiveEvent[]) {
    const ref = this.schiri;
    if (!this.rng.chance((0.055 / CARD_SHARE) * ref.fouls)) return;

    // Ein publikumsnaher Schiedsrichter pfeift eher gegen die Gaeste.
    const side: Side = this.rng.chance(0.5 + this.heimNeigung()) ? 'away' : 'home';
    const squad = this.onPitch[side].filter((o) => o.slot !== 'TW');
    if (squad.length === 0) return;
    const o = this.rng.weighted(squad, (x) => {
      const basis = 1 + (100 - x.player.attrs.discipline) / 22
        + x.player.attrs.tackling / 45;
      // Wer schon Gelb gesehen hat, geht vorsichtiger rein - und je
      // disziplinierter er ist, desto mehr. Vorher fehlte das ganz: ein
      // verwarnter Spieler foulte genauso oft weiter wie jeder andere,
      // weshalb bei einem kartenfreudigen Schiedsrichter in fast jeder
      // Partie jemand mit Gelb-Rot vom Platz ging.
      const gewarnt = (this.yellows.get(x.player.id) ?? 0) > 0;
      return gewarnt
        ? basis * clamp(0.42 - x.player.attrs.discipline / 500, 0.15, 0.42)
        : basis;
    });
    this.statOf(o.player.id, side, o.slot).fouls++;

    if (!this.rng.chance(clamp(CARD_SHARE * ref.cards, 0.05, 0.95))) return;
    const straightRed = this.rng.chance(0.03 * ref.red);
    this.giveCard(o.player.id, side, evts, straightRed);
  }

  private giveCard(playerId: Id, side: Side, evts: LiveEvent[], straightRed: boolean) {
    const o = this.onPitch[side].find((x) => x.player.id === playerId);
    if (!o) return;
    const st = this.statOf(playerId, side, o.slot);
    const isUser = playerId === this.setup.userPlayerId;

    if (straightRed) {
      st.redCards++;
      this.sendOff(playerId, side);
      this.emit(evts, {
        minute: this.minute, type: 'red', side, playerId, user: isUser,
        text: tVariant('live.red', this.rng.next(), { player: this.name(playerId) }),
      });
      return;
    }

    const count = (this.yellows.get(playerId) ?? 0) + 1;
    this.yellows.set(playerId, count);

    if (count >= 2) {
      st.redCards++;
      this.sendOff(playerId, side);
      this.emit(evts, {
        minute: this.minute, type: 'secondYellow', side, playerId, user: isUser,
        text: tVariant('live.secondYellow', this.rng.next(), { player: this.name(playerId) }),
      });
    } else {
      st.yellowCards++;
      this.emit(evts, {
        minute: this.minute, type: 'yellow', side, playerId, user: isUser,
        text: tVariant('live.yellow', this.rng.next(), { player: this.name(playerId) }),
      });
    }
  }

  private sendOff(playerId: Id, side: Side) {
    this.sentOff.add(playerId);
    // Eine Unterzahl dreht eine Partie deutlicher als alles andere.
    this.schwung.platzverweis(side === 'home');
    this.onPitch[side] = this.onPitch[side].filter((o) => o.player.id !== playerId);
  }

  private rollInjury(evts: LiveEvent[]) {
    for (const side of ['home', 'away'] as Side[]) {
      for (const o of this.onPitch[side]) {
        const p = o.player;
        const fit = this.liveFitness.get(p.id) ?? 90;
        const risk = 0.00028 * (0.5 + p.injuryProneness / 80) * (1.5 - fit / 130)
          * this.setup.difficulty.injuryFactor
          // Lebensweise und Zusatzeinheiten des eigenen Spielers.
          * (o.player.id === this.setup.userPlayerId
            ? (this.setup.ownInjuryRisk ?? 1) * (this.setup.traits?.injury ?? 1)
            : 1);
        if (!this.rng.chance(risk)) continue;

        const days = Math.max(3, Math.round(this.rng.normal(18, 16)));

        // Beim eigenen Spieler entscheidet der Nutzer selbst (Abschnitt 37).
        if (p.id === this.setup.userPlayerId && this.setup.interactive) {
          this.pendingInjury = {
            minute: this.minute,
            estimatedDays: days,
            severity: days >= 45 ? 'schwer' : days >= 18 ? 'mittel' : 'leicht',
            canSubstitute: this.subsUsed[side] < 5,
          };
          this.emit(evts, {
            minute: this.minute, type: 'injury', side, playerId: p.id, user: true,
            text: tVariant('live.knockDown', this.rng.next(), { player: this.name(p.id) }),
          });
          return;
        }

        this.injuries.push({ playerId: p.id, days });
        this.emit(evts, {
          minute: this.minute, type: 'injury', side, playerId: p.id,
          user: false,
          text: tVariant('live.needsTreatment', this.rng.next(), { player: this.name(p.id) }),
        });
        this.substitute(side, o, evts, true);
        return;
      }
    }
  }

  /** Loest die Verletzungsentscheidung des Spielers auf. */
  resolveInjury(choice: 'play' | 'off'): LiveEvent[] {
    const decision = this.pendingInjury;
    this.pendingInjury = null;
    if (!decision) return [];
    const side = this.userSide!;
    const user = this.userOnPitch;
    const evts: LiveEvent[] = [];

    if (choice === 'off' || !user) {
      this.injuries.push({ playerId: this.setup.userPlayerId!, days: decision.estimatedDays });
      this.emit(evts, {
        minute: this.minute, type: 'injury', side, playerId: this.setup.userPlayerId!, user: true,
        text: tVariant('live.cannotContinue', this.rng.next(), { player: this.name(this.setup.userPlayerId!) }),
      });
      if (user) this.substitute(side, user, evts, true);
      this.events.push(...evts);
      return evts;
    }

    // Weiterspielen: angeschlagen, mit Leistungseinbruch und Risiko.
    this.knockDays = decision.estimatedDays;
    const current = this.liveFitness.get(this.setup.userPlayerId!) ?? 80;
    this.liveFitness.set(this.setup.userPlayerId!, clamp(current - 26, 10, 100));
    // Risiko je Minute. Ueber eine Halbzeit ergibt das grob 45% (schwer),
    // 30% (mittel) und 16% (leicht) Wahrscheinlichkeit einer Verschlimmerung.
    this.aggravationRisk = decision.severity === 'schwer' ? 0.013
      : decision.severity === 'mittel' ? 0.008 : 0.004;
    this.emit(evts, {
      minute: this.minute, type: 'note', side, playerId: this.setup.userPlayerId!, user: true,
      text: tVariant('live.playsOn', this.rng.next(), { player: this.name(this.setup.userPlayerId!) }),
    });
    this.events.push(...evts);
    return evts;
  }

  /** Prueft je Minute, ob eine durchgespielte Verletzung sich verschlimmert. */
  private rollAggravation(evts: LiveEvent[]) {
    if (this.aggravationRisk <= 0) return;
    const user = this.userOnPitch;
    if (!user) { this.aggravationRisk = 0; return; }
    if (!this.rng.chance(this.aggravationRisk)) return;

    const worseDays = Math.round(this.knockDays * this.rng.float(1.6, 2.2));
    this.injuries.push({ playerId: user.player.id, days: worseDays });
    this.knockDays = 0;
    this.aggravationRisk = 0;
    this.emit(evts, {
      minute: this.minute, type: 'injury', side: this.userSide!, playerId: user.player.id, user: true,
      text: tVariant('live.injuryWorse', this.rng.next(), { player: this.name(user.player.id) }),
    });
    this.substitute(this.userSide!, user, evts, true);
  }

  private considerSubstitutions(side: Side, evts: LiveEvent[]) {
    if (this.subsUsed[side] >= 5) return;
    const candidates = this.onPitch[side].filter((o) => o.slot !== 'TW');
    if (candidates.length === 0) return;

    // Muedester bzw. schwaechster Spieler
    const worst = candidates.reduce((a, b) => {
      const fa = this.liveFitness.get(a.player.id) ?? 90;
      const fb = this.liveFitness.get(b.player.id) ?? 90;
      return fa * 0.7 + a.rating * 0.3 < fb * 0.7 + b.rating * 0.3 ? a : b;
    });
    const fitness = this.liveFitness.get(worst.player.id) ?? 90;

    const userIsSubbed = worst.player.id === this.setup.userPlayerId;
    const wantsSub = fitness < 62 || (this.rng.chance(0.28) && this.minute >= 64);
    if (!wantsSub) {
      this.considerUserOn(side, evts);
      return;
    }
    // Wer eine tragende Rolle hat, bleibt laenger drauf.
    //
    // Vorher galt das nur fuer Schluesselspieler und Mannschaftsfuehrer.
    // Gemessen: Ein Spieler, der 37 von 37 Ligaspielen von Anfang an machte,
    // kam trotzdem im Schnitt nach 67,6 Minuten herunter - gleich starke
    // computergesteuerte Spieler standen 88 Minuten auf dem Platz. Damit war
    // jede Auszeichnung, die Summen zaehlt, ausser Reichweite.
    if (userIsSubbed && this.setup.userPlayerId) {
      const role = worst.player.contract?.role;
      const tragend = role === 'Schluesselspieler' || role === 'Mannschaftsfuehrer';
      const stamm = role === 'Stammspieler';
      // Der Schutz ist gestuft: Ein Schluesselspieler bleibt fast immer drauf,
      // ein Stammspieler meistens - aber beide gehen runter, wenn die Kraefte
      // wirklich nachlassen.
      if (tragend && fitness > 48 && !this.rng.chance(0.3)) {
        this.considerUserOn(side, evts);
        return;
      }
      if (stamm && fitness > 56 && !this.rng.chance(0.45)) {
        this.considerUserOn(side, evts);
        return;
      }
    }
    this.substitute(side, worst, evts, false);
  }

  /** Wird der eigene Spieler von der Bank gebracht? */
  private considerUserOn(side: Side, evts: LiveEvent[]) {
    const userId = this.setup.userPlayerId;
    if (!userId || this.userSide !== side) return;
    if (this.userOnPitch) return;
    if (this.subsUsed[side] >= 5) return;
    const userPlayer = this.bench[side].find((p) => p.id === userId);
    if (!userPlayer) return;
    // Ein Ersatztorwart wird nicht taktisch gebracht - er kaeme sonst als
    // Feldspieler aufs Feld, weil hier nur Feldspieler ersetzt werden. Fuer den
    // Torwart zaehlt allein die Aufstellung; bei Verletzung des Stammkeepers
    // greift substitute(), das die Position korrekt beruecksichtigt.
    if (userPlayer.position === 'TW') return;

    const behind = side === 'home' ? this.awayScore - this.homeScore : this.homeScore - this.awayScore;
    let chance = 0.16 + Math.max(0, behind) * 0.14 + (this.minute - 55) * 0.006;
    const role = userPlayer.contract?.role;
    if (role === 'Stammspieler' || role === 'Schluesselspieler') chance += 0.2;
    // Ein entschiedenes Spiel ist die Gelegenheit der Nachwuchskraefte: Steht es
    // in der Schlussphase klar, bringt der Trainer die Talente. Nur dann - wer
    // in einem engen Spiel gebracht wird, hat sich das anders verdient.
    if (role === 'Nachwuchsspieler') {
      const decided = Math.abs(this.homeScore - this.awayScore) >= 2 && this.minute >= 62;
      chance += decided ? 0.26 : -0.02;
    }
    chance += this.setup.difficulty.playtimeBonus / 200;

    if (!this.rng.chance(clamp(chance, 0.02, 0.85))) return;

    // Ersetzt wird ein Spieler auf einer passenden Position.
    const target = this.onPitch[side]
      .filter((o) => o.slot !== 'TW')
      .sort((a, b) => {
        const fitA = this.liveFitness.get(a.player.id) ?? 90;
        const fitB = this.liveFitness.get(b.player.id) ?? 90;
        const sameA = a.slot === userPlayer.position ? -25 : 0;
        const sameB = b.slot === userPlayer.position ? -25 : 0;
        return (fitA + a.rating + sameA) - (fitB + b.rating + sameB);
      })[0];
    if (!target) return;
    this.doSubstitution(side, target, userPlayer, evts);
  }

  private substitute(side: Side, out: OnPitchPlayer, evts: LiveEvent[], injured: boolean) {
    if (this.subsUsed[side] >= 5 && !injured) return;
    const pool = this.bench[side].filter((p) => !this.stats.get(p.id)?.minutes);
    if (pool.length === 0) return;

    let best: Player | null = null;
    let bestScore = -Infinity;
    for (const p of pool) {
      if ((out.slot === 'TW') !== (p.position === 'TW')) continue;
      let score = effectiveOverall(p.attrs, p.position, p.altPositions, out.slot) * (0.9 + p.fitness / 500);
      if (p.id === this.setup.userPlayerId) score += 4 + this.setup.difficulty.playtimeBonus / 3;
      if (score > bestScore) { bestScore = score; best = p; }
    }
    if (!best) return;
    this.doSubstitution(side, out, best, evts);
  }

  private doSubstitution(side: Side, out: OnPitchPlayer, incoming: Player, evts: LiveEvent[]) {
    this.subsUsed[side]++;
    this.onPitch[side] = this.onPitch[side].filter((o) => o.player.id !== out.player.id);
    this.bench[side] = this.bench[side].filter((p) => p.id !== incoming.id);
    this.onPitch[side].push({
      player: incoming,
      slot: out.slot,
      rating: effectiveOverall(incoming.attrs, incoming.position, incoming.altPositions, out.slot),
    });
    const st = this.statOf(incoming.id, side, out.slot);
    st.started = false;
    this.emit(evts, {
      minute: this.minute, type: 'sub', side,
      playerId: incoming.id,
      user: incoming.id === this.setup.userPlayerId || out.player.id === this.setup.userPlayerId,
      text: tVariant('live.substitution', this.rng.next(), { club: this.clubName(side), on: this.name(incoming.id), off: this.name(out.player.id) }),
    });
  }

  // --- Abschluss ---------------------------------------------------------

  /** Fuellt die Statistik mit plausiblen Grundwerten auf. */
  private fillBaseStats() {
    for (const side of ['home', 'away'] as Side[]) {
      const all = [...this.onPitch[side]];
      for (const o of all) {
        const st = this.stats.get(o.player.id);
        if (!st || st.minutes === 0) continue;
        const share = st.minutes / 90;
        const line = POSITION_LINE[o.slot];
        const base = line === 'GK' ? 20 : line === 'DEF' ? 46 : line === 'MID' ? 60 : 32;
        const extraPasses = Math.max(0, Math.round(this.rng.normal(base * share, base * 0.2)));
        st.passes += extraPasses;
        const acc = clamp(0.6 + o.player.attrs.shortPass / 300 + this.rng.normal(0, 0.05), 0.4, 0.97);
        st.passesCompleted += Math.round(extraPasses * acc);

        const duels = Math.round(this.rng.float(3, 15) * share);
        st.duels += duels;
        st.duelsWon += Math.round(duels * clamp(
          0.34 + o.player.attrs.tackling / 300 + o.player.attrs.strength / 400 + this.rng.normal(0, 0.07),
          0.1, 0.9,
        ));
        const aerial = Math.round(this.rng.float(0, 6) * share);
        st.aerialDuels += aerial;
        st.aerialDuelsWon += Math.round(aerial * clamp(0.3 + o.player.attrs.jumping / 260, 0.1, 0.9));

        const dribbles = Math.round(this.rng.float(0, line === 'ATT' ? 7 : 3) * share);
        st.dribbles += dribbles;
        st.dribblesCompleted += Math.round(dribbles * clamp(0.3 + o.player.attrs.dribbling / 240, 0.1, 0.9));

        // Flanken schlagen die Aussenbahnen, nicht die Mitte. Ohne diese
        // Zeilen stuende in der Statistik jedes Aussenverteidigers eine
        // Null, egal wie oft er hinten heraus kam.
        const aussen = o.slot === 'LA' || o.slot === 'RA' || o.slot === 'LV' || o.slot === 'RV';
        if (aussen) {
          const flanken = Math.round(this.rng.float(0, o.slot === 'LA' || o.slot === 'RA' ? 6 : 4) * share);
          st.crosses += flanken;
          st.crossesCompleted += Math.round(flanken * clamp(
            0.14 + o.player.attrs.crossing / 320 + this.rng.normal(0, 0.04), 0.03, 0.6,
          ));
        }

        if (line === 'DEF' || o.slot === 'DM') {
          st.tackles += Math.round(this.rng.float(0, 4) * share);
          st.interceptions += Math.round(this.rng.float(0, 4) * share);
          st.clearances += Math.round(this.rng.float(0, 6) * share);
          st.blocks += Math.round(this.rng.float(0, 2) * share);
        }
        st.possessionLost += Math.round(this.rng.float(1, 10) * share);
        st.foulsDrawn += Math.round(this.rng.float(0, 3) * share);
      }
    }
  }

  finish(): MatchOutcome {
    if (!this.finished) this.finished = true;

    // Wer angeschlagen durchgespielt hat und es ueberstanden hat, traegt
    // trotzdem eine kleinere Blessur davon.
    if (this.knockDays > 0 && this.setup.userPlayerId) {
      const minor = Math.max(3, Math.round(this.knockDays * 0.45));
      this.injuries.push({ playerId: this.setup.userPlayerId, days: minor });
      this.knockDays = 0;
    }

    this.fillBaseStats();

    if (this.setup.knockout && this.homeScore === this.awayScore) {
      const shootout = this.runShootout();
      this.penalties = shootout;
    }

    const stats = [...this.stats.values()].filter((s) => s.minutes > 0);
    for (const s of stats) {
      const isHome = s.clubId === this.setup.homeClub.id;
      s.rating = computeRating(
        s,
        isHome ? this.homeScore : this.awayScore,
        isHome ? this.awayScore : this.homeScore,
      );
    }

    let motmId: Id | null = null;
    const winnerSide: Side | null = this.homeScore > this.awayScore ? 'home'
      : this.awayScore > this.homeScore ? 'away' : null;
    const pool = winnerSide
      ? stats.filter((s) => s.clubId === this.clubId(winnerSide))
      : stats;
    const best = pool.slice().sort((a, b) => b.rating - a.rating)[0];
    if (best) { best.motm = true; motmId = best.playerId; }

    const fitnessAfter: Record<Id, number> = {};
    for (const [id, value] of this.liveFitness) fitnessAfter[id] = value;

    return {
      homeScore: this.homeScore,
      awayScore: this.awayScore,
      extraTime: this.extraTime,
      penalties: this.penalties,
      stats,
      events: this.events,
      injuries: this.injuries,
      fitnessAfter,
      motmId,
      userInputQuality: this.userQualityCount > 0
        ? this.userQualitySum / this.userQualityCount : null,
      halftimeMoraleDelta: this.halftimeMoraleDelta,
    };
  }

  /** Vernuenftige automatische Halbzeitwahl nach Spielstand. */
  private autoHalftimeChoice(): string {
    if (!this.pendingHalftime) return 'balanced';
    const [h, a] = this.pendingHalftime.scoreline;
    const own = this.userSide === 'home' ? h : a;
    const opp = this.userSide === 'home' ? a : h;
    if (own < opp) return 'push';
    if (own > opp) return 'hold';
    return 'balanced';
  }

  private runShootout(): [number, number] {
    const takers = (side: Side) => this.onPitch[side]
      .slice()
      .sort((a, b) => (b.player.attrs.penalties + b.player.attrs.composure)
        - (a.player.attrs.penalties + a.player.attrs.composure));
    const h = takers('home');
    const a = takers('away');
    const shoot = (o: OnPitchPlayer | undefined) => {
      if (!o) return this.rng.chance(0.7);
      return this.rng.chance(clamp(
        0.56 + o.player.attrs.penalties / 340 + o.player.attrs.composure / 600, 0.42, 0.93,
      ));
    };
    let hs = 0, as = 0;
    for (let i = 0; i < 5; i++) {
      if (shoot(h[i % Math.max(1, h.length)])) hs++;
      if (shoot(a[i % Math.max(1, a.length)])) as++;
    }
    let round = 5;
    while (hs === as && round < 20) {
      if (shoot(h[round % Math.max(1, h.length)])) hs++;
      if (shoot(a[round % Math.max(1, a.length)])) as++;
      round++;
    }
    return [hs, as];
  }

  /** Simuliert alle noch offenen Minuten ohne Interaktion. */
  runToEnd(autoResolve: (c: Challenge) => ChallengeResult): void {
    let guard = 0;
    while (!this.finished && guard++ < 400) {
      const res = this.step();
      if (this.pendingHalftime) {
        // Ohne Nutzer wird eine sinnvolle Standardreaktion gewaehlt.
        this.resolveHalftime(this.autoHalftimeChoice());
        continue;
      }
      if (this.pendingInjury) {
        // Ohne Nutzer wird sicher ausgewechselt.
        this.resolveInjury('off');
        continue;
      }
      if (res.pending) {
        this.resolve(autoResolve(res.pending));
      }
    }
  }
}

function challengeWasPenalty(ctx: PendingContext): boolean {
  return ctx.distance === 11 && ctx.offset === 0 && ctx.xg >= 0.7;
}

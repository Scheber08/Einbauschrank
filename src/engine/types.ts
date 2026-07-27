/** Zentrale Datentypen des Spielstands (Konzept Abschnitt 55). */
import type { Attributes, PositionCode } from './attributes';
import type { GameDate } from './date';

export type Id = string;

// --- Land, Wettbewerb, Verein -------------------------------------------

export interface Country {
  id: Id;
  name: string;
  short: string;
  /** Spielstil laut Konzept Abschnitt 5, beeinflusst Attributverteilung. */
  styleBias: Partial<Record<keyof Attributes | string, number>>;
  reputation: number; // 1-100
}

export type CompetitionType = 'league' | 'cup';

export interface Competition {
  id: Id;
  countryId: Id;
  name: string;
  short: string;
  type: CompetitionType;
  /** 1 = erste Liga, 2 = zweite Liga, 3 = dritte Liga. Pokal: 0 */
  level: number;
  clubIds: Id[];
  reputation: number;
}

export interface Club {
  id: Id;
  countryId: Id;
  leagueId: Id;
  name: string;
  short: string;
  city: string;
  colors: [string, string];
  reputation: number; // 1-100
  budget: number;
  wageBudget: number;
  stadiumName: string;
  stadiumCapacity: number;
  formation: FormationKey;
  tacticStyle: TacticStyle;
  /** Qualitaet der Trainingsanlagen und des Trainerstabs, 1-100. */
  training: number;
  youth: number;
  managerName: string;
  /** Beziehung des eigenen Spielers zum Trainer, 0-100 (Konzept Abschnitt 29). */
  history: ClubHistoryEntry[];
}

export interface ClubHistoryEntry {
  season: number;
  competitionId: Id;
  position?: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
  note?: string;
}

export type FormationKey = '4-4-2' | '4-3-3' | '4-2-3-1' | '3-5-2' | '3-4-3' | '5-3-2' | '4-1-4-1';

export type TacticStyle =
  | 'possession' | 'counter' | 'highPress' | 'deepBlock'
  | 'wingPlay' | 'direct' | 'longBall' | 'buildUp';

export const TACTIC_LABELS: Record<TacticStyle, string> = {
  possession: 'Ballbesitz',
  counter: 'Konter',
  highPress: 'Hohes Pressing',
  deepBlock: 'Tiefes Verteidigen',
  wingPlay: 'Fluegelspiel',
  direct: 'Direktes Spiel',
  longBall: 'Lange Baelle',
  buildUp: 'Kontrollierter Aufbau',
};

// --- Spieler ------------------------------------------------------------

export type Foot = 'links' | 'rechts';

export interface Injury {
  name: string;
  /** Verbleibende Ausfalltage. */
  daysOut: number;
  totalDays: number;
  severity: 'leicht' | 'mittel' | 'schwer';
  /** Dauerhafter Attributschaden bei schweren Verletzungen. */
  permanentLoss?: Partial<Record<keyof Attributes | string, number>>;
}

export interface Contract {
  clubId: Id;
  salary: number; // pro Woche
  until: GameDate;
  role: SquadRole;
  goalBonus: number;
  appearanceBonus: number;
  releaseClause?: number;
}

// --- Beratersystem (Konzept Abschnitt 35) ------------------------------

/** Auftrag an den Berater. Laeuft ueber mehrere Tage. */
export type AgentTaskKind = 'findClub' | 'raiseSalary' | 'demandRole';

export interface AgentTask {
  kind: AgentTaskKind;
  /** Tag, an dem der Auftrag erledigt ist. */
  dueOn: GameDate;
}

export interface Agent {
  name: string;
  /** Verhandlungsgeschick und Reichweite, 1-100. */
  quality: number;
  /** Anteil am Gehalt, den der Berater einbehaelt (0-1). */
  commission: number;
  /** Wie gut das Verhaeltnis ist, 0-100. */
  trust: number;
  /** Laufender Auftrag, falls vorhanden. */
  task: AgentTask | null;
  /** Wie viele Auftraege in dieser Saison schon liefen. */
  requestsThisSeason: number;
}

export type SquadRole =
  | 'Nachwuchsspieler' | 'Ergaenzungsspieler' | 'Rotationsspieler'
  | 'Stammspieler' | 'Schluesselspieler' | 'Mannschaftsfuehrer';

export const SQUAD_ROLE_ORDER: SquadRole[] = [
  'Nachwuchsspieler', 'Ergaenzungsspieler', 'Rotationsspieler',
  'Stammspieler', 'Schluesselspieler', 'Mannschaftsfuehrer',
];

export interface Player {
  id: Id;
  clubId: Id | null;
  firstName: string;
  lastName: string;
  nationality: Id;
  birthDate: GameDate;
  position: PositionCode;
  altPositions: PositionCode[];
  foot: Foot;
  height: number; // cm
  weight: number; // kg
  shirtNumber: number;
  attrs: Attributes;
  /** Maximal erreichbare Gesamtstaerke (Konzept Abschnitt 17). */
  potential: number;
  /** Wachstumsgeschwindigkeit, 0.6 - 1.4 */
  growth: number;
  form: number;    // 0-100, 50 = normal
  morale: number;  // 0-100
  fitness: number; // 0-100
  sharpness: number; // Spielpraxis, 0-100
  confidence: number; // Selbstvertrauen, 0-100
  injury: Injury | null;
  injuryProneness: number; // 0-100
  reputation: number; // 0-100
  marketValue: number;
  contract: Contract | null;
  isUser: boolean;
  /** Nur fuer den eigenen Spieler: Aussehen und Hintergrund. */
  appearance?: Appearance;
  background?: BackgroundKey;
  /** Gesperrt fuer n Spiele. */
  suspension: number;
  yellowCardsInLeague: number;
}

export interface Appearance {
  skinTone: number;
  hairStyle: number;
  hairColor: string;
  beard: number;
  eyeColor: string;
  boots: string;
}

export type BackgroundKey = 'academy' | 'homeClub' | 'street' | 'wonderkid' | 'lateBloomer';

export interface BackgroundDef {
  key: BackgroundKey;
  name: string;
  description: string;
  pros: string[];
  cons: string[];
  attrBonus: Partial<Record<string, number>>;
  potentialMod: number;
  growthMod: number;
  startReputation: number;
  /** Startliga-Level, 3 = dritte Liga. */
  startLevel: number;
  /** Bevorzugte Vereinsreputation beim Start. */
  clubReputationBand: [number, number];
}

// --- Spiele -------------------------------------------------------------

export interface Match {
  id: Id;
  competitionId: Id;
  season: number;
  /** Ligaspieltag oder Pokalrunde. */
  matchday: number;
  roundName?: string;
  date: GameDate;
  homeClubId: Id;
  awayClubId: Id;
  homeScore: number | null;
  awayScore: number | null;
  /** Ergebnis nach Verlaengerung / Elfmeterschiessen. */
  extraTime?: boolean;
  penalties?: [number, number];
  played: boolean;
  neutralVenue?: boolean;
  attendance?: number;
  /** Detaillierte Ereignisse - nur fuer Spiele des eigenen Vereins gespeichert. */
  events?: StoredMatchEvent[];
  userStats?: PlayerMatchStats;
}

export interface StoredMatchEvent {
  minute: number;
  type: 'goal' | 'ownGoal' | 'yellow' | 'secondYellow' | 'red' | 'injury' | 'sub' | 'penaltyMiss' | 'note';
  clubId: Id;
  playerId?: Id;
  assistId?: Id;
  text: string;
}

export interface PlayerMatchStats {
  playerId: Id;
  matchId: Id;
  clubId: Id;
  position: PositionCode;
  started: boolean;
  minutes: number;
  goals: number;
  assists: number;
  shots: number;
  shotsOnTarget: number;
  bigChances: number;
  bigChancesScored: number;
  passes: number;
  passesCompleted: number;
  keyPasses: number;
  crosses: number;
  crossesCompleted: number;
  dribbles: number;
  dribblesCompleted: number;
  duels: number;
  duelsWon: number;
  aerialDuels: number;
  aerialDuelsWon: number;
  tackles: number;
  interceptions: number;
  blocks: number;
  clearances: number;
  fouls: number;
  foulsDrawn: number;
  possessionLost: number;
  saves: number;
  goalsConceded: number;
  penaltiesSaved: number;
  penaltiesScored: number;
  penaltiesMissed: number;
  yellowCards: number;
  redCards: number;
  ownGoals: number;
  rating: number;
  motm: boolean;
}

export function emptyMatchStats(
  playerId: Id, matchId: Id, clubId: Id, position: PositionCode,
): PlayerMatchStats {
  return {
    playerId, matchId, clubId, position,
    started: false, minutes: 0, goals: 0, assists: 0, shots: 0, shotsOnTarget: 0,
    bigChances: 0, bigChancesScored: 0, passes: 0, passesCompleted: 0, keyPasses: 0,
    crosses: 0, crossesCompleted: 0, dribbles: 0, dribblesCompleted: 0,
    duels: 0, duelsWon: 0, aerialDuels: 0, aerialDuelsWon: 0,
    tackles: 0, interceptions: 0, blocks: 0, clearances: 0, fouls: 0, foulsDrawn: 0,
    possessionLost: 0, saves: 0, goalsConceded: 0, penaltiesSaved: 0,
    penaltiesScored: 0, penaltiesMissed: 0, yellowCards: 0, redCards: 0, ownGoals: 0,
    rating: 6, motm: false,
  };
}

/** Aggregierte Saisonwerte je Spieler und Wettbewerb (Konzept Abschnitt 44). */
export interface SeasonStats {
  playerId: Id;
  season: number;
  competitionId: Id;
  clubId: Id;
  appearances: number;
  starts: number;
  minutes: number;
  goals: number;
  assists: number;
  shots: number;
  shotsOnTarget: number;
  passes: number;
  passesCompleted: number;
  keyPasses: number;
  dribbles: number;
  dribblesCompleted: number;
  duels: number;
  duelsWon: number;
  tackles: number;
  interceptions: number;
  saves: number;
  cleanSheets: number;
  goalsConceded: number;
  yellowCards: number;
  redCards: number;
  motm: number;
  ratingSum: number;
  homeAppearances: number;
  homeGoals: number;
  awayGoals: number;
}

export function emptySeasonStats(
  playerId: Id, season: number, competitionId: Id, clubId: Id,
): SeasonStats {
  return {
    playerId, season, competitionId, clubId,
    appearances: 0, starts: 0, minutes: 0, goals: 0, assists: 0, shots: 0,
    shotsOnTarget: 0, passes: 0, passesCompleted: 0, keyPasses: 0, dribbles: 0,
    dribblesCompleted: 0, duels: 0, duelsWon: 0, tackles: 0, interceptions: 0,
    saves: 0, cleanSheets: 0, goalsConceded: 0, yellowCards: 0, redCards: 0,
    motm: 0, ratingSum: 0, homeAppearances: 0, homeGoals: 0, awayGoals: 0,
  };
}

// --- Tabelle ------------------------------------------------------------

export interface TableRow {
  clubId: Id;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
  form: ('S' | 'U' | 'N')[];
}

// --- Nachrichten, Chronik, Rekorde --------------------------------------

export type NewsCategory =
  | 'match' | 'transfer' | 'contract' | 'injury' | 'award' | 'record'
  | 'coach' | 'media' | 'national' | 'season' | 'social';

export interface NewsItem {
  id: Id;
  date: GameDate;
  category: NewsCategory;
  headline: string;
  body: string;
  read: boolean;
  important: boolean;
}

export interface CareerEvent {
  id: Id;
  date: GameDate;
  type: string;
  title: string;
  description: string;
  clubId?: Id;
  competitionId?: Id;
}

export interface RecordEntry {
  key: string;
  label: string;
  scope: string;
  holderName: string;
  holderId?: Id;
  value: number;
  displayValue: string;
  season: number;
  date: GameDate;
}

export interface Award {
  id: Id;
  season: number;
  competitionId?: Id;
  type: string;
  label: string;
  playerId: Id;
  playerName: string;
  value?: string;
}

// --- Training (Konzept Abschnitt 19) ------------------------------------

export type TrainingFocus =
  | 'ballControl' | 'dribbling' | 'passing' | 'crossing' | 'shooting'
  | 'freeKicks' | 'penalties' | 'pace' | 'strength' | 'stamina'
  | 'agility' | 'tactics' | 'defending' | 'heading' | 'goalkeeping'
  | 'mental' | 'recovery';

export type TrainingIntensity = 'leicht' | 'normal' | 'intensiv' | 'sehr intensiv';

export interface TrainingPlan {
  focus: TrainingFocus;
  intensity: TrainingIntensity;
  /** Individuelles Langzeitziel. */
  individualGoal: TrainingFocus | null;
}

// --- Saisonziele --------------------------------------------------------

export interface SeasonObjective {
  id: string;
  label: string;
  target: number;
  current: number;
  kind: 'appearances' | 'goals' | 'assists' | 'rating' | 'teamPosition' | 'overall';
  done: boolean;
  failed: boolean;
  reward: string;
}

// --- Transfers (Konzept Abschnitt 33 und 34) ---------------------------

export interface TransferOffer {
  id: Id;
  clubId: Id;
  fee: number;
  salary: number;
  years: number;
  role: SquadRole;
  goalBonus: number;
  releaseClause?: number;
  /** Warum der Verein interessiert ist - fuer die Anzeige. */
  pitch: string;
  expiresOn: GameDate;
  leagueLevel: number;
  /** Verlaengerung beim eigenen Verein statt Wechsel. */
  renewal?: boolean;
}

// --- Schwierigkeitsgrad (Konzept Abschnitt 59) --------------------------

export type Difficulty = 'einfach' | 'normal' | 'schwer' | 'simulation';

export interface DifficultySettings {
  /** Multiplikator fuer Trefferbereiche bei Minispielen. */
  targetSize: number;
  /** Geschwindigkeit der Kraftanzeige. */
  meterSpeed: number;
  injuryFactor: number;
  growthFactor: number;
  playtimeBonus: number;
  /** Gewicht der Minispiel-Leistung gegenueber den Attributen. */
  inputWeight: number;
  showPotential: boolean;
}

export const DIFFICULTY_SETTINGS: Record<Difficulty, DifficultySettings> = {
  einfach: { targetSize: 1.35, meterSpeed: 0.72, injuryFactor: 0.6, growthFactor: 1.25, playtimeBonus: 8, inputWeight: 0.55, showPotential: true },
  normal: { targetSize: 1.0, meterSpeed: 1.0, injuryFactor: 1.0, growthFactor: 1.0, playtimeBonus: 0, inputWeight: 0.45, showPotential: true },
  schwer: { targetSize: 0.8, meterSpeed: 1.22, injuryFactor: 1.25, growthFactor: 0.82, playtimeBonus: -6, inputWeight: 0.4, showPotential: false },
  simulation: { targetSize: 0.72, meterSpeed: 1.3, injuryFactor: 1.45, growthFactor: 0.72, playtimeBonus: -10, inputWeight: 0.25, showPotential: false },
};

// --- Nationalmannschaft -------------------------------------------------

export interface WncResult {
  year: number;
  championName: string;
  runnerUpName: string;
  /** Wie weit kam die Nation des eigenen Spielers? */
  userNationReached?: string;
  userNominated: boolean;
  userCaps: number;
  userGoals: number;
}

// --- Spielstand ---------------------------------------------------------

export interface GameState {
  saveId: Id;
  saveName: string;
  seed: number;
  rngState: number;
  createdAt: number;
  updatedAt: number;
  version: number;

  difficulty: Difficulty;
  date: GameDate;
  season: number; // Startjahr der Saison
  seasonPhase: 'preseason' | 'inSeason' | 'postSeason';

  userPlayerId: Id;

  countries: Record<Id, Country>;
  competitions: Record<Id, Competition>;
  clubs: Record<Id, Club>;
  players: Record<Id, Player>;
  matches: Record<Id, Match>;

  /** Spielplan sortiert nach Datum - Index fuer schnellen Zugriff. */
  matchesByDate: Record<GameDate, Id[]>;

  /** Tabellen je Wettbewerb und Saison: key = `${competitionId}:${season}` */
  tables: Record<string, Record<Id, TableRow>>;

  /** Saisonstatistiken: key = `${playerId}:${season}:${competitionId}` */
  seasonStats: Record<string, SeasonStats>;

  /** Alle Einzelspielstatistiken des eigenen Spielers. */
  userMatchStats: PlayerMatchStats[];

  news: NewsItem[];
  careerEvents: CareerEvent[];
  records: Record<string, RecordEntry>;
  awards: Award[];

  training: TrainingPlan;
  objectives: SeasonObjective[];

  /** Beziehung zum Trainer des aktuellen Vereins, 0-100. */
  coachRelation: number;
  /** Beliebtheit bei den Fans, 0-100. */
  fanRelation: number;
  /** Oeffentliches Image, 0-100 (0 = Bad Boy, 100 = Vorbild). */
  publicImage: number;
  /** Beziehungen zu Mitspielern: playerId -> Wert -100..100 */
  relationships: Record<Id, number>;
  /** Aktueller Mentor unter den Mitspielern, falls vorhanden. */
  mentorId: Id | null;

  /** Wartet der Spielablauf auf eine Entscheidung des Spielers? */
  pendingMatchId: Id | null;

  /** Stand der Pokalwettbewerbe je Wettbewerbs-ID. */
  cupState: Record<Id, { round: number; alive: Id[]; finished: boolean }>;

  /** Offene Transferangebote an den eigenen Spieler. */
  offers: TransferOffer[];

  /** Titel und Erfolge fuer die Spielstandsuebersicht. */
  honours: { season: number; label: string }[];

  /** Nationalmannschaft (Konzept Abschnitt 12 und 13). */
  nationalCaps: number;
  nationalGoals: number;
  /** Ist der eigene Spieler aktuell nominiert? */
  nationalNominated: boolean;
  /** Historie des World Nations Cup. */
  wncHistory: WncResult[];

  /** Abgeschlossene Laufbahn (Konzept Abschnitt 2). Danach ist nur noch die
   *  Chronik einsehbar. */
  retirement?: Retirement;

  /** Spielerberater (Konzept Abschnitt 35). */
  agent?: Agent;

  /** Zaehler fuer fortlaufende IDs. */
  nextId: number;
}

/** Abschluss der Spielerlaufbahn. */
export interface Retirement {
  season: number;
  date: GameDate;
  age: number;
  /** Warum die Laufbahn endet. */
  reason: 'choice' | 'age' | 'noClub';
  /** Bewertung der Laufbahn, etwa "Vereinslegende". */
  status: string;
  appearances: number;
  goals: number;
  assists: number;
  averageRating: number;
  honours: number;
  clubs: string[];
}

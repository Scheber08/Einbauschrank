/**
 * Die bespielbaren Laender (Konzept Abschnitt 5).
 *
 * Laendernamen sind geografische Bezeichnungen und frei verwendbar. Die
 * Liganamen sind bewusst allgemein gehalten ("Erste Liga" statt geschuetzter
 * Wettbewerbsmarken), damit auch ein veroeffentlichter Build unbedenklich ist.
 * Die Kennungen (id) bleiben unveraendert, damit bestehende Spielstaende und
 * Wettbewerbs-Ids weiter passen.
 */
import type { AttrKey } from './attributes';
import type { TacticStyle } from './types';

export interface CountryDef {
  id: string;
  name: string;
  short: string;
  reputation: number;
  // Beschreibung, Spielstil und Besonderheiten stehen im Sprachkatalog
  // unter `country.<id>.description`, `.style` und `.special1..3`. Sie
  // standen frueher zusaetzlich hier - zwei Fassungen desselben Satzes,
  // von denen nur die eine je angezeigt wurde.
  /** Additive Boni bei der Spielergenerierung. */
  attrBias: Partial<Record<AttrKey, number>>;
  /** Bevorzugte Vereinstaktiken. */
  tactics: TacticStyle[];
  /** Multiplikator fuer Gehaelter und Budgets. */
  wealth: number;
  /** Qualitaet der Nachwuchsarbeit. */
  youth: number;
  /** Namen der Ligen, von der hoechsten abwaerts. Beliebig viele moeglich. */
  leagueNames: string[];
  cupName: string;
}

export const COUNTRIES: CountryDef[] = [
  {
    id: 'falkenland',
    name: 'Deutschland',
    short: 'GER',
    reputation: 78,
    attrBias: {
      discipline: 7, teamwork: 6, defPositioning: 5, concentration: 5,
      strength: 4, stamina: 4, professionalism: 5, decisions: 3,
    },
    tactics: ['highPress', 'buildUp', 'possession', 'counter', 'direct'],
    wealth: 1.0,
    youth: 85,
    leagueNames: [
      'Deutschland Erste Liga', 'Deutschland Zweite Liga',
      'Deutschland Dritte Liga', 'Deutschland Vierte Liga',
    ],
    cupName: 'Deutschland-Pokal',
  },
  {
    id: 'albion',
    name: 'England',
    short: 'ENG',
    reputation: 86,
    attrBias: {
      pace: 6, stamina: 7, strength: 6, crossing: 6, pressing: 6,
      bravery: 5, jumping: 4, longPass: 3,
    },
    tactics: ['highPress', 'direct', 'wingPlay', 'counter', 'longBall'],
    wealth: 1.4,
    youth: 72,
    leagueNames: [
      'England Erste Liga', 'England Zweite Liga',
      'England Dritte Liga', 'England Vierte Liga',
    ],
    cupName: 'England-Pokal',
  },
  {
    id: 'iberia',
    name: 'Spanien',
    short: 'ESP',
    reputation: 84,
    attrBias: {
      shortPass: 8, ballControl: 8, vision: 6, dribbling: 6, firstTouch: 7,
      agility: 5, composure: 4, curve: 4,
    },
    tactics: ['possession', 'buildUp', 'highPress', 'wingPlay'],
    wealth: 1.15,
    youth: 88,
    leagueNames: ['Spanien Erste Liga', 'Spanien Zweite Liga', 'Spanien Dritte Liga'],
    cupName: 'Spanien-Pokal',
  },
  {
    id: 'calcio',
    name: 'Italien',
    short: 'ITA',
    reputation: 80,
    attrBias: {
      defPositioning: 8, marking: 7, tackling: 6, anticipation: 7, concentration: 5,
      reflexes: 5, gkPositioning: 5, blocking: 5, decisions: 4,
    },
    tactics: ['deepBlock', 'counter', 'buildUp', 'possession'],
    wealth: 1.1,
    youth: 74,
    leagueNames: ['Italien Erste Liga', 'Italien Zweite Liga', 'Italien Dritte Liga'],
    cupName: 'Italien-Pokal',
  },
  {
    id: 'gallia',
    name: 'Frankreich',
    short: 'FRA',
    reputation: 76,
    attrBias: {
      acceleration: 8, pace: 7, agility: 6, jumping: 6, tackling: 5,
      strength: 5, balance: 4, dribbling: 4,
    },
    tactics: ['counter', 'wingPlay', 'direct', 'highPress'],
    wealth: 1.05,
    youth: 90,
    leagueNames: ['Frankreich Erste Liga', 'Frankreich Zweite Liga', 'Frankreich Dritte Liga'],
    cupName: 'Frankreich-Pokal',
  },
  {
    id: 'batavia',
    name: 'Niederlande',
    short: 'NED',
    reputation: 70,
    attrBias: {
      shortPass: 7, vision: 6, firstTouch: 6, ballControl: 5,
      decisions: 5, teamwork: 4, pressing: 4,
    },
    tactics: ['possession', 'buildUp', 'highPress', 'wingPlay'],
    wealth: 0.78,
    youth: 94,
    leagueNames: ['Niederlande Erste Liga', 'Niederlande Zweite Liga', 'Niederlande Dritte Liga'],
    cupName: 'Niederlande-Pokal',
  },
  {
    id: 'lusitania',
    name: 'Portugal',
    short: 'POR',
    reputation: 74,
    attrBias: {
      dribbling: 7, ballControl: 6, curve: 5, agility: 5,
      crossing: 4, freeKicks: 4, composure: 3,
    },
    tactics: ['possession', 'wingPlay', 'counter', 'buildUp'],
    wealth: 0.72,
    youth: 88,
    leagueNames: ['Portugal Erste Liga', 'Portugal Zweite Liga', 'Portugal Dritte Liga'],
    cupName: 'Portugal-Pokal',
  },
  {
    id: 'amazonia',
    name: 'Brasilien',
    short: 'BRA',
    reputation: 76,
    attrBias: {
      dribbling: 8, ballControl: 7, agility: 6, balance: 5,
      curve: 5, finishing: 3, discipline: -4,
    },
    tactics: ['possession', 'wingPlay', 'direct', 'counter'],
    wealth: 0.6,
    youth: 92,
    leagueNames: ['Brasilien Erste Liga', 'Brasilien Zweite Liga', 'Brasilien Dritte Liga'],
    cupName: 'Brasilien-Pokal',
  },
  {
    id: 'anatolia',
    name: 'Türkei',
    short: 'TUR',
    reputation: 66,
    attrBias: {
      bravery: 6, strength: 5, longShots: 5, stamina: 4,
      tackling: 4, composure: -3,
    },
    tactics: ['direct', 'counter', 'longBall', 'highPress'],
    wealth: 0.7,
    youth: 66,
    leagueNames: ['Türkei Erste Liga', 'Türkei Zweite Liga', 'Türkei Dritte Liga'],
    cupName: 'Türkei-Pokal',
  },
];

export const COUNTRY_BY_ID: Record<string, CountryDef> = Object.fromEntries(
  COUNTRIES.map((c) => [c.id, c]),
);

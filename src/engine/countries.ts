/**
 * Die fuenf bespielbaren Laender (Konzept Abschnitt 5).
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
  description: string;
  style: string;
  specials: string[];
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
    description: 'Taktisch, diszipliniert, koerperlich, mit starker Nachwuchsarbeit.',
    style: 'Taktisch und diszipliniert',
    specials: ['Starke Trainingsakademien', 'Hohe taktische Anforderungen', 'Viele junge Spieler'],
    attrBias: {
      discipline: 7, teamwork: 6, defPositioning: 5, concentration: 5,
      strength: 4, stamina: 4, professionalism: 5, decisions: 3,
    },
    tactics: ['highPress', 'buildUp', 'possession', 'counter', 'direct'],
    wealth: 1.0,
    youth: 85,
    leagueNames: ['Deutschland Erste Liga', 'Deutschland Zweite Liga', 'Deutschland Dritte Liga'],
    cupName: 'Deutschland-Pokal',
  },
  {
    id: 'albion',
    name: 'England',
    short: 'ENG',
    reputation: 86,
    description: 'Schnell, intensiv, koerperbetont, mit vielen Flanken und hohem Pressing.',
    style: 'Intensiv und koerperbetont',
    specials: ['Hohe Gehaelter', 'Grosse Stadien', 'Starke zweite Liga'],
    attrBias: {
      pace: 6, stamina: 7, strength: 6, crossing: 6, pressing: 6,
      bravery: 5, jumping: 4, longPass: 3,
    },
    tactics: ['highPress', 'direct', 'wingPlay', 'counter', 'longBall'],
    wealth: 1.4,
    youth: 72,
    leagueNames: ['England Erste Liga', 'England Zweite Liga', 'England Dritte Liga'],
    cupName: 'England-Pokal',
  },
  {
    id: 'iberia',
    name: 'Spanien',
    short: 'ESP',
    reputation: 84,
    description: 'Technisch, ballbesitzorientiert, mit kreativer Offensive und starken Dribblern.',
    style: 'Technisch und ballbesitzorientiert',
    specials: ['Grosse technische Talente', 'Starke Nachwuchsakademien'],
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
    description: 'Defensiv, taktisch, kontrolliert, mit gutem Stellungsspiel und starken Torhuetern.',
    style: 'Defensiv und taktisch',
    specials: ['Erfahrene Profis', 'Schwierige Defensivreihen', 'Hoher Stellenwert von Taktik'],
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
    description: 'Athletisch, schnell, direkt, mit starken Fluegelspielern und intensiven Zweikaempfen.',
    style: 'Athletisch und direkt',
    specials: ['Viele junge Talente', 'Grosse Unterschiede zwischen den Vereinen'],
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
];

export const COUNTRY_BY_ID: Record<string, CountryDef> = Object.fromEntries(
  COUNTRIES.map((c) => [c.id, c]),
);

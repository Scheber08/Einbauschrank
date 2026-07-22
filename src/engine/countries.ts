/** Die fuenf fiktiven Laender (Konzept Abschnitt 5). */
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
  leagueNames: [string, string, string];
  cupName: string;
}

export const COUNTRIES: CountryDef[] = [
  {
    id: 'falkenland',
    name: 'Falkenland',
    short: 'FAL',
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
    leagueNames: ['Falkenland Oberliga', 'Falkenland Zweite Liga', 'Falkenland Dritte Liga'],
    cupName: 'Falkenland-Pokal',
  },
  {
    id: 'albion',
    name: 'Albion',
    short: 'ALB',
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
    leagueNames: ['Albion Premier League', 'Albion Championship', 'Albion League One'],
    cupName: 'Albion Cup',
  },
  {
    id: 'iberia',
    name: 'Iberia',
    short: 'IBE',
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
    leagueNames: ['Iberia Primera', 'Iberia Segunda', 'Iberia Tercera'],
    cupName: 'Copa Iberia',
  },
  {
    id: 'calcio',
    name: 'Calcio',
    short: 'CAL',
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
    leagueNames: ['Calcio Serie Prima', 'Calcio Serie Seconda', 'Calcio Serie Terza'],
    cupName: 'Coppa Calcio',
  },
  {
    id: 'gallia',
    name: 'Gallia',
    short: 'GAL',
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
    leagueNames: ['Gallia Ligue Prime', 'Gallia Ligue Deux', 'Gallia Ligue Trois'],
    cupName: 'Coupe de Gallia',
  },
];

export const COUNTRY_BY_ID: Record<string, CountryDef> = Object.fromEntries(
  COUNTRIES.map((c) => [c.id, c]),
);

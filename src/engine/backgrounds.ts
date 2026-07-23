/** Karrierehintergruende (Konzept Abschnitt 15). */
import type { BackgroundDef, BackgroundKey } from './types';

export const BACKGROUNDS: Record<BackgroundKey, BackgroundDef> = {
  academy: {
    key: 'academy',
    name: 'Nachwuchsakademie',
    description: 'Du bist im Internat eines groesseren Vereins ausgebildet worden.',
    pros: ['Gute Trainingsbedingungen', 'Hohe technische Grundwerte', 'Bessere Trainer'],
    cons: ['Starke Konkurrenz', 'Wenig garantierte Einsatzzeit', 'Hoher Leistungsdruck'],
    attrBonus: {
      ballControl: 7, shortPass: 6, firstTouch: 6, teamwork: 5, discipline: 5,
      decisions: 4, defPositioning: 3, professionalism: 5,
    },
    potentialMod: 6,
    growthMod: 1.12,
    startReputation: 22,
    startLevel: 2,
    // Bewusst kein Spitzenverein: der Abstand zum Stammkader muss aufholbar bleiben.
    clubReputationBand: [36, 56],
  },
  homeClub: {
    key: 'homeClub',
    name: 'Kleiner Heimatverein',
    description: 'Du spielst seit der Jugend fuer den Verein deiner Heimatstadt.',
    pros: ['Frueh Einsatzzeiten', 'Gute Beziehung zum Verein', 'Hohe Fanunterstuetzung'],
    cons: ['Schwaechere Trainingsbedingungen', 'Geringere Aufmerksamkeit', 'Niedriges Gehalt'],
    attrBonus: {
      teamwork: 6, resilience: 5, stamina: 5, bravery: 5, discipline: 4, ambition: 3,
    },
    potentialMod: 2,
    growthMod: 1.0,
    startReputation: 12,
    startLevel: 3,
    clubReputationBand: [16, 38],
  },
  street: {
    key: 'street',
    name: 'Strassenfussballer',
    description: 'Du hast dir alles auf dem Bolzplatz beigebracht.',
    pros: ['Dribbling', 'Kreativitaet', 'Ballkontrolle'],
    cons: ['Schwaches taktisches Verstaendnis', 'Geringere Disziplin', 'Wenig Erfahrung'],
    attrBonus: {
      dribbling: 12, ballControl: 8, agility: 7, balance: 6, curve: 5, vision: 4,
      discipline: -10, defPositioning: -8, teamwork: -6, professionalism: -5,
    },
    potentialMod: 4,
    growthMod: 1.05,
    startReputation: 10,
    startLevel: 3,
    clubReputationBand: [14, 34],
  },
  wonderkid: {
    key: 'wonderkid',
    name: 'Grosses Talent',
    description: 'Du giltst als groesstes Versprechen deines Jahrgangs.',
    pros: ['Hohe Startwerte', 'Grosses Potenzial', 'Frueh Medienaufmerksamkeit'],
    cons: ['Hoher Erwartungsdruck', 'Strengere Bewertung', 'Gefahr eines Karriereeinbruchs'],
    attrBonus: {
      ballControl: 6, dribbling: 5, finishing: 4, acceleration: 5, agility: 4, vision: 4,
      composure: -4, concentration: -3,
    },
    potentialMod: 16,
    growthMod: 1.2,
    startReputation: 46,
    startLevel: 1,
    clubReputationBand: [66, 95],
  },
  lateBloomer: {
    key: 'lateBloomer',
    name: 'Spaetstarter',
    description: 'Du kommst spaeter als andere, bringst dafuer Reife mit.',
    pros: ['Bessere Mentalitaet', 'Hohe Disziplin', 'Schnelle Anpassung'],
    cons: ['Niedrigeres maximales Potenzial', 'Weniger Entwicklungszeit'],
    attrBonus: {
      discipline: 10, professionalism: 10, concentration: 8, decisions: 7,
      resilience: 8, composure: 6, strength: 4,
    },
    potentialMod: -6,
    growthMod: 1.3,
    startReputation: 8,
    startLevel: 3,
    clubReputationBand: [14, 36],
  },
};

export const BACKGROUND_LIST = Object.values(BACKGROUNDS);

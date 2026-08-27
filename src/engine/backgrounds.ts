/** Karrierehintergruende (Konzept Abschnitt 15). */
import type { BackgroundDef, BackgroundKey } from './types';

export const BACKGROUNDS: Record<BackgroundKey, BackgroundDef> = {
  academy: {
    key: 'academy',
    name: 'bg.academy.name',
    description: 'bg.academy.desc',
    pros: ['bg.academy.pro.1', 'bg.academy.pro.2', 'bg.academy.pro.3'],
    cons: ['bg.academy.con.1', 'bg.academy.con.2', 'bg.academy.con.3'],
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
    name: 'bg.homeClub.name',
    description: 'bg.homeClub.desc',
    pros: ['bg.homeClub.pro.1', 'bg.homeClub.pro.2', 'bg.homeClub.pro.3'],
    cons: ['bg.homeClub.con.1', 'bg.homeClub.con.2', 'bg.homeClub.con.3'],
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
    name: 'bg.street.name',
    description: 'bg.street.desc',
    pros: ['bg.street.pro.1', 'bg.street.pro.2', 'bg.street.pro.3'],
    cons: ['bg.street.con.1', 'bg.street.con.2', 'bg.street.con.3'],
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
    name: 'bg.wonderkid.name',
    description: 'bg.wonderkid.desc',
    pros: ['bg.wonderkid.pro.1', 'bg.wonderkid.pro.2', 'bg.wonderkid.pro.3'],
    cons: ['bg.wonderkid.con.1', 'bg.wonderkid.con.2', 'bg.wonderkid.con.3'],
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
    name: 'bg.lateBloomer.name',
    description: 'bg.lateBloomer.desc',
    pros: ['bg.lateBloomer.pro.1', 'bg.lateBloomer.pro.2', 'bg.lateBloomer.pro.3'],
    cons: ['bg.lateBloomer.con.1', 'bg.lateBloomer.con.2'],
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

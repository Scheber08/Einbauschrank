/**
 * Vereinsidentitaet: Wappen und Sponsoren (Konzept Abschnitt 5).
 *
 * Alles wird deterministisch aus der Vereins-Id abgeleitet statt gespeichert.
 * So sieht ein Verein in jeder Sitzung gleich aus, bestehende Spielstaende
 * bekommen die Identitaet ohne Migration, und der Spielstand bleibt klein.
 */
import type { Club } from './types';

/** Stabiler Hash eines Strings (FNV-1a). */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Streut einen Hash, damit verschiedene Merkmale nicht korrelieren. */
function mix(seed: number, salt: number): number {
  let t = (seed + salt * 0x9e3779b9) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

const pick = <T>(arr: readonly T[], value: number): T => arr[Math.floor(value * arr.length) % arr.length];

// --- Wappen ------------------------------------------------------------

export type CrestShape = 'shield' | 'round' | 'diamond' | 'banner';
export type CrestPattern = 'stripes' | 'halves' | 'sash' | 'hoop' | 'plain' | 'chevron';

export interface CrestStyle {
  shape: CrestShape;
  pattern: CrestPattern;
  /** Gruendungsjahr - erscheint auf manchen Wappen. */
  founded: number;
  /** Stern ueber dem Wappen fuer traditionsreiche Vereine. */
  star: boolean;
}

const SHAPES: CrestShape[] = ['shield', 'round', 'diamond', 'banner'];
const PATTERNS: CrestPattern[] = ['stripes', 'halves', 'sash', 'hoop', 'plain', 'chevron'];

/** Wappenform eines Vereins - stabil ueber alle Sitzungen. */
export function crestStyle(club: Club): CrestStyle {
  const h = hash(club.id);
  return {
    shape: pick(SHAPES, mix(h, 1)),
    pattern: pick(PATTERNS, mix(h, 2)),
    founded: 1890 + Math.floor(mix(h, 3) * 80),
    star: club.reputation >= 72,
  };
}

/** Kuerzel fuer das Wappen: bevorzugt das Vereinskuerzel, sonst Initialen. */
export function crestLabel(club: Club): string {
  if (club.short && club.short.length <= 4) return club.short.toUpperCase();
  const words = club.name.split(/\s+/).filter((w) => w.length > 2);
  return words.slice(0, 3).map((w) => w[0]).join('').toUpperCase() || '?';
}

// --- Sponsoren ---------------------------------------------------------

/** Fiktive Marken - bewusst erfunden, keine realen Unternehmen. */
const BRAND_PREFIX = [
  'Nord', 'Vega', 'Aurel', 'Kron', 'Helio', 'Mera', 'Talon', 'Orbis', 'Vertan',
  'Salda', 'Firn', 'Corvus', 'Lumen', 'Aster', 'Baltra', 'Novum', 'Ferra', 'Kastel',
];
const BRAND_SUFFIX = [
  'bank', 'tech', 'werke', 'energie', 'mobil', 'versicherung', 'logistik',
  'telekom', 'brauerei', 'motors', 'air', 'systems',
];
/** Kleinere Vereine tragen bodenstaendige Partner auf der Brust. */
const LOCAL_TRADES = [
  'Baustoffe', 'Autohaus', 'Baeckerei', 'Getraenke', 'Elektro', 'Dachbau',
  'Moebelhaus', 'Fahrschule', 'Gartenbau', 'Metzgerei',
];
const LOCAL_NAMES = [
  'Bergmann', 'Hoffmann', 'Wieland', 'Kranz', 'Sattler', 'Reinhard',
  'Ostermann', 'Dahlke', 'Fuchs', 'Brandt',
];

export interface ClubSponsors {
  /** Trikotsponsor - steht auf der Brust. */
  shirt: string;
  /** Ausruester. */
  kit: string;
}

const KIT_BRANDS = ['Volaris', 'Strider', 'Ferox', 'Alta', 'Kinetik', 'Nordpeak', 'Vantis'];

/**
 * Sponsoren eines Vereins. Grosse Vereine tragen ueberregionale Marken,
 * kleine Vereine lokale Betriebe - das macht den Ligaunterschied spuerbar.
 */
export function clubSponsors(club: Club): ClubSponsors {
  return sponsorsFor(club.id, club.reputation);
}

/** Wie clubSponsors, aber schon vor dem fertigen Vereinsobjekt nutzbar. */
export function sponsorsFor(clubId: string, reputation: number): ClubSponsors {
  const h = hash(clubId);
  const shirt = reputation >= 55
    ? `${pick(BRAND_PREFIX, mix(h, 11))}${pick(BRAND_SUFFIX, mix(h, 12))}`
    : `${pick(LOCAL_NAMES, mix(h, 13))} ${pick(LOCAL_TRADES, mix(h, 14))}`;
  return { shirt, kit: pick(KIT_BRANDS, mix(h, 15)) };
}

/** Geschaetzte jaehrliche Sponsoringsumme - fuer die Vereinsdarstellung. */
export function sponsorValue(club: Club): number {
  const h = hash(club.id);
  const base = Math.pow(club.reputation, 2.2) * 220;
  return Math.round((base * (0.8 + mix(h, 16) * 0.5)) / 10000) * 10000;
}

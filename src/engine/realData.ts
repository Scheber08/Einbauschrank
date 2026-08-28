/**
 * Woher Vereins- und Spielernamen kommen.
 *
 * Es gibt zwei Quellen, in dieser Reihenfolge:
 *  1. eine im Hauptmenue geladene CSV-Datenbank (liegt nur im Browser),
 *  2. Dateien unter src/data/*.local.json (stehen in .gitignore).
 *
 * Fehlt beides, faellt der Weltgenerator lueckenlos auf die erfundenen Namen
 * aus names.ts zurueck. Es gibt also keinen Pflichtinhalt - und nichts davon
 * gelangt jemals ins Repository.
 */

import { COUNTRY_BY_ID } from './countries';
import { activeDatabase } from './customDb';

/** Ein Verein aus einem Datenpaket. Nur `name` ist Pflicht. */
export interface RealClub {
  name: string;
  /** Kuerzel fuer Wappen und Tabellen, bis vier Zeichen. */
  short?: string;
  city?: string;
  /** Trikotfarben als [primaer, sekundaer], jeweils als Hex-Wert. */
  colors?: [string, string];
  stadium?: string;
  capacity?: number;
  /** 1-100. Fehlt der Wert, verteilt der Generator ihn nach Tabellenrang. */
  reputation?: number;
  manager?: string;
  /** Dateiname eines Wappens aus einer geladenen CSV-Datenbank. */
  crest?: string;
  /**
   * Kadernamen. Die Spielstaerken werden weiterhin aus der Vereinsreputation
   * erzeugt - hier stehen ausschliesslich Namen, keine Werte.
   *
   * Zwei Schreibweisen sind erlaubt:
   *   "Vorname Nachname"            - Position beliebig
   *   { "name": "...", "pos": "TW" } - Name wird nur auf diese Position gelegt
   *
   * Ohne Positionsangabe verteilt der Generator die Namen der Reihe nach auf
   * die staerksten Kaderplaetze. Mit Angabe landet der Torwart im Tor.
   */
  squad?: (string | RealSquadEntry)[];
}

export interface RealSquadEntry {
  name: string;
  /** Positionskuerzel wie in attributes.ts: TW, IV, LV, RV, DM, ZM, OM, LA, RA, ST. */
  pos?: string;
  /** Herkunftsnation als Kennung aus nations.ts. Fehlt sie, wuerfelt das Spiel. */
  nation?: string;
}

export interface RealLeague {
  /** 1 = hoechste Spielklasse. */
  level: number;
  name?: string;
  clubs: RealClub[];
}

export interface RealCountryData {
  /** Muss einer Id aus countries.ts entsprechen, z. B. "falkenland". */
  country: string;
  /** Ersetzt den Anzeigenamen des Landes, z. B. "Deutschland". */
  displayName?: string;
  cupName?: string;
  leagues: RealLeague[];
}

/**
 * Vite liest zur Bauzeit alle passenden Dateien ein. Fehlen sie, ist das
 * Ergebnis ein leeres Objekt - kein Fehler, kein fehlender Import.
 *
 * WICHTIG fuer veroeffentlichte Builds: Diese Dateien werden sonst in das
 * ausgelieferte JavaScript einkompiliert und waeren damit oeffentlich
 * abrufbar. `npm run build:public` setzt VITE_PUBLIC_BUILD und laesst sie
 * weg - der Zweig faellt beim Bauen ersatzlos heraus. Wer die Seite ins Netz
 * stellt, baut ausschliesslich damit.
 */
const modules = import.meta.env.VITE_PUBLIC_BUILD === '1'
  ? {}
  : import.meta.glob<RealCountryData>('../data/*.local.json', {
    eager: true,
    import: 'default',
  });

function collect(): Record<string, RealCountryData> {
  const out: Record<string, RealCountryData> = {};
  for (const [path, data] of Object.entries(modules)) {
    if (!data || typeof data.country !== 'string' || !Array.isArray(data.leagues)) {
      console.warn(`[realData] ${path} uebersprungen: country oder leagues fehlt.`);
      continue;
    }
    out[data.country] = data;
  }
  return out;
}

const BY_COUNTRY = collect();

/** Reihenfolge, in der fremde Laenderkennungen auf die Spiellaender fallen. */
const GAME_COUNTRIES = ['falkenland', 'albion', 'iberia', 'calcio', 'gallia'];

/**
 * Eine im Hauptmenue geladene CSV-Datenbank hat Vorrang vor den Dateien unter
 * src/data. Sie wird hier in dieselbe Form gebracht, damit der Weltgenerator
 * nur eine Schnittstelle kennen muss.
 */
function fromCustom(): Record<string, RealCountryData> | null {
  const db = activeDatabase();
  if (!db) return null;

  // Fremde Laenderkennungen der Reihe nach auf die Spiellaender legen.
  const mapping = new Map<string, string>();
  let next = 0;
  for (const comp of db.competitions) {
    if (mapping.has(comp.country)) continue;
    const direct = GAME_COUNTRIES.includes(comp.country) ? comp.country : null;
    const target = direct ?? GAME_COUNTRIES[next] ?? GAME_COUNTRIES[GAME_COUNTRIES.length - 1];
    if (!direct) next++;
    mapping.set(comp.country, target);
  }

  const out: Record<string, RealCountryData> = {};
  for (const comp of db.competitions) {
    const countryId = mapping.get(comp.country)!;
    const entry = out[countryId] ?? {
      country: countryId,
      displayName: db.countries[comp.country],
      leagues: [],
    };
    if (comp.kind === 'pokal') {
      entry.cupName = comp.name;
    } else {
      entry.leagues.push({
        level: comp.level ?? entry.leagues.length + 1,
        name: comp.name,
        clubs: comp.clubs.map((c) => ({
          name: c.name,
          short: c.short,
          city: c.city,
          colors: c.colors,
          stadium: c.stadium,
          capacity: c.capacity,
          reputation: c.reputation,
          manager: c.manager,
          crest: c.crest,
          squad: c.squad.map((s) => (s.pos ? { name: s.name, pos: s.pos } : s.name)),
        })),
      });
    }
    out[countryId] = entry;
  }
  return out;
}

/** Aktuell gueltige Datenlage: geladene Datenbank, sonst die Dateien. */
function current(): Record<string, RealCountryData> {
  return fromCustom() ?? BY_COUNTRY;
}

/** Sind ueberhaupt eigene Daten hinterlegt? */
export function hasRealData(): boolean {
  return Object.keys(current()).length > 0;
}

/** Welche Laender ein Datenpaket mitbringen - fuer Hinweise in der Oberflaeche. */
export function realDataCountries(): string[] {
  return Object.keys(current());
}

export function realCountry(countryId: string): RealCountryData | undefined {
  return current()[countryId];
}

/**
 * Der Verein auf einem Tabellenrang, falls hinterlegt.
 * `rank` zaehlt ab 0 und entspricht der Reihenfolge im Datenpaket.
 */
export function realClub(countryId: string, level: number, rank: number): RealClub | undefined {
  const league = current()[countryId]?.leagues.find((l) => l.level === level);
  return league?.clubs[rank];
}

/** Ersetzt den Liganamen, falls im Datenpaket angegeben. */
export function realLeagueName(countryId: string, level: number): string | undefined {
  return current()[countryId]?.leagues.find((l) => l.level === level)?.name;
}

/** Ein Ligasystem: welche Ebenen es gibt und wie viele Vereine je Ebene. */
export interface LeagueLayout {
  level: number;
  clubs: number;
}

/** Ohne eigene Daten spielt das Spiel drei Ligen zu je zwanzig Vereinen. */
export const DEFAULT_LEVELS = 3;
export const DEFAULT_CLUBS_PER_LEAGUE = 20;

/**
 * Aufbau des Ligasystems eines Landes.
 *
 * Liegen eigene Daten vor, bestimmen sie Anzahl und Groesse der Ligen - eine
 * Liga mit achtzehn Vereinen oder ein System mit fuenf Ebenen ist damit
 * moeglich. Ohne Daten bleibt es beim Standardaufbau.
 *
 * Sehr kleine Ligen sind nicht sinnvoll: Unter vier Vereinen liesse sich kein
 * Spielplan bauen, darum wird nach oben aufgefuellt.
 */
/**
 * Der Aufbau des Ligasystems eines Landes.
 *
 * Ohne eigene Daten richtet er sich nach `leagueNames` des Landes.
 * Vorher stand dort eine feste Zahl: das Feld versprach im Kommentar
 * "beliebig viele moeglich", steuerte aber nur die **Namen** - ein Land mit
 * vier eingetragenen Ligen bekam trotzdem drei, und die vierte Bezeichnung
 * wurde nie benutzt.
 */
export function leagueLayout(countryId: string): LeagueLayout[] {
  const data = current()[countryId];
  const leagues = data?.leagues?.filter((l) => l.clubs.length > 0) ?? [];
  if (leagues.length === 0) {
    const stufen = COUNTRY_BY_ID[countryId]?.leagueNames.length ?? DEFAULT_LEVELS;
    return Array.from({ length: Math.max(1, stufen) }, (_, i) => ({
      level: i + 1, clubs: DEFAULT_CLUBS_PER_LEAGUE,
    }));
  }
  return leagues
    .slice()
    .sort((a, b) => a.level - b.level)
    .map((l) => ({ level: l.level, clubs: Math.max(4, l.clubs.length) }));
}

export interface SplitName {
  firstName: string;
  lastName: string;
  /** Nur gesetzt, wenn die Vorlage eine Herkunft mitbringt. */
  nation?: string;
}

/** "Manuel Neuer" -> Vor- und Nachname. Mehrteilige Nachnamen bleiben ganz. */
export function splitName(full: string): SplitName {
  const parts = full.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: '', lastName: parts[0] };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

/**
 * Verteilt Kadernamen auf die erzeugten Spielerplaetze.
 *
 * `positions` steht in der Reihenfolge des Kaders - Platz 0 ist der staerkste.
 * Eintraege mit Positionsangabe werden zuerst gesetzt, damit ein Torwart auch
 * im Tor landet. Der Rest wird von oben nach unten aufgefuellt, sodass die
 * zuerst genannten Namen die besten Spieler werden.
 *
 * Rueckgabe: Array parallel zu `positions`, `null` heisst "erzeugten Namen behalten".
 */
export function assignSquadNames(
  entries: (string | RealSquadEntry)[],
  positions: string[],
): (SplitName | null)[] {
  const result: (SplitName | null)[] = positions.map(() => null);
  const taken = new Set<number>();

  const normalised = entries.map((e) => (typeof e === 'string' ? { name: e } : e));
  const withPos = normalised.filter((e) => e.pos);
  const withoutPos = normalised.filter((e) => !e.pos);

  for (const entry of withPos) {
    const wanted = entry.pos!.toUpperCase();
    const slot = positions.findIndex((p, i) => !taken.has(i) && p.toUpperCase() === wanted);
    if (slot === -1) {
      // Keine passende Position frei - der Name wandert in den allgemeinen Topf.
      withoutPos.push({ name: entry.name, nation: entry.nation });
      continue;
    }
    taken.add(slot);
    result[slot] = { ...splitName(entry.name), nation: entry.nation };
  }

  let cursor = 0;
  for (const entry of withoutPos) {
    while (cursor < positions.length && taken.has(cursor)) cursor++;
    if (cursor >= positions.length) break;
    taken.add(cursor);
    result[cursor] = { ...splitName(entry.name), nation: entry.nation };
  }

  return result;
}

/** Kuerzel aus dem Vereinsnamen ableiten, wenn keines angegeben ist. */
export function deriveShort(name: string): string {
  const words = name.split(/\s+/).filter((w) => w.length > 2);
  const initials = words.slice(0, 3).map((w) => w[0]).join('').toUpperCase();
  return (initials || name.slice(0, 3)).toUpperCase().slice(0, 4);
}

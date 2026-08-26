/**
 * Eigene Datenbanken im CSV-Format.
 *
 * Das Spiel wird mit einer frei erfundenen Beispieldatenbank ausgeliefert.
 * Wer mit anderen Namen spielen moechte, legt einen Ordner mit CSV-Dateien an
 * und laedt ihn im Hauptmenue. Die Daten landen ausschliesslich im Browser
 * dieses Rechners - sie werden nie mitgeliefert und landen in keinem Build.
 *
 * Aufbau eines Datenordners:
 *
 *   main.csv          Wettbewerbe: Ligen und Pokale, je eine Zeile
 *   <datei>.csv       Vereine eines Wettbewerbs (in main.csv verwiesen)
 *   <datei>.spieler.csv   Kader dieses Wettbewerbs (optional)
 *   *.png / *.jpg     Wappen, ueber den Dateinamen zugeordnet (optional)
 */
import { parseCsv, field, num, type CsvRow } from './csv';
import { findNation } from './nations';

export interface CustomClub {
  name: string;
  short?: string;
  city?: string;
  colors?: [string, string];
  stadium?: string;
  capacity?: number;
  reputation?: number;
  manager?: string;
  /** Dateiname eines mitgelieferten Wappens. */
  crest?: string;
  squad: { name: string; pos?: string; nation?: string }[];
}

export interface CustomCompetition {
  id: string;
  /** 'liga' spielt eine Meisterschaft, 'pokal' ein K.-o.-Turnier. */
  kind: 'liga' | 'pokal';
  country: string;
  name: string;
  short?: string;
  /** Nur fuer Ligen: 1 ist die hoechste Spielklasse. */
  level?: number;
  clubs: CustomClub[];
}

export interface CustomDatabase {
  /** Anzeigename, aus dem Ordnernamen oder der main.csv. */
  name: string;
  /** Zeitpunkt des Imports. */
  importedAt: number;
  countries: Record<string, string>;
  competitions: CustomCompetition[];
  /** Wappen als Data-URL, Schluessel ist der Dateiname. */
  images: Record<string, string>;
}

export interface ImportReport {
  database: CustomDatabase | null;
  errors: string[];
  warnings: string[];
  stats: { competitions: number; clubs: number; players: number; images: number };
}

// --- Einlesen -----------------------------------------------------------

function parseColors(raw1: string, raw2: string): [string, string] | undefined {
  const norm = (c: string) => {
    const t = c.trim();
    if (!t) return '';
    return t.startsWith('#') ? t : `#${t}`;
  };
  const a = norm(raw1);
  const b = norm(raw2);
  if (!a) return undefined;
  return [a, b || '#ffffff'];
}

function readClubs(rows: CsvRow[]): CustomClub[] {
  const out: CustomClub[] = [];
  for (const row of rows) {
    const name = field(row, 'name', 'verein', 'club', 'team');
    if (!name) continue;
    out.push({
      name,
      short: field(row, 'kuerzel', 'kurz', 'short', 'abk') || undefined,
      city: field(row, 'stadt', 'city', 'ort') || undefined,
      colors: parseColors(
        field(row, 'farbe1', 'farbe', 'color1', 'primaer'),
        field(row, 'farbe2', 'color2', 'sekundaer'),
      ),
      stadium: field(row, 'stadion', 'stadium') || undefined,
      capacity: num(row, 'kapazitaet', 'kapazität', 'capacity', 'plaetze'),
      reputation: num(row, 'ruf', 'reputation', 'staerke', 'stärke'),
      manager: field(row, 'trainer', 'manager', 'coach') || undefined,
      crest: field(row, 'wappen', 'crest', 'logo', 'bild') || undefined,
      squad: [],
    });
  }
  return out;
}

function attachPlayers(clubs: CustomClub[], rows: CsvRow[], warnings: string[]) {
  const byName = new Map(clubs.map((c) => [c.name.toLowerCase(), c]));
  const unknownNations = new Set<string>();
  let unmatched = 0;
  for (const row of rows) {
    const clubName = field(row, 'verein', 'club', 'team', 'mannschaft');
    const name = field(row, 'name', 'spieler', 'player');
    if (!name) continue;
    const club = byName.get(clubName.toLowerCase());
    if (!club) { unmatched++; continue; }
    // Herkunft ist freiwillig; "br", "Brasilien" und "brasilien" sind gleich
    // gemeint. Was sich nicht zuordnen laesst, wuerfelt das Spiel wie bisher.
    const nationInput = field(row, 'nation', 'nationalitaet', 'land', 'herkunft');
    const nation = nationInput ? findNation(nationInput) : null;
    if (nationInput && !nation) unknownNations.add(nationInput);
    club.squad.push({
      name,
      pos: field(row, 'position', 'pos') || undefined,
      nation: nation?.id,
    });
  }
  if (unmatched > 0) {
    warnings.push(`${unmatched} Spieler ohne passenden Verein uebersprungen.`);
  }
  if (unknownNations.size > 0) {
    warnings.push(`Unbekannte Herkunft: ${[...unknownNations].slice(0, 8).join(', ')}`);
  }
}

/** Dateiname ohne Pfad und in Kleinschreibung - zum Zuordnen der Bilder. */
function baseName(path: string): string {
  return path.split(/[\\/]/).pop()!.toLowerCase();
}

/**
 * Baut aus den Dateien eines Ordners eine Datenbank.
 * `files` kommt direkt aus einem Ordner-Upload.
 */
export async function importFolder(files: File[], fallbackName: string): Promise<ImportReport> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const byName = new Map<string, File>();
  for (const f of files) byName.set(baseName(f.name), f);

  const main = byName.get('main.csv');
  if (!main) {
    return {
      database: null,
      errors: ['Keine main.csv im Ordner gefunden. Sie beschreibt die Wettbewerbe.'],
      warnings,
      stats: { competitions: 0, clubs: 0, players: 0, images: 0 },
    };
  }

  const mainRows = parseCsv(await main.text());
  if (mainRows.length === 0) errors.push('main.csv enthaelt keine Zeilen.');

  const countries: Record<string, string> = {};
  const competitions: CustomCompetition[] = [];

  for (const row of mainRows) {
    const id = field(row, 'id', 'kuerzel');
    const name = field(row, 'name', 'wettbewerb', 'liga');
    if (!name) continue;

    const countryId = (field(row, 'land', 'country') || 'eigenes').toLowerCase();
    const countryName = field(row, 'landname', 'landesname') || countryId;
    countries[countryId] = countryName;

    const kindRaw = field(row, 'typ', 'art', 'kind').toLowerCase();
    const kind: 'liga' | 'pokal' = kindRaw.startsWith('pokal') || kindRaw.startsWith('cup')
      ? 'pokal' : 'liga';

    const comp: CustomCompetition = {
      id: id || name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      kind,
      country: countryId,
      name,
      short: field(row, 'kurz', 'short') || undefined,
      level: num(row, 'ebene', 'level', 'stufe'),
      clubs: [],
    };

    const fileRef = field(row, 'datei', 'file', 'vereine');
    if (fileRef) {
      const clubFile = byName.get(baseName(fileRef));
      if (!clubFile) {
        warnings.push(`Datei "${fileRef}" fuer ${name} fehlt - Wettbewerb bleibt leer.`);
      } else {
        comp.clubs = readClubs(parseCsv(await clubFile.text()));
        // Kaderdatei: entweder ausdruecklich benannt oder nach Namensmuster.
        const playerRef = field(row, 'spielerdatei', 'kader', 'players');
        const guess = baseName(fileRef).replace(/\.csv$/, '.spieler.csv');
        const playerFile = byName.get(baseName(playerRef || guess));
        if (playerFile) {
          attachPlayers(comp.clubs, parseCsv(await playerFile.text()), warnings);
        }
      }
    }
    competitions.push(comp);
  }

  // Bilder einlesen und als Data-URL ablegen.
  const images: Record<string, string> = {};
  for (const [key, file] of byName) {
    if (!/\.(png|jpe?g|svg|webp|gif)$/.test(key)) continue;
    if (file.size > 512 * 1024) {
      warnings.push(`${file.name} ist groesser als 512 KB und wurde ausgelassen.`);
      continue;
    }
    images[key] = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  const clubCount = competitions.reduce((a, c) => a + c.clubs.length, 0);
  const playerCount = competitions.reduce(
    (a, c) => a + c.clubs.reduce((b, cl) => b + cl.squad.length, 0), 0,
  );
  if (clubCount === 0) errors.push('Keine Vereine gefunden - stimmen die Dateinamen in main.csv?');

  return {
    database: errors.length > 0 ? null : {
      name: fallbackName,
      importedAt: Date.now(),
      countries,
      competitions,
      images,
    },
    errors,
    warnings,
    stats: {
      competitions: competitions.length,
      clubs: clubCount,
      players: playerCount,
      images: Object.keys(images).length,
    },
  };
}

/**
 * Leere Datenbank zum Loslegen ohne CSV-Dateien.
 *
 * Sie bringt ein Ligasystem mit zwei Ebenen und einen Pokal mit, damit sofort
 * etwas zum Bearbeiten da ist. Vereine legt man im Editor an - oder man laedt
 * spaeter zusaetzlich einen CSV-Ordner.
 */
export function createEmptyDatabase(name: string): CustomDatabase {
  return {
    name,
    importedAt: Date.now(),
    countries: { eigenes: 'Eigenes Land' },
    competitions: [
      { id: 'liga-1', kind: 'liga', country: 'eigenes', name: 'Erste Liga', level: 1, clubs: [] },
      { id: 'liga-2', kind: 'liga', country: 'eigenes', name: 'Zweite Liga', level: 2, clubs: [] },
      { id: 'pokal', kind: 'pokal', country: 'eigenes', name: 'Landespokal', clubs: [] },
    ],
    images: {},
  };
}

// --- Ausgeben -----------------------------------------------------------

export interface ExportFile {
  filename: string;
  content: string;
}

/** Dateiname aus einem Wettbewerbsnamen: klein, ohne Sonderzeichen. */
function slug(text: string): string {
  return text.toLowerCase()
    .replace(/[äÄ]/g, 'ae').replace(/[öÖ]/g, 'oe').replace(/[üÜ]/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'liga';
}

/**
 * Schreibt die Datenbank zurueck in CSV-Dateien - dieselbe Form, die der
 * Import erwartet. So laesst sich im Browser Bearbeitetes sichern, weitergeben
 * oder ausserhalb weiterpflegen.
 */
export function exportDatabase(db: CustomDatabase): ExportFile[] {
  const files: ExportFile[] = [];
  const D = ';';
  const esc = (v: string) => (v.includes(D) || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v);

  const mainLines = ['id;typ;land;landname;name;ebene;datei'];
  for (const comp of db.competitions) {
    const file = comp.kind === 'liga' ? `${slug(comp.name)}.csv` : '';
    mainLines.push([
      comp.id, comp.kind, comp.country, db.countries[comp.country] ?? comp.country,
      comp.name, comp.level ?? '', file,
    ].map((v) => esc(String(v))).join(D));

    if (comp.kind !== 'liga') continue;

    const clubLines = ['name;kuerzel;stadt;farbe1;farbe2;stadion;kapazitaet;ruf;trainer;wappen'];
    const playerLines = ['verein;name;position;nation'];
    for (const c of comp.clubs) {
      clubLines.push([
        c.name, c.short ?? '', c.city ?? '', c.colors?.[0] ?? '', c.colors?.[1] ?? '',
        c.stadium ?? '', c.capacity ?? '', c.reputation ?? '', c.manager ?? '', c.crest ?? '',
      ].map((v) => esc(String(v))).join(D));
      for (const p of c.squad) {
        playerLines.push(
          [c.name, p.name, p.pos ?? '', p.nation ?? ''].map((v) => esc(String(v))).join(D),
        );
      }
    }
    files.push({ filename: file, content: `${clubLines.join('\n')}\n` });
    if (playerLines.length > 1) {
      files.push({
        filename: file.replace(/\.csv$/, '.spieler.csv'),
        content: `${playerLines.join('\n')}\n`,
      });
    }
  }

  files.unshift({ filename: 'main.csv', content: `${mainLines.join('\n')}\n` });
  return files;
}

// --- Ablage im Browser --------------------------------------------------

const DB_NAME = 'road-to-glory-data';
const STORE = 'databases';
const ACTIVE_KEY = 'rtg:activeDatabase';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'name' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T> | void) {
  return openDb().then((db) => new Promise<T | undefined>((resolve, reject) => {
    const t = db.transaction([STORE], mode);
    let result: T | undefined;
    const req = run(t.objectStore(STORE));
    if (req) req.onsuccess = () => { result = req.result; };
    t.oncomplete = () => { db.close(); resolve(result); };
    t.onerror = () => { db.close(); reject(t.error); };
  }));
}

export async function saveDatabase(db: CustomDatabase): Promise<void> {
  await tx('readwrite', (store) => store.put(db));
}

export async function listDatabases(): Promise<CustomDatabase[]> {
  const all = await tx<CustomDatabase[]>('readonly', (store) => store.getAll() as IDBRequest<CustomDatabase[]>);
  return (all ?? []).sort((a, b) => b.importedAt - a.importedAt);
}

export async function loadDatabase(name: string): Promise<CustomDatabase | null> {
  const db = await tx<CustomDatabase>('readonly', (store) => store.get(name) as IDBRequest<CustomDatabase>);
  return db ?? null;
}

export async function deleteDatabase(name: string): Promise<void> {
  await tx('readwrite', (store) => store.delete(name));
  if (getActiveName() === name) setActiveName(null);
}

/** Welche Datenbank soll die naechste Karriere verwenden? */
export function getActiveName(): string | null {
  try { return localStorage.getItem(ACTIVE_KEY); } catch { return null; }
}

export function setActiveName(name: string | null) {
  try {
    if (name) localStorage.setItem(ACTIVE_KEY, name);
    else localStorage.removeItem(ACTIVE_KEY);
  } catch { /* kein Speicher verfuegbar */ }
}

/**
 * Die aktive Datenbank steht dem Weltgenerator zur Verfuegung. Sie wird beim
 * Start einmal geladen und hier gehalten, weil der Generator synchron laeuft.
 */
let active: CustomDatabase | null = null;

export function setActiveDatabase(db: CustomDatabase | null) {
  active = db;
}

export function activeDatabase(): CustomDatabase | null {
  return active;
}

/** Laedt die zuletzt gewaehlte Datenbank, falls vorhanden. */
export async function restoreActiveDatabase(): Promise<CustomDatabase | null> {
  const name = getActiveName();
  if (!name) { active = null; return null; }
  active = await loadDatabase(name);
  return active;
}

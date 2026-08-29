/**
 * Spielstandsverwaltung ueber IndexedDB (Konzept Abschnitt 43 und 53).
 * Jeder Spielstand besitzt eine eigene Save-ID, damit sich Daten
 * verschiedener Karrieren niemals vermischen koennen.
 */
import { t } from '../i18n';
import { ALL_ATTRS } from './attributes';
import { ageOn, seasonLabel, year } from './date';
import { normalizeNationality } from './nations';
import type { GameState } from './types';

const DB_NAME = 'road-to-glory';
const DB_VERSION = 1;
const STORE_SAVES = 'saves';
const STORE_META = 'meta';

export interface SaveMeta {
  saveId: string;
  saveName: string;
  playerName: string;
  age: number;
  position: string;
  clubName: string;
  /** Vereinsdaten fuer das Wappen im Hauptmenue. Bei aelteren Staenden leer. */
  clubId?: string;
  clubShort?: string;
  clubColors?: [string, string];
  clubReputation?: number;
  leagueName: string;
  season: string;
  careerYears: number;
  difficulty: string;
  honours: string[];
  goals: number;
  appearances: number;
  updatedAt: number;
  createdAt: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_SAVES)) {
        db.createObjectStore(STORE_SAVES, { keyPath: 'saveId' });
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: 'saveId' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function tx<T>(
  storeNames: string[], mode: IDBTransactionMode,
  run: (stores: Record<string, IDBObjectStore>) => IDBRequest<T> | void,
): Promise<T | undefined> {
  return openDb().then((db) => new Promise<T | undefined>((resolve, reject) => {
    const transaction = db.transaction(storeNames, mode);
    const stores: Record<string, IDBObjectStore> = {};
    for (const name of storeNames) stores[name] = transaction.objectStore(name);
    let result: T | undefined;
    const request = run(stores);
    if (request) request.onsuccess = () => { result = request.result; };
    transaction.oncomplete = () => { db.close(); resolve(result); };
    transaction.onerror = () => { db.close(); reject(transaction.error); };
    transaction.onabort = () => { db.close(); reject(transaction.error); };
  }));
}

export function buildMeta(state: GameState): SaveMeta {
  const user = state.players[state.userPlayerId];
  const club = user?.clubId ? state.clubs[user.clubId] : null;
  const league = club ? state.competitions[club.leagueId] : null;
  const careerStats = Object.values(state.seasonStats).filter(
    (s) => s.playerId === state.userPlayerId);
  // Das erste Karriereereignis markiert den Beginn der Laufbahn.
  const firstEvent = state.careerEvents[0];
  const startSeason = firstEvent ? year(firstEvent.date) : state.season;

  return {
    saveId: state.saveId,
    saveName: state.saveName,
    playerName: user ? `${user.firstName} ${user.lastName}` : 'Unbekannt',
    age: user ? ageOn(user.birthDate, state.date) : 0,
    position: user?.position ?? '-',
    clubName: club?.name ?? 'Vereinslos',
    clubId: club?.id,
    clubShort: club?.short,
    clubColors: club?.colors,
    clubReputation: club?.reputation,
    leagueName: league?.name ?? '-',
    season: seasonLabel(state.season),
    careerYears: Math.max(1, state.season - startSeason + 1),
    difficulty: state.difficulty,
    honours: state.honours.slice(-6).map((h) => h.label),
    goals: careerStats.reduce((a, s) => a + s.goals, 0),
    appearances: careerStats.reduce((a, s) => a + s.appearances, 0),
    updatedAt: state.updatedAt,
    createdAt: state.createdAt,
  };
}

/**
 * Attribute als Zahlenfeld statt als Verzeichnis speichern.
 *
 * Ein Spieler belegt 1397 Byte, davon **815 allein die 54
 * Attributnamen** - bei 13.500 Spielern sind das elf Megabyte reine
 * Schluesselwiederholung. Als Feld in der festen Reihenfolge von
 * `ALL_ATTRS` bleiben davon rund 160 Byte.
 *
 * Die Reihenfolge ist damit Teil des Speicherformats: **neue Attribute
 * gehoeren ans Ende von `ALL_ATTRS`**, sonst liest ein alter Spielstand
 * die falschen Werte. Deshalb steht die Laenge mit im Spielstand, und
 * beim Entpacken wird sie geprueft.
 */
function packeAttribute(state: GameState): GameState {
  const kopie = structuredClone(state) as GameState & {
    attrOrder?: number;
  };
  for (const p of Object.values(kopie.players)) {
    const werte = ALL_ATTRS.map((k) => p.attrs[k]);
    (p as unknown as { attrs: unknown }).attrs = werte;
  }
  kopie.attrOrder = ALL_ATTRS.length;
  return kopie;
}

/** Macht die Packung rueckgaengig. Ungepackte Staende bleiben unberuehrt. */
function entpackeAttribute(state: GameState): GameState {
  const gepackt = state as GameState & { attrOrder?: number };
  for (const p of Object.values(state.players)) {
    const roh = (p as unknown as { attrs: unknown }).attrs;
    if (!Array.isArray(roh)) continue;
    // Ein Spielstand mit anderer Attributzahl waere falsch entpackt -
    // lieber die fehlenden Werte auf einen Mittelwert setzen als stumm
    // verschobene Attribute auszuliefern.
    const attrs = {} as Record<string, number>;
    ALL_ATTRS.forEach((k, i) => { attrs[k] = roh[i] ?? 50; });
    (p as unknown as { attrs: unknown }).attrs = attrs;
  }
  delete gepackt.attrOrder;
  return state;
}

export async function saveGame(state: GameState): Promise<void> {
  state.updatedAt = Date.now();
  const meta = buildMeta(state);
  // Structured Clone verarbeitet den Spielstand ohne Umweg ueber JSON.
  // `packeAttribute` klont bereits, deshalb hier kein zweites Mal.
  const gepackt = packeAttribute(state);
  await tx([STORE_SAVES, STORE_META], 'readwrite', (stores) => {
    stores[STORE_SAVES].put(gepackt);
    stores[STORE_META].put(meta);
  });
}

/**
 * Bringt einen geladenen Spielstand auf den aktuellen Stand. Bisher gibt es
 * nur einen Fall: Vor der Trennung von Herkunft und Spielort stand in
 * `nationality` ein Ligaland statt einer Nation.
 */
function migrate(state: GameState): GameState {
  for (const player of Object.values(state.players)) {
    const nation = normalizeNationality(player.nationality);
    if (nation !== player.nationality) player.nationality = nation;
  }
  return state;
}

export async function loadGame(saveId: string): Promise<GameState | null> {
  const result = await tx<GameState>([STORE_SAVES], 'readonly',
    (stores) => stores[STORE_SAVES].get(saveId) as IDBRequest<GameState>);
  return result ? migrate(entpackeAttribute(result)) : null;
}

export async function listSaves(): Promise<SaveMeta[]> {
  const result = await tx<SaveMeta[]>([STORE_META], 'readonly',
    (stores) => stores[STORE_META].getAll() as IDBRequest<SaveMeta[]>);
  return (result ?? []).sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function deleteSave(saveId: string): Promise<void> {
  await tx([STORE_SAVES, STORE_META], 'readwrite', (stores) => {
    stores[STORE_SAVES].delete(saveId);
    stores[STORE_META].delete(saveId);
  });
}

export async function renameSave(saveId: string, name: string): Promise<void> {
  const state = await loadGame(saveId);
  if (!state) return;
  state.saveName = name;
  await saveGame(state);
}

export async function duplicateSave(saveId: string): Promise<string | null> {
  const state = await loadGame(saveId);
  if (!state) return null;
  const copy = structuredClone(state);
  copy.saveId = `save-copy-${Date.now().toString(36)}`;
  copy.saveName = `${state.saveName} (Kopie)`;
  copy.createdAt = Date.now();
  await saveGame(copy);
  return copy.saveId;
}

/** Exportiert einen Spielstand als JSON-Datei zum Herunterladen. */
export async function exportSave(saveId: string): Promise<string | null> {
  const state = await loadGame(saveId);
  if (!state) return null;
  // Auch die Ausgabedatei wird gepackt - sie ist sonst dreimal so gross.
  return JSON.stringify(packeAttribute(state));
}

export async function importSave(json: string): Promise<SaveMeta | null> {
  const parsed = entpackeAttribute(JSON.parse(json) as GameState);
  if (!parsed?.saveId || !parsed.players || !parsed.userPlayerId) {
    throw new Error(t('save.invalidFile'));
  }
  parsed.saveId = `save-import-${Date.now().toString(36)}`;
  parsed.saveName = `${parsed.saveName} (Import)`;
  await saveGame(parsed);
  return buildMeta(parsed);
}

/** Autosave-Schluessel im lokalen Speicher, damit der letzte Stand gefunden wird. */
const LAST_SAVE_KEY = 'rtg:lastSave';

export function rememberLastSave(saveId: string) {
  try { localStorage.setItem(LAST_SAVE_KEY, saveId); } catch { /* kein Speicher verfuegbar */ }
}

export function getLastSaveId(): string | null {
  try { return localStorage.getItem(LAST_SAVE_KEY); } catch { return null; }
}

/**
 * Zugaenge fuer den Rauchtest.
 *
 * Die Packung ist Teil des Speicherformats und muss verlustfrei sein -
 * ohne diese beiden Zugaenge liesse sich das nur ueber einen echten
 * Datenbankdurchlauf pruefen.
 */
export const packeFuerTest = packeAttribute;
export const entpackeFuerTest = entpackeAttribute;

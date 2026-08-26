/**
 * Spielstandsverwaltung ueber IndexedDB (Konzept Abschnitt 43 und 53).
 * Jeder Spielstand besitzt eine eigene Save-ID, damit sich Daten
 * verschiedener Karrieren niemals vermischen koennen.
 */
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

export async function saveGame(state: GameState): Promise<void> {
  state.updatedAt = Date.now();
  const meta = buildMeta(state);
  // Structured Clone verarbeitet den Spielstand ohne Umweg ueber JSON.
  await tx([STORE_SAVES, STORE_META], 'readwrite', (stores) => {
    stores[STORE_SAVES].put(structuredClone(state));
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
  return result ? migrate(result) : null;
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
  return JSON.stringify(state);
}

export async function importSave(json: string): Promise<SaveMeta | null> {
  const parsed = JSON.parse(json) as GameState;
  if (!parsed?.saveId || !parsed.players || !parsed.userPlayerId) {
    throw new Error('Die Datei enthaelt keinen gueltigen Spielstand.');
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

/** Schlanker Zustandsspeicher fuer die Oberflaeche. */
import type { GameDate } from '../engine/date';
import type { LifeEvent } from '../engine/events';
import type { SeasonReport } from '../engine/season';
import type { Id, WncResult } from '../engine/types';
import { useSyncExternalStore } from 'react';
import type { GameState } from '../engine/types';

export type Screen = 'menu' | 'create' | 'career' | 'match' | 'data' | 'legal';

export type CareerTab =
  | 'overview' | 'calendar' | 'training' | 'squad' | 'table'
  | 'stats' | 'news' | 'transfers' | 'player' | 'chronicle';

export interface AppState {
  screen: Screen;
  tab: CareerTab;
  game: GameState | null;
  /** Wird bei jeder Aenderung am Spielstand erhoeht. */
  version: number;
  busy: string | null;
  toast: { text: string; tone: 'info' | 'good' | 'bad' } | null;
  /** Bericht, der als Dialog angezeigt wird. */
  modal: ModalState | null;
  /** Sammelbericht eines Kalendersprungs, von der Schale angezeigt. */
  skipReport: SkipSummary | null;
}

/**
 * Was auf dem Weg zu einem Zieldatum passiert ist.
 *
 * Steht hier und nicht bei den Aktionen, weil die Schale ihn anzeigt und
 * die Aktionen ihn setzen - beide haengen am Zustand, nicht aneinander.
 */
export interface SkipSummary {
  /** Tage, die tatsaechlich vergangen sind. */
  days: number;
  von: GameDate;
  bis: GameDate;
  /** Eigene Partien, die unterwegs simuliert wurden. */
  eigeneSpiele: {
    matchId: Id;
    datum: GameDate;
    gegner: string;
    daheim: boolean;
    tore: number;
    gegentore: number;
    note: number | null;
    eigeneTore: number;
    vorlagen: number;
  }[];
  /** Summe der Attributzuwaechse aus dem Training unterwegs. */
  trainingsPlus: number;
  /** Neue Meldungen im Feed. */
  meldungen: number;
  /** Warum der Sprung geendet hat. */
  grund: 'ziel' | 'spiel' | 'ereignis' | 'saison' | 'ende' | 'grenze';
  matchToPlay: Id | null;
  lifeEvent: LifeEvent | null;
  seasonReport: SeasonReport | null;
  wnc: WncResult | null;
}

export type ModalState =
  | { kind: 'seasonReport'; payload: unknown }
  | { kind: 'training'; payload: unknown }
  | { kind: 'matchSummary'; payload: unknown };

let state: AppState = {
  screen: 'menu',
  tab: 'overview',
  game: null,
  version: 0,
  busy: null,
  toast: null,
  modal: null,
  skipReport: null,
};

const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function getState(): AppState {
  return state;
}

export function setState(patch: Partial<AppState>) {
  state = { ...state, ...patch };
  emit();
}

/**
 * Der Spielstand wird aus Leistungsgruenden direkt veraendert.
 * commit() signalisiert der Oberflaeche, dass neu gezeichnet werden muss.
 */
export function commit() {
  state = { ...state, version: state.version + 1 };
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function useAppState(): AppState {
  return useSyncExternalStore(subscribe, getState, getState);
}

export function useGame(): GameState {
  const app = useAppState();
  if (!app.game) throw new Error('Kein Spielstand geladen.');
  return app.game;
}

export function showToast(text: string, tone: 'info' | 'good' | 'bad' = 'info') {
  setState({ toast: { text, tone } });
  window.setTimeout(() => {
    if (getState().toast?.text === text) setState({ toast: null });
  }, 3200);
}

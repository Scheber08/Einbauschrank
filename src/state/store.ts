/** Schlanker Zustandsspeicher fuer die Oberflaeche. */
import { useSyncExternalStore } from 'react';
import type { GameState } from '../engine/types';

export type Screen = 'menu' | 'create' | 'career' | 'match';

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

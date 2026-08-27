/**
 * React-Anbindung der Sprachumschaltung.
 *
 * Bewusst getrennt von `index.ts`: Die Engine importiert `t` und darf dabei
 * nicht React in ihren Teil des Bundles ziehen. Diese Datei kennt React, jene
 * nicht.
 */
import { useSyncExternalStore } from 'react';
import { getLocale, onLocaleChange, type Locale } from './index';

/**
 * Meldet die Komponente an der Sprachumschaltung an. Der Rueckgabewert wird
 * selten gebraucht - entscheidend ist, dass die Komponente nach einem Wechsel
 * neu zeichnet und die `t`-Aufrufe darin neuen Text liefern.
 */
export function useLocale(): Locale {
  return useSyncExternalStore(onLocaleChange, getLocale, getLocale);
}

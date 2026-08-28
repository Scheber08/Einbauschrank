/**
 * Sprachumschaltung.
 *
 * Bewusst eine schlichte Modulvariable statt eines React-Kontexts: Der groesste
 * Teil des Textes entsteht nicht in der Oberflaeche, sondern in der Engine -
 * Spielberichte, Kommentare, Interviews, Chronikeintraege. Die Engine kennt
 * React nicht und darf es auch nicht kennen (siehe Aufbau in der README), also
 * muss `t` eine gewoehnliche Funktion sein, die von ueberall aufrufbar ist.
 *
 * **Es wird nur der aktive Katalog geladen.** Beide zusammen kosten rund 39 kB
 * gzip, und ein Besucher braucht immer nur einen davon. Deshalb liegen sie
 * hinter dynamischen Importen; `restoreLocale()` laeuft in `main.tsx` vor dem
 * ersten Rendern und wartet auf den Katalog.
 *
 * Damit gibt es eine Regel, die eingehalten werden muss: **Kein `t()` auf
 * Modulebene.** Beschriftungstabellen halten Schluessel und werden erst beim
 * Anzeigen uebersetzt. Ein `t()` beim Laden eines Moduls liefe sonst gegen einen
 * leeren Katalog - und wuerde ausserdem die Sprache des Ladezeitpunkts
 * einfrieren, statt einem Wechsel zu folgen.
 *
 * **Erzeugter Text wird beim Entstehen uebersetzt, nicht beim Anzeigen.**
 * Nachrichten und Chronikeintraege liegen als fertiger Text im Spielstand. Wer
 * mitten in einer Laufbahn die Sprache wechselt, behaelt daher die alten
 * Eintraege in der alten Sprache; alles Neue kommt in der neuen.
 */
export type Locale = 'de' | 'en';

export const LOCALES: { id: Locale; name: string }[] = [
  { id: 'de', name: 'Deutsch' },
  { id: 'en', name: 'English' },
];

const SPEICHER_SCHLUESSEL = 'rtg-locale';

/** Laedt einen Katalog. Vite macht daraus je einen eigenen Abschnitt. */
const LADER: Record<Locale, () => Promise<Record<string, string>>> = {
  de: () => import('./de').then((m) => m.DE),
  en: () => import('./en').then((m) => m.EN),
};

let aktuell: Locale = 'de';
let katalog: Record<string, string> = {};

/** Beobachter, damit React nach einem Wechsel neu zeichnet. */
const hoerer = new Set<() => void>();

export function getLocale(): Locale {
  return aktuell;
}

/** Steht der Katalog schon bereit? Vor dem ersten Laden liefert `t` Schluessel. */
export function localeReady(): boolean {
  return Object.keys(katalog).length > 0;
}

/**
 * Wechselt die Sprache und laedt ihren Katalog nach. Die Oberflaeche wird erst
 * benachrichtigt, wenn der Text tatsaechlich da ist - sonst blitzte fuer einen
 * Moment eine Ansicht ohne Beschriftungen auf.
 */
export async function setLocale(locale: Locale): Promise<void> {
  if (locale === aktuell && localeReady()) return;
  const geladen = await LADER[locale]();
  katalog = geladen;
  aktuell = locale;
  try { localStorage.setItem(SPEICHER_SCHLUESSEL, locale); } catch { /* kein Speicher */ }
  wendeAufSeiteAn(locale);
  for (const fn of hoerer) fn();
}

/**
 * Zieht Sprache, Tab-Titel und Seitenbeschreibung nach.
 *
 * Die Angaben in index.html sind statisch deutsch; ohne das saehe ein
 * englischsprachiger Besucher einen deutschen Tab-Titel. Die Vorschau beim
 * Teilen (og:*) bleibt davon unberuehrt - die liest ein Dienst aus dem rohen
 * HTML, bevor JavaScript laeuft. Das ginge nur mit serverseitigem Rendern.
 */
function wendeAufSeiteAn(locale: Locale) {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = locale;
  document.title = t('page.title');
  const beschreibung = document.querySelector('meta[name="description"]');
  if (beschreibung) beschreibung.setAttribute('content', t('page.description'));
}

/** Meldet einen Beobachter an und liefert die Abmeldung zurueck. */
export function onLocaleChange(fn: () => void): () => void {
  hoerer.add(fn);
  return () => { hoerer.delete(fn); };
}

/**
 * Stellt die zuletzt gewaehlte Sprache wieder her und laedt ihren Katalog.
 * Ohne Eintrag entscheidet die Browsersprache - wer mit englischem Browser
 * kommt, soll nicht erst umstellen muessen.
 */
export async function restoreLocale(): Promise<void> {
  let gewaehlt: Locale | null = null;
  try {
    const gespeichert = localStorage.getItem(SPEICHER_SCHLUESSEL);
    if (gespeichert === 'de' || gespeichert === 'en') gewaehlt = gespeichert;
  } catch { /* kein Speicher */ }

  if (!gewaehlt && typeof navigator !== 'undefined') {
    gewaehlt = navigator.language?.toLowerCase().startsWith('de') ? 'de' : 'en';
  }

  const ziel = gewaehlt ?? 'de';
  aktuell = ziel;
  katalog = await LADER[ziel]();
  // Die gemerkten Anzahlen gehoeren zum geladenen Katalog.
  fassungen.clear();
  wendeAufSeiteAn(ziel);
}

/**
 * Uebersetzt einen Schluessel. Platzhalter stehen in geschweiften Klammern:
 * `t('news.debut', { name: 'Bogen' })`.
 *
 * Fehlt ein Schluessel, kommt der Schluessel selbst zurueck. Frueher wich `t`
 * auf den deutschen Katalog aus, was nur ging, solange beide geladen waren -
 * und was eine Luecke im Spiel unsichtbar machte. Der Rauchtest vergleicht
 * beide Kataloge, deshalb faellt eine Luecke dort auf, nicht erst beim Spieler.
 */
export function t(key: string, params?: Record<string, string | number>): string {
  const vorlage = katalog[key] ?? key;
  if (!params) return vorlage;
  return vorlage.replace(/\{(\w+)\}/g, (treffer, name: string) => {
    const wert = params[name];
    return wert === undefined ? treffer : String(wert);
  });
}

/** Gemerkte Anzahl der Fassungen je Schluessel, pro Sprache. */
const fassungen = new Map<string, number>();

/**
 * Waehlt eine von mehreren Fassungen desselben Textes.
 *
 * Die Fassungen heissen `<key>.1`, `<key>.2` und so weiter. Wie viele es
 * gibt, probiert die Funktion einmal aus und merkt es sich - so kann keine
 * fest eingetragene Anzahl mit dem Katalog auseinanderlaufen, wenn spaeter
 * eine Fassung dazukommt oder wegfaellt.
 *
 * `wurf` ist eine Zahl zwischen 0 und 1. Die Auswahl gehoert damit dem
 * Aufrufer, der einen bestimmten Zufallsstrom hat - so bleibt ein
 * Spielverlauf bei gleichem Startwert reproduzierbar.
 */
export function tVariant(
  key: string, wurf: number, params?: Record<string, string | number>,
): string {
  const merkschluessel = `${aktuell}:${key}`;
  let anzahl = fassungen.get(merkschluessel);
  if (anzahl === undefined) {
    anzahl = 0;
    while (katalog[`${key}.${anzahl + 1}`] !== undefined) anzahl++;
    fassungen.set(merkschluessel, anzahl);
  }
  if (anzahl === 0) return t(key, params);
  const i = Math.min(anzahl, Math.floor(wurf * anzahl) + 1);
  return t(`${key}.${i}`, params);
}

/**
 * Waehlt zwischen Einzahl und Mehrzahl. Deutsch und Englisch kommen beide mit
 * zwei Formen aus, deshalb genuegt diese einfache Regel.
 */
export function tn(
  key: string, anzahl: number, params?: Record<string, string | number>,
): string {
  const gewaehlt = anzahl === 1 ? `${key}.one` : `${key}.other`;
  return t(gewaehlt, { ...params, n: anzahl });
}

/** Zahlformat der aktuellen Sprache - 1.234 gegen 1,234. */
export function tNumber(wert: number): string {
  return wert.toLocaleString(aktuell === 'de' ? 'de-DE' : 'en-GB');
}

/**
 * Dezimalzahl mit fester Nachkommastelle. Deutsch schreibt 6,42 und Englisch
 * 6.42 - vorher stand dafuer ein hartes `.replace('.', ',')` im Code.
 */
export function tDecimal(wert: number, stellen = 2): string {
  return wert.toLocaleString(aktuell === 'de' ? 'de-DE' : 'en-GB', {
    minimumFractionDigits: stellen,
    maximumFractionDigits: stellen,
  });
}

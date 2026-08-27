import { getLocale, t } from '../i18n';
/**
 * Kalender-Hilfsfunktionen. Datumsangaben werden im Spielstand als
 * ISO-String "YYYY-MM-DD" abgelegt, damit Spielstaende gut lesbar bleiben.
 */

export type GameDate = string; // YYYY-MM-DD

const MS_PER_DAY = 86400000;

export function makeDate(year: number, month: number, day: number): GameDate {
  return toISO(Date.UTC(year, month - 1, day));
}

function toISO(ms: number): GameDate {
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parse(date: GameDate): number {
  const [y, m, d] = date.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

export function addDays(date: GameDate, days: number): GameDate {
  return toISO(parse(date) + days * MS_PER_DAY);
}

export function daysBetween(a: GameDate, b: GameDate): number {
  return Math.round((parse(b) - parse(a)) / MS_PER_DAY);
}

export function isBefore(a: GameDate, b: GameDate): boolean {
  return parse(a) < parse(b);
}

export function isAfter(a: GameDate, b: GameDate): boolean {
  return parse(a) > parse(b);
}

/** 0 = Sonntag, 1 = Montag ... 6 = Samstag */
export function weekday(date: GameDate): number {
  return new Date(parse(date)).getUTCDay();
}

export function year(date: GameDate): number {
  return Number(date.slice(0, 4));
}

export function month(date: GameDate): number {
  return Number(date.slice(5, 7));
}

export function dayOfMonth(date: GameDate): number {
  return Number(date.slice(8, 10));
}

/**
 * Wochentage und Monate kommen aus dem Sprachkatalog. Die Funktionen bleiben
 * dieselben - nur der Text darin haengt jetzt an der eingestellten Sprache.
 */
const WEEKDAY_NAMES = Array.from({ length: 7 }, (_, i) => `date.weekday.${i}`);
const MONTH_NAMES = Array.from({ length: 12 }, (_, i) => `date.month.${i + 1}`);
const MONTH_SHORT = Array.from({ length: 12 }, (_, i) => `date.monthShort.${i + 1}`);

export function weekdayName(date: GameDate): string {
  return t(WEEKDAY_NAMES[weekday(date)]);
}

export function monthName(m: number): string {
  return t(MONTH_NAMES[m - 1]);
}

/** "Sa 12. Aug 2028" */
/**
 * Langform mit Wochentag. Deutsch schreibt "Sa 12. Aug 2028", Englisch
 * "Sat 12 Aug 2028" - der Punkt nach dem Tag ist eine deutsche Eigenheit.
 */
export function formatDate(date: GameDate): string {
  const tag = getLocale() === 'de' ? `${dayOfMonth(date)}.` : `${dayOfMonth(date)}`;
  return `${weekdayName(date)} ${tag} ${t(MONTH_SHORT[month(date) - 1])} ${year(date)}`;
}

/**
 * Kurzform. Deutsch "12.08.2028", Englisch "12/08/2028" - beide mit dem Tag
 * voran, damit ein Datum nicht je nach Sprache etwas anderes bedeutet.
 */
export function formatShort(date: GameDate): string {
  const tag = String(dayOfMonth(date)).padStart(2, '0');
  const monat = String(month(date)).padStart(2, '0');
  const trenner = getLocale() === 'de' ? '.' : '/';
  return `${tag}${trenner}${monat}${trenner}${year(date)}`;
}

/** Alter in Jahren am Stichtag. */
export function ageOn(birthDate: GameDate, on: GameDate): number {
  const b = new Date(parse(birthDate));
  const d = new Date(parse(on));
  let age = d.getUTCFullYear() - b.getUTCFullYear();
  const m = d.getUTCMonth() - b.getUTCMonth();
  if (m < 0 || (m === 0 && d.getUTCDate() < b.getUTCDate())) age--;
  return age;
}

/** Saisonbezeichnung "2028/29" fuer eine Saison, die im Jahr startYear beginnt. */
export function seasonLabel(startYear: number): string {
  return `${startYear}/${String((startYear + 1) % 100).padStart(2, '0')}`;
}

/** Erster Montag am oder nach dem gegebenen Datum. */
export function nextWeekday(date: GameDate, targetWeekday: number): GameDate {
  let d = date;
  for (let i = 0; i < 7; i++) {
    if (weekday(d) === targetWeekday) return d;
    d = addDays(d, 1);
  }
  return d;
}

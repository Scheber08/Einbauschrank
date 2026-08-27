/**
 * Symbole der Reiternavigation.
 *
 * Die Vorbilder aus den fruehen 2000ern fuehren jeden Menuepunkt mit einem
 * kleinen Piktogramm - das macht die Leiste auf einen Blick lesbar und nimmt
 * ihr das Aussehen einer Linkliste.
 *
 * Bewusst als Strichzeichnung im Text: Sie erben `currentColor` und folgen
 * damit dem Zustand des Knopfes (gedimmt, hell beim Ueberfahren, weiss wenn
 * aktiv), ohne dass es dafuer eigene Regeln braucht.
 */

import type { ReactNode } from 'react';

export type NavIconKey =
  | 'overview' | 'calendar' | 'training' | 'player' | 'squad'
  | 'table' | 'stats' | 'transfers' | 'news' | 'chronicle';

/** Die Pfade je Symbol, gezeichnet in einem Feld von 16 mal 16. */
const PATHS: Record<NavIconKey, ReactNode> = {
  // Vier Kacheln - die Uebersicht.
  overview: (
    <>
      <rect x="2" y="2" width="5.5" height="5.5" rx="1" />
      <rect x="8.5" y="2" width="5.5" height="5.5" rx="1" />
      <rect x="2" y="8.5" width="5.5" height="5.5" rx="1" />
      <rect x="8.5" y="8.5" width="5.5" height="5.5" rx="1" />
    </>
  ),
  // Kalenderblatt mit Aufhaengung.
  calendar: (
    <>
      <rect x="2" y="3.5" width="12" height="10.5" rx="1.5" />
      <path d="M2 6.8h12M5.2 2v3M10.8 2v3" />
    </>
  ),
  // Hantel - das Training.
  training: (
    <>
      <path d="M3.4 5.6v4.8M5.6 4.2v7.6M10.4 4.2v7.6M12.6 5.6v4.8M5.6 8h4.8" />
    </>
  ),
  // Kopf und Schultern - der eigene Spieler.
  player: (
    <>
      <circle cx="8" cy="5.4" r="2.9" />
      <path d="M2.8 14c0-2.9 2.3-4.7 5.2-4.7s5.2 1.8 5.2 4.7" />
    </>
  ),
  // Drei Figuren - die Mannschaft.
  squad: (
    <>
      <circle cx="5.2" cy="5.6" r="2.1" />
      <circle cx="11.4" cy="6.4" r="1.7" />
      <path d="M1.8 13.6c0-2.2 1.5-3.6 3.4-3.6s3.4 1.4 3.4 3.6M9.6 13.6c0-1.9 1-3 2.4-3s2.2 1.1 2.2 3" />
    </>
  ),
  // Pokal - die Wettbewerbe.
  table: (
    <>
      <path d="M5 2.5h6v3.2a3 3 0 0 1-6 0z" />
      <path d="M5 3.6H3.2v1a2 2 0 0 0 2 2M11 3.6h1.8v1a2 2 0 0 1-2 2" />
      <path d="M8 8.9v2.6M5.8 13.5h4.4" />
    </>
  ),
  // Balkendiagramm - die Statistik.
  stats: (
    <>
      <path d="M2.6 13.4h10.8" />
      <path d="M4.8 13.4V8.2M8 13.4V4.4M11.2 13.4v-3.6" />
    </>
  ),
  // Zwei Pfeile - Zu- und Abgaenge.
  transfers: (
    <>
      <path d="M2.6 5.6h9M9 3.2l2.6 2.4L9 8" />
      <path d="M13.4 10.4h-9M7 8l-2.6 2.4L7 12.8" />
    </>
  ),
  // Zeitung - die Nachrichten.
  news: (
    <>
      <rect x="2" y="3.4" width="12" height="9.2" rx="1.2" />
      <path d="M4.4 6.2h4.2M4.4 8.4h4.2M4.4 10.6h2.6M10.8 6.2h1.2v4.4h-1.2z" />
    </>
  ),
  // Buch - die Chronik.
  chronicle: (
    <>
      <path d="M2.6 3.2h4.2c.9 0 1.2.6 1.2 1.3v9c0-.7-.3-1.3-1.2-1.3H2.6z" />
      <path d="M13.4 3.2H9.2c-.9 0-1.2.6-1.2 1.3v9c0-.7.3-1.3 1.2-1.3h4.2z" />
    </>
  ),
};

export default function NavIcon({ icon }: { icon: NavIconKey }) {
  return (
    <svg className="nav-icon" viewBox="0 0 16 16" width="15" height="15"
      fill="none" stroke="currentColor" strokeWidth="1.4"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {PATHS[icon]}
    </svg>
  );
}

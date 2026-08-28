/**
 * Was der Spieler selbst entscheidet.
 *
 * Bis hierher gab es genau drei Stellschrauben: Trainingsschwerpunkt,
 * individuelles Ziel und Berateraufträge. Alles andere passierte mit einem -
 * die Aufstellung, die Standards, der Verein, sogar wie man abseits des
 * Platzes lebt. Dabei ist eine Laufbahn vor allem eine Kette von
 * Entscheidungen, und die interessanten davon haben einen Preis.
 *
 * Genau darum geht es hier: **keine dieser Optionen ist gratis**. Wer
 * professionell lebt, erholt sich besser und bleibt gesuender - kommt aber in
 * der Oeffentlichkeit kaum vor. Wer Zusatzeinheiten dranhaengt, entwickelt
 * sich schneller und geht muede ins Wochenende. Wer die Standards einfordert,
 * ohne sie zu koennen, verliert die Kabine.
 */

/** Wie der Spieler abseits des Platzes lebt. */
export type Lifestyle = 'professional' | 'balanced' | 'nightlife';

/** Zusatzeinheiten je Woche, oben gedeckelt. */
export const MAX_EXTRA_SESSIONS = 2;

export interface LifestyleEffect {
  /** Erholung zwischen den Spielen. */
  recovery: number;
  /** Verletzungsrisiko. */
  injury: number;
  /** Entwicklungsgeschwindigkeit. */
  growth: number;
  /** Wirkung auf das oeffentliche Bild, je Woche. */
  image: number;
  /** Wirkung auf die Laune, je Woche. */
  morale: number;
}

/**
 * Die drei Lebensweisen sind ein Tausch, keine Rangfolge.
 *
 * Der Profi gewinnt auf dem Platz und verliert daneben: ohne Praesenz keine
 * Sponsoren, keine Aufmerksamkeit, kein Ruf ueber den Verein hinaus. Das
 * Nachtleben dreht das um - und kostet Substanz.
 */
export const LIFESTYLE: Record<Lifestyle, LifestyleEffect> = {
  professional: { recovery: 1.15, injury: 0.85, growth: 1.10, image: -0.35, morale: -0.15 },
  balanced: { recovery: 1.00, injury: 1.00, growth: 1.00, image: 0.10, morale: 0.15 },
  nightlife: { recovery: 0.85, injury: 1.20, growth: 0.88, image: 0.55, morale: 0.45 },
};

export function lifestyleLabelKey(l: Lifestyle): string {
  return `lifestyle.${l}`;
}

/**
 * Was Zusatzeinheiten bringen und kosten.
 *
 * Der Gewinn waechst nicht linear: die zweite Einheit bringt weniger als die
 * erste und kostet mehr. Sonst waere die Antwort immer "so viele wie
 * moeglich" und es waere keine Entscheidung.
 */
export function extraSessionEffect(sessions: number): {
  growth: number; fatigue: number; injury: number;
} {
  const n = Math.max(0, Math.min(MAX_EXTRA_SESSIONS, Math.round(sessions)));
  if (n === 0) return { growth: 1, fatigue: 0, injury: 1 };
  if (n === 1) return { growth: 1.14, fatigue: 5, injury: 1.12 };
  return { growth: 1.22, fatigue: 12, injury: 1.34 };
}

/** Welche Standards der Spieler fuer sich beansprucht. */
export type SetPieceClaim = 'none' | 'penalties' | 'freeKicks' | 'both';

export function claimsPenalties(claim: SetPieceClaim | undefined): boolean {
  return claim === 'penalties' || claim === 'both';
}

export function claimsFreeKicks(claim: SetPieceClaim | undefined): boolean {
  return claim === 'freeKicks' || claim === 'both';
}

/**
 * Der Wechselwunsch.
 *
 * Bisher konnte der Berater einen Verein suchen, aber nicht wissen, wonach.
 * Wer in die erste Liga will, wollte das schon immer - er konnte es nur
 * niemandem sagen.
 */
export interface TransferWish {
  /** Aktiv gewuenscht, oder nur offen fuer Angebote? */
  active: boolean;
  /** Gewuenschte Ligastufe, 1 bis 3. Ohne Angabe egal. */
  level?: number;
  /** Gewuenschtes Land. Ohne Angabe egal. */
  country?: string;
}

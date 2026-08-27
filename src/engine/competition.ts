/**
 * Konkurrenz auf der eigenen Position.
 *
 * Ein Vertragsangebot zeigte bisher Gehalt, Abloese, Stadion und Trainer - also
 * alles ausser der Frage, die fuer eine Spielerlaufbahn die wichtigste ist:
 * **Werde ich dort spielen?** Wer bei einem Spitzenverein als vierter Stuermer
 * unterschreibt, verliert eine Saison, und das Spiel liess einen das erst
 * hinterher merken.
 *
 * Diese Auskunft macht den Wechsel zu einer Entscheidung statt zu einem
 * Gehaltsvergleich: Man kann bewusst den schwereren Weg waehlen - aber man
 * waehlt ihn dann.
 */
import { effectiveOverall, type PositionCode } from './attributes';
import type { GameState, Id, Player } from './types';
import { squadOf } from './worldGen';

export interface PositionCompetition {
  /** Wie viele Spieler des Vereins spielen dort, ohne den eigenen Spieler. */
  count: number;
  /** Staerke des staerksten davon, 0 wenn niemand da ist. */
  best: number;
  /**
   * Der eigene Rang auf dieser Position, 1 heisst staerkster. Beruecksichtigt
   * nur die Staerke, nicht Form oder Kaderrolle - es ist eine Einschaetzung
   * vor dem Wechsel, keine Aufstellung.
   */
  rank: number;
}

/**
 * Wie stark ist die Konkurrenz bei `clubId` auf der Position von `user`?
 *
 * Gezaehlt wird, wer dort seine Hauptposition hat; Nebenpositionen bleiben
 * aussen vor, sonst waere bei einem Verein mit vielen Allroundern jede Position
 * scheinbar verstopft.
 */
export function positionCompetition(
  state: GameState, clubId: Id, user: Player,
): PositionCompetition {
  const position = user.position as PositionCode;
  const eigene = effectiveOverall(user.attrs, user.position, user.altPositions, position);

  const rivalen = squadOf(state.players, clubId)
    .filter((p) => p.id !== user.id && p.position === position)
    .map((p) => effectiveOverall(p.attrs, p.position, p.altPositions, position))
    .sort((a, b) => b - a);

  return {
    count: rivalen.length,
    best: rivalen[0] ?? 0,
    rank: rivalen.filter((r) => r > eigene).length + 1,
  };
}

/**
 * Einordnung des Rangs in eine von vier Stufen. Der Text dazu liegt im
 * Sprachkatalog unter `comp.outlook.<stufe>`.
 */
export function competitionOutlook(c: PositionCompetition): 'clear' | 'good' | 'tight' | 'hard' {
  if (c.count === 0) return 'clear';
  if (c.rank === 1) return 'good';
  if (c.rank === 2) return 'tight';
  return 'hard';
}

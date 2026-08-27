/**
 * Wer tritt bei Standards an?
 *
 * Die Spielsimulation entscheidet das nach klaren Regeln: Den Elfmeter schiesst
 * der beste Schütze auf dem Platz - der eigene Spieler auch dann, wenn er
 * höchstens vier Punkte dahinterliegt. Freistöße teilen sich die beiden besten
 * Schützen.
 *
 * Nur stand davon nirgends etwas. Ein Spieler konnte eine ganze Laufbahn lang
 * die Schwerpunkte "Freistöße" und "Elfmeter" trainieren, ohne je zu erfahren,
 * ob es gereicht hat - und umgekehrt nie merken, dass ihm zwei Punkte fehlen.
 * Gemessen an 34 Spielen eines Stürmers: kein einziger Standard.
 *
 * Dieses Modul bildet dieselbe Regel für die Anzeige nach. Es rechnet mit dem
 * Kader statt mit der Startelf - vor dem Spiel steht die noch nicht fest, und
 * für die Frage "bin ich Schütze?" ist der Kader die ehrlichere Auskunft.
 */
import type { GameState, Id, Player } from './types';
import { squadOf } from './worldGen';

export interface SetPieceStanding {
  /** Tritt der eigene Spieler an? */
  takes: boolean;
  /** Bester Schütze im Kader - null, wenn der Spieler selbst der beste ist. */
  ahead: Player | null;
  /** Wie viele Punkte fehlen bis zum Antritt. 0, wenn er antritt. */
  gap: number;
}

function standing(
  user: Player, squad: Player[], wert: (p: Player) => number,
  toleranz: number, plaetze: number,
): SetPieceStanding {
  const andere = squad
    .filter((p) => p.id !== user.id)
    .sort((a, b) => wert(b) - wert(a));
  const eigen = wert(user);
  // Auf welchem Rang steht der eigene Spieler?
  const besser = andere.filter((p) => wert(p) > eigen).length;
  const bester = andere[0] ?? null;

  const takes = besser < plaetze
    || (bester !== null && eigen >= wert(bester) - toleranz);
  const gap = takes || !bester ? 0 : Math.max(1, Math.ceil(wert(bester) - toleranz - eigen));
  return { takes, ahead: takes ? null : bester, gap };
}

/** Stand bei Elfmetern: bester Schütze, Toleranz vier Punkte. */
export function penaltyStanding(state: GameState, clubId: Id | null): SetPieceStanding | null {
  const user = state.players[state.userPlayerId];
  if (!user || !clubId) return null;
  return standing(user, squadOf(state.players, clubId), (p) => p.attrs.penalties, 4, 1);
}

/** Stand bei Freistössen: die beiden besten teilen sie sich. */
export function freeKickStanding(state: GameState, clubId: Id | null): SetPieceStanding | null {
  const user = state.players[state.userPlayerId];
  if (!user || !clubId) return null;
  return standing(user, squadOf(state.players, clubId), (p) => p.attrs.freeKicks, 0, 2);
}

/**
 * Beziehungen zu Mitspielern (Konzept Abschnitt 30).
 * Der eigene Spieler entwickelt zu einigen Teamkollegen ein Verhaeltnis:
 * Mentor, Freundschaft, Rivalitaet oder neutral. Werte reichen von -100 bis 100.
 */
import { computeOverall } from './attributes';
import { ageOn } from './date';
import { Rng, clamp } from './rng';
import { squadOf } from './worldGen';
import type { GameState, Id } from './types';

export type RelationKind = 'mentor' | 'friend' | 'rival' | 'conflict' | 'neutral';

export const RELATION_LABELS: Record<RelationKind, string> = {
  mentor: 'Mentor',
  friend: 'Freund',
  rival: 'Rivale',
  conflict: 'Konflikt',
  neutral: 'Neutral',
};

/** Leitet die Beziehungsart aus dem Zahlenwert ab. */
export function relationKind(value: number, isMentor = false): RelationKind {
  if (isMentor && value >= 20) return 'mentor';
  if (value >= 35) return 'friend';
  if (value <= -45) return 'conflict';
  if (value <= -18) return 'rival';
  return 'neutral';
}

/**
 * Legt Startbeziehungen zu einigen Mitspielern an, wenn der Spieler zu einem
 * Verein stoesst. Ein erfahrener Fuehrungsspieler wird Mentor, ein Konkurrent
 * auf der eigenen Position tendenziell Rivale, dazu einige Freundschaften.
 */
export function seedRelationships(state: GameState, rng: Rng) {
  const user = state.players[state.userPlayerId];
  if (!user?.clubId) return;
  const mates = squadOf(state.players, user.clubId).filter((p) => p.id !== user.id);
  state.relationships = {};
  state.mentorId = null;
  if (mates.length === 0) return;

  // Mentor: erfahrenster Fuehrungsspieler.
  const mentor = mates.slice().sort((a, b) => {
    const sa = a.attrs.leadership + ageOn(a.birthDate, state.date) * 1.5;
    const sb = b.attrs.leadership + ageOn(b.birthDate, state.date) * 1.5;
    return sb - sa;
  })[0];
  if (mentor && ageOn(mentor.birthDate, state.date) >= 27) {
    state.relationships[mentor.id] = rng.int(24, 38);
    state.mentorId = mentor.id;
  }

  // Rivale: staerkster Konkurrent auf derselben Position.
  const rival = mates
    .filter((p) => p.position === user.position && p.id !== mentor?.id)
    .sort((a, b) => computeOverall(b.attrs, b.position) - computeOverall(a.attrs, a.position))[0];
  if (rival) state.relationships[rival.id] = -rng.int(20, 40);

  // Ein bis drei Freundschaften unter den uebrigen Kollegen.
  const pool = mates.filter((p) => p.id !== mentor?.id && p.id !== rival?.id);
  const friends = rng.sample(pool, Math.min(pool.length, rng.int(1, 3)));
  for (const f of friends) state.relationships[f.id] = rng.int(18, 34);
}

/** Ist dieser Mitspieler als Mentor markiert? */
export function isMentor(state: GameState, mateId: Id): boolean {
  return state.mentorId === mateId;
}

/**
 * Entwickelt die Beziehungen nach einem Spiel des eigenen Vereins weiter.
 * Gemeinsame Einsatzzeit naehert an, der Teamwork-Wert des Spielers hilft,
 * der Positionsrivale entfernt sich mit jedem Spiel etwas.
 */
export function driftRelationships(
  state: GameState, playedTeammateIds: Id[], rng: Rng,
) {
  const user = state.players[state.userPlayerId];
  if (!user) return;
  const teamworkFactor = 0.6 + user.attrs.teamwork / 150;

  for (const id of playedTeammateIds) {
    if (id === user.id) continue;
    const mate = state.players[id];
    if (!mate) continue;
    const current = state.relationships[id] ?? 0;

    // Positionskonkurrenten driften auseinander, alle anderen naeher zusammen.
    const rivalry = mate.position === user.position && !isMentor(state, id);
    const step = rivalry
      ? -rng.float(0.4, 1.4)
      : rng.float(0.5, 1.8) * teamworkFactor;
    state.relationships[id] = clamp(current + step, -100, 100);
  }
}

/**
 * Kleiner Moraleffekt aus dem Beziehungsumfeld, einmal pro Woche.
 * Ein gutes Umfeld hebt die Moral leicht, ein von Konflikten gepraegtes
 * drueckt sie.
 */
export function relationshipMoraleDrift(state: GameState): number {
  const values = Object.values(state.relationships);
  if (values.length === 0) return 0;
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  return clamp(avg / 100, -0.6, 0.6);
}

/** Beziehungsuebersicht fuer die Oberflaeche, sortiert nach Naehe. */
export interface RelationView {
  playerId: Id;
  value: number;
  kind: RelationKind;
}

export function relationList(state: GameState): RelationView[] {
  return Object.entries(state.relationships)
    .map(([playerId, value]) => ({
      playerId,
      value,
      kind: relationKind(value, isMentor(state, playerId)),
    }))
    .sort((a, b) => b.value - a.value);
}

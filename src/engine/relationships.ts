/**
 * Beziehungen zu Mitspielern (Konzept Abschnitt 30).
 * Der eigene Spieler entwickelt zu einigen Teamkollegen ein Verhaeltnis:
 * Mentor, Freundschaft, Rivalitaet oder neutral. Werte reichen von -100 bis 100.
 */
import { computeOverall } from './attributes';
import { ageOn } from './date';
import { Rng, clamp } from './rng';
import { squadOf } from './worldGen';
import type { GameState, Id, Player } from './types';

export type RelationKind = 'mentor' | 'friend' | 'rival' | 'conflict' | 'neutral';

/** Katalogschluessel je Beziehungsart - uebersetzt wird bei der Anzeige. */
export const RELATION_LABELS: Record<RelationKind, string> = {
  mentor: 'rel.mentor',
  friend: 'rel.friend',
  rival: 'rel.rival',
  conflict: 'rel.conflict',
  neutral: 'rel.neutral',
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

  // Mentor: ein erfahrener Spieler, der auch wirklich etwas weiterzugeben hat.
  //
  // Frueher entschied vor allem das Alter (`leadership + alter * 1.5`), weshalb
  // regelmaessig ein 34-Jaehriger mit Fuehrung 53 und Professionalitaet 30 zum
  // Mentor wurde - jemand, von dem es nichts zu lernen gibt. Solange der Mentor
  // nur ein Abzeichen war, fiel das nicht auf; seit er die Entwicklung
  // beschleunigt, ist es der Unterschied zwischen Wirkung und Alibi.
  //
  // Deshalb: Erfahrung ist Voraussetzung, ausgewaehlt wird nach Vorbildwirkung.
  // Findet sich niemand Passendes, bleibt der Kader eben ohne Mentor - das
  // macht einen Verein mit erfahrener Kabine zu einem echten Vorteil.
  const kandidaten = mates.filter((p) => ageOn(p.birthDate, state.date) >= 27
    && p.attrs.leadership >= 55);
  const mentor = kandidaten.sort((a, b) => {
    const wert = (p: typeof a) => p.attrs.leadership * 1.4 + p.attrs.professionalism
      + p.attrs.teamwork * 0.5 + ageOn(p.birthDate, state.date) * 0.8;
    return wert(b) - wert(a);
  })[0];
  if (mentor) {
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
 * Wie stark foerdert der Mentor die eigene Entwicklung?
 *
 * Der Mentor war bisher ein Abzeichen in der Kaderliste und sonst nichts:
 * `seedRelationships` bestimmte ihn, die Oberflaeche zeigte ihn an, und kein
 * einziger Rechenweg las den Wert je wieder. Wer einen Mentor hatte, merkte
 * davon nichts - und hatte damit auch keinen Grund, die Beziehung zu pflegen.
 *
 * Hier bekommt er seine Aufgabe: Ein erfahrener Fuehrungsspieler, zu dem ein
 * gutes Verhaeltnis besteht, beschleunigt das Training. Drei Bedingungen
 * muessen zusammenkommen - er muss noch im selben Verein spielen, das
 * Verhaeltnis muss tragen, und er muss selbst etwas zu geben haben.
 *
 * Rueckgabe: 0 wenn nichts wirkt, sonst bis etwa 0,22.
 */
export function mentorInfluence(state: GameState): number {
  const user = state.players[state.userPlayerId];
  const mentor = state.mentorId ? state.players[state.mentorId] : null;
  if (!user || !mentor) return 0;
  // Ein Mentor, der den Verein verlassen hat, lehrt nicht mehr aus der Ferne.
  if (!user.clubId || mentor.clubId !== user.clubId) return 0;

  const naehe = state.relationships[mentor.id] ?? 0;
  if (naehe < 20) return 0;

  // Naehe traegt die Haelfte, was der Mentor mitbringt die andere.
  const bindung = clamp((naehe - 20) / 60, 0, 1);
  // Fuehrungsstaerke macht den Mentor, Professionalitaet verstaerkt ihn nur.
  // Beide gleich zu gewichten war falsch: Die Professionalitaet der
  // computergesteuerten Spieler liegt im Schnitt deutlich niedriger (gemessen:
  // 16 bis 63 bei acht Startvereinen) und drueckte jeden Mentor auf die
  // Untergrenze. Die Untergrenze selbst bleibt, damit ein knapp
  // qualifizierter Mentor nicht rechnerisch auf null faellt und der Hinweis
  // in der Oberflaeche etwas verspricht, das die Rechnung nicht haelt.
  const guete = clamp(
    (mentor.attrs.leadership * 1.2 + mentor.attrs.professionalism * 0.6 - 60) / 110,
    0.3, 1);
  return 0.28 * bindung * guete;
}

/**
 * Prueft, ob der Mentor den Verein verlassen hat, und loest die Bindung.
 * Rueckgabe: der ehemalige Mentor, wenn gerade jetzt Schluss ist - sonst null.
 * Der Aufrufer kuemmert sich um Meldung und Stimmung.
 */
export function mentorLeft(state: GameState): Player | null {
  const user = state.players[state.userPlayerId];
  const mentor = state.mentorId ? state.players[state.mentorId] : null;
  if (!user || !mentor) return null;
  if (user.clubId && mentor.clubId === user.clubId) return null;
  state.mentorId = null;
  return mentor;
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

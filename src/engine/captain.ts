/**
 * Die Spielführerbinde.
 *
 * Die Rolle `Mannschaftsfuehrer` gab es von Anfang an: Sie steht in
 * `SQUAD_ROLE_ORDER` ganz oben, sie schützt in der Spielsimulation vor früher
 * Auswechslung, und `updateUserSquadRole` weiß, dass ein Kapitän nicht
 * automatisch degradiert wird. Vergeben wurde sie aber **nur ein einziges
 * Mal** - bei der Welterzeugung, an einen computergesteuerten Spieler
 * (`worldGen.ts`). Der eigene Spieler konnte sie nie bekommen, weil die
 * Rollenvergabe höchstens bis `Schluesselspieler` zielt.
 *
 * Damit fehlte einer der wenigen Momente, die eine Spielerlaufbahn wirklich
 * krönen - und zwar einer, den das Spiel bereits vollständig vorbereitet
 * hatte.
 *
 * Die Binde wird hier verdient, nicht verteilt: Sie verlangt eine tragende
 * Rolle, Führungsstärke, das Vertrauen des Trainers und Zeit im Verein. Und
 * sie wird wieder abgegeben, wenn man den Verein wechselt.
 */
import { computeOverall } from './attributes';
import { ageOn } from './date';
import { addCareerEvent, addNews } from './ids';
import { t } from '../i18n';
import { clamp, type Rng } from './rng';
import { SQUAD_ROLE_ORDER, type GameState, type Player } from './types';
import { squadOf } from './worldGen';

/** Wie gut eignet sich dieser Spieler als Kapitän? */
function eignung(state: GameState, p: Player): number {
  // Ansehen gehoert dazu: Eine Binde bekommt nicht nur, wer am lautesten
  // fuehrt, sondern wer in der Kabine etwas gilt.
  return p.attrs.leadership * 1.4
    + p.attrs.professionalism * 0.4
    + p.attrs.teamwork * 0.3
    + ageOn(p.birthDate, state.date) * 1.0
    + computeOverall(p.attrs, p.position) * 0.4
    + p.reputation * 0.7;
}

/**
 * Prüft am Saisonende, ob der eigene Spieler Kapitän wird - oder es nicht mehr
 * ist.
 *
 * Läuft nach der Rollenvergabe: Erst steht fest, ob jemand Schlüsselspieler
 * ist, dann kann sich die Frage nach der Binde überhaupt stellen.
 */
/**
 * Fuehrungsstaerke waechst mit der Stellung in der Mannschaft.
 *
 * Kein Trainingsplan macht jemanden zur Fuehrungsfigur - Stellung, Ansehen
 * und Jahre tun es. Ohne diesen Weg blieb die Fuehrungsstaerke des eigenen
 * Spielers ueber eine ganze Laufbahn nahezu unveraendert (gemessen: 35 mit
 * 27 Jahren bei Ruf 99), und die Spielfuehrerbinde damit unerreichbar.
 *
 * Bewusst an die Rolle geknuepft und nicht an die Zeit: Wer auf der Bank
 * sitzt, waechst nicht hinein.
 */
export function growLeadership(state: GameState, rng: Rng) {
  const user = state.players[state.userPlayerId];
  if (!user?.contract) return;
  const rang = SQUAD_ROLE_ORDER.indexOf(user.contract.role);
  // Erst ab Stammspieler, und erst ab einem Alter, in dem einem zugehoert wird.
  if (rang < SQUAD_ROLE_ORDER.indexOf('Stammspieler')) return;
  if (ageOn(user.birthDate, state.date) < 21) return;

  const basis = (rang - 2) * 1.1
    + (user.reputation - 45) / 22
    + (state.coachRelation - 50) / 30
    + (state.fanRelation - 50) / 45;
  const zuwachs = clamp(basis, 0, 5) * rng.float(0.6, 1.2);
  if (zuwachs < 0.5) return;
  user.attrs.leadership = clamp(
    user.attrs.leadership + Math.round(zuwachs), 1, 99);
}
export function checkCaptaincy(state: GameState, rng: Rng) {
  const user = state.players[state.userPlayerId];
  if (!user?.contract || !user.clubId) return;
  const club = state.clubs[user.clubId];
  if (!club) return;

  const kader = squadOf(state.players, user.clubId);
  const bisher = kader.find(
    (p) => p.id !== user.id && p.contract?.role === 'Mannschaftsfuehrer');

  // --- Ist der Spieler bereits Kapitän? --------------------------------
  if (user.contract.role === 'Mannschaftsfuehrer') {
    // Ein Kapitän, der nicht mehr spielt, gibt die Binde ab. Alles andere wäre
    // eine Rolle, die man einmal bekommt und nie wieder verliert.
    const eintraege = Object.values(state.seasonStats).filter(
      (s) => s.playerId === user.id && s.season === state.season);
    const spiele = eintraege.reduce((a, s) => a + s.appearances, 0);
    if (spiele >= 8) return;

    user.contract.role = 'Schluesselspieler';
    addNews(state, 'coach', t('cap.lost.title'),
      t('cap.lost.body', { club: club.name }), true);
    return;
  }

  // --- Kann er sie bekommen? -------------------------------------------
  // Nur ein tragender Spieler kommt in Frage. Ohne diese Schwelle wäre die
  // Binde eine Frage der Zeit statt eine der Stellung.
  if (user.contract.role !== 'Schluesselspieler') return;

  // Zeit im Verein: Ein Zugezogener wird nicht im ersten Sommer Kapitän.
  const jahreImVerein = Object.values(state.seasonStats)
    .filter((s) => s.playerId === user.id && s.clubId === user.clubId)
    .reduce((menge, s) => menge.add(s.season), new Set<number>()).size;
  if (jahreImVerein < 2) return;

  // Der Trainer muss es wollen.
  if (state.coachRelation < 60) return;

  const eigene = eignung(state, user);
  // Gegen den amtierenden Kapitän muss man sich deutlich durchsetzen - eine
  // Binde wechselt nicht bei Gleichstand.
  if (bisher && eignung(state, bisher) > eigene * 0.92) return;

  // Und im Kader zum engsten Kreis gehoeren. "Der Beste" waere zu streng:
  // Ein Verein waehlt seinen Spielfuehrer aus einer Handvoll Anwaerter aus,
  // nicht nach der zweiten Nachkommastelle einer Formel.
  const besser = kader.filter(
    (p) => p.id !== user.id && p.id !== bisher?.id && eignung(state, p) > eigene).length;
  if (besser >= 2) return;

  // Ein Rest Zufall bleibt: Die Binde ist eine Entscheidung, keine Formel.
  if (!rng.chance(0.75)) return;

  if (bisher?.contract) bisher.contract.role = 'Schluesselspieler';
  user.contract.role = 'Mannschaftsfuehrer';
  state.coachRelation = clamp(state.coachRelation + 4, 0, 100);
  state.fanRelation = clamp(state.fanRelation + 5, 0, 100);
  user.morale = clamp(user.morale + 8, 0, 100);
  user.reputation = clamp(user.reputation + 3, 1, 99);

  addNews(state, 'coach', t('cap.new.title', { last: user.lastName }),
    t('cap.new.body', { name: `${user.firstName} ${user.lastName}`, club: club.name }), true);
  addCareerEvent(state, 'title', t('cap.new.event'),
    t('cap.new.eventBody', { club: club.name }), { clubId: club.id });
}

/**
 * Beim Vereinswechsel geht die Binde verloren.
 *
 * Ohne das behielte ein Spieler die Rolle beim neuen Verein - und wäre dort am
 * ersten Tag Kapitän, während der bisherige Kapitän des Vereins es ebenfalls
 * bleibt. Zwei Spielführer in einer Mannschaft.
 */
export function dropCaptaincyOnTransfer(user: Player) {
  if (user.contract?.role === 'Mannschaftsfuehrer') {
    user.contract.role = 'Schluesselspieler';
  }
}

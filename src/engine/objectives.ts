/**
 * Abrechnung der Saisonziele.
 *
 * Die Ziele wurden bisher nur mitgezaehlt: `updateObjectives` setzte das
 * `done`-Kennzeichen, der Saisonbericht zeigte "3 von 4" - und das war alles.
 * Dabei steht an jedem Ziel eine Belohnung geschrieben ("Bessere
 * Trainerbeziehung", "Hoehere Reputation und Marktwert", "Aufmerksamkeit
 * groesserer Vereine"). Das Spiel machte also ein Versprechen, das es nie
 * einloeste, und ein verfehltes Ziel blieb ohne jede Folge.
 *
 * Hier wird beides nachgeholt. Die Ausschlaege sind bewusst massvoll: Ein Ziel
 * verschiebt eine Beziehung um wenige Punkte, nicht um zwanzig. Spuerbar wird
 * es ueber die Saisons - und ueber die Reputation, die direkt in die
 * Vertragsangebote des Sommers laeuft.
 */
import { t } from '../i18n';
import { addCareerEvent, addNews } from './ids';
import { clamp } from './rng';
import type { GameState, SeasonObjective } from './types';

/** Wirkung eines einzelnen Ziels, je nachdem ob es erreicht wurde. */
interface Wirkung {
  reputation?: number;
  coach?: number;
  fans?: number;
  morale?: number;
}

const ERFUELLT: Record<SeasonObjective['kind'], Wirkung> = {
  // Wer spielt, steht beim Trainer im Wort.
  appearances: { coach: 6, morale: 3 },
  // Tore sprechen sich herum.
  goals: { reputation: 4, fans: 4, morale: 3 },
  // Eine hohe Schnittnote zieht die Blicke groesserer Vereine an.
  rating: { reputation: 5, coach: 3 },
  // Vorlagen zaehlen wie Tore, nur etwas leiser.
  assists: { reputation: 2, fans: 3, morale: 2 },
  // Der Erfolg der Mannschaft faellt auf alle zurueck.
  teamPosition: { fans: 6, morale: 4 },
  overall: { reputation: 3 },
};

const VERFEHLT: Record<SeasonObjective['kind'], Wirkung> = {
  appearances: { coach: -4, morale: -3 },
  goals: { reputation: -2, morale: -2 },
  rating: { coach: -2 },
  assists: { morale: -1 },
  teamPosition: { fans: -3, morale: -2 },
  overall: {},
};

/**
 * Legt einen Ausschlag an und laesst ihn zum Rand hin auslaufen.
 *
 * Ohne das Auslaufen schoben wiederholt erfuellte Ziele Trainer und Fans
 * binnen zwei Saisons an den Anschlag - gemessen: Fans von 50 auf 100. Am
 * oberen Ende ist dann nichts mehr zu gewinnen und der Wert als Groesse tot.
 */
function auslaufend(wert: number, delta: number, min: number, max: number): number {
  const raum = delta >= 0 ? max - wert : wert - min;
  return clamp(wert + delta * clamp(raum / 45, 0, 1), min, max);
}

function anwenden(state: GameState, w: Wirkung) {
  const user = state.players[state.userPlayerId];
  if (w.reputation && user) user.reputation = auslaufend(user.reputation, w.reputation, 1, 99);
  if (w.morale && user) user.morale = auslaufend(user.morale, w.morale, 0, 100);
  if (w.coach) state.coachRelation = auslaufend(state.coachRelation, w.coach, 0, 100);
  if (w.fans) state.fanRelation = auslaufend(state.fanRelation, w.fans, 0, 100);
}

/**
 * Rechnet die Ziele der abgelaufenen Saison ab. Laeuft am Saisonende, bevor die
 * Kaderrolle neu bestimmt und der Transfermarkt geoeffnet wird - so wirken die
 * Aenderungen an Reputation und Trainerbeziehung noch auf beides.
 */
export function resolveObjectives(state: GameState) {
  const user = state.players[state.userPlayerId];
  if (!user || state.objectives.length === 0) return;

  const erreicht = state.objectives.filter((o) => o.done);
  const verfehlt = state.objectives.filter((o) => !o.done);

  for (const ziel of erreicht) anwenden(state, ERFUELLT[ziel.kind] ?? {});
  for (const ziel of verfehlt) anwenden(state, VERFEHLT[ziel.kind] ?? {});

  const alle = state.objectives.length;
  const name = `${user.firstName} ${user.lastName}`;

  if (verfehlt.length === 0) {
    // Alles erfuellt: ein Extraschub obendrauf und ein Eintrag in der Chronik.
    anwenden(state, { coach: 5, fans: 4, reputation: 3, morale: 5 });
    addNews(state, 'season', t('obj.allMet.title'),
      t('obj.allMet.body', { name, n: alle }), true);
    addCareerEvent(state, 'other', t('obj.allMet.event'),
      t('obj.allMet.eventBody', { n: alle }));
    return;
  }

  if (erreicht.length === 0) {
    anwenden(state, { coach: -5, morale: -4 });
    addNews(state, 'season', t('obj.noneMet.title'),
      t('obj.noneMet.body', { n: alle }), true);
    return;
  }

  addNews(state, 'season', t('obj.partial.title'),
    t('obj.partial.body', {
      met: erreicht.length,
      all: alle,
      missed: verfehlt.map((o) => o.label).join(', '),
    }), false);
}

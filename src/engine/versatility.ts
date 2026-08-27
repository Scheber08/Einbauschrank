/**
 * Eine neue Position lernen.
 *
 * `altPositions` wird bei der Erstellung der Laufbahn gesetzt und war danach
 * für immer festgeschrieben - obwohl das halbe Spiel damit rechnet:
 * `effectiveOverall` bewertet eine Nebenposition mit 0,96, eine Nachbarposition
 * nur mit 0,90 und eine fremde mit 0,78. Aufstellung, Spielsimulation und die
 * Konkurrenzanzeige auf Angebotskarten lesen den Wert alle.
 *
 * Ein Spieler, der zwei Jahre lang auf der Sechs aufläuft, blieb damit dort
 * dauerhaft ein Fremdkörper. Dabei ist genau das einer der häufigsten Bögen
 * einer echten Laufbahn: Der Flügelspieler wird Außenverteidiger, der
 * Zehner rückt zurück.
 *
 * Gelernt wird durch Spielen, nicht durch Training - deshalb zählen hier nur
 * Partien mit echter Einsatzzeit.
 */
import { addCareerEvent, addNews } from './ids';
import { t } from '../i18n';
import type { PositionCode } from './attributes';
import type { GameState } from './types';

/** So viele Partien mit nennenswerter Einsatzzeit braucht eine neue Position. */
const NOETIGE_SPIELE = 15;
/** Darunter zaehlt ein Einsatz nicht - ein Kurzauftritt lehrt nichts. */
const MINDESTMINUTEN = 30;

/**
 * Prüft am Saisonende, ob der Spieler eine neue Position gelernt hat.
 *
 * Rückgabe: die gelernte Position oder null. Es wird höchstens eine pro Saison
 * gelernt - sonst sammelte ein Rotationsspieler binnen weniger Jahre das halbe
 * Feld ein, und die Hauptposition verlöre ihre Bedeutung.
 */
export function learnAltPosition(state: GameState): PositionCode | null {
  const user = state.players[state.userPlayerId];
  if (!user) return null;
  // Vier Nebenpositionen sind genug. Wer überall spielen kann, spielt nirgends.
  if (user.altPositions.length >= 4) return null;

  const zaehler = new Map<PositionCode, number>();
  for (const s of state.userMatchStats) {
    const slot = s.position as PositionCode | undefined;
    if (!slot) continue;
    if (s.minutes < MINDESTMINUTEN) continue;
    if (slot === user.position) continue;
    if (user.altPositions.includes(slot)) continue;
    // Der Torwart ist kein Feldspieler und umgekehrt - das lernt sich nicht.
    if ((slot === 'TW') !== (user.position === 'TW')) continue;
    zaehler.set(slot, (zaehler.get(slot) ?? 0) + 1);
  }

  let beste: PositionCode | null = null;
  let meiste = 0;
  for (const [slot, n] of zaehler) {
    if (n > meiste) { meiste = n; beste = slot; }
  }
  if (!beste || meiste < NOETIGE_SPIELE) return null;

  user.altPositions = [...user.altPositions, beste];
  const label = t(`pos.${beste}`);
  addNews(state, 'coach', t('pos.learned.title', { position: label }),
    t('pos.learned.body', { last: user.lastName, position: label, n: meiste }), true);
  addCareerEvent(state, 'other', t('pos.learned.event', { position: label }),
    t('pos.learned.eventBody', { position: label, n: meiste }));
  return beste;
}

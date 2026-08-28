/**
 * Das Potenzial des eigenen Spielers.
 *
 * Es wurde beim Karrierestart einmal gewuerfelt und danach **nie wieder
 * angefasst**. Die Zahl, die das Spiel als "Potenzial bis 78" anzeigt, stand
 * am ersten Tag fest - egal, ob der Spieler mit siebzehn in der ersten Liga
 * ueberragte oder mit zwanzig noch keine Minute gespielt hatte. Damit war die
 * wichtigste Frage einer Laufbahn, naemlich wie weit es reicht, schon vor dem
 * ersten Anpfiff beantwortet.
 *
 * (Die Spieler ringsum hatten immerhin einen Zufallsdrift in
 * `developAiPlayer` - der haengt aber ebenfalls an nichts.)
 *
 * Jetzt bewegt sich das Potenzial mit der Leistung. Wer ueber seinem Niveau
 * spielt, wird hochgeschrieben; wer stagniert oder nicht spielt, verliert
 * Zutrauen. Das Fenster schliesst sich mit dem Alter: mit siebzehn ist fast
 * alles moeglich, mit fuenfundzwanzig kaum noch etwas, danach geht es nur
 * noch abwaerts.
 */

import { computeOverall } from './attributes';
import { clamp, type Rng } from './rng';
import type { Player } from './types';

/** Wie sich eine Laufbahn entfaltet - vom Spieler beim Start gewaehlt. */
export type TalentProfile = 'early' | 'steady' | 'late';

export interface TalentEigenschaft {
  /** Bis zu welchem Alter das Potenzial noch deutlich steigen kann. */
  fenster: number;
  /** Wie stark Leistungen das Potenzial verschieben. */
  ausschlag: number;
  /** Zuschlag auf das Startpotenzial. */
  startMod: number;
  /** Zuschlag auf die Startstaerke. */
  koennenMod: number;
}

/**
 * Die drei Profile sind ein Tausch, keine Rangfolge.
 *
 * Der Frueh­entwickler startet staerker, hat aber ein kurzes Fenster - was
 * mit zweiundzwanzig nicht da ist, kommt nicht mehr. Der Spaetentwickler
 * beginnt schwaecher und mit weniger Potenzial auf dem Papier, kann sich
 * dafuer bis Ende zwanzig noch deutlich hocharbeiten.
 */
export const TALENT_PROFILE: Record<TalentProfile, TalentEigenschaft> = {
  early: { fenster: 21, ausschlag: 1.0, startMod: 2, koennenMod: 4 },
  steady: { fenster: 24, ausschlag: 1.0, startMod: 0, koennenMod: 0 },
  late: { fenster: 28, ausschlag: 1.25, startMod: -4, koennenMod: -4 },
};

/** Katalogschluessel fuer die Bezeichnung. */
export function talentLabelKey(p: TalentProfile): string {
  return `talent.${p}`;
}

/** Nach so vielen Pflichtspielen wird neu bewertet. */
export const REVIEW_ALLE = 6;

export interface PotentialReview {
  /** Ganze Punkte, um die sich das Potenzial verschiebt. Kann 0 sein. */
  schritt: number;
  /** Was an Bruchteil uebrig bleibt und in die naechste Bewertung eingeht. */
  drift: number;
  /** Warum es sich bewegt - fuer die Meldung. */
  grund: 'breakthrough' | 'progress' | 'stall' | 'bench' | 'age';
}

/**
 * Wie weit das Fenster an diesem Alter noch offen steht, 0 bis 1.
 *
 * Bei siebzehn ganz, am Ende des Profilfensters geschlossen. Danach kann das
 * Potenzial nur noch fallen - ein Achtundzwanzigjaehriger wird nicht mehr
 * hochgeschrieben, weil er drei gute Spiele hatte.
 */
function fensterOffen(alter: number, profil: TalentEigenschaft): number {
  if (alter <= 17) return 1;
  if (alter >= profil.fenster) return 0;
  return (profil.fenster - alter) / (profil.fenster - 17);
}

/**
 * Was von einem Spieler dieses Koennens erwartet wird.
 *
 * Eine Durchschnittsnote sagt fuer sich genommen wenig: eine 6,8 ist bei
 * einem Zweitligisten stark und bei einem Nationalspieler mager. Deshalb
 * wird sie an der eigenen Staerke gemessen - und deshalb korrigiert sich das
 * Potenzial von selbst: wer besser wird, an dem wird mehr gemessen.
 */
function erwarteteNote(koennen: number): number {
  return clamp(6.15 + koennen / 160, 6.2, 7.1);
}

/**
 * Bewertet das Potenzial neu.
 *
 * Der Ausschlag je Bewertung ist **klein** und wird in `drift` gesammelt,
 * bis ein ganzer Punkt zusammenkommt. Ein erster Anlauf rechnete zehnmal so
 * grob: eine starke Serie hob das Potenzial in zwanzig Bewertungen von 74
 * auf 97, eine schwache liess es auf 49 fallen. Damit war es keine
 * Einschaetzung mehr, sondern nur noch eine zweite Formkurve.
 *
 * Als Faustzahl: eine sehr gute Saison (rund sechs Bewertungen deutlich
 * ueber der Erwartung) bringt etwa drei Punkte.
 */
export function reviewPotential(
  rng: Rng,
  player: Player,
  alter: number,
  profil: TalentEigenschaft,
  schnitt: number,
  einsaetze: number,
  minutenJeSpiel: number,
  drift = 0,
): PotentialReview {
  const vorher = player.potential;
  const koennen = aktuellesKoennen(player);
  const offen = fensterOffen(alter, profil);

  // Wer kaum spielt, kann sich nicht empfehlen. Das ist kein Malus fuer
  // schlechte Leistung, sondern fehlende Gelegenheit - deshalb faellt es
  // milder aus als eine schwache Note.
  const kaumGespielt = einsaetze > 0 && minutenJeSpiel < 25;

  let delta = 0;
  let grund: PotentialReview['grund'] = 'progress';

  if (einsaetze === 0 || kaumGespielt) {
    delta = -0.4 * (0.4 + offen * 0.6);
    grund = 'bench';
  } else {
    const abstand = schnitt - erwarteteNote(koennen);
    delta = abstand * 0.6 * profil.ausschlag;
    // Nach oben nur, solange das Fenster offen ist. Nach unten immer.
    if (delta > 0) delta *= offen;
    grund = delta > 0.45 ? 'breakthrough' : delta > 0 ? 'progress' : 'stall';
  }

  // Der Kopf entscheidet mit, ob aus Talent etwas wird.
  const kopf = (player.attrs.professionalism + player.attrs.ambition
    + player.attrs.resilience) / 3;
  delta *= 0.75 + kopf / 200;

  // Mit geschlossenem Fenster sinkt das Potenzial langsam auf das zu, was
  // tatsaechlich da ist - ein Traum, den niemand mehr ernst nimmt.
  if (offen === 0 && vorher > koennen + 2) {
    delta -= 0.25;
    if (delta < 0) grund = 'age';
  }

  // Die Unschaerfe bleibt klein gegen das Signal, sonst wuerde sie es
  // uebertoenen.
  delta += rng.float(-0.15, 0.15);

  const gesammelt = drift + delta;
  // Ganze Punkte werden abgeschoepft, der Rest bleibt liegen.
  const schritt = Math.trunc(gesammelt);
  const rest = gesammelt - schritt;

  // Unter das tatsaechliche Koennen faellt das Potenzial nicht, und ueber 97
  // geht es nicht hinaus.
  const ziel = clamp(vorher + schritt, Math.max(koennen, 30), 97);
  return { schritt: ziel - vorher, drift: rest, grund };
}
/** Aktuelle Gesamtstaerke auf der Hauptposition. */
function aktuellesKoennen(player: Player): number {
  return computeOverall(player.attrs, player.position);
}

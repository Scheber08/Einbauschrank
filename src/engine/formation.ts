/**
 * Welche Formation eine Mannschaft an diesem Spieltag waehlt.
 *
 * `club.formation` wurde bei der Weltgenerierung gesetzt und **nie wieder
 * angefasst**. Ein Verein spielte im August dieselbe Grundordnung wie im Mai,
 * gegen den Tabellenletzten wie gegen den Meister, daheim wie auswaerts. Sieben
 * Formationen gab es, benutzt wurde je Verein genau eine. Kein Trainer hat je
 * auf einen Gegner reagiert.
 *
 * Die Vereinsformation bleibt der Anker - eine Mannschaft wirft ihre Identitaet
 * nicht jede Woche ueber Bord. Bei einem deutlichen Kraeftegefaelle rueckt sie
 * aber eine Stufe nach hinten oder vorne, und auswaerts eher nach hinten als
 * daheim.
 */

import type { FormationKey } from './types';

/** Eine Stufe defensiver. Wer schon ganz hinten steht, bleibt dort. */
const DEFENSIVER: Record<FormationKey, FormationKey> = {
  '4-4-2': '4-1-4-1',
  '4-3-3': '4-2-3-1',
  '4-2-3-1': '4-1-4-1',
  '3-5-2': '5-3-2',
  '3-4-3': '3-5-2',
  '5-3-2': '5-3-2',
  '4-1-4-1': '5-3-2',
};

/** Eine Stufe offensiver. */
const OFFENSIVER: Record<FormationKey, FormationKey> = {
  '4-4-2': '4-3-3',
  '4-3-3': '3-4-3',
  '4-2-3-1': '4-3-3',
  '3-5-2': '3-4-3',
  '3-4-3': '3-4-3',
  '5-3-2': '3-5-2',
  '4-1-4-1': '4-4-2',
};

/** Nur fuer Messungen und den Rauchtest: die Tabelle nach hinten. */
export const DEFENSIVER_TEST = DEFENSIVER;

/** Ein Wurf zwischen 0 und 1 aus Partie und Verein - je Seite ein anderer. */
function roll(matchId: string, clubId: string): number {
  let h = 29;
  const text = `${matchId}|${clubId}`;
  for (let i = 0; i < text.length; i++) {
    h = (h * 47 + text.charCodeAt(i)) % 100003;
  }
  return (h % 967) / 967;
}

export interface FormationLage {
  /** Grundordnung des Vereins. */
  basis: FormationKey;
  /** Eigene Mannschaftsstaerke. */
  eigene: number;
  /** Staerke des Gegners. */
  gegner: number;
  daheim: boolean;
  matchId: string;
  clubId: string;
}

/**
 * Die Grundordnung fuer diese eine Partie.
 *
 * Der Ausschlag ist bewusst begrenzt: hoechstens eine Stufe, und in gut der
 * Haelfte der Faelle bleibt es bei der Vereinsformation. Wer jede Woche eine
 * andere Ordnung spielt, hat keine.
 */
export function matchFormation(lage: FormationLage): FormationKey {
  const abstand = lage.eigene - lage.gegner;
  // Auswaerts geht man vorsichtiger zu Werke, daheim mutiger.
  const heimzuschlag = lage.daheim ? 2 : -2;
  const netto = abstand + heimzuschlag;

  let defensiv = 0;
  let offensiv = 0;
  if (netto <= -8) defensiv = 0.55;
  else if (netto <= -3) defensiv = 0.3;
  else if (netto >= 8) offensiv = 0.45;
  else if (netto >= 3) offensiv = 0.25;

  const wurf = roll(lage.matchId, lage.clubId);
  if (wurf < defensiv) return DEFENSIVER[lage.basis];
  if (wurf < offensiv) return OFFENSIVER[lage.basis];
  return lage.basis;
}

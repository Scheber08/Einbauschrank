/**
 * Herkunftslaender der Spieler.
 *
 * Getrennt von den bespielbaren Laendern: Wo jemand spielt und woher er kommt,
 * sind zwei verschiedene Dinge. Ein Brasilianer in der deutschen Liga ist der
 * Normalfall, kein Sonderfall.
 *
 * Laendernamen sind geografische Bezeichnungen und damit frei verwendbar.
 */
import type { AttrKey } from './attributes';
import { COUNTRIES } from './countries';

export interface Nation {
  id: string;
  name: string;
  /** Erdteil, nur zur Gruppierung in der Auswahl. */
  region: string;
  /**
   * Fussballerisches Gewicht der Nation, etwa 35 bis 80. Steuert zweierlei:
   * wie oft sie Legionaere in die Ligen schickt und wie stark ihre Auswahl im
   * World Nations Cup auftritt. Eine eigene Einschaetzung, kein Ranking.
   */
  strength: number;
  /**
   * Aus welchem Namenspool die Vor- und Nachnamen stammen. Verweist auf eine
   * Kennung aus names.ts; mehrere Nationen teilen sich einen Pool.
   */
  namePool: string;
  /**
   * Kennung des bespielbaren Landes, dessen Nationalmannschaft diese Nation
   * stellt. Nur fuer die fuenf Laender mit eigenem Ligasystem gesetzt.
   */
  gameCountry?: string;
  /** Leichte Neigung bei der Spielerzeugung - Fussballfolklore, kein Urteil. */
  bias?: Partial<Record<AttrKey, number>>;
}

/**
 * Die Liste deckt die fussballerisch gaengigen Nationen ab. Sie darf jederzeit
 * ergaenzt werden - eine unbekannte Kennung faellt auf den Standardpool zurueck.
 */
export const NATIONS: Nation[] = [
  // --- Europa ---------------------------------------------------------
  { id: 'de', name: 'Deutschland', region: 'Europa', strength: 78, namePool: 'falkenland', gameCountry: 'falkenland' },
  { id: 'at', name: 'Oesterreich', region: 'Europa', strength: 58, namePool: 'falkenland' },
  { id: 'ch', name: 'Schweiz', region: 'Europa', strength: 62, namePool: 'falkenland' },
  { id: 'en', name: 'England', region: 'Europa', strength: 79, namePool: 'albion', gameCountry: 'albion' },
  { id: 'sco', name: 'Schottland', region: 'Europa', strength: 55, namePool: 'albion' },
  { id: 'wal', name: 'Wales', region: 'Europa', strength: 54, namePool: 'albion' },
  { id: 'ie', name: 'Irland', region: 'Europa', strength: 54, namePool: 'albion' },
  { id: 'es', name: 'Spanien', region: 'Europa', strength: 79, namePool: 'iberia', gameCountry: 'iberia' },
  { id: 'pt', name: 'Portugal', region: 'Europa', strength: 76, namePool: 'iberia' },
  { id: 'it', name: 'Italien', region: 'Europa', strength: 77, namePool: 'calcio', gameCountry: 'calcio' },
  { id: 'fr', name: 'Frankreich', region: 'Europa', strength: 80, namePool: 'gallia', gameCountry: 'gallia' },
  { id: 'be', name: 'Belgien', region: 'Europa', strength: 72, namePool: 'gallia' },
  { id: 'nl', name: 'Niederlande', region: 'Europa', strength: 74, namePool: 'falkenland' },
  { id: 'dk', name: 'Daenemark', region: 'Europa', strength: 66, namePool: 'falkenland' },
  { id: 'se', name: 'Schweden', region: 'Europa', strength: 62, namePool: 'falkenland' },
  { id: 'no', name: 'Norwegen', region: 'Europa', strength: 60, namePool: 'falkenland' },
  { id: 'fi', name: 'Finnland', region: 'Europa', strength: 48, namePool: 'falkenland' },
  { id: 'is', name: 'Island', region: 'Europa', strength: 46, namePool: 'falkenland' },
  { id: 'pl', name: 'Polen', region: 'Europa', strength: 62, namePool: 'falkenland' },
  { id: 'cz', name: 'Tschechien', region: 'Europa', strength: 58, namePool: 'falkenland' },
  { id: 'sk', name: 'Slowakei', region: 'Europa', strength: 54, namePool: 'falkenland' },
  { id: 'hu', name: 'Ungarn', region: 'Europa', strength: 54, namePool: 'falkenland' },
  { id: 'hr', name: 'Kroatien', region: 'Europa', strength: 70, namePool: 'calcio' },
  { id: 'rs', name: 'Serbien', region: 'Europa', strength: 64, namePool: 'calcio' },
  { id: 'ba', name: 'Bosnien und Herzegowina', region: 'Europa', strength: 55, namePool: 'calcio' },
  { id: 'si', name: 'Slowenien', region: 'Europa', strength: 55, namePool: 'calcio' },
  { id: 'gr', name: 'Griechenland', region: 'Europa', strength: 58, namePool: 'calcio' },
  { id: 'tr', name: 'Tuerkei', region: 'Europa', strength: 62, namePool: 'calcio' },
  { id: 'ro', name: 'Rumaenien', region: 'Europa', strength: 54, namePool: 'calcio' },
  { id: 'bg', name: 'Bulgarien', region: 'Europa', strength: 48, namePool: 'calcio' },
  { id: 'ua', name: 'Ukraine', region: 'Europa', strength: 62, namePool: 'falkenland' },
  { id: 'ru', name: 'Russland', region: 'Europa', strength: 60, namePool: 'falkenland' },
  { id: 'al', name: 'Albanien', region: 'Europa', strength: 50, namePool: 'calcio' },
  { id: 'xk', name: 'Kosovo', region: 'Europa', strength: 46, namePool: 'calcio' },
  { id: 'mk', name: 'Nordmazedonien', region: 'Europa', strength: 46, namePool: 'calcio' },
  { id: 'me', name: 'Montenegro', region: 'Europa', strength: 46, namePool: 'calcio' },

  // --- Suedamerika ----------------------------------------------------
  { id: 'br', name: 'Brasilien', region: 'Suedamerika', strength: 78, namePool: 'iberia', bias: { dribbling: 5, ballControl: 4, firstTouch: 4 } },
  { id: 'ar', name: 'Argentinien', region: 'Suedamerika', strength: 78, namePool: 'iberia', bias: { dribbling: 4, decisions: 3, composure: 4 } },
  { id: 'uy', name: 'Uruguay', region: 'Suedamerika', strength: 68, namePool: 'iberia', bias: { bravery: 4, tackling: 3 } },
  { id: 'co', name: 'Kolumbien', region: 'Suedamerika', strength: 66, namePool: 'iberia', bias: { agility: 3, ballControl: 3 } },
  { id: 'cl', name: 'Chile', region: 'Suedamerika', strength: 60, namePool: 'iberia' },
  { id: 'pe', name: 'Peru', region: 'Suedamerika', strength: 56, namePool: 'iberia' },
  { id: 've', name: 'Venezuela', region: 'Suedamerika', strength: 52, namePool: 'iberia' },
  { id: 'ec', name: 'Ecuador', region: 'Suedamerika', strength: 60, namePool: 'iberia' },
  { id: 'py', name: 'Paraguay', region: 'Suedamerika', strength: 56, namePool: 'iberia' },
  { id: 'bo', name: 'Bolivien', region: 'Suedamerika', strength: 42, namePool: 'iberia' },

  // --- Nord- und Mittelamerika ---------------------------------------
  { id: 'us', name: 'Vereinigte Staaten', region: 'Nordamerika', strength: 62, namePool: 'albion' },
  { id: 'ca', name: 'Kanada', region: 'Nordamerika', strength: 58, namePool: 'albion' },
  { id: 'mx', name: 'Mexiko', region: 'Nordamerika', strength: 64, namePool: 'iberia' },
  { id: 'cr', name: 'Costa Rica', region: 'Nordamerika', strength: 52, namePool: 'iberia' },
  { id: 'jm', name: 'Jamaika', region: 'Nordamerika', strength: 50, namePool: 'albion' },
  { id: 'hn', name: 'Honduras', region: 'Nordamerika', strength: 46, namePool: 'iberia' },
  { id: 'pa', name: 'Panama', region: 'Nordamerika', strength: 48, namePool: 'iberia' },

  // --- Afrika ---------------------------------------------------------
  { id: 'ma', name: 'Marokko', region: 'Afrika', strength: 68, namePool: 'gallia' },
  { id: 'dz', name: 'Algerien', region: 'Afrika', strength: 62, namePool: 'gallia' },
  { id: 'tn', name: 'Tunesien', region: 'Afrika', strength: 58, namePool: 'gallia' },
  { id: 'eg', name: 'Aegypten', region: 'Afrika', strength: 60, namePool: 'gallia' },
  { id: 'ng', name: 'Nigeria', region: 'Afrika', strength: 64, namePool: 'albion', bias: { pace: 4, strength: 4 } },
  { id: 'gh', name: 'Ghana', region: 'Afrika', strength: 60, namePool: 'albion', bias: { strength: 4, stamina: 3 } },
  { id: 'sn', name: 'Senegal', region: 'Afrika', strength: 66, namePool: 'gallia', bias: { pace: 4, strength: 3 } },
  { id: 'ci', name: 'Elfenbeinkueste', region: 'Afrika', strength: 62, namePool: 'gallia', bias: { strength: 4 } },
  { id: 'cm', name: 'Kamerun', region: 'Afrika', strength: 60, namePool: 'gallia', bias: { strength: 3 } },
  { id: 'ml', name: 'Mali', region: 'Afrika', strength: 56, namePool: 'gallia' },
  { id: 'cd', name: 'DR Kongo', region: 'Afrika', strength: 54, namePool: 'gallia' },
  { id: 'za', name: 'Suedafrika', region: 'Afrika', strength: 52, namePool: 'albion' },
  { id: 'bf', name: 'Burkina Faso', region: 'Afrika', strength: 54, namePool: 'gallia' },
  { id: 'gn', name: 'Guinea', region: 'Afrika', strength: 52, namePool: 'gallia' },
  { id: 'cv', name: 'Kap Verde', region: 'Afrika', strength: 48, namePool: 'iberia' },
  { id: 'ao', name: 'Angola', region: 'Afrika', strength: 46, namePool: 'iberia' },

  // --- Asien und Ozeanien --------------------------------------------
  { id: 'jp', name: 'Japan', region: 'Asien', strength: 66, namePool: 'calcio', bias: { teamwork: 4, discipline: 5 } },
  { id: 'kr', name: 'Suedkorea', region: 'Asien', strength: 64, namePool: 'calcio', bias: { stamina: 4, discipline: 4 } },
  { id: 'cn', name: 'China', region: 'Asien', strength: 44, namePool: 'calcio' },
  { id: 'au', name: 'Australien', region: 'Ozeanien', strength: 58, namePool: 'albion', bias: { stamina: 3 } },
  { id: 'nz', name: 'Neuseeland', region: 'Ozeanien', strength: 44, namePool: 'albion' },
  { id: 'ir', name: 'Iran', region: 'Asien', strength: 58, namePool: 'calcio' },
  { id: 'sa', name: 'Saudi-Arabien', region: 'Asien', strength: 54, namePool: 'calcio' },
  { id: 'qa', name: 'Katar', region: 'Asien', strength: 50, namePool: 'calcio' },
  { id: 'uz', name: 'Usbekistan', region: 'Asien', strength: 52, namePool: 'calcio' },
  { id: 'th', name: 'Thailand', region: 'Asien', strength: 44, namePool: 'calcio' },
  { id: 'in', name: 'Indien', region: 'Asien', strength: 38, namePool: 'albion' },
  { id: 'il', name: 'Israel', region: 'Asien', strength: 52, namePool: 'calcio' },
];

export const NATION_BY_ID: Record<string, Nation> = Object.fromEntries(
  NATIONS.map((n) => [n.id, n]),
);

/** Nationen nach Erdteil, fuer die Auswahl bei der Spielerstellung. */
export function nationsByRegion(): { region: string; nations: Nation[] }[] {
  const order = ['Europa', 'Suedamerika', 'Nordamerika', 'Afrika', 'Asien', 'Ozeanien'];
  return order
    .map((region) => ({ region, nations: NATIONS.filter((n) => n.region === region) }))
    .filter((g) => g.nations.length > 0);
}

/**
 * Anzeigename einer Nation. Unbekannte Kennungen koennen aus alten
 * Spielstaenden stammen, in denen die Nationalitaet noch ein Spielland war.
 */
export function nationName(id: string): string {
  return NATION_BY_ID[id]?.name
    ?? COUNTRIES.find((c) => c.id === id)?.name
    ?? id;
}

/** Welcher Namenspool gilt fuer diese Nation? */
export function namePoolOf(id: string): string {
  return NATION_BY_ID[id]?.namePool
    ?? (COUNTRIES.some((c) => c.id === id) ? id : 'falkenland');
}

/**
 * Auf welches bespielbare Land faellt diese Nation fuer die Nationalmannschaft?
 * Nationen ohne eigenes Ligasystem liefern null - fuer sie gibt es im Spiel
 * keinen eigenen Kader, wohl aber einen Platz im World Nations Cup.
 */
export function gameCountryOfNation(id: string): string | null {
  const n = NATION_BY_ID[id];
  if (n) return n.gameCountry ?? null;
  return COUNTRIES.some((c) => c.id === id) ? id : null;
}

/** Umgekehrter Weg: welche Nation stellt die Auswahl dieses Spiellandes? */
export function nationOfGameCountry(countryId: string): string | null {
  return NATIONS.find((n) => n.gameCountry === countryId)?.id ?? null;
}

/**
 * Gewichtete Liste fuer die Auslaenderwahl bei der Weltgenerierung. Das
 * Gewicht waechst quadratisch mit der Staerke: eine grosse Fussballnation
 * schickt ein Vielfaches an Legionaeren los, eine kleine kaum einen.
 */
export const FOREIGN_NATION_POOL: string[] = (() => {
  const pool: string[] = [];
  for (const n of NATIONS) {
    const w = Math.max(1, Math.round(((n.strength - 34) / 6) ** 2));
    for (let i = 0; i < w; i++) pool.push(n.id);
  }
  return pool;
})();

/**
 * Bringt eine Herkunftsangabe auf eine Nationskennung. Aeltere Spielstaende
 * haben dort noch ein Ligaland stehen, weil Herkunft und Spielort damals
 * dasselbe waren.
 */
export function normalizeNationality(id: string): string {
  if (NATION_BY_ID[id]) return id;
  return nationOfGameCountry(id) ?? id;
}

/**
 * Sucht eine Nation ueber Kennung oder Namen. Gedacht fuer Eingaben aus
 * CSV-Dateien und dem Editor, wo "br", "Brasilien" oder "brasilien" gleich
 * gemeint sind. Umlaute und Sonderzeichen werden vorher geglaettet, damit
 * "Österreich" und "Oesterreich" beide treffen.
 */
export function findNation(input: string): Nation | null {
  const key = foldName(input);
  if (!key) return null;
  return NATIONS.find((n) => n.id === key || foldName(n.name) === key) ?? null;
}

function foldName(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ae/g, 'a').replace(/oe/g, 'o').replace(/ue/g, 'u')
    .replace(/[^a-z]/g, '');
}

/**
 * Kurzzeichen fuer Tabellen, zwei bis drei Buchstaben. Die Kennungen folgen
 * den gaengigen Laendercodes, deshalb genuegt Grossschreibung.
 */
export function nationCode(id: string): string {
  const nation = NATION_BY_ID[id];
  if (nation) return nation.id.toUpperCase();
  const mapped = NATIONS.find((n) => n.gameCountry === id);
  return (mapped?.id ?? id.slice(0, 3)).toUpperCase();
}

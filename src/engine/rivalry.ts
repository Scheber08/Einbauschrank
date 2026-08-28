/**
 * Rivalitaeten zwischen Vereinen und die Bedeutung einer Partie.
 *
 * Wie die Vereinsidentitaet wird alles aus den vorhandenen Vereinsdaten
 * abgeleitet statt gespeichert - bestehende Spielstaende bekommen ihre Derbys
 * damit sofort, ohne Migration.
 */
import { kickoffAuslastung, matchKickoff } from './kickoff';
import type { Club, GameState, Match } from './types';
import { t } from '../i18n';

export type DerbyKind = 'city' | 'traditional' | 'topClash' | null;

/** Laufende Nummer einer Vereins-Id ("c573" -> 573). */
function clubNumber(id: string): number {
  const n = Number(id.replace(/\D/g, ''));
  return Number.isFinite(n) ? n : 0;
}

/**
 * Traditioneller Erzrivale eines Vereins. Vereine ohne Stadtnachbarn haetten
 * sonst nie ein Derby - hier bekommt jeder Verein genau einen festen Gegenpart.
 *
 * Gepaart wird nach der laufenden Vereinsnummer. Da die Vereine bei der
 * Welterzeugung Liga fuer Liga angelegt werden, treffen dadurch Vereine
 * derselben Spielklasse aufeinander - man begegnet seinem Rivalen also
 * tatsaechlich im Ligabetrieb. Die Zuordnung ist symmetrisch und dauerhaft;
 * Auf- und Abstiege aendern nichts daran.
 */
function archRivalId(club: Club, allClubs: Record<string, Club>): string | null {
  const sameCountry = Object.values(allClubs)
    .filter((c) => c.countryId === club.countryId)
    .sort((a, b) => clubNumber(a.id) - clubNumber(b.id));
  const index = sameCountry.findIndex((c) => c.id === club.id);
  if (index < 0 || sameCountry.length < 2) return null;
  // Benachbarte Vereine der Reihe nach paaren: 0-1, 2-3, 4-5 ...
  const partner = index % 2 === 0 ? sameCountry[index + 1] : sameCountry[index - 1];
  return partner?.id ?? null;
}

/**
 * Art der Rivalitaet zwischen zwei Vereinen.
 * - city: Beide kommen aus derselben Stadt - das schaerfste Duell.
 * - traditional: Fester Erzrivale, auch ohne gemeinsame Stadt.
 * - topClash: Zwei Spitzenmannschaften derselben Liga treffen aufeinander.
 */
export function derbyKind(a: Club, b: Club, allClubs?: Record<string, Club>): DerbyKind {
  if (a.id === b.id) return null;
  if (a.countryId === b.countryId && a.city === b.city) return 'city';
  if (allClubs && archRivalId(a, allClubs) === b.id) return 'traditional';
  if (a.leagueId === b.leagueId && a.reputation >= 70 && b.reputation >= 70) return 'topClash';
  return null;
}

export function derbyLabel(kind: DerbyKind): string | null {
  if (kind === 'city') return t('derby.city');
  if (kind === 'traditional') return t('derby.traditional');
  if (kind === 'topClash') return t('derby.topClash');
  return null;
}

export interface MatchImportance {
  derby: DerbyKind;
  label: string | null;
  /** Zusaetzlicher Gegnerdruck in den Spielszenen, 0-0,2. */
  pressure: number;
  /** Faktor auf die Zuschauerzahl. */
  crowd: number;
}

/** Bedeutung einer Partie fuer Atmosphaere und Druck. */
export function matchImportance(state: GameState, match: Match): MatchImportance {
  const home = state.clubs[match.homeClubId];
  const away = state.clubs[match.awayClubId];
  if (!home || !away) return { derby: null, label: null, pressure: 0, crowd: 1 };

  const kind = derbyKind(home, away, state.clubs);
  const comp = state.competitions[match.competitionId];
  // Pokal- und Europapokalspiele ziehen ebenfalls mehr Publikum.
  const knockout = comp?.type === 'cup';

  let pressure = 0;
  let crowd = 1;
  if (kind === 'city') { pressure += 0.14; crowd += 0.3; }
  else if (kind === 'traditional') { pressure += 0.11; crowd += 0.25; }
  else if (kind === 'topClash') { pressure += 0.09; crowd += 0.22; }
  if (knockout) { pressure += 0.05; crowd += 0.12; }

  return { derby: kind, label: derbyLabel(kind), pressure, crowd };
}

/**
 * Zuschauerzahl einer Partie. Beruecksichtigt Stadion, Zugkraft des Gegners,
 * Bedeutung und Ligastufe - statt einer reinen Zufallszahl.
 */
/**
 * Streuwert der Zuschauerzahl, aus der Partiekennung gezogen.
 *
 * Vor dem Anpfiff gibt es keinen Zufallsgeber, nach dem Spiel schon -
 * beide Stellen nannten deshalb verschiedene Zahlen. Aus der Kennung
 * bleibt der Wurf ueber die ganze Partie derselbe und ist trotzdem je
 * Spiel ein anderer.
 */
export function attendanceRoll(matchId: string): number {
  let h = 7;
  for (let i = 0; i < matchId.length; i++) {
    h = (h * 31 + matchId.charCodeAt(i)) % 100003;
  }
  return (h % 997) / 997;
}

export function expectedAttendance(
  state: GameState, match: Match, randomFactor: number,
): number {
  const home = state.clubs[match.homeClubId];
  const away = state.clubs[match.awayClubId];
  if (!home) return 0;
  const importance = matchImportance(state, match);

  // Grundauslastung steigt mit dem eigenen Ansehen.
  let fill = 0.42 + home.reputation / 190;
  // Ein attraktiver Gegner fuellt die Raenge zusaetzlich.
  if (away) fill += Math.max(0, away.reputation - 45) / 320;
  fill *= importance.crowd;
  // Etwas Streuung, damit nicht jedes Spiel gleich aussieht.
  fill *= 0.88 + randomFactor * 0.24;
  // Und die Anstosszeit: ein Dienstagabend fuellt schlechter als der
  // Samstagnachmittag, ein Freitagabend etwas besser.
  fill *= kickoffAuslastung(matchKickoff(match.id, match.date), match.date);

  const capped = Math.min(1, Math.max(0.22, fill));
  return Math.round((home.stadiumCapacity * capped) / 50) * 50;
}

/** Alle Rivalen eines Vereins - fuer die Vereinsdarstellung. */
export function rivalsOf(state: GameState, clubId: string): Club[] {
  const club = state.clubs[clubId];
  if (!club) return [];
  return Object.values(state.clubs)
    .filter((c) => derbyKind(club, c, state.clubs) !== null)
    .sort((a, b) => b.reputation - a.reputation)
    .slice(0, 4);
}

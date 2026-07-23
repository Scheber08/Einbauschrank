/**
 * Medien und Interviews (Konzept Abschnitt 39, 31, 32).
 * Nach markanten Partien beantwortet der Spieler Fragen. Die Tonlage der
 * Antwort verschiebt Moral, Trainerbeziehung, Fanbeliebtheit, oeffentliches
 * Image und Reputation.
 */
import { addNews } from './ids';
import { Rng } from './rng';
import { clamp } from './rng';
import type { GameState, Id, Match, PlayerMatchStats } from './types';

export interface InterviewEffect {
  morale?: number;
  coach?: number;
  fans?: number;
  image?: number; // 0 = Bad Boy, 100 = Vorbild
  reputation?: number;
}

export interface InterviewOption {
  id: string;
  label: string;
  /** Kurze Beschreibung der Tonlage. */
  tone: string;
  effect: InterviewEffect;
  /** Reaktion, die nach der Wahl erscheint. */
  reaction: string;
}

export interface Interview {
  id: Id;
  question: string;
  context: string;
  options: InterviewOption[];
}

interface Situation {
  won: boolean;
  lost: boolean;
  drew: boolean;
  scored: boolean;
  hattrick: boolean;
  motm: boolean;
  poor: boolean;
  opponentName: string;
  scoreText: string;
}

/**
 * Entscheidet, ob nach dem Spiel ein Interview stattfindet, und baut es auf.
 * Gibt null zurueck, wenn kein Interview ansteht.
 */
export function buildPostMatchInterview(
  state: GameState, match: Match, stats: PlayerMatchStats, rng: Rng,
): Interview | null {
  if (stats.minutes <= 0) return null;

  const user = state.players[state.userPlayerId];
  const clubId = stats.clubId;
  const isHome = clubId === match.homeClubId;
  const teamGoals = isHome ? match.homeScore ?? 0 : match.awayScore ?? 0;
  const oppGoals = isHome ? match.awayScore ?? 0 : match.homeScore ?? 0;
  const opponentId = isHome ? match.awayClubId : match.homeClubId;

  const sit: Situation = {
    won: teamGoals > oppGoals,
    lost: teamGoals < oppGoals,
    drew: teamGoals === oppGoals,
    scored: stats.goals > 0,
    hattrick: stats.goals >= 3,
    motm: stats.motm,
    poor: stats.rating < 5.8,
    opponentName: state.clubs[opponentId]?.name ?? 'den Gegner',
    scoreText: `${match.homeScore}:${match.awayScore}`,
  };

  // Nicht jedes Spiel bringt ein Interview - markante Spiele oefter.
  const notable = sit.hattrick || sit.motm || (sit.scored && sit.won)
    || (sit.lost && oppGoals - teamGoals >= 3) || sit.poor;
  const chance = notable ? 0.9 : 0.3;
  if (!rng.chance(chance)) return null;

  const question = buildQuestion(sit, user.lastName);
  const options = buildOptions(sit);

  return {
    id: `iv-${match.id}`,
    question,
    context: `${state.clubs[clubId]?.name} ${sit.scoreText} ${state.clubs[opponentId]?.name}`,
    options: rng.shuffle(options.slice()),
  };
}

function buildQuestion(sit: Situation, lastName: string): string {
  if (sit.hattrick) return `Drei Tore, ${lastName}! Wie fuehlt sich dieser Abend an?`;
  if (sit.motm && sit.won) return 'Mann des Spiels und ein Sieg. Ihr Kommentar?';
  if (sit.scored && sit.won) return `Ihr Tor entscheidet gegen ${sit.opponentName}. Zufrieden?`;
  if (sit.lost) return `Eine Niederlage gegen ${sit.opponentName}. Was ist schiefgelaufen?`;
  if (sit.poor) return 'Das war heute nicht Ihr bestes Spiel. Wie ordnen Sie das ein?';
  if (sit.drew) return 'Ein Unentschieden. Zu wenig oder in Ordnung?';
  return 'Wie bewerten Sie Ihren Auftritt heute?';
}

/** Drei Tonlagen: bescheiden, selbstbewusst, provokant. */
function buildOptions(sit: Situation): InterviewOption[] {
  const humble: InterviewOption = {
    id: 'humble',
    label: sit.lost
      ? 'Wir arbeiten weiter, das Team kommt zurueck.'
      : 'Das war Teamleistung, ich hatte nur meinen Anteil.',
    tone: 'Bescheiden, teamorientiert',
    effect: sit.lost
      ? { coach: 3, morale: 1, image: 2 }
      : { coach: 4, morale: 2, fans: 1, image: 3 },
    reaction: 'Der Trainer nickt anerkennend. Solche Aussagen kommen in der Kabine gut an.',
  };

  const confident: InterviewOption = {
    id: 'confident',
    label: sit.lost
      ? 'Ich habe mein Bestes gegeben, an mir lag es nicht.'
      : 'Ich bin in Topform und will genau so weitermachen.',
    tone: 'Selbstbewusst, ichbezogen',
    effect: sit.lost
      ? { fans: 1, reputation: 1, coach: -3, image: -2, morale: 1 }
      : { fans: 4, reputation: 3, image: -1, coach: -1, morale: 2 },
    reaction: sit.lost
      ? 'Die Aussage sorgt fuer Stirnrunzeln - Kritik an den Mitspielern kommt selten gut an.'
      : 'Die Fans lieben dein Selbstvertrauen, der Trainer haette es lieber eine Nummer kleiner.',
  };

  const provocative: InterviewOption = {
    id: 'provocative',
    label: sit.won
      ? `Der Gegner war heute chancenlos gegen uns.`
      : sit.lost
        ? 'So kann das nicht weitergehen, da muss sich einiges aendern.'
        : 'Ehrlich gesagt haetten wir mehr verdient gehabt.',
    tone: 'Provokant, riskant',
    effect: sit.won
      ? { fans: 5, reputation: 3, image: -6, coach: -4 }
      : sit.lost
        ? { fans: 2, reputation: 1, image: -5, coach: -6, morale: -1 }
        : { fans: 2, image: -3, coach: -3 },
    reaction: 'Die Schlagzeile ist dir sicher - und der Aerger im Verein womoeglich auch.',
  };

  return [humble, confident, provocative];
}

/** Wendet die gewaehlte Antwort an und erzeugt eine Medienmeldung. */
export function applyInterviewAnswer(
  state: GameState, interview: Interview, optionId: string,
): InterviewOption | null {
  const option = interview.options.find((o) => o.id === optionId);
  if (!option) return null;
  const e = option.effect;
  const user = state.players[state.userPlayerId];

  if (e.morale) user.morale = clamp(user.morale + e.morale, 0, 100);
  if (e.reputation) user.reputation = clamp(user.reputation + e.reputation, 1, 99);
  if (e.coach) state.coachRelation = clamp(state.coachRelation + e.coach, 0, 100);
  if (e.fans) state.fanRelation = clamp(state.fanRelation + e.fans, 0, 100);
  if (e.image) state.publicImage = clamp(state.publicImage + e.image, 0, 100);

  addNews(state, 'media', `Interview: ${user.lastName}`,
    `„${option.label}" - ${option.tone}.`, false);

  return option;
}

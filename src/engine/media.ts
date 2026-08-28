/**
 * Medien und Interviews (Konzept Abschnitt 39, 31, 32).
 * Nach markanten Partien beantwortet der Spieler Fragen. Die Tonlage der
 * Antwort verschiebt Moral, Trainerbeziehung, Fanbeliebtheit, oeffentliches
 * Image und Reputation.
 */
import { t, tVariant } from '../i18n';
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
    opponentName: state.clubs[opponentId]?.name ?? t('iv.opponentFallback'),
    scoreText: `${match.homeScore}:${match.awayScore}`,
  };

  // Nicht jedes Spiel bringt ein Interview - markante Spiele oefter.
  const notable = sit.hattrick || sit.motm || (sit.scored && sit.won)
    || (sit.lost && oppGoals - teamGoals >= 3) || sit.poor;
  const chance = notable ? 0.9 : 0.3;
  if (!rng.chance(chance)) return null;

  // Ein Wurf je Interview: Frage und Reaktionen kommen aus demselben
  // Zufall, bleiben also innerhalb eines Interviews stimmig.
  const wurf = rng.next();
  const question = buildQuestion(sit, user.lastName, wurf);
  const options = buildOptions(sit, rng.next());

  return {
    id: `iv-${match.id}`,
    question,
    context: `${state.clubs[clubId]?.name} ${sit.scoreText} ${state.clubs[opponentId]?.name}`,
    options: rng.shuffle(options.slice()),
  };
}

function buildQuestion(sit: Situation, lastName: string, wurf: number): string {
  if (sit.hattrick) return tVariant('iv.q.hattrick', wurf, { last: lastName });
  if (sit.motm && sit.won) return tVariant('iv.q.motmWin', wurf);
  if (sit.scored && sit.won) return tVariant('iv.q.scoredWin', wurf, { opponent: sit.opponentName });
  if (sit.lost) return tVariant('iv.q.lost', wurf, { opponent: sit.opponentName });
  if (sit.poor) return tVariant('iv.q.poor', wurf);
  if (sit.drew) return tVariant('iv.q.draw', wurf);
  return tVariant('iv.q.default', wurf);
}

/** Drei Tonlagen: bescheiden, selbstbewusst, provokant. */
function buildOptions(sit: Situation, wurf: number): InterviewOption[] {
  const humble: InterviewOption = {
    id: 'humble',
    label: t(sit.lost ? 'iv.humble.lost' : 'iv.humble.other'),
    tone: t('iv.humble.tone'),
    effect: sit.lost
      ? { coach: 3, morale: 1, image: 2 }
      : { coach: 4, morale: 2, fans: 1, image: 3 },
    reaction: tVariant('iv.humble.reaction', wurf),
  };

  const confident: InterviewOption = {
    id: 'confident',
    label: t(sit.lost ? 'iv.confident.lost' : 'iv.confident.other'),
    tone: t('iv.confident.tone'),
    effect: sit.lost
      ? { fans: 1, reputation: 1, coach: -3, image: -2, morale: 1 }
      : { fans: 4, reputation: 3, image: -1, coach: -1, morale: 2 },
    reaction: sit.lost ? t('iv.confident.reactionLost') : tVariant('iv.confident.reaction', wurf),
  };

  const provocative: InterviewOption = {
    id: 'provocative',
    label: t(sit.won ? 'iv.provocative.won'
      : sit.lost ? 'iv.provocative.lost' : 'iv.provocative.draw'),
    tone: t('iv.provocative.tone'),
    effect: sit.won
      ? { fans: 5, reputation: 3, image: -6, coach: -4 }
      : sit.lost
        ? { fans: 2, reputation: 1, image: -5, coach: -6, morale: -1 }
        : { fans: 2, image: -3, coach: -3 },
    reaction: tVariant('iv.provocative.reaction', wurf),
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

  addNews(state, 'media',
    t('iv.news.title', { last: user.lastName }),
    t('iv.news.body', { quote: option.label, tone: option.tone }), false);

  return option;
}

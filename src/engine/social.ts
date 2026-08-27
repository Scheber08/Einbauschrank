/**
 * Soziales Netzwerk (Konzept Abschnitt 40).
 *
 * Die Oeffentlichkeit begleitet die Laufbahn: Fans, Medien und Mitspieler
 * melden sich nach Spielen und Ereignissen zu Wort. Der Spieler kann selbst
 * etwas beitragen - jeder Beitrag wirkt auf Ansehen, Fans und Umfeld.
 */
import { clamp, Rng } from './rng';
import type { GameState, Id, PlayerMatchStats, SocialPost, SocialDraft } from './types';
import { t, tDecimal } from '../i18n';

/** Wie viele Beitraege im Verlauf behalten werden. */
const FEED_LIMIT = 60;

function push(state: GameState, post: Omit<SocialPost, 'id' | 'date'>) {
  if (!state.social) state.social = { followers: 500, feed: [], draft: null };
  state.social.feed.unshift({
    ...post,
    id: `s${state.nextId++}`,
    date: state.date,
  });
  if (state.social.feed.length > FEED_LIMIT) state.social.feed.length = FEED_LIMIT;
}

/** Stellt sicher, dass aeltere Spielstaende einen Feed haben. */
export function ensureSocial(state: GameState) {
  if (!state.social) state.social = { followers: 500, feed: [], draft: null };
  return state.social;
}

/**
 * Follower wachsen mit Ansehen und Erfolgen. Bewusst traege - ein einzelnes
 * gutes Spiel macht niemanden zum Star.
 */
function growFollowers(state: GameState, delta: number) {
  const s = ensureSocial(state);
  s.followers = Math.max(100, Math.round(s.followers + delta));
}

/**
 * Reaktionen nach einem Spiel des eigenen Spielers. Erzeugt Beitraege von
 * aussen und - bei bemerkenswerten Auftritten - die Gelegenheit, selbst etwas
 * zu schreiben.
 */
export function socialAfterMatch(
  state: GameState, stats: PlayerMatchStats, ownGoals: number, oppGoals: number,
  opponentName: string, rng: Rng,
) {
  const s = ensureSocial(state);
  const user = state.players[state.userPlayerId];
  if (!user || stats.minutes === 0) return;

  const won = ownGoals > oppGoals;
  const lost = ownGoals < oppGoals;
  const strong = stats.rating >= 7.2;
  const weak = stats.rating < 5.8;
  const scoreText = `${ownGoals}:${oppGoals}`;

  // Stimmen von aussen. Auch ein unauffaelliges Spiel wird kommentiert - der
  // Feed soll die Saison begleiten, nicht nur die Ausreisser.
  if (stats.goals >= 2) {
    push(state, {
      author: t('soc.author.fanclub'), kind: 'fan',
      text: t('soc.brace', {
        n: stats.goals, last: user.lastName, opponent: opponentName,
      }),
      likes: rng.int(400, 2500),
    });
    growFollowers(state, rng.int(300, 900));
  } else if (strong) {
    push(state, {
      author: t('soc.author.media'), kind: 'media',
      text: t('soc.strong', {
        rating: tDecimal(stats.rating, 1), last: user.lastName,
        score: scoreText, opponent: opponentName,
      }),
      likes: rng.int(120, 900),
    });
    growFollowers(state, rng.int(80, 350));
  } else if (weak) {
    push(state, {
      author: t('soc.author.forum'), kind: 'critic',
      text: t(lost ? 'soc.weakLost' : 'soc.weakOther', {
        last: user.lastName, score: scoreText,
      }),
      likes: rng.int(50, 600),
    });
    growFollowers(state, rng.int(-120, 40));
  } else if (rng.chance(0.55)) {
    // Der Alltag: solide Auftritte, gemischte Meinungen.
    type Stimme = { author: string; kind: SocialPost['kind']; text: string };
    const stimmen: Stimme[] = won
      ? [
        { author: t('soc.author.fanclub'), kind: 'fan',
          text: t('soc.wonFan', { score: scoreText, opponent: opponentName }) },
        { author: t('soc.author.media'), kind: 'media',
          text: t('soc.wonMedia', { last: user.lastName, score: scoreText }) },
      ]
      : lost
        ? [
          { author: t('soc.author.forum'), kind: 'critic',
            text: t('soc.lostCritic', { score: scoreText, opponent: opponentName }) },
          { author: t('soc.author.fanclub'), kind: 'fan',
            text: t('soc.lostFan', { last: user.lastName }) },
        ]
        : [
          { author: t('soc.author.media'), kind: 'media',
            text: t('soc.drawMedia', { score: scoreText, last: user.lastName }) },
          { author: t('soc.author.forum'), kind: 'critic',
            text: t('soc.drawCritic', { opponent: opponentName }) },
        ];
    const s2 = rng.pick(stimmen);
    push(state, { ...s2, likes: rng.int(30, 400) });
    growFollowers(state, rng.int(-30, 120));
  }

  // Gelegenheit fuer einen eigenen Beitrag - nur wenn es etwas zu sagen gibt.
  if (s.draft) return;
  if (stats.goals >= 1 && won) {
    s.draft = buildDraft('winScored', opponentName, scoreText, rng);
  } else if (lost && weak) {
    s.draft = buildDraft('lostPoor', opponentName, scoreText, rng);
  } else if (lost) {
    s.draft = buildDraft('lost', opponentName, scoreText, rng);
  } else if (won && strong) {
    s.draft = buildDraft('winStrong', opponentName, scoreText, rng);
  }
}

type DraftKind = 'winScored' | 'winStrong' | 'lost' | 'lostPoor';

function buildDraft(kind: DraftKind, opponent: string, score: string, rng: Rng): SocialDraft {
  const gemeinsam = {
    id: 'humble',
    label: t('soc.opt.humble'),
    tone: t('soc.tone.humble'),
    effect: { image: 3, fans: 1, teamMood: 3 },
    text: t(rng.pick(['soc.humble.1', 'soc.humble.2', 'soc.humble.3'])),
  };
  switch (kind) {
    case 'winScored':
      return {
        prompt: t('soc.prompt.winScored', { score, opponent }),
        options: [
          gemeinsam,
          { id: 'confident', label: t('soc.opt.confident'), tone: t('soc.tone.confident'),
            effect: { image: -1, fans: 5, reputation: 1, teamMood: -1 },
            text: t('soc.text.confident') },
          { id: 'silent', label: t('soc.opt.silent'), tone: t('soc.tone.quiet'), effect: {}, text: '' },
        ],
      };
    case 'winStrong':
      return {
        prompt: t('soc.prompt.winStrong', { score, opponent }),
        options: [
          gemeinsam,
          { id: 'fans', label: t('soc.opt.fans'), tone: t('soc.tone.close'),
            effect: { fans: 6, image: 2 },
            text: t('soc.text.fans') },
          { id: 'silent', label: t('soc.opt.silent'), tone: t('soc.tone.quiet'), effect: {}, text: '' },
        ],
      };
    case 'lostPoor':
      return {
        prompt: t('soc.prompt.lostPoor', { score, opponent }),
        options: [
          { id: 'owning', label: t('soc.opt.owning'), tone: t('soc.tone.selfCritical'),
            effect: { image: 5, fans: 3, teamMood: 2 },
            text: t('soc.text.owning') },
          { id: 'defiant', label: t('soc.opt.defiant'), tone: t('soc.tone.defiant'),
            effect: { image: -6, fans: -4, teamMood: -2 },
            text: t('soc.text.defiant') },
          { id: 'silent', label: t('soc.opt.silent'), tone: t('soc.tone.quiet'), effect: {}, text: '' },
        ],
      };
    default:
      return {
        prompt: t('soc.prompt.lost', { score, opponent }),
        options: [
          { id: 'rally', label: t('soc.opt.rally'), tone: t('soc.tone.united'),
            effect: { teamMood: 5, image: 2, fans: 1 },
            text: t(rng.pick(['soc.rally.1', 'soc.rally.2', 'soc.rally.3'])) },
          { id: 'blame', label: t('soc.opt.blame'), tone: t('soc.tone.sharp'),
            effect: { teamMood: -9, image: -5, fans: -2 },
            text: t('soc.text.blame') },
          { id: 'silent', label: t('soc.opt.silent'), tone: t('soc.tone.quiet'), effect: {}, text: '' },
        ],
      };
  }
}

/**
 * Veroeffentlicht die gewaehlte Antwort und wendet ihre Wirkung an.
 * Gibt den gewaehlten Beitrag zurueck.
 */
export function publishDraft(state: GameState, optionId: string, rng: Rng): SocialDraft['options'][number] | null {
  const s = ensureSocial(state);
  const draft = s.draft;
  if (!draft) return null;
  const option = draft.options.find((o) => o.id === optionId) ?? draft.options[0];
  s.draft = null;

  const user = state.players[state.userPlayerId];
  if (option.text && user) {
    push(state, {
      author: `${user.firstName} ${user.lastName}`, kind: 'own',
      text: option.text,
      likes: Math.round(s.followers * (0.05 + rng.float(0, 0.12))),
    });
  }

  const e = option.effect;
  if (e.image) state.publicImage = clamp(state.publicImage + e.image, 0, 100);
  if (e.fans) state.fanRelation = clamp(state.fanRelation + e.fans, 0, 100);
  if (e.reputation && user) user.reputation = clamp(user.reputation + e.reputation, 1, 99);
  // Stimmung im Team wirkt auf die Beziehungen zu den Mitspielern.
  if (e.teamMood) {
    for (const id of Object.keys(state.relationships) as Id[]) {
      state.relationships[id] = clamp(state.relationships[id] + e.teamMood * 0.4, -100, 100);
    }
    if (user) user.morale = clamp(user.morale + e.teamMood * 0.3, 0, 100);
  }
  growFollowers(state, option.text ? rng.int(50, 400) : 0);
  return option;
}

/** Beitrag zu einem Titel oder einer Auszeichnung. */
export function socialMilestone(state: GameState, headline: string, rng: Rng) {
  push(state, {
    author: t('soc.author.media'), kind: 'media', text: headline,
    likes: rng.int(500, 4000),
  });
  growFollowers(state, rng.int(500, 2500));
}

/**
 * Soziales Netzwerk (Konzept Abschnitt 40).
 *
 * Die Oeffentlichkeit begleitet die Laufbahn: Fans, Medien und Mitspieler
 * melden sich nach Spielen und Ereignissen zu Wort. Der Spieler kann selbst
 * etwas beitragen - jeder Beitrag wirkt auf Ansehen, Fans und Umfeld.
 */
import { clamp, Rng } from './rng';
import type { GameState, Id, PlayerMatchStats, SocialPost, SocialDraft } from './types';

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
      author: 'Fanclub Nordkurve', kind: 'fan',
      text: `${stats.goals} Tore von ${user.lastName} gegen ${opponentName}. Was fuer ein Auftritt!`,
      likes: rng.int(400, 2500),
    });
    growFollowers(state, rng.int(300, 900));
  } else if (strong) {
    push(state, {
      author: 'Sportredaktion', kind: 'media',
      text: `Note ${stats.rating.toFixed(1)} fuer ${user.lastName} beim ${scoreText} gegen ${opponentName}.`,
      likes: rng.int(120, 900),
    });
    growFollowers(state, rng.int(80, 350));
  } else if (weak) {
    push(state, {
      author: 'Fanforum', kind: 'critic',
      text: lost
        ? `Schwacher Auftritt von ${user.lastName} beim ${scoreText}. Da geht mehr.`
        : `${user.lastName} blieb beim ${scoreText} blass. Glueck gehabt.`,
      likes: rng.int(50, 600),
    });
    growFollowers(state, rng.int(-120, 40));
  } else if (rng.chance(0.55)) {
    // Der Alltag: solide Auftritte, gemischte Meinungen.
    type Stimme = { author: string; kind: SocialPost['kind']; text: string };
    const stimmen: Stimme[] = won
      ? [
        { author: 'Fanclub Nordkurve', kind: 'fan',
          text: `Dreier eingefahren, ${scoreText} gegen ${opponentName}. Weiter so!` },
        { author: 'Sportredaktion', kind: 'media',
          text: `${user.lastName} mit ordentlicher Leistung beim ${scoreText}.` },
      ]
      : lost
        ? [
          { author: 'Fanforum', kind: 'critic',
            text: `${scoreText} gegen ${opponentName}. So wird das nichts mit den Zielen.` },
          { author: 'Fanclub Nordkurve', kind: 'fan',
            text: `Schwerer Nachmittag. Kopf hoch, ${user.lastName} - naechste Woche wieder.` },
        ]
        : [
          { author: 'Sportredaktion', kind: 'media',
            text: `Teilung der Punkte beim ${scoreText}. ${user.lastName} unauffaellig.` },
          { author: 'Fanforum', kind: 'critic',
            text: `Ein Punkt gegen ${opponentName} ist zu wenig.` },
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
    label: 'Dem Team danken',
    tone: 'bescheiden',
    effect: { image: 3, fans: 1, teamMood: 3 },
    text: rng.pick([
      'Der Sieg gehoert der Mannschaft. Danke fuer die Unterstuetzung!',
      'Solche Abende gehen nur zusammen. Starke Leistung, Jungs.',
      'Drei Punkte fuer das Team - und fuer euch da draussen.',
    ]),
  };
  switch (kind) {
    case 'winScored':
      return {
        prompt: `Du hast beim ${score} gegen ${opponent} getroffen. Sagst du etwas dazu?`,
        options: [
          gemeinsam,
          { id: 'confident', label: 'Selbstbewusst auftreten', tone: 'selbstbewusst',
            effect: { image: -1, fans: 5, reputation: 1, teamMood: -1 },
            text: 'Dafuer arbeite ich jeden Tag. Und da kommt noch mehr.' },
          { id: 'silent', label: 'Nichts posten', tone: 'zurueckhaltend', effect: {}, text: '' },
        ],
      };
    case 'winStrong':
      return {
        prompt: `Starker Auftritt beim ${score} gegen ${opponent}.`,
        options: [
          gemeinsam,
          { id: 'fans', label: 'Den Fans widmen', tone: 'nahbar',
            effect: { fans: 6, image: 2 },
            text: 'Diese Unterstuetzung traegt uns. Danke, dass ihr da wart!' },
          { id: 'silent', label: 'Nichts posten', tone: 'zurueckhaltend', effect: {}, text: '' },
        ],
      };
    case 'lostPoor':
      return {
        prompt: `Schwaches Spiel beim ${score} gegen ${opponent}. Die Kritik ist deutlich.`,
        options: [
          { id: 'owning', label: 'Fehler eingestehen', tone: 'selbstkritisch',
            effect: { image: 5, fans: 3, teamMood: 2 },
            text: 'Das war heute zu wenig von mir. Ich nehme das an und arbeite daran.' },
          { id: 'defiant', label: 'Kritik zurueckweisen', tone: 'trotzig',
            effect: { image: -6, fans: -4, teamMood: -2 },
            text: 'Von aussen laesst sich leicht reden. Ich weiss, was ich kann.' },
          { id: 'silent', label: 'Nichts posten', tone: 'zurueckhaltend', effect: {}, text: '' },
        ],
      };
    default:
      return {
        prompt: `Niederlage beim ${score} gegen ${opponent}.`,
        options: [
          { id: 'rally', label: 'Mannschaft aufbauen', tone: 'geschlossen',
            effect: { teamMood: 5, image: 2, fans: 1 },
            text: rng.pick([
              'Kopf hoch, wir stehen zusammen. Naechste Woche greifen wir wieder an.',
              'Heute nicht unser Tag. Wir arbeiten weiter - gemeinsam.',
              'Das tut weh. Aber diese Mannschaft steht wieder auf.',
            ]) },
          { id: 'blame', label: 'Mitspieler kritisieren', tone: 'scharf',
            effect: { teamMood: -9, image: -5, fans: -2 },
            text: 'Alleine gewinnt man kein Spiel. Da muessen andere mehr investieren.' },
          { id: 'silent', label: 'Nichts posten', tone: 'zurueckhaltend', effect: {}, text: '' },
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
    author: 'Sportredaktion', kind: 'media', text: headline,
    likes: rng.int(500, 4000),
  });
  growFollowers(state, rng.int(500, 2500));
}

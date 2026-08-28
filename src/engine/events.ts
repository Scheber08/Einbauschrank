/**
 * Ereignisse ausserhalb des Platzes (Konzept Abschnitt 31 und 32).
 * Zwischen den Spielen tauchen gelegentlich persoenliche Entscheidungen auf,
 * die Moral, Fitness, oeffentliches Image, Fanbeliebtheit und die
 * Trainerbeziehung beeinflussen.
 */
import { t } from '../i18n';
import { addNews } from './ids';
import { Rng, clamp } from './rng';
import type { GameState } from './types';

export interface LifeEffect {
  morale?: number;
  fitness?: number;
  image?: number;
  fans?: number;
  coach?: number;
  sharpness?: number;
}

export interface LifeOption {
  id: string;
  label: string;
  description: string;
  effect: LifeEffect;
  /** Meldung, die nach der Wahl im Nachrichten-Feed erscheint. */
  news?: string;
}

export interface LifeEvent {
  id: string;
  category: string;
  title: string;
  description: string;
  options: LifeOption[];
}

/** Vorlage im Pool: nur Kennungen und Wirkung, kein Text. */
interface EventTemplate {
  key: string;
  options: { id: string; effect: LifeEffect; hasNews?: boolean }[];
}

/**
 * Der Vorrat an Ereignissen. Hier stehen nur Kennung und Wirkung - Titel,
 * Beschreibung und die Antwortmoeglichkeiten liegen im Sprachkatalog unter
 * `life.<key>.*`. So bleibt der Pool ueberschaubar und zweisprachig.
 */
const EVENT_POOL: EventTemplate[] = [
  {
    key: 'karaoke',
    options: [
      {
        id: 'sing',
        effect: {morale:6,image:5,coach:-2},
        hasNews: true,
      },
      {
        id: 'watch',
        effect: {morale:2},
      },
    ],
  },
  {
    key: 'nachbar',
    options: [
      {
        id: 'apologise',
        effect: {image:3,morale:-1},
      },
      {
        id: 'ignore',
        effect: {image:-4,morale:2},
        hasNews: true,
      },
    ],
  },
  {
    key: 'schiedsrichterkurs',
    options: [
      {
        id: 'attend',
        effect: {coach:4,sharpness:-2},
        hasNews: true,
      },
      {
        id: 'skip',
        effect: {fitness:2},
      },
    ],
  },
  {
    key: 'wettbuero',
    options: [
      {
        id: 'refuse',
        effect: {image:6,coach:4},
        hasNews: true,
      },
      {
        id: 'listen',
        effect: {image:-8,coach:-6,morale:2},
      },
    ],
  },
  {
    key: 'schulbesuch',
    options: [
      {
        id: 'go',
        effect: {fans:6,image:4,fitness:-2},
        hasNews: true,
      },
      {
        id: 'send',
        effect: {fans:1},
      },
    ],
  },
  {
    key: 'tattoo',
    options: [
      {
        id: 'crest',
        effect: {fans:8,image:3,coach:-1},
        hasNews: true,
      },
      {
        id: 'nothing',
        effect: {morale:1},
      },
    ],
  },
  {
    key: 'stromausfall',
    options: [
      {
        id: 'improvise',
        effect: {morale:4,sharpness:3},
        hasNews: true,
      },
      {
        id: 'home',
        effect: {fitness:3,coach:-3},
      },
    ],
  },
  {
    key: 'oldtimer',
    options: [
      {
        id: 'buy',
        effect: {image:7,morale:5,fans:-3},
        hasNews: true,
      },
      {
        id: 'save',
        effect: {coach:3,morale:-1},
      },
    ],
  },
  {
    key: 'sponsorentermin',
    options: [
      {
        id: 'attend',
        effect: {image:4,fans:2,sharpness:-3,fitness:-2},
        hasNews: true,
      },
      {
        id: 'decline',
        effect: {coach:3,sharpness:2,image:-2},
      },
    ],
  },
  {
    key: 'mannschaftsabend',
    options: [
      {
        id: 'join',
        effect: {morale:5,fitness:-3},
        hasNews: true,
      },
      {
        id: 'early',
        effect: {morale:2},
      },
      {
        id: 'skip',
        effect: {fitness:2,morale:-2},
      },
    ],
  },
  {
    key: 'charity-aktion',
    options: [
      {
        id: 'help',
        effect: {image:6,fans:5,morale:1},
        hasNews: true,
      },
      {
        id: 'ignore',
        effect: {image:-2},
      },
    ],
  },
  {
    key: 'zusatztraining',
    options: [
      {
        id: 'extra',
        effect: {sharpness:5,coach:2,fitness:-5},
        hasNews: true,
      },
      {
        id: 'rest',
        effect: {fitness:6,sharpness:-1},
      },
    ],
  },
  {
    key: 'beitrag-in-den-sozialen-medi',
    options: [
      {
        id: 'positive',
        effect: {fans:4,image:2},
        hasNews: true,
      },
      {
        id: 'provoke',
        effect: {fans:3,image:-5,coach:-4,morale:1},
        hasNews: true,
      },
      {
        id: 'quiet',
        effect: {coach:1},
      },
    ],
  },
  {
    key: 'freies-wochenende',
    options: [
      {
        id: 'family',
        effect: {morale:4,fitness:2},
      },
      {
        id: 'gym',
        effect: {sharpness:3,coach:1,fitness:-1},
        hasNews: true,
      },
    ],
  },
  {
    key: 'krankenbesuch',
    options: [
      {
        id: 'visit',
        effect: {morale:3,coach:3,fitness:-1},
        hasNews: true,
      },
      {
        id: 'message',
        effect: {morale:1},
      },
    ],
  },
  {
    key: 'fanpost',
    options: [
      {
        id: 'answer',
        effect: {fans:5,image:3,sharpness:-2},
        hasNews: true,
      },
      {
        id: 'later',
        effect: {sharpness:1,fans:-1},
      },
    ],
  },
  {
    key: 'nachwuchsrat',
    options: [
      {
        id: 'mentor',
        effect: {coach:4,morale:2,sharpness:-2},
        hasNews: true,
      },
      {
        id: 'busy',
        effect: {sharpness:2,coach:-2},
      },
    ],
  },
  {
    key: 'boulevard',
    options: [
      {
        id: 'openly',
        effect: {image:5,fans:3,coach:-3},
        hasNews: true,
      },
      {
        id: 'refuse',
        effect: {coach:2,image:-3},
      },
      {
        id: 'lawyer',
        effect: {image:1,fans:-2,morale:-1},
      },
    ],
  },
  {
    key: 'kabinenstreit',
    options: [
      {
        id: 'mediate',
        effect: {coach:5,morale:2},
        hasNews: true,
      },
      {
        id: 'sideA',
        effect: {morale:3,coach:-3},
      },
      {
        id: 'stayout',
        effect: {morale:-2,sharpness:1},
      },
    ],
  },
  {
    key: 'jugendverein',
    options: [
      {
        id: 'go',
        effect: {fans:6,image:4,morale:3,fitness:-2},
        hasNews: true,
      },
      {
        id: 'send',
        effect: {fans:2,image:1},
      },
    ],
  },
  {
    key: 'ernaehrung',
    options: [
      {
        id: 'strict',
        effect: {fitness:5,sharpness:2,morale:-2},
        hasNews: true,
      },
      {
        id: 'balanced',
        effect: {fitness:2,morale:1},
      },
      {
        id: 'ignore',
        effect: {morale:3,fitness:-3},
      },
    ],
  },
  {
    key: 'maskottchen',
    options: [
      {
        id: 'race',
        effect: {fans:6,morale:3,fitness:-3},
        hasNews: true,
      },
      {
        id: 'letWin',
        effect: {fans:4,morale:2},
      },
      {
        id: 'decline',
        effect: {fitness:1,fans:-2},
      },
    ],
  },
  {
    key: 'schafe',
    options: [
      {
        id: 'help',
        effect: {morale:4,fans:3,fitness:-2},
        hasNews: true,
      },
      {
        id: 'film',
        effect: {image:4,fans:2,coach:-2},
        hasNews: true,
      },
      {
        id: 'wait',
        effect: {sharpness:1},
      },
    ],
  },
  {
    key: 'talkshow',
    options: [
      {
        id: 'go',
        effect: {image:6,fans:3,sharpness:-3,coach:-2},
        hasNews: true,
      },
      {
        id: 'decline',
        effect: {coach:3,image:-2},
      },
    ],
  },
  {
    key: 'trikotpanne',
    options: [
      {
        id: 'humour',
        effect: {fans:5,image:3,morale:2},
        hasNews: true,
      },
      {
        id: 'annoyed',
        effect: {morale:-2,image:-1,coach:1},
      },
    ],
  },
  {
    key: 'kochduell',
    options: [
      {
        id: 'cook',
        effect: {morale:5,fans:2,fitness:-1},
        hasNews: true,
      },
      {
        id: 'judge',
        effect: {morale:2,coach:1},
      },
      {
        id: 'skip',
        effect: {sharpness:2,morale:-2},
      },
    ],
  },
  {
    key: 'moewe',
    options: [
      {
        id: 'laugh',
        effect: {morale:3,fans:4,image:2},
        hasNews: true,
      },
      {
        id: 'complain',
        effect: {morale:-1,image:-2,coach:1},
      },
    ],
  },
  {
    key: 'doppelgaenger',
    options: [
      {
        id: 'meet',
        effect: {image:5,fans:4,sharpness:-2},
        hasNews: true,
      },
      {
        id: 'ignore',
        effect: {sharpness:1,image:-1},
      },
    ],
  },
  {
    key: 'busfahrer',
    options: [
      {
        id: 'stay',
        effect: {morale:4,coach:2,fitness:-2},
        hasNews: true,
      },
      {
        id: 'taxi',
        effect: {fitness:2,morale:-2,coach:-2},
      },
    ],
  },
];

/** Baut ein zufaelliges Ereignis mit eindeutiger ID. */
/**
 * Baut ein Ereignis aus dem Pool. Die Texte kommen dabei in der aktuell
 * eingestellten Sprache dazu - der Pool selbst haelt nur Kennungen.
 */
export function buildLifeEvent(rng: Rng, idSeed: number): LifeEvent {
  const template = rng.pick(EVENT_POOL);
  const k = template.key;
  return {
    id: `ev-${idSeed}`,
    category: t(`life.${k}.category`),
    title: t(`life.${k}.title`),
    description: t(`life.${k}.body`),
    options: template.options.map((o) => ({
      id: o.id,
      label: t(`life.${k}.${o.id}.label`),
      description: t(`life.${k}.${o.id}.desc`),
      effect: o.effect,
      news: o.hasNews ? t(`life.${k}.${o.id}.news`) : undefined,
    })),
  };
}

/** Wendet die gewaehlte Option an und meldet sie gegebenenfalls. */
export function applyLifeChoice(
  state: GameState, event: LifeEvent, optionId: string,
): LifeOption | null {
  const option = event.options.find((o) => o.id === optionId);
  if (!option) return null;
  const user = state.players[state.userPlayerId];
  const e = option.effect;

  if (e.morale) user.morale = clamp(user.morale + e.morale, 0, 100);
  if (e.fitness) user.fitness = clamp(user.fitness + e.fitness, 5, 100);
  if (e.sharpness) user.sharpness = clamp(user.sharpness + e.sharpness, 0, 100);
  if (e.image) state.publicImage = clamp(state.publicImage + e.image, 0, 100);
  if (e.fans) state.fanRelation = clamp(state.fanRelation + e.fans, 0, 100);
  if (e.coach) state.coachRelation = clamp(state.coachRelation + e.coach, 0, 100);

  if (option.news) {
    addNews(state, 'social',
      t('life.news.title', { title: event.title, last: user.lastName }),
      t('life.news.body', {
        name: `${user.firstName} ${user.lastName}`, text: option.news,
      }), false);
  }

  return option;
}

/**
 * Ereignisse ausserhalb des Platzes (Konzept Abschnitt 31 und 32).
 * Zwischen den Spielen tauchen gelegentlich persoenliche Entscheidungen auf,
 * die Moral, Fitness, oeffentliches Image, Fanbeliebtheit und die
 * Trainerbeziehung beeinflussen.
 */
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

type EventTemplate = Omit<LifeEvent, 'id'>;

const EVENT_POOL: EventTemplate[] = [
  {
    category: 'Sponsor',
    title: 'Sponsorentermin',
    description: 'Ein Ausruester bittet dich zu einem Werbedreh. Der Termin liegt '
      + 'mitten in der Trainingswoche.',
    options: [
      {
        id: 'attend', label: 'Termin wahrnehmen',
        description: 'Gut fuers Image und die Sponsoren, kostet aber Trainingszeit.',
        effect: { image: 4, fans: 2, sharpness: -3, fitness: -2 },
        news: 'nimmt einen Werbetermin wahr und zeigt sich medienwirksam.',
      },
      {
        id: 'decline', label: 'Absagen und trainieren',
        description: 'Fokus auf den Sport. Der Trainer sieht das gern.',
        effect: { coach: 3, sharpness: 2, image: -2 },
      },
    ],
  },
  {
    category: 'Team',
    title: 'Mannschaftsabend',
    description: 'Die Mannschaft plant einen gemeinsamen Abend. Kommst du mit?',
    options: [
      {
        id: 'join', label: 'Mitgehen',
        description: 'Staerkt den Teamgeist und deine Moral, kostet etwas Frische.',
        effect: { morale: 5, fitness: -3 },
        news: 'staerkt beim Mannschaftsabend den Zusammenhalt.',
      },
      {
        id: 'early', label: 'Kurz vorbeischauen',
        description: 'Ein guter Mittelweg.',
        effect: { morale: 2 },
      },
      {
        id: 'skip', label: 'Zu Hause bleiben',
        description: 'Erholung, aber die Kollegen vermissen dich.',
        effect: { fitness: 2, morale: -2 },
      },
    ],
  },
  {
    category: 'Charity',
    title: 'Charity-Aktion',
    description: 'Ein Kinderhospital bittet um deine Unterstuetzung fuer eine '
      + 'Spendenaktion.',
    options: [
      {
        id: 'help', label: 'Unterstuetzen',
        description: 'Sehr gut fuer Image und Ansehen bei den Fans.',
        effect: { image: 6, fans: 5, morale: 1 },
        news: 'engagiert sich fuer den guten Zweck und wird dafuer gefeiert.',
      },
      {
        id: 'ignore', label: 'Dankend ablehnen',
        description: 'Keine Zeit gerade. Bleibt ohne Folgen - fast.',
        effect: { image: -2 },
      },
    ],
  },
  {
    category: 'Training',
    title: 'Zusatztraining',
    description: 'Du koenntest freiwillige Extraschichten einlegen, um an deinen '
      + 'Schwaechen zu arbeiten.',
    options: [
      {
        id: 'extra', label: 'Extraschichten einlegen',
        description: 'Verbessert deine Spielpraxis, kostet aber Kraft.',
        effect: { sharpness: 5, coach: 2, fitness: -5 },
        news: 'bleibt nach dem Training laenger auf dem Platz.',
      },
      {
        id: 'rest', label: 'Lieber regenerieren',
        description: 'Der Koerper dankt es dir.',
        effect: { fitness: 6, sharpness: -1 },
      },
    ],
  },
  {
    category: 'Medien',
    title: 'Beitrag in den sozialen Medien',
    description: 'Nach den letzten Spielen diskutieren die Fans hitzig. Reagierst '
      + 'du oeffentlich?',
    options: [
      {
        id: 'positive', label: 'Fans positiv einstimmen',
        description: 'Ein motivierender Beitrag kommt gut an.',
        effect: { fans: 4, image: 2 },
        news: 'richtet aufbauende Worte an die Fans.',
      },
      {
        id: 'provoke', label: 'Kritiker anzaehlen',
        description: 'Sorgt fuer Wirbel - und Aerger im Verein.',
        effect: { fans: 3, image: -5, coach: -4, morale: 1 },
        news: 'legt sich in den sozialen Medien mit Kritikern an.',
      },
      {
        id: 'quiet', label: 'Nichts posten',
        description: 'Ruhe bewahren und den Ball flach halten.',
        effect: { coach: 1 },
      },
    ],
  },
  {
    category: 'Erholung',
    title: 'Freies Wochenende',
    description: 'Der Trainer gibt zwei Tage frei. Wie nutzt du sie?',
    options: [
      {
        id: 'family', label: 'Zeit mit der Familie',
        description: 'Kopf frei bekommen, gut fuer die Moral.',
        effect: { morale: 4, fitness: 2 },
      },
      {
        id: 'gym', label: 'Ins Fitnessstudio',
        description: 'Diszipliniert, aber du gonnst dir keine Pause.',
        effect: { sharpness: 3, coach: 1, fitness: -1 },
        news: 'verzichtet auf die freien Tage und arbeitet an der Fitness.',
      },
    ],
  },
];

/** Baut ein zufaelliges Ereignis mit eindeutiger ID. */
export function buildLifeEvent(rng: Rng, idSeed: number): LifeEvent {
  const template = rng.pick(EVENT_POOL);
  return { ...template, id: `ev-${idSeed}` };
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
    addNews(state, 'social', `${event.title}: ${user.lastName}`,
      `${user.firstName} ${user.lastName} ${option.news}`, false);
  }

  return option;
}

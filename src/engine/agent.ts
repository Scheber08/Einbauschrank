/**
 * Spielerberater (Konzept Abschnitt 35).
 *
 * Der Berater ist der Hebel des Spielers auf den Markt: Er sucht Vereine,
 * verhandelt Gehalt nach und fordert beim Trainer eine groessere Rolle ein.
 * Auftraege brauchen Zeit, kosten Vertrauen und gelingen nicht immer - wer den
 * Berater staendig losschickt, verspielt seine Wirkung.
 */
import { addDays, ageOn } from './date';
import { addNews } from './ids';
import { computeOverall } from './attributes';
import { calcSalary } from './playerGen';
import { COUNTRY_BY_ID } from './countries';
import { Rng, clamp } from './rng';
import { SQUAD_ROLE_ORDER } from './types';
import type { Agent, AgentTaskKind, GameState, SquadRole } from './types';

const AGENT_FIRST = ['Marco', 'Ines', 'Tobias', 'Nadja', 'Ruben', 'Elena', 'Frank', 'Selin'];
const AGENT_LAST = ['Vogt', 'Kellner', 'Marand', 'Osei', 'Brandt', 'Ferreira', 'Lindqvist', 'Adler'];

/** Wie lange ein Auftrag dauert. */
const TASK_DAYS: Record<AgentTaskKind, number> = {
  findClub: 12,
  raiseSalary: 7,
  demandRole: 5,
};

export const AGENT_TASK_LABELS: Record<AgentTaskKind, string> = {
  findClub: 'Neuen Verein suchen',
  raiseSalary: 'Gehalt nachverhandeln',
  demandRole: 'Groessere Rolle einfordern',
};

/** Erzeugt den Startberater eines jungen Spielers - noch kein grosser Name. */
export function createAgent(rng: Rng): Agent {
  return {
    name: `${rng.pick(AGENT_FIRST)} ${rng.pick(AGENT_LAST)}`,
    quality: clamp(Math.round(rng.normal(38, 12)), 15, 70),
    commission: +(0.04 + rng.float(0, 0.04)).toFixed(3),
    trust: 60,
    task: null,
    requestsThisSeason: 0,
  };
}

/** Stellt sicher, dass ein Spielstand einen Berater hat (aeltere Staende). */
export function ensureAgent(state: GameState, rng: Rng): Agent {
  if (!state.agent) state.agent = createAgent(rng);
  return state.agent;
}

export interface AgentAvailability {
  canRequest: boolean;
  reason?: string;
}

/** Darf gerade ein Auftrag erteilt werden? */
export function agentAvailability(state: GameState): AgentAvailability {
  const agent = state.agent;
  if (!agent) return { canRequest: false, reason: 'Kein Berater unter Vertrag.' };
  if (agent.task) return { canRequest: false, reason: 'Dein Berater arbeitet bereits an einem Auftrag.' };
  if (state.retirement) return { canRequest: false, reason: 'Die Laufbahn ist beendet.' };
  if (agent.requestsThisSeason >= 3) {
    return { canRequest: false, reason: 'Dein Berater will es diese Saison nicht uebertreiben.' };
  }
  if (agent.trust < 20) {
    return { canRequest: false, reason: 'Das Verhaeltnis zu deinem Berater ist zerruettet.' };
  }
  return { canRequest: true };
}

/** Beauftragt den Berater. Das Ergebnis faellt erst nach einigen Tagen. */
export function startAgentTask(state: GameState, kind: AgentTaskKind): boolean {
  const agent = state.agent;
  if (!agent || !agentAvailability(state).canRequest) return false;
  agent.task = { kind, dueOn: addDays(state.date, TASK_DAYS[kind]) };
  agent.requestsThisSeason++;
  // Jeder Auftrag kostet etwas Geduld.
  agent.trust = clamp(agent.trust - 4, 0, 100);
  addNews(state, 'transfer', `${agent.name} nimmt sich der Sache an`,
    `${AGENT_TASK_LABELS[kind]}: Dein Berater meldet sich in den naechsten Tagen.`, false);
  return true;
}

/**
 * Taeglicher Fortschritt. Ist ein Auftrag faellig, wird er ausgewertet.
 * Gibt eine kurze Meldung zurueck, wenn etwas passiert ist.
 */
export function advanceAgent(state: GameState, rng: Rng): string | null {
  const agent = state.agent;
  if (!agent?.task || state.date < agent.task.dueOn) return null;
  const kind = agent.task.kind;
  agent.task = null;

  const user = state.players[state.userPlayerId];
  if (!user) return null;
  const ability = computeOverall(user.attrs, user.position);
  const age = ageOn(user.birthDate, state.date);

  // Grundlage jedes Erfolgs: Beraterqualitaet, eigene Leistung, Marktwert.
  const entries = Object.values(state.seasonStats).filter(
    (s) => s.playerId === user.id && s.season === state.season,
  );
  const apps = entries.reduce((a, s) => a + s.appearances, 0);
  const ratingSum = entries.reduce((a, s) => a + s.ratingSum, 0);
  const form = apps > 0 ? ratingSum / apps : 6.2;
  const standing = clamp(
    agent.quality / 140 + (form - 6.2) * 0.25 + (user.reputation - 40) / 160 + apps / 90,
    0.05, 0.92,
  );

  switch (kind) {
    case 'findClub': return resolveFindClub(state, agent, rng, standing, ability, age);
    case 'raiseSalary': return resolveRaise(state, agent, rng, standing, ability, age);
    default: return resolveRole(state, agent, rng, standing);
  }
}

function resolveFindClub(
  state: GameState, agent: Agent, rng: Rng, standing: number, ability: number, age: number,
): string {
  const current = state.players[state.userPlayerId]?.clubId
    ? state.clubs[state.players[state.userPlayerId].clubId!] : null;
  const currentLevel = current ? state.competitions[current.leagueId]?.level ?? 3 : 3;

  // Der Berater erreicht Vereine im passenden Umfeld - ein starker Berater auch
  // eine Klasse hoeher.
  const reachable = Object.values(state.clubs).filter((c) => {
    if (c.id === current?.id) return false;
    const level = state.competitions[c.leagueId]?.level ?? 3;
    if (level < currentLevel - (agent.quality >= 55 ? 1 : 0)) return false;
    if (level > currentLevel + 1) return false;
    return c.reputation >= ability * 0.5 && c.reputation <= ability * 1.35 + 18;
  });

  const count = reachable.length === 0 ? 0
    : rng.chance(standing) ? rng.int(1, 3) : rng.chance(standing * 0.6) ? 1 : 0;

  if (count === 0) {
    agent.trust = clamp(agent.trust - 3, 0, 100);
    addNews(state, 'transfer', `${agent.name} kommt mit leeren Haenden`,
      'Aktuell zeigt kein passender Verein Interesse. Leistung auf dem Platz ueberzeugt mehr als jedes Telefonat.',
      true);
    return 'Der Berater fand keinen Verein.';
  }

  for (const club of rng.sample(reachable, Math.min(count, reachable.length))) {
    const level = state.competitions[club.leagueId]?.level ?? 3;
    const country = COUNTRY_BY_ID[club.countryId];
    const base = calcSalary(ability, age, level, club.reputation, country?.wealth ?? 1);
    const salary = Math.round(base * (1 + standing * 0.3) * rng.float(0.95, 1.25));
    const role: SquadRole = ability >= club.reputation * 0.9 ? 'Stammspieler'
      : ability >= club.reputation * 0.62 ? 'Rotationsspieler' : 'Ergaenzungsspieler';
    state.offers.push({
      id: `o-agent-${state.nextId++}`,
      clubId: club.id,
      fee: Math.round((state.players[state.userPlayerId]?.marketValue ?? 0)
        * rng.float(0.8, 1.5) / 10000) * 10000,
      salary,
      years: age <= 24 ? rng.int(3, 5) : rng.int(2, 4),
      role,
      goalBonus: Math.round(salary * rng.float(0.15, 0.4)),
      pitch: `${club.name} meldet sich auf Vermittlung von ${agent.name} und plant dich als ${role}.`,
      expiresOn: addDays(state.date, 21),
      leagueLevel: level,
    });
  }
  agent.trust = clamp(agent.trust + 5, 0, 100);
  addNews(state, 'transfer', `${agent.name} hat etwas erreicht`,
    `${count === 1 ? 'Ein Verein' : `${count} Vereine`} zeigen Interesse. Die Angebote liegen im Bereich Transfers.`,
    true);
  return `${count} neues Angebot`;
}

function resolveRaise(
  state: GameState, agent: Agent, rng: Rng, standing: number, ability: number, age: number,
): string {
  const user = state.players[state.userPlayerId];
  const club = user?.clubId ? state.clubs[user.clubId] : null;
  if (!user?.contract || !club) return 'Kein Vertrag zum Verhandeln.';

  const level = state.competitions[club.leagueId]?.level ?? 3;
  const country = COUNTRY_BY_ID[club.countryId];
  const fair = calcSalary(ability, age, level, club.reputation, country?.wealth ?? 1);
  const underpaid = fair / Math.max(1, user.contract.salary);
  // Wer klar unter Wert bezahlt wird, hat die besseren Argumente.
  const chance = clamp(standing * 0.7 + (underpaid - 1) * 0.35, 0.05, 0.9);

  if (!rng.chance(chance)) {
    agent.trust = clamp(agent.trust - 5, 0, 100);
    state.coachRelation = clamp(state.coachRelation - 3, 0, 100);
    addNews(state, 'contract', 'Der Verein bleibt hart',
      `${club.name} sieht keinen Anlass fuer eine Anpassung. Die Nachfrage kam im Verein nicht gut an.`,
      true);
    return 'Gehaltsforderung abgelehnt.';
  }

  const raise = clamp(1.08 + standing * 0.35 + Math.max(0, underpaid - 1) * 0.4, 1.05, 1.9);
  const before = user.contract.salary;
  user.contract.salary = Math.round(before * raise / 50) * 50;
  agent.trust = clamp(agent.trust + 7, 0, 100);
  addNews(state, 'contract', 'Gehalt angehoben',
    `${agent.name} verhandelt ${before.toLocaleString('de-DE')} auf `
    + `${user.contract.salary.toLocaleString('de-DE')} Euro pro Woche hoch.`, true);
  return 'Gehalt erhoeht.';
}

function resolveRole(state: GameState, agent: Agent, rng: Rng, standing: number): string {
  const user = state.players[state.userPlayerId];
  if (!user?.contract) return 'Kein Vertrag.';
  const index = SQUAD_ROLE_ORDER.indexOf(user.contract.role);
  if (index >= SQUAD_ROLE_ORDER.length - 1) return 'Hoehere Rolle nicht moeglich.';

  // Eine groessere Rolle einzufordern ist heikel: Es kann den Trainer verstimmen.
  if (!rng.chance(clamp(standing * 0.8, 0.05, 0.85))) {
    agent.trust = clamp(agent.trust - 4, 0, 100);
    state.coachRelation = clamp(state.coachRelation - 7, 0, 100);
    addNews(state, 'coach', 'Der Trainer ist verstimmt',
      'Die Forderung nach mehr Verantwortung kam zur Unzeit. Das Verhaeltnis leidet.', true);
    return 'Forderung abgelehnt.';
  }

  user.contract.role = SQUAD_ROLE_ORDER[index + 1];
  agent.trust = clamp(agent.trust + 6, 0, 100);
  state.coachRelation = clamp(state.coachRelation + 2, 0, 100);
  addNews(state, 'coach', `Neue Rolle: ${user.contract.role}`,
    `${agent.name} setzt eine groessere Rolle im Kader durch. Jetzt musst du sie ausfuellen.`, true);
  return `Rolle: ${user.contract.role}`;
}

/** Zum Saisonwechsel: Auftragszaehler zuruecksetzen, Vertrauen normalisieren. */
export function resetAgentSeason(state: GameState) {
  const agent = state.agent;
  if (!agent) return;
  agent.requestsThisSeason = 0;
  agent.trust = clamp(agent.trust + 6, 0, 100);
}

/**
 * Ein erfolgreicher Spieler zieht bessere Berater an. Wechselangebote kommen
 * zum Saisonende, wenn Ruf und Leistung stimmen.
 */
export function maybeOfferBetterAgent(state: GameState, rng: Rng): boolean {
  const agent = state.agent;
  const user = state.players[state.userPlayerId];
  if (!agent || !user || state.retirement) return false;
  if (agent.quality >= 88) return false;
  const chance = clamp((user.reputation - 45) / 120, 0, 0.5);
  if (!rng.chance(chance)) return false;

  const better = clamp(agent.quality + rng.int(8, 22), 20, 95);
  const commission = +(agent.commission + rng.float(0.005, 0.025)).toFixed(3);
  state.agent = {
    name: `${rng.pick(AGENT_FIRST)} ${rng.pick(AGENT_LAST)}`,
    quality: better,
    commission,
    trust: 55,
    task: null,
    requestsThisSeason: 0,
  };
  addNews(state, 'transfer', `${state.agent.name} uebernimmt deine Beratung`,
    `Ein renommierterer Berater (Qualitaet ${better}) hat dich unter Vertrag genommen. `
    + `Seine Provision liegt bei ${(commission * 100).toFixed(1)} Prozent.`, true);
  return true;
}

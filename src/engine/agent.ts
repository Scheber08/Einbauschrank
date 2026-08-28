/**
 * Spielerberater (Konzept Abschnitt 35).
 *
 * Der Berater ist der Hebel des Spielers auf den Markt: Er sucht Vereine,
 * verhandelt Gehalt nach und fordert beim Trainer eine groessere Rolle ein.
 * Auftraege brauchen Zeit, kosten Vertrauen und gelingen nicht immer - wer den
 * Berater staendig losschickt, verspielt seine Wirkung.
 */
import { addDays, ageOn } from './date';
import { t, tDecimal, tNumber } from '../i18n';
import { addNews } from './ids';
import { buildWageIndex, canSign, wageBill, wageRoom } from './finance';
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
  findClub: 'ag.task.findClub',
  raiseSalary: 'ag.task.raiseSalary',
  demandRole: 'ag.task.demandRole',
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
  if (!agent) return { canRequest: false, reason: t('ag.no.none') };
  if (agent.task) return { canRequest: false, reason: t('ag.no.busy') };
  if (state.retirement) return { canRequest: false, reason: t('ag.no.retired') };
  if (agent.requestsThisSeason >= 3) {
    return { canRequest: false, reason: t('ag.no.quota') };
  }
  if (agent.trust < 20) {
    return { canRequest: false, reason: t('ag.no.trust') };
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
  addNews(state, 'transfer',
    t('ag.start.title', { name: agent.name }),
    t('ag.start.body', { task: t(AGENT_TASK_LABELS[kind]) }), false);
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
  // Auch der Berater kann nur Tueren oeffnen, hinter denen Geld liegt. Ohne
  // diese Pruefung waere er ein Schlupfloch um die Vereinsfinanzen herum:
  // Ein Verein, der im normalen Transferfenster nicht bieten darf, haette
  // ueber den Berater trotzdem ein Angebot geschickt.
  const gehaelter = buildWageIndex(state);
  const nutzer = state.players[state.userPlayerId];
  const abloese = nutzer?.marketValue ?? 0;
  // Der Wunsch des Spielers lenkt die Suche. Vorher konnte der Berater
  // einen Verein suchen, aber nicht wissen, wonach - wer in die erste Liga
  // wollte, konnte das niemandem sagen.
  const wunsch = state.transferWish;
  const reachable = Object.values(state.clubs).filter((c) => {
    if (c.id === current?.id) return false;
    const level = state.competitions[c.leagueId]?.level ?? 3;
    if (level < currentLevel - (agent.quality >= 55 ? 1 : 0)) return false;
    if (level > currentLevel + 1) return false;
    // Eine gewuenschte Stufe schliesst die anderen aus - der Berater sucht
    // dann gezielt und findet entsprechend seltener etwas.
    if (wunsch?.active && wunsch.level !== undefined && level !== wunsch.level) return false;
    if (wunsch?.active && wunsch.country && c.countryId !== wunsch.country) return false;
    if (!(c.reputation >= ability * 0.5 && c.reputation <= ability * 1.35 + 18)) return false;
    const country = COUNTRY_BY_ID[c.countryId];
    const gehalt = calcSalary(ability, age, level, c.reputation, country?.wealth ?? 1);
    return canSign(c, gehaelter.get(c.id) ?? 0, abloese, gehalt, 1.2);
  });

  const count = reachable.length === 0 ? 0
    : rng.chance(standing) ? rng.int(1, 3) : rng.chance(standing * 0.6) ? 1 : 0;

  if (count === 0) {
    agent.trust = clamp(agent.trust - 3, 0, 100);
    addNews(state, 'transfer',
      t('ag.empty.title', { name: agent.name }),
      t('ag.empty.body'), true);
    return t('ag.empty.result');
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
      fee: Math.round(Math.min((state.players[state.userPlayerId]?.marketValue ?? 0)
        * rng.float(0.8, 1.5), club.budget) / 10000) * 10000,
      salary,
      years: age <= 24 ? rng.int(3, 5) : rng.int(2, 4),
      role,
      goalBonus: Math.round(salary * rng.float(0.15, 0.4)),
      pitch: t('ag.pitch', {
        club: club.name, agent: agent.name, role: t(`role.${role}`),
      }),
      expiresOn: addDays(state.date, 21),
      leagueLevel: level,
    });
  }
  agent.trust = clamp(agent.trust + 5, 0, 100);
  const vereine = count === 1
    ? t('ag.found.oneClub')
    : t('ag.found.manyClubs', { n: count });
  addNews(state, 'transfer',
    t('ag.found.title', { name: agent.name }),
    t('ag.found.body', { clubs: vereine }), true);
  return t('ag.found.result', { n: count });
}

function resolveRaise(
  state: GameState, agent: Agent, rng: Rng, standing: number, ability: number, age: number,
): string {
  const user = state.players[state.userPlayerId];
  const club = user?.clubId ? state.clubs[user.clubId] : null;
  if (!user?.contract || !club) return t('ag.raise.noContract');

  const level = state.competitions[club.leagueId]?.level ?? 3;
  const country = COUNTRY_BY_ID[club.countryId];
  const fair = calcSalary(ability, age, level, club.reputation, country?.wealth ?? 1);
  const underpaid = fair / Math.max(1, user.contract.salary);
  // Wer klar unter Wert bezahlt wird, hat die besseren Argumente - aber auch
  // das beste Argument hilft nichts, wenn der Gehaltsrahmen ausgeschoepft ist.
  // Ohne diesen Anteil waere der Berater ein Schlupfloch um die Finanzen herum:
  // ein klammer Verein haette jede Forderung erfuellen koennen.
  const spielraum = wageRoom(club, wageBill(state, club.id));
  const forderung = Math.max(1, fair - user.contract.salary);
  const kassenlage = clamp(spielraum / forderung, 0.25, 1.25);
  const chance = clamp((standing * 0.7 + (underpaid - 1) * 0.35) * kassenlage, 0.03, 0.9);

  if (!rng.chance(chance)) {
    agent.trust = clamp(agent.trust - 5, 0, 100);
    state.coachRelation = clamp(state.coachRelation - 3, 0, 100);
    addNews(state, 'contract', t('ag.raise.refused.title'),
      t('ag.raise.refused.body', { club: club.name }), true);
    return t('ag.raise.refused.result');
  }

  const raise = clamp(1.08 + standing * 0.35 + Math.max(0, underpaid - 1) * 0.4, 1.05, 1.9);
  const before = user.contract.salary;
  // Der Verein zahlt hoechstens, was sein Rahmen hergibt - mindestens aber die
  // untere Stufe, sonst waere eine zugesagte Erhoehung am Ende keine.
  const gewuenscht = before * raise;
  const machbar = Math.max(before * 1.05, Math.min(gewuenscht, before + Math.max(0, spielraum)));
  user.contract.salary = Math.round(machbar / 50) * 50;
  agent.trust = clamp(agent.trust + 7, 0, 100);
  addNews(state, 'contract', t('ag.raise.ok.title'),
    t('ag.raise.ok.body', {
      name: agent.name,
      before: tNumber(before),
      after: tNumber(user.contract.salary),
    }), true);
  return t('ag.raise.ok.result');
}

function resolveRole(state: GameState, agent: Agent, rng: Rng, standing: number): string {
  const user = state.players[state.userPlayerId];
  if (!user?.contract) return t('ag.role.noContract');
  const index = SQUAD_ROLE_ORDER.indexOf(user.contract.role);
  if (index >= SQUAD_ROLE_ORDER.length - 1) return t('ag.role.maxed');

  // Eine groessere Rolle einzufordern ist heikel: Es kann den Trainer verstimmen.
  if (!rng.chance(clamp(standing * 0.8, 0.05, 0.85))) {
    agent.trust = clamp(agent.trust - 4, 0, 100);
    state.coachRelation = clamp(state.coachRelation - 7, 0, 100);
    addNews(state, 'coach', t('ag.role.refused.title'),
      t('ag.role.refused.body'), true);
    return t('ag.role.refused.result');
  }

  user.contract.role = SQUAD_ROLE_ORDER[index + 1];
  agent.trust = clamp(agent.trust + 6, 0, 100);
  state.coachRelation = clamp(state.coachRelation + 2, 0, 100);
  const rolle = t(`role.${user.contract.role}`);
  addNews(state, 'coach', t('ag.role.ok.title', { role: rolle }),
    t('ag.role.ok.body', { name: agent.name }), true);
  return t('ag.role.ok.result', { role: rolle });
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
  addNews(state, 'transfer',
    t('ag.better.title', { name: state.agent.name }),
    t('ag.better.body', {
      quality: better, commission: tDecimal(commission * 100, 1),
    }), true);
  return true;
}

/**
 * Nationalmannschaften und World Nations Cup (Konzept Abschnitt 12 und 13).
 *
 * Der World Nations Cup findet alle vier Jahre statt. Neben den fuenf
 * Hauptlaendern nehmen elf vereinfachte Nationen teil, die nur eine Staerke
 * besitzen. Das Turnier wird in einem Durchgang simuliert; die Beteiligung des
 * eigenen Spielers fliesst als Laenderspiele und Tore in seine Karriere ein.
 */
import { effectiveOverall, computeOverall } from './attributes';
import { COUNTRIES } from './countries';
import { ageOn } from './date';
import { addCareerEvent, addNews } from './ids';
import { Rng, clamp } from './rng';
import type { GameState, Id, Player, WncResult } from './types';

/** Erstes Turnierjahr; danach alle vier Jahre. */
const FIRST_WNC = 2028;

export function isWncYear(season: number): boolean {
  return season >= FIRST_WNC && (season - FIRST_WNC) % 4 === 0;
}

/** Vereinfachte Zusatznationen (Abschnitt 13): nur Name und Staerke. */
interface ExtraNation {
  id: string;
  name: string;
  strength: number;
}

const EXTRA_NATIONS: ExtraNation[] = [
  { id: 'x-nordia', name: 'Nordia', strength: 74 },
  { id: 'x-vessaria', name: 'Vessaria', strength: 71 },
  { id: 'x-montara', name: 'Montara', strength: 69 },
  { id: 'x-kaledon', name: 'Kaledon', strength: 67 },
  { id: 'x-adria', name: 'Adria', strength: 66 },
  { id: 'x-sarona', name: 'Sarona', strength: 64 },
  { id: 'x-thulia', name: 'Thulia', strength: 62 },
  { id: 'x-brenland', name: 'Brenland', strength: 60 },
  { id: 'x-costamar', name: 'Costamar', strength: 58 },
  { id: 'x-veldoria', name: 'Veldoria', strength: 56 },
  { id: 'x-halmyra', name: 'Halmyra', strength: 54 },
];

interface Nation {
  id: string;
  name: string;
  strength: number;
  isMain: boolean;
  /** Nur Hauptnationen: aktueller Kader. */
  squad?: Player[];
}

/** Bester Nationalkader eines Hauptlandes: die 23 staerksten passenden Spieler. */
export function nationalSquad(state: GameState, countryId: Id): Player[] {
  return Object.values(state.players)
    .filter((p) => p.nationality === countryId && !p.injury)
    .map((p) => ({ p, r: computeOverall(p.attrs, p.position) + p.form / 10 }))
    .sort((a, b) => b.r - a.r)
    .slice(0, 23)
    .map((x) => x.p);
}

function mainNationStrength(squad: Player[]): number {
  if (squad.length === 0) return 50;
  const top = squad.slice(0, 16).map((p) => computeOverall(p.attrs, p.position));
  return top.reduce((a, b) => a + b, 0) / top.length;
}

/**
 * Ist der eigene Spieler fuer seine Nation nominiert? Haengt von Staerke, Form,
 * Reputation und der Konkurrenz auf seiner Position ab (Konzept Abschnitt 12).
 */
export function evaluateNomination(state: GameState): boolean {
  const user = state.players[state.userPlayerId];
  if (!user) return false;
  const country = COUNTRIES.find((c) => c.id === user.nationality);
  if (!country) return false;

  const ability = computeOverall(user.attrs, user.position);
  // Konkurrenz auf der eigenen Position im Land.
  const rivals = Object.values(state.players)
    .filter((p) => p.nationality === user.nationality && p.id !== user.id
      && p.position === user.position && !p.injury)
    .map((p) => computeOverall(p.attrs, p.position))
    .sort((a, b) => b - a);
  const rank = rivals.filter((r) => r > ability).length + 1;

  // Guter Spieler auf einer nicht ueberlaufenen Position wird nominiert.
  const score = ability + (user.form - 50) / 4 + (user.reputation - 40) / 8 - (rank - 1) * 6;
  const threshold = 58 + country.reputation / 10;
  return score >= threshold;
}

/** Simuliert ein Spiel zweier Nationen. Rueckgabe: Tore beider. */
function simMatch(rng: Rng, a: number, b: number, neutral = true): [number, number] {
  const diff = (a - b) / 9;
  const homeAdv = neutral ? 0 : 0.2;
  const ga = rng.poisson(clamp(1.25 + diff * 0.42 + homeAdv, 0.15, 5));
  const gb = rng.poisson(clamp(1.25 - diff * 0.42, 0.15, 5));
  return [ga, gb];
}

interface TournamentTeam {
  nation: Nation;
  points: number;
  gf: number;
  ga: number;
}

/**
 * Spielt den gesamten World Nations Cup und traegt Ergebnis sowie die
 * Beteiligung des eigenen Spielers in den Spielstand ein.
 */
export function playWorldNationsCup(state: GameState, rng: Rng): WncResult {
  const user = state.players[state.userPlayerId];
  const userNation = user?.nationality;

  // 16 Teilnehmer: fuenf Hauptnationen, elf Zusatznationen.
  const mainNations: Nation[] = COUNTRIES.map((c) => {
    const squad = nationalSquad(state, c.id);
    return { id: c.id, name: c.name, strength: mainNationStrength(squad), isMain: true, squad };
  });
  const extra: Nation[] = EXTRA_NATIONS.map((n) => ({
    id: n.id, name: n.name, strength: n.strength, isMain: false,
  }));
  const nations = rng.shuffle([...mainNations, ...extra]);

  const nominated = state.nationalNominated && !!userNation;
  let userCaps = 0;
  let userGoals = 0;
  let userReached: string | undefined;

  // Traegt die Beteiligung des Spielers ein, wenn seine Nation spielt.
  const recordUser = (nation: Nation, roundLabel: string, won: boolean) => {
    if (!nominated || nation.id !== userNation || !user) return;
    userCaps++;
    userReached = roundLabel;
    // Torwahrscheinlichkeit aus Position und Abschluss.
    const attackWeight = user.position === 'ST' ? 0.7
      : user.position === 'OM' || user.position === 'LA' || user.position === 'RA' ? 0.5
      : user.position === 'ZM' ? 0.25 : 0.08;
    const chance = clamp(attackWeight * (0.4 + user.attrs.finishing / 150) * (won ? 1.2 : 0.8), 0.02, 0.8);
    if (rng.chance(chance)) userGoals++;
    if (rng.chance(chance * 0.4)) userGoals++;
  };

  // --- Gruppenphase: vier Gruppen zu vier, zwei kommen weiter. ---
  const groups: Nation[][] = [[], [], [], []];
  nations.forEach((n, i) => groups[i % 4].push(n));

  const advancers: Nation[] = [];
  for (const group of groups) {
    const teams: TournamentTeam[] = group.map((nation) => ({ nation, points: 0, gf: 0, ga: 0 }));
    for (let i = 0; i < teams.length; i++) {
      for (let j = i + 1; j < teams.length; j++) {
        const [ga, gb] = simMatch(rng, teams[i].nation.strength, teams[j].nation.strength);
        teams[i].gf += ga; teams[i].ga += gb;
        teams[j].gf += gb; teams[j].ga += ga;
        if (ga > gb) teams[i].points += 3;
        else if (gb > ga) teams[j].points += 3;
        else { teams[i].points++; teams[j].points++; }
        recordUser(teams[i].nation, 'Gruppenphase', ga > gb);
        recordUser(teams[j].nation, 'Gruppenphase', gb > ga);
      }
    }
    teams.sort((a, b) => b.points - a.points || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf);
    advancers.push(teams[0].nation, teams[1].nation);
  }

  // --- K.-o.-Phase ---
  const koRound = (teams: Nation[], label: string): Nation[] => {
    const winners: Nation[] = [];
    for (let i = 0; i < teams.length; i += 2) {
      const [a, b] = [teams[i], teams[i + 1]];
      if (!b) { winners.push(a); continue; }
      let [ga, gb] = simMatch(rng, a.strength, b.strength);
      if (ga === gb) { if (rng.chance(0.5)) ga++; else gb++; } // Verlaengerung/Elfmeter
      const aWon = ga > gb;
      winners.push(aWon ? a : b);
      recordUser(a, label, aWon);
      recordUser(b, label, !aWon);
    }
    return winners;
  };

  const quarter = koRound(advancers, 'Viertelfinale');
  const semi = koRound(quarter, 'Halbfinale');
  const finalists = semi;
  const champion = koRound(finalists, 'Finale')[0];
  const runnerUp = finalists.find((n) => n.id !== champion.id) ?? finalists[0];

  // Erreichte der Nutzer das Finale und gewann?
  if (nominated && userNation === champion.id) userReached = 'Sieg';

  const result: WncResult = {
    year: state.season,
    championName: champion.name,
    runnerUpName: runnerUp.name,
    userNationReached: nominated ? userReached : undefined,
    userNominated: nominated,
    userCaps,
    userGoals,
  };

  // In den Spielstand eintragen.
  state.wncHistory.push(result);
  state.nationalCaps += userCaps;
  state.nationalGoals += userGoals;

  addNews(state, 'national', `${champion.name} gewinnt den World Nations Cup ${state.season}`,
    `Im Finale setzte sich ${champion.name} gegen ${runnerUp.name} durch.`, true);

  if (nominated && user) {
    if (userNation === champion.id) {
      state.honours.push({ season: state.season, label: 'World Nations Cup gewonnen' });
      addCareerEvent(state, 'title', 'World Nations Cup gewonnen',
        `Mit der Nationalmannschaft von ${champion.name} den World Nations Cup geholt - `
        + `der groesste Erfolg einer Karriere.`);
    } else if (userReached) {
      addCareerEvent(state, 'national', `World Nations Cup: ${userReached}`,
        `Mit der Nationalmannschaft beim World Nations Cup ${state.season} bis zum `
        + `${userReached} gekommen (${userCaps} Spiele, ${userGoals} Tore).`);
    }
  }

  return result;
}

/**
 * Aktualisiert einmal pro Saison den Nominierungsstatus und meldet eine erste
 * Berufung. Wird zum Saisonstart aufgerufen.
 */
export function updateNationalStatus(state: GameState) {
  const user = state.players[state.userPlayerId];
  if (!user) return;
  const wasNominated = state.nationalNominated;
  const nominated = evaluateNomination(state);
  state.nationalNominated = nominated;

  if (nominated && !wasNominated) {
    const country = COUNTRIES.find((c) => c.id === user.nationality);
    addNews(state, 'national', 'Nationalmannschaft: Berufung',
      `${user.firstName} ${user.lastName} wird erstmals fuer ${country?.name ?? 'sein Land'} nominiert.`,
      true);
    addCareerEvent(state, 'national', 'Erste Nominierung',
      `Berufung in die Nationalmannschaft von ${country?.name ?? '-'} mit `
      + `${ageOn(user.birthDate, state.date)} Jahren.`);
  }
}

/** Der aktuelle Kader der Nation des Spielers, fuer die Anzeige. */
export function userNationalSquad(state: GameState): Player[] {
  const user = state.players[state.userPlayerId];
  if (!user) return [];
  return nationalSquad(state, user.nationality);
}

export { effectiveOverall };

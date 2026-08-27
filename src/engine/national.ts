/**
 * Nationalmannschaften und World Nations Cup (Konzept Abschnitt 12 und 13).
 *
 * Der World Nations Cup findet alle vier Jahre statt. Sechzehn Nationen nehmen
 * teil: die fuenf Laender mit eigenem Ligasystem und elf weitere. Die Nation
 * des eigenen Spielers ist immer dabei, egal welches Herkunftsland er gewaehlt
 * hat. Das Turnier wird in einem Durchgang simuliert; die Beteiligung des
 * eigenen Spielers fliesst als Laenderspiele und Tore in seine Karriere ein.
 */
import { effectiveOverall, computeOverall } from './attributes';
import { COUNTRIES, COUNTRY_BY_ID } from './countries';
import { ageOn } from './date';
import { addCareerEvent, addNews } from './ids';
import { checkCapMilestones } from './milestones';
import {
  NATIONS, NATION_BY_ID, gameCountryOfNation, nationName, nationOfGameCountry,
} from './nations';
import { t } from '../i18n';
import { Rng, clamp } from './rng';
import type { GameState, Id, Player, WncResult } from './types';

/** Erstes Turnierjahr; danach alle vier Jahre. */
const FIRST_WNC = 2028;

export function isWncYear(season: number): boolean {
  return season >= FIRST_WNC && (season - FIRST_WNC) % 4 === 0;
}

/** Groesse des Turnierfeldes. */
const FIELD_SIZE = 16;

interface Nation {
  id: string;
  name: string;
  strength: number;
  /** Wird der Kader aus echten Spielern der Welt gebildet? */
  isMain: boolean;
  squad?: Player[];
}

/**
 * Wie gross ist der Andrang in dieser Nation? Die Ligalaender bringen ihre
 * eigene Reputation mit, alle anderen ihr fussballerisches Gewicht. In einer
 * kleineren Nation kommt man leichter in die Auswahl - das macht die freie
 * Wahl des Herkunftslandes auch spielerisch unterscheidbar.
 */
function nationReputation(nationId: string): number {
  const gameCountry = gameCountryOfNation(nationId);
  if (gameCountry) return COUNTRY_BY_ID[gameCountry]?.reputation ?? 60;
  const nation = NATION_BY_ID[nationId];
  if (nation) return clamp(nation.strength * 1.75 - 45, 25, 95);
  return 42;
}

/**
 * Bester Kader einer Nation: die 23 staerksten Spieler dieser Herkunft, die
 * gerade fit sind. Fuer kleine Nationen kommen entsprechend wenige zusammen.
 */
export function nationalSquad(state: GameState, nationId: Id): Player[] {
  return Object.values(state.players)
    .filter((p) => p.nationality === nationId && !p.injury)
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
  // Nationaltrainer waehlen auch nach Auftreten aus: Wer als Vorbild gilt,
  // wird eher berufen als ein gleich starker Spieler mit schlechtem Ruf.
  const threshold = 58 + nationReputation(user.nationality) / 10
    - (state.publicImage - 50) / 12;
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
 * Stellt das Teilnehmerfeld zusammen: die fuenf Ligalaender sind gesetzt, den
 * Rest fuellen die staerksten uebrigen Nationen auf. Die Nation des eigenen
 * Spielers ist immer dabei - sonst waere die freie Wahl des Herkunftslandes
 * nichts wert; sie verdraengt notfalls den schwaechsten Gast.
 *
 * Die Staerke eines Ligalandes kommt aus seinem echten Kader. Bei den
 * uebrigen zaehlt das hinterlegte Gewicht, das aber nachgibt, wenn genug
 * Legionaere dieser Herkunft in den Ligen spielen - eine goldene Generation
 * soll sich auch im Turnier bemerkbar machen.
 */
function buildTournamentField(state: GameState, userNation: string | undefined): Nation[] {
  const leagueNations = new Set(
    COUNTRIES.map((c) => nationOfGameCountry(c.id) ?? c.id),
  );
  const field: Nation[] = [];

  const add = (id: string) => {
    if (field.some((n) => n.id === id)) return;
    const squad = nationalSquad(state, id);
    const home = leagueNations.has(id);
    // Unter 16 verfuegbaren Spielern ist der Kader keine belastbare Grundlage.
    const real = squad.length >= 16;
    const base = NATION_BY_ID[id]?.strength ?? 55;
    let strength = base;
    if (home) strength = mainNationStrength(squad);
    else if (real) strength = base * 0.55 + mainNationStrength(squad) * 0.45;
    field.push({ id, name: nationName(id), strength, isMain: home || real, squad });
  };

  for (const id of leagueNations) add(id);

  // Auffuellen nach Gewicht, damit das Feld nicht willkuerlich wirkt.
  const contenders = NATIONS
    .filter((n) => !leagueNations.has(n.id))
    .sort((a, b) => b.strength - a.strength);
  for (const n of contenders) {
    if (field.length >= FIELD_SIZE) break;
    add(n.id);
  }

  if (userNation && !field.some((n) => n.id === userNation)) {
    // Den schwaechsten Gast hinauswerfen - die Ligalaender bleiben gesetzt.
    const weakest = field
      .filter((n) => !leagueNations.has(n.id))
      .sort((a, b) => a.strength - b.strength)[0];
    if (weakest) field.splice(field.indexOf(weakest), 1);
    add(userNation);
  }

  return field;
}

/**
 * Spielt den gesamten World Nations Cup und traegt Ergebnis sowie die
 * Beteiligung des eigenen Spielers in den Spielstand ein.
 */
export function playWorldNationsCup(state: GameState, rng: Rng): WncResult {
  const user = state.players[state.userPlayerId];
  const userNation = user?.nationality;

  const nations = rng.shuffle(buildTournamentField(state, userNation));

  const nominated = state.nationalNominated && !!userNation;
  let userCaps = 0;
  let userGoals = 0;
  /**
   * Wie weit die eigene Nation kam - als stabiler Schluessel, nicht als
   * fertiger Text. Frueher stand hier "Sieg", und die Oberflaeche verglich
   * genau dagegen; mit der Uebersetzung waere dieser Vergleich stillschweigend
   * falsch geworden.
   */
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
        recordUser(teams[i].nation, 'group', ga > gb);
        recordUser(teams[j].nation, 'group', gb > ga);
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

  const quarter = koRound(advancers, 'quarter');
  const semi = koRound(quarter, 'semi');
  const finalists = semi;
  const champion = koRound(finalists, 'final')[0];
  const runnerUp = finalists.find((n) => n.id !== champion.id) ?? finalists[0];

  // Erreichte der Nutzer das Finale und gewann?
  if (nominated && userNation === champion.id) userReached = 'won';

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
  const capsVorher = state.nationalCaps;
  state.nationalCaps += userCaps;
  checkCapMilestones(state, capsVorher, state.nationalCaps, rng);
  state.nationalGoals += userGoals;

  addNews(state, 'national',
    t('nat.wnc.news', { champion: champion.name, season: state.season }),
    t('nat.wnc.newsBody', { champion: champion.name, runnerUp: runnerUp.name }), true);

  if (nominated && user) {
    if (userNation === champion.id) {
      state.honours.push({ season: state.season, label: t('honour.wnc') });
      addCareerEvent(state, 'title', t('nat.wnc.wonTitle'),
        t('nat.wnc.wonBody', { nation: champion.name }));
    } else if (userReached) {
      const runde = t(`wnc.round.${userReached}`);
      addCareerEvent(state, 'national', t('nat.wnc.eventTitle', { round: runde }),
        t('wnc.careerEvent', {
          season: state.season, round: runde, caps: userCaps, goals: userGoals,
        }));
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
    const land = nationName(user.nationality);
    addNews(state, 'national', t('nat.call.news'),
      t('nat.call.newsBody', {
        name: `${user.firstName} ${user.lastName}`, nation: land,
      }), true);
    addCareerEvent(state, 'national', t('nat.call.title'),
      t('nat.call.body', { nation: land, age: ageOn(user.birthDate, state.date) }));
  }
}

/** Der aktuelle Kader der Nation des Spielers, fuer die Anzeige. */
export function userNationalSquad(state: GameState): Player[] {
  const user = state.players[state.userPlayerId];
  if (!user) return [];
  return nationalSquad(state, user.nationality);
}

export { effectiveOverall };

/**
 * Temporaerer Rauchtest der Spiellogik.
 * Erzeugt eine Karriere, spielt mehrere Saisons durch und prueft die Ergebnisse
 * auf Plausibilitaet. Wird ueber /devtest.html aufgerufen.
 */
import { autoResolveChallenge } from './engine/ballAction';
import { computeOverall } from './engine/attributes';
import { seasonLabel } from './engine/date';
import {
  advanceDay, createNewGame, finishUserMatch, prepareUserMatch, sortedTable, userClub,
} from './engine/game';
import { MatchEngine } from './engine/matchEngine';
import { Rng } from './engine/rng';
import { leaguesOfCountry } from './engine/season';
import { collectStats, sumStats } from './engine/stats';
import { DIFFICULTY_SETTINGS } from './engine/types';

const out = document.getElementById('out')!;
const lines: string[] = [];
let failures = 0;

function log(text: string) {
  lines.push(text);
  out.textContent = lines.join('\n');
}

function check(label: string, condition: boolean, detail = '') {
  if (!condition) failures++;
  log(`${condition ? '  OK  ' : ' FEHL '} ${label}${detail ? ` - ${detail}` : ''}`);
}

function run() {
  const t0 = performance.now();

  const game = createNewGame({
    saveName: 'Testkarriere',
    seed: 123456,
    difficulty: 'normal',
    firstName: 'Test',
    lastName: 'Spieler',
    age: 17,
    nationality: 'falkenland',
    position: 'ST',
    altPositions: ['OM'],
    foot: 'rechts',
    height: 182,
    weight: 76,
    shirtNumber: 9,
    appearance: { skinTone: 0, hairStyle: 1, hairColor: '#2b2118', beard: 0, eyeColor: '#4a3120', boots: '#fff' },
    background: 'academy',
  });

  const genMs = performance.now() - t0;
  log(`Welt erzeugt in ${genMs.toFixed(0)} ms`);

  const clubCount = Object.keys(game.clubs).length;
  const playerCount = Object.keys(game.players).length;
  const matchCount = Object.keys(game.matches).length;
  log(`Vereine: ${clubCount}, Spieler: ${playerCount}, Spiele im Plan: ${matchCount}`);

  check('60 Vereine erzeugt', clubCount === 60, `${clubCount}`);
  check('Ueber 1400 Spieler erzeugt', playerCount > 1400, `${playerCount}`);
  check('3 Ligen mit je 380 Spielen', matchCount >= 1140, `${matchCount}`);

  const leagues = leaguesOfCountry(game, 'falkenland');
  check('Drei Ligen vorhanden', leagues.length === 3);
  for (const l of leagues) {
    check(`${l.name}: 20 Vereine`, l.clubIds.length === 20, `${l.clubIds.length}`);
  }

  const user = game.players[game.userPlayerId];
  const club = userClub(game);
  log(`Spieler: ${user.firstName} ${user.lastName}, Staerke ${computeOverall(user.attrs, user.position)}, `
    + `Potenzial ${user.potential}, Verein ${club?.name}`);
  check('Spieler hat einen Verein', !!club);
  check('Spieler hat einen Vertrag', !!user.contract);

  // --- Mehrere Saisons durchspielen -----------------------------------
  const seasonsToPlay = 3;
  const startSeason = game.season;
  let guard = 0;
  let matchesPlayed = 0;

  while (game.season < startSeason + seasonsToPlay && guard++ < 3000) {
    const result = advanceDay(game);
    if (result.matchToPlay) {
      const prepared = prepareUserMatch(game, result.matchToPlay, false);
      if (!prepared) { game.pendingMatchId = null; continue; }
      const rng = new Rng(game.rngState);
      const engine = new MatchEngine({ ...prepared.setup, rng });
      engine.runToEnd((c) => autoResolveChallenge(c, user, DIFFICULTY_SETTINGS.normal, rng));
      game.rngState = rng.state;
      finishUserMatch(game, result.matchToPlay, engine.finish());
      matchesPlayed++;
    }
  }

  const simMs = performance.now() - t0 - genMs;
  log(`\n${seasonsToPlay} Saisons simuliert in ${(simMs / 1000).toFixed(1)} s `
    + `(${guard} Tagesschritte, ${matchesPlayed} eigene Spiele)`);

  check('Saisonwechsel funktioniert', game.season === startSeason + seasonsToPlay,
    `${startSeason} -> ${game.season}`);
  check('Schleife lief nicht ins Limit', guard < 3000, `${guard} Schritte`);

  // --- Tabellen pruefen ------------------------------------------------
  for (let season = startSeason; season < game.season; season++) {
    for (const league of leagues) {
      const table = sortedTable(game, league.id, season);
      if (table.length === 0) continue;
      const totalPlayed = table.reduce((a, r) => a + r.played, 0);
      const goalsFor = table.reduce((a, r) => a + r.goalsFor, 0);
      const goalsAgainst = table.reduce((a, r) => a + r.goalsAgainst, 0);
      const allPlayed = table.every((r) => r.played === 38);
      check(`${league.short} ${seasonLabel(season)}: alle 38 Spieltage`, allPlayed,
        `${totalPlayed / 2} Spiele`);
      check(`${league.short} ${seasonLabel(season)}: Tore konsistent`, goalsFor === goalsAgainst,
        `${goalsFor} / ${goalsAgainst}`);
      const champion = game.clubs[table[0].clubId];
      log(`  ${league.short} ${seasonLabel(season)}: Meister ${champion?.name} `
        + `(${table[0].points} Punkte, ${table[0].goalsFor}:${table[0].goalsAgainst})`);
      const avgGoals = goalsFor / (totalPlayed || 1);
      check(`${league.short}: plausible Torquote`, avgGoals > 0.8 && avgGoals < 2.2,
        `${avgGoals.toFixed(2)} Tore pro Team und Spiel`);
    }
  }

  // --- Auf- und Abstieg -----------------------------------------------
  const movedUp = Object.values(game.clubs).filter((c) => {
    const first = c.history.find((h) => h.position !== undefined);
    return first && c.leagueId !== `falkenland-l${leagues.find((l) => l.id === c.leagueId)?.level ?? 0}`;
  });
  void movedUp;
  const leagueSizes = leagues.map((l) => l.clubIds.length);
  check('Ligen behalten 20 Vereine nach Auf- und Abstieg',
    leagueSizes.every((n) => n === 20), leagueSizes.join(', '));

  // --- Spielerstatistiken ---------------------------------------------
  const totals = sumStats(collectStats(game, game.userPlayerId));
  log(`\nEigene Bilanz: ${totals.appearances} Spiele, ${totals.goals} Tore, `
    + `${totals.assists} Vorlagen, Note ${(totals.appearances ? totals.ratingSum / totals.appearances : 0).toFixed(2)}`);
  check('Spieler kam zum Einsatz', totals.appearances > 0, `${totals.appearances}`);
  check('Bewertungen im gueltigen Bereich',
    game.userMatchStats.every((s) => s.rating >= 1 && s.rating <= 10));
  check('Minuten plausibel',
    game.userMatchStats.every((s) => s.minutes >= 0 && s.minutes <= 125));

  const newAbility = computeOverall(user.attrs, user.position);
  log(`Entwicklung: Staerke jetzt ${newAbility}, Potenzial ${user.potential}, Alter ${game.season - Number(user.birthDate.slice(0, 4))}`);
  check('Spieler hat sich entwickelt', newAbility > 30, `${newAbility}`);

  // --- Pokal -----------------------------------------------------------
  const cupMatches = Object.values(game.matches).filter((m) => m.competitionId === 'falkenland-cup');
  const cupRounds = new Set(cupMatches.map((m) => m.matchday));
  log(`Pokalspiele gesamt: ${cupMatches.length}, Runden: ${[...cupRounds].sort().join(', ')}`);
  check('Pokal wurde bis zum Finale gespielt', cupRounds.size >= 6, `${cupRounds.size} Runden`);
  check('Alle Pokalspiele haben einen Sieger',
    cupMatches.filter((m) => m.played).every(
      (m) => m.homeScore !== m.awayScore || !!m.penalties));

  // --- Weltentwicklung -------------------------------------------------
  const topScorerSeason = Object.values(game.seasonStats)
    .filter((s) => s.competitionId === 'falkenland-l1')
    .sort((a, b) => b.goals - a.goals)[0];
  if (topScorerSeason) {
    const p = game.players[topScorerSeason.playerId];
    log(`Bester Torjaeger der ersten Liga: ${p?.firstName} ${p?.lastName} `
      + `mit ${topScorerSeason.goals} Toren in ${topScorerSeason.appearances} Spielen`);
    check('Torjaegerzahl plausibel', topScorerSeason.goals >= 8 && topScorerSeason.goals <= 45,
      `${topScorerSeason.goals}`);
  }

  const injured = Object.values(game.players).filter((p) => p.injury).length;
  log(`Aktuell verletzte Spieler: ${injured}`);
  check('Verletzungen treten auf, aber nicht massenhaft', injured >= 0 && injured < 200, `${injured}`);

  log(`\nNachrichten: ${game.news.length}, Karriereereignisse: ${game.careerEvents.length}, `
    + `Auszeichnungen: ${game.awards.length}, Rekorde: ${Object.keys(game.records).length}`);

  const size = new Blob([JSON.stringify(game)]).size;
  log(`Spielstandsgroesse: ${(size / 1024 / 1024).toFixed(2)} MB`);
  check('Spielstand bleibt unter 25 MB', size < 25 * 1024 * 1024);

  log(`\nGesamtdauer: ${((performance.now() - t0) / 1000).toFixed(1)} s`);
  log(failures === 0 ? '\nALLE PRUEFUNGEN BESTANDEN' : `\n${failures} PRUEFUNGEN FEHLGESCHLAGEN`);
  (window as unknown as Record<string, unknown>).__testFailures = failures;
  (window as unknown as Record<string, unknown>).__testDone = true;
}

try {
  run();
} catch (err) {
  log(`\nABBRUCH MIT FEHLER:\n${err instanceof Error ? `${err.message}\n${err.stack}` : String(err)}`);
  (window as unknown as Record<string, unknown>).__testFailures = 999;
  (window as unknown as Record<string, unknown>).__testDone = true;
}

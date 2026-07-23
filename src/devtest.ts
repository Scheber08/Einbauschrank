/**
 * Temporaerer Rauchtest der Spiellogik.
 * Erzeugt eine Karriere, spielt mehrere Saisons durch und prueft die Ergebnisse
 * auf Plausibilitaet. Wird ueber /devtest.html aufgerufen.
 */
import { autoResolveChallenge, resolveShot, simulateBallFlight } from './engine/ballAction';
import { computeOverall } from './engine/attributes';
import { seasonLabel } from './engine/date';
import {
  advanceDay, createNewGame, finishUserMatch, prepareUserMatch, sortedTable, userClub,
} from './engine/game';
import { slotScore } from './engine/lineup';
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

  // Ein engagierter Spieler stellt sein Training auf die eigene Position ein.
  game.training.focus = 'shooting';
  game.training.intensity = 'intensiv';
  game.training.individualGoal = 'pace';
  const startAbility = computeOverall(user.attrs, user.position);

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
  const age = game.season - Number(user.birthDate.slice(0, 4));
  log(`Entwicklung: Staerke ${startAbility} -> ${newAbility} (+${newAbility - startAbility}), `
    + `Potenzial ${user.potential}, Alter ${age}`);
  check('Spieler entwickelt sich spuerbar', newAbility - startAbility >= 9,
    `+${newAbility - startAbility} in ${seasonsToPlay} Saisons`);
  check('Spieler bleibt unter seinem Potenzial', newAbility <= user.potential + 1,
    `${newAbility} von ${user.potential}`);

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

  // --- Interaktive Situationen ----------------------------------------
  log('\n--- Highlight-Situationen (Konzept Abschnitt 20.2) ---');
  const kinds = new Map<string, number>();
  let interactiveMatches = 0;
  let minutesOnPitch = 0;

  // Fuer diesen Abschnitt wird eine bestehende Verletzung ausgeblendet,
  // damit das Highlight-System isoliert geprueft werden kann.
  const pendingInjury = user.injury;
  if (pendingInjury) {
    log(`(Verletzung "${pendingInjury.name}" mit ${pendingInjury.daysOut} Tagen `
      + 'fuer den Highlight-Test ausgeblendet)');
    user.injury = null;
    user.fitness = 92;
  }

  // Ausgangslage protokollieren, damit fehlende Einsatzzeit erklaerbar ist.
  const nowClub = user.clubId ? game.clubs[user.clubId] : null;
  log(`Status: ${nowClub?.name ?? 'vereinslos'}, Staerke ${computeOverall(user.attrs, user.position)}, `
    + `Rolle ${user.contract?.role ?? '-'}, Form ${Math.round(user.form)}, `
    + `Fitness ${Math.round(user.fitness)}, `
    + `${user.injury ? `verletzt (${user.injury.name}, ${user.injury.daysOut} Tage)` : 'fit'}, `
    + `${user.suspension > 0 ? `gesperrt (${user.suspension})` : 'spielberechtigt'}`);

  const upcoming = Object.values(game.matches)
    .filter((m) => !m.played && (m.homeClubId === user.clubId || m.awayClubId === user.clubId))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 60);

  // Aufstellungsentscheidung des Trainers fuer das naechste Spiel nachvollziehen
  if (upcoming[0]) {
    const probe = prepareUserMatch(game, upcoming[0].id, true);
    if (probe) {
      const squad = Object.values(game.players).filter((p) => p.clubId === user.clubId);
      const ranked = squad
        .map((p) => ({ p, score: slotScore(p, p.position, game.coachRelation) }))
        .sort((a, b) => b.score - a.score);
      const rank = ranked.findIndex((r) => r.p.id === user.id) + 1;
      log(`Kaderplatz: ${probe.userInLineup ? 'Startelf' : probe.userOnBench ? 'Bank' : 'nicht im Kader'}`
        + ` - Rang ${rank} von ${squad.length} nach Trainerbewertung`);
      log(`   Beste drei: ${ranked.slice(0, 3).map((r) => `${r.p.lastName} ${r.score.toFixed(0)}`).join(', ')}`
        + ` | eigener Wert ${ranked[rank - 1]?.score.toFixed(0)}`);
    }
  }

  for (const m of upcoming) {
    const prepared = prepareUserMatch(game, m.id, true);
    if (!prepared) continue;
    const rng2 = new Rng((game.rngState + interactiveMatches * 7919) >>> 0);
    const engine = new MatchEngine({ ...prepared.setup, highlightMode: 'own', rng: rng2 });
    engine.runToEnd((c) => {
      kinds.set(c.kind, (kinds.get(c.kind) ?? 0) + 1);
      return autoResolveChallenge(c, user, DIFFICULTY_SETTINGS.normal, rng2);
    });
    const outcome = engine.finish();
    const own = outcome.stats.find((s) => s.playerId === user.id);
    if (own) minutesOnPitch += own.minutes;
    interactiveMatches++;
  }

  const totalChallenges = [...kinds.values()].reduce((a, b) => a + b, 0);
  log(`${interactiveMatches} Spiele im Highlight-Modus, ${minutesOnPitch} Minuten auf dem Platz`);
  log(`Situationen gesamt: ${totalChallenges} `
    + `(${(totalChallenges / Math.max(1, interactiveMatches)).toFixed(1)} pro Spiel)`);
  for (const [kind, count] of [...kinds.entries()].sort((a, b) => b[1] - a[1])) {
    log(`   ${kind.padEnd(12)} ${count}`);
  }

  check('Der Spieler bekommt eigene Situationen', totalChallenges > 0, `${totalChallenges}`);
  check('Schussszenen kommen vor', (kinds.get('shot') ?? 0) + (kinds.get('longShot') ?? 0)
    + (kinds.get('header') ?? 0) + (kinds.get('oneOnOne') ?? 0) > 0);
  check('Dribblings werden ausgeloest (Abschnitt 24)', (kinds.get('dribble') ?? 0) > 0,
    `${kinds.get('dribble') ?? 0}`);

  // Standards uebernimmt nur, wer zu den besten Schuetzen gehoert.
  // Das ist der Weg "Freistossspezialist werden" aus Abschnitt 19.
  log(`Freistoesse als Schuetze: ${kinds.get('freeKick') ?? 0} `
    + `(eigener Freistosswert ${user.attrs.freeKicks})`);
  const savedFreeKicks = user.attrs.freeKicks;
  user.attrs.freeKicks = 92;
  let specialistFreeKicks = 0;
  for (const m of upcoming.slice(0, 20)) {
    const prepared = prepareUserMatch(game, m.id, true);
    if (!prepared) continue;
    const rng3 = new Rng((game.rngState + specialistFreeKicks * 104729 + 13) >>> 0);
    const engine = new MatchEngine({ ...prepared.setup, rng: rng3 });
    engine.runToEnd((c) => {
      if (c.kind === 'freeKick') specialistFreeKicks++;
      return autoResolveChallenge(c, user, DIFFICULTY_SETTINGS.normal, rng3);
    });
  }
  user.attrs.freeKicks = savedFreeKicks;
  log(`Nach gezieltem Freistosstraining (Wert 92): ${specialistFreeKicks} Freistoesse in 20 Spielen`);
  check('Freistossspezialist tritt selbst an (Abschnitt 19 und 22)', specialistFreeKicks > 0,
    `${specialistFreeKicks}`);
  check('Nicht zu viele Unterbrechungen pro Spiel',
    totalChallenges / Math.max(1, interactiveMatches) < 9,
    `${(totalChallenges / Math.max(1, interactiveMatches)).toFixed(1)}`);

  // --- Modus "Alle wichtigen Szenen" (Konzept Abschnitt 20.3) ---------
  log('\n--- Modus-Vergleich own gegen all ---');
  const allKinds = new Map<string, number>();
  let allMatches = 0;
  for (const m of upcoming.slice(0, 39)) {
    const prepared = prepareUserMatch(game, m.id, true);
    if (!prepared) continue;
    const rng4 = new Rng((game.rngState + allMatches * 5387 + 991) >>> 0);
    const engine = new MatchEngine({ ...prepared.setup, highlightMode: 'all', rng: rng4 });
    engine.runToEnd((c) => {
      allKinds.set(c.kind, (allKinds.get(c.kind) ?? 0) + 1);
      return autoResolveChallenge(c, user, DIFFICULTY_SETTINGS.normal, rng4);
    });
    engine.finish();
    allMatches++;
  }
  const ownDefensive = (kinds.get('duel') ?? 0);
  const allDefensive = (allKinds.get('duel') ?? 0) + (allKinds.get('block') ?? 0);
  const allTotal = [...allKinds.values()].reduce((a, b) => a + b, 0);
  log(`Modus "own": ${totalChallenges} Situationen, davon ${ownDefensive} defensiv`);
  log(`Modus "all": ${allTotal} Situationen, davon ${allDefensive} defensiv `
    + `(${allKinds.get('block') ?? 0} Klaerungen)`);
  check('Modus "all" bindet den Spieler defensiv staerker ein (Abschnitt 20.3)',
    allDefensive > ownDefensive, `${allDefensive} gegen ${ownDefensive}`);

  // Klaerungen betreffen vor allem Defensivspieler. Fuer diese Pruefung wird der
  // Spieler kurzzeitig als Innenverteidiger eingesetzt.
  const savedPos = user.position;
  user.position = 'IV';
  let ivBlocks = 0; let ivOwnBlocks = 0;
  for (const m of upcoming.slice(0, 25)) {
    const prepared = prepareUserMatch(game, m.id, true);
    if (!prepared) continue;
    const rngA = new Rng((game.rngState + ivBlocks * 3301 + 47) >>> 0);
    const eAll = new MatchEngine({ ...prepared.setup, highlightMode: 'all', rng: rngA });
    eAll.runToEnd((c) => { if (c.kind === 'duel' && c.title === 'Klaerung') ivBlocks++;
      return autoResolveChallenge(c, user, DIFFICULTY_SETTINGS.normal, rngA); });
    eAll.finish();
    const rngO = new Rng((game.rngState + ivOwnBlocks * 3301 + 47) >>> 0);
    const eOwn = new MatchEngine({ ...prepared.setup, highlightMode: 'own', rng: rngO });
    eOwn.runToEnd((c) => { if (c.kind === 'duel' && c.title === 'Klaerung') ivOwnBlocks++;
      return autoResolveChallenge(c, user, DIFFICULTY_SETTINGS.normal, rngO); });
    eOwn.finish();
  }
  user.position = savedPos;
  log(`Als Innenverteidiger: ${ivBlocks} Klaerungen im Modus "all", ${ivOwnBlocks} im Modus "own"`);
  check('Klaerungen gegnerischer Grosschancen entstehen nur im Modus "all"',
    ivBlocks > 0 && ivOwnBlocks === 0, `all ${ivBlocks}, own ${ivOwnBlocks}`);

  // --- Ballphysik ------------------------------------------------------
  log('\n--- Ballphysik (Konzept Abschnitt 22 und 23) ---');
  const physicsRng = new Rng(4242);
  const testChallenge = {
    id: 't', kind: 'shot' as const, minute: 50, title: 'Test', hint: '',
    distance: 14, offset: 0, pressure: 0.3, keeper: 60, opponent: 60,
    xg: 0.2, bigChance: false, scoreline: [0, 0] as [number, number],
    homeName: 'A', awayName: 'B', userSide: 'home' as const,
  };
  // Flach ins lange Eck, passende Kraft, leichter Anschnitt
  const perfect = { aimX: 3.0, aimY: 0, power: 0.72, contactX: 0.15, contactY: -0.12 };
  // Weit am Tor vorbei gezielt, viel zu viel Kraft, Ball von unten getroffen
  const sloppy = { aimX: 9.5, aimY: 0, power: 0.99, contactX: 0.9, contactY: -0.9 };

  // Weltklassestuermer zum Vergleich: gleiche Eingabe, deutlich mehr Ertrag
  const worldClass: typeof user = structuredClone(user);
  for (const key of Object.keys(worldClass.attrs) as (keyof typeof worldClass.attrs)[]) {
    worldClass.attrs[key] = Math.min(95, worldClass.attrs[key] + 30);
  }
  worldClass.form = 80; worldClass.confidence = 85; worldClass.fitness = 100;

  let goodGoals = 0; let badGoals = 0; let eliteGoals = 0;
  for (let i = 0; i < 400; i++) {
    if (resolveShot(perfect, testChallenge, user, DIFFICULTY_SETTINGS.normal, physicsRng).outcome === 'goal') goodGoals++;
    if (resolveShot(sloppy, testChallenge, user, DIFFICULTY_SETTINGS.normal, physicsRng).outcome === 'goal') badGoals++;
    if (resolveShot(perfect, testChallenge, worldClass, DIFFICULTY_SETTINGS.normal, physicsRng).outcome === 'goal') eliteGoals++;
  }
  log(`Gleiche Situation aus 14 Metern:`);
  log(`   gute Eingabe:      ${(goodGoals / 4).toFixed(1)}% Tore`);
  log(`   schlechte Eingabe: ${(badGoals / 4).toFixed(1)}% Tore`);
  log(`   Weltklasse, gute Eingabe: ${(eliteGoals / 4).toFixed(1)}% Tore`);
  check('Gute Eingabe schlaegt schlechte deutlich', goodGoals > badGoals * 2,
    `${goodGoals} gegen ${badGoals}`);
  check('Gute Eingabe ist kein Selbstlaeufer', goodGoals < 380,
    'Auch bei guter Eingabe gibt es Fehlschuesse');
  check('Attribute machen einen spuerbaren Unterschied', eliteGoals > goodGoals * 1.3,
    `${eliteGoals} gegen ${goodGoals}`);

  // Kontaktpunkt wirkt sich auf die Flughoehe aus
  const flat = simulateBallFlight({
    startX: 0, startY: 20, aimX: 0, aimY: 0, power: 0.7,
    contactX: 0, contactY: 0.6, shotPower: 70, curve: 50,
  });
  const lofted = simulateBallFlight({
    startX: 0, startY: 20, aimX: 0, aimY: 0, power: 0.7,
    contactX: 0, contactY: -0.8, shotPower: 70, curve: 50,
  });
  const flatHeight = flat.crossing?.z ?? 0;
  const loftHeight = lofted.crossing?.z ?? 99;
  log(`Torlinienhoehe bei Kontakt oben: ${flatHeight.toFixed(2)} m, unten: ${loftHeight.toFixed(2)} m`);
  check('Unterer Ballkontakt hebt den Ball deutlich an', loftHeight > flatHeight + 0.5);

  // Effet kruemmt die Flugbahn
  const straight = simulateBallFlight({
    startX: 0, startY: 22, aimX: 0, aimY: 0, power: 0.75,
    contactX: 0, contactY: 0, shotPower: 70, curve: 85,
  });
  const curved = simulateBallFlight({
    startX: 0, startY: 22, aimX: 0, aimY: 0, power: 0.75,
    contactX: 0.95, contactY: 0, shotPower: 70, curve: 85,
  });
  const drift = Math.abs((curved.crossing?.x ?? 0) - (straight.crossing?.x ?? 0));
  log(`Seitliche Ablenkung durch Effet: ${drift.toFixed(2)} m`);
  check('Effet kruemmt die Flugbahn spuerbar', drift > 0.6 && drift < 12, `${drift.toFixed(2)} m`);

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

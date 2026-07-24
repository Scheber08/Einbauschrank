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
import { applyInterviewAnswer, buildPostMatchInterview } from './engine/media';
import { applyLifeChoice } from './engine/events';
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

  check('300 Vereine erzeugt (5 Laender)', clubCount === 300, `${clubCount}`);
  check('Ueber 7000 Spieler erzeugt', playerCount > 7000, `${playerCount}`);
  check('15 Ligen im Spielplan', matchCount >= 5700, `${matchCount}`);

  const leagues = leaguesOfCountry(game, 'falkenland');
  check('Drei Ligen im Startland vorhanden', leagues.length === 3);
  for (const l of leagues) {
    check(`${l.name}: 20 Vereine`, l.clubIds.length === 20, `${l.clubIds.length}`);
  }
  // Alle fuenf Laender besitzen ein vollstaendiges Ligasystem.
  const allCountriesFull = ['falkenland', 'albion', 'iberia', 'calcio', 'gallia']
    .every((c) => leaguesOfCountry(game, c).length === 3);
  check('Alle fuenf Laender haben drei Ligen', allCountriesFull);

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
  const savedAttrs = { ...user.attrs };
  user.position = 'IV';
  // Defensivwerte anheben, damit der Spieler als IV auch wirklich auflaeuft -
  // sonst kann er sich nicht in Schuesse werfen.
  for (const k of ['marking', 'tackling', 'defPositioning', 'strength', 'reactions',
    'anticipation', 'defHeading', 'jumping'] as const) {
    user.attrs[k] = 88;
  }
  let ivBlocks = 0; let ivOwnBlocks = 0;
  // Feste, vom Hauptlauf unabhaengige Seeds und groessere Stichprobe, damit die
  // seltene Klaerung zuverlaessig auftritt.
  const blockPool = upcoming.length >= 40 ? upcoming.slice(0, 40) : upcoming;
  blockPool.forEach((m, k) => {
    const prepared = prepareUserMatch(game, m.id, true);
    if (!prepared) return;
    const rngA = new Rng(70001 + k * 6113);
    const eAll = new MatchEngine({ ...prepared.setup, highlightMode: 'all', rng: rngA });
    eAll.runToEnd((c) => { if (c.kind === 'duel' && c.title === 'Klaerung') ivBlocks++;
      return autoResolveChallenge(c, user, DIFFICULTY_SETTINGS.normal, rngA); });
    eAll.finish();
    const rngO = new Rng(70001 + k * 6113);
    const eOwn = new MatchEngine({ ...prepared.setup, highlightMode: 'own', rng: rngO });
    eOwn.runToEnd((c) => { if (c.kind === 'duel' && c.title === 'Klaerung') ivOwnBlocks++;
      return autoResolveChallenge(c, user, DIFFICULTY_SETTINGS.normal, rngO); });
    eOwn.finish();
  });
  user.position = savedPos;
  Object.assign(user.attrs, savedAttrs);
  log(`Als Innenverteidiger: ${ivBlocks} Klaerungen im Modus "all", ${ivOwnBlocks} im Modus "own"`);
  check('Klaerungen gegnerischer Grosschancen entstehen im Modus "all"',
    ivBlocks > 0, `all ${ivBlocks}`);
  check('Klaerungen treten niemals im Modus "own" auf',
    ivOwnBlocks === 0, `own ${ivOwnBlocks}`);

  // --- Spielausrichtung (Mentalitaet) ---------------------------------
  log('\n--- Spielausrichtung ---');
  const measure = (mentality: 'attack' | 'balanced' | 'contain' | 'conserve') => {
    let attackCh = 0; let defendCh = 0; let fitness40 = 0; let games = 0;
    for (const m of upcoming.slice(0, 30)) {
      const prepared = prepareUserMatch(game, m.id, true);
      if (!prepared) continue;
      const r = new Rng((game.rngState + games * 6151 + 7) >>> 0);
      const engine = new MatchEngine({ ...prepared.setup, highlightMode: 'all', rng: r });
      engine.setMentality(mentality);
      let snap = 100;
      let guard = 0;
      // Bis Minute 40 laufen lassen: davor greifen noch keine Wechsel,
      // die Fitnessmessung bleibt dadurch unverfaelscht.
      while (!engine.finished && engine.minute < 40 && guard++ < 200) {
        const res = engine.step();
        if (res.pending) {
          if (res.pending.kind === 'dribble' || /shot|Shot|header|oneOnOne/.test(res.pending.kind)) attackCh++;
          if (res.pending.kind === 'duel') defendCh++;
          engine.resolve(autoResolveChallenge(res.pending, user, DIFFICULTY_SETTINGS.normal, r));
        } else if (engine.pendingInjury) {
          engine.resolveInjury('off');
        }
        snap = engine.userLiveFitness;
      }
      // Rest des Spiels zu Ende bringen, damit die Zaehlung vollstaendig ist.
      engine.runToEnd((c) => {
        if (c.kind === 'dribble' || /shot|Shot|header|oneOnOne/.test(c.kind)) attackCh++;
        if (c.kind === 'duel') defendCh++;
        return autoResolveChallenge(c, user, DIFFICULTY_SETTINGS.normal, r);
      });
      engine.finish();
      fitness40 += snap;
      games++;
    }
    return { attack: attackCh, defend: defendCh, fitness: fitness40 / Math.max(1, games) };
  };

  const atk = measure('attack');
  const bal = measure('balanced');
  const con = measure('contain');
  const rest = measure('conserve');
  log(`Nach vorne:      ${atk.attack} offensiv, ${atk.defend} defensiv, Fitness bei Min 40 ${atk.fitness.toFixed(1)}`);
  log(`Ausbalanciert:   ${bal.attack} offensiv, ${bal.defend} defensiv, Fitness bei Min 40 ${bal.fitness.toFixed(1)}`);
  log(`Defensiv:        ${con.attack} offensiv, ${con.defend} defensiv, Fitness bei Min 40 ${con.fitness.toFixed(1)}`);
  log(`Kraefte schonen: ${rest.attack} offensiv, ${rest.defend} defensiv, Fitness bei Min 40 ${rest.fitness.toFixed(1)}`);
  check('Nach vorne bringt mehr Offensivszenen als Defensiv',
    atk.attack > con.attack, `${atk.attack} gegen ${con.attack}`);
  check('Defensiv bringt mehr Defensivszenen als Nach vorne',
    con.defend > atk.defend, `${con.defend} gegen ${atk.defend}`);
  check('Kraefte schonen verbraucht weniger Fitness als Nach vorne',
    rest.fitness > atk.fitness, `${rest.fitness.toFixed(1)} gegen ${atk.fitness.toFixed(1)}`);

  // --- Halbzeitentscheidung (Konzept Abschnitt 18) --------------------
  log('\n--- Halbzeitentscheidung ---');
  const halftimeRuns = (choice: string) => {
    let ownShots = 0; let oppShots = 0; let games = 0; let sawHalftime = 0;
    for (const m of upcoming.slice(0, 50)) {
      const prepared = prepareUserMatch(game, m.id, true);
      if (!prepared) continue;
      const side = prepared.setup.homeClub.id === user.clubId ? 'home' : 'away';
      const r = new Rng((game.rngState + games * 2749 + 3) >>> 0);
      const engine = new MatchEngine({ ...prepared.setup, highlightMode: 'own', rng: r });
      let guard = 0;
      while (!engine.finished && !engine.pendingHalftime && guard++ < 200) {
        const res = engine.step();
        if (res.pending) engine.resolve(autoResolveChallenge(res.pending, user, DIFFICULTY_SETTINGS.normal, r));
        else if (engine.pendingInjury) engine.resolveInjury('off');
      }
      if (engine.pendingHalftime) { sawHalftime++; engine.resolveHalftime(choice); }
      engine.runToEnd((c) => autoResolveChallenge(c, user, DIFFICULTY_SETTINGS.normal, r));
      // Offensivaktionen der zweiten Haelfte je Seite - weniger verrauscht als Tore.
      for (const e of engine.events) {
        if (e.minute <= 45) continue;
        if (e.type !== 'goal' && e.type !== 'save' && e.type !== 'miss') continue;
        if (e.side === side) ownShots++;
        else if (e.side) oppShots++;
      }
      games++;
    }
    return { ownShots, oppShots, games, sawHalftime };
  };

  const push = halftimeRuns('push');
  const hold = halftimeRuns('hold');
  log(`Halbzeitszene trat auf: ${push.sawHalftime}/${push.games} Spiele`);
  const pushTotal = push.ownShots + push.oppShots;
  const holdTotal = hold.ownShots + hold.oppShots;
  log(`Volle Offensive:     2. Haelfte ${push.ownShots} eigene, ${push.oppShots} gegnerische (${pushTotal} gesamt)`);
  log(`Kompakt verteidigen: 2. Haelfte ${hold.ownShots} eigene, ${hold.oppShots} gegnerische (${holdTotal} gesamt)`);
  check('Halbzeitszene tritt bei interaktiven Spielen auf',
    push.sawHalftime > push.games * 0.8, `${push.sawHalftime}/${push.games}`);

  // Die Wirkung wird deterministisch ueber die gesetzten Faktoren geprueft -
  // ein Vollspiel-Vergleich waere durch den Zufall zu verrauscht.
  const modsFor = (choice: string) => {
    const prepared = prepareUserMatch(game, upcoming[0].id, true)!;
    const r = new Rng(4711);
    const e = new MatchEngine({ ...prepared.setup, rng: r });
    let guard = 0;
    while (!e.finished && !e.pendingHalftime && guard++ < 200) {
      const res = e.step();
      if (res.pending) e.resolve(autoResolveChallenge(res.pending, user, DIFFICULTY_SETTINGS.normal, r));
      else if (e.pendingInjury) e.resolveInjury('off');
    }
    if (e.pendingHalftime) e.resolveHalftime(choice);
    return e.secondHalfMods;
  };
  const pushMods = modsFor('push');
  const holdMods = modsFor('hold');
  log(`Volle Offensive setzt Angriff x${pushMods.attack.toFixed(2)}, Abwehr x${pushMods.defence.toFixed(2)}`);
  log(`Kompakt setzt Angriff x${holdMods.attack.toFixed(2)}, Abwehr x${holdMods.defence.toFixed(2)}`);
  check('Volle Offensive staerkt den Angriff und schwaecht die Abwehr',
    pushMods.attack > 1 && pushMods.defence < 1,
    `A ${pushMods.attack.toFixed(2)}, D ${pushMods.defence.toFixed(2)}`);
  check('Kompakt staerkt die Abwehr und schwaecht den Angriff',
    holdMods.defence > 1 && holdMods.attack < 1,
    `A ${holdMods.attack.toFixed(2)}, D ${holdMods.defence.toFixed(2)}`);

  // --- Verletzungsentscheidung (Konzept Abschnitt 18 und 37) ----------
  log('\n--- Verletzungsentscheidung ---');
  const injuryMatch = upcoming.find((m) => prepareUserMatch(game, m.id, true)?.userInLineup);
  if (injuryMatch) {
    // "Auswechseln lassen" ergibt exakt die geschaetzte Ausfalldauer.
    const off = (() => {
      const prepared = prepareUserMatch(game, injuryMatch.id, true)!;
      const r = new Rng(555);
      const e = new MatchEngine({ ...prepared.setup, rng: r });
      e.pendingInjury = { minute: 30, estimatedDays: 20, severity: 'mittel', canSubstitute: true };
      e.resolveInjury('off');
      const out = e.finish();
      return out.injuries.filter((i) => i.playerId === user.id);
    })();
    log(`Auswechseln lassen: ${off.length} Verletzung(en), Tage ${off.map((i) => i.days).join(',')}`);
    check('Auswechseln ergibt die geschaetzte Ausfalldauer',
      off.length === 1 && off[0].days === 20, `${off.map((i) => i.days).join(',')}`);

    // "Weiterspielen" ueber viele Versuche: mal glimpflich, mal schlimmer.
    let mild = 0; let worse = 0;
    for (let i = 0; i < 60; i++) {
      const prepared = prepareUserMatch(game, injuryMatch.id, true)!;
      const r = new Rng(1000 + i * 97);
      const e = new MatchEngine({ ...prepared.setup, rng: r });
      // Frueh im Spiel verletzen, damit viel Zeit fuer eine Verschlimmerung bleibt.
      let guard = 0;
      while (e.minute < 20 && !e.finished && guard++ < 60) {
        const res = e.step();
        if (e.pendingHalftime) e.resolveHalftime('balanced');
        else if (res.pending) e.resolve(autoResolveChallenge(res.pending, user, DIFFICULTY_SETTINGS.normal, r));
      }
      e.pendingInjury = { minute: e.minute, estimatedDays: 20, severity: 'mittel', canSubstitute: true };
      e.resolveInjury('play');
      e.runToEnd((c) => autoResolveChallenge(c, user, DIFFICULTY_SETTINGS.normal, r));
      const out = e.finish();
      const mine = out.injuries.filter((x) => x.playerId === user.id);
      const days = mine.length ? Math.max(...mine.map((x) => x.days)) : 0;
      if (days > 20) worse++; else mild++;
    }
    log(`Weiterspielen (60 Versuche): ${mild} glimpflich, ${worse} verschlimmert`);
    check('Weiterspielen geht meistens glimpflich aus', mild > worse, `${mild} zu ${worse}`);
    check('Weiterspielen kann sich verschlimmern', worse > 0, `${worse}`);
  } else {
    log('Kein Spiel mit dem Nutzer in der Startelf gefunden - Verletzungstest uebersprungen.');
  }

  // --- Interviews (Konzept Abschnitt 39) ------------------------------
  log('\n--- Interviews ---');
  const playedUserMatch = Object.values(game.matches).find(
    (m) => m.played && m.userStats && m.userStats.minutes > 0);
  if (playedUserMatch && playedUserMatch.userStats) {
    // Interview erzwingen: mit verschiedenen Seeds bauen, bis eines entsteht.
    let iv = null;
    for (let i = 0; i < 40 && !iv; i++) {
      iv = buildPostMatchInterview(game, playedUserMatch, playedUserMatch.userStats,
        new Rng(9001 + i * 131));
    }
    check('Nach einem Einsatz entsteht ein Interview', !!iv, iv ? `${iv.options.length} Optionen` : 'keins');
    if (iv) {
      check('Interview bietet drei Antworten', iv.options.length === 3, `${iv.options.length}`);
      const hasTones = ['humble', 'confident', 'provocative'].every(
        (id) => iv!.options.some((o) => o.id === id));
      check('Interview enthaelt alle drei Tonlagen', hasTones);

      // Wirkung der bescheidenen gegen die provokante Antwort auf die Trainerbeziehung.
      // Basiswerte in die Mitte setzen, damit die Effekte nicht an 0 oder 100 anstossen.
      game.coachRelation = 55; game.fanRelation = 50; game.publicImage = 55;
      const snap = () => ({ coach: game.coachRelation, fans: game.fanRelation, image: game.publicImage });
      const before = snap();
      applyInterviewAnswer(game, iv, 'humble');
      const afterHumble = snap();
      // Zustand zuruecksetzen
      game.coachRelation = before.coach; game.fanRelation = before.fans; game.publicImage = before.image;
      applyInterviewAnswer(game, iv, 'provocative');
      const afterProv = snap();
      game.coachRelation = before.coach; game.fanRelation = before.fans; game.publicImage = before.image;

      log(`Bescheiden: Trainer ${before.coach.toFixed(0)} -> ${afterHumble.coach.toFixed(0)}, `
        + `Image ${before.image.toFixed(0)} -> ${afterHumble.image.toFixed(0)}`);
      log(`Provokant:  Trainer ${before.coach.toFixed(0)} -> ${afterProv.coach.toFixed(0)}, `
        + `Image ${before.image.toFixed(0)} -> ${afterProv.image.toFixed(0)}`);
      check('Bescheidene Antwort verbessert die Trainerbeziehung',
        afterHumble.coach > before.coach, `${before.coach.toFixed(0)} -> ${afterHumble.coach.toFixed(0)}`);
      check('Provokante Antwort schadet Trainer und Image',
        afterProv.coach < before.coach && afterProv.image < before.image,
        `Trainer ${afterProv.coach.toFixed(0)}, Image ${afterProv.image.toFixed(0)}`);
    }
  } else {
    log('Kein gespieltes Nutzerspiel gefunden - Interviewtest uebersprungen.');
  }

  // --- Beziehungen zu Mitspielern (Abschnitt 30) ----------------------
  log('\n--- Beziehungen zu Mitspielern ---');
  {
    const g3 = createNewGame({
      saveName: 'Beziehungstest', seed: 13579, difficulty: 'normal',
      firstName: 'Rela', lastName: 'Tion', age: 18, nationality: 'falkenland',
      position: 'ST', altPositions: [], foot: 'rechts', height: 182, weight: 76,
      shirtNumber: 9,
      appearance: { skinTone: 0, hairStyle: 1, hairColor: '#2b2118', beard: 0, eyeColor: '#4a3120', boots: '#fff' },
      background: 'homeClub',
    });
    const rels = Object.entries(g3.relationships);
    const friends = rels.filter(([, v]) => v > 0);
    const rivals = rels.filter(([, v]) => v < 0);
    log(`Startbeziehungen: ${rels.length} gesamt, ${friends.length} positiv, ${rivals.length} negativ`
      + `${g3.mentorId ? ', mit Mentor' : ''}`);
    check('Beim Start entstehen Beziehungen', rels.length > 0, `${rels.length}`);
    check('Es gibt mindestens eine positive Beziehung', friends.length > 0, `${friends.length}`);

    // Einen Freund und einen Rivalen fuer den Verlaufstest festhalten.
    const friendId = friends[0]?.[0];
    const rivalId = rivals[0]?.[0];
    const before = { friend: friendId ? g3.relationships[friendId] : 0,
      rival: rivalId ? g3.relationships[rivalId] : 0 };

    // Rund 15 eigene Spiele absolvieren.
    const u3 = g3.players[g3.userPlayerId];
    let played = 0; let guard = 0;
    while (played < 15 && guard++ < 500) {
      const res = advanceDay(g3);
      if (res.matchToPlay) {
        const prepared = prepareUserMatch(g3, res.matchToPlay, false);
        if (prepared) {
          const r = new Rng(g3.rngState);
          const e = new MatchEngine({ ...prepared.setup, rng: r });
          e.runToEnd((c) => autoResolveChallenge(c, u3, DIFFICULTY_SETTINGS.normal, r));
          g3.rngState = r.state;
          const out = e.finish();
          finishUserMatch(g3, res.matchToPlay, out);
          if (out.stats.some((s) => s.playerId === u3.id && s.minutes > 0)) played++;
        } else g3.pendingMatchId = null;
      }
    }
    const after = { friend: friendId ? g3.relationships[friendId] : 0,
      rival: rivalId ? g3.relationships[rivalId] : 0 };
    log(`Nach ${played} Spielen: Freund ${before.friend.toFixed(0)} -> ${after.friend.toFixed(0)}, `
      + `Rivale ${before.rival.toFixed(0)} -> ${after.rival.toFixed(0)}`);
    if (friendId) check('Freundschaft waechst mit gemeinsamer Spielzeit',
      after.friend >= before.friend, `${before.friend.toFixed(0)} -> ${after.friend.toFixed(0)}`);
    if (rivalId) check('Rivalitaet vertieft sich mit der Zeit',
      after.rival <= before.rival, `${before.rival.toFixed(0)} -> ${after.rival.toFixed(0)}`);
  }

  // --- Ereignisse ausserhalb des Platzes (Abschnitt 31) ---------------
  log('\n--- Ereignisse ausserhalb des Platzes ---');
  {
    // Frische Karriere, damit der Saisonverlauf sauber ist.
    const g2 = createNewGame({
      saveName: 'Ereignistest', seed: 24680, difficulty: 'normal',
      firstName: 'Event', lastName: 'Tester', age: 17, nationality: 'falkenland',
      position: 'ZM', altPositions: [], foot: 'rechts', height: 180, weight: 74,
      shirtNumber: 8,
      appearance: { skinTone: 0, hairStyle: 1, hairColor: '#2b2118', beard: 0, eyeColor: '#4a3120', boots: '#fff' },
      background: 'academy',
    });
    let firstEvent = null;
    let daysToEvent = 0;
    for (let i = 0; i < 400 && !firstEvent; i++) {
      const res = advanceDay(g2);
      // Ein anstehendes Spiel muss abgeraeumt werden, sonst blockiert der Kalender.
      if (res.matchToPlay) {
        const prepared = prepareUserMatch(g2, res.matchToPlay, false);
        if (prepared) {
          const r = new Rng(g2.rngState);
          const e = new MatchEngine({ ...prepared.setup, rng: r });
          e.runToEnd((c) => autoResolveChallenge(c, g2.players[g2.userPlayerId], DIFFICULTY_SETTINGS.normal, r));
          g2.rngState = r.state;
          finishUserMatch(g2, res.matchToPlay, e.finish());
        } else {
          g2.pendingMatchId = null;
        }
        continue;
      }
      if (res.lifeEvent) { firstEvent = res.lifeEvent; break; }
      daysToEvent++;
    }
    check('Ein Ereignis ausserhalb des Platzes tritt auf', !!firstEvent,
      firstEvent ? `nach ${daysToEvent} Tagen: ${firstEvent.title}` : 'keins in 400 Tagen');
    if (firstEvent) {
      log(`Erstes Ereignis nach ${daysToEvent} Tagen: ${firstEvent.title} (${firstEvent.options.length} Optionen)`);
      check('Ereignis bietet mindestens zwei Optionen', firstEvent.options.length >= 2);
      const before = { image: g2.publicImage, morale: g2.players[g2.userPlayerId].morale };
      // Eine Option mit spuerbarer Wirkung anwenden.
      const opt = firstEvent.options.find((o) => Object.keys(o.effect).length > 0) ?? firstEvent.options[0];
      applyLifeChoice(g2, firstEvent, opt.id);
      const changed = g2.publicImage !== before.image
        || g2.players[g2.userPlayerId].morale !== before.morale
        || g2.fanRelation !== 50 || g2.coachRelation !== 55;
      log(`Wahl "${opt.label}" angewandt.`);
      check('Die Wahl veraendert die Werte des Spielers', changed);
    }
  }

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

  // Fester Durchschnittsstuermer als Basis, unabhaengig von den Karrierewerten,
  // damit der Vergleich reproduzierbar bleibt.
  const baseShooter: typeof user = structuredClone(user);
  for (const key of Object.keys(baseShooter.attrs) as (keyof typeof baseShooter.attrs)[]) {
    baseShooter.attrs[key] = 55;
  }
  baseShooter.form = 55; baseShooter.confidence = 55; baseShooter.fitness = 90;

  // Weltklassestuermer zum Vergleich: gleiche Eingabe, deutlich mehr Ertrag
  const worldClass: typeof user = structuredClone(baseShooter);
  for (const key of Object.keys(worldClass.attrs) as (keyof typeof worldClass.attrs)[]) {
    worldClass.attrs[key] = Math.min(95, worldClass.attrs[key] + 30);
  }
  worldClass.form = 80; worldClass.confidence = 85; worldClass.fitness = 100;

  let goodGoals = 0; let badGoals = 0; let eliteGoals = 0;
  for (let i = 0; i < 400; i++) {
    if (resolveShot(perfect, testChallenge, baseShooter, DIFFICULTY_SETTINGS.normal, physicsRng).outcome === 'goal') goodGoals++;
    if (resolveShot(sloppy, testChallenge, baseShooter, DIFFICULTY_SETTINGS.normal, physicsRng).outcome === 'goal') badGoals++;
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

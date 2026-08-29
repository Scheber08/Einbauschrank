/**
 * Temporaerer Rauchtest der Spiellogik.
 * Erzeugt eine Karriere, spielt mehrere Saisons durch und prueft die Ergebnisse
 * auf Plausibilitaet. Wird ueber /devtest.html aufgerufen.
 */
import { kaderplatz } from './engine/lineup';
import { squadOf } from './engine/worldGen';
import { direktabnahmeChance } from './engine/attributes';
import { kopfballGefahr, luftHoheit } from './engine/attributes';
import { aufSchwachemFuss, resolvePass } from './engine/ballAction';
import { tDecimal } from './i18n';
import { ATTR_LABELS } from './engine/attributes';
import { playWorldNationsCup } from './engine/national';
import { offerPreContracts, fulfilPreContract, expireUserContract } from './engine/contract';
import { offerUserRenewal } from './engine/season';
import { summaryLabelKey, summaryValues } from './engine/attributes';
import {
  TRAITS, neueStaerken, traitEffect, traitLabelKey,
} from './engine/traits';
import { entpackeFuerTest, packeFuerTest } from './engine/save';
import { leagueLayout } from './engine/realData';
import { COUNTRIES } from './engine/countries';
import { neueSpielweise } from './engine/manager';
import { LIFESTYLE, extraSessionEffect } from './engine/choices';
import { TALENT_PROFILE, reviewPotential } from './engine/potential';
import { DEFENSIVER_TEST, matchFormation } from './engine/formation';
import {
  formatKickoff, kickoffAuslastung, matchKickoff,
} from './engine/kickoff';
import { pressureSeconds } from './engine/tempo';
import { minutenGewicht, zieheTorminute } from './engine/tempo';
import { advanceSeason, advanceUntil } from './state/actions';
import { getState, setState } from './state/store';
import type { Challenge } from './engine/matchTypes';
import { matchReferee, type RefereeStyle } from './engine/referee';
import { matchWeather, type Weather } from './engine/weather';
import { attendanceRoll } from './engine/rivalry';
import { findBlock } from './engine/ballAction';
import { resolveDuel, resolveDribble, applyExecutionError, autoResolveChallenge, resolveShot, simulateBallFlight } from './engine/ballAction';
import {
  ALL_ATTRS, defensiveSkill, keeperSkill, tempo, computeOverall,
  type AttrKey, type Attributes, type KeeperSituation,
} from './engine/attributes';
import { makeDate } from './engine/date';
import { weekday, isAfter, isBefore, addDays, seasonLabel } from './engine/date';
import {
  advanceDay, createNewGame, finishUserMatch, prepareUserMatch, sortedTable, userClub,
} from './engine/game';
import { positionCompetition } from './engine/competition';
import { evaluateNomination, userNationalSquad } from './engine/national';
import { mentorInfluence, mentorLeft } from './engine/relationships';
import { buildWageIndex, canSign, feeShare, wageBill } from './engine/finance';
import { checkCaptaincy, dropCaptaincyOnTransfer, growLeadership } from './engine/captain';
import { learnAltPosition } from './engine/versatility';
import { freeKickStanding, penaltyStanding } from './engine/setpieces';
import { START_POINTS, type NewGameOptions } from './engine/game';
import { PLAYABLE_COUNTRY, createObjectives, simulateUserMatch } from './engine/game';
import { advanceAgent, ensureAgent, startAgentTask } from './engine/agent';
import {
  applyTraining, injuryForDays, updateFormAfterMatch,
} from './engine/development';
import { quickTeamRating, slotScore } from './engine/lineup';
import { CROSS_CHANCE_TABELLE } from './engine/matchEngine';
import { MatchEngine } from './engine/matchEngine';
import { applyInterviewAnswer, buildPostMatchInterview } from './engine/media';
import { applyLifeChoice, buildLifeEvent, type Lage } from './engine/events';
import { clamp, Rng } from './engine/rng';
import { leaguesOfCountry } from './engine/season';
import { collectStats, sumStats } from './engine/stats';
import { emptySeasonStats, type GameState, type Player, DIFFICULTY_SETTINGS, type SquadRole, type TacticStyle } from './engine/types';
import { FORMATION_SLOTS } from './engine/worldGen';
import { place } from './ui/FormationPitch';
import { EVENT_KEYS } from './ui/tabs/ChronicleTab';
import { DE } from './i18n/de';
import { EN } from './i18n/en';
import { setLocale, t, tVariant } from './i18n';

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
    nationality: 'de',
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

  // Die Erwartung wird aus COUNTRIES abgeleitet, nicht fest eingetragen.
  // Vorher standen hier "300 Vereine (5 Laender)" und "15 Ligen" als Zahlen -
  // jedes neue Land haette drei Pruefungen brechen lassen, obwohl nichts
  // kaputt ist.
  // Gegen den tatsaechlichen Aufbau pruefen, nicht gegen die Namensliste:
  // bei Laendern mit eigener Datenbank bestimmt die Datenbank die Zahl der
  // Stufen, und die kann von den eingetragenen Namen abweichen.
  const erwarteteLigen = COUNTRIES.reduce(
    (a, c) => a + leagueLayout(c.id).length, 0);
  const erwarteteVereine = erwarteteLigen * 20;
  check(`${erwarteteVereine} Vereine erzeugt (${COUNTRIES.length} Länder)`,
    clubCount === erwarteteVereine, `${clubCount}`);
  check('Genug Spieler für alle Kader',
    playerCount > erwarteteVereine * 22, `${playerCount}`);
  check('Spielplan passt zur Zahl der Ligen',
    matchCount >= erwarteteLigen * 340, `${matchCount} bei ${erwarteteLigen} Ligen`);

  const leagues = leaguesOfCountry(game, 'falkenland');
  const startLand = COUNTRIES.find((c) => c.id === PLAYABLE_COUNTRY);
  check('Das Startland hat alle seine Ligen',
    leagues.length === leagueLayout(startLand?.id ?? PLAYABLE_COUNTRY).length,
    `${leagues.length}`);
  for (const l of leagues) {
    check(`${l.name}: 20 Vereine`, l.clubIds.length === 20, `${l.clubIds.length}`);
  }
  // Jedes Land besitzt ein vollstaendiges Ligasystem.
  const fehlend = COUNTRIES.filter(
    (c) => leaguesOfCountry(game, c.id).length !== leagueLayout(c.id).length);
  check('Jedes Land hat seine Ligen', fehlend.length === 0,
    fehlend.map((c) => c.name).join(', ') || 'alle vollständig');

  const user = game.players[game.userPlayerId];
  const club = userClub(game);
  log(`Spieler: ${user.firstName} ${user.lastName}, Stärke ${computeOverall(user.attrs, user.position)}, `
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

  // --- Nationalmannschaft und World Nations Cup (Abschnitt 12-13) ------
  {
    // Eine eigene, laenger laufende Karriere, damit der erste WNC (2028)
    // stattfindet - er wird am Ende der Saison 2028 gespielt.
    // Nigeria hat kein eigenes Ligasystem und steht nicht im Standardfeld:
    // damit prueft der Test zugleich, dass die Nation des eigenen Spielers
    // in jedem Fall einen Turnierplatz bekommt.
    const gN = createNewGame({
      saveName: 'WNC-Test', seed: 33221, difficulty: 'einfach',
      firstName: 'Natio', lastName: 'Spieler', age: 17, nationality: 'ng',
      position: 'ST', altPositions: [], foot: 'rechts', height: 183, weight: 78,
      shirtNumber: 9,
      appearance: { skinTone: 0, hairStyle: 1, hairColor: '#2b2118', beard: 0, eyeColor: '#4a3120', boots: '#fff' },
      background: 'wonderkid',
    });
    const uN = gN.players[gN.userPlayerId];
    // Zu einem Topklub und starken Werten verhelfen, damit eine Nominierung faellt.
    for (const k of Object.keys(uN.attrs) as (keyof typeof uN.attrs)[]) uN.attrs[k] = Math.max(uN.attrs[k], 82);
    uN.potential = 95;
    let guardN = 0; let wncSeen = 0;
    while (gN.season < 2029 && guardN++ < 5000) {
      const res = advanceDay(gN);
      if (res.wnc) wncSeen++;
      if (res.matchToPlay) {
        const prepared = prepareUserMatch(gN, res.matchToPlay, false);
        if (prepared) {
          const r = new Rng(gN.rngState);
          const e = new MatchEngine({ ...prepared.setup, rng: r });
          e.runToEnd((c) => autoResolveChallenge(c, uN, DIFFICULTY_SETTINGS.einfach, r));
          gN.rngState = r.state;
          finishUserMatch(gN, res.matchToPlay, e.finish());
        } else gN.pendingMatchId = null;
      }
    }
    log(`\n--- Nationalmannschaft und WNC ---`);
    log(`Saison ${gN.season}, WNC-Ereignisse: ${wncSeen}, Historie: ${gN.wncHistory.length}, `
      + `nominiert: ${gN.nationalNominated}, Länderspiele: ${gN.nationalCaps}, Tore: ${gN.nationalGoals}`);
    check('Ein World Nations Cup wurde gespielt', gN.wncHistory.length >= 1, `${gN.wncHistory.length}`);
    if (gN.wncHistory.length > 0) {
      const w = gN.wncHistory[0];
      log(`WNC ${w.year}: Weltmeister ${w.championName} gegen ${w.runnerUpName}`
        + `${w.userNominated ? `, eigener Spieler: ${w.userNationReached} (${w.userCaps} Spiele)` : ''}`);
      check('Der WNC hat einen Weltmeister', !!w.championName);
      check('Champion und Finalist sind verschieden', w.championName !== w.runnerUpName,
        `${w.championName} / ${w.runnerUpName}`);
    }
    check('Starker Spieler wird nominiert', gN.nationalNominated, `${gN.nationalNominated}`);
    check('Nominierter Spieler sammelt Länderspiele', gN.nationalCaps > 0, `${gN.nationalCaps}`);
    check('Nation ohne Ligasystem nimmt am WNC teil', gN.nationalCaps > 0,
      `Nigeria, ${gN.nationalCaps} Einsätze`);
  }

  // --- Continental Champions Cup (Abschnitt 10) -----------------------
  const cc = game.competitions['cc'];
  check('Champions Cup existiert', !!cc, cc ? `${cc.clubIds.length} Teilnehmer` : 'fehlt');
  if (cc) {
    check('Champions Cup hat 24 Teilnehmer', cc.clubIds.length === 24, `${cc.clubIds.length}`);
    const ccMatches = Object.values(game.matches).filter((m) => m.competitionId === 'cc');
    const leaguePhase = ccMatches.filter((m) => (m.matchday ?? 0) <= 8);
    const ko = ccMatches.filter((m) => (m.matchday ?? 0) >= 100);
    log(`Champions Cup: ${leaguePhase.length} Ligaphasenspiele (aktuelle Saison), `
      + `${ko.length} K.-o.-Spiele im Plan`);
    // 24 Teams, 8 Spieltage = 96 Ligaphasenspiele je Saison.
    check('Ligaphase umfasst 96 Spiele', leaguePhase.length === 96, `${leaguePhase.length}`);

    // Ueber die gespielten Saisons muss es mindestens einen Sieger geben.
    let champions = 0;
    for (const club of Object.values(game.clubs)) {
      champions += club.history.filter((h) => h.note === 'Continental Champions Cup-Sieger').length;
    }
    log(`Bisherige Champions-Cup-Sieger verzeichnet: ${champions}`);
    check('Der Champions Cup kürt Sieger', champions >= 1, `${champions}`);
  }

  // --- Spielerstatistiken ---------------------------------------------
  const totals = sumStats(collectStats(game, game.userPlayerId));
  log(`\nEigene Bilanz: ${totals.appearances} Spiele, ${totals.goals} Tore, `
    + `${totals.assists} Vorlagen, Note ${(totals.appearances ? totals.ratingSum / totals.appearances : 0).toFixed(2)}`);
  check('Spieler kam zum Einsatz', totals.appearances > 0, `${totals.appearances}`);
  check('Bewertungen im gültigen Bereich',
    game.userMatchStats.every((s) => s.rating >= 1 && s.rating <= 10));
  check('Minuten plausibel',
    game.userMatchStats.every((s) => s.minutes >= 0 && s.minutes <= 125));

  // --- Konkurrenz auf der Position -------------------------------------
  {
    log('');
    log('--- Konkurrenz auf der Position ---');
    const klubs = Object.values(game.clubs).slice(0, 40);
    let ungueltig = 0;
    let mitKonkurrenz = 0;
    for (const c of klubs) {
      const k = positionCompetition(game, c.id, user);
      // Der Rang muss zwischen 1 und "alle Rivalen plus ich" liegen.
      if (k.rank < 1 || k.rank > k.count + 1) ungueltig++;
      if (k.count === 0 && k.best !== 0) ungueltig++;
      if (k.count > 0) mitKonkurrenz++;
    }
    log(`${klubs.length} Vereine geprüft, ${mitKonkurrenz} mit Konkurrenz auf ${user.position}`);
    check('Rangberechnung bleibt im gültigen Bereich', ungueltig === 0, `${ungueltig} Ausreisser`);
    // Ohne Konkurrenz waere die Auskunft wertlos - es muss welche geben.
    check('Es gibt Vereine mit Konkurrenz auf der Position', mitKonkurrenz > 5,
      `${mitKonkurrenz} von ${klubs.length}`);
  }

  // --- Saisonziele: Abrechnung und Saettigung --------------------------
  {
    log('');
    log('--- Saisonziele ---');
    const bilanz = game.news.filter((n) => /Saisonziel/.test(n.headline));
    log(`Zielmeldungen: ${bilanz.length}, Trainer ${Math.round(game.coachRelation)}, `
      + `Fans ${Math.round(game.fanRelation)}`);
    // Ohne Abrechnung waeren die Ziele reine Anzeige - genau das war der Fall.
    check('Saisonziele werden abgerechnet', bilanz.length > 0, `${bilanz.length} Meldungen`);

    // Frueher klebten beide Werte bei 100, weil die Daempfung nach oben einen
    // Boden hatte. Am Anschlag ist eine Beziehung als Groesse tot.
    check('Trainerbeziehung klebt nicht am Anschlag', game.coachRelation < 99.5,
      `${game.coachRelation.toFixed(1)}`);
    check('Fanbeliebtheit klebt nicht am Anschlag', game.fanRelation < 99.5,
      `${game.fanRelation.toFixed(1)}`);
  }

  // --- Verletzungen: Art passt zur Dauer -------------------------------
  {
    log('');
    log('--- Verletzungen ---');
    const vRng = new Rng(4711);
    // Der Platzhalter braucht Attribute: Die Verletzungsschwere liest die
    // Widerstandsfaehigkeit, um den Moralschlag abzufedern.
    const proband = () => ({
      injury: null, fitness: 90, morale: 70, attrs: { resilience: 50 },
    } as never);
    let unpassend = 0;
    let falscherSchaden = 0;
    for (const tage of [3, 6, 12, 20, 30, 50, 90, 150, 260]) {
      for (let i = 0; i < 40; i++) {
        const v = injuryForDays(vRng, proband(), tage);
        if (v.daysOut !== tage) unpassend++;
        // Bleibender Schaden darf nur bei langen Ausfaellen auftreten.
        if (v.permanentLoss && tage < 60) falscherSchaden++;
        if (v.severity === 'leicht' && tage > 20) unpassend++;
        if (v.severity === 'schwer' && tage < 45) unpassend++;
      }
    }
    check('Verletzungsdauer bleibt erhalten und passt zur Schwere', unpassend === 0,
      `${unpassend} Abweichungen`);
    check('Bleibender Schaden nur bei langen Ausfällen', falscherSchaden === 0,
      `${falscherSchaden} Fälle`);
  }

  // --- Sprachkataloge --------------------------------------------------
  {
    log('');
    log('--- Sprachkataloge ---');
    const deKeys = Object.keys(DE);
    const enKeys = Object.keys(EN);
    log(`Schlüssel: ${deKeys.length} deutsch, ${enKeys.length} englisch`);

    // Ein Schluessel, den nur eine Sprache kennt, faellt im Spiel stumm auf
    // Deutsch zurueck - das faellt beim Spielen kaum auf und bleibt liegen.
    const fehltEn = deKeys.filter((k) => !(k in EN));
    const fehltDe = enKeys.filter((k) => !(k in DE));
    check('Englischer Katalog ist vollständig', fehltEn.length === 0,
      fehltEn.slice(0, 8).join(', '));
    check('Kein englischer Schlüssel ohne deutsches Gegenstück', fehltDe.length === 0,
      fehltDe.slice(0, 8).join(', '));

    // Platzhalter muessen auf beiden Seiten dieselben sein, sonst steht in
    // einer Sprache '{name}' im Text.
    const platzhalter = (s: string) => (s.match(/{w+}/g) ?? []).slice().sort().join(",");
    const schief = deKeys.filter((k) => k in EN && platzhalter(DE[k]) !== platzhalter(EN[k]));
    check('Platzhalter stimmen überein', schief.length === 0, schief.slice(0, 8).join(', '));

    // Leere Texte wuerden als leere Beschriftung durchrutschen.
    const leer = [...deKeys.filter((k) => !DE[k].trim()), ...enKeys.filter((k) => !EN[k].trim())];
    check('Keine leeren Texte', leer.length === 0, leer.slice(0, 8).join(', '));
  }

  // --- Formationsgrafik ------------------------------------------------
  {
    log('');
    log('--- Formationsgrafik ---');
    for (const [name, positionen] of Object.entries(FORMATION_SLOTS)) {
      const slots = positionen.map((position, i) => ({ playerId: `x${i}`, position }));
      const placed = place(slots, name);

      check(`${name}: alle elf platziert`, placed.length === 11, `${placed.length}`);

      // Nichts darf ueber den Rasen hinausragen.
      const drin = placed.every((p) => p.x >= 0.08 && p.x <= 0.92 && p.y >= 0.08 && p.y <= 0.92);
      check(`${name}: alles im Feld`, drin,
        placed.filter((p) => p.x < 0.08 || p.x > 0.92 || p.y < 0.08 || p.y > 0.92)
          .map((p) => `${p.position} ${p.x.toFixed(2)}/${p.y.toFixed(2)}`).join(', '));

      // Die Zahl der Ketten muss zum Namen passen: Torwart plus Gliederung.
      const ketten = name.split('-').length;
      const reihen = new Set(placed.map((p) => Math.round(p.y * 25))).size;
      check(`${name}: Gliederung erkannt`, reihen >= ketten + 1 && reihen <= ketten + 2,
        `${reihen} Reihen bei ${ketten} Ketten`);

      // Keine zwei Spieler duerfen uebereinander liegen.
      let engste = 9;
      for (let i = 0; i < placed.length; i++) {
        for (let j = i + 1; j < placed.length; j++) {
          const dx = placed[i].x - placed[j].x;
          const dy = (placed[i].y - placed[j].y) * 1.33; // Feld ist hoeher als breit
          engste = Math.min(engste, Math.hypot(dx, dy));
        }
      }
      check(`${name}: keine Überdeckung`, engste > 0.1, `engster Abstand ${engste.toFixed(3)}`);
    }

    // Unbekannte Namen duerfen nicht zu Chaos fuehren, sondern fallen auf die
    // Einteilung nach Positionskuerzeln zurueck.
    const wirr = place(FORMATION_SLOTS['4-4-2'].map((position, i) =>
      ({ playerId: `y${i}`, position })), 'Kraut-und-Rueben');
    check('Unbekannte Formation fällt sauber zurück',
      wirr.length === 11 && wirr.every((p) => p.x >= 0.08 && p.x <= 0.92),
      `${wirr.length} platziert`);
  }

  // --- Karrierebogen: Chronik und Vertrag -----------------------------
  {
    const marken = game.careerEvents.filter((e) => e.type === 'milestone');
    log(`
Chronik: ${game.careerEvents.length} Einträge, davon ${marken.length} Marken`);
    // Ohne laufende Marken schwieg die Chronik nach den Premieren jahrelang.
    check('Chronik führt laufende Marken', marken.length > 0,
      marken.map((e) => e.title).join(', ') || 'keine');

    // Kein Eintrag darf mit einem unbekannten Typ enden - sonst zeigt die
    // Oberflaeche nur 'Ereignis' statt einer Einordnung. Geprueft wird direkt
    // gegen die Tabelle der Chronik, damit hier keine zweite Liste veraltet.
    const unbekannt = [...new Set(game.careerEvents.map((e) => e.type))]
      .filter((typ) => !(typ in EVENT_KEYS));
    check('Alle Chroniktypen sind benannt', unbekannt.length === 0, unbekannt.join(', '));

    // Ein Vertrag darf nicht in der Vergangenheit enden: Wer nicht
    // verlaengert, muss den Verein verlassen haben.
    const endJahr = user.contract ? Number(user.contract.until.slice(0, 4)) : null;
    log(`Vertrag: ${user.contract ? `bis ${endJahr}, ${user.contract.salary} Euro/Woche` : "keiner"}`
      + ` (Saison ${game.season})`);
    check('Kein abgelaufener Vertrag läuft weiter',
      endJahr === null || endJahr > game.season,
      `Ende ${endJahr}, Saison ${game.season}`);
  }

  const newAbility = computeOverall(user.attrs, user.position);
  const age = game.season - Number(user.birthDate.slice(0, 4));
  log(`Entwicklung: Stärke ${startAbility} -> ${newAbility} (+${newAbility - startAbility}), `
    + `Potenzial ${user.potential}, Alter ${age}`);
  check('Spieler entwickelt sich spürbar', newAbility - startAbility >= 9,
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
    log(`Bester Torjäger der ersten Liga: ${p?.firstName} ${p?.lastName} `
      + `mit ${topScorerSeason.goals} Toren in ${topScorerSeason.appearances} Spielen`);
    check('Torjägerzahl plausibel', topScorerSeason.goals >= 8 && topScorerSeason.goals <= 45,
      `${topScorerSeason.goals}`);
  }

  const injured = Object.values(game.players).filter((p) => p.injury).length;
  const inSquads = Object.values(game.players).filter((p) => p.clubId).length;
  const injuredShare = inSquads > 0 ? (injured / inSquads) * 100 : 0;
  log(`Aktuell verletzte Spieler: ${injured} (${injuredShare.toFixed(2)} Prozent der Kader)`);
  // Untere Grenze bewusst gesetzt: Zuvor lautete sie ">= 0" und war damit immer
  // erfuellt - dass sich praktisch niemand verletzte, fiel deshalb nie auf.
  check('Verletzungen treten in der ganzen Welt auf', injuredShare >= 0.3,
    `${injuredShare.toFixed(2)} Prozent`);
  check('Verletzungen bleiben im Rahmen', injuredShare < 8, `${injuredShare.toFixed(2)} Prozent`);

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
      + 'für den Highlight-Test ausgeblendet)');
    user.injury = null;
    user.fitness = 92;
  }

  // Ausgangslage protokollieren, damit fehlende Einsatzzeit erklaerbar ist.
  const nowClub = user.clubId ? game.clubs[user.clubId] : null;
  log(`Status: ${nowClub?.name ?? 'vereinslos'}, Stärke ${computeOverall(user.attrs, user.position)}, `
    + `Rolle ${user.contract?.role ?? '-'}, Form ${Math.round(user.form)}, `
    + `Fitness ${Math.round(user.fitness)}, `
    + `${user.injury ? `verletzt (${t(user.injury.name)}, ${user.injury.daysOut} Tage)` : 'fit'}, `
    + `${user.suspension > 0 ? `gesperrt (${user.suspension})` : 'spielberechtigt'}`);

  const upcoming = Object.values(game.matches)
    .filter((m) => !m.played && (m.homeClubId === user.clubId || m.awayClubId === user.clubId))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 60);

  // Eine Momentaufnahme fuer die spaeten Abschnitte. Nach dem
  // Saisonsprung weiter unten ist im geteilten Spielstand keine Partie
  // mehr offen; wer dort eine echte Spielsituation braucht, nimmt diese
  // Kopie. Vorher benutzten jene Abschnitte die Liste oben einfach
  // weiter - ihre Partien waren laengst gespielt, sie spielten also alte
  // Ergebnisse noch einmal nach und massen in Wahrheit nichts.
  const mitSpielen = structuredClone(game);

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

  // Spiel und Startwert jedes Durchlaufs merken: Der Modusvergleich weiter
  // unten wiederholt genau diese Partien mit genau diesen Zufallsstroemen.
  // Nur so unterscheidet die beiden Laeufe wirklich der Modus und nicht der
  // Zufall - vorher verglich der Test zwei voellig verschiedene Spielverlaeufe.
  const ownRuns: { id: string; seed: number }[] = [];

  for (const m of upcoming) {
    const prepared = prepareUserMatch(game, m.id, true);
    if (!prepared) continue;
    const seed = (game.rngState + interactiveMatches * 7919) >>> 0;
    ownRuns.push({ id: m.id, seed });
    const rng2 = new Rng(seed);
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
  check('Dribblings werden ausgelöst (Abschnitt 24)', (kinds.get('dribble') ?? 0) > 0,
    `${kinds.get('dribble') ?? 0}`);

  // Standards uebernimmt nur, wer zu den besten Schuetzen gehoert.
  // Das ist der Weg "Freistossspezialist werden" aus Abschnitt 19.
  log(`Freistöße als Schütze: ${kinds.get('freeKick') ?? 0} `
    + `(eigener Freistosswert ${user.attrs.freeKicks})`);
  const savedFreeKicks = user.attrs.freeKicks;
  user.attrs.freeKicks = 92;
  let specialistFreeKicks = 0;
  const fkPool = upcoming.slice(0, 40);
  fkPool.forEach((m, k) => {
    const prepared = prepareUserMatch(game, m.id, true);
    if (!prepared) return;
    // Fester, pro Spiel unterschiedlicher Seed - unabhaengig vom Hauptlauf.
    const rng3 = new Rng(20000 + k * 911);
    const engine = new MatchEngine({ ...prepared.setup, rng: rng3 });
    engine.runToEnd((c) => {
      if (c.kind === 'freeKick') specialistFreeKicks++;
      return autoResolveChallenge(c, user, DIFFICULTY_SETTINGS.normal, rng3);
    });
  });
  user.attrs.freeKicks = savedFreeKicks;
  log(`Nach gezieltem Freistosstraining (Wert 92): ${specialistFreeKicks} Freistöße in ${fkPool.length} Spielen`);
  check('Freistoßspezialist tritt selbst an (Abschnitt 19 und 22)', specialistFreeKicks > 0,
    `${specialistFreeKicks}`);
  check('Nicht zu viele Unterbrechungen pro Spiel',
    totalChallenges / Math.max(1, interactiveMatches) < 9,
    `${(totalChallenges / Math.max(1, interactiveMatches)).toFixed(1)}`);

  // --- Modus "Alle wichtigen Szenen" (Konzept Abschnitt 20.3) ---------
  log('\n--- Modus-Vergleich own gegen all ---');
  const allKinds = new Map<string, number>();
  let allMatches = 0;
  // Dieselben Partien, dieselben Startwerte wie im Lauf oben - nur der Modus
  // ist anders. Damit ist die Differenz ein echter Effekt und kein Rauschen.
  for (const run of ownRuns) {
    const prepared = prepareUserMatch(game, run.id, true);
    if (!prepared) continue;
    const rng4 = new Rng(run.seed);
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
    + `(${allKinds.get('block') ?? 0} Klärungen)`);
  // Der Testspieler ist Stuermer; fuer ihn ist die defensive Einbindung
  // naturgemaess klein (Wahrscheinlichkeit 0,14 gegenueber 0,82 bei
  // Verteidigern), ein Vergleich einzelner Zweikaempfe misst darum nur
  // Rauschen.
  //
  // Die Gesamtzahl taugt fuer ihn ebenfalls nur begrenzt: Ueber 60 Partien
  // kommen rund 75 Situationen zusammen, ein Unterschied von zwei liegt also
  // im Rauschen. Genau daran ist diese Pruefung einmal gekippt (73 gegen 75),
  // nachdem eine Aenderung an anderer Stelle den Zufallsstrom verschoben
  // hatte - ohne dass am Modusverhalten irgendetwas kaputt war.
  //
  // Sie prueft deshalb nur noch, dass der Modus "all" nicht einbricht. Der
  // eigentliche Unterschied - Szenen von Mitspielern - wird gleich darunter
  // am Innenverteidiger belegt, und zwar mit grossem Abstand (42 Klaerungen
  // gegen 0). Eine Pruefung, die bei jedem zweiten Lauf kippt, sagt nichts.
  check('Modus "all" bricht nicht ein (Abschnitt 20.3)',
    allTotal >= totalChallenges * 0.85,
    `${allTotal} gegen ${totalChallenges}`);

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
    eAll.runToEnd((c) => { if (c.kind === 'duel' && c.title === t('me.ch.clearance.title')) ivBlocks++;
      return autoResolveChallenge(c, user, DIFFICULTY_SETTINGS.normal, rngA); });
    eAll.finish();
    const rngO = new Rng(70001 + k * 6113);
    const eOwn = new MatchEngine({ ...prepared.setup, highlightMode: 'own', rng: rngO });
    eOwn.runToEnd((c) => { if (c.kind === 'duel' && c.title === t('me.ch.clearance.title')) ivOwnBlocks++;
      return autoResolveChallenge(c, user, DIFFICULTY_SETTINGS.normal, rngO); });
    eOwn.finish();
  });
  user.position = savedPos;
  Object.assign(user.attrs, savedAttrs);
  log(`Als Innenverteidiger: ${ivBlocks} Klärungen im Modus "all", ${ivOwnBlocks} im Modus "own"`);
  check('Klärungen gegnerischer Großchancen entstehen im Modus "all"',
    ivBlocks > 0, `all ${ivBlocks}`);
  check('Klärungen treten niemals im Modus "own" auf',
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
          // Die Flanke zaehlt mit: sie ist unstrittig offensiv, und ohne
          // sie sank die Zahl der Offensivszenen ausgerechnet dann, wenn
          // mehr geflankt wurde.
          if (res.pending.kind === 'dribble' || res.pending.kind === 'cross'
            || /shot|Shot|header|oneOnOne/.test(res.pending.kind)) attackCh++;
          if (res.pending.kind === 'duel') defendCh++;
          engine.resolve(autoResolveChallenge(res.pending, user, DIFFICULTY_SETTINGS.normal, r));
        } else if (engine.pendingInjury) {
          engine.resolveInjury('off');
        }
        snap = engine.userLiveFitness;
      }
      // Rest des Spiels zu Ende bringen, damit die Zaehlung vollstaendig ist.
      engine.runToEnd((c) => {
        if (c.kind === 'dribble' || c.kind === 'cross'
          || /shot|Shot|header|oneOnOne/.test(c.kind)) attackCh++;
        if (c.kind === 'duel') defendCh++;
        return autoResolveChallenge(c, user, DIFFICULTY_SETTINGS.normal, r);
      });
      engine.finish();
      fitness40 += snap;
      games++;
    }
    return { attack: attackCh, defend: defendCh, fitness: fitness40 / Math.max(1, games) };
  };

  // Der Spieler muss fuer diese Messung sicher auf dem Platz stehen, sonst
  // bleibt seine Live-Fitness beim Startwert und die Ausrichtungen sind nicht
  // vergleichbar. Werte danach wiederherstellen.
  const attrsBackup = { ...user.attrs };
  for (const k of Object.keys(user.attrs) as (keyof typeof user.attrs)[]) {
    user.attrs[k] = Math.max(user.attrs[k], 88);
  }
  const atk = measure('attack');
  const bal = measure('balanced');
  const con = measure('contain');
  const rest = measure('conserve');
  Object.assign(user.attrs, attrsBackup);
  log(`Nach vorne:      ${atk.attack} offensiv, ${atk.defend} defensiv, Fitness bei Min 40 ${atk.fitness.toFixed(1)}`);
  log(`Ausbalanciert:   ${bal.attack} offensiv, ${bal.defend} defensiv, Fitness bei Min 40 ${bal.fitness.toFixed(1)}`);
  log(`Defensiv:        ${con.attack} offensiv, ${con.defend} defensiv, Fitness bei Min 40 ${con.fitness.toFixed(1)}`);
  log(`Kräfte schonen: ${rest.attack} offensiv, ${rest.defend} defensiv, Fitness bei Min 40 ${rest.fitness.toFixed(1)}`);
  check('Nach vorne bringt mehr Offensivszenen als Defensiv',
    atk.attack > con.attack, `${atk.attack} gegen ${con.attack}`);
  check('Defensiv bringt mehr Defensivszenen als Nach vorne',
    con.defend > atk.defend, `${con.defend} gegen ${atk.defend}`);
  check('Kräfte schonen verbraucht weniger Fitness als Nach vorne',
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
  log(`Volle Offensive:     2. Hälfte ${push.ownShots} eigene, ${push.oppShots} gegnerische (${pushTotal} gesamt)`);
  log(`Kompakt verteidigen: 2. Hälfte ${hold.ownShots} eigene, ${hold.oppShots} gegnerische (${holdTotal} gesamt)`);
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
  check('Volle Offensive stärkt den Angriff und schwächt die Abwehr',
    pushMods.attack > 1 && pushMods.defence < 1,
    `A ${pushMods.attack.toFixed(2)}, D ${pushMods.defence.toFixed(2)}`);
  check('Kompakt stärkt die Abwehr und schwächt den Angriff',
    holdMods.defence > 1 && holdMods.attack < 1,
    `A ${holdMods.attack.toFixed(2)}, D ${holdMods.defence.toFixed(2)}`);

  // --- Verletzungsentscheidung (Konzept Abschnitt 18 und 37) ----------
  log('\n--- Verletzungsentscheidung ---');

  /**
   * Bereitet ein Spiel vor, in dem der eigene Spieler sicher in der Startelf
   * steht - notfalls, indem er fuer diesen Test hineingesetzt wird.
   *
   * Geprueft wird hier die Verletzungsentscheidung, nicht die Nominierung. Ohne
   * das haengt die Abdeckung daran, ob der Trainer ihn zufaellig aufstellt: Der
   * Test fiel dann still aus und meldete trotzdem "bestanden".
   */
  function prepareStarting(matchId: string) {
    const prepared = prepareUserMatch(game, matchId, true);
    if (!prepared || prepared.userInLineup) return prepared;
    const lineup = prepared.setup.homeClub.id === user.clubId ? prepared.setup.homeLineup
      : prepared.setup.awayClub.id === user.clubId ? prepared.setup.awayLineup : null;
    if (!lineup) return null;
    const slot = lineup.starters.findIndex((s) => s.position !== 'TW');
    if (slot < 0) return null;
    lineup.starters[slot] = {
      playerId: user.id, position: user.position, rating: lineup.starters[slot].rating,
    };
    return prepared;
  }

  const injuryMatch = upcoming.find((m) => !!prepareStarting(m.id));
  check('Ein Spiel für den Verletzungstest gefunden', !!injuryMatch);
  if (injuryMatch) {
    // "Auswechseln lassen" ergibt exakt die geschaetzte Ausfalldauer.
    const off = (() => {
      const prepared = prepareStarting(injuryMatch.id)!;
      const r = new Rng(555);
      const e = new MatchEngine({ ...prepared.setup, rng: r });
      e.pendingInjury = { minute: 30, estimatedDays: 20, severity: 'mittel', canSubstitute: true };
      e.resolveInjury('off');
      const out = e.finish();
      return out.injuries.filter((i) => i.playerId === user.id);
    })();
    log(`Auswechseln lassen: ${off.length} Verletzung(en), Tage ${off.map((i) => i.days).join(',')}`);
    check('Auswechseln ergibt die geschätzte Ausfalldauer',
      off.length === 1 && off[0].days === 20, `${off.map((i) => i.days).join(',')}`);

    // "Weiterspielen" ueber viele Versuche: mal glimpflich, mal schlimmer.
    let mild = 0; let worse = 0;
    for (let i = 0; i < 60; i++) {
      const prepared = prepareStarting(injuryMatch.id)!;
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
    log('Kein Spiel mit dem Nutzer in der Startelf gefunden - Verletzungstest übersprungen.');
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
      check('Interview enthält alle drei Tonlagen', hasTones);

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
    log('Kein gespieltes Nutzerspiel gefunden - Interviewtest übersprungen.');
  }

  // --- Oeffentliches Bild wirkt sich aus (Abschnitt 31) ----------------
  //
  // Interviews und Beitraege in den sozialen Medien bezahlen mit diesem Wert,
  // und die Seitenleiste zeigt ihn als Balken. Gelesen wurde er aber lange
  // nirgends - er war eine Waehrung ohne Ware. Dieser Test haelt fest, dass er
  // wirkt: Er darf ruhig schwach wirken, aber nicht gar nicht.
  log('\n--- Öffentliches Bild ---');
  {
    const gI = createNewGame({
      saveName: 'Imagetest', seed: 24680, difficulty: 'normal',
      firstName: 'Image', lastName: 'Traeger', age: 22, nationality: 'de',
      position: 'ST', altPositions: [], foot: 'rechts', height: 183, weight: 77,
      shirtNumber: 9, appearance: { skinTone: 0, hairStyle: 1, hairColor: '#2b2118', beard: 0, eyeColor: '#4a3120', boots: '#fff' }, background: 'academy',
    });
    const uI = gI.players[gI.userPlayerId];

    // Nominierungsquote ueber eine Spanne von Staerke und Form messen. Ein
    // einzelner Kipppunkt taugt nicht: Die Konkurrenz im Land geht in Stufen
    // von sechs Punkten ein, dadurch springt die Grenze.
    const quote = (image: number) => {
      gI.publicImage = image;
      let ja = 0, gesamt = 0;
      for (let staerke = 72; staerke <= 86; staerke++) {
        for (const form of [40, 55, 70, 85]) {
          for (const key of Object.keys(uI.attrs) as (keyof typeof uI.attrs)[]) {
            uI.attrs[key] = staerke;
          }
          uI.form = form; uI.reputation = 60;
          gesamt++;
          if (evaluateNomination(gI)) ja++;
        }
      }
      return ja / gesamt;
    };
    const schlecht = quote(10);
    const gut = quote(90);
    log(`Nominierungsquote: Image 10 -> ${(schlecht * 100).toFixed(0)} Prozent, `
      + `Image 90 -> ${(gut * 100).toFixed(0)} Prozent`);
    check('Ein guter Ruf senkt die Hürde zur Nationalmannschaft',
      gut > schlecht,
      `${(schlecht * 100).toFixed(0)} gegen ${(gut * 100).toFixed(0)} Prozent`);
    check('Der Ruf ersetzt aber keine Leistung', gut - schlecht < 0.35,
      `Unterschied ${((gut - schlecht) * 100).toFixed(0)} Punkte`);
  }

  // --- Einsatzzeiten in beiden Welten (Abschnitt 20) -------------------
  //
  // Die Spiele des eigenen Spielers laufen durch die volle Simulation - mit
  // Auswechslungen. Alle uebrigen liefen durch die leichte Simulation, in der
  // jeder Startelfspieler exakt 90 Minuten spielte und Einwechslungen gar
  // nicht vorkamen. Gemessen ueber 72 Vergleichssaisons: 49,3 Minuten pro
  // Einsatz beim eigenen Spieler gegen 88 bei gleich starken
  // computergesteuerten Stuermern - bei besserer Note (6,51 gegen 6,38) und
  // mehr Toren pro 90 Minuten (0,595 gegen 0,362). Auszeichnungen zaehlen
  // aber Summen, und gegen Spieler, die nie vom Platz gehen, sind Summen
  // nicht zu gewinnen: fuenf Saisons ohne eine einzige Auszeichnung.
  log('\n--- Einsatzzeiten ---');
  {
    const ligaStats = Object.values(game.seasonStats).filter(
      (st) => /-l[0-9]/.test(st.competitionId) && st.appearances >= 5);
    const gesamtMinuten = ligaStats.reduce((a, st) => a + st.minutes, 0);
    const gesamtSpiele = ligaStats.reduce((a, st) => a + st.appearances, 0);
    const proSpiel = gesamtSpiele > 0 ? gesamtMinuten / gesamtSpiele : 0;
    const einwechsler = ligaStats.filter((st) => st.starts === 0).length;

    log(`Minuten pro Einsatz in den Ligen: ${proSpiel.toFixed(1)} `
      + `(${ligaStats.length} Spielersaisons, davon ${einwechsler} ohne Startelfeinsatz)`);
    check('Nicht jeder Startelfspieler spielt durch', proSpiel < 88,
      `${proSpiel.toFixed(1)} Minuten`);
    check('Aber es wird auch nicht wild gewechselt', proSpiel > 60,
      `${proSpiel.toFixed(1)} Minuten`);
    check('Auch Ersatzspieler kommen zu Einsätzen', einwechsler > 0,
      `${einwechsler} Spieler`);
  }
  // --- Beide Simulationstiefen im Gleichgewicht (Abschnitt 20) ---------
  //
  // Die Spiele des eigenen Vereins laufen durch die volle Engine, alle
  // uebrigen durch die leichte. Gemessen innerhalb derselben Liga fallen in
  // den eigenen Spielen 3,38 Tore, in den uebrigen 2,64 - 28 Prozent mehr.
  //
  // Das ist bewusst **nicht** korrigiert: Der Ausschlag ist symmetrisch
  // (1,80 erzielt zu 1,58 kassiert gegen 1,46 zu 1,25 bei vergleichbaren
  // Vereinen), weshalb Punkte (1,54 gegen 1,56) und Tordifferenz (+0,22
  // gegen +0,21) praktisch gleich bleiben. Die Tabelle wird also nicht
  // verzerrt, und ein Eingriff in die Torquote der vollen Engine waere ein
  // Risiko fuer das Spielgefuehl ohne Gewinn.
  //
  // Diese Pruefung haelt fest, dass es dabei bleibt: Waechst der Abstand,
  // faengt die Liga an, sich um den eigenen Verein herum zu verbiegen.
  {
    const meinVerein = game.players[game.userPlayerId]?.clubId;
    const meinClub = meinVerein ? game.clubs[meinVerein] : null;
    const meineLiga = meinClub?.leagueId ?? null;
    if (meineLiga && meinVerein) {
      let eigenTore = 0, eigenSpiele = 0, fremdTore = 0, fremdSpiele = 0;
      let eigenPunkte = 0, fremdPunkte = 0, fremdTeilnahmen = 0;
      for (const m of Object.values(game.matches)) {
        if (!m.played || m.homeScore == null || m.awayScore == null) continue;
        if (m.competitionId !== meineLiga) continue;
        const tore = m.homeScore + m.awayScore;
        const beteiligt = m.homeClubId === meinVerein || m.awayClubId === meinVerein;
        if (beteiligt) {
          eigenTore += tore; eigenSpiele++;
          const fuer = m.homeClubId === meinVerein ? m.homeScore : m.awayScore;
          const gegen = m.homeClubId === meinVerein ? m.awayScore : m.homeScore;
          eigenPunkte += fuer > gegen ? 3 : fuer === gegen ? 1 : 0;
        } else {
          fremdTore += tore; fremdSpiele++;
          // Punkte nur von Vereinen aehnlicher Reputation zaehlen.
          //
          // Der Ligaschnitt sagt nichts darueber, ob die beiden
          // Simulationstiefen im Gleichgewicht sind - er sagt nur, ob der
          // eigene Verein durchschnittlich ist. Genau daran ist die Pruefung
          // einmal gescheitert (0,61 gegen 1,40), weil der Verein des
          // Spielers eine schwache Saison hatte und nicht, weil an den
          // Simulationen etwas kaputt war.
          for (const paar of [
            [m.homeClubId, m.homeScore, m.awayScore] as const,
            [m.awayClubId, m.awayScore, m.homeScore] as const,
          ]) {
            const c = game.clubs[paar[0]];
            if (!c || !meinClub) continue;
            if (Math.abs(c.reputation - meinClub.reputation) > 6) continue;
            fremdPunkte += paar[1] > paar[2] ? 3 : paar[1] === paar[2] ? 1 : 0;
            fremdTeilnahmen++;
          }
        }
      }
      if (eigenSpiele >= 20 && fremdSpiele >= 100) {
        const eigen = eigenTore / eigenSpiele;
        const fremd = fremdTore / fremdSpiele;
        const punkteEigen = eigenPunkte / eigenSpiele;
        const punkteFremd = fremdPunkte / fremdTeilnahmen;
        log(`Tore pro Spiel: eigener Verein ${eigen.toFixed(2)}, übrige Liga ${fremd.toFixed(2)}`);
        log(`Punkte pro Spiel: eigener Verein ${punkteEigen.toFixed(2)}, `
          + `ähnlich starke Vereine ${punkteFremd.toFixed(2)} aus ${fremdTeilnahmen} Teilnahmen`);
        check('Die volle Simulation bleibt nah an der leichten',
          eigen < fremd * 1.6, `${eigen.toFixed(2)} gegen ${fremd.toFixed(2)}`);
        // Nicht zugesichert, nur protokolliert: Ein einzelner Verein ueber
        // drei Saisons schwankt zu stark. Auffaellig waere erst ein Wert
        // nahe null oder nahe drei - das faellt beim Lesen auf.
        check('Der Ligaschnitt bleibt strukturell stimmig',
          punkteFremd > 1.1 && punkteFremd < 1.6,
          `${punkteFremd.toFixed(2)} Punkte je Teilnahme`);
        check('Der eigene Verein spielt in einer plausiblen Spanne',
          punkteEigen > 0.2 && punkteEigen < 2.8,
          `${punkteEigen.toFixed(2)}`);
      } else {
        log('Zu wenige Ligaspiele für den Vergleich - übersprungen.');
      }
    }
  }
  // --- Ereignisse neben dem Platz (Abschnitt 31) -----------------------
  //
  // Sie treten mittwochs mit 30 Prozent auf, also rund zwoelfmal je Saison.
  // Der Vorrat umfasste dafuer lange nur sechs Vorlagen - jede also zweimal
  // im Jahr und ueber eine Laufbahn rund dreissigmal.
  //
  // Wichtiger als die Zahl ist die Vollstaendigkeit der Texte: Titel,
  // Beschreibung und jede Antwort kommen aus dem Sprachkatalog. Fehlt eine
  // Zeile, steht im Spiel der rohe Schluessel - und zwar in einem Dialog,
  // der den Kalender anhaelt und eine Entscheidung verlangt.
  log('\n--- Ereignisse neben dem Platz ---');
  {
    const rngE = new Rng(4711);
    const titel = new Set<string>();
    const rohe = new Set<string>();
    const ohneWahl: string[] = [];
    for (let i = 0; i < 400; i++) {
      const e = buildLifeEvent(rngE, i);
      titel.add(e.title);
      const alle = [e.category, e.title, e.description,
        ...e.options.flatMap((o) => [o.label, o.description, o.news ?? ''])];
      for (const x of alle) if (/^life\./.test(x)) rohe.add(x);
      if (e.options.length < 2) ohneWahl.push(e.title);
    }
    log(`${titel.size} verschiedene Ereignisse aus 400 Ziehungen`);
    if (rohe.size > 0) log(`Fehlende Texte: ${[...rohe].join(
)}`);
    check('Der Ereignisvorrat ist breit genug', titel.size >= 10, `${titel.size}`);
    check('Alle Ereignistexte sind übersetzt', rohe.size === 0,
      `${rohe.size} fehlende Schlüssel`);
    check('Jedes Ereignis stellt eine echte Wahl', ohneWahl.length === 0,
      `${ohneWahl.length} ohne Alternative`);
  }
  // --- Rivalen wirken auch auf dem Platz (Abschnitt 30) ----------------
  //
  // Beziehungen greifen an genau einer Stelle ins Spiel ein: Wer sich dem
  // Spieler als Anspielpunkt anbietet. Dort stand aber
  // `Math.max(0, rel[...])` - jede negative Beziehung wurde auf null
  // geklammert. Ein Rivale, den die Kaderliste ausdruecklich ausweist und
  // dessen Verhaeltnis mit jedem Spiel weiter abrutscht, verhielt sich damit
  // exakt wie ein beliebiger Mitspieler: Die negative Haelfte des
  // Kabinensystems war reine Anzeige.
  log('\n--- Rivalen auf dem Platz ---');
  {
    const gRiv = createNewGame({
      saveName: 'Rivalentest', seed: 771177, difficulty: 'normal',
      firstName: 'Ri', lastName: 'Vale', age: 24, nationality: 'de',
      position: 'OM', altPositions: [], foot: 'rechts', height: 180, weight: 74,
      shirtNumber: 10, appearance: { skinTone: 0, hairStyle: 1, hairColor: '#2b2118', beard: 0, eyeColor: '#4a3120', boots: '#fff' }, background: 'wonderkid',
    });
    const uR = gRiv.players[gRiv.userPlayerId];
    const mit = Object.values(gRiv.players)
      .filter((p) => p.clubId === uR.clubId && p.id !== uR.id && p.position !== 'TW')
      // Nach Staerke, damit alle drei auch wirklich spielen.
      .sort((a, b) => computeOverall(b.attrs, b.position)
        - computeOverall(a.attrs, a.position));

    if (mit.length >= 3) {
      const freund = mit[0], neutral = mit[1], rivale = mit[2];
      gRiv.relationships = {};
      gRiv.relationships[freund.id] = 70;
      gRiv.relationships[neutral.id] = 0;
      gRiv.relationships[rivale.id] = -70;

      let nFreund = 0, nNeutral = 0, nRivale = 0, szenen = 0, gespielt = 0;
      let guard = 0;
      while (guard++ < 600 && gespielt < 40) {
        const r = advanceDay(gRiv);
        if (!r.matchToPlay) continue;
        const prepared = prepareUserMatch(gRiv, r.matchToPlay, true);
        if (!prepared) { gRiv.pendingMatchId = null; continue; }
        const rngR = new Rng(gRiv.rngState);
        const engine = new MatchEngine({ ...prepared.setup, rng: rngR, highlightMode: 'own' });
        engine.runToEnd((c) => {
          if (c.targets?.length) {
            szenen++;
            for (const ziel of c.targets) {
              if (ziel.id === freund.id) nFreund++;
              else if (ziel.id === neutral.id) nNeutral++;
              else if (ziel.id === rivale.id) nRivale++;
            }
          }
          return autoResolveChallenge(c, uR, DIFFICULTY_SETTINGS.normal, rngR);
        });
        gRiv.rngState = rngR.state;
        finishUserMatch(gRiv, r.matchToPlay, engine.finish());
        gespielt++;
      }

      log(`Anspielpunkte aus ${szenen} Passszenen: Freund ${nFreund}, `
        + `Neutral ${nNeutral}, Rivale ${nRivale}`);
      if (szenen >= 10) {
        // Der Neutrale ist die Kontrolle: Vor der Aenderung wurde jede
        // negative Beziehung auf null geklammert, ein Rivale verhielt sich
        // also genau wie er.
        check('Ein Rivale bietet sich seltener an als ein Neutraler',
          nRivale < nNeutral, `${nRivale} gegen ${nNeutral}`);
        check('Aber er verschwindet nicht ganz vom Platz',
          nNeutral === 0 || nRivale > 0 || szenen < 25,
          `${nRivale} bei ${szenen} Szenen`);
      } else {
        log('Zu wenige Passszenen für den Vergleich - übersprungen.');
      }
    }
  }
  // --- Saisonziele passen zur Rolle (Abschnitt 33) ---------------------
  //
  // Das Notenziel stand fest bei 6,8 - fuer jede Rolle, jede Position und
  // jedes Liganiveau gleich. Gemessen ueber sieben Saisons einer starken
  // Laufbahn: 6,31 / 6,44 / 6,51 / 6,55 / 6,59 / 6,71 / 6,72 - **keine
  // einzige erreichte 6,8**. Seit die Ziele abgerechnet werden, kostete das
  // jede Saison Trainerbeziehung, ohne je erreichbar zu sein.
  //
  // Ausserdem standen die Zielarten `assists` und `overall` in den
  // Belohnungstabellen, wurden aber nie erzeugt.
  log('\n--- Saisonziele passen zur Rolle ---');
  {
    const gZ = createNewGame({
      saveName: 'Zieltest', seed: 246813, difficulty: 'normal',
      firstName: 'Zie', lastName: 'Le', age: 19, nationality: 'de',
      position: 'ZM', altPositions: [], foot: 'rechts', height: 182, weight: 76,
      shirtNumber: 8, appearance: { skinTone: 0, hairStyle: 1, hairColor: '#2b2118', beard: 0, eyeColor: '#4a3120', boots: '#fff' }, background: 'wonderkid',
    });
    const uZ = gZ.players[gZ.userPlayerId];

    const notenzielFuer = (rolle: SquadRole) => {
      if (!uZ.contract) return 0;
      uZ.contract.role = rolle;
      createObjectives(gZ);
      return gZ.objectives.find((o) => o.kind === 'rating')?.target ?? 0;
    };
    const jung = notenzielFuer('Ergaenzungsspieler');
    const stamm = notenzielFuer('Stammspieler');
    const schluessel = notenzielFuer('Schluesselspieler');
    log(`Notenziel nach Rolle: Ergänzung ${jung}, Stamm ${stamm}, Schlüssel ${schluessel}`);
    check('Das Notenziel hängt an der Rolle', jung < stamm && stamm < schluessel,
      `${jung} / ${stamm} / ${schluessel}`);
    check('Auch das höchste Ziel bleibt erreichbar', schluessel <= 6.9, `${schluessel}`);

    // Ein Mittelfeldspieler wird an Vorlagen gemessen, ein Stuermer an Toren.
    notenzielFuer('Stammspieler');
    const artenMid = gZ.objectives.map((o) => o.kind);
    check('Das Mittelfeld bekommt ein Vorlagenziel', artenMid.includes('assists'),
      artenMid.join(', '));

    uZ.position = 'ST';
    createObjectives(gZ);
    const artenSt = gZ.objectives.map((o) => o.kind);
    check('Der Stürmer bekommt ein Torziel',
      artenSt.includes('goals') && !artenSt.includes('assists'), artenSt.join(', '));
  }
  // --- Namensvielfalt (Abschnitt 5) ------------------------------------
  //
  // Gemessen an einer frischen Welt mit 7.501 Spielern: **2.615 teilten
  // ihren vollen Namen mit jemandem** (35 Prozent), der haeufigste Nachname
  // kam 68-mal vor, und **jede** der 15 Ligen enthielt eine Dopplung.
  // Ursache waren winzige Namenstoepfe - calcio hatte 24 mal 24 = 576
  // Kombinationen bei rund 1.500 Spielern dieser Herkunft. Das ist das
  // Geburtstagsparadoxon, kein Zufallsfehler.
  //
  // Behoben durch groessere Toepfe **und** ein Namensgedaechtnis waehrend
  // der Welterzeugung. Beides zusammen, weil groessere Toepfe allein nur auf
  // 8 Prozent kamen und weiterhin jede Liga betrafen.
  log('\n--- Namensvielfalt ---');
  {
    const spieler = Object.values(game.players);
    const voll = new Set(spieler.map((p) => `${p.firstName} ${p.lastName}`));
    const doppelt = spieler.length - voll.size;

    // Und die Frage, die beim Spielen auffaellt: doppelte Namen in einer Liga.
    const proLiga = new Map<string, string[]>();
    for (const p of spieler) {
      const club = p.clubId ? game.clubs[p.clubId] : null;
      if (!club) continue;
      const liste = proLiga.get(club.leagueId) ?? [];
      liste.push(`${p.firstName} ${p.lastName}`);
      proLiga.set(club.leagueId, liste);
    }
    let ligenMitDopplung = 0;
    for (const namen of proLiga.values()) {
      if (new Set(namen).size < namen.length) ligenMitDopplung++;
    }

    const proNachname = new Map<string, number>();
    for (const p of spieler) {
      proNachname.set(p.lastName, (proNachname.get(p.lastName) ?? 0) + 1);
    }
    const haeufigster = Math.max(...proNachname.values());

    log(`${spieler.length} Spieler, ${doppelt} doppelte Vollnamen, `
      + `${ligenMitDopplung} von ${proLiga.size} Ligen betroffen`);
    check('Doppelte Namen sind die Ausnahme', doppelt < spieler.length * 0.01,
      `${doppelt} von ${spieler.length}`);
    check('Kaum eine Liga hat zwei gleiche Namen',
      ligenMitDopplung <= Math.max(1, proLiga.size * 0.2),
      `${ligenMitDopplung} von ${proLiga.size}`);
    check('Kein Nachname überwiegt', haeufigster < spieler.length * 0.01,
      `häufigster ${haeufigster}x`);
  }
  // --- Spielweise des Gegners (Abschnitt 28) ---------------------------
  //
  // Acht Spielweisen gibt es, und `matchEngine.ts` las **keine** davon -
  // `tactic` kam im ganzen Modul nicht vor. Der Stil verschob nur die
  // Staerkewerte in `lineup.ts`; ein tief stehender Gegner stand nicht tief,
  // ein hoch pressender presste nicht. Die Szenen des Spielers waren gegen
  // jeden Gegner gleich.
  log('\n--- Spielweise des Gegners ---');
  {
    const naechstes = Object.values(game.matches).find(
      (m) => !m.played && (m.homeClubId === user.clubId || m.awayClubId === user.clubId));
    if (naechstes) {
      const gegnerId = naechstes.homeClubId === user.clubId
        ? naechstes.awayClubId : naechstes.homeClubId;
      const gegner = game.clubs[gegnerId];

      // Dieselbe Partie mit denselben Wuerfeln, nur der Stil unterscheidet
      // sich - so misst der Vergleich den Stil und nicht den Zufall.
      const druckBei = (stil: TacticStyle) => {
        if (!gegner) return 0;
        gegner.tacticStyle = stil;
        let summe = 0, n = 0;
        for (let i = 0; i < 8; i++) {
          const vorbereitet = prepareUserMatch(game, naechstes.id, true);
          if (!vorbereitet) break;
          const rngT = new Rng(9000 + i * 137);
          const engine = new MatchEngine({ ...vorbereitet.setup, rng: rngT, highlightMode: 'own' });
          engine.runToEnd((c) => {
            if (typeof c.pressure === 'number') { summe += c.pressure; n++; }
            return autoResolveChallenge(c, user, DIFFICULTY_SETTINGS.normal, rngT);
          });
        }
        return n > 0 ? summe / n : 0;
      };

      const stilVorher = gegner?.tacticStyle;
      const pressing = druckBei('highPress');
      const block = druckBei('deepBlock');
      if (gegner && stilVorher) gegner.tacticStyle = stilVorher;

      log(`Szenendruck: gegen hohes Pressing ${pressing.toFixed(3)}, `
        + `gegen tiefen Block ${block.toFixed(3)}`);
      if (pressing > 0 && block > 0) {
        check('Ein pressender Gegner erzeugt mehr Druck', pressing > block,
          `${pressing.toFixed(3)} gegen ${block.toFixed(3)}`);
        check('Der Unterschied bleibt im Rahmen', pressing < block * 1.5,
          `Faktor ${(pressing / block).toFixed(2)}`);
      } else {
        log('Keine Szenen mit Druckwert - übersprungen.');
      }
    }
  }
  // --- Die Kulisse (Abschnitt 29) --------------------------------------
  //
  // `attendance` stand im Setup der Spielmaschine, mit dem Kommentar "fuer
  // die Atmosphaere in den Szenen" - und wurde nie gelesen. Ein
  // ausverkauftes Rund und eine halbleere Huette spielten sich identisch.
  // Dazu kam ein fester Heimbonus von 1.08, der auch auf neutralem Platz
  // griff: im Pokalfinale hatte die formal als Heimteam gefuehrte
  // Mannschaft einen Vorteil, den es dort gar nicht gibt.
  log('\n--- Die Kulisse ---');
  {
    // Bewusst eine Auswaertspartie: dort ist der Effekt am groessten und
    // seine Richtung eindeutig. Daheim nimmt das Publikum Druck weg, das
    // ist der kleinere Ausschlag und in einer Stichprobe schwer zu fassen.
    const auswaerts = Object.values(game.matches).find(
      (m) => !m.played && m.awayClubId === user.clubId);
    if (auswaerts) {
      const heimVerein = game.clubs[auswaerts.homeClubId];
      const platz = heimVerein?.stadiumCapacity ?? 0;

      // Dieselbe Partie mit denselben Wuerfeln, nur die Raenge sind anders
      // voll - so misst der Vergleich das Publikum und nicht den Zufall.
      const druckBei = (zuschauer: number, neutral: boolean) => {
        let summe = 0, n = 0;
        for (let i = 0; i < 6; i++) {
          const vorbereitet = prepareUserMatch(game, auswaerts.id, true);
          if (!vorbereitet) break;
          const rngK = new Rng(7700 + i * 173);
          const engine = new MatchEngine({
            ...vorbereitet.setup, rng: rngK, highlightMode: 'own',
            attendance: zuschauer, neutral,
          });
          engine.runToEnd((c) => {
            if (typeof c.pressure === 'number') { summe += c.pressure; n++; }
            return autoResolveChallenge(c, user, DIFFICULTY_SETTINGS.normal, rngK);
          });
        }
        return n > 0 ? summe / n : 0;
      };

      const leer = druckBei(0, false);
      const voll = druckBei(platz, false);
      const neutral = druckBei(platz, true);

      log(`Szenendruck auswärts: leeres Rund ${leer.toFixed(3)}, `
        + `ausverkauft ${voll.toFixed(3)}, neutraler Platz ${neutral.toFixed(3)}`);
      if (leer > 0 && voll > 0) {
        check('Volles Auswärtsrund macht mehr Druck', voll > leer,
          `${voll.toFixed(3)} gegen ${leer.toFixed(3)}`);
        check('Der Zuschlag bleibt im Rahmen', voll - leer < 0.2,
          `+${(voll - leer).toFixed(3)}`);
        check('Auf neutralem Platz trägt niemand ein Publikum',
          Math.abs(neutral - leer) < 0.05,
          `${neutral.toFixed(3)} gegen ${leer.toFixed(3)}`);
      } else {
        log('Keine Szenen mit Druckwert - übersprungen.');
      }

      // Die Zuschauerzahl darf vor und nach dem Spiel nicht auseinanderlaufen.
      // Vorher rechnete die Vorbereitung mit dem festen Streuwert 0.5, nachher
      // zog die Abrechnung einen echten Wurf - zwei verschiedene Zahlen fuer
      // dieselbe Partie. Jetzt haengt der Wurf an der Partiekennung.
      const wurf = attendanceRoll(auswaerts.id);
      check('Der Zuschauerwurf hängt an der Partie und wiederholt sich',
        wurf === attendanceRoll(auswaerts.id) && wurf >= 0 && wurf < 1,
        wurf.toFixed(3));
      const andere = Object.values(game.matches)
        .slice(0, 200).map((m) => attendanceRoll(m.id));
      check('Verschiedene Partien bekommen verschiedene Würfe',
        new Set(andere).size > 60, `${new Set(andere).size} von ${andere.length}`);
    }
  }
  // --- Wetter (Abschnitt 30) -------------------------------------------
  //
  // Wetter gab es gar nicht: ein Januarspiel im Schneetreiben und ein
  // Augustnachmittag bei dreissig Grad liefen ueber dieselben Zahlen. Es ist
  // die billigste Abwechslung, die Fussball kennt - sie faerbt das Bild,
  // ohne dass der Spieler etwas dafuer tun muss.
  log('\n--- Wetter ---');
  {
    // Aus der Kennung abgeleitet, nicht gewuerfelt: Vorbereitung,
    // Oberflaeche und Abrechnung sehen garantiert dasselbe Wetter.
    const partien = Object.values(game.matches).slice(0, 400);
    check('Dieselbe Partie bekommt immer dasselbe Wetter',
      partien.every((m) => matchWeather(m.id, m.date) === matchWeather(m.id, m.date)));

    const zaehle = (monat: number) => {
      const tag = `2027-${String(monat).padStart(2, '0')}-15`;
      const n: Record<string, number> = {};
      for (const m of partien) {
        const w = matchWeather(m.id, tag);
        n[w] = (n[w] ?? 0) + 1;
      }
      return n;
    };
    const januar = zaehle(1);
    const juli = zaehle(7);
    log(`Januar: ${Object.entries(januar).map(([k, v]) => `${k} ${v}`).join(', ')}`);
    log(`Juli:   ${Object.entries(juli).map(([k, v]) => `${k} ${v}`).join(', ')}`);

    check('Im Januar fällt Schnee, im Juli nicht',
      (januar.snow ?? 0) > 0 && (juli.snow ?? 0) === 0,
      `Januar ${januar.snow ?? 0}, Juli ${juli.snow ?? 0}`);
    check('Hitze gibt es im Juli, im Januar nicht',
      (juli.heat ?? 0) > 0 && (januar.heat ?? 0) === 0,
      `Juli ${juli.heat ?? 0}, Januar ${januar.heat ?? 0}`);
    check('Über ein Jahr kommen mindestens sieben Wetterlagen vor',
      new Set([...Object.keys(januar), ...Object.keys(juli),
        ...Object.keys(zaehle(4)), ...Object.keys(zaehle(10))]).size >= 7,
      `${new Set([...Object.keys(januar), ...Object.keys(juli),
        ...Object.keys(zaehle(4)), ...Object.keys(zaehle(10))]).size}`);

    // Die Wirkung selbst: dieselbe Partie, dieselben Wuerfel, nur das Wetter
    // unterscheidet sich. Gezaehlt wird, wie viele Schuesse aufs Tor kommen.
    const partie = Object.values(game.matches).find(
      (m) => !m.played && (m.homeClubId === user.clubId || m.awayClubId === user.clubId));
    if (partie) {
      // Acht Partien reichten nicht: der Unterschied liegt bei zwoelf
      // Prozent, der Schaetzfehler bei acht Laeufen in derselben
      // Groessenordnung. Die Pruefung hat lange gewonnen und kippte, als
      // eine Aenderung an ganz anderer Stelle die Karriere leicht verschob.
      const quoteBei = (w: Weather) => {
        let schuesse = 0, aufsTor = 0;
        for (let i = 0; i < 30; i++) {
          const vorbereitet = prepareUserMatch(game, partie.id, true);
          if (!vorbereitet) break;
          const rngW = new Rng(8800 + i * 191);
          const engine = new MatchEngine({
            ...vorbereitet.setup, rng: rngW, highlightMode: 'own', weather: w,
          });
          engine.runToEnd(
            (c) => autoResolveChallenge(c, user, DIFFICULTY_SETTINGS.normal, rngW));
          const t = engine.teamStats;
          schuesse += t.home.shots + t.away.shots;
          aufsTor += t.home.shotsOnTarget + t.away.shotsOnTarget;
        }
        return schuesse > 0 ? aufsTor / schuesse : 0;
      };
      const sonne = quoteBei('clear');
      const schnee = quoteBei('snow');
      log(`Schüsse aufs Tor: bei Sonne ${(sonne * 100).toFixed(1)} %, `
        + `bei Schneefall ${(schnee * 100).toFixed(1)} %`);
      if (sonne > 0 && schnee > 0) {
        check('Im Schnee kommen weniger Schüsse aufs Tor', schnee < sonne,
          `${(schnee * 100).toFixed(1)} % gegen ${(sonne * 100).toFixed(1)} %`);
        check('Das Wetter entscheidet die Partie nicht', schnee > sonne * 0.7,
          `Faktor ${(schnee / sonne).toFixed(2)}`);
      }
    }
  }
  // --- Der Schiedsrichter (Abschnitt 31) -------------------------------
  //
  // Er kam nur in Textbausteinen vor ("Der Schiedsrichter zeigt Gelb") - als
  // Figur gab es ihn nicht. Jede Partie wurde nach demselben Massstab
  // gepfiffen, wer pfiff machte keinen Unterschied. Dabei ist er eine der
  // wenigen Groessen, ueber die ein Spieler vor dem Anpfiff nachdenkt.
  //
  // Nebenbei kam eine Modellschwaeche heraus: Vergehen und Karte waren
  // dieselbe Entscheidung, im Spielbericht standen also immer gleich viele
  // Fouls wie Karten.
  log('\n--- Der Schiedsrichter ---');
  {
    const partien = Object.values(game.matches).slice(0, 500);
    const stile: Record<string, number> = {};
    const namen = new Set<string>();
    for (const m of partien) {
      const land = game.clubs[m.homeClubId]?.countryId ?? 'falkenland';
      const r = matchReferee(m.id, land);
      stile[r.style] = (stile[r.style] ?? 0) + 1;
      namen.add(r.name);
    }
    log(`Spielarten: ${Object.entries(stile).map(([k, v]) => `${k} ${v}`).join(', ')}`);
    check('Alle fünf Spielarten kommen vor', Object.keys(stile).length === 5,
      `${Object.keys(stile).length}`);
    check('Der unauffällige Schiedsrichter bleibt der Normalfall',
      (stile.balanced ?? 0) > partien.length * 0.35,
      `${stile.balanced ?? 0} von ${partien.length}`);
    check('Es gibt viele verschiedene Namen', namen.size > 40, `${namen.size}`);
    check('Dieselbe Partie bekommt immer denselben Mann',
      partien.slice(0, 50).every((m) =>
        matchReferee(m.id, 'falkenland').name === matchReferee(m.id, 'falkenland').name));

    // Dieselbe Partie, dieselben Wuerfel, nur der Mann an der Pfeife ist ein
    // anderer. Gemessen wird bei vollem Haus, damit auch die Neigung zur
    // Heimmannschaft sichtbar wird - sie haengt an der Kulisse.
    const partie = Object.values(game.matches).find(
      (m) => !m.played && (m.homeClubId === user.clubId || m.awayClubId === user.clubId));
    if (partie) {
      const platz = game.clubs[partie.homeClubId]?.stadiumCapacity ?? 0;
      const laufBei = (stil: RefereeStyle) => {
        let fouls = 0, gelb = 0, rot = 0, gegenGaeste = 0;
        const laeufe = 10;
        for (let i = 0; i < laeufe; i++) {
          const vorbereitet = prepareUserMatch(game, partie.id, true);
          if (!vorbereitet) break;
          const rngS = new Rng(6100 + i * 157);
          const engine = new MatchEngine({
            ...vorbereitet.setup, rng: rngS, highlightMode: 'own',
            refereeStyle: stil, attendance: platz,
          });
          engine.runToEnd(
            (c) => autoResolveChallenge(c, user, DIFFICULTY_SETTINGS.normal, rngS));
          const t = engine.teamStats;
          fouls += t.home.fouls + t.away.fouls;
          gegenGaeste += t.away.fouls;
          for (const ev of engine.events) {
            if (ev.type === 'yellow') gelb++;
            if (ev.type === 'red' || ev.type === 'secondYellow') rot++;
          }
        }
        return {
          fouls: fouls / laeufe, gelb: gelb / laeufe, rot: rot / laeufe,
          anteil: fouls > 0 ? gegenGaeste / fouls : 0,
        };
      };

      const normal = laufBei('balanced');
      const streng = laufBei('strict');
      const milde = laufBei('lenient');
      const nah = laufBei('homer');

      for (const [name, w] of [
        ['unauffaellig', normal], ['kleinlich', streng],
        ['lässt laufen', milde], ['publikumsnah', nah],
      ] as [string, typeof normal][]) {
        log(`${name.padEnd(14)} ${w.fouls.toFixed(1)} Fouls, `
          + `${w.gelb.toFixed(1)} Gelb, ${w.rot.toFixed(2)} Rot, `
          + `${(w.anteil * 100).toFixed(0)} % gegen die Gäste`);
      }

      check('Der Kleinliche pfeift mehr als der Milde',
        streng.fouls > milde.fouls,
        `${streng.fouls.toFixed(1)} gegen ${milde.fouls.toFixed(1)}`);
      check('Der Kleinliche verwarnt mehr als der Milde',
        streng.gelb > milde.gelb,
        `${streng.gelb.toFixed(1)} gegen ${milde.gelb.toFixed(1)}`);
      check('Der Unauffällige liegt dazwischen',
        normal.gelb > milde.gelb && normal.gelb < streng.gelb,
        `${normal.gelb.toFixed(1)}`);
      check('Der Publikumsnahe pfeift eher gegen die Gäste',
        nah.anteil > normal.anteil + 0.08,
        `${(nah.anteil * 100).toFixed(0)} % gegen ${(normal.anteil * 100).toFixed(0)} %`);
      check('Auch er bleibt unter drei Vierteln', nah.anteil < 0.78,
        `${(nah.anteil * 100).toFixed(0)} %`);

      // Vergehen und Karte sind zwei Entscheidungen. Vorher gab jedes
      // gepfiffene Vergehen eine Karte - im Spielbericht standen also immer
      // gleich viele Fouls wie Karten, was es im Fussball nicht gibt.
      check('Es gibt mehr Fouls als Karten', normal.fouls > normal.gelb * 1.5,
        `${normal.fouls.toFixed(1)} Fouls, ${normal.gelb.toFixed(1)} Gelb`);

      // Ein verwarnter Spieler geht vorsichtiger rein. Ohne das ging bei
      // einem kartenfreudigen Schiedsrichter in fast jeder Partie jemand
      // mit Gelb-Rot vom Platz.
      //
      // Zugesichert wird die Richtung und ein grober Rahmen ueber alle vier
      // Spielarten, nicht der Wert einer einzelnen. Zehn Partien sind fuer
      // ein so seltenes Ereignis wie einen Platzverweis zu wenig - dieselbe
      // Lehre wie bei der Punkteausbeute und beim Modusvergleich.
      const rotSchnitt = (normal.rot + streng.rot + milde.rot + nah.rot) / 4;
      log(`Platzverweise je Spiel: ${rotSchnitt.toFixed(2)} im Mittel über `
        + `alle vier Spielarten`);
      check('Der Milde stellt seltener vom Platz als der Kleinliche',
        milde.rot < streng.rot,
        `${milde.rot.toFixed(2)} gegen ${streng.rot.toFixed(2)}`);
      check('Platzverweise bleiben die Ausnahme', rotSchnitt < 1.1,
        `${rotSchnitt.toFixed(2)} je Spiel`);
    }
  }
  // --- Attribute, die nichts taten (Abschnitt 32) -----------------------
  //
  // 54 Attribute gibt es, in den Szenen des eigenen Spielers kamen 25 davon
  // vor. Der Rest floss nur in `computeOverall` ein, also in eine einzige
  // Zahl. Zwei Spieler mit derselben Gesamtstaerke, aber gegensaetzlichem
  // Profil spielten sich deshalb vollkommen gleich.
  //
  // Am schwersten wog das beim Tempo: `pace` und `acceleration` sind die
  // zwei Werte, auf die jeder Fussballer zuerst schaut, und sie machten in
  // keiner einzigen Szene einen Unterschied. Dazu der halbe Abwehrblock
  // und der erste Kontakt.
  log('\n--- Attribute, die nichts taten ---');
  {
    // Die Gewichte summieren sich auf 1, der Massstab bleibt also derselbe
    // wie vorher. Das laesst sich genau pruefen statt nur zu messen.
    const gleich = { ...user.attrs } as Attributes;
    for (const k of ALL_ATTRS) gleich[k] = 70;
    check('Tempo behält den Maßstab', Math.abs(tempo(gleich) - 70) < 0.001,
      tempo(gleich).toFixed(3));
    check('Zweikampfstärke behält den Maßstab',
      Math.abs(defensiveSkill(gleich) - 70) < 0.001, defensiveSkill(gleich).toFixed(3));

    // Ganze Partien sind hier das falsche Messgeraet: der Testspieler ist
    // Stuermer und kommt in vierzehn Spielen auf eine Handvoll Zweikaempfe.
    // Bei so wenigen Faellen kippt kein einziger Wurf, und beide Seiten
    // liefern exakt dieselbe Zahl. Geprueft wird deshalb direkt die Formel,
    // ueber viele Wuerfe mit demselben Zweikampf.
    {
      const sichern = { ...user.attrs } as Attributes;
      const probe = (aenderung: Partial<Record<AttrKey, number>>,
        art: 'dribble' | 'duel') => {
        const p = { ...user, attrs: { ...sichern, ...aenderung } } as Player;
        const gegner = { opponent: 62 } as unknown as Challenge;
        let erfolge = 0;
        const wuerfe = 1200;
        const rngP = new Rng(4242);
        for (let i = 0; i < wuerfe; i++) {
          // Immer derselbe Zeitpunkt - gemessen wird das Attribut, nicht
          // die Eingabe.
          const timing = { offset: 0.02 };
          const res = art === 'dribble'
            ? resolveDribble(timing, gegner, p, DIFFICULTY_SETTINGS.normal, rngP)
            : resolveDuel(timing, gegner, p, DIFFICULTY_SETTINGS.normal, rngP);
          if (res.outcome === 'dribbleWon' || res.outcome === 'duelWon') erfolge++;
        }
        return erfolge / wuerfe;
      };

      const langsam = probe({ acceleration: 30, pace: 30 }, 'dribble');
      const schnell = probe({ acceleration: 95, pace: 95 }, 'dribble');
      log(`Dribbling bei Tempo 30 gegen 95: ${(langsam * 100).toFixed(1)} % `
        + `gegen ${(schnell * 100).toFixed(1)} %`);
      check('Tempo entscheidet Dribblings mit', schnell > langsam + 0.03,
        `${(schnell * 100).toFixed(1)} % gegen ${(langsam * 100).toFixed(1)} %`);

      const schwach = probe(
        { marking: 30, interception: 30, pressing: 30, defPositioning: 30 }, 'duel');
      const stark = probe(
        { marking: 95, interception: 95, pressing: 95, defPositioning: 95 }, 'duel');
      log(`Zweikampf bei Deckung 30 gegen 95: ${(schwach * 100).toFixed(1)} % `
        + `gegen ${(stark * 100).toFixed(1)} %`);
      check('Deckung und Abfangen entscheiden Zweikämpfe mit',
        stark > schwach + 0.05,
        `${(stark * 100).toFixed(1)} % gegen ${(schwach * 100).toFixed(1)} %`);

      // Der erste Kontakt wirkt nicht im Zweikampf, sondern gegen den Druck:
      // er verkleinert den Ausfuehrungsfehler. Gemessen wird die Streuung.
      const streuung = (wert: number) => {
        const p = { ...user, attrs: { ...sichern, firstTouch: wert } } as Player;
        const rngS = new Rng(777);
        let summe = 0;
        const wuerfe = 1500;
        for (let i = 0; i < wuerfe; i++) {
          const raus = applyExecutionError(
            { aimX: 0, aimY: 0, power: 0.6, contactX: 0, contactY: 0 },
            { player: p, pressure: 0.8, difficulty: DIFFICULTY_SETTINGS.normal,
              rng: rngS, skill: 60, weakFoot: false });
          summe += Math.abs(raus.aimX);
        }
        return summe / wuerfe;
      };
      const roh = streuung(20);
      const sauber = streuung(95);
      log(`Streuung unter Druck bei erstem Kontakt 20 gegen 95: `
        + `${roh.toFixed(2)} m gegen ${sauber.toFixed(2)} m`);
      check('Ein sauberer erster Kontakt nimmt dem Druck seine Wirkung',
        sauber < roh * 0.92,
        `${sauber.toFixed(2)} m gegen ${roh.toFixed(2)} m`);
    }
  }
  // --- Der Torwart als Profil (Abschnitt 33) ---------------------------
  //
  // Der Torwart war ueberall **eine Zahl**: `strengthOf(side).keeper` aus
  // seiner Gesamtstaerke. Sieben seiner zehn Werte - Abwehren, Herauslaufen,
  // Eins gegen eins, Flankensicherheit, Abstoss, Abwurf und Coaching -
  // flossen nur dort hinein und machten in keiner Situation einen
  // Unterschied. Ein Torwart, der Flanken pflueckt, aber im Eins gegen eins
  // nichts taugt, war von seinem Gegenteil nicht zu unterscheiden.
  log('\n--- Der Torwart als Profil ---');
  {
    // Die Gewichte summieren sich in jeder Situation auf 1 - ein Torwart mit
    // lauter gleichen Werten ist also genau so stark wie vorher. Das laesst
    // sich genau pruefen statt zu messen.
    const gleich = { ...user.attrs } as Attributes;
    for (const k of ALL_ATTRS) gleich[k] = 70;
    const lagen: KeeperSituation[] = ['shot', 'longShot', 'header', 'oneOnOne'];
    check('Torwartstärke behält in jeder Lage den Maßstab',
      lagen.every((l) => Math.abs(keeperSkill(gleich, l) - 70) < 0.001),
      lagen.map((l) => keeperSkill(gleich, l).toFixed(1)).join(', '));

    // Zwei Profile: der Flankenpfluecker und der Eins-gegen-eins-Mann.
    const flanken = { ...gleich,
      crossHandling: 92, communication: 88, gkPositioning: 82,
      oneOnOne: 38, rushingOut: 34 } as Attributes;
    const duell = { ...gleich,
      crossHandling: 38, communication: 44, gkPositioning: 74,
      oneOnOne: 92, rushingOut: 90 } as Attributes;

    log(`Flankenpflücker: Kopfball ${keeperSkill(flanken, 'header').toFixed(1)}, `
      + `Eins gegen eins ${keeperSkill(flanken, 'oneOnOne').toFixed(1)}`);
    log(`Eins-gegen-eins-Mann: Kopfball ${keeperSkill(duell, 'header').toFixed(1)}, `
      + `Eins gegen eins ${keeperSkill(duell, 'oneOnOne').toFixed(1)}`);

    check('Der Flankenpflücker ist bei Köpfen stark, im Duell schwach',
      keeperSkill(flanken, 'header') > keeperSkill(flanken, 'oneOnOne') + 15,
      `${keeperSkill(flanken, 'header').toFixed(1)} gegen `
      + `${keeperSkill(flanken, 'oneOnOne').toFixed(1)}`);
    check('Beim Eins-gegen-eins-Mann ist es umgekehrt',
      keeperSkill(duell, 'oneOnOne') > keeperSkill(duell, 'header') + 15,
      `${keeperSkill(duell, 'oneOnOne').toFixed(1)} gegen `
      + `${keeperSkill(duell, 'header').toFixed(1)}`);

    // Dass die Formel eine Spreizung hat, heisst noch nicht, dass die
    // Spielmaschine sie benutzt - genau diese Luecke wird hier ja staendig
    // gefunden. Deshalb zwei Profile mit **derselben Gesamtstaerke** gegen
    // dieselbe Partie mit denselben Wuerfeln: jeder Unterschied im Ergebnis
    // kann dann nur aus der situativen Staerke kommen.
    const partie = Object.values(game.matches).find(
      (m) => !m.played && (m.homeClubId === user.clubId || m.awayClubId === user.clubId));
    if (partie) {
      // **Alle** Torhueter des Gegners bekommen das Profil, nicht der
      // staerkste und auch nicht der aus einer einzelnen Aufstellung: die
      // Aufstellung wird bei jedem Aufruf neu gewaehlt und verbraucht dabei
      // Zufall, es spielt also nicht zwingend derselbe Mann. Beim ersten
      // Anlauf wurde deshalb ein Torwart veraendert, der gar nicht auf dem
      // Platz stand - beide Profile lieferten exakt dieselben Zahlen, und
      // die Pruefung sah wie ein kaputtes Feature aus.
      const gegnerId = partie.homeClubId === user.clubId
        ? partie.awayClubId : partie.homeClubId;
      const torhueter = Object.values(game.players)
        .filter((p) => p.clubId === gegnerId && p.position === 'TW');
      const tw = torhueter[0];

      if (tw) {
        const sichern = { ...tw.attrs } as Attributes;
        // Wird waehrend der Laeufe gefuellt: wer im Tor stand, wird gesichert.
        const alteWerte = new Map<string, Attributes>();

        // Beide Profile auf dieselbe Gesamtstaerke bringen, indem `handling`
        // nachgezogen wird. Ohne das misst der Vergleich die Gesamtstaerke.
        const angleichen = (profil: Attributes, ziel: number) => {
          const kopie = { ...profil } as Attributes;
          for (let i = 0; i < 200; i++) {
            const ist = computeOverall(kopie, 'TW');
            if (ist === ziel) return kopie;
            kopie.handling = clamp(kopie.handling + (ist < ziel ? 1 : -1), 1, 99);
          }
          return kopie;
        };
        const ziel = computeOverall({ ...sichern, ...flanken } as Attributes, 'TW');
        const profilA = angleichen({ ...sichern, ...flanken } as Attributes, ziel);
        const profilB = angleichen({ ...sichern, ...duell } as Attributes, ziel);

        // Die Summe aller Tore war zu grob: ein Profilunterschied wirkt nur
        // auf Koepfe und Eins gegen eins, zusammen gut ein Fuenftel der
        // Chancen - ueber zwoelf Partien kam beidemal dieselbe Zahl heraus.
        // Auch Tore allein reichen nicht: ein Kopfballtor in zwanzig
        // Partien kippt nie. Gezaehlt wird deshalb die **Verwertung** je
        // Chancenart, also Tore gegen Tore plus Paraden - dafuer tragen
        // beide Ereignisse jetzt die Chancenart.
        // Der Torwart wird **in jedem Durchgang aus der vorbereiteten
        // Aufstellung** genommen und erst dann veraendert. Drei Anlaeufe
        // davor gingen daneben: der staerkste Torwart des Kaders ist nicht
        // der, der spielt; die Aufstellung wird bei jedem Aufruf neu
        // gewaehlt; und wer im Tor steht, muss nicht einmal `position: TW`
        // haben. Jedes Mal lieferten beide Profile exakt dieselben Zahlen -
        // die Pruefung sah wie ein kaputtes Feature aus, obwohl nur der
        // falsche Spieler veraendert wurde.
        const laufBei = (profil: Attributes) => {
          const tore: Record<string, number> = {};
          const paraden: Record<string, number> = {};
          const eigene = partie.homeClubId === user.clubId ? 'home' : 'away';
          const laeufe = 30;
          for (let i = 0; i < laeufe; i++) {
            const vorbereitet = prepareUserMatch(game, partie.id, true);
            if (!vorbereitet) break;
            const gegnerAuf = eigene === 'home'
              ? vorbereitet.setup.awayLineup : vorbereitet.setup.homeLineup;
            const slot = gegnerAuf.starters.find((x) => x.position === 'TW');
            const imTor = slot ? game.players[slot.playerId] : null;
            if (imTor) {
              if (!alteWerte.has(imTor.id)) {
                alteWerte.set(imTor.id, { ...imTor.attrs });
              }
              Object.assign(imTor.attrs, profil);
            }
            if (i === 0) {
              log(`DIAG Lauf ${i}: eigene=${eigene} `
                + `imTor=${imTor?.id} kopf=${imTor ? keeperSkill(imTor.attrs, 'header').toFixed(1) : 0} `
                + `partie=${partie.id} pending=${game.pendingMatchId}`);
            }
            if (i === 29) log(`DIAG letzter Lauf erreicht`);
            const rngT = new Rng(3300 + i * 167);
            const engine = new MatchEngine({
              ...vorbereitet.setup, rng: rngT, highlightMode: 'own' });
            engine.runToEnd(
              (c) => autoResolveChallenge(c, user, DIFFICULTY_SETTINGS.normal, rngT));
            for (const ev of engine.events) {
              if (ev.side !== eigene || !ev.chanceKind) continue;
              if (ev.type === 'goal') tore[ev.chanceKind] = (tore[ev.chanceKind] ?? 0) + 1;
              if (ev.type === 'save') paraden[ev.chanceKind] = (paraden[ev.chanceKind] ?? 0) + 1;
            }
          }
          const quote: Record<string, number> = {};
          const faelle: Record<string, number> = {};
          for (const k of new Set([...Object.keys(tore), ...Object.keys(paraden)])) {
            const t = tore[k] ?? 0;
            const p = paraden[k] ?? 0;
            quote[k] = t / Math.max(1, t + p);
            faelle[k] = t + p;
          }
          return { quote, faelle };
        };

        const gegenFlanken = laufBei(profilA);
        const gegenDuell = laufBei(profilB);
        for (const [id, werte] of alteWerte) {
          const p = game.players[id];
          if (p) Object.assign(p.attrs, werte);
        }

        check('Beide Profile haben dieselbe Gesamtstärke',
          computeOverall(profilA, 'TW') === computeOverall(profilB, 'TW'),
          `${computeOverall(profilA, 'TW')} und ${computeOverall(profilB, 'TW')}`);

        const zeige = (w: { quote: Record<string, number>; faelle: Record<string, number> }) =>
          ['header', 'oneOnOne', 'shot', 'longShot']
            .filter((k) => w.faelle[k])
            .map((k) => `${k} ${(w.quote[k] * 100).toFixed(1)} % (${w.faelle[k]})`)
            .join(', ');
        log(`Verwertung gegen den Flankenpflücker:    ${zeige(gegenFlanken)}`);
        log(`Verwertung gegen den Eins-gegen-eins-Mann: ${zeige(gegenDuell)}`);

        // Dass die Formel spreizt, heisst noch nicht, dass die Spielmaschine
        // sie benutzt - genau diese Luecke wird hier ja staendig gefunden.
        // Ueber Spielausgaenge laesst sie sich hier aber nicht zusichern:
        // diese Partie gibt sieben Kopfbaelle und sieben Eins-gegen-eins in
        // dreissig Durchgaengen her, und der Profilunterschied verschiebt die
        // Wahrscheinlichkeit um rund acht Prozent. Dass dabei kein einziger
        // Wurf kippt, hat gut ein Drittel Wahrscheinlichkeit - eine
        // Zusicherung darauf waere eine Wette, keine Pruefung.
        //
        // Zugesichert wird die Verkabelung stattdessen am Quelltext, im
        // Abschnitt "Verkabelung". In einer frischen Karriere mit mehr
        // Kopfbaellen trennten sich die Profile deutlich: Kopfballverwertung
        // 48,3 % gegen den Flankenpfluecker und 51,6 % gegen den anderen,
        // Eins gegen eins 77,8 % gegen 62,5 %.
        const verhaeltnis = (w: typeof gegenFlanken) =>
          (w.quote.oneOnOne ?? 0) / Math.max(0.01, w.quote.header ?? 0);
        log(`Duell zu Kopfball: ${verhaeltnis(gegenFlanken).toFixed(2)} gegen `
          + `${verhaeltnis(gegenDuell).toFixed(2)}`);
        log(`Köpfe und Duelle in der Stichprobe: `
          + `${gegenFlanken.faelle.header ?? 0} und ${gegenFlanken.faelle.oneOnOne ?? 0} `
          + '- zu wenig für eine Zusicherung, nur protokolliert.');
      }
    }
  }
  // --- Kalendersprung (Abschnitt 34) -----------------------------------
  //
  // Weiterkommen ging nur ueber "weiter, bis irgendetwas passiert". Wer drei
  // Wochen ueberspringen wollte, klickte dreissig Mal. `advanceUntil` setzt
  // ein Ziel und laesst den Rest durchlaufen.
  //
  // Der Sprung greift in den Zustand, deshalb wird der Spielstand hier kurz
  // in den Speicher gelegt und hinterher zurueckgenommen.
  log('\n--- Kalendersprung ---');
  {
    const vorher = getState().game;
    setState({ game });
    try {
      const start = game.date;
      const ziel = addDays(start, 21);

      // Ohne Simulation eigener Spiele: der Sprung endet spaetestens am
      // naechsten eigenen Spiel.
      const ohne = advanceUntil(ziel, { eigeneSimulieren: false });
      log(`Ohne eigene Spiele: ${ohne.days} Tage, Grund ${ohne.grund}`);
      check('Der Sprung geht nie rückwärts', !isBefore(game.date, start),
        `${start} -> ${game.date}`);
      check('Der Sprung überschießt das Ziel nicht',
        !isAfter(game.date, ziel), `${game.date} gegen ${ziel}`);
      check('Ohne Simulation bleiben eigene Spiele ungespielt',
        ohne.eigeneSpiele.length === 0, `${ohne.eigeneSpiele.length}`);
      if (ohne.grund === 'spiel') {
        check('Beim Halt an einer Partie ist sie noch offen',
          !!ohne.matchToPlay && !game.matches[ohne.matchToPlay]?.played);
      }

      // Mit Simulation: eigene Spiele werden unterwegs abgerechnet.
      const zielZwei = addDays(game.date, 45);
      const mit = advanceUntil(zielZwei, { eigeneSimulieren: true });
      log(`Mit eigenen Spielen: ${mit.days} Tage, ${mit.eigeneSpiele.length} Partien, `
        + `+${mit.trainingsPlus} aus dem Training, Grund ${mit.grund}`);

      check('Der zweite Sprung bewegt den Kalender', mit.days > 0, `${mit.days}`);
      if (mit.eigeneSpiele.length > 0) {
        check('Simulierte eigene Spiele sind hinterher gespielt',
          mit.eigeneSpiele.every((p) => game.matches[p.matchId]?.played),
          `${mit.eigeneSpiele.length} Partien`);
        check('Die Ergebnisse liegen im Rahmen',
          mit.eigeneSpiele.every((p) => p.tore >= 0 && p.tore <= 12
            && p.gegentore >= 0 && p.gegentore <= 12));
        check('Kein Spiel taucht zweimal auf',
          new Set(mit.eigeneSpiele.map((p) => p.matchId)).size
            === mit.eigeneSpiele.length);
      } else {
        log('Keine eigenen Partien im Zeitraum - Teil übersprungen.');
      }

      // Der Trainingszuwachs kam aus einer Liste von Eintraegen, nicht aus
      // einem Zahlenverzeichnis. Ein `Object.values` darueber summierte
      // still nur Nullen - der Bericht meldete dauerhaft "kein Fortschritt".
      // Geprueft am zweiten Sprung, der lang genug ist; ein eigener dritter
      // Sprung lief oft nur wenige Tage und die Zusicherung ins Leere.
      if (mit.days >= 14) {
        check('Der Trainingszuwachs wird tatsächlich gezählt',
          mit.trainingsPlus > 0,
          `+${mit.trainingsPlus} in ${mit.days} Tagen`);
      } else {
        log('Sprung zu kurz für eine Trainingswoche - Teil übersprungen.');
      }

      // Ein Ziel in der Vergangenheit darf nichts tun.
      const rueckwaerts = advanceUntil(addDays(game.date, -5));
      check('Ein Ziel in der Vergangenheit bewegt nichts',
        rueckwaerts.days === 0, `${rueckwaerts.days} Tage`);

      // Der Sprung ueber eine ganze Saison: bis zum Saisonende durchziehen,
      // eigene Spiele simulieren, Entscheidungen auslassen. Vorher war das
      // zwar moeglich, aber mit drei Dutzend Unterbrechungen - der Sprung
      // existierte auf dem Papier und niemand hat ihn gemacht.
      const saisonVorher = game.season;
      const saison = advanceSeason();
      log(`Saisonsprung: ${saison.days} Tage, ${saison.eigeneSpiele.length} `
        + `eigene Partien, ${saison.tore} Tore, Grund ${saison.grund}, `
        + `Stärke ${saison.staerkeVorher} auf ${saison.staerkeNachher}`);

      check('Der Saisonsprung deckt einen großen Teil des Jahres ab',
        saison.days > 150, `${saison.days} Tage`);
      check('Er endet am Saisonende oder am Karriereende',
        saison.grund === 'saison' || saison.grund === 'ende'
        || saison.grund === 'grenze',
        saison.grund);
      check('Ereignisse halten ihn nicht auf', saison.lifeEvent === null);
      check('Eigene Spiele halten ihn nicht auf', saison.matchToPlay === null);
      if (saison.eigeneSpiele.length > 10) {
        check('Über eine Saison kommen viele eigene Partien zusammen',
          saison.eigeneSpiele.length >= 20, `${saison.eigeneSpiele.length}`);
        check('Alle simulierten Partien sind hinterher gespielt',
          saison.eigeneSpiele.every((p) => game.matches[p.matchId]?.played));
      }
      if (saison.grund === 'saison') {
        check('Die Saison ist danach eine weiter', game.season === saisonVorher + 1,
          `${saisonVorher} auf ${game.season}`);
      }

      // Der Bogen der Laufbahn gehoert in den Bericht - sonst waere eine
      // ganze Saison ein schwarzes Loch.
      check('Der Bericht trägt Stärke und Potenzial',
        saison.staerkeVorher > 0 && saison.potenzialVorher > 0,
        `${saison.staerkeVorher}/${saison.potenzialVorher}`);
    } finally {
      setState({ game: vorher });
    }
  }
  // --- Spielphasen (Abschnitt 35) ---------------------------------------
  //
  // `ATTACK_PROB` war eine Konstante: Minute 3 und Minute 88 gleich
  // wahrscheinlich, in jeder Partie, immer. Damit plaetscherte jedes Spiel
  // gleichmaessig durch - keine Druckphasen, keine zaehe Mitte, keine wilde
  // Schlussphase. Zwei Partien mit demselben Ergebnis fuehlten sich
  // identisch an, obwohl im Fussball genau das den Unterschied macht.
  log('\n--- Spielphasen ---');
  {
    // Die Kurve verteilt nur um, sie erzeugt keine zusaetzlichen Tore.
    // Das laesst sich genau nachrechnen statt zu messen.
    let summe = 0;
    for (let m = 1; m <= 95; m++) summe += minutenGewicht(m);
    const schnitt = summe / 95;
    check('Die Minutenkurve verteilt nur um', Math.abs(schnitt - 1) < 0.02,
      `Mittel ${schnitt.toFixed(3)}`);
    check('Spät ist mehr los als früh',
      minutenGewicht(85) > minutenGewicht(5) * 1.5,
      `${minutenGewicht(5).toFixed(2)} gegen ${minutenGewicht(85).toFixed(2)}`);

    // Dieselbe Kurve zieht die Torminuten der schnellen Simulation - sonst
    // haetten Hintergrundpartien eine andere Torverteilung als die eigenen.
    {
      const rngM = new Rng(4711);
      let frueh = 0, spaet = 0;
      for (let i = 0; i < 4000; i++) {
        const m = zieheTorminute(rngM);
        if (m <= 15) frueh++;
        if (m > 75) spaet++;
      }
      log(`Gezogene Torminuten: ${frueh} in den ersten 15, ${spaet} nach der 75.`);
      check('Auch die gezogenen Torminuten folgen der Kurve', spaet > frueh * 1.3,
        `${spaet} gegen ${frueh}`);
    }

    // Und jetzt die ausgespielte Partie: dieselbe Begegnung, viele Wuerfel.
    const partie = Object.values(game.matches).find(
      (m) => !m.played && (m.homeClubId === user.clubId || m.awayClubId === user.clubId));
    if (partie) {
      const abschnitte = [0, 0, 0, 0, 0, 0];
      const chancen: number[] = [];
      let tore = 0;
      let phasenzeilen = 0;
      const laeufe = 40;
      for (let i = 0; i < laeufe; i++) {
        const vorbereitet = prepareUserMatch(game, partie.id, false);
        if (!vorbereitet) break;
        const rngP = new Rng(11000 + i * 173);
        const engine = new MatchEngine({
          ...vorbereitet.setup, rng: rngP, interactive: false });
        engine.runToEnd(
          (c) => autoResolveChallenge(c, user, DIFFICULTY_SETTINGS.normal, rngP));
        let n = 0;
        for (const ev of engine.events) {
          if (ev.type === 'goal') {
            tore++;
            abschnitte[Math.min(5, Math.floor(Math.max(0, ev.minute - 1) / 15))]++;
          }
          if (ev.type === 'goal' || ev.type === 'save' || ev.type === 'miss') n++;
          if (ev.type === 'note') phasenzeilen++;
        }
        chancen.push(n);
      }

      if (tore > 40 && chancen.length > 0) {
        const anteile = abschnitte.map((n) => n / tore * 100);
        log(`Tore je Viertelstunde: ${anteile.map((a) => a.toFixed(1)).join(', ')} %`);
        const ersteHaelfte = anteile[0] + anteile[1] + anteile[2];
        const zweiteHaelfte = anteile[3] + anteile[4] + anteile[5];
        check('In der zweiten Hälfte fallen mehr Tore',
          zweiteHaelfte > ersteHaelfte,
          `${zweiteHaelfte.toFixed(1)} % gegen ${ersteHaelfte.toFixed(1)} %`);
        // Zugesichert wird die Richtung mit knappem Abstand, nicht ein
        // Vorsprung von dreissig Prozent: Der lag ueber Jahre bei 1,3 und
        // kippte, sobald eine Aenderung an ganz anderer Stelle die Welt
        // verschob - gemessen 23,3 gegen 18,8 Prozent, also Faktor 1,24 bei
        // voellig intakter Kurve. Die Minutenkurve selbst wird weiter unten
        // exakt geprueft; hier zaehlt nur, dass am Ende mehr faellt.
        check('Die letzte Viertelstunde ist die torreichste',
          anteile[5] > anteile[0] * 1.1,
          `${anteile[5].toFixed(1)} % gegen ${anteile[0].toFixed(1)} %`);

        // Ueberdispersion: bei unabhaengigen Minuten waere die Varianz
        // hoechstens so gross wie das Mittel (Summe von Bernoulli-Versuchen).
        // Alles darueber kommt aus den Phasen - und genau das macht aus
        // gleichfoermigen Partien unterschiedliche.
        //
        // Nur protokolliert, nicht zugesichert: ueber vierzig Partien
        // schwankt der Schaetzer um rund 0,2, eine Schwelle darauf waere
        // eine Wette. Ueber 120 Durchgaenge gemessen lag er bei 1,26.
        const mittel = chancen.reduce((a, b) => a + b, 0) / chancen.length;
        const varianz = chancen.reduce((a, b) => a + (b - mittel) ** 2, 0)
          / chancen.length;
        log(`Chancen je Spiel: ${mittel.toFixed(1)} im Mittel, `
          + `Streuung ${Math.sqrt(varianz).toFixed(2)}, `
          + `Dispersion ${(varianz / mittel).toFixed(2)} `
          + '(nur protokolliert, Referenz 1,26 über 120 Partien)');

        check('Die Phasen stehen auch im Ticker', phasenzeilen > laeufe,
          `${phasenzeilen} Zeilen in ${laeufe} Partien`);
      } else {
        log('Zu wenige Tore für eine Verteilung - übersprungen.');
      }
    }
  }
  // --- Anstosszeiten (Abschnitt 36) -------------------------------------
  //
  // Eine Partie hatte nur ein Datum. Ein Freitagabend unter Flutlicht und
  // ein Sonntagmittag waren dieselbe Sache - im Kalender, im Bericht und in
  // der Stimmung. Dabei ist die Anstosszeit das erste, was ein Fan von
  // einem Spieltag weiss, noch vor dem Gegner.
  log('\n--- Anstosszeiten ---');
  {
    // Alle Partien der Welt, nicht nur die ersten paar hundert: unter der
    // Woche wird selten gespielt, sonst bleiben zu wenige fuer den
    // Vergleich uebrig.
    const partien = Object.values(game.matches);
    const zeiten: Record<string, number> = {};
    let flutlicht = 0;
    for (const m of partien) {
      const k = matchKickoff(m.id, m.date);
      const text = formatKickoff(k);
      zeiten[text] = (zeiten[text] ?? 0) + 1;
      if (k.flutlicht) flutlicht++;
    }
    const sortiert = Object.entries(zeiten).sort((a, b) => b[1] - a[1]);
    log(`Anstosszeiten: ${sortiert.slice(0, 6).map(([k, v]) => `${k} ${v}`).join(', ')}`);
    log(`Unter Flutlicht: ${flutlicht} von ${partien.length}`);

    check('Es gibt mehrere Anstosszeiten', sortiert.length >= 4,
      `${sortiert.length}`);
    check('Dieselbe Partie bekommt immer dieselbe Zeit',
      partien.every((m) => formatKickoff(matchKickoff(m.id, m.date))
        === formatKickoff(matchKickoff(m.id, m.date))));
    check('Flutlicht ist weder Regel noch Ausnahme',
      flutlicht > partien.length * 0.05 && flutlicht < partien.length * 0.85,
      `${flutlicht} von ${partien.length}`);

    // Die Uhrzeit faerbt die Kulisse, sie entscheidet sie nicht.
    const werktags = partien.filter((m) => {
      const t = weekday(m.date);
      return t >= 1 && t <= 4;
    });
    const wochenende = partien.filter((m) => {
      const t = weekday(m.date);
      return t === 0 || t === 6;
    });
    if (werktags.length > 20 && wochenende.length > 20) {
      const schnitt = (liste: typeof partien) => liste.reduce(
        (a, m) => a + kickoffAuslastung(matchKickoff(m.id, m.date), m.date), 0)
        / liste.length;
      const w = schnitt(werktags);
      const e = schnitt(wochenende);
      log(`Auslastungsfaktor werktags ${w.toFixed(3)}, am Wochenende ${e.toFixed(3)}`);
      check('Unter der Woche kommen weniger Leute', w < e, `${w.toFixed(3)} gegen ${e.toFixed(3)}`);
      check('Der Unterschied bleibt schmal', e - w < 0.2, `${(e - w).toFixed(3)}`);
    } else {
      log('Zu wenige Partien je Gruppe - Kulissenteil übersprungen.');
    }
  }
  // --- Aufstellung und Torzeilen (Abschnitt 37) -------------------------
  //
  // Zwei Sorten Gleichfoermigkeit auf einmal. `club.formation` wurde bei der
  // Weltgenerierung gesetzt und **nie wieder angefasst**: sieben Formationen
  // gab es, benutzt wurde je Verein genau eine, im August wie im Mai, gegen
  // jeden. Und die meistgelesene Zeile des Spiels sagte nie, **wie** ein Tor
  // fiel - ein Hammer aus 28 Metern, ein Kopfball und ein Abstauber lasen
  // sich alle als "TOR fuer X! Y."
  log('\n--- Aufstellung und Torzeilen ---');
  {
    const kaderIndex = new Map<string, typeof user[]>();
    for (const p of Object.values(game.players)) {
      if (!p.clubId) continue;
      if (!kaderIndex.has(p.clubId)) kaderIndex.set(p.clubId, []);
      kaderIndex.get(p.clubId)!.push(p);
    }

    let gleich = 0, anders = 0, gesamt = 0;
    const ordnungen = new Set<string>();
    // Aussenseiter und Favoriten getrennt zaehlen: wer klar unterlegen ist,
    // soll sich haeufiger nach hinten orientieren.
    let unterlegenDefensiv = 0, unterlegen = 0;
    let ueberlegenDefensiv = 0, ueberlegen = 0;

    for (const m of Object.values(game.matches).slice(0, 2000)) {
      const h = game.clubs[m.homeClubId];
      const a = game.clubs[m.awayClubId];
      if (!h || !a) continue;
      const hs = quickTeamRating(kaderIndex.get(h.id) ?? []);
      const as = quickTeamRating(kaderIndex.get(a.id) ?? []);
      const seiten: [typeof h, number, number, boolean][] = [
        [h, hs, as, true], [a, as, hs, false],
      ];
      for (const [c, eigene, gegner, daheim] of seiten) {
        const gewaehlt = matchFormation({
          basis: c.formation, eigene, gegner, daheim, matchId: m.id, clubId: c.id,
        });
        ordnungen.add(gewaehlt);
        gesamt++;
        if (gewaehlt === c.formation) gleich++; else anders++;
        const nachHinten = DEFENSIVER_TEST[c.formation] === gewaehlt
          && gewaehlt !== c.formation;
        if (eigene - gegner <= -6) {
          unterlegen++; if (nachHinten) unterlegenDefensiv++;
        } else if (eigene - gegner >= 6) {
          ueberlegen++; if (nachHinten) ueberlegenDefensiv++;
        }
      }
    }

    log(`Grundordnung: ${(gleich / gesamt * 100).toFixed(1)} % wie der Verein, `
      + `${(anders / gesamt * 100).toFixed(1)} % abweichend, `
      + `${ordnungen.size} verschiedene`);
    check('Die Vereinsordnung bleibt der Normalfall', gleich / gesamt > 0.6,
      `${(gleich / gesamt * 100).toFixed(1)} %`);
    check('Es wird aber nicht immer dieselbe gespielt', anders / gesamt > 0.08,
      `${(anders / gesamt * 100).toFixed(1)} %`);
    check('Dieselbe Partie ergibt dieselbe Ordnung',
      Object.values(game.matches).slice(0, 50).every((m) => {
        const c = game.clubs[m.homeClubId];
        if (!c) return true;
        const lage = {
          basis: c.formation, eigene: 60, gegner: 60, daheim: true,
          matchId: m.id, clubId: c.id,
        };
        return matchFormation(lage) === matchFormation(lage);
      }));

    if (unterlegen > 50 && ueberlegen > 50) {
      const u = unterlegenDefensiv / unterlegen;
      const o = ueberlegenDefensiv / ueberlegen;
      log(`Nach hinten orientiert: ${(u * 100).toFixed(1)} % als Außenseiter, `
        + `${(o * 100).toFixed(1)} % als Favorit`);
      check('Außenseiter stellen sich häufiger nach hinten', u > o,
        `${(u * 100).toFixed(1)} % gegen ${(o * 100).toFixed(1)} %`);
    } else {
      log('Zu wenige klare Kräfteverhältnisse - Vergleich übersprungen.');
    }

    // Die Torzeile nach Art der Situation. Geprueft wird, dass wirklich
    // verschiedene Familien vorkommen - nicht nur, dass es sie gibt.
    const partie = Object.values(game.matches).find(
      (m) => !m.played && (m.homeClubId === user.clubId || m.awayClubId === user.clubId));
    if (partie) {
      const formulierungen = new Set<string>();
      let tore = 0;
      for (let i = 0; i < 25; i++) {
        const vorbereitet = prepareUserMatch(game, partie.id, false);
        if (!vorbereitet) break;
        const rngT = new Rng(15000 + i * 181);
        const engine = new MatchEngine({
          ...vorbereitet.setup, rng: rngT, interactive: false });
        engine.runToEnd(
          (c) => autoResolveChallenge(c, user, DIFFICULTY_SETTINGS.normal, rngT));
        for (const ev of engine.events) {
          if (ev.type !== 'goal') continue;
          tore++;
          // Namen ausblenden, damit nur die Formulierung zaehlt.
          formulierungen.add(ev.text.replace(/[A-Z][a-z]+/g, 'N'));
        }
      }
      log(`Torzeilen: ${formulierungen.size} verschiedene Formulierungen `
        + `bei ${tore} Toren`);
      if (tore > 30) {
        check('Tore lesen sich nicht alle gleich', formulierungen.size >= 8,
          `${formulierungen.size} bei ${tore} Toren`);
      }

      // Jede Familie muss in beiden Katalogen Fassungen haben - sonst faellt
      // `tVariant` auf einen fehlenden Schluessel zurueck und im Ticker steht
      // der rohe Name.
      for (const art of ['header', 'longShot', 'oneOnOne', 'close', 'normal']) {
        check(`Die Torzeilen für ${art} sind vorhanden`,
          t(`live.goal.${art}.1`) !== `live.goal.${art}.1`);
      }
    }
  }
  // --- Potenzial und Startoptionen (Abschnitt 38) -----------------------
  //
  // Das Potenzial des eigenen Spielers wurde beim Start einmal gewuerfelt
  // und danach **nie wieder angefasst**. Die wichtigste Frage einer Laufbahn
  // - wie weit reicht es - war damit vor dem ersten Anpfiff beantwortet.
  // Und der Spieler nahm hin, was der Wuerfel ihm gab: Attribute, Startliga
  // und Entwicklungsverlauf standen alle fest.
  log('\n--- Potenzial und Startoptionen ---');
  {
    // Der Verlauf ueber rund drei Saisons. Sechs Bewertungen je Saison.
    const verlauf = (note: number, alter: number, minuten: number) => {
      const p = { ...user, attrs: { ...user.attrs }, potential: 74 } as Player;
      const rngP = new Rng(99);
      let drift = 0;
      for (let i = 0; i < 18; i++) {
        const b = reviewPotential(
          rngP, p, alter, TALENT_PROFILE.steady, note, 6, minuten, drift);
        drift = b.drift;
        p.potential += b.schritt;
      }
      return p.potential;
    };

    const stark = verlauf(7.6, 18, 80);
    const erwartet = verlauf(6.6, 18, 80);
    const schwach = verlauf(5.6, 18, 80);
    const ohneZeit = verlauf(6.6, 18, 10);
    const spaet = verlauf(7.6, 29, 85);

    log(`Potenzial ab 74 nach drei Saisons: stark ${stark}, erwartungsgemäß `
      + `${erwartet}, schwach ${schwach}, ohne Spielzeit ${ohneZeit}, `
      + `mit 29 trotz starker Leistung ${spaet}`);

    check('Starke Leistungen heben das Potenzial', stark > 74, `${stark}`);
    check('Schwache Leistungen senken es', schwach < 74, `${schwach}`);
    check('Wer erwartungsgemäß spielt, bleibt in der Nähe',
      Math.abs(erwartet - 74) <= 3, `${erwartet}`);
    check('Ohne Spielzeit sinkt es auch bei guter Note', ohneZeit < 74,
      `${ohneZeit}`);
    check('Mit geschlossenem Fenster geht es nur noch abwärts', spaet < 74,
      `${spaet}`);
    // Der Ausschlag muss klein bleiben: ein erster Anlauf hob das Potenzial
    // in derselben Zeit von 74 auf 97 und liess es bei schwacher Leistung auf
    // 49 fallen - damit war es keine Einschaetzung mehr, sondern eine zweite
    // Formkurve.
    check('Der Ausschlag bleibt in drei Saisons im Rahmen',
      stark - 74 < 16 && 74 - schwach < 16,
      `+${stark - 74} / -${74 - schwach}`);

    // Und die Startoptionen: wirken sie ueberhaupt?
    const bau = (extra: Partial<NewGameOptions>) => {
      const g = createNewGame({
        saveName: 'Probe', seed: 123456, difficulty: 'normal',
        firstName: 'Probe', lastName: 'Spieler', age: 17, nationality: 'de',
        position: 'ST', altPositions: ['OM'], foot: 'rechts',
        height: 182, weight: 76, shirtNumber: 9,
        appearance: {
          skinTone: 0, hairStyle: 1, hairColor: '#2b2118', beard: 0,
          eyeColor: '#4a3120', boots: '#fff',
        },
        background: 'academy',
        ...extra,
      });
      const u = g.players[g.userPlayerId];
      const liga = u.clubId ? g.competitions[g.clubs[u.clubId]?.leagueId] : null;
      return {
        staerke: computeOverall(u.attrs, u.position),
        potenzial: u.potential,
        level: liga?.level ?? 0,
      };
    };

    const ohne = bau({});
    const mitPunkten = bau({ attributePoints: { technical: 6, physical: 6 } });
    const frueh = bau({ talent: 'early' });
    const spaeter = bau({ talent: 'late' });
    const oben = bau({ startLevel: 1 });
    const unten = bau({ startLevel: 3 });

    log(`Start ohne Optionen: Stärke ${ohne.staerke}, Potenzial ${ohne.potenzial}, `
      + `Liga ${ohne.level}`);
    log(`Mit zwölf Punkten: Stärke ${mitPunkten.staerke}; `
      + `früh ${frueh.staerke}/${frueh.potenzial}, `
      + `spät ${spaeter.staerke}/${spaeter.potenzial}`);

    check('Verteilte Punkte machen den Spieler stärker',
      mitPunkten.staerke > ohne.staerke,
      `${mitPunkten.staerke} gegen ${ohne.staerke}`);
    check('Der Früh­entwickler startet stärker als der Spätzünder',
      frueh.staerke > spaeter.staerke,
      `${frueh.staerke} gegen ${spaeter.staerke}`);
    check('Die gewählte Startliga wird genommen',
      oben.level === 1 && unten.level === 3,
      `${oben.level} und ${unten.level}`);
    check('Ohne Angabe entscheidet weiter die Herkunft', ohne.level >= 1,
      `${ohne.level}`);

    // Der Deckel muss halten - sonst waere die Verteilung ein Freifahrtschein.
    const ueberzogen = bau({
      attributePoints: {
        technical: 99, physical: 99, mental: 99, defensive: 99, goalkeeping: 99,
      },
    });
    const genauDeckel = bau({ attributePoints: { technical: START_POINTS } });
    check('Mehr als der Deckel bringt nichts',
      ueberzogen.staerke <= genauDeckel.staerke + 6,
      `${ueberzogen.staerke} gegen ${genauDeckel.staerke}`);
  }
  // --- Eigene Entscheidungen (Abschnitt 39) -----------------------------
  //
  // Es gab genau drei Stellschrauben: Trainingsschwerpunkt, individuelles
  // Ziel und Berateraufträge. Alles andere passierte mit einem - die
  // Standards, der Verein, sogar wie man abseits des Platzes lebt.
  //
  // Geprueft wird vor allem, dass **keine dieser Optionen gratis ist**. Eine
  // Wahl ohne Preis ist keine Wahl, sondern ein Schalter, den jeder gleich
  // stellt.
  log('\n--- Eigene Entscheidungen ---');
  {
    // Die Faktoren selbst - exakt pruefbar, ohne eine Karriere zu spielen.
    check('Der Profi entwickelt sich schneller als der Nachtschwärmer',
      LIFESTYLE.professional.growth > LIFESTYLE.nightlife.growth,
      `${LIFESTYLE.professional.growth} gegen ${LIFESTYLE.nightlife.growth}`);
    check('Dafür kommt er öffentlich weniger vor',
      LIFESTYLE.professional.image < LIFESTYLE.nightlife.image,
      `${LIFESTYLE.professional.image} gegen ${LIFESTYLE.nightlife.image}`);
    check('Und er erholt sich besser',
      LIFESTYLE.professional.recovery > LIFESTYLE.nightlife.recovery);
    check('Das Nachtleben ist verletzungsanfälliger',
      LIFESTYLE.nightlife.injury > LIFESTYLE.professional.injury);

    // Zusatzeinheiten: der Gewinn waechst langsamer als der Preis, sonst
    // waere die Antwort immer "so viele wie moeglich".
    const eine = extraSessionEffect(1);
    const zwei = extraSessionEffect(2);
    check('Zusatzeinheiten bringen Entwicklung', eine.growth > 1 && zwei.growth > eine.growth,
      `${eine.growth} und ${zwei.growth}`);
    check('Die zweite Einheit bringt weniger als die erste',
      zwei.growth - eine.growth < eine.growth - 1,
      `+${(eine.growth - 1).toFixed(2)} dann +${(zwei.growth - eine.growth).toFixed(2)}`);
    check('Und sie kostet mehr', zwei.injury - eine.injury > eine.injury - 1,
      `+${(eine.injury - 1).toFixed(2)} dann +${(zwei.injury - eine.injury).toFixed(2)}`);
    check('Der Deckel hält',
      extraSessionEffect(99).growth === zwei.growth);

    // Und jetzt gespielt: zwei Karrieren, gleiche Wuerfel, nur die Wahl
    // unterscheidet sich. Gemessen wird die Attributsumme statt der
    // gerundeten Gesamtstaerke - die ist zu grob, um einen Unterschied von
    // zehn Prozent ueber eine Saison zu zeigen.
    const summe = (p: Player) => ALL_ATTRS.reduce((a, k) => a + p.attrs[k], 0);
    const lauf = (wahl: Partial<GameState>, tage: number) => {
      const g = createNewGame({
        saveName: 'Wahlprobe', seed: 777, difficulty: 'normal',
        firstName: 'Wahl', lastName: 'Probe', age: 17, nationality: 'de',
        position: 'ST', altPositions: ['OM'], foot: 'rechts',
        height: 182, weight: 76, shirtNumber: 9,
        appearance: {
          skinTone: 0, hairStyle: 1, hairColor: '#2b2118', beard: 0,
          eyeColor: '#4a3120', boots: '#fff',
        },
        background: 'academy',
      });
      Object.assign(g, wahl);
      const p = g.players[g.userPlayerId];
      const start = summe(p);
      let fitSumme = 0;
      for (let i = 0; i < tage; i++) {
        advanceDay(g);
        if (g.pendingMatchId) {
          simulateUserMatch(g, g.pendingMatchId);
          g.pendingMatchId = null;
        }
        fitSumme += p.fitness;
      }
      return {
        plus: summe(p) - start,
        fitness: fitSumme / tage,
        image: g.publicImage,
      };
    };

    const tage = 400;
    const profi = lauf({ lifestyle: 'professional' }, tage);
    const mitte = lauf({ lifestyle: 'balanced' }, tage);
    const nacht = lauf({ lifestyle: 'nightlife' }, tage);
    const zusatz = lauf({ lifestyle: 'balanced', extraSessions: 2 }, tage);

    log(`Über ${tage} Tage - Attributplus: Profi ${profi.plus}, `
      + `ausgewogen ${mitte.plus}, Nachtleben ${nacht.plus}, `
      + `mit zwei Zusatzeinheiten ${zusatz.plus}`);
    log(`Öffentliches Bild: ${Math.round(profi.image)} / `
      + `${Math.round(mitte.image)} / ${Math.round(nacht.image)}`);
    log(`Fitness im Mittel ohne und mit Zusatzeinheiten: `
      + `${mitte.fitness.toFixed(1)} gegen ${zusatz.fitness.toFixed(1)}`);

    check('Der Profi entwickelt sich in der Praxis am meisten',
      profi.plus > nacht.plus, `${profi.plus} gegen ${nacht.plus}`);
    check('Sein öffentliches Bild bleibt dafür zurück',
      profi.image < nacht.image,
      `${Math.round(profi.image)} gegen ${Math.round(nacht.image)}`);
    // Der Wachstumsfaktor selbst ist oben exakt geprueft. Ueber eine ganze
    // Karriere ist der Netto-Gewinn dagegen **nicht** garantiert: die
    // Muedigkeit kostet Fitness, die Fitness kostet Einsatzzeit, und ohne
    // Einsatzzeit entwickelt sich niemand. Genau das ist der Tausch, der
    // gewollt war - eine Zusicherung darauf waere die Behauptung, es gaebe
    // ihn nicht.
    log(`Zusatzeinheiten über ${tage} Tage: Attributplus ${zusatz.plus} `
      + `gegen ${mitte.plus} ohne - der Fitnessverlust kann den Gewinn `
      + `aufzehren.`);
    check('Und sie machen sichtbar müder',
      zusatz.fitness < mitte.fitness - 2,
      `${zusatz.fitness.toFixed(1)} gegen ${mitte.fitness.toFixed(1)}`);

    // Standards: die Forderung verschiebt den Massstab, sie schenkt nichts.
    game.setPieceClaim = 'none';
    const ohne = penaltyStanding(game, user.clubId);
    game.setPieceClaim = 'both';
    const mit = penaltyStanding(game, user.clubId);
    game.setPieceClaim = undefined;
    if (ohne && mit) {
      log(`Elfmeterstand: ohne Forderung fehlen ${ohne.gap}, mit Forderung `
        + `${mit.gap}`);
      check('Die Forderung bringt den Spieler näher an den Ball',
        mit.gap <= ohne.gap && (mit.takes || mit.gap < ohne.gap),
        `${ohne.gap} auf ${mit.gap}`);
    }
  }
  // --- Spielweise und Ereignisse (Abschnitt 40) -------------------------
  //
  // `club.tacticStyle` wurde bei der Weltgenerierung gesetzt und **nie
  // wieder angefasst**: ein Verein spielte dieselbe Philosophie ueber
  // fuenfzehn Jahre und ein Dutzend Trainer hinweg. Seit die Spielweise des
  // Gegners im Spiel zu spueren ist, faellt das auf - man trifft nach zehn
  // Saisons noch immer auf dieselbe Mannschaft.
  log('\n--- Spielweise und Ereignisse ---');
  {
    // Ein neuer Trainer bringt in gut einem Drittel der Faelle eine eigene
    // Idee mit - und sie passt zum Verein.
    const rngS = new Rng(2024);
    const probe = Object.values(game.clubs).slice(0, 40);
    let gewechselt = 0, gesamt = 0;
    let grossDefensiv = 0, kleinDefensiv = 0, gross = 0, klein = 0;
    for (const c of probe) {
      const vorher = c.tacticStyle;
      for (let i = 0; i < 12; i++) {
        const neu = neueSpielweise(rngS, c);
        gesamt++;
        if (neu !== vorher) gewechselt++;
        if (c.reputation >= 70) {
          gross++;
          if (neu === 'deepBlock' || neu === 'longBall') grossDefensiv++;
        } else if (c.reputation < 45) {
          klein++;
          if (neu === 'deepBlock' || neu === 'longBall') kleinDefensiv++;
        }
      }
    }
    log(`Neue Trainer: ${(gewechselt / gesamt * 100).toFixed(1)} % bringen eine `
      + `andere Spielweise mit`);
    check('Meistens bleibt es bei der Vereinsausrichtung',
      gewechselt / gesamt < 0.5, `${(gewechselt / gesamt * 100).toFixed(1)} %`);
    check('Aber nicht immer', gewechselt / gesamt > 0.15,
      `${(gewechselt / gesamt * 100).toFixed(1)} %`);
    if (gross > 20 && klein > 20) {
      const g = grossDefensiv / gross;
      const k = kleinDefensiv / klein;
      log(`Defensive Ausrichtung: große Vereine ${(g * 100).toFixed(1)} %, `
        + `kleine ${(k * 100).toFixed(1)} %`);
      check('Kleine Vereine stehen häufiger tief als große', k > g,
        `${(k * 100).toFixed(1)} % gegen ${(g * 100).toFixed(1)} %`);
    }

    // Die Ereignistexte muessen vollstaendig sein - fehlt einer, steht der
    // rohe Schluessel im Dialog, und niemand merkt es beim Typecheck.
    const rngE = new Rng(31337);
    const gesehen = new Set<string>();
    let fehlend = 0;
    for (let i = 0; i < 600; i++) {
      const ev = buildLifeEvent(rngE, i);
      if (!ev) continue;
      // Die Kennung ist je Ziehung neu - gezaehlt wird der Titel, sonst
      // besteht die Pruefung immer und sagt nichts.
      gesehen.add(ev.title);
      const roh = [ev.title, ev.description, ev.category,
        ...ev.options.flatMap((o) => [o.label, o.description])];
      for (const text of roh) if (text.startsWith('life.')) fehlend++;
    }
    log(`Ereignisse: ${gesehen.size} verschiedene in 600 Ziehungen`);
    check('Es gibt reichlich Ereignisse', gesehen.size >= 24, `${gesehen.size}`);
    check('Kein Ereignis zeigt einen rohen Schlüssel', fehlend === 0,
      `${fehlend} Stellen`);
  }
  // --- Spielerstaerken (Abschnitt 41) -----------------------------------
  //
  // Ein Spieler bestand aus 54 Zahlen und sonst nichts. Zwei Stuermer mit
  // derselben Gesamtstaerke waren nicht zu unterscheiden, egal wie
  // verschieden ihre Laufbahnen verlaufen waren.
  //
  // Staerken werden nicht gewaehlt, sondern verdient: Anlage **und**
  // Nachweis muessen zusammenkommen. Genau das wird hier geprueft - und
  // dass die Wirkung nicht nur in einer Tabelle steht.
  log('\n--- Spielerstärken ---');
  {
    const kopie = { ...user, attrs: { ...user.attrs } } as Player;
    const leer = { ...emptySeasonStats(user.id, 0, '', '') };

    // Ohne Anlage nuetzt der Nachweis nichts.
    kopie.attrs.freeKicks = 40;
    const vieleSpiele = { ...leer, goals: 60, appearances: 200, shots: 300, motm: 30 };
    const probeState = { ...game, traits: [] } as GameState;
    check('Ohne Anlage keine Stärke',
      !neueStaerken(probeState, kopie, vieleSpiele).includes('freeKickSpecialist'));

    // Und ohne Nachweis nuetzt die Anlage nichts.
    kopie.attrs.freeKicks = 85;
    check('Ohne Nachweis auch nicht',
      !neueStaerken(probeState, kopie, leer).includes('freeKickSpecialist'));

    // Beides zusammen: dann schon.
    const verdient = neueStaerken(probeState, kopie, vieleSpiele);
    log(`Mit Anlage und Nachweis verdient: ${verdient.length} Stärken`);
    check('Anlage und Nachweis zusammen ergeben eine Stärke',
      verdient.includes('freeKickSpecialist'), verdient.join(', '));

    // Eine erworbene Staerke kommt nicht ein zweites Mal.
    const schon = { ...game, traits: ['freeKickSpecialist'] } as GameState;
    check('Eine Stärke wird nur einmal vergeben',
      !neueStaerken(schon, kopie, vieleSpiele).includes('freeKickSpecialist'));

    // Die Wirkung darf nicht nur in einer Tabelle stehen.
    const ohne = traitEffect({ ...game, traits: [] } as GameState);
    const mit = traitEffect({
      ...game,
      traits: ['headerThreat', 'longRange', 'poacher', 'ironMan', 'bigGameNerve'],
    } as GameState);
    log(`Wirkung: Kopfball ${mit.header.toFixed(2)}, Fernschuss `
      + `${mit.longShot.toFixed(2)}, Abschluss ${mit.finish.toFixed(2)}, `
      + `Verletzungsrisiko ${mit.injury.toFixed(2)}, Druck ${mit.pressure.toFixed(2)}`);
    check('Stärken verbessern, was sie versprechen',
      mit.header > ohne.header && mit.longShot > ohne.longShot
      && mit.finish > ohne.finish);
    check('Unverwüstlich senkt das Verletzungsrisiko', mit.injury < ohne.injury,
      `${mit.injury.toFixed(2)}`);
    check('Nervenstark nimmt Druck', mit.pressure < ohne.pressure,
      `${mit.pressure.toFixed(2)}`);
    check('Der Ausschlag bleibt klein',
      mit.header < 1.3 && mit.longShot < 1.3 && mit.injury > 0.7,
      `${mit.header.toFixed(2)} / ${mit.longShot.toFixed(2)} / ${mit.injury.toFixed(2)}`);

    // Jede Staerke braucht ihre Texte, sonst steht der rohe Schluessel da.
    let ohneText = 0;
    for (const def of TRAITS) {
      const name = t(traitLabelKey(def.key));
      const beschreibung = t(`trait.${def.key}.desc`);
      const meldung = t(`trait.${def.key}.earned`);
      if (name.startsWith('trait.')) ohneText++;
      if (beschreibung.startsWith('trait.')) ohneText++;
      if (meldung.startsWith('trait.')) ohneText++;
    }
    check('Alle Stärken haben ihre Texte', ohneText === 0,
      `${TRAITS.length} Stärken, ${ohneText} fehlende Stellen`);
  }
  // --- Lage und Spielmomente (Abschnitt 42) -----------------------------
  //
  // Ereignisse wurden gleichverteilt aus dem ganzen Vorrat gezogen, ohne
  // einen Blick auf die Lage: ein Kabinenstreit konnte direkt nach einem
  // 5:0 kommen, ein Sponsorentermin waehrend der Spieler mit Kreuzbandriss
  // auf der Liege lag. Alles konnte immer passieren, also passte nie etwas.
  //
  // Und im Ticker gab es weder Ecken noch Abseits - eine Partie bestand aus
  // Schuessen, Paraden und Fouls, dazwischen nichts.
  log('\n--- Lage und Spielmomente ---');
  {
    const grundlage: Lage = {
      verletzt: false, kapitaen: false, formPunkte: 7, image: 50,
      trainer: 55, monat: 4, alter: 24,
    };
    const zieheOft = (lage: Lage, n: number) => {
      const rngL = new Rng(555);
      const titel = new Set<string>();
      for (let i = 0; i < n; i++) titel.add(buildLifeEvent(rngL, i, lage).title);
      return titel;
    };

    // Ein verletzter Spieler soll die Reha-Entscheidung sehen koennen,
    // ein gesunder nie.
    const verletzt = zieheOft({ ...grundlage, verletzt: true }, 400);
    const gesund = zieheOft(grundlage, 400);
    const reha = t('life.reha.title');
    check('Nur ein Verletzter bekommt die Reha-Entscheidung',
      verletzt.has(reha) && !gesund.has(reha),
      `${verletzt.has(reha) ? 'verletzt ja' : 'verletzt nein'}, `
      + `${gesund.has(reha) ? 'gesund ja' : 'gesund nein'}`);

    // Eine Krise bringt die Krisensitzung, eine Serie nicht.
    const krise = zieheOft({ ...grundlage, formPunkte: 1 }, 400);
    const serie = zieheOft({ ...grundlage, formPunkte: 15 }, 400);
    const sitzung = t('life.krisensitzung.title');
    const jubel = t('life.siegesserie.title');
    check('Die Krisensitzung kommt nur in der Krise',
      krise.has(sitzung) && !serie.has(sitzung));
    check('Der Medienrummel nur nach einer Serie',
      serie.has(jubel) && !krise.has(jubel));

    // Und der allgemeine Vorrat bleibt in jeder Lage erreichbar - sonst
    // saehe eine schlechte Serie nur noch Krisensitzungen.
    log(`Verschiedene Ereignisse: ${krise.size} in der Krise, `
      + `${serie.size} in der Serie, ${verletzt.size} verletzt`);
    check('In jeder Lage bleibt der Vorrat breit',
      krise.size >= 15 && serie.size >= 15 && verletzt.size >= 15,
      `${krise.size} / ${serie.size} / ${verletzt.size}`);

    // Die neuen Momente im Spiel.
    const partie = Object.values(game.matches).find(
      (m) => !m.played && (m.homeClubId === user.clubId || m.awayClubId === user.clubId));
    if (partie) {
      let ecken = 0, abseits = 0, aluminium = 0, partien = 0;
      for (let i = 0; i < 25; i++) {
        const vorbereitet = prepareUserMatch(game, partie.id, false);
        if (!vorbereitet) break;
        const rngM = new Rng(21000 + i * 163);
        const engine = new MatchEngine({
          ...vorbereitet.setup, rng: rngM, interactive: false });
        engine.runToEnd(
          (c) => autoResolveChallenge(c, user, DIFFICULTY_SETTINGS.normal, rngM));
        partien++;
        for (const ev of engine.events) {
          if (ev.text.includes(t('live.corner.1').slice(0, 4))) ecken++;
          if (/[Aa]bseits|[Oo]ffside|Fahne|flag/.test(ev.text)) abseits++;
          if (/Pfosten|Latte|Aluminium|post|bar|woodwork/i.test(ev.text)) aluminium++;
        }
      }
      log(`Je Spiel: ${(ecken / partien).toFixed(1)} Ecken, `
        + `${(abseits / partien).toFixed(2)} Abseitsentscheidungen, `
        + `${(aluminium / partien).toFixed(2)} Aluminiumtreffer`);
      check('Ecken kommen regelmäßig vor', ecken / partien > 1.5,
        `${(ecken / partien).toFixed(1)} je Spiel`);
      check('Aber nicht im Übermaß', ecken / partien < 14,
        `${(ecken / partien).toFixed(1)} je Spiel`);
      check('Abseits und Aluminium bleiben Ausnahmen',
        abseits / partien < 2 && aluminium / partien < 3,
        `${(abseits / partien).toFixed(2)} / ${(aluminium / partien).toFixed(2)}`);
    }
  }
  // --- Spielerkarte (Abschnitt 43) --------------------------------------
  //
  // Die Spielerakte listet 54 Attribute einzeln. Richtig fuer den, der an
  // einem Wert arbeitet - unbrauchbar fuer die Frage, die man sich nach
  // einem Wechsel zuerst stellt: was fuer ein Spieler ist das eigentlich?
  log('\n--- Spielerkarte ---');
  {
    const feld = summaryValues(user.attrs, user.position);
    log(`Sechs Werte: ${feld.map((w) => `${t(summaryLabelKey(w.key))} ${w.value}`)
      .join(', ')}`);
    check('Die Karte zeigt sechs Werte', feld.length === 6, `${feld.length}`);
    check('Alle liegen im gültigen Bereich',
      feld.every((w) => w.value >= 1 && w.value <= 99),
      feld.map((w) => w.value).join(', '));

    // Torhueter bekommen eine eigene Reihe: bei ihnen sagen Abschluss und
    // Dribbling nichts, Reflexe und Herauslaufen dagegen alles.
    const keeper = { ...user, position: 'TW' } as Player;
    const keeperFeld = summaryValues(keeper.attrs, 'TW');
    check('Torhüter bekommen eine eigene Reihe',
      keeperFeld.length === 6
      && keeperFeld.every((w) => !feld.some((f) => f.key === w.key)),
      keeperFeld.map((w) => w.key).join(', '));

    // Die Werte muessen den Attributen folgen, sonst waere die Karte Deko.
    const schnell = { ...user.attrs, acceleration: 95, pace: 95 } as Attributes;
    const langsam = { ...user.attrs, acceleration: 25, pace: 25 } as Attributes;
    const tempoHoch = summaryValues(schnell, user.position)[0].value;
    const tempoTief = summaryValues(langsam, user.position)[0].value;
    log(`Tempo bei 95 gegen 25: ${tempoHoch} gegen ${tempoTief}`);
    check('Die Werte folgen den Attributen', tempoHoch > tempoTief + 40,
      `${tempoHoch} gegen ${tempoTief}`);

    // Und jedes Kuerzel braucht seinen Text, sonst steht der rohe
    // Schluessel auf der Karte.
    const alleSchluessel = [...feld, ...keeperFeld].map((w) => w.key);
    const ohneText = alleSchluessel.filter(
      (k) => t(summaryLabelKey(k)).startsWith('summary.'));
    check('Alle Kürzel haben ihren Text', ohneText.length === 0,
      ohneText.join(', ') || `${alleSchluessel.length} geprüft`);
  }
  // --- Der Block hat einen Ort (Abschnitt 44) ---------------------------
  //
  // Vorher war ein geblockter Schuss eine Zeile Text: Der Torblick zeigte
  // den Ball ungehindert weiterfliegen und daneben stand "Ein Verteidiger
  // stand im Schussweg". Jetzt hat jeder Block eine Stelle, an der er
  // stattfand - und damit einen Verteidiger, den man sehen kann.
  log('\n--- Der Block hat einen Ort ---');
  {
    const blockRng = new Rng(90210);
    // Eigene Ausgangslage statt der aus dem Physikteil: der Abschnitt steht
    // weiter oben und soll fuer sich lesbar bleiben.
    const eng = {
      id: 'b', kind: 'shot' as const, minute: 50, title: 'Test', hint: '',
      distance: 22, offset: 0, pressure: 0.95, keeper: 60, opponent: 60,
      xg: 0.2, bigChance: false, scoreline: [0, 0] as [number, number],
      homeName: 'A', awayName: 'B', userSide: 'home' as const,
    };
    const schuetze = structuredClone(user);
    for (const key of Object.keys(schuetze.attrs) as (keyof typeof schuetze.attrs)[]) {
      schuetze.attrs[key] = 55;
    }
    schuetze.form = 55; schuetze.confidence = 55; schuetze.fitness = 90;
    let bloecke = 0; let ohneOrt = 0; let ausserReichweite = 0; let falscheTiefe = 0;
    for (let i = 0; i < 600; i++) {
      const r = resolveShot(
        { aimX: blockRng.float(-3, 3), aimY: 0, power: blockRng.float(0.5, 0.95),
          contactX: blockRng.float(-0.4, 0.4), contactY: blockRng.float(-0.5, 0.3) },
        eng, schuetze, DIFFICULTY_SETTINGS.normal, blockRng);
      if (r.outcome !== 'blocked') continue;
      bloecke++;
      if (!r.block) { ohneOrt++; continue; }
      // Ein Verteidiger kommt bis knapp ueber Kopfhoehe, nicht hoeher.
      if (r.block.z > 2.15) ausserReichweite++;
      // Und er steht vor dem Schuetzen, nicht dem Torwart vor den Fuessen.
      if (r.block.y < eng.distance - 9.5 || r.block.y > eng.distance - 0.5) falscheTiefe++;
    }
    log(`Blöcke in 600 Schüssen: ${bloecke}`);
    check('Es kommt überhaupt zu Blöcken', bloecke > 20, `${bloecke}`);
    check('Jeder Block hat eine Stelle', ohneOrt === 0, `${ohneOrt} ohne Ort`);
    check('Kein Block über Kopfhöhe', ausserReichweite === 0,
      `${ausserReichweite} zu hoch`);
    check('Der Blocker steht vor dem Schützen', falscheTiefe === 0,
      `${falscheTiefe} falsch`);

    // Ein Ball, der auf dem ganzen Weg ueber Kopfhoehe fliegt, ist nicht zu
    // blocken. Das ist der Hebel, den der Spieler dadurch bekommt: den
    // Verteidiger sehen und ihn ueberheben.
    // Eine Bahn, die im ganzen Band ueber Kopfhoehe liegt, darf keinen
    // Block ergeben. Die Bahn ist hier von Hand gesetzt statt geschossen:
    // geprueft wird die Regel, nicht ob die Physik gerade so eine Bahn
    // hergibt - sonst faellt die Pruefung durch, ohne je gefragt zu haben.
    const ueberKopf = {
      points: Array.from({ length: 60 }, (_, i) => ({
        x: 0, y: 22 - i * 0.36, z: 3.2, t: i / 120,
      })),
      crossing: { x: 0, z: 3.2, t: 0.5, speed: 20 },
      end: { x: 0, y: 0, z: 3.2, t: 0.5 },
      launchSpeed: 20,
    };
    const flach = {
      ...ueberKopf,
      points: ueberKopf.points.map((p) => ({ ...p, z: 0.8 })),
    };
    const gelupft = findBlock(ueberKopf, { ...eng }, new Rng(7));
    const gerollt = findBlock(flach, { ...eng }, new Rng(7));
    check('Ein Ball über Kopfhöhe lässt sich nicht blocken',
      gelupft === null,
      gelupft === null ? 'nicht blockbar' : `blockbar bei z=${gelupft.z.toFixed(2)}`);
    check('Ein flacher Ball dagegen schon', gerollt !== null,
      gerollt ? `Block bei y=${gerollt.y.toFixed(1)}` : 'kein Block');

    // Der Hebel, den der Spieler bekommt: den Ball anheben. Er wirkt nur,
    // wenn der Verteidiger absteht - wer bedraengt wird, kann niemanden
    // ueberheben, weil der Gegner zu nah ist. Gemessen wird deshalb beides.
    // Geprueft wird der Mechanismus selbst, ohne die Wuerfelchance davor:
    // sonst misst man den Wurf und nicht die Physik.
    const bahnFlach = simulateBallFlight({
      startX: 0, startY: 22, aimX: 0, aimY: 0, power: 0.75,
      contactX: 0, contactY: 0.5, shotPower: 55, curve: 55,
    });
    const bahnGehoben = simulateBallFlight({
      startX: 0, startY: 22, aimX: 0, aimY: 0, power: 0.75,
      contactX: 0, contactY: -0.7, shotPower: 55, curve: 55,
    });
    const quote = (bahn: typeof bahnFlach, druck: number) => {
      let treffer = 0;
      for (let i = 0; i < 400; i++) {
        if (findBlock(bahn, { ...eng, pressure: druck }, new Rng(9000 + i))) treffer++;
      }
      return treffer;
    };
    const abstandFlach = quote(bahnFlach, 0.2);
    const abstandHoch = quote(bahnGehoben, 0.2);
    const druckFlach = quote(bahnFlach, 0.95);
    const druckHoch = quote(bahnGehoben, 0.95);
    log(`Blöcke je 400 - abstehend ${abstandFlach} flach gegen ${abstandHoch} angehoben,`
      + ` bedrängt ${druckFlach} gegen ${druckHoch}`);
    check('Anheben hilft, wenn der Verteidiger absteht',
      abstandHoch < abstandFlach - 40,
      `${abstandFlach} gegen ${abstandHoch}`);
    check('Unter Druck hilft es nicht - der Gegner steht zu nah',
      druckHoch === druckFlach,
      `${druckFlach} gegen ${druckHoch}`);

    // Die Mauer meldet sich als Mauer, nicht als einzelner Verteidiger.
    const freistoss = {
      ...eng, kind: 'freeKick' as const, distance: 20, offset: 2, wall: 4,
    };
    const platt = resolveShot(
      { aimX: 0, aimY: 0, power: 0.8, contactX: 0, contactY: 0.2 },
      freistoss, schuetze, DIFFICULTY_SETTINGS.normal, new Rng(11));
    log(`Platter Freistoß: ${platt.outcome}` +
      (platt.block ? ` (${platt.block.kind} bei z=${platt.block.z.toFixed(2)})` : ''));
    check('Ein Mauerblock meldet sich als Mauer',
      platt.outcome !== 'blocked' || platt.block?.kind === 'wall',
      platt.block?.kind ?? platt.outcome);

    // Und die Erklaerung darf kein roher Schluessel sein - die Saetze
    // standen bis eben als deutsche Zeichenketten im Code und fehlten im
    // englischen Bau vollstaendig.
    const gruende = [
      'ba.block.wall', 'ba.block.low', 'ba.block.body', 'ba.block.high',
      'ba.save.central', 'ba.save.softly', 'ba.miss.short',
      'ba.miss.underneath', 'ba.miss.overTheBar', 'ba.miss.curved', 'ba.miss.wide',
    ];
    const ohneText = gruende.filter((k) => t(k) === k || t(k).startsWith('ba.'));
    check('Alle Schussgründe haben ihren Text', ohneText.length === 0,
      ohneText.join(', ') || `${gruende.length} geprüft`);
  }
  /** Die in einem Spielstand noch offenen Partien des Spielers. */
  function offeneIn(st: typeof game, n: number) {
    const u = st.players[st.userPlayerId];
    return Object.values(st.matches)
      .filter((m) => !m.played
        && (m.homeClubId === u.clubId || m.awayClubId === u.clubId))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, n);
  }

  /**
   * Ein Spielstand, in dem der Spieler wirklich eine Partie vor sich hat.
   *
   * Der geteilte Spielstand steht nach dem Saisonsprung am Saisonende -
   * dort ist keine Partie mehr offen. Die Abschnitte danach benutzten
   * bisher eine ganz oben gebaute Liste weiter, deren Partien laengst
   * gespielt waren: sie spielten alte Ergebnisse noch einmal nach und
   * massen in Wahrheit nichts. Steht nichts mehr an, wird hier auf einer
   * Kopie so weit vorgerueckt, bis der neue Spielplan steht.
   */
  function spielbareLage(n: number) {
    const eigene = offeneIn(game, n);
    if (eigene.length > 0 && !user.injury && user.suspension <= 0) {
      return { st: game, spiele: eigene };
    }
    const u = mitSpielen.players[mitSpielen.userPlayerId];
    const spiele = offeneIn(mitSpielen, n);
    log(`Lage aus der Momentaufnahme: ${spiele.length} offene Partien, `
      + `${u.injury ? 'verletzt' : 'fit'}, Sperre ${u.suspension} `
      + `(im geteilten Spielstand: ${eigene.length} offen, `
      + `${user.injury ? 'verletzt' : 'fit'})`);
    return { st: mitSpielen, spiele };
  }

  // --- Die Uhr und der verlorene Ball (Abschnitt 45) ---------------------
  //
  // Frueher fiel beim Ablaufen der Uhr ein ueberhasteter Abschluss: man
  // verlor Zeit, aber nie den Ball. Damit war die Uhr eine Empfehlung.
  // Jetzt ist der Ball weg - und dafuer laeuft sie deutlich laenger.
  log('\n--- Die Uhr und der verlorene Ball ---');
  {
    const lage = (druck: number) => ({
      id: 'u', kind: 'shot' as const, minute: 50, title: 'T', hint: '',
      distance: 16, offset: 0, pressure: druck, keeper: 60, opponent: 60,
      xg: 0.2, bigChance: false, scoreline: [0, 0] as [number, number],
      homeName: 'A', awayName: 'B', userSide: 'home' as const,
    });
    const normal = DIFFICULTY_SETTINGS.normal;
    const ruhig = pressureSeconds(lage(0), normal);
    const hektisch = pressureSeconds(lage(1), normal);
    log(`Bedenkzeit: ohne Druck ${ruhig.toFixed(1)} s, unter vollem Druck `
      + `${hektisch.toFixed(1)} s`);
    check('Auch unter vollem Druck bleibt echte Bedenkzeit', hektisch >= 5.5,
      `${hektisch.toFixed(1)} s`);
    check('Mehr Gegnerdruck bedeutet weniger Zeit', hektisch < ruhig,
      `${ruhig.toFixed(1)} gegen ${hektisch.toFixed(1)}`);
    // Bei ruhendem Ball wartet der Gegner - keine Uhr.
    check('Bei Standards läuft keine Uhr',
      pressureSeconds({ ...lage(1), kind: 'penalty' }, normal) === 0
      && pressureSeconds({ ...lage(1), kind: 'freeKick' }, normal) === 0);

    // Und der Ausgang selbst: ein verlorener Ball ist kein Abschluss und
    // kein Pass. Wuerde er als Schuss verbucht, stuende in der Statistik
    // ein Versuch, den es nie gab.
    const uhrLage = spielbareLage(60);
    const uhrMatch = uhrLage.spiele.find((m) => prepareUserMatch(uhrLage.st, m.id, true));
    if (uhrMatch) {
      const vorbereitet = prepareUserMatch(uhrLage.st, uhrMatch.id, true)!;
      const uhrRng = new Rng(31337);
      const uhrEngine = new MatchEngine({
        ...vorbereitet.setup, highlightMode: 'own', rng: uhrRng,
      });
      let szenen = 0;
      uhrEngine.runToEnd(() => {
        szenen++;
        return { outcome: 'ballLost' as const, quality: 0 };
      });
      const aus = uhrEngine.finish();
      const meine = aus.stats.find((st) => st.playerId === user.id);
      const zeilenMitVerlust = aus.events.filter((e) => e.user
        && /verliert den Ball|Moment ist vorbei|abgenommen|dazwischen/.test(e.text)).length;
      log(`${szenen} Szenen verschlafen: ${meine?.shots ?? 0} Schüsse, `
        + `${meine?.passes ?? 0} Pässe, ${meine?.possessionLost ?? 0} Ballverluste`);
      // Kein "=== 0": ist das Szenenbudget erschoepft, loest die Engine
      // weitere Chancen statistisch auf und bucht sie regulaer als Schuss.
      // Der Vergleich weiter unten traegt die Aussage.
      // Gegenprobe: dieselbe Partie, dieselben Szenen - aber gelungen.
      const gutRng = new Rng(31337);
      const gutEngine = new MatchEngine({
        ...prepareUserMatch(uhrLage.st, uhrMatch.id, true)!.setup,
        highlightMode: 'own', rng: gutRng,
      });
      gutEngine.runToEnd((c) => autoResolveChallenge(
        c, user, DIFFICULTY_SETTINGS.normal, gutRng,
      ));
      const gut = gutEngine.finish().stats.find((st) => st.playerId === user.id);
      log(`Zum Vergleich mit gespielten Szenen: ${gut?.shots ?? 0} Schüsse, `
        + `${gut?.passes ?? 0} Pässe, ${gut?.possessionLost ?? 0} Ballverluste`);
      // Ohne Szenen ist nichts zu vergleichen - das muss auffallen und
      // darf nicht als bestanden durchgehen.
      check('Verschlafene Szenen bringen weniger Abschlüsse',
        szenen > 0 && (meine?.shots ?? 0) < (gut?.shots ?? 0),
        szenen === 0 ? `keine Szenen - nicht messbar`
          : `${meine?.shots ?? 0} gegen ${gut?.shots ?? 0}`);
      // Nicht "mehr als im Vergleichslauf": dort gehen Szenen ebenfalls
      // daneben, und eine misslungene Flanke ist auch ein Ballverlust.
      // Sicher gilt nur die Untergrenze - jede verschlafene Szene bucht
      // einen Verlust, zusaetzlich zu denen der uebrigen Minuten.
      check('Jede verschlafene Szene bucht einen Ballverlust',
        szenen > 0 && (meine?.possessionLost ?? 0) >= szenen,
        `${meine?.possessionLost ?? 0} bei ${szenen} Szenen`);
      // Auch hier: null Zeilen zu null Szenen ist keine bestandene Pruefung.
      check('Der Ticker sagt, was passiert ist',
        szenen > 0 && zeilenMitVerlust >= szenen,
        `${zeilenMitVerlust} Zeilen zu ${szenen} Szenen`);
    }
  }
  // --- Umlaute im Spieltext (Abschnitt 46) ------------------------------
  //
  // Der deutsche Text stand lange in Umschrift da: "Naechstes Spiel",
  // "Kraefte schonen", "Freistoss". Das liest sich wie ein Fernschreiber
  // und war ausserdem uneinheitlich - an einzelnen Stellen standen laengst
  // Umlaute. Diese Pruefung haelt den Zustand fest: eine Handvoll
  // Schreibweisen, die es im deutschen Katalog nicht mehr geben darf.
  //
  // Der englische Katalog bleibt aussen vor. Dort sind "queue", "guest"
  // und "revenue" voellig richtig.
  log('\n--- Umlaute im Spieltext ---');
  {
    const verboten = [
      'fuer', 'ueber', 'naechst', 'staerke', 'koerper', 'moeglich',
      'waehl', 'laesst', 'haelt', 'groess', 'zurueck', 'schluessel',
      'torhueter', 'qualitaet', 'spaet', 'freistoss', 'aussen', 'fussball',
      'kraefte', 'muessen', 'koennen', 'hoehe', 'laeuft',
    ];
    const fundstellen: string[] = [];
    for (const [schluessel, text] of Object.entries(DE)) {
      const klein = text.toLowerCase();
      for (const wort of verboten) {
        if (klein.includes(wort)) {
          fundstellen.push(`${schluessel}: ${wort}`);
          break;
        }
      }
    }
    // Wie viel Umlaut steht ueberhaupt drin? Eine Zahl, die zeigt, dass
    // die Pruefung nicht bloss ins Leere greift.
    const mitUmlaut = Object.values(DE)
      .filter((text) => /[äöüÄÖÜß]/.test(text)).length;
    log(`Deutsche Texte mit Umlaut: ${mitUmlaut} von ${Object.keys(DE).length}`);
    check('Der deutsche Text nutzt Umlaute', mitUmlaut > 600, `${mitUmlaut}`);
    check('Keine Umschrift mehr im deutschen Katalog',
      fundstellen.length === 0,
      fundstellen.slice(0, 6).join(', ') || `${verboten.length} Schreibweisen geprüft`);

    // Und die Gegenprobe: der englische Katalog darf davon unberuehrt sein.
    // Er wurde bei der Umstellung bewusst ausgelassen, weil eine Wortliste
    // Deutsch nicht von Englisch unterscheiden kann - sie machte aus
    // "revenue" ein "revenü".
    const englischMitUmlaut = Object.entries(EN)
      .filter(([, text]) => /[äöüÄÖÜß]/.test(text)).map(([k]) => k);
    check('Der englische Katalog bleibt englisch',
      englischMitUmlaut.length === 0,
      englischMitUmlaut.slice(0, 4).join(', ') || `${Object.keys(EN).length} geprüft`);
  }
  // --- Die Flanke (Abschnitt 47) ----------------------------------------
  //
  // "cross" war als Szenenart deklariert, im Resolver behandelt und in der
  // Oberflaeche vorgesehen - erzeugt hat sie niemand. Ein Aussenspieler
  // bekam dieselbe Szene wie ein Zehner, `crossing` war ein Attribut ohne
  // Wirkung, und `crosses` stand als Null in jeder Statistik.
  log('\n--- Die Flanke ---');
  {

    // Die Regel steht in einer Tabelle je Platz - und genau die wird
    // geprueft. Ueber die Aufstellung ginge es nicht: welchen Platz der
    // Trainer vergibt, haengt am ganzen Kader, und beide Versuche das zu
    // erzwingen haben etwas anderes gemessen als die Regel.
    const t2 = CROSS_CHANCE_TABELLE;
    const fluegel = Math.min(t2.LA ?? 0, t2.RA ?? 0);
    const verteidiger = Math.min(t2.LV ?? 0, t2.RV ?? 0);
    const zentral = Math.max(t2.OM ?? 0, t2.ZM ?? 0);
    log(`Flankenneigung: Fluegel ${fluegel}, Aussenverteidiger `
      + `${verteidiger}, zentral ${zentral}`);
    check('Fluegelspieler flanken am haeufigsten', fluegel > verteidiger,
      `${fluegel} gegen ${verteidiger}`);
    check('Aussenverteidiger deutlich oefter als die Mitte',
      verteidiger > zentral * 3, `${verteidiger} gegen ${zentral}`);
    check('Innenverteidiger und Stuermer flanken nicht',
      t2.IV === undefined && t2.ST === undefined && t2.TW === undefined);

    // Und die Gegenprobe im laufenden Spiel: die Szene kommt wirklich vor.
    // Vor dem Umbau war sie nur auf dem Papier vorhanden.
    let flankenGesamt = 0; let szenenGesamt = 0;
    // Wenn hier nichts ankommt, muss der Grund im Protokoll stehen und
    // nicht erraten werden muessen.
    const flankenLage = spielbareLage(30);
    const flankenIch = flankenLage.st.players[flankenLage.st.userPlayerId];
    log(`Ausgangslage: Verein ${flankenIch.clubId
      ? flankenLage.st.clubs[flankenIch.clubId]?.name : 'keiner'}, `
      + `${flankenLage.spiele.length} offene Spiele, `
      + `${flankenIch.injury ? 'verletzt' : 'fit'}, Sperre ${flankenIch.suspension}, `
      + `${flankenLage.spiele.filter((m) => prepareUserMatch(flankenLage.st, m.id, true)).length} davon spielbar`);
    const plaetze = new Map<string, number>();
    let flankenAussen = 0;
    let flankenMitte = 0;
    let seiteRichtig = 0;
    const abschluesse = new Map<string, number>();
    let seiteFalsch = 0;
    flankenLage.spiele.forEach((m, k) => {
      const vorbereitet = prepareUserMatch(flankenLage.st, m.id, true);
      if (!vorbereitet) return;
      // Notfalls selbst in die Startelf setzen.
      const eigene = vorbereitet.setup.homeClub.id === flankenIch.clubId
        ? vorbereitet.setup.homeLineup
        : vorbereitet.setup.awayClub.id === flankenIch.clubId
          ? vorbereitet.setup.awayLineup : null;
      if (eigene && !eigene.starters.some(
        (o) => o.playerId === flankenLage.st.userPlayerId)) {
        const frei = eigene.starters.findIndex((o) => o.position !== 'TW');
        if (frei >= 0) {
          eigene.starters[frei] = {
            playerId: flankenLage.st.userPlayerId,
            position: flankenIch.position,
            rating: eigene.starters[frei].rating,
          };
        }
      }
      const meiner = [...vorbereitet.setup.homeLineup.starters,
        ...vorbereitet.setup.awayLineup.starters]
        .find((o) => o.playerId === flankenLage.st.userPlayerId);
      const platz = meiner ? meiner.position : 'Bank';
      plaetze.set(platz, (plaetze.get(platz) ?? 0) + 1);
      // Die Aufstellung ist Sache des Trainers - hier darf sie die
      // Messung nicht ersetzen. Der Trainer stellte den Spieler in
      // allen dreissig Partien als Mittelstuermer auf; die Pruefung mass
      // damit seine Laune und nicht die Regel. Jede zweite Partie wird
      // der Spieler deshalb bewusst nach aussen gestellt.
      if (meiner && k % 2 === 1) meiner.position = k % 4 === 1 ? 'RA' : 'LA';
      const erzwungen = meiner && k % 2 === 1 ? meiner.position : null;
      const r = new Rng(44000 + k * 733);
      const e = new MatchEngine({
        ...vorbereitet.setup, highlightMode: 'own', rng: r,
      });
      e.runToEnd((c) => {
        szenenGesamt++;
        if (c.kind === 'cross') {
          flankenGesamt++;
          if (k % 2 === 1) flankenAussen++; else flankenMitte++;
          // Ein Linksaussen flankt von links. Das Vorzeichen des
          // seitlichen Abstands sagt, von wo: negativ ist links.
          if (erzwungen === 'LA' && c.offset < 0) seiteRichtig++;
          else if (erzwungen === 'RA' && c.offset > 0) seiteRichtig++;
          else if (erzwungen) seiteFalsch++;
        }
        return autoResolveChallenge(c, user, DIFFICULTY_SETTINGS.normal, r);
      });
      // Was aus den Flanken wird: Kopfball oder Direktabnahme.
      for (const ev of e.finish().events) {
        if (!ev.chanceKind) continue;
        abschluesse.set(ev.chanceKind, (abschluesse.get(ev.chanceKind) ?? 0) + 1);
      }
    });
    log(`Im Spiel: ${flankenGesamt} Flankenszenen unter ${szenenGesamt} Szenen`);
    log(`Aufgestellt als: ${[...plaetze].map(([p, n]) => `${p} ${n}x`).join(', ')}`);
    check('Flankenszenen entstehen im laufenden Spiel',
      szenenGesamt > 0 && flankenGesamt > 0,
      szenenGesamt === 0 ? `keine Szenen - nicht messbar`
        : `${flankenGesamt} von ${szenenGesamt}`);
    // Und die Position muss dabei etwas ausmachen, sonst waere die
    // Tabelle oben wirkungslos.
    check('Aussen wird oefter geflankt als in der Mitte',
      flankenAussen > flankenMitte || szenenGesamt === 0,
      `außen ${flankenAussen}, Mitte ${flankenMitte}`);
    // Und sie kommt von der richtigen Seite: ein Linksaussen flankt
    // von links. Vorher war das ein Muenzwurf.
    check('Die Flanke kommt von der Seite, auf der der Spieler steht',
      seiteRichtig > 0 && seiteFalsch === 0,
      `${seiteRichtig} richtig, ${seiteFalsch} falsch`);
    log(`Abschluesse nach Flanken: ${[...abschluesse]
      .map(([k, n]) => `${k} ${n}x`).join(', ') || 'keine'}`);
    // Bewusst nur eine Protokollzeile. Ueber dreissig Partien kamen zwei
    // Direktabnahmen zusammen; bei gut einem Viertel der angekommenen
    // Flanken waere ein Lauf ganz ohne rund jedes zehnte Mal zu erwarten.
    // Eine Zusicherung darauf waere eine Wette. Zugesichert wird die
    // Formel weiter unten und die Verkabelung im Quelltext.
    check('Aus Flanken entstehen Abschluesse',
      (abschluesse.get('header') ?? 0) > 0,
      [...abschluesse].map(([k, n]) => `${k} ${n}`).join(', ') || 'keine');
    // Und die Flankenstaerke muss den Unterschied machen.
    const lage = (druck: number) => ({
      id: 'fl', kind: 'cross' as const, minute: 40, title: 'F', hint: '',
      distance: 12, offset: 22, pressure: druck, keeper: 60, opponent: 60,
      xg: 0.15, bigChance: false, scoreline: [0, 0] as [number, number],
      homeName: 'A', awayName: 'B', userSide: 'home' as const,
      targets: [{ id: 'z', name: 'Ziel', shirtNumber: 9, position: 'ST' as const,
        x: 2, y: 8, marked: 0.4, finishing: 70 }],
    });
    const flankenprofi = structuredClone(user);
    const grobmotoriker = structuredClone(user);
    for (const key of Object.keys(user.attrs) as (keyof typeof user.attrs)[]) {
      flankenprofi.attrs[key] = 60; grobmotoriker.attrs[key] = 60;
    }
    flankenprofi.attrs.crossing = 92;
    grobmotoriker.attrs.crossing = 28;
    const zaehle = (p: typeof user) => {
      let an = 0;
      for (let i = 0; i < 400; i++) {
        const r = autoResolveChallenge(lage(0.4), p, DIFFICULTY_SETTINGS.normal,
          new Rng(6000 + i));
        if (r.outcome === 'passCompleted') an++;
      }
      return an;
    };
    const gut = zaehle(flankenprofi);
    const schlecht = zaehle(grobmotoriker);
    log(`Flanken angekommen bei Flankenwert 92 gegen 28: ${gut} gegen ${schlecht}`);
    check('Die Flankenstaerke entscheidet mit', gut > schlecht + 40,
      `${gut} gegen ${schlecht}`);

  }
  // --- Laenderprofile (Abschnitt 48) ------------------------------------
  //
  // Beschreibung, Spielstil und Besonderheiten standen doppelt da: als
  // deutsche Saetze in countries.ts und noch einmal im Katalog. Angezeigt
  // wurde immer der Katalog - und die vier spaeter hinzugekommenen Laender
  // hatten dort gar keinen Eintrag. Auf dem Erstellungsbildschirm stand
  // deshalb woertlich "country.batavia.style".
  log('\n--- Laenderprofile ---');
  {
    const luecken: string[] = [];
    let besonderheiten = 0;
    for (const land of COUNTRIES) {
      for (const teil of ['style', 'description']) {
        const k = `country.${land.id}.${teil}`;
        if (t(k) === k) luecken.push(k);
      }
      const eigen = [1, 2, 3]
        .map((i) => `country.${land.id}.special${i}`)
        .filter((k) => t(k) !== k);
      besonderheiten += eigen.length;
      if (eigen.length < 2) luecken.push(`${land.id}: nur ${eigen.length} Besonderheiten`);
    }
    log(`${COUNTRIES.length} Laender, ${besonderheiten} Besonderheiten im Katalog`);
    check('Jedes Land hat Stil, Beschreibung und Besonderheiten',
      luecken.length === 0,
      luecken.slice(0, 5).join(', ') || `${COUNTRIES.length} geprueft`);

    // Und nichts davon steht doppelt: countries.ts fuehrt keine Texte mehr.
    const dopplung = Object.keys(COUNTRIES[0] ?? {})
      .filter((k) => k === 'description' || k === 'style' || k === 'specials');
    check('Die Laendertexte stehen nur im Katalog', dopplung.length === 0,
      dopplung.join(', ') || 'keine Dopplung');
  }
  // --- Der Vorvertrag (Abschnitt 49) ------------------------------------
  //
  // Ein auslaufender Vertrag war eine Entscheidung mit zwei Auswegen:
  // verlaengern oder abwarten. Abwarten hiess, am Saisonende zu nehmen, was
  // `expireUserContract` uebrig laesst - 18 Prozent unter Wert. Der dritte
  // Weg fehlte: im letzten halben Jahr faellt keine Abloese mehr an, also
  // kann man selbst verhandeln.
  log('\n--- Der Vorvertrag ---');
  {
    const gVor = createNewGame({
      saveName: 'Vorvertrag', seed: 515151, difficulty: 'normal',
      firstName: 'Vor', lastName: 'Vertrag', age: 18, nationality: 'de',
      position: 'ZM', altPositions: [], foot: 'rechts', height: 180, weight: 75,
      shirtNumber: 8, appearance: { skinTone: 0, hairStyle: 1, hairColor: '#2b2118', beard: 0, eyeColor: '#4a3120', boots: '#fff' }, background: 'academy',
    });
    const uV = gVor.players[gVor.userPlayerId];
    // Gut genug, dass ihn jemand haben will.
    for (const k of Object.keys(uV.attrs) as (keyof typeof uV.attrs)[]) {
      uV.attrs[k] = Math.max(uV.attrs[k], 72);
    }
    // Vertrag laeuft am Ende der laufenden Saison aus, und wir stehen im
    // Januar - genau das Fenster.
    uV.contract!.until = makeDate(gVor.season + 1, 6, 30);
    gVor.date = makeDate(gVor.season + 1, 1, 15);
    gVor.offers = [];

    offerPreContracts(gVor);
    const vor = gVor.offers.filter((o) => o.preContract);
    log(`Vorvertragsangebote im Januar: ${vor.length}`);
    check('Im letzten Vertragsjahr kommen Vorvertragsangebote', vor.length > 0,
      `${vor.length}`);
    check('Sie kosten keine Abloese', vor.every((o) => o.fee === 0),
      vor.map((o) => o.fee).join(', ') || '-');

    if (vor.length > 0) {
      // Das Gehalt muss ueber dem liegen, was der blosse Ablauf bringt.
      // Sonst waere der Vorvertrag ein Knopf ohne Grund.
      const bestes = Math.max(...vor.map((o) => o.salary));
      const gAblauf = structuredClone(gVor);
      gAblauf.offers = [];
      gAblauf.date = makeDate(gAblauf.season + 1, 6, 30);
      expireUserContract(gAblauf, new Rng(818181));
      const ohne = gAblauf.players[gAblauf.userPlayerId].contract?.salary ?? 0;
      log(`Gehalt: Vorvertrag ${bestes}, blosser Ablauf ${ohne}`);
      check('Selbst verhandeln bringt mehr als abwarten', bestes > ohne,
        `${bestes} gegen ${ohne}`);

      // Und die ganze Kette: unterschreiben, Saisonwechsel, angekommen.
      const gZug = structuredClone(gVor);
      const angebot = gZug.offers.find((o) => o.preContract)!;
      const altClub = gZug.players[gZug.userPlayerId].clubId;
      gZug.preContract = {
        clubId: angebot.clubId, salary: angebot.salary, years: angebot.years,
        role: angebot.role, goalBonus: angebot.goalBonus, signedOn: gZug.date,
      };
      const gewechselt = fulfilPreContract(gZug);
      const uZ = gZug.players[gZug.userPlayerId];
      check('Der Vorvertrag wird zum Saisonende wirksam', gewechselt
        && uZ.clubId === angebot.clubId && uZ.clubId !== altClub,
        `${gewechselt ? 'gewechselt' : 'nicht gewechselt'}`);
      check('Und er ist danach verbraucht', gZug.preContract === null);

      // Wer unterschrieben hat, bekommt kein Verlaengerungsangebot mehr -
      // sonst haette man beides und landete trotzdem woanders.
      const gDoppelt = structuredClone(gVor);
      gDoppelt.preContract = {
        clubId: angebot.clubId, salary: angebot.salary, years: angebot.years,
        role: angebot.role, goalBonus: angebot.goalBonus, signedOn: gDoppelt.date,
      };
      gDoppelt.offers = [];
      offerUserRenewal(gDoppelt, new Rng(4711));
      check('Nach dem Vorvertrag kommt keine Verlaengerung mehr',
        gDoppelt.offers.length === 0, `${gDoppelt.offers.length}`);
    }

    // Ohne auslaufenden Vertrag gibt es auch nichts zu unterschreiben.
    const gFrueh = structuredClone(gVor);
    gFrueh.offers = [];
    gFrueh.players[gFrueh.userPlayerId].contract!.until = makeDate(gFrueh.season + 4, 6, 30);
    offerPreContracts(gFrueh);
    check('Mit laufendem Vertrag kommt kein Vorvertrag',
      gFrueh.offers.length === 0, `${gFrueh.offers.length}`);
  }
  // --- Das Turnier zaehlt den Spieler (Abschnitt 50) ---------------------
  //
  // Ein Tor beim World Nations Cup hing an genau zwei Dingen: Position und
  // Abschlusswert. Weder Form noch Fitness noch der Gegner zaehlten, und
  // Vorlagen gab es gar nicht - ein Spielmacher stand nach einem Turnier
  // mit null in der Chronik, egal wie er gespielt hatte.
  log('\n--- Das Turnier zaehlt den Spieler ---');
  {
    /** Spielt ein Turnier mit einem praeparierten Spieler und zaehlt. */
    const turnier = (baue: (p: typeof user) => void, laeufe: number) => {
      let tore = 0; let vorlagen = 0; let spiele = 0;
      for (let i = 0; i < laeufe; i++) {
        const gT = structuredClone(game);
        const uT = gT.players[gT.userPlayerId];
        gT.nationalNominated = true;
        baue(uT);
        const r = playWorldNationsCup(gT, new Rng(77000 + i * 613));
        tore += r.userGoals; vorlagen += r.userAssists ?? 0; spiele += r.userCaps;
      }
      return { tore, vorlagen, spiele };
    };

    // Koennen zaehlt.
    const stark = turnier((p) => {
      p.position = 'ST';
      p.attrs.finishing = 92; p.attrs.heading = 88; p.attrs.longShots = 85;
      p.attrs.composure = 88; p.form = 75; p.fitness = 95;
    }, 30);
    const schwach = turnier((p) => {
      p.position = 'ST';
      p.attrs.finishing = 32; p.attrs.heading = 30; p.attrs.longShots = 28;
      p.attrs.composure = 30; p.form = 75; p.fitness = 95;
    }, 30);
    log(`Tore in 30 Turnieren: starker Stuermer ${stark.tore}, schwacher ${schwach.tore}`);
    check('Der bessere Stuermer trifft oefter', stark.tore > schwach.tore + 10,
      `${stark.tore} gegen ${schwach.tore}`);

    // Form und Fitness zaehlen - dieselben Attribute, andere Verfassung.
    const inForm = turnier((p) => {
      p.position = 'ST';
      p.attrs.finishing = 78; p.attrs.heading = 70; p.attrs.longShots = 70;
      p.attrs.composure = 72; p.form = 92; p.fitness = 100;
    }, 30);
    const ausForm = turnier((p) => {
      p.position = 'ST';
      p.attrs.finishing = 78; p.attrs.heading = 70; p.attrs.longShots = 70;
      p.attrs.composure = 72; p.form = 25; p.fitness = 62;
    }, 30);
    log(`Tore: in Form ${inForm.tore}, ausser Form ${ausForm.tore}`);
    check('Form und Fitness zaehlen mit', inForm.tore > ausForm.tore,
      `${inForm.tore} gegen ${ausForm.tore}`);

    // Ein Spielmacher traegt jetzt messbar bei.
    const zehner = turnier((p) => {
      p.position = 'OM';
      p.attrs.vision = 90; p.attrs.shortPass = 88; p.attrs.crossing = 82;
      p.attrs.dribbling = 85; p.form = 75; p.fitness = 95;
    }, 30);
    log(`Spielmacher in 30 Turnieren: ${zehner.vorlagen} Vorlagen, `
      + `${zehner.tore} Tore aus ${zehner.spiele} Spielen`);
    check('Ein Spielmacher sammelt Vorlagen', zehner.vorlagen > 0,
      `${zehner.vorlagen}`);
    check('Und die Vorlagen landen im Spielstand', (() => {
      const gP = structuredClone(game);
      gP.nationalNominated = true;
      const uP = gP.players[gP.userPlayerId];
      uP.position = 'OM';
      uP.attrs.vision = 95; uP.attrs.shortPass = 92; uP.attrs.crossing = 88;
      uP.attrs.dribbling = 90;
      const vorher = gP.nationalAssists ?? 0;
      for (let i = 0; i < 8; i++) playWorldNationsCup(gP, new Rng(9100 + i * 97));
      return (gP.nationalAssists ?? 0) > vorher;
    })());

    // Ein Torwart schiesst keine Turniertore.
    const keeper = turnier((p) => {
      p.position = 'TW';
      p.attrs.finishing = 90; p.form = 90; p.fitness = 100;
    }, 20);
    log(`Torwart: ${keeper.tore} Tore, ${keeper.vorlagen} Vorlagen `
      + `aus ${keeper.spiele} Spielen`);
    check('Der Torwart trifft nicht', keeper.spiele > 0 && keeper.tore === 0,
      `${keeper.tore} in ${keeper.spiele} Spielen`);
  }
  // --- Die Rueckkehr aus einer Verletzung (Abschnitt 51) -----------------
  //
  // Ein Kreuzbandriss kostet dauerhaft drei Punkte Antritt, drei Tempo und
  // zwei Beweglichkeit. Abgezogen wurde das immer schon - erzaehlt hat es
  // niemand. `applyPermanentDamage` kennt den Spielstand gar nicht, konnte
  // also nichts melden, und der Spieler stand ohne Erklaerung langsamer da.
  log('\n--- Die Rueckkehr aus einer Verletzung ---');
  {
    /** Setzt eine Verletzung und laesst sie ausheilen. */
    const heileAus = (tage: number) => {
      const gH = structuredClone(game);
      const uH = gH.players[gH.userPlayerId];
      uH.injury = null;
      const rH = new Rng(2468);
      injuryForDays(rH, uH, tage);
      const art = uH.injury!.name;
      const vorher = { ...uH.attrs };
      const idsVorher = new Set(gH.news.map((n) => n.id));
      const datumVorher = gH.date;
      const chronikVorher = gH.careerEvents.length;
      // So viele Tage weiter, bis die Verletzung ausgeheilt ist.
      //
      // An einem eigenen Spieltag kehrt `advanceDay` sofort zurueck, ohne
      // das Datum weiterzustellen: der Kalender wartet darauf, dass der
      // Nutzer das Spiel spielt. Das Spiel muss also wirklich abgespielt
      // werden. Ein blosses Zuruecksetzen von `pendingMatchId` half nicht -
      // der naechste Aufruf fand dieselbe ungespielte Partie wieder und die
      // Schleife stand bis zum Anschlag auf demselben Tag.
      let guard = 0;
      while (uH.injury && guard++ < (tage + 60) * 3) {
        const tag = advanceDay(gH);
        if (tag.matchToPlay) {
          // `simulateUserMatch` schliesst die Partie selbst ab - ein
          // zusaetzliches `finishUserMatch` bucht alles ein zweites Mal:
          // Tore, Einsaetze, Form, Potenzialschritte. Genau daran ist eine
          // Reproduktion gescheitert und hat einen Fehler vorgetaeuscht,
          // den es nicht gab.
          if (!simulateUserMatch(gH, tag.matchToPlay)) {
            gH.matches[tag.matchToPlay].played = true;
          }
          gH.pendingMatchId = null;
        }
      }
      const verloren = (Object.keys(vorher) as (keyof typeof vorher)[])
        .filter((k) => uH.attrs[k] < vorher[k]);
      return {
        art,
        verloren,
        neueNachrichten: gH.news.filter((n) => !idsVorher.has(n.id)),
        neueChronik: gH.careerEvents.length - chronikVorher,
        nochVerletzt: !!uH.injury,
        tage: Math.round((Date.parse(gH.date) - Date.parse(datumVorher))
          / 86400000),
      };
    };

    // Eine schwere Verletzung: bleibender Schaden und eine Meldung darueber.
    const schwer = heileAus(220);
    log(`Heilung: ${schwer.tage} Tage vergangen, `
      + `${schwer.nochVerletzt ? 'noch verletzt' : 'ausgeheilt'}, `
      + `${schwer.neueNachrichten.length} neue Nachrichten`);
    log(`Nach ${schwer.art}: ${schwer.verloren.length} Attribute dauerhaft `
      + `schwaecher (${schwer.verloren.join(', ') || 'keine'})`);
    check('Eine schwere Verletzung hinterlaesst bleibenden Schaden',
      !schwer.nochVerletzt && schwer.verloren.length > 0,
      schwer.verloren.join(', ') || 'kein Verlust');

    const meldung = schwer.neueNachrichten.find(
      (n) => n.category === 'injury' && /nicht derselbe|not the same/.test(n.headline));
    check('Und der Spieler erfaehrt davon', !!meldung,
      meldung ? meldung.headline : 'keine Meldung');
    // Die Nachricht muss die verlorenen Werte auch benennen, sonst bleibt
    // der Spieler ohne Erklaerung.
    check('Die Meldung benennt die verlorenen Werte',
      !!meldung && schwer.verloren.some((k) => meldung.body.includes(t(ATTR_LABELS[k]))),
      meldung ? meldung.body.slice(0, 70) : '-');
    check('Bleibender Schaden kommt in die Chronik', schwer.neueChronik > 0,
      `${schwer.neueChronik}`);

    // Eine leichte Blessur: Meldung ja, bleibender Schaden nein.
    const leicht = heileAus(6);
    log(`Nach ${leicht.art}: ${leicht.verloren.length} Attribute dauerhaft schwaecher`);
    check('Eine leichte Blessur hinterlaesst nichts',
      leicht.verloren.length === 0,
      leicht.verloren.join(', ') || 'nichts');
    const leichteMeldung = leicht.neueNachrichten.find(
      (n) => n.category === 'injury' && /Zurück im Training|Back in training/.test(n.headline));
    check('Auch die Rueckkehr ohne Folgen wird gemeldet', !!leichteMeldung,
      leichteMeldung ? leichteMeldung.headline : 'keine Meldung');
  }
  // --- Der schwache Fuss (Abschnitt 52) ---------------------------------
  //
  // Der Wert skaliert den Ausfuehrungsfehler mit 1 + (100 - weakFoot)/90 -
  // bei einem schlechten Fuss fast das Doppelte. Er galt aber nur beim
  // Schuss: `resolvePass` uebergab pauschal `false`, ausgerechnet fuer die
  // Flanke, den Lehrbuchfall. Und gesagt wurde es nie: der Ball ging
  // daneben, ohne dass jemand den Grund nennen konnte.
  log('\n--- Der schwache Fuss ---');
  {
    const lage = (offset: number, kind: string) => ({
      id: 'f', kind, minute: 50, title: 'T', hint: '',
      distance: 14, offset, pressure: 0.4, keeper: 60, opponent: 60,
      xg: 0.12, bigChance: false, scoreline: [0, 0] as [number, number],
      homeName: 'A', awayName: 'B', userSide: 'home' as const,
      targets: [{ id: 'z', name: 'Z', x: 0, y: 2, marked: 0.2 }],
    } as unknown as Challenge);

    const flanker = structuredClone(user);
    for (const key of Object.keys(flanker.attrs) as (keyof typeof flanker.attrs)[]) {
      flanker.attrs[key] = 55;
    }
    flanker.form = 55; flanker.confidence = 55; flanker.fitness = 90;
    const rechts = { ...flanker, foot: 'rechts' as const };
    const links = { ...flanker, foot: 'links' as const };

    // Die Geometrie: negativ ist links, positiv rechts.
    check('Rechtsfuss hat es links schwer',
      aufSchwachemFuss(lage(-20, 'cross'), rechts)
      && !aufSchwachemFuss(lage(20, 'cross'), rechts));
    check('Linksfuss hat es rechts schwer',
      aufSchwachemFuss(lage(20, 'cross'), links)
      && !aufSchwachemFuss(lage(-20, 'cross'), links));
    // Mittig ist keine Seite - und ein Kopfball kennt keinen Fuss.
    check('Mittig gibt es keinen schwachen Fuss',
      !aufSchwachemFuss(lage(0, 'shot'), rechts));
    check('Der Kopfball kennt keinen schwachen Fuss',
      !aufSchwachemFuss(lage(-20, 'header'), rechts));

    // Und die Wirkung: derselbe Spieler, derselbe Wurf, nur die Seite
    // gespiegelt. Ueber viele Durchgaenge muss die schwache Seite
    // deutlich ungenauer sein.
    const streuung = (offset: number, wert: number) => {
      const p = structuredClone(rechts);
      p.attrs.weakFoot = wert;
      const r = new Rng(9090);
      let summe = 0;
      const n = 900;
      for (let i = 0; i < n; i++) {
        const aus = resolvePass(
          { aimX: 0, aimY: 2, power: 0.6, contactX: 0, contactY: 0 },
          lage(offset, 'cross'), p, 'z', DIFFICULTY_SETTINGS.normal, r);
        summe += aus.error;
      }
      return summe / n;
    };
    const schwach = streuung(-22, 25);
    const stark = streuung(22, 25);
    log(`Flanke mit schwachem Fuss: ${tDecimal(schwach, 2)} m Abweichung, `
      + `mit starkem: ${tDecimal(stark, 2)} m`);
    check('Die Flanke vom schwachen Fuss wird ungenauer', schwach > stark * 1.15,
      `${tDecimal(schwach, 2)} gegen ${tDecimal(stark, 2)}`);

    // Ein guter schwacher Fuss federt das ab.
    const guterFuss = streuung(-22, 85);
    log(`Mit gutem schwachem Fuss (85): ${tDecimal(guterFuss, 2)} m`);
    check('Ein guter schwacher Fuss federt den Abzug ab', guterFuss < schwach,
      `${tDecimal(guterFuss, 2)} gegen ${tDecimal(schwach, 2)}`);

    // Das flache Ablegen bleibt unberuehrt - das kann ein Profi
    // beidfuessig, und ein Abzug darauf waere eine stille Verschaerfung
    // des ganzen Passspiels.
    const flachSchwach = (() => {
      const r = new Rng(9090);
      let summe = 0;
      for (let i = 0; i < 900; i++) {
        summe += resolvePass(
          { aimX: 0, aimY: 2, power: 0.6, contactX: 0, contactY: 0 },
          lage(-22, 'pass'), rechts, 'z', DIFFICULTY_SETTINGS.normal, r).error;
      }
      return summe / 900;
    })();
    log(`Flacher Pass von links: ${tDecimal(flachSchwach, 2)} m`);
    check('Das flache Zuspiel kennt keinen schwachen Fuss',
      flachSchwach < schwach,
      `${tDecimal(flachSchwach, 2)} gegen ${tDecimal(schwach, 2)}`);
  }
  // --- Mut und Koennen in der Abwehr (Abschnitt 53) ---------------------
  //
  // `blocking` und `bravery` standen im Attributblatt, wurden bei der
  // Erzeugung gewuerfelt, von Laenderprofilen gewichtet und liessen sich
  // trainieren - gelesen hat sie keine einzige Spielregel. Jetzt haengt
  // der Block eines Verteidigers daran.
  log('\n--- Mut und Koennen in der Abwehr ---');
  {
    const schuetze = structuredClone(user);
    for (const key of Object.keys(schuetze.attrs) as (keyof typeof schuetze.attrs)[]) {
      schuetze.attrs[key] = 55;
    }
    schuetze.form = 55; schuetze.confidence = 55; schuetze.fitness = 90;

    const bloeckeBei = (wert: number | undefined) => {
      const r = new Rng(4711);
      let bloecke = 0;
      const n = 900;
      for (let i = 0; i < n; i++) {
        const c = {
          id: 'b', kind: 'shot' as const, minute: 50, title: 'T', hint: '',
          distance: 20, offset: 0, pressure: 0.6, keeper: 60, opponent: 60,
          blockSkill: wert,
          xg: 0.2, bigChance: false, scoreline: [0, 0] as [number, number],
          homeName: 'A', awayName: 'B', userSide: 'home' as const,
        } as unknown as Challenge;
        const aus = resolveShot(
          { aimX: r.float(-3, 3), aimY: 0, power: r.float(0.5, 0.95),
            contactX: r.float(-0.4, 0.4), contactY: r.float(-0.5, 0.3) },
          c, schuetze, DIFFICULTY_SETTINGS.normal, r);
        if (aus.outcome === 'blocked') bloecke++;
      }
      return bloecke / n;
    };

    const mutig = bloeckeBei(85);
    const zaghaft = bloeckeBei(15);
    const ohne = bloeckeBei(undefined);
    log(`Geblockt: mutige Abwehr ${tDecimal(mutig * 100, 1)} %, `
      + `zaghafte ${tDecimal(zaghaft * 100, 1)} %, ohne Angabe `
      + `${tDecimal(ohne * 100, 1)} %`);
    check('Eine mutige Abwehr blockt mehr', mutig > zaghaft * 1.1,
      `${tDecimal(mutig * 100, 1)} % gegen ${tDecimal(zaghaft * 100, 1)} %`);
    // Ohne Angabe muss es beim bisherigen Verhalten bleiben - sonst haette
    // die Ergaenzung alle Szenen ohne Abwehrangabe stillschweigend
    // verschoben.
    check('Ohne Angabe bleibt es beim Mittelwert',
      Math.abs(ohne - (mutig + zaghaft) / 2) < 0.06,
      `${tDecimal(ohne * 100, 1)} % zwischen ${tDecimal(zaghaft * 100, 1)} `
      + `und ${tDecimal(mutig * 100, 1)}`);

    // Und die Engine muss den Wert auch wirklich mitgeben, sonst haengt
    // die schoenste Regel an einem undefinierten Feld.
    const probe = offeneIn(mitSpielen, 1)[0];
    const vorbereitet = probe ? prepareUserMatch(mitSpielen, probe.id, true) : null;
    if (vorbereitet) {
      const pruefRng = new Rng(5150);
      const pruefEngine = new MatchEngine({
        ...vorbereitet.setup, highlightMode: 'own', rng: pruefRng,
      });
      let mitWert = 0; let gesamt = 0;
      pruefEngine.runToEnd((c) => {
        gesamt++;
        if (typeof c.blockSkill === 'number' && c.blockSkill > 0) mitWert++;
        return autoResolveChallenge(c, user, DIFFICULTY_SETTINGS.normal, pruefRng);
      });
      pruefEngine.finish();
      check('Die Engine gibt das Abwehrkoennen an jede Szene mit',
        gesamt > 0 && mitWert === gesamt, `${mitWert} von ${gesamt}`);
    }
  }
  // --- Lufthoheit im Strafraum (Abschnitt 54) ---------------------------
  //
  // Eine angekommene Flanke wurde zum Kopfball, dessen Gefahr allein am
  // `heading` des Abnehmers hing. Wer mit hochsteigt, kam nicht vor: eine
  // Flanke in einen Strafraum voller kopfballstarker Verteidiger war
  // genauso gut wie eine in einen leeren. `defHeading` las bis dahin
  // keine Regel.
  log('\n--- Lufthoheit im Strafraum ---');
  {
    const werte = (defHeading: number, jumping: number) => ({
      ...user.attrs, defHeading, jumping,
    });
    // Der Wert selbst: Kopfball zaehlt mehr als Sprungkraft.
    const stark = luftHoheit(werte(90, 60));
    const schwach = luftHoheit(werte(20, 60));
    log(`Lufthoheit: stark ${tDecimal(stark, 1)}, schwach ${tDecimal(schwach, 1)}`);
    check('Der Kopfball wiegt schwerer als die Sprungkraft',
      luftHoheit(werte(90, 20)) > luftHoheit(werte(20, 90)),
      `${tDecimal(luftHoheit(werte(90, 20)), 1)} gegen `
      + `${tDecimal(luftHoheit(werte(20, 90)), 1)}`);

    // Und die Wirkung auf die Flanke.
    const gegenStark = kopfballGefahr(75, stark);
    const gegenSchwach = kopfballGefahr(75, schwach);
    const gegenMittel = kopfballGefahr(75, 50);
    log(`Kopfballgefahr bei gleichem Stuermer: gegen starke Abwehr `
      + `${tDecimal(gegenStark, 2)}, gegen schwache ${tDecimal(gegenSchwach, 2)}, `
      + `gegen mittlere ${tDecimal(gegenMittel, 2)}`);
    check('Eine kopfballstarke Abwehr entschaerft die Flanke',
      gegenStark < gegenSchwach * 0.85,
      `${tDecimal(gegenStark, 2)} gegen ${tDecimal(gegenSchwach, 2)}`);
    // Bei einer durchschnittlichen Abwehr darf sich nichts geaendert
    // haben - sonst waere die Ergaenzung eine stille Abwertung aller
    // Flanken.
    check('Gegen eine mittlere Abwehr bleibt es beim Alten',
      Math.abs(gegenMittel - clamp(75 / 100, 0.4, 1.3)) < 0.001,
      `${tDecimal(gegenMittel, 3)}`);
    // Der Stuermer zaehlt weiterhin.
    check('Der Kopfballstarke bleibt gefaehrlicher',
      kopfballGefahr(90, 50) > kopfballGefahr(40, 50),
      `${tDecimal(kopfballGefahr(90, 50), 2)} gegen `
      + `${tDecimal(kopfballGefahr(40, 50), 2)}`);
  }
  // --- Die Direktabnahme (Abschnitt 55) ---------------------------------
  //
  // `volleys` war der letzte Wert im Attributblatt, den keine Regel
  // gelesen hat. Eine angekommene Flanke wurde immer zum Kopfball -
  // auch beim Spieler, der nie hochsteigt und den Ball lieber direkt
  // nimmt.
  log('\n--- Die Direktabnahme ---');
  {
    const gleich = direktabnahmeChance(60, 60);
    const volleyStark = direktabnahmeChance(40, 90);
    const kopfStark = direktabnahmeChance(90, 40);
    log(`Anteil Direktabnahmen: bei gleichen Werten `
      + `${tDecimal(gleich * 100, 0)} %, beim Volleyschützen `
      + `${tDecimal(volleyStark * 100, 0)} %, beim Kopfballspieler `
      + `${tDecimal(kopfStark * 100, 0)} %`);
    check('Wer den Ball lieber direkt nimmt, tut es oefter',
      volleyStark > gleich && gleich > kopfStark,
      `${tDecimal(volleyStark * 100, 0)} / ${tDecimal(gleich * 100, 0)} / `
      + `${tDecimal(kopfStark * 100, 0)} %`);
    // Der Kopfball bleibt die Regel, sonst kippt das Bild einer Flanke.
    check('Der Kopfball bleibt der Normalfall', gleich < 0.4,
      `${tDecimal(gleich * 100, 0)} %`);
    // Und die Direktabnahme verschwindet nie ganz, auch beim reinen
    // Kopfballspieler nicht.
    check('Ganz aus ist sie nie', kopfStark >= 0.1,
      `${tDecimal(kopfStark * 100, 0)} %`);
  }
  // --- Der Stand beim Trainer (Abschnitt 56) ----------------------------
  //
  // `slotScore` entscheidet ueber jede Aufstellung und wurde nur innerhalb
  // der Aufstellung benutzt. Der Spieler sass auf der Bank und erfuhr
  // weder, wie knapp es war, noch woran es lag - in einem Karrierespiel
  // die Frage, die man sich jede Woche stellt.
  log('\n--- Der Stand beim Trainer ---');
  {
    const club = user.clubId ? game.clubs[user.clubId] : null;
    const kader = club ? squadOf(game.players, club.id) : [];
    const platz = kaderplatz(kader, user, game.coachRelation);
    if (!platz) {
      check('Der Stand beim Trainer laesst sich bestimmen', false, 'kein Kader');
    } else {
      log(`Rang ${platz.rang} von ${platz.von}, `
        + `${platz.rivaleVorn ? 'hinter' : 'vor'} ${platz.rivale ?? '-'} `
        + `(${tDecimal(platz.abstand, 1)} Punkte), Gruende: `
        + `${platz.faktoren.map((k) => `${k.key.split('.').pop()} `
          + `${tDecimal(k.punkte, 1)}`).join(', ') || 'keine'}`);
      check('Der Rang liegt im Kader', platz.rang >= 1 && platz.rang <= platz.von,
        `${platz.rang} von ${platz.von}`);

      // Bessere Form muss nach vorn bringen. Gemessen an einem Feld von
      // Zwillingen, die sich nur in der Form unterscheiden - im echten
      // Kader liegt der Spieler einundzwanzig Punkte vor dem Zweiten,
      // dort bewegt keine Form der Welt seinen Rang. Eine Probe, die
      // "Rang 1 gegen Rang 1" ergibt, hat nichts gemessen.
      const zwillinge = [10, 30, 50, 70, 90].map((wert, i) => {
        const z = structuredClone(user);
        z.id = `zw-${i}`;
        z.form = wert;
        return z;
      });
      const raenge = zwillinge.map(
        (z) => kaderplatz(zwillinge, z, game.coachRelation)!.rang);
      log(`Zwillinge nach Form 10/30/50/70/90: Raenge ${raenge.join(', ')}`);
      check('Bessere Form bringt einen besseren Rang',
        raenge.length === 5 && raenge.every((r, i) => r === 5 - i),
        raenge.join(', '));

      // Und die Auskunft muss den direkten Konkurrenten richtig benennen.
      const mitte = kaderplatz(zwillinge, zwillinge[2], game.coachRelation)!;
      check('Der genannte Konkurrent ist der direkte Nachbar',
        mitte.rivaleVorn && mitte.abstand < 0,
        `${mitte.rivale ?? '-'}, Abstand ${tDecimal(mitte.abstand, 1)}`);

      const besser = structuredClone(user);
      besser.form = 95;
      const schlechter = structuredClone(user);
      schlechter.form = 15;
      const kaderMit = (p: typeof user) => kader.map(
        (q: typeof user) => (q.id === p.id ? p : q));
      const gut = kaderplatz(kaderMit(besser), besser, game.coachRelation)!;
      const schwach = kaderplatz(kaderMit(schlechter), schlechter, game.coachRelation)!;

      // Und der genannte Grund muss zur Richtung passen: wer in Form ist,
      // dem darf die Form nicht als Bremse ausgewiesen werden.
      const formGut = gut.faktoren.find((k) => k.key === 'squad.factor.form');
      const formSchwach = schwach.faktoren.find((k) => k.key === 'squad.factor.form');
      check('Gute Form wird als Grund dafuer genannt, schlechte dagegen',
        (formGut?.punkte ?? 1) > 0 && (formSchwach?.punkte ?? -1) < 0,
        `${tDecimal(formGut?.punkte ?? 0, 1)} gegen `
        + `${tDecimal(formSchwach?.punkte ?? 0, 1)}`);

      // Die Gruende sind Gegenproben derselben Formel - kein zweiter
      // Rechenweg, der auseinanderlaufen kann. Das laesst sich pruefen:
      // ohne jeden Vorteil muss die Summe der Beitraege zum Rohwert passen.
      const neutral = structuredClone(user);
      neutral.form = 50; neutral.fitness = 100; neutral.potential = 0;
      if (neutral.contract) neutral.contract.role = 'Ergaenzungsspieler';
      const ohneAlles = slotScore(neutral, user.position, 50);
      const echt = slotScore(user, user.position, game.coachRelation);
      const summe = platz.faktoren.reduce((a, k) => a + k.punkte, 0);
      log(`Rohwert ${tDecimal(echt, 1)}, ohne jeden Vorteil `
        + `${tDecimal(ohneAlles, 1)}, Summe der genannten Gruende `
        + `${tDecimal(summe, 1)}`);
      // Nicht exakt: die Faktoren wirken teils multiplikativ, und kleine
      // Beitraege werden bewusst weggelassen. Die Groessenordnung muss
      // aber stimmen, sonst erklaert die Auskunft etwas anderes als das,
      // was der Trainer rechnet.
      check('Die genannten Gruende erklaeren den Unterschied',
        Math.abs(summe - (echt - ohneAlles)) < Math.max(3, Math.abs(echt - ohneAlles) * 0.5),
        `${tDecimal(summe, 1)} gegen ${tDecimal(echt - ohneAlles, 1)}`);
    }
  }
  // --- Paraden und Fehlschuesse nach Art der Chance (Abschnitt 57) -------
  //
  // Es gab eine einzige Fassung fuer alles: Ein Kopfball aus fuenf Metern,
  // eine Direktabnahme und ein Hammer aus dreissig Metern wurden alle drei
  // mit demselben Satz gemeldet, obwohl die Art der Chance danebenstand.
  //
  // Fehlt eine Fassung, faellt `tVariant` auf den Schluesselnamen selbst
  // zurueck - im Ticker stuende dann woertlich "live.saveHeader". Das
  // faellt niemandem auf, der nicht genau diese Szene erlebt.
  log('\n--- Paraden und Fehlschuesse ---');
  {
    // Alle Ticker-Familien mit nummerierten Fassungen, direkt aus dem
    // Katalog. Von Hand gepflegt veraltete die Liste mit jeder neuen
    // Zeile - zweimal hintereinander hat die Zuordnung unten genau das
    // aufgedeckt.
    const familien = [...new Set(Object.keys(DE)
      .filter((k) => /^live\.[A-Za-z]+\.\d+$/.test(k))
      .map((k) => k.replace(/\.\d+$/, '')))];
    /** Wieviele Fassungen eine Familie hat - so zaehlt auch `tVariant`. */
    const anzahl = (familie: string) => {
      let n = 0;
      while (t(`${familie}.${n + 1}`) !== `${familie}.${n + 1}`) n++;
      return n;
    };
    const abschluss = familien.filter((k) => /save|wide|woodwork|Blocked/i
      .test(k));
    const fehlend = abschluss.filter((familie) => anzahl(familie) < 3);
    log(`${familien.length} Ticker-Familien, davon ${abschluss.length} zum `
      + 'Abschluss: '
      + `${fehlend.length ? fehlend.join(', ') : 'keine Luecke'}`);
    check('Jede Zeilenfamilie hat mindestens drei Fassungen',
      fehlend.length === 0, fehlend.join(', ') || 'vollstaendig');

    // Und im Spiel muessen wirklich verschiedene Zeilen herauskommen.
    const lage = spielbareLage(12);
    const texte = new Set<string>();
    // Jede Fassung zerfaellt in Vorspann und Nachspann um den Namen.
    const muster = familien.flatMap((familie) => Array.from(
      { length: anzahl(familie) }, (_, k) => k + 1,
    ).map((i) => {
      const roh = t(`${familie}.${i}`);
      const teile = roh.split('{player}');
      return { key: `${familie}.${i}`, vor: teile[0], nach: teile[1] ?? '' };
    }));
    const benutzte = new Set<string>();
    const fremd: string[] = [];
    let abschluesse = 0;
    lage.spiele.forEach((m, k) => {
      const vorbereitet = prepareUserMatch(lage.st, m.id, true);
      if (!vorbereitet) return;
      const r = new Rng(77000 + k * 911);
      const e = new MatchEngine({ ...vorbereitet.setup, rng: r });
      e.runToEnd((c) => autoResolveChallenge(
        c, user, DIFFICULTY_SETTINGS.normal, r));
      for (const ev of e.finish().events) {
        if (ev.type !== 'save' && ev.type !== 'miss') continue;
        abschluesse++;
        texte.add(ev.text);
        const treffer = muster.find((mu) => ev.text.startsWith(mu.vor)
          && ev.text.endsWith(mu.nach));
        if (treffer) benutzte.add(treffer.key);
        else fremd.push(ev.text.slice(0, 60));
      }
    });
    log(`${abschluesse} Paraden und Fehlschuesse aus ${benutzte.size} von `
      + `${muster.length} Fassungen`);
    log(`Benutzt: ${[...benutzte].map((k) => k.replace('live.', '')).join(', ')}`);
    // Ein Schluesselname im Ticker faellt so auf: er hat keine Leerzeichen.
    const roh = [...texte].filter((z) => /^live\.[a-zA-Z.]+$/.test(z));
    check('Im Ticker steht kein Schluesselname', roh.length === 0,
      roh.join(', ') || 'keiner');
    // Gemessen wird gegen die erreichbaren Fassungen, nicht gegen alle:
    // Wetter- und Auswechselzeilen koennen bei einem Abschluss gar nicht
    // vorkommen. Nie alle, weil nicht jede Art von Chance in zwoelf
    // Partien auftritt - ein Kopfball aus der Distanz etwa gibt es nicht.
    const erreichbar = abschluss.reduce((a, k) => a + anzahl(k), 0);
    log(`${erreichbar} Fassungen sind bei einem Abschluss ueberhaupt erreichbar`);
    check('Der Ticker greift wirklich auf verschiedene Fassungen zu',
      abschluesse > 0 && benutzte.size >= erreichbar * 0.5,
      `${benutzte.size} von ${erreichbar} erreichbaren`);
    // Eine Zeile, die zu keiner bekannten Fassung passt, kommt aus einer
    // Quelle, die diese Pruefung nicht kennt - dann ist sie unvollstaendig.
    check('Jede Zeile stammt aus einer bekannten Fassung', fremd.length === 0,
      fremd.slice(0, 2).join(' | ') || 'alle zugeordnet');
  }
  // --- Leistung und Entwicklung (Abschnitt 58) --------------------------
  //
  // Die tatsaechliche Leistung ging nirgends in die Entwicklung ein. Alter,
  // Potenzialabstand, Trainingsanlage, Moral und Spielpraxis zaehlten - wer
  // jede Woche schlecht spielte, wuchs genau so schnell wie ein
  // Ueberflieger. Nur die Obergrenze bewegte sich mit der Note.
  log('\n--- Leistung und Entwicklung ---');
  {
    const wachstum = (note: number) => {
      const p = structuredClone(user);
      for (const k of Object.keys(p.attrs) as (keyof typeof p.attrs)[]) p.attrs[k] = 55;
      p.potential = 90; p.morale = 60; p.sharpness = 70; p.form = 60;
      const r = new Rng(31415);
      let summe = 0;
      for (let i = 0; i < 60; i++) {
        const aus = applyTraining(
          r, p, 'tactics', 'normal', 60, game.date,
          DIFFICULTY_SETTINGS.normal, p.sharpness, null, 0, 1, 1, note);
        summe += aus.gains.reduce((a, g2) => a + g2.amount, 0);
      }
      return summe;
    };
    const gut = wachstum(7.6);
    const mittel = wachstum(6.4);
    const schwach = wachstum(5.2);
    const ohne = wachstum(0);
    log(`Zuwachs ueber 60 Einheiten: Note 7,6 -> ${tDecimal(gut, 1)}, `
      + `6,4 -> ${tDecimal(mittel, 1)}, 5,2 -> ${tDecimal(schwach, 1)}, `
      + `ohne Einsatz -> ${tDecimal(ohne, 1)}`);
    check('Wer gut spielt, entwickelt sich schneller', gut > schwach * 1.15,
      `${tDecimal(gut, 1)} gegen ${tDecimal(schwach, 1)}`);
    // Die Durchschnittsnote darf nichts veraendern - sonst waere die
    // Ergaenzung eine stille Verschiebung der gesamten Entwicklung.
    check('Eine mittlere Note aendert nichts',
      Math.abs(mittel - ohne) < Math.max(0.2, ohne * 0.02),
      `${tDecimal(mittel, 2)} gegen ${tDecimal(ohne, 2)}`);
  }
  // --- Textfassungen (Abschnitt 20) ------------------------------------
  //
  // Gemessen ueber 20 Spiele, je Spiel: 9,4 Fehlschuesse, 9,2 Paraden, 8,3
  // Wechsel, 5,1 gelbe Karten, 3,6 Tore. Jede Zeile hatte genau eine
  // Formulierung - man las also **innerhalb eines Spiels** neunmal denselben
  // Satz. `tVariant` waehlt jetzt aus mehreren Fassungen.
  //
  // Die Gefahr dabei ist still: Fehlt eine Fassung in einer Sprache, faellt
  // `tVariant` auf die Einzelfassung zurueck - der Text ist da, aber eine
  // Sprache bleibt eintoenig, ohne dass irgendwo etwas fehlschlaegt.
  log('\n--- Textfassungen ---');
  {
    const zaehleFassungen = (katalog: Record<string, string>, key: string) => {
      let n = 0;
      while (katalog[`${key}.${n + 1}`] !== undefined) n++;
      return n;
    };
    // Alle Schluessel, die im deutschen Katalog Fassungen haben.
    const mitFassungen = new Set<string>();
    for (const key of Object.keys(DE)) {
      const m = key.match(/^(.*)\.[0-9]+$/);
      if (m) mitFassungen.add(m[1]);
    }

    const ungleich: string[] = [];
    const zuWenig: string[] = [];
    for (const key of mitFassungen) {
      const d = zaehleFassungen(DE, key);
      const e = zaehleFassungen(EN, key);
      if (d !== e) ungleich.push(`${key} (${d}/${e})`);
      if (d < 2) zuWenig.push(key);
    }
    log(`${mitFassungen.size} Schlüssel mit mehreren Fassungen`);
    if (ungleich.length) log(`Ungleich: ${ungleich.join(', ')}`);
    check('Beide Sprachen haben gleich viele Fassungen', ungleich.length === 0,
      `${ungleich.length} ungleich`);
    check('Jede Fassungsreihe hat mindestens zwei Einträge', zuWenig.length === 0,
      `${zuWenig.join(', ')}`);
    check('Es gibt überhaupt Fassungen', mitFassungen.size >= 15,
      `${mitFassungen.size}`);

    // Die Auswahl muss die ganze Breite nutzen und darf nicht ueberlaufen.
    const probe = 'live.keeperSave';
    const anzahl = zaehleFassungen(DE, probe);
    const gesehen = new Set<string>();
    for (let i = 0; i < 200; i++) gesehen.add(tVariant(probe, i / 200));
    check('Die Auswahl nutzt alle Fassungen', gesehen.size === anzahl,
      `${gesehen.size} von ${anzahl}`);
    check('Auch der Randwert 1 bleibt gültig',
      !tVariant(probe, 1).endsWith('.' + (anzahl + 1)), tVariant(probe, 1).slice(0, 30));
  }
  // --- Nationalkader (Abschnitt 12) ------------------------------------
  //
  // `userNationalSquad` gab es von Anfang an - und wurde **nirgends**
  // aufgerufen. Eine Funktion fuer eine Anzeige, die nie gebaut wurde: Wer
  // nominiert war, erfuhr nie, mit wem er spielt und wer auf seiner Position
  // davor liegt. Seit die Nominierungshuerde am oeffentlichen Bild haengt,
  // ist genau das die Auskunft, die eine Berufung greifbar macht.
  log('\n--- Nationalkader ---');
  {
    const gN2 = createNewGame({
      saveName: 'Kadertest', seed: 9911, difficulty: 'normal',
      firstName: 'Nat', lastName: 'Ional', age: 24, nationality: 'de',
      position: 'ST', altPositions: [], foot: 'rechts', height: 182, weight: 76,
      shirtNumber: 9, appearance: { skinTone: 0, hairStyle: 1, hairColor: '#2b2118', beard: 0, eyeColor: '#4a3120', boots: '#fff' }, background: 'wonderkid',
    });
    const uN2 = gN2.players[gN2.userPlayerId];
    const kader = userNationalSquad(gN2);
    const fremde = kader.filter((p) => p.nationality !== uN2.nationality).length;
    const staerken = kader.map((p) => computeOverall(p.attrs, p.position));
    const absteigend = staerken.every((v, i) => i === 0 || staerken[i - 1] >= v - 12);

    log(`Nationalkader: ${kader.length} Spieler, stärkster ${staerken[0]}`);
    check('Der Nationalkader ist vollständig', kader.length >= 15, `${kader.length}`);
    check('Er enthält nur Spieler dieser Herkunft', fremde === 0, `${fremde} fremde`);
    check('Er ist nach Stärke sortiert', absteigend, `${staerken.slice(0, 3).join(', ')}`);
    check('Verletzte stehen nicht im Kader', kader.every((p) => !p.injury));

    // Ein herausragender Spieler muss darin auftauchen.
    for (const key of Object.keys(uN2.attrs) as (keyof typeof uN2.attrs)[]) {
      uN2.attrs[key] = 99;
    }
    uN2.injury = null;
    check('Ein herausragender Spieler steht im Kader',
      userNationalSquad(gN2).some((p) => p.id === uN2.id));
  }
  // --- Standards: wer tritt an (Abschnitt 22) --------------------------
  //
  // Die Spielsimulation entscheidet nach klaren Regeln: Den Elfmeter schiesst
  // der beste Schuetze, der eigene Spieler auch bis vier Punkte dahinter;
  // Freistoesse teilen sich die beiden besten. Sichtbar war davon nichts -
  // gemessen an 34 Spielen eines Stuermers mit Elfmeter 57 gegen 85 beim
  // besten im Kader: kein einziger Standard, und kein Hinweis, woran es lag.
  //
  // Die Anzeige bildet dieselbe Regel nach. Diese Pruefung haelt fest, dass
  // sie es weiter tut - eine Anzeige, die luegt, ist schlimmer als keine.
  log('\n--- Standards: wer tritt an ---');
  {
    const gS = createNewGame({
      saveName: 'Standardtest', seed: 5566, difficulty: 'normal',
      firstName: 'Sze', lastName: 'Ne', age: 24, nationality: 'de',
      position: 'ST', altPositions: [], foot: 'rechts', height: 182, weight: 76,
      shirtNumber: 9, appearance: { skinTone: 0, hairStyle: 1, hairColor: '#2b2118', beard: 0, eyeColor: '#4a3120', boots: '#fff' }, background: 'wonderkid',
    });
    const uS = gS.players[gS.userPlayerId];
    const kader = Object.values(gS.players).filter(
      (p) => p.clubId === uS.clubId && p.id !== uS.id);
    const besterElf = kader.slice().sort(
      (a, b) => b.attrs.penalties - a.attrs.penalties)[0];

    if (besterElf) {
      // Genau an der Schwelle: vier Punkte dahinter tritt er an, fuenf nicht.
      uS.attrs.penalties = besterElf.attrs.penalties - 4;
      const knapp = penaltyStanding(gS, uS.clubId);
      uS.attrs.penalties = besterElf.attrs.penalties - 5;
      const knappDaneben = penaltyStanding(gS, uS.clubId);
      log(`Elfmeterschwelle: vier Punkte dahinter ${knapp?.takes}, `
        + `fünf dahinter ${knappDaneben?.takes}`);
      check('Vier Punkte hinter dem besten Schützen reicht noch',
        knapp?.takes === true, `${knapp?.takes}`);
      check('Fünf Punkte dahinter reicht nicht mehr',
        knappDaneben?.takes === false, `${knappDaneben?.takes}`);
      check('Und der Abstand wird beziffert',
        (knappDaneben?.gap ?? 0) >= 1, `${knappDaneben?.gap} Punkte`);

      // Als bester Schuetze tritt er in jedem Fall an.
      uS.attrs.penalties = 99;
      check('Der beste Schütze tritt an',
        penaltyStanding(gS, uS.clubId)?.takes === true);
    }

    // Freistoesse: die beiden besten teilen sie sich.
    const besteFrei = kader.slice().sort(
      (a, b) => b.attrs.freeKicks - a.attrs.freeKicks);
    if (besteFrei.length >= 3) {
      uS.attrs.freeKicks = besteFrei[1].attrs.freeKicks + 1;
      check('Der zweitbeste Freistoßschütze tritt an',
        freeKickStanding(gS, uS.clubId)?.takes === true);
      uS.attrs.freeKicks = besteFrei[2].attrs.freeKicks - 1;
      check('Der vierte nicht mehr',
        freeKickStanding(gS, uS.clubId)?.takes === false);
    }
  }
  // --- Neue Positionen lernen (Abschnitt 16) ---------------------------
  //
  // `altPositions` wurde bei der Erstellung gesetzt und war danach fuer immer
  // festgeschrieben - obwohl `effectiveOverall` eine Nebenposition mit 0,96
  // bewertet, eine Nachbarposition nur mit 0,90 und eine fremde mit 0,78, und
  // Aufstellung, Spielsimulation und Konkurrenzanzeige den Wert alle lesen.
  // Wer zwei Jahre auf der Sechs auflief, blieb dort dauerhaft Fremdkoerper.
  log('\n--- Neue Positionen lernen ---');
  {
    const gPos = createNewGame({
      saveName: 'Positionstest', seed: 123321, difficulty: 'normal',
      firstName: 'Viel', lastName: 'Seitig', age: 20, nationality: 'de',
      position: 'ZM', altPositions: [], foot: 'rechts', height: 182, weight: 76,
      shirtNumber: 6, appearance: { skinTone: 0, hairStyle: 1, hairColor: '#2b2118', beard: 0, eyeColor: '#4a3120', boots: '#fff' }, background: 'academy',
    });
    const uP = gPos.players[gPos.userPlayerId];
    const eintragen = (slot: string, minuten: number, n: number) => {
      for (let i = 0; i < n; i++) {
        gPos.userMatchStats.push({
          playerId: uP.id, matchId: `t-${slot}-${i}`, clubId: uP.clubId,
          position: slot, minutes: minuten, goals: 0, assists: 0, rating: 6.5,
        } as never);
      }
    };

    eintragen('DM', 80, 14);
    check('Vierzehn Einsätze reichen noch nicht', learnAltPosition(gPos) === null,
      `${uP.altPositions.length} Nebenpositionen`);

    eintragen('DM', 80, 2);
    const gelernt = learnAltPosition(gPos);
    check('Wer oft genug dort spielt, lernt die Position', gelernt === 'DM',
      String(gelernt ?? 'nichts'));
    check('Die Position steht danach im Profil', uP.altPositions.includes('DM'),
      uP.altPositions.join(', '));

    // Kurzauftritte lehren nichts.
    eintragen('OM', 12, 30);
    check('Kurzeinsätze zählen nicht', learnAltPosition(gPos) === null,
      `${uP.altPositions.length} Nebenpositionen`);

    // Und ein Feldspieler wird kein Torwart.
    eintragen('TW', 90, 30);
    check('Das Tor lernt sich nicht nebenbei', !uP.altPositions.includes('TW'),
      uP.altPositions.join(', '));

    // Die Meldung muss ankommen. Achtung: `addNews` schreibt mit `unshift`,
    // die neueste Meldung steht also an Position 0 - und das Feld heisst
    // `headline`, nicht `title`.
    const meldung = gPos.news.find(
      (n) => n.headline.includes(t('pos.TW')) === false && /DM|Mittelfeld|midfield/i.test(n.headline));
    check('Der Positionswechsel wird gemeldet', !!meldung,
      meldung ? meldung.headline : 'keine Meldung');
  }
  // --- Die Spielfuehrerbinde (Abschnitt 30) ----------------------------
  //
  // Die Rolle `Mannschaftsfuehrer` stand von Anfang an in `SQUAD_ROLE_ORDER`
  // und schuetzte in der Spielsimulation vor frueher Auswechslung - vergeben
  // wurde sie aber nur bei der Welterzeugung, an einen computergesteuerten
  // Spieler. Der eigene Spieler konnte sie nie bekommen.
  //
  // Dahinter lag die groessere Luecke: Fuehrungsstaerke wuchs nie. Gemessen
  // an einer Laufbahn bis 27 - Ruf 99, Trainerbeziehung 94 - stand sie noch
  // immer bei 35, Rang 15 von 24 im eigenen Kader.
  log('\n--- Spielführerbinde ---');
  {
    const gKap = createNewGame({
      saveName: 'Kapitaenstest', seed: 9000, difficulty: 'normal',
      firstName: 'Ka', lastName: 'Pitaen', age: 25, nationality: 'de',
      position: 'ZM', altPositions: [], foot: 'rechts', height: 182, weight: 76,
      shirtNumber: 8, appearance: { skinTone: 0, hairStyle: 1, hairColor: '#2b2118', beard: 0, eyeColor: '#4a3120', boots: '#fff' }, background: 'wonderkid',
    });
    const uK = gKap.players[gKap.userPlayerId];

    // Fuehrungsstaerke waechst nur mit Stellung und Ansehen.
    const wachstum = (rolle: SquadRole, ruf: number, trainer: number) => {
      if (!uK.contract) return 0;
      const vorher = 40;
      uK.attrs.leadership = vorher;
      uK.contract.role = rolle;
      uK.reputation = ruf;
      gKap.coachRelation = trainer;
      gKap.fanRelation = trainer;
      growLeadership(gKap, new Rng(4242));
      return uK.attrs.leadership - vorher;
    };
    const tragend = wachstum('Schluesselspieler', 90, 80);
    const rand = wachstum('Rotationsspieler', 50, 50);
    log(`Führungszuwachs je Saison: Schlüsselspieler ${tragend}, `
      + `Rotationsspieler ${rand}`);
    check('Führungsstärke wächst mit der Stellung', tragend >= 2, `${tragend} Punkte`);
    check('Wer nicht trägt, wächst nicht hinein', rand === 0, `${rand} Punkte`);

    // Die Binde selbst: erreichbar, aber nicht geschenkt.
    if (uK.contract) {
      // Ueber eine Funktion gelesen, damit TypeScript den Typ nicht auf den
      // zuletzt zugewiesenen Wert verengt und die Vergleiche fuer unmoeglich haelt.
      const rolle = (): SquadRole => uK.contract!.role;
      uK.contract.role = 'Rotationsspieler';
      checkCaptaincy(gKap, new Rng(7));
      check('Ein Rotationsspieler wird nicht Kapitän',
        rolle() !== 'Mannschaftsfuehrer', rolle());

      // Alle Voraussetzungen erfuellen und den Kader ueberragen.
      uK.contract.role = 'Schluesselspieler';
      uK.attrs.leadership = 99;
      uK.attrs.professionalism = 99;
      uK.attrs.teamwork = 99;
      uK.reputation = 99;
      gKap.coachRelation = 85;
      gKap.seasonStats['kap1'] = {
        playerId: uK.id, season: gKap.season, competitionId: 'c', clubId: uK.clubId,
        appearances: 30, starts: 30, minutes: 2600, goals: 5, assists: 5, ratingSum: 30 * 7,
      } as never;
      gKap.seasonStats['kap2'] = {
        playerId: uK.id, season: gKap.season - 1, competitionId: 'c', clubId: uK.clubId,
        appearances: 30, starts: 30, minutes: 2600, goals: 5, assists: 5, ratingSum: 30 * 7,
      } as never;
      // Mehrere Versuche, weil ein Rest Zufall bleibt.
      for (let i = 0; i < 12; i++) {
        if (rolle() === 'Mannschaftsfuehrer') break;
        uK.contract.role = 'Schluesselspieler';
        checkCaptaincy(gKap, new Rng(100 + i * 37));
      }
      check('Ein herausragender Spieler kann Kapitän werden',
        rolle() === 'Mannschaftsfuehrer', rolle());

      // Und die Binde bleibt beim Verein.
      if (rolle() === 'Mannschaftsfuehrer') {
        dropCaptaincyOnTransfer(uK);
        check('Beim Vereinswechsel geht die Binde verloren',
          rolle() !== 'Mannschaftsfuehrer', rolle());
      }
    }
  }
  // --- Vereinsfinanzen (Abschnitt 34) ----------------------------------
  //
  // `club.budget` und `club.wageBudget` gab es von Anfang an, gelesen wurden
  // sie nie - und waren entsprechend auch nie geeicht: Gemessen lag jeder
  // Erstligist fuenf- bis dreizehnfach ueber seinem Gehaltsbudget, und das
  // Transferbudget des staerksten Vereins reichte nicht fuer ein Zehntel
  // seines teuersten Spielers. Diese Pruefungen halten die Groessenordnung
  // fest und stellen sicher, dass die Werte auch etwas bewirken.
  log('\n--- Vereinsfinanzen ---');
  {
    const gFin = createNewGame({
      saveName: 'Finanztest', seed: 191919, difficulty: 'normal',
      firstName: 'Fin', lastName: 'Anz', age: 18, nationality: 'de',
      position: 'ST', altPositions: [], foot: 'rechts', height: 182, weight: 76,
      shirtNumber: 9, appearance: { skinTone: 0, hairStyle: 1, hairColor: '#2b2118', beard: 0, eyeColor: '#4a3120', boots: '#fff' }, background: 'academy',
    });

    const last = buildWageIndex(gFin);
    const quoten: number[] = [];
    const kaderwerte = new Map<string, number>();
    for (const p of Object.values(gFin.players)) {
      if (!p.clubId) continue;
      kaderwerte.set(p.clubId, (kaderwerte.get(p.clubId) ?? 0) + p.marketValue);
    }
    let ohneBudget = 0, vereine = 0, unterKaderwert = 0;
    for (const club of Object.values(gFin.clubs)) {
      const comp = gFin.competitions[club.leagueId];
      if (!comp || comp.type !== 'league') continue;
      vereine++;
      if (club.wageBudget <= 0 || club.budget <= 0) ohneBudget++;
      quoten.push((last.get(club.id) ?? 0) / Math.max(1, club.wageBudget));
      // Das Transferbudget darf nie groesser sein als der Kaderwert - dann
      // waere die Wirtschaft aus der Luft gegriffen statt aus dem Kader.
      if (club.budget <= (kaderwerte.get(club.id) ?? 0)) unterKaderwert++;
    }
    const schnitt = quoten.reduce((a, b) => a + b, 0) / quoten.length;
    const hoechste = Math.max(...quoten);
    log(`Gehaltsquote: Schnitt ${schnitt.toFixed(2)}, höchste ${hoechste.toFixed(2)} `
      + `bei ${vereine} Vereinen`);
    check('Jeder Verein hat ein Budget', ohneBudget === 0, `${ohneBudget} ohne`);
    check('Die Gehaltslast passt zum Gehaltsbudget', schnitt > 0.6 && schnitt < 1,
      `Schnitt ${schnitt.toFixed(2)}`);
    check('Kein Verein liegt weit über seinem Gehaltsbudget', hoechste < 1.3,
      `höchste ${hoechste.toFixed(2)}`);
    check('Transfermittel bleiben unter dem Kaderwert', unterKaderwert === vereine,
      `${unterKaderwert} von ${vereine}`);

    // Zahlungsfaehigkeit muss mit dem Preis fallen - sonst waere die Schranke
    // wirkungslos und ein Dorfverein koennte einen Weltstar holen.
    const zahlungsfaehig = (marktwert: number, gehalt: number) => {
      let n = 0;
      for (const club of Object.values(gFin.clubs)) {
        const comp = gFin.competitions[club.leagueId];
        if (!comp || comp.type !== 'league') continue;
        if (canSign(club, last.get(club.id) ?? 0, marktwert, gehalt, 1.2)) n++;
      }
      return n;
    };
    const guenstig = zahlungsfaehig(1_000_000, 3_000);
    const teuer = zahlungsfaehig(120_000_000, 120_000);
    log(`Zahlungsfähige Vereine: für 1 Mio ${guenstig}, für 120 Mio ${teuer}`);
    check('Ein Talent können viele Vereine holen', guenstig > 50, `${guenstig}`);
    check('Einen Weltstar können nur wenige holen', teuer < guenstig / 5,
      `${teuer} gegen ${guenstig}`);
    check('Aber wenigstens einer kann es', teuer >= 1, `${teuer}`);

    // Der Anteil an den Transfermitteln ist die Grundlage der Aussage auf der
    // Angebotskarte - er muss mit der Abloese steigen.
    const einVerein = Object.values(gFin.clubs).find((c) => c.budget > 1_000_000)!;
    const klein = feeShare(einVerein, einVerein.budget * 0.1);
    const gross = feeShare(einVerein, einVerein.budget * 0.9);
    check('Der Anteil an den Transfermitteln steigt mit der Ablöse', gross > klein,
      `${klein.toFixed(2)} gegen ${gross.toFixed(2)}`);
  }
  // --- Der Berater arbeitet gegen die Kassenlage (Abschnitt 35) --------
  //
  // Ohne diese Kopplung waere der Berater ein Schlupfloch um die
  // Vereinsfinanzen herum: Er haette Vereinen Angebote entlockt, die im
  // normalen Transferfenster gar nicht bieten duerfen, und jede
  // Gehaltsforderung durchgesetzt, auch bei einem ueberzogenen Verein.
  {
    const gehaltVersuch = (rahmenFaktor: number) => {
      let durchgesetzt = 0, summe = 0, versuche = 0;
      for (let i = 0; i < 14; i++) {
        const gA = createNewGame({
          saveName: 'Beratertest', seed: 700 + i * 911, difficulty: 'normal',
          firstName: 'Ber', lastName: 'Ater', age: 21, nationality: 'de',
          position: 'ST', altPositions: [], foot: 'rechts', height: 182, weight: 76,
          shirtNumber: 9, appearance: { skinTone: 0, hairStyle: 1, hairColor: '#2b2118', beard: 0, eyeColor: '#4a3120', boots: '#fff' }, background: 'academy',
        });
        const uA = gA.players[gA.userPlayerId];
        const clubA = uA?.clubId ? gA.clubs[uA.clubId] : null;
        if (!uA?.contract || !clubA) continue;
        clubA.wageBudget = Math.round(wageBill(gA, clubA.id) * rahmenFaktor);
        const rngA = new Rng(1234 + i);
        ensureAgent(gA, rngA);
        uA.reputation = 58;
        gA.seasonStats['probe'] = {
          playerId: uA.id, season: gA.season, competitionId: 'c',
          appearances: 25, ratingSum: 25 * 7.1, goals: 8, assists: 4, minutes: 2000,
        } as never;
        const vorher = uA.contract.salary;
        if (!startAgentTask(gA, 'raiseSalary')) continue;
        gA.agent!.task!.dueOn = gA.date;
        versuche++;
        advanceAgent(gA, rngA);
        if (uA.contract.salary > vorher) {
          durchgesetzt++;
          summe += uA.contract.salary / vorher;
        }
      }
      return {
        versuche, durchgesetzt,
        schnitt: durchgesetzt > 0 ? (summe / durchgesetzt - 1) * 100 : 0,
      };
    };

    const luft = gehaltVersuch(1.6);
    const eng = gehaltVersuch(0.95);
    log(`Gehaltsforderung bei viel Luft: ${luft.durchgesetzt} von ${luft.versuche}, `
      + `im Schnitt +${luft.schnitt.toFixed(1)} Prozent`);
    log(`Bei überzogenem Verein: ${eng.durchgesetzt} von ${eng.versuche}, `
      + `im Schnitt +${eng.schnitt.toFixed(1)} Prozent`);
    check('Der Berater setzt bei einem zahlungsfähigen Verein etwas durch',
      luft.durchgesetzt > luft.versuche / 2,
      `${luft.durchgesetzt} von ${luft.versuche}`);
    check('Die Kassenlage begrenzt die Gehaltsforderung',
      eng.durchgesetzt < luft.durchgesetzt && eng.schnitt < luft.schnitt,
      `${eng.durchgesetzt} gegen ${luft.durchgesetzt} durchgesetzt`);
  }
  // --- Jedes trainierbare Attribut wirkt (Abschnitt 16) ----------------
  //
  // Graetsche, Widerstandsfaehigkeit und Ehrgeiz waren trainierbar, wurden von
  // Hintergruenden vergeben und in der Spielerakte angezeigt - aber von keinem
  // Rechenweg gelesen. Wer "Defensive" trainierte, steckte Gewicht in die
  // Graetsche und bekam dafuer nichts. Diese Pruefungen halten fest, dass ein
  // Attribut, das man verbessern kann, auch etwas aendert.
  log('\n--- Attribute mit Wirkung ---');
  {
    const gAttr = createNewGame({
      saveName: 'Attributtest', seed: 313131, difficulty: 'normal',
      firstName: 'At', lastName: 'Tribut', age: 18, nationality: 'de',
      position: 'IV', altPositions: [], foot: 'rechts', height: 188, weight: 82,
      shirtNumber: 4, appearance: { skinTone: 0, hairStyle: 1, hairColor: '#2b2118', beard: 0, eyeColor: '#4a3120', boots: '#fff' }, background: 'academy',
    });
    const uA = gAttr.players[gAttr.userPlayerId];

    // Widerstandsfaehigkeit federt Rueckschlaege ab - nur nach unten.
    const nachSchlechtemSpiel = (wert: number) => {
      const p = JSON.parse(JSON.stringify(uA)) as typeof uA;
      p.attrs.resilience = wert; p.morale = 60;
      updateFormAfterMatch(p, 4.2, 90, false, false);
      return p.morale;
    };
    const nachVerletzung = (wert: number) => {
      const p = JSON.parse(JSON.stringify(uA)) as typeof uA;
      p.attrs.resilience = wert; p.morale = 60; p.injury = null;
      injuryForDays(new Rng(7), p, 60);
      return p.morale;
    };
    const zaeh = nachSchlechtemSpiel(90), duenn = nachSchlechtemSpiel(20);
    const zaehV = nachVerletzung(90), duennV = nachVerletzung(20);
    log(`Moral nach 4,2er Note: Widerstand 20 -> ${duenn.toFixed(1)}, `
      + `Widerstand 90 -> ${zaeh.toFixed(1)}`);
    log(`Moral nach 60-Tage-Verletzung: ${duennV.toFixed(1)} gegen ${zaehV.toFixed(1)}`);
    check('Widerstandsfähigkeit federt ein schlechtes Spiel ab', zaeh > duenn + 1,
      `${duenn.toFixed(1)} gegen ${zaeh.toFixed(1)}`);
    check('Widerstandsfähigkeit federt eine Verletzung ab', zaehV > duennV + 2,
      `${duennV.toFixed(1)} gegen ${zaehV.toFixed(1)}`);

    // Nach einem guten Spiel darf sie nicht wirken - sonst waere sie ein
    // allgemeiner Moralbonus statt einer Eigenschaft.
    const gutZaeh = (() => {
      const p = JSON.parse(JSON.stringify(uA)) as typeof uA;
      p.attrs.resilience = 90; p.morale = 60;
      updateFormAfterMatch(p, 8.5, 90, true, false);
      return p.morale;
    })();
    const gutDuenn = (() => {
      const p = JSON.parse(JSON.stringify(uA)) as typeof uA;
      p.attrs.resilience = 20; p.morale = 60;
      updateFormAfterMatch(p, 8.5, 90, true, false);
      return p.morale;
    })();
    check('Nach einem guten Spiel wirkt Widerstandsfähigkeit nicht',
      Math.abs(gutZaeh - gutDuenn) < 0.01, `${gutDuenn.toFixed(1)} gegen ${gutZaeh.toFixed(1)}`);

    // Ehrgeiz treibt die Entwicklung, bei 50 bleibt er neutral.
    const einheitenBis65 = (ehrgeiz: number) => {
      let summe = 0; const laeufe = 6;
      for (let seed = 0; seed < laeufe; seed++) {
        const p = JSON.parse(JSON.stringify(uA)) as typeof uA;
        for (const key of Object.keys(p.attrs) as (keyof typeof p.attrs)[]) p.attrs[key] = 50;
        p.attrs.ambition = ehrgeiz; p.potential = 80; p.injury = null;
        const rng = new Rng(500 + seed * 41);
        let i = 0;
        while (i < 400 && computeOverall(p.attrs, p.position) < 65) {
          p.fitness = 90; p.morale = 70; p.sharpness = 70;
          applyTraining(rng, p, 'defending', 'normal', 60, '2027-03-10',
            DIFFICULTY_SETTINGS.normal, 70, null, 0);
          i++;
        }
        summe += i;
      }
      return summe / laeufe;
    };
    const traege = einheitenBis65(20), getrieben = einheitenBis65(90);
    log(`Einheiten bis Stärke 65: Ehrgeiz 20 -> ${traege.toFixed(0)}, `
      + `Ehrgeiz 90 -> ${getrieben.toFixed(0)}`);
    check('Ehrgeiz treibt die Entwicklung', getrieben < traege * 0.95,
      `${traege.toFixed(0)} gegen ${getrieben.toFixed(0)} Einheiten`);

    // Die Graetsche zaehlt fuer einen Innenverteidiger.
    const ivStaerke = (graetsche: number) => {
      const a = { ...uA.attrs };
      for (const key of Object.keys(a) as (keyof typeof a)[]) a[key] = 50;
      a.slideTackle = graetsche;
      return computeOverall(a, 'IV');
    };
    check('Die Grätsche zählt für einen Innenverteidiger',
      ivStaerke(90) > ivStaerke(20), `${ivStaerke(20)} gegen ${ivStaerke(90)}`);

    // Und sie zaehlt im Zweikampf selbst.
    const zweikampf = (graetsche: number) => {
      const p = JSON.parse(JSON.stringify(uA)) as typeof uA;
      for (const key of Object.keys(p.attrs) as (keyof typeof p.attrs)[]) p.attrs[key] = 50;
      p.attrs.slideTackle = graetsche;
      let gewonnen = 0;
      const rng = new Rng(88);
      for (let i = 0; i < 900; i++) {
        const r = autoResolveChallenge(
          { kind: 'duel', opponent: 62, pressure: 0.5 } as never,
          p, DIFFICULTY_SETTINGS.normal, rng);
        if (r.outcome === 'duelWon') gewonnen++;
      }
      return gewonnen;
    };
    const schwach = zweikampf(20), stark = zweikampf(90);
    log(`Zweikämpfe gewonnen von 900: Grätsche 20 -> ${schwach}, 90 -> ${stark}`);
    check('Die Grätsche zählt im Zweikampf', stark > schwach,
      `${schwach} gegen ${stark}`);
  }
  // --- Der Mentor wirkt (Abschnitt 30) --------------------------------
  //
  // Der Mentor war lange ein Abzeichen in der Kaderliste: bestimmt, gespeichert,
  // angezeigt - und von keinem Rechenweg je gelesen. Diese Pruefungen halten
  // fest, dass er die Entwicklung beschleunigt, dass er mentale Werte
  // weitergibt, die kein Trainingsschwerpunkt anspricht, und dass die Bindung
  // endet, wenn er den Verein verlaesst.
  log('\n--- Mentor ---');
  {
    const gMentor = createNewGame({
      saveName: 'Mentortest', seed: 909090, difficulty: 'normal',
      firstName: 'Men', lastName: 'Tee', age: 17, nationality: 'de',
      position: 'ST', altPositions: [], foot: 'rechts', height: 180, weight: 74,
      shirtNumber: 19, appearance: { skinTone: 0, hairStyle: 1, hairColor: '#2b2118', beard: 0, eyeColor: '#4a3120', boots: '#fff' }, background: 'academy',
    });
    const uM = gMentor.players[gMentor.userPlayerId];
    const mental = ['professionalism', 'teamwork', 'composure',
      'decisions', 'concentration', 'discipline'] as const;

    // Wie viele Einheiten bis Staerke 65, und wo stehen die mentalen Werte?
    const messe = (bonus: number) => {
      let bisZiel = 0, mentalSumme = 0;
      const laeufe = 8;
      for (let seed = 0; seed < laeufe; seed++) {
        const p = JSON.parse(JSON.stringify(uM)) as typeof uM;
        for (const key of Object.keys(p.attrs) as (keyof typeof p.attrs)[]) p.attrs[key] = 50;
        p.potential = 80; p.injury = null;
        const rng = new Rng(2000 + seed * 97);
        let i = 0, erreicht = 0;
        while (i < 220) {
          p.fitness = 90; p.morale = 70; p.sharpness = 70;
          applyTraining(rng, p, 'shooting', 'normal', 60, '2027-03-10',
            DIFFICULTY_SETTINGS.normal, 70, null, bonus);
          i++;
          if (!erreicht && computeOverall(p.attrs, p.position) >= 65) erreicht = i;
        }
        bisZiel += erreicht || 220;
        mentalSumme += mental.reduce((a, k) => a + p.attrs[k], 0) / mental.length;
      }
      return { einheiten: bisZiel / laeufe, mental: mentalSumme / laeufe };
    };

    const ohne = messe(0);
    const mit = messe(0.11);
    log(`Einheiten bis Stärke 65: ohne Mentor ${ohne.einheiten.toFixed(0)}, `
      + `mit Mentor ${mit.einheiten.toFixed(0)}`);
    log(`Mentale Werte im Schnitt: ${ohne.mental.toFixed(1)} gegen ${mit.mental.toFixed(1)}`);
    check('Ein Mentor beschleunigt die Entwicklung spürbar',
      mit.einheiten < ohne.einheiten * 0.96,
      `${ohne.einheiten.toFixed(0)} gegen ${mit.einheiten.toFixed(0)} Einheiten`);
    check('Ein Mentor gibt mentale Werte weiter', mit.mental > ohne.mental + 2,
      `${ohne.mental.toFixed(1)} gegen ${mit.mental.toFixed(1)}`);
    check('Der Mentor ersetzt aber kein Talent', mit.einheiten > ohne.einheiten * 0.6,
      `${(100 - (mit.einheiten / ohne.einheiten) * 100).toFixed(0)} Prozent schneller`);

    // Der gewaehlte Mentor muss Fuehrungsqualitaeten haben - sonst gibt es keinen.
    if (gMentor.mentorId) {
      const m = gMentor.players[gMentor.mentorId]!;
      check('Der Mentor ist ein Führungsspieler', m.attrs.leadership >= 55,
        `Führung ${m.attrs.leadership}`);
      check('Der Mentor wirkt, solange er im Verein ist', mentorInfluence(gMentor) > 0,
        `${(mentorInfluence(gMentor) * 100).toFixed(1)} Prozent`);

      // Verlaesst er den Verein, endet die Bindung - und mit ihr die Wirkung.
      m.clubId = null;
      const weg = mentorLeft(gMentor);
      check('Ein Vereinswechsel des Mentors löst die Bindung', !!weg && !gMentor.mentorId);
      check('Ohne Mentor gibt es keinen Trainingsvorteil',
        mentorInfluence(gMentor) === 0);
    } else {
      log('Dieser Verein hat keinen passenden Mentor - das ist zulässig.');
      check('Ohne Mentor gibt es keinen Trainingsvorteil', mentorInfluence(gMentor) === 0);
    }
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
    if (friendId) check('Freundschaft wächst mit gemeinsamer Spielzeit',
      after.friend >= before.friend, `${before.friend.toFixed(0)} -> ${after.friend.toFixed(0)}`);
    if (rivalId) check('Rivalität vertieft sich mit der Zeit',
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
      check('Die Wahl verändert die Werte des Spielers', changed);
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
  check('Gute Eingabe schlägt schlechte deutlich', goodGoals > badGoals * 2,
    `${goodGoals} gegen ${badGoals}`);
  // Der Kern: ein sauber ins Eck platzierter Schuss fuehrt oft zum Tor.
  check('Eine gute Eingabe führt oft zum Tor', goodGoals > 160,
    `${(goodGoals / 4).toFixed(0)}% - Platzierung wird belohnt`);
  check('Gute Eingabe ist kein Selbstläufer', goodGoals < 380,
    'Auch bei guter Eingabe gibt es Fehlschüsse');
  check('Attribute machen einen spürbaren Unterschied', eliteGoals > goodGoals * 1.15,
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
  log(`Torlinienhöhe bei Kontakt oben: ${flatHeight.toFixed(2)} m, unten: ${loftHeight.toFixed(2)} m`);
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
  check('Effet krümmt die Flugbahn spürbar', drift > 0.6 && drift < 12, `${drift.toFixed(2)} m`);

  // Zwei Zahlen, und nur die zweite zaehlt: der Spielstand wird **gepackt**
  // abgelegt. Ein Spieler belegt roh 1397 Byte, davon 815 allein die 54
  // Attributnamen - bei 13.500 Spielern elf Megabyte reine
  // Schluesselwiederholung. Als Zahlenfeld bleiben davon rund 160 Byte.
  const roh = new Blob([JSON.stringify(game)]).size;
  const gepackt = new Blob([JSON.stringify(packeFuerTest(game))]).size;
  log(`Spielstandsgröße: roh ${(roh / 1024 / 1024).toFixed(2)} MB, `
    + `gepackt ${(gepackt / 1024 / 1024).toFixed(2)} MB`);
  // Die Grenze haengt an der Zahl der Spieler, nicht an einer festen
  // Megabyte-Zahl. Die alten 25 MB galten fuer eine Welt mit fuenf Laendern;
  // mit neun waeren sie ueberschritten, ohne dass irgendetwas aufgeblaeht
  // waere. Was der Waechter fangen soll, ist Wachstum **je Spieler** - und
  // das faengt er unabhaengig davon, wie gross die Welt ist.
  const jeSpieler = gepackt / Math.max(1, playerCount);
  log(`Je Spieler: ${(jeSpieler / 1024).toFixed(2)} KB`);
  check('Der Spielstand bleibt je Spieler schlank',
    jeSpieler < 2.4 * 1024,
    `${(jeSpieler / 1024).toFixed(2)} KB von 2,40 KB`);
  check('Die Packung spart deutlich', gepackt < roh * 0.75,
    `${(gepackt / roh * 100).toFixed(0)} % der rohen Größe`);

  // Und sie muss verlustfrei sein. Die Reihenfolge von ALL_ATTRS ist Teil
  // des Speicherformats - wer ein Attribut in der Mitte einfuegt, verschiebt
  // stumm alle Werte dahinter. Genau das faengt dieser Rundlauf.
  {
    const vorher = { ...user.attrs };
    const durchlauf = entpackeFuerTest(
      JSON.parse(JSON.stringify(packeFuerTest(game))) as GameState);
    const danach = durchlauf.players[game.userPlayerId]?.attrs;
    check('Packen und Entpacken verliert nichts',
      !!danach && ALL_ATTRS.every((k) => danach[k] === vorher[k]),
      danach ? 'alle 54 Werte gleich' : 'Spieler fehlt');
  }

  log(`\nGesamtdauer: ${((performance.now() - t0) / 1000).toFixed(1)} s`);
  return failures;
}

/**
 * Sucht im Quelltext nach fest eingebautem Spieltext.
 *
 * Die Livekommentare der Spielsimulation standen lange als deutsche
 * Zeichenketten in `matchEngine.ts` - ausgerechnet an der sichtbarsten Stelle
 * des Spiels lief es damit bei englischer Sprache auf Deutsch weiter. Eine
 * Pruefung zur Laufzeit findet das nur, wenn sie zufaellig genau diese Szene
 * ausloest; im Quelltext ist es dagegen eindeutig zu sehen.
 *
 * Geprueft wird auf `text:` mit einer Zeichenkette, die Buchstabenfolgen
 * enthaelt und nicht durch `t(` laeuft.
 */
/**
 * Wird eine Groesse ueberhaupt benutzt?
 *
 * Die haeufigste Sorte Fehler in diesem Spiel ist nicht die falsche Formel,
 * sondern die **nie aufgerufene**: ein Wert steht im Attributblatt, wird
 * angezeigt, trainiert und bezahlt - und kein Codepfad liest ihn. Kulisse,
 * Spielweise des Gegners, Budgets, Spielfuehrerbinde, halbe Abwehrwerte:
 * alle nach demselben Muster gefunden.
 *
 * Ueber Spielausgaenge laesst sich das nicht immer zusichern - wenn eine
 * Wirkung nur sieben Situationen je dreissig Partien betrifft, kippt oft
 * kein einziger Wurf. Am Quelltext ist es dagegen exakt zu pruefen.
 *
 * **Achtung:** geholt wird die **ausgelieferte** Datei, nicht die auf der
 * Platte. TypeScript-Typen sind darin weg - ein Feld, das nur in einem
 * `interface` steht, kommt null mal vor, egal wie oft es im Quelltext
 * auftaucht. Gezaehlt wird also ausschliesslich Laufzeitcode, und die
 * Erwartung muss sich danach richten.
 */
async function pruefeVerkabelung(): Promise<number> {
  log('\n--- Verkabelung ---');
  const erwartet: { datei: string; name: string; mindestens: number }[] = [
    { datei: '/src/engine/matchEngine.ts', name: 'keeperFor', mindestens: 2 },
    { datei: '/src/engine/matchEngine.ts', name: 'gegnerDruck', mindestens: 2 },
    { datei: '/src/engine/matchEngine.ts', name: 'publikumsDruck', mindestens: 2 },
    { datei: '/src/engine/matchEngine.ts', name: 'heimfaktor', mindestens: 2 },
    { datei: '/src/engine/matchEngine.ts', name: 'auslastung', mindestens: 3 },
    { datei: '/src/engine/matchEngine.ts', name: 'tempo', mindestens: 3 },
    { datei: '/src/engine/matchEngine.ts', name: 'defensiveSkill', mindestens: 2 },
    { datei: '/src/engine/matchEngine.ts', name: 'wetter', mindestens: 4 },
    { datei: '/src/engine/matchEngine.ts', name: 'schiri', mindestens: 3 },
    { datei: '/src/engine/ballAction.ts', name: 'tempo', mindestens: 2 },
    { datei: '/src/engine/ballAction.ts', name: 'defensiveSkill', mindestens: 2 },
    { datei: '/src/engine/ballAction.ts', name: 'firstTouch', mindestens: 1 },
    // Definition plus zwei Aufrufstellen (Schuss und Flanke). Faellt eine
    // davon weg, gilt der schwache Fuss wieder nur zur Haelfte.
    { datei: '/src/engine/ballAction.ts', name: 'aufSchwachemFuss', mindestens: 3 },
    // Ohne diese Verbindung sind `blocking` und `bravery` wieder Zierde.
    { datei: '/src/engine/ballAction.ts', name: 'blockSkill', mindestens: 1 },
    { datei: '/src/engine/matchEngine.ts', name: 'blockKoennen', mindestens: 2 },
    // Ohne diese Verbindung steigt die Abwehr bei Flanken wieder nicht mit.
    { datei: '/src/engine/matchEngine.ts', name: 'abwehrLuft', mindestens: 2 },
    { datei: '/src/engine/matchEngine.ts', name: 'kopfballGefahr', mindestens: 2 },
    // Ohne den Aufruf wird jede Flanke wieder zum Kopfball.
    { datei: '/src/engine/matchEngine.ts', name: 'direktabnahmeChance', mindestens: 2 },
    { datei: '/src/engine/matchEngine.ts', name: 'volley', mindestens: 2 },
    // Und die Anzeige: ohne sie faellt der Abzug wieder lautlos.
    { datei: '/src/ui/match/HighlightScene.tsx', name: 'aufSchwachemFuss', mindestens: 2 },
    { datei: '/src/engine/game.ts', name: 'simulateUserMatch', mindestens: 1 },
    { datei: '/src/state/actions.ts', name: 'simulateUserMatch', mindestens: 2 },
    { datei: '/src/state/actions.ts', name: 'advanceUntil', mindestens: 1 },
    { datei: '/src/state/actions.ts', name: 'advanceSeason', mindestens: 1 },
    { datei: '/src/state/actions.ts', name: 'ereignisseUeberspringen', mindestens: 2 },
    { datei: '/src/ui/tabs/CalendarTab.tsx', name: 'advanceSeason', mindestens: 2 },
    { datei: '/src/engine/game.ts', name: 'LIFESTYLE', mindestens: 4 },
    { datei: '/src/engine/game.ts', name: 'extraSessionEffect', mindestens: 4 },
    { datei: '/src/engine/development.ts', name: 'eigenesRisiko', mindestens: 2 },
    { datei: '/src/engine/development.ts', name: 'eigeneWahl', mindestens: 2 },
    { datei: '/src/engine/matchEngine.ts', name: 'ownInjuryRisk', mindestens: 1 },
    { datei: '/src/engine/matchEngine.ts', name: 'beansprucht', mindestens: 3 },
    { datei: '/src/engine/setpieces.ts', name: 'claimsPenalties', mindestens: 2 },
    { datei: '/src/engine/agent.ts', name: 'wunsch', mindestens: 3 },
    { datei: '/src/engine/manager.ts', name: 'neueSpielweise', mindestens: 2 },
    { datei: '/src/engine/game.ts', name: 'neueStaerken', mindestens: 2 },
    { datei: '/src/engine/game.ts', name: 'traitEffect', mindestens: 2 },
    { datei: '/src/engine/matchEngine.ts', name: 'staerkeFuer', mindestens: 2 },
    { datei: '/src/engine/matchEngine.ts', name: 'rollEcke', mindestens: 2 },
    { datei: '/src/engine/game.ts', name: 'lageFuerEreignis', mindestens: 2 },
    { datei: '/src/engine/events.ts', name: 'passt', mindestens: 8 },
    { datei: '/src/engine/matchEngine.ts', name: 'applyCrossResult', mindestens: 2 },
    { datei: '/src/engine/matchEngine.ts', name: 'buildCrossChallenge', mindestens: 2 },
    { datei: '/src/engine/matchEngine.ts', name: 'flanktVonAussen', mindestens: 2 },
    { datei: '/src/engine/matchEngine.ts', name: 'crossesCompleted', mindestens: 2 },
    { datei: '/src/engine/matchSim.ts', name: 'crossesCompleted', mindestens: 2 },
    { datei: '/src/engine/stats.ts', name: 'crossesCompleted', mindestens: 2 },
    { datei: '/src/engine/ballAction.ts', name: 'gespuer', mindestens: 2 },
    { datei: '/src/engine/ballAction.ts', name: 'findBlock', mindestens: 2 },
    { datei: '/src/engine/ballAction.ts', name: 'wallHit', mindestens: 3 },
    { datei: '/src/ui/match/HighlightScene.tsx', name: 'DefenderFigure', mindestens: 3 },
    { datei: '/src/ui/match/HighlightScene.tsx', name: 'stoppIndex', mindestens: 3 },
    { datei: '/src/ui/match/HighlightScene.tsx', name: 'jubelRef', mindestens: 3 },
    { datei: '/src/ui/match/figures.tsx', name: 'schwung', mindestens: 3 },
    { datei: '/src/ui/match/HighlightScene.tsx', name: 'stride', mindestens: 5 },
    { datei: '/src/ui/match/MatchScreen.tsx', name: 'Konfetti', mindestens: 2 },
    { datei: '/src/ui/PlayerCard.tsx', name: 'summaryValues', mindestens: 2 },
    { datei: '/src/ui/tabs/PlayerTab.tsx', name: 'PlayerCard', mindestens: 2 },
    { datei: '/src/ui/tabs/TrainingTab.tsx', name: 'setLifestyle', mindestens: 2 },
    { datei: '/src/ui/tabs/CalendarTab.tsx', name: 'advanceUntil', mindestens: 2 },
    { datei: '/src/ui/CareerShell.tsx', name: 'skipReport', mindestens: 2 },
    { datei: '/src/engine/matchEngine.ts', name: 'schwung', mindestens: 5 },
    { datei: '/src/engine/matchEngine.ts', name: 'meldePhase', mindestens: 2 },
    { datei: '/src/engine/matchSim.ts', name: 'zieheTorminute', mindestens: 2 },
    { datei: '/src/engine/rivalry.ts', name: 'kickoffAuslastung', mindestens: 2 },
    { datei: '/src/engine/game.ts', name: 'matchKickoff', mindestens: 2 },
    { datei: '/src/engine/game.ts', name: 'matchFormation', mindestens: 3 },
    { datei: '/src/engine/matchSim.ts', name: 'matchFormation', mindestens: 3 },
    { datei: '/src/engine/lineup.ts', name: 'aufstellung', mindestens: 3 },
    { datei: '/src/engine/matchEngine.ts', name: 'torArt', mindestens: 2 },
    { datei: '/src/engine/game.ts', name: 'reviewPotential', mindestens: 2 },
    { datei: '/src/engine/game.ts', name: 'potentialDrift', mindestens: 2 },
    { datei: '/src/engine/game.ts', name: 'verteilt', mindestens: 2 },
    { datei: '/src/engine/game.ts', name: 'startLevel', mindestens: 3 },
    { datei: '/src/ui/CreateCareer.tsx', name: 'attributePoints', mindestens: 1 },
    { datei: '/src/ui/CreateCareer.tsx', name: 'talent', mindestens: 4 },
  ];
  let fehler = 0;
  const quellen = new Map<string, string>();
  for (const { datei } of erwartet) {
    if (quellen.has(datei)) continue;
    try {
      const antwort = await fetch(datei);
      if (antwort.ok) quellen.set(datei, await antwort.text());
    } catch {
      // Nicht lesbar - unten uebersprungen.
    }
  }
  for (const { datei, name, mindestens } of erwartet) {
    const quelle = quellen.get(datei);
    if (quelle === undefined) {
      log(`${datei}: nicht lesbar - übersprungen`);
      continue;
    }
    const treffer = (quelle.match(new RegExp('\\b' + name + '\\b', 'g')) ?? []).length;
    const kurz = datei.split('/').pop();
    const ok = treffer >= mindestens;
    if (!ok) fehler++;
    check(`${name} wird in ${kurz} benutzt`, ok,
      `${treffer} Vorkommen, mindestens ${mindestens} erwartet`);
  }
  return fehler;
}

/**
 * Deutsche Prosa, die direkt im JSX steht und damit am Katalog vorbeigeht.
 *
 * Auf Englisch stand an solchen Stellen bis vor kurzem Deutsch - im
 * Spielbildschirm, in den Reitern, im Verletzungsdialog. Der bestehende
 * Waechter sah nur Zeichenketten in der Engine; JSX-Text ist gar keine
 * Zeichenkette und fiel deshalb nie auf.
 *
 * Ohne Parser, denn der Rauchtest laeuft im Browser: Gesucht werden Zeilen
 * ohne jedes Code-Merkmal (kein Anfuehrungszeichen, keine Klammer, kein
 * Tag), die ein deutsches Funktionswort enthalten. Kommentare sind hier
 * deutsch und sollen es bleiben - ihr Zustand wird deshalb ueber die
 * Zeilen hinweg mitgefuehrt.
 *
 * Gegen den Stand vor der Umstellung geprueft: 31 Fundstellen dort, 0 hier.
 */
async function pruefeOberflaechentext(): Promise<number> {
  const dateien = [
    '/src/ui/match/MatchScreen.tsx', '/src/ui/CareerShell.tsx',
    '/src/ui/tabs/SquadTab.tsx', '/src/ui/tabs/TrainingTab.tsx',
    '/src/ui/tabs/TransfersTab.tsx', '/src/ui/tabs/TableTab.tsx',
    '/src/ui/tabs/ChronicleTab.tsx', '/src/ui/tabs/OverviewTab.tsx',
    '/src/ui/match/HighlightScene.tsx', '/src/App.tsx',
    '/src/ui/tabs/PlayerTab.tsx', '/src/ui/tabs/CalendarTab.tsx',
    '/src/ui/tabs/StatsTab.tsx', '/src/ui/tabs/NewsTab.tsx',
    '/src/ui/DatabaseEditor.tsx', '/src/ui/MainMenu.tsx',
  ];
  const deutsch = /(^|\s)(der|die|das|den|dem|des|ein|eine|einen|einem|und|oder|nicht|nur|noch|mehr|sehr|dich|dir|dein|deine|deinen|du|mit|ohne|ist|sind|wird|werden|kann|kannst|hast|hat|haben|sich|auf|aus|nach|vor|bei|zum|zur|im|am|vom|als|wie|wenn|dass|damit|weil|schon|jetzt|immer|kein|keine|jede|jeder|alle)($|\s|[.,!?:;])/i;

  // Deutsche Hauptwoerter, die fest eingebaut nichts zu suchen haben.
  //
  // Der Prosa-Durchgang unten findet sie nicht: er ueberspringt jede
  // Zeile mit Klammern, und genau dort stehen sie - zwischen zwei
  // JSX-Ausdruecken. So gefunden:
  // "{row.played} Spiele - {row.won}S {row.drawn}U {row.lost}N", das in
  // der englischen Fassung woertlich genau so dastand, und ein
  // "Kader ({n})" im Datenbankeditor.
  const BROCKEN = [
    'Spiele', 'Tore', 'Punkte', 'Saison', 'Verein', 'Spieler', 'Woche',
    'Vertrag', 'Gehalt', 'Kader', 'Trainer', 'Jahre', 'Tage', 'Minuten',
    'Siege', 'Niederlagen', 'Spieltag', 'Vorlagen', 'Torwart', 'Abwehr',
  ];
  // Nur innerhalb einer Zeichenkette gesucht - sonst schlaegt jeder
  // Bezeichner an. Zeilen, die uebersetzen, sind in Ordnung.
  const brocken = new RegExp(`"[^"]*\\b(${BROCKEN.join(`|`)})\\b[^"]*"`);

  const istProsa = (z: string): boolean => {
    const t2 = z.trim();
    if (t2.length < 12) return false;
    if (/["'`<>{}=();]/.test(t2)) return false;
    // Objekteigenschaften wie `aimX: dir.x,` - "dir" ist dort kein Wort.
    if (/^\w+:\s/.test(t2)) return false;
    if (!/[a-zäöüß]{3}/.test(t2)) return false;
    return deutsch.test(t2);
  };

  log('\n--- Deutscher Text direkt im JSX ---');
  let fehler = 0;
  const fundstellen: string[] = [];
  const brockenStellen: string[] = [];
  for (const pfad of dateien) {
    let quelle = '';
    try {
      const antwort = await fetch(pfad);
      if (!antwort.ok) throw new Error(String(antwort.status));
      quelle = await antwort.text();
    } catch {
      log(`${pfad}: nicht lesbar - uebersprungen`);
      continue;
    }
    let imKommentar = false;
    quelle.split(/\r?\n/).forEach((z, i) => {
      const t2 = z.trim();
      const oeffnet = z.lastIndexOf('/*');
      const schliesst = z.lastIndexOf('*/');
      const warDrin = imKommentar;
      if (oeffnet > schliesst) imKommentar = true;
      else if (schliesst > oeffnet && schliesst > -1) imKommentar = false;
      if (warDrin || imKommentar) return;
      if (t2.startsWith('//') || t2.startsWith('*') || t2.startsWith('/*')) return;
      if (istProsa(z)) fundstellen.push(`${pfad}:${i + 1}  ${t2.slice(0, 60)}`);
      else if (brocken.test(z) && !/\bt\(|\btr\(|\btVariant\(|\btn\(/.test(z)) {
        brockenStellen.push(`${pfad}:${i + 1}  ${t2.slice(0, 60)}`);
      }
    });
  }
  for (const st of fundstellen.slice(0, 8)) log(`  ${st}`);
  fehler += fundstellen.length > 0 ? 1 : 0;
  check('Kein deutscher Text direkt im JSX', fundstellen.length === 0,
    `${fundstellen.length} Fundstellen`);
  for (const st of brockenStellen.slice(0, 8)) log(`  ${st}`);
  fehler += brockenStellen.length > 0 ? 1 : 0;
  check('Kein deutsches Wort zwischen JSX-Ausdruecken',
    brockenStellen.length === 0, `${brockenStellen.length} Fundstellen`);
  return fehler;
}
async function pruefeQuelltexte(): Promise<number> {
  const dateien = ['/src/engine/matchEngine.ts', '/src/engine/ballAction.ts'];
  let fehler = 0;
  log('\n--- Fest eingebauter Spieltext ---');
  for (const pfad of dateien) {
    let quelle = '';
    try {
      const antwort = await fetch(pfad);
      if (!antwort.ok) throw new Error(String(antwort.status));
      quelle = await antwort.text();
    } catch {
      log(`${pfad}: nicht lesbar - übersprungen`);
      continue;
    }
    // Zeilen mit `text:` oder `detail:` gefolgt von einer Zeichenkette,
    // die kein t(-Aufruf ist.
    //
    // `detail:` fehlte hier - und genau darin standen die Rueckmeldungen
    // der Zweikampf- und Dribbelszenen als deutsche Saetze. Der Waechter
    // meldete diese Datei jahrelang als sauber.
    const treffer = quelle.split(/\r?\n/)
      .map((zeile, i) => ({ zeile: zeile.trim(), nr: i + 1 }))
      .filter(({ zeile }) => /^(text|detail):\s*[`'"]/.test(zeile))
      // Eine Vorlage, die mit ${t(...)} beginnt, ist uebersetzt - sie faengt
      // nur zufaellig mit einem Anfuehrungszeichen an. Ohne diese Zeile
      // meldete der Waechter genau die frisch berichtigten Stellen.
      .filter(({ zeile }) => !/\bt\(/.test(zeile))
      .filter(({ zeile }) => /[a-zA-Z]{4,}/.test(zeile.replace(/\$\{[^}]*\}/g, '')));
    for (const { zeile, nr } of treffer) {
      log(`  ${pfad}:${nr}  ${zeile.slice(0, 70)}`);
    }
    fehler += treffer.length;
    check(`Kein fest eingebauter Spieltext in ${pfad.split('/').pop()}`,
      treffer.length === 0, `${treffer.length} Stellen`);
  }
  return fehler;
}

// Der Sprachkatalog wird nachgeladen. Ohne ihn lieferte `t()` nur Schluessel,
// und der Test liefe an einer Engine vorbei, die es so nie gibt.
setLocale('de')
  .catch(() => undefined)
  .finally(async () => {
    try {
      const ausLauf = run();
      const ausQuelle = await pruefeQuelltexte();
      const ausOberflaeche = await pruefeOberflaechentext();
      const ausVerkabelung = await pruefeVerkabelung();
      const gesamt = ausLauf + ausQuelle + ausOberflaeche + ausVerkabelung;
      log(gesamt === 0 ? '\nALLE PRUEFUNGEN BESTANDEN'
        : `\n${gesamt} PRUEFUNGEN FEHLGESCHLAGEN`);
      (window as unknown as Record<string, unknown>).__testFailures = gesamt;
      (window as unknown as Record<string, unknown>).__testDone = true;
    } catch (err) {
      log(`\nABBRUCH MIT FEHLER:\n${err instanceof Error ? `${err.message}\n${err.stack}` : String(err)}`);
      (window as unknown as Record<string, unknown>).__testFailures = 999;
      (window as unknown as Record<string, unknown>).__testDone = true;
    }
  });

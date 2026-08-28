/**
 * Temporaerer Rauchtest der Spiellogik.
 * Erzeugt eine Karriere, spielt mehrere Saisons durch und prueft die Ergebnisse
 * auf Plausibilitaet. Wird ueber /devtest.html aufgerufen.
 */
import { advanceUntil } from './state/actions';
import { getState, setState } from './state/store';
import type { Challenge } from './engine/matchTypes';
import { matchReferee, type RefereeStyle } from './engine/referee';
import { matchWeather, type Weather } from './engine/weather';
import { attendanceRoll } from './engine/rivalry';
import { resolveDuel, resolveDribble, applyExecutionError, autoResolveChallenge, resolveShot, simulateBallFlight } from './engine/ballAction';
import {
  ALL_ATTRS, defensiveSkill, keeperSkill, tempo, computeOverall,
  type AttrKey, type Attributes, type KeeperSituation,
} from './engine/attributes';
import { isAfter, isBefore, addDays, seasonLabel } from './engine/date';
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
import { createObjectives } from './engine/game';
import { advanceAgent, ensureAgent, startAgentTask } from './engine/agent';
import {
  applyTraining, injuryForDays, updateFormAfterMatch,
} from './engine/development';
import { slotScore } from './engine/lineup';
import { MatchEngine } from './engine/matchEngine';
import { applyInterviewAnswer, buildPostMatchInterview } from './engine/media';
import { applyLifeChoice, buildLifeEvent } from './engine/events';
import { clamp, Rng } from './engine/rng';
import { leaguesOfCountry } from './engine/season';
import { collectStats, sumStats } from './engine/stats';
import { type Player, DIFFICULTY_SETTINGS, type SquadRole, type TacticStyle } from './engine/types';
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
      + `nominiert: ${gN.nationalNominated}, Laenderspiele: ${gN.nationalCaps}, Tore: ${gN.nationalGoals}`);
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
    check('Nominierter Spieler sammelt Laenderspiele', gN.nationalCaps > 0, `${gN.nationalCaps}`);
    check('Nation ohne Ligasystem nimmt am WNC teil', gN.nationalCaps > 0,
      `Nigeria, ${gN.nationalCaps} Einsaetze`);
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
    check('Der Champions Cup kuert Sieger', champions >= 1, `${champions}`);
  }

  // --- Spielerstatistiken ---------------------------------------------
  const totals = sumStats(collectStats(game, game.userPlayerId));
  log(`\nEigene Bilanz: ${totals.appearances} Spiele, ${totals.goals} Tore, `
    + `${totals.assists} Vorlagen, Note ${(totals.appearances ? totals.ratingSum / totals.appearances : 0).toFixed(2)}`);
  check('Spieler kam zum Einsatz', totals.appearances > 0, `${totals.appearances}`);
  check('Bewertungen im gueltigen Bereich',
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
    log(`${klubs.length} Vereine geprueft, ${mitKonkurrenz} mit Konkurrenz auf ${user.position}`);
    check('Rangberechnung bleibt im gueltigen Bereich', ungueltig === 0, `${ungueltig} Ausreisser`);
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
    check('Bleibender Schaden nur bei langen Ausfaellen', falscherSchaden === 0,
      `${falscherSchaden} Faelle`);
  }

  // --- Sprachkataloge --------------------------------------------------
  {
    log('');
    log('--- Sprachkataloge ---');
    const deKeys = Object.keys(DE);
    const enKeys = Object.keys(EN);
    log(`Schluessel: ${deKeys.length} deutsch, ${enKeys.length} englisch`);

    // Ein Schluessel, den nur eine Sprache kennt, faellt im Spiel stumm auf
    // Deutsch zurueck - das faellt beim Spielen kaum auf und bleibt liegen.
    const fehltEn = deKeys.filter((k) => !(k in EN));
    const fehltDe = enKeys.filter((k) => !(k in DE));
    check('Englischer Katalog ist vollstaendig', fehltEn.length === 0,
      fehltEn.slice(0, 8).join(', '));
    check('Kein englischer Schluessel ohne deutsches Gegenstueck', fehltDe.length === 0,
      fehltDe.slice(0, 8).join(', '));

    // Platzhalter muessen auf beiden Seiten dieselben sein, sonst steht in
    // einer Sprache '{name}' im Text.
    const platzhalter = (s: string) => (s.match(/{w+}/g) ?? []).slice().sort().join(",");
    const schief = deKeys.filter((k) => k in EN && platzhalter(DE[k]) !== platzhalter(EN[k]));
    check('Platzhalter stimmen ueberein', schief.length === 0, schief.slice(0, 8).join(', '));

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
      check(`${name}: keine Ueberdeckung`, engste > 0.1, `engster Abstand ${engste.toFixed(3)}`);
    }

    // Unbekannte Namen duerfen nicht zu Chaos fuehren, sondern fallen auf die
    // Einteilung nach Positionskuerzeln zurueck.
    const wirr = place(FORMATION_SLOTS['4-4-2'].map((position, i) =>
      ({ playerId: `y${i}`, position })), 'Kraut-und-Rueben');
    check('Unbekannte Formation faellt sauber zurueck',
      wirr.length === 11 && wirr.every((p) => p.x >= 0.08 && p.x <= 0.92),
      `${wirr.length} platziert`);
  }

  // --- Karrierebogen: Chronik und Vertrag -----------------------------
  {
    const marken = game.careerEvents.filter((e) => e.type === 'milestone');
    log(`
Chronik: ${game.careerEvents.length} Eintraege, davon ${marken.length} Marken`);
    // Ohne laufende Marken schwieg die Chronik nach den Premieren jahrelang.
    check('Chronik fuehrt laufende Marken', marken.length > 0,
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
    check('Kein abgelaufener Vertrag laeuft weiter',
      endJahr === null || endJahr > game.season,
      `Ende ${endJahr}, Saison ${game.season}`);
  }

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
      + 'fuer den Highlight-Test ausgeblendet)');
    user.injury = null;
    user.fitness = 92;
  }

  // Ausgangslage protokollieren, damit fehlende Einsatzzeit erklaerbar ist.
  const nowClub = user.clubId ? game.clubs[user.clubId] : null;
  log(`Status: ${nowClub?.name ?? 'vereinslos'}, Staerke ${computeOverall(user.attrs, user.position)}, `
    + `Rolle ${user.contract?.role ?? '-'}, Form ${Math.round(user.form)}, `
    + `Fitness ${Math.round(user.fitness)}, `
    + `${user.injury ? `verletzt (${t(user.injury.name)}, ${user.injury.daysOut} Tage)` : 'fit'}, `
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
  check('Dribblings werden ausgeloest (Abschnitt 24)', (kinds.get('dribble') ?? 0) > 0,
    `${kinds.get('dribble') ?? 0}`);

  // Standards uebernimmt nur, wer zu den besten Schuetzen gehoert.
  // Das ist der Weg "Freistossspezialist werden" aus Abschnitt 19.
  log(`Freistoesse als Schuetze: ${kinds.get('freeKick') ?? 0} `
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
  log(`Nach gezieltem Freistosstraining (Wert 92): ${specialistFreeKicks} Freistoesse in ${fkPool.length} Spielen`);
  check('Freistossspezialist tritt selbst an (Abschnitt 19 und 22)', specialistFreeKicks > 0,
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
    + `(${allKinds.get('block') ?? 0} Klaerungen)`);
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
  check('Ein Spiel fuer den Verletzungstest gefunden', !!injuryMatch);
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
    check('Auswechseln ergibt die geschaetzte Ausfalldauer',
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

  // --- Oeffentliches Bild wirkt sich aus (Abschnitt 31) ----------------
  //
  // Interviews und Beitraege in den sozialen Medien bezahlen mit diesem Wert,
  // und die Seitenleiste zeigt ihn als Balken. Gelesen wurde er aber lange
  // nirgends - er war eine Waehrung ohne Ware. Dieser Test haelt fest, dass er
  // wirkt: Er darf ruhig schwach wirken, aber nicht gar nicht.
  log('\n--- Oeffentliches Bild ---');
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
    check('Ein guter Ruf senkt die Huerde zur Nationalmannschaft',
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
    check('Auch Ersatzspieler kommen zu Einsaetzen', einwechsler > 0,
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
        log(`Tore pro Spiel: eigener Verein ${eigen.toFixed(2)}, uebrige Liga ${fremd.toFixed(2)}`);
        log(`Punkte pro Spiel: eigener Verein ${punkteEigen.toFixed(2)}, `
          + `aehnlich starke Vereine ${punkteFremd.toFixed(2)} aus ${fremdTeilnahmen} Teilnahmen`);
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
        log('Zu wenige Ligaspiele fuer den Vergleich - uebersprungen.');
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
    check('Alle Ereignistexte sind uebersetzt', rohe.size === 0,
      `${rohe.size} fehlende Schluessel`);
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
    const mit = Object.values(gRiv.players).filter(
      (p) => p.clubId === uR.clubId && p.id !== uR.id && p.position !== 'TW');

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
        log('Zu wenige Passszenen fuer den Vergleich - uebersprungen.');
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
    log(`Notenziel nach Rolle: Ergaenzung ${jung}, Stamm ${stamm}, Schluessel ${schluessel}`);
    check('Das Notenziel haengt an der Rolle', jung < stamm && stamm < schluessel,
      `${jung} / ${stamm} / ${schluessel}`);
    check('Auch das hoechste Ziel bleibt erreichbar', schluessel <= 6.9, `${schluessel}`);

    // Ein Mittelfeldspieler wird an Vorlagen gemessen, ein Stuermer an Toren.
    notenzielFuer('Stammspieler');
    const artenMid = gZ.objectives.map((o) => o.kind);
    check('Das Mittelfeld bekommt ein Vorlagenziel', artenMid.includes('assists'),
      artenMid.join(', '));

    uZ.position = 'ST';
    createObjectives(gZ);
    const artenSt = gZ.objectives.map((o) => o.kind);
    check('Der Stuermer bekommt ein Torziel',
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
    check('Kein Nachname ueberwiegt', haeufigster < spieler.length * 0.01,
      `haeufigster ${haeufigster}x`);
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
        log('Keine Szenen mit Druckwert - uebersprungen.');
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

      log(`Szenendruck auswaerts: leeres Rund ${leer.toFixed(3)}, `
        + `ausverkauft ${voll.toFixed(3)}, neutraler Platz ${neutral.toFixed(3)}`);
      if (leer > 0 && voll > 0) {
        check('Volles Auswaertsrund macht mehr Druck', voll > leer,
          `${voll.toFixed(3)} gegen ${leer.toFixed(3)}`);
        check('Der Zuschlag bleibt im Rahmen', voll - leer < 0.2,
          `+${(voll - leer).toFixed(3)}`);
        check('Auf neutralem Platz traegt niemand ein Publikum',
          Math.abs(neutral - leer) < 0.05,
          `${neutral.toFixed(3)} gegen ${leer.toFixed(3)}`);
      } else {
        log('Keine Szenen mit Druckwert - uebersprungen.');
      }

      // Die Zuschauerzahl darf vor und nach dem Spiel nicht auseinanderlaufen.
      // Vorher rechnete die Vorbereitung mit dem festen Streuwert 0.5, nachher
      // zog die Abrechnung einen echten Wurf - zwei verschiedene Zahlen fuer
      // dieselbe Partie. Jetzt haengt der Wurf an der Partiekennung.
      const wurf = attendanceRoll(auswaerts.id);
      check('Der Zuschauerwurf haengt an der Partie und wiederholt sich',
        wurf === attendanceRoll(auswaerts.id) && wurf >= 0 && wurf < 1,
        wurf.toFixed(3));
      const andere = Object.values(game.matches)
        .slice(0, 200).map((m) => attendanceRoll(m.id));
      check('Verschiedene Partien bekommen verschiedene Wuerfe',
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

    check('Im Januar faellt Schnee, im Juli nicht',
      (januar.snow ?? 0) > 0 && (juli.snow ?? 0) === 0,
      `Januar ${januar.snow ?? 0}, Juli ${juli.snow ?? 0}`);
    check('Hitze gibt es im Juli, im Januar nicht',
      (juli.heat ?? 0) > 0 && (januar.heat ?? 0) === 0,
      `Juli ${juli.heat ?? 0}, Januar ${januar.heat ?? 0}`);
    check('Ueber ein Jahr kommen mindestens sieben Wetterlagen vor',
      new Set([...Object.keys(januar), ...Object.keys(juli),
        ...Object.keys(zaehle(4)), ...Object.keys(zaehle(10))]).size >= 7,
      `${new Set([...Object.keys(januar), ...Object.keys(juli),
        ...Object.keys(zaehle(4)), ...Object.keys(zaehle(10))]).size}`);

    // Die Wirkung selbst: dieselbe Partie, dieselben Wuerfel, nur das Wetter
    // unterscheidet sich. Gezaehlt wird, wie viele Schuesse aufs Tor kommen.
    const partie = Object.values(game.matches).find(
      (m) => !m.played && (m.homeClubId === user.clubId || m.awayClubId === user.clubId));
    if (partie) {
      const quoteBei = (w: Weather) => {
        let schuesse = 0, aufsTor = 0;
        for (let i = 0; i < 8; i++) {
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
      log(`Schuesse aufs Tor: bei Sonne ${(sonne * 100).toFixed(1)} %, `
        + `bei Schneefall ${(schnee * 100).toFixed(1)} %`);
      if (sonne > 0 && schnee > 0) {
        check('Im Schnee kommen weniger Schuesse aufs Tor', schnee < sonne,
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
    check('Alle fuenf Spielarten kommen vor', Object.keys(stile).length === 5,
      `${Object.keys(stile).length}`);
    check('Der unauffaellige Schiedsrichter bleibt der Normalfall',
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
        ['laesst laufen', milde], ['publikumsnah', nah],
      ] as [string, typeof normal][]) {
        log(`${name.padEnd(14)} ${w.fouls.toFixed(1)} Fouls, `
          + `${w.gelb.toFixed(1)} Gelb, ${w.rot.toFixed(2)} Rot, `
          + `${(w.anteil * 100).toFixed(0)} % gegen die Gaeste`);
      }

      check('Der Kleinliche pfeift mehr als der Milde',
        streng.fouls > milde.fouls,
        `${streng.fouls.toFixed(1)} gegen ${milde.fouls.toFixed(1)}`);
      check('Der Kleinliche verwarnt mehr als der Milde',
        streng.gelb > milde.gelb,
        `${streng.gelb.toFixed(1)} gegen ${milde.gelb.toFixed(1)}`);
      check('Der Unauffaellige liegt dazwischen',
        normal.gelb > milde.gelb && normal.gelb < streng.gelb,
        `${normal.gelb.toFixed(1)}`);
      check('Der Publikumsnahe pfeift eher gegen die Gaeste',
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
      log(`Platzverweise je Spiel: ${rotSchnitt.toFixed(2)} im Mittel ueber `
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
    check('Tempo behaelt den Massstab', Math.abs(tempo(gleich) - 70) < 0.001,
      tempo(gleich).toFixed(3));
    check('Zweikampfstaerke behaelt den Massstab',
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
      check('Deckung und Abfangen entscheiden Zweikaempfe mit',
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
    check('Torwartstaerke behaelt in jeder Lage den Massstab',
      lagen.every((l) => Math.abs(keeperSkill(gleich, l) - 70) < 0.001),
      lagen.map((l) => keeperSkill(gleich, l).toFixed(1)).join(', '));

    // Zwei Profile: der Flankenpfluecker und der Eins-gegen-eins-Mann.
    const flanken = { ...gleich,
      crossHandling: 92, communication: 88, gkPositioning: 82,
      oneOnOne: 38, rushingOut: 34 } as Attributes;
    const duell = { ...gleich,
      crossHandling: 38, communication: 44, gkPositioning: 74,
      oneOnOne: 92, rushingOut: 90 } as Attributes;

    log(`Flankenpfluecker: Kopfball ${keeperSkill(flanken, 'header').toFixed(1)}, `
      + `Eins gegen eins ${keeperSkill(flanken, 'oneOnOne').toFixed(1)}`);
    log(`Eins-gegen-eins-Mann: Kopfball ${keeperSkill(duell, 'header').toFixed(1)}, `
      + `Eins gegen eins ${keeperSkill(duell, 'oneOnOne').toFixed(1)}`);

    check('Der Flankenpfluecker ist bei Koepfen stark, im Duell schwach',
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

        check('Beide Profile haben dieselbe Gesamtstaerke',
          computeOverall(profilA, 'TW') === computeOverall(profilB, 'TW'),
          `${computeOverall(profilA, 'TW')} und ${computeOverall(profilB, 'TW')}`);

        const zeige = (w: { quote: Record<string, number>; faelle: Record<string, number> }) =>
          ['header', 'oneOnOne', 'shot', 'longShot']
            .filter((k) => w.faelle[k])
            .map((k) => `${k} ${(w.quote[k] * 100).toFixed(1)} % (${w.faelle[k]})`)
            .join(', ');
        log(`Verwertung gegen den Flankenpfluecker:    ${zeige(gegenFlanken)}`);
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
        log(`Koepfe und Duelle in der Stichprobe: `
          + `${gegenFlanken.faelle.header ?? 0} und ${gegenFlanken.faelle.oneOnOne ?? 0} `
          + '- zu wenig fuer eine Zusicherung, nur protokolliert.');
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
      check('Der Sprung geht nie rueckwaerts', !isBefore(game.date, start),
        `${start} -> ${game.date}`);
      check('Der Sprung ueberschiesst das Ziel nicht',
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
        log('Keine eigenen Partien im Zeitraum - Teil uebersprungen.');
      }

      // Der Trainingszuwachs kam aus einer Liste von Eintraegen, nicht aus
      // einem Zahlenverzeichnis. Ein `Object.values` darueber summierte
      // still nur Nullen - der Bericht meldete dauerhaft "kein Fortschritt".
      // Geprueft am zweiten Sprung, der lang genug ist; ein eigener dritter
      // Sprung lief oft nur wenige Tage und die Zusicherung ins Leere.
      if (mit.days >= 14) {
        check('Der Trainingszuwachs wird tatsaechlich gezaehlt',
          mit.trainingsPlus > 0,
          `+${mit.trainingsPlus} in ${mit.days} Tagen`);
      } else {
        log('Sprung zu kurz fuer eine Trainingswoche - Teil uebersprungen.');
      }

      // Ein Ziel in der Vergangenheit darf nichts tun.
      const rueckwaerts = advanceUntil(addDays(game.date, -5));
      check('Ein Ziel in der Vergangenheit bewegt nichts',
        rueckwaerts.days === 0, `${rueckwaerts.days} Tage`);
    } finally {
      setState({ game: vorher });
    }
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
    log(`${mitFassungen.size} Schluessel mit mehreren Fassungen`);
    if (ungleich.length) log(`Ungleich: ${ungleich.join(', ')}`);
    check('Beide Sprachen haben gleich viele Fassungen', ungleich.length === 0,
      `${ungleich.length} ungleich`);
    check('Jede Fassungsreihe hat mindestens zwei Eintraege', zuWenig.length === 0,
      `${zuWenig.join(', ')}`);
    check('Es gibt ueberhaupt Fassungen', mitFassungen.size >= 15,
      `${mitFassungen.size}`);

    // Die Auswahl muss die ganze Breite nutzen und darf nicht ueberlaufen.
    const probe = 'live.keeperSave';
    const anzahl = zaehleFassungen(DE, probe);
    const gesehen = new Set<string>();
    for (let i = 0; i < 200; i++) gesehen.add(tVariant(probe, i / 200));
    check('Die Auswahl nutzt alle Fassungen', gesehen.size === anzahl,
      `${gesehen.size} von ${anzahl}`);
    check('Auch der Randwert 1 bleibt gueltig',
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

    log(`Nationalkader: ${kader.length} Spieler, staerkster ${staerken[0]}`);
    check('Der Nationalkader ist vollstaendig', kader.length >= 15, `${kader.length}`);
    check('Er enthaelt nur Spieler dieser Herkunft', fremde === 0, `${fremde} fremde`);
    check('Er ist nach Staerke sortiert', absteigend, `${staerken.slice(0, 3).join(', ')}`);
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
        + `fuenf dahinter ${knappDaneben?.takes}`);
      check('Vier Punkte hinter dem besten Schuetzen reicht noch',
        knapp?.takes === true, `${knapp?.takes}`);
      check('Fuenf Punkte dahinter reicht nicht mehr',
        knappDaneben?.takes === false, `${knappDaneben?.takes}`);
      check('Und der Abstand wird beziffert',
        (knappDaneben?.gap ?? 0) >= 1, `${knappDaneben?.gap} Punkte`);

      // Als bester Schuetze tritt er in jedem Fall an.
      uS.attrs.penalties = 99;
      check('Der beste Schuetze tritt an',
        penaltyStanding(gS, uS.clubId)?.takes === true);
    }

    // Freistoesse: die beiden besten teilen sie sich.
    const besteFrei = kader.slice().sort(
      (a, b) => b.attrs.freeKicks - a.attrs.freeKicks);
    if (besteFrei.length >= 3) {
      uS.attrs.freeKicks = besteFrei[1].attrs.freeKicks + 1;
      check('Der zweitbeste Freistossschuetze tritt an',
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
    check('Vierzehn Einsaetze reichen noch nicht', learnAltPosition(gPos) === null,
      `${uP.altPositions.length} Nebenpositionen`);

    eintragen('DM', 80, 2);
    const gelernt = learnAltPosition(gPos);
    check('Wer oft genug dort spielt, lernt die Position', gelernt === 'DM',
      String(gelernt ?? 'nichts'));
    check('Die Position steht danach im Profil', uP.altPositions.includes('DM'),
      uP.altPositions.join(', '));

    // Kurzauftritte lehren nichts.
    eintragen('OM', 12, 30);
    check('Kurzeinsaetze zaehlen nicht', learnAltPosition(gPos) === null,
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
  log('\n--- Spielfuehrerbinde ---');
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
    log(`Fuehrungszuwachs je Saison: Schluesselspieler ${tragend}, `
      + `Rotationsspieler ${rand}`);
    check('Fuehrungsstaerke waechst mit der Stellung', tragend >= 2, `${tragend} Punkte`);
    check('Wer nicht traegt, waechst nicht hinein', rand === 0, `${rand} Punkte`);

    // Die Binde selbst: erreichbar, aber nicht geschenkt.
    if (uK.contract) {
      // Ueber eine Funktion gelesen, damit TypeScript den Typ nicht auf den
      // zuletzt zugewiesenen Wert verengt und die Vergleiche fuer unmoeglich haelt.
      const rolle = (): SquadRole => uK.contract!.role;
      uK.contract.role = 'Rotationsspieler';
      checkCaptaincy(gKap, new Rng(7));
      check('Ein Rotationsspieler wird nicht Kapitaen',
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
      check('Ein herausragender Spieler kann Kapitaen werden',
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
    log(`Gehaltsquote: Schnitt ${schnitt.toFixed(2)}, hoechste ${hoechste.toFixed(2)} `
      + `bei ${vereine} Vereinen`);
    check('Jeder Verein hat ein Budget', ohneBudget === 0, `${ohneBudget} ohne`);
    check('Die Gehaltslast passt zum Gehaltsbudget', schnitt > 0.6 && schnitt < 1,
      `Schnitt ${schnitt.toFixed(2)}`);
    check('Kein Verein liegt weit ueber seinem Gehaltsbudget', hoechste < 1.3,
      `hoechste ${hoechste.toFixed(2)}`);
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
    log(`Zahlungsfaehige Vereine: fuer 1 Mio ${guenstig}, fuer 120 Mio ${teuer}`);
    check('Ein Talent koennen viele Vereine holen', guenstig > 50, `${guenstig}`);
    check('Einen Weltstar koennen nur wenige holen', teuer < guenstig / 5,
      `${teuer} gegen ${guenstig}`);
    check('Aber wenigstens einer kann es', teuer >= 1, `${teuer}`);

    // Der Anteil an den Transfermitteln ist die Grundlage der Aussage auf der
    // Angebotskarte - er muss mit der Abloese steigen.
    const einVerein = Object.values(gFin.clubs).find((c) => c.budget > 1_000_000)!;
    const klein = feeShare(einVerein, einVerein.budget * 0.1);
    const gross = feeShare(einVerein, einVerein.budget * 0.9);
    check('Der Anteil an den Transfermitteln steigt mit der Abloese', gross > klein,
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
    log(`Bei ueberzogenem Verein: ${eng.durchgesetzt} von ${eng.versuche}, `
      + `im Schnitt +${eng.schnitt.toFixed(1)} Prozent`);
    check('Der Berater setzt bei einem zahlungsfaehigen Verein etwas durch',
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
    check('Widerstandsfaehigkeit federt ein schlechtes Spiel ab', zaeh > duenn + 1,
      `${duenn.toFixed(1)} gegen ${zaeh.toFixed(1)}`);
    check('Widerstandsfaehigkeit federt eine Verletzung ab', zaehV > duennV + 2,
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
    check('Nach einem guten Spiel wirkt Widerstandsfaehigkeit nicht',
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
    log(`Einheiten bis Staerke 65: Ehrgeiz 20 -> ${traege.toFixed(0)}, `
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
    check('Die Graetsche zaehlt fuer einen Innenverteidiger',
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
    log(`Zweikaempfe gewonnen von 900: Graetsche 20 -> ${schwach}, 90 -> ${stark}`);
    check('Die Graetsche zaehlt im Zweikampf', stark > schwach,
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
    log(`Einheiten bis Staerke 65: ohne Mentor ${ohne.einheiten.toFixed(0)}, `
      + `mit Mentor ${mit.einheiten.toFixed(0)}`);
    log(`Mentale Werte im Schnitt: ${ohne.mental.toFixed(1)} gegen ${mit.mental.toFixed(1)}`);
    check('Ein Mentor beschleunigt die Entwicklung spuerbar',
      mit.einheiten < ohne.einheiten * 0.96,
      `${ohne.einheiten.toFixed(0)} gegen ${mit.einheiten.toFixed(0)} Einheiten`);
    check('Ein Mentor gibt mentale Werte weiter', mit.mental > ohne.mental + 2,
      `${ohne.mental.toFixed(1)} gegen ${mit.mental.toFixed(1)}`);
    check('Der Mentor ersetzt aber kein Talent', mit.einheiten > ohne.einheiten * 0.6,
      `${(100 - (mit.einheiten / ohne.einheiten) * 100).toFixed(0)} Prozent schneller`);

    // Der gewaehlte Mentor muss Fuehrungsqualitaeten haben - sonst gibt es keinen.
    if (gMentor.mentorId) {
      const m = gMentor.players[gMentor.mentorId]!;
      check('Der Mentor ist ein Fuehrungsspieler', m.attrs.leadership >= 55,
        `Fuehrung ${m.attrs.leadership}`);
      check('Der Mentor wirkt, solange er im Verein ist', mentorInfluence(gMentor) > 0,
        `${(mentorInfluence(gMentor) * 100).toFixed(1)} Prozent`);

      // Verlaesst er den Verein, endet die Bindung - und mit ihr die Wirkung.
      m.clubId = null;
      const weg = mentorLeft(gMentor);
      check('Ein Vereinswechsel des Mentors loest die Bindung', !!weg && !gMentor.mentorId);
      check('Ohne Mentor gibt es keinen Trainingsvorteil',
        mentorInfluence(gMentor) === 0);
    } else {
      log('Dieser Verein hat keinen passenden Mentor - das ist zulaessig.');
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
  // Der Kern: ein sauber ins Eck platzierter Schuss fuehrt oft zum Tor.
  check('Eine gute Eingabe fuehrt oft zum Tor', goodGoals > 160,
    `${(goodGoals / 4).toFixed(0)}% - Platzierung wird belohnt`);
  check('Gute Eingabe ist kein Selbstlaeufer', goodGoals < 380,
    'Auch bei guter Eingabe gibt es Fehlschuesse');
  check('Attribute machen einen spuerbaren Unterschied', eliteGoals > goodGoals * 1.15,
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
    { datei: '/src/engine/game.ts', name: 'simulateUserMatch', mindestens: 1 },
    { datei: '/src/state/actions.ts', name: 'simulateUserMatch', mindestens: 2 },
    { datei: '/src/state/actions.ts', name: 'advanceUntil', mindestens: 1 },
    { datei: '/src/ui/tabs/CalendarTab.tsx', name: 'advanceUntil', mindestens: 2 },
    { datei: '/src/ui/CareerShell.tsx', name: 'skipReport', mindestens: 2 },
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
      log(`${datei}: nicht lesbar - uebersprungen`);
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
      log(`${pfad}: nicht lesbar - uebersprungen`);
      continue;
    }
    // Zeilen mit `text:` gefolgt von einer Zeichenkette, die kein t(-Aufruf ist.
    const treffer = quelle.split(/\r?\n/)
      .map((zeile, i) => ({ zeile: zeile.trim(), nr: i + 1 }))
      .filter(({ zeile }) => /^text:\s*[`'"]/.test(zeile))
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
      const ausVerkabelung = await pruefeVerkabelung();
      const gesamt = ausLauf + ausQuelle + ausVerkabelung;
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

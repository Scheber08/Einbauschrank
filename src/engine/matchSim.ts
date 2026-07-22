/**
 * Gemeinsame Simulationsbausteine und die Hintergrundsimulation
 * (Konzept Abschnitt 27 und 56).
 */
import { POSITION_LINE, effectiveOverall, type PositionCode } from './attributes';
import { isAvailable, quickTeamRating } from './lineup';
import { Rng, clamp } from './rng';
import { FORMATION_SLOTS } from './worldGen';
import {
  emptyMatchStats, type Club, type Id, type Player, type PlayerMatchStats,
} from './types';

// --- Torwahrscheinlichkeiten --------------------------------------------

/** Erwartungswert eines Abschlusses aus Entfernung und Winkel. */
export function expectedGoals(distance: number, offset: number, isHeader = false): number {
  const base = 1.05 * Math.exp(-0.135 * Math.max(2, distance));
  const angleFactor = 1 / (1 + Math.abs(offset) / Math.max(4, distance * 0.85));
  const headerFactor = isHeader ? 0.58 : 1;
  return clamp(base * angleFactor * headerFactor, 0.008, 0.85);
}

/** Modifikator des Abschlussspielers. */
export function finishingModifier(p: Player): number {
  return 0.72 + p.attrs.finishing / 190 + p.confidence / 620 + (p.form - 50) / 900;
}

/** Modifikator des Torhueters (kleiner = besser fuer den Torwart). */
export function keeperModifier(keeperRating: number): number {
  return clamp(1.3 - keeperRating / 205, 0.55, 1.2);
}

// --- Auswahl beteiligter Spieler ---------------------------------------

export interface OnPitchPlayer {
  player: Player;
  slot: PositionCode;
  rating: number;
}

const SHOOTER_BASE: Record<string, number> = { ATT: 1.0, MID: 0.42, DEF: 0.09, GK: 0.002 };
const CREATOR_BASE: Record<string, number> = { ATT: 0.75, MID: 1.0, DEF: 0.28, GK: 0.01 };

export function pickShooter(
  rng: Rng, squad: OnPitchPlayer[], kind: 'shot' | 'longShot' | 'header' | 'oneOnOne',
): OnPitchPlayer {
  return rng.weighted(squad, (o) => {
    const line = POSITION_LINE[o.slot];
    let w = SHOOTER_BASE[line] ?? 0.1;
    if (kind === 'longShot') w *= line === 'MID' ? 1.9 : 0.8;
    if (kind === 'header') w *= (o.player.attrs.heading + o.player.height - 150) / 90;
    if (kind === 'oneOnOne') w *= line === 'ATT' ? 1.4 : 0.7;
    w *= 0.45 + o.player.attrs.finishing / 130;
    w *= 0.75 + o.player.form / 260;
    return Math.max(0.001, w);
  });
}

export function pickCreator(
  rng: Rng, squad: OnPitchPlayer[], exclude: Id,
): OnPitchPlayer | null {
  const pool = squad.filter((o) => o.player.id !== exclude);
  if (pool.length === 0) return null;
  return rng.weighted(pool, (o) => {
    const line = POSITION_LINE[o.slot];
    let w = CREATOR_BASE[line] ?? 0.1;
    w *= 0.4 + (o.player.attrs.vision + o.player.attrs.shortPass + o.player.attrs.crossing) / 420;
    w *= 0.75 + o.player.form / 260;
    return Math.max(0.001, w);
  });
}

// --- Bewertung (Konzept Abschnitt 42) ----------------------------------

export function computeRating(
  s: PlayerMatchStats, teamGoals: number, oppGoals: number,
): number {
  if (s.minutes === 0) return 0;
  const line = POSITION_LINE[s.position];
  let r = 6.0;
  const share = clamp(s.minutes / 90, 0.25, 1);

  // Offensive Beitraege
  const goalValue = line === 'ATT' ? 1.05 : line === 'MID' ? 1.25 : line === 'DEF' ? 1.6 : 2.2;
  r += s.goals * goalValue;
  r += s.assists * 0.75;
  r += s.keyPasses * 0.14;
  r += s.shotsOnTarget * 0.09;
  r += (s.bigChances - s.bigChancesScored) * -0.28;

  // Passspiel
  if (s.passes >= 8) {
    const acc = s.passesCompleted / s.passes;
    r += clamp((acc - 0.78) * 3.4, -0.9, 0.9);
  }

  // Dribbling und Ballverluste
  r += s.dribblesCompleted * 0.11;
  r -= (s.dribbles - s.dribblesCompleted) * 0.05;
  r -= s.possessionLost * 0.035;

  // Zweikaempfe
  if (s.duels >= 3) {
    const won = s.duelsWon / s.duels;
    r += clamp((won - 0.5) * (line === 'DEF' ? 2.4 : 1.5), -1.0, 1.1);
  }
  r += s.tackles * 0.07;
  r += s.interceptions * 0.07;
  r += s.blocks * 0.1;
  r += s.clearances * 0.03;

  // Defensive Verantwortung
  if (line === 'DEF' || line === 'GK') {
    if (oppGoals === 0 && s.minutes >= 70) r += 0.55;
    r -= oppGoals * (line === 'GK' ? 0.28 : 0.2);
  }

  // Torwart
  if (line === 'GK') {
    r += s.saves * 0.16;
    r += s.penaltiesSaved * 1.1;
  }

  // Disziplin
  r -= s.fouls * 0.05;
  r += s.foulsDrawn * 0.04;
  r -= s.yellowCards * 0.32;
  r -= s.redCards * 1.6;
  r -= s.ownGoals * 1.3;
  r -= s.penaltiesMissed * 0.85;

  // Ergebnisbonus
  if (teamGoals > oppGoals) r += 0.22;
  else if (teamGoals < oppGoals) r -= 0.16;

  // Kurzeinsaetze werden zur Grundnote gezogen
  r = 6.0 + (r - 6.0) * (0.45 + share * 0.55);

  return clamp(Math.round(r * 10) / 10, 1.0, 10.0);
}

// --- Hintergrundsimulation ---------------------------------------------

export interface LightResult {
  homeScore: number;
  awayScore: number;
  scorers: { clubId: Id; playerId: Id; assistId: Id | null; minute: number }[];
  cards: { playerId: Id; card: 'Y' | 'R'; minute: number }[];
  injuries: { playerId: Id; days: number }[];
  appearances: PlayerMatchStats[];
}

function pickLightLineup(squad: Player[], formation: keyof typeof FORMATION_SLOTS): OnPitchPlayer[] {
  const slots = FORMATION_SLOTS[formation];
  const available = squad.filter(isAvailable);
  const used = new Set<Id>();
  const result: OnPitchPlayer[] = [];

  for (const slot of slots) {
    let best: Player | null = null;
    let bestScore = -Infinity;
    for (const p of available) {
      if (used.has(p.id)) continue;
      if ((slot === 'TW') !== (p.position === 'TW')) continue;
      const score = effectiveOverall(p.attrs, p.position, p.altPositions, slot)
        * (0.88 + p.form / 400) * (0.8 + p.fitness / 500);
      if (score > bestScore) { bestScore = score; best = p; }
    }
    if (best) {
      used.add(best.id);
      result.push({ player: best, slot, rating: bestScore });
    }
  }
  return result;
}

/**
 * Schnelle Simulation fuer Spiele ohne Beteiligung des eigenen Spielers.
 * Berechnet Ergebnis, Torschuetzen, Karten, Verletzungen und Einsatzzeiten.
 */
export function simulateLight(
  rng: Rng, matchId: Id, homeClub: Club, awayClub: Club,
  homeSquad: Player[], awaySquad: Player[], neutral = false,
): LightResult {
  const home = pickLightLineup(homeSquad, homeClub.formation);
  const away = pickLightLineup(awaySquad, awayClub.formation);

  const homeRating = quickTeamRating(homeSquad);
  const awayRating = quickTeamRating(awaySquad);
  const diff = (homeRating - awayRating) / 9;
  const homeAdvantage = neutral ? 0 : 0.26;

  const lambdaHome = clamp(1.32 + diff * 0.44 + homeAdvantage, 0.18, 5);
  const lambdaAway = clamp(1.12 - diff * 0.44, 0.14, 4.6);

  const homeScore = rng.poisson(lambdaHome);
  const awayScore = rng.poisson(lambdaAway);

  const scorers: LightResult['scorers'] = [];
  const cards: LightResult['cards'] = [];
  const injuries: LightResult['injuries'] = [];
  const appearances: PlayerMatchStats[] = [];

  const register = (onPitch: OnPitchPlayer[], clubId: Id, minutes: number[]) => {
    onPitch.forEach((o, i) => {
      const st = emptyMatchStats(o.player.id, matchId, clubId, o.slot);
      st.started = true;
      st.minutes = minutes[i];
      appearances.push(st);
    });
  };

  const homeMinutes = home.map(() => 90);
  const awayMinutes = away.map(() => 90);
  register(home, homeClub.id, homeMinutes);
  register(away, awayClub.id, awayMinutes);

  const statById = new Map(appearances.map((s) => [s.playerId, s]));

  const addGoals = (side: OnPitchPlayer[], clubId: Id, count: number, concededBy: OnPitchPlayer[]) => {
    for (let i = 0; i < count; i++) {
      const kind = rng.chance(0.22) ? 'longShot' : rng.chance(0.2) ? 'header' : 'shot';
      const scorer = pickShooter(rng, side, kind);
      const creator = rng.chance(0.68) ? pickCreator(rng, side, scorer.player.id) : null;
      const minute = rng.int(1, 94);
      scorers.push({
        clubId, playerId: scorer.player.id,
        assistId: creator?.player.id ?? null, minute,
      });
      const ss = statById.get(scorer.player.id);
      if (ss) { ss.goals++; ss.shots++; ss.shotsOnTarget++; }
      if (creator) {
        const cs = statById.get(creator.player.id);
        if (cs) { cs.assists++; cs.keyPasses++; }
      }
      const gk = concededBy.find((o) => o.slot === 'TW');
      if (gk) {
        const gs = statById.get(gk.player.id);
        if (gs) gs.goalsConceded++;
      }
    }
  };

  addGoals(home, homeClub.id, homeScore, away);
  addGoals(away, awayClub.id, awayScore, home);

  // Grundwerte fuer eine plausible Statistik
  const all = [...home, ...away];
  for (const o of all) {
    const st = statById.get(o.player.id)!;
    const line = POSITION_LINE[o.slot];
    const base = line === 'GK' ? 22 : line === 'DEF' ? 48 : line === 'MID' ? 62 : 34;
    st.passes = Math.max(0, Math.round(rng.normal(base, base * 0.22)));
    const acc = clamp(0.62 + o.player.attrs.shortPass / 320 + rng.normal(0, 0.05), 0.4, 0.98);
    st.passesCompleted = Math.round(st.passes * acc);
    st.shots += line === 'ATT' ? rng.int(0, 4) : line === 'MID' ? rng.int(0, 2) : rng.int(0, 1);
    st.shotsOnTarget = Math.min(st.shots, st.shotsOnTarget + rng.int(0, 1));
    st.duels = rng.int(3, 16);
    st.duelsWon = Math.round(st.duels * clamp(0.35 + o.player.attrs.tackling / 300 + rng.normal(0, 0.08), 0.1, 0.9));
    if (line === 'DEF' || o.slot === 'DM') {
      st.tackles = rng.int(0, 5);
      st.interceptions = rng.int(0, 5);
      st.clearances = rng.int(0, 7);
      st.blocks = rng.int(0, 3);
    }
    if (line === 'GK') {
      st.saves = Math.max(0, rng.poisson(2.4));
    }
    st.fouls = rng.int(0, 3);
    st.possessionLost = rng.int(1, 14);
  }

  // Karten
  const cardCount = rng.poisson(3.4);
  for (let i = 0; i < cardCount; i++) {
    const o = rng.weighted(all, (x) => 1 + (100 - x.player.attrs.discipline) / 25 + x.player.attrs.tackling / 40);
    const st = statById.get(o.player.id)!;
    if (rng.chance(0.045)) {
      st.redCards++;
      cards.push({ playerId: o.player.id, card: 'R', minute: rng.int(20, 92) });
    } else {
      st.yellowCards++;
      cards.push({ playerId: o.player.id, card: 'Y', minute: rng.int(5, 92) });
    }
  }

  // Verletzungen
  for (const o of all) {
    const p = o.player;
    const risk = 0.0035 * (0.5 + p.injuryProneness / 90) * (1.4 - p.fitness / 160);
    if (rng.chance(risk)) {
      injuries.push({ playerId: p.id, days: Math.max(3, Math.round(rng.normal(16, 14))) });
    }
  }

  // Bewertungen
  for (const s of appearances) {
    const isHome = s.clubId === homeClub.id;
    s.rating = computeRating(s, isHome ? homeScore : awayScore, isHome ? awayScore : homeScore);
  }
  const bestHome = appearances.filter((s) => s.clubId === homeClub.id).sort((a, b) => b.rating - a.rating)[0];
  const bestAway = appearances.filter((s) => s.clubId === awayClub.id).sort((a, b) => b.rating - a.rating)[0];
  const motm = homeScore >= awayScore ? bestHome : bestAway;
  if (motm) motm.motm = true;

  return { homeScore, awayScore, scorers, cards, injuries, appearances };
}

/** Elfmeterschiessen fuer K.-o.-Spiele (Konzept Abschnitt 9). */
export function penaltyShootout(
  rng: Rng, homeSquad: Player[], awaySquad: Player[],
): [number, number] {
  const takers = (squad: Player[]) => squad.filter(isAvailable)
    .sort((a, b) => (b.attrs.penalties + b.attrs.composure) - (a.attrs.penalties + a.attrs.composure))
    .slice(0, 11);
  const h = takers(homeSquad);
  const a = takers(awaySquad);
  let hs = 0, as = 0;

  const shoot = (p: Player | undefined): boolean => {
    if (!p) return rng.chance(0.7);
    return rng.chance(clamp(0.58 + p.attrs.penalties / 340 + p.attrs.composure / 620, 0.45, 0.93));
  };

  for (let i = 0; i < 5; i++) {
    if (shoot(h[i])) hs++;
    if (shoot(a[i])) as++;
  }
  let round = 5;
  while (hs === as && round < 20) {
    if (shoot(h[round % h.length])) hs++;
    if (shoot(a[round % a.length])) as++;
    round++;
  }
  return [hs, as];
}

/**
 * Menschliche Spielerfiguren fuer die Spielszenen.
 * - KeeperFigure: Frontansicht eines Torhueters (SVG, Koordinaten in Metern,
 *   Ursprung Tormitte am Boden, Hoehe negativ nach oben).
 * - DefenderFigure: Frontansicht eines Verteidigers, der einen Schuss blockt.
 * - drawHumanPlayer / drawHumanKeeper: Vogelperspektive bzw. Frontansicht auf
 *   dem Canvas.
 */
import { clamp } from '../../engine/rng';

const KEEPER_KIT = '#16c172';
const KEEPER_KIT_DARK = '#0f9257';
const SKIN = '#e3ad82';
const SHORTS = '#101b13';
const GLOVE = '#f4f7fb';
/** Standardtrikot eines Gegenspielers in den Szenen. */
export const OPPONENT_KIT = '#d84b5a';

type Pt = [number, number];
const lerp = (a: Pt, b: Pt, t: number): Pt => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const mitte = (a: Pt, b: Pt): Pt => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];

/**
 * Dunkelt eine Farbe ab - fuer Aermel, Stutzen und die Schattenseite des
 * Rumpfes. Nimmt jede #rrggbb-Angabe und braucht keine Zweitfarbe von aussen.
 */
export function dunkler(hex: string, anteil = 0.35): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const r = Math.round(((n >> 16) & 255) * (1 - anteil));
  const g = Math.round(((n >> 8) & 255) * (1 - anteil));
  const b = Math.round((n & 255) * (1 - anteil));
  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Schrift, die auf diesem Trikot lesbar ist. Die Rueckennummer stand vorher
 * immer in Dunkelgruen - auf einem dunklen Trikot war sie damit unsichtbar.
 */
export function lesbarAuf(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return '#ffffff';
  const n = parseInt(m[1], 16);
  const hell = (((n >> 16) & 255) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114) / 255;
  return hell > 0.62 ? '#0b1622' : '#ffffff';
}

/** Gelenkpositionen eines Torhueters. Aufrechtes Skelett, das sich zum Ball
 *  neigt; die Arme strecken sich bis zum Ball. So bleibt die Figur in jeder
 *  Position als Mensch erkennbar - aufrecht in der Grundstellung, gestreckt
 *  beim Hechtsprung in die Ecke. */
function keeperJoints(diveX: number, diveZ: number) {
  const dive = clamp(diveX / 3.66, -1, 1);            // seitliche Streckung -1..1
  const ad = Math.abs(dive);
  const gy = -Math.max(0.2, diveZ);
  const baseX = diveX * 0.42;                          // Koerper verlagert sich zur Ecke
  const hipY = -0.9 * (1 - ad * 0.42);                 // bei weiten Spruengen tiefer
  const hip: Pt = [baseX, hipY];
  const sho: Pt = [baseX + dive * 0.5, hipY - 0.64 * (1 - ad * 0.28)];
  const head: Pt = [sho[0] + dive * 0.12, sho[1] - 0.3];
  const foot: Pt = [baseX - 0.22 - ad * 0.35, -0.03];
  const foot2: Pt = [baseX + 0.22 + ad * 0.35, -0.03];
  const knee1: Pt = [(hip[0] + foot[0]) / 2 - 0.04, (hip[1] + foot[1]) / 2];
  const knee2: Pt = [(hip[0] + foot2[0]) / 2 + 0.04, (hip[1] + foot2[1]) / 2];
  const glove: Pt = [diveX, gy];
  return { hip, sho, head, foot, foot2, knee1, knee2, glove, baseX, dive };
}

/**
 * Frontansicht eines Torhueters, der zum Ball (diveX, diveZ) greift.
 */
export function KeeperFigure(
  { diveX, diveZ, kit = KEEPER_KIT }: { diveX: number; diveZ: number; kit?: string },
) {
  const j = keeperJoints(diveX, diveZ);
  const side = diveX >= 0 ? 1 : -1;
  const glove2: Pt = [j.glove[0] - side * 0.18, j.glove[1] + 0.16];
  const sho2: Pt = [j.sho[0] - side * 0.06, j.sho[1] + 0.05];
  const dunkel = kit === KEEPER_KIT ? KEEPER_KIT_DARK : dunkler(kit);

  const limb = (a: Pt, b: Pt, w: number, color: string, key: string) => (
    <line key={key} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]}
      stroke={color} strokeWidth={w} strokeLinecap="round" />
  );

  return (
    <g>
      {/* Schatten am Boden */}
      <ellipse cx={j.baseX} cy={-0.02} rx={0.5 + Math.abs(j.dive) * 0.5} ry={0.1}
        fill="rgba(0,0,0,0.28)" />
      {/* Beine: Oberschenkel in der Hose, Wade blank, darueber der Stutzen */}
      {limb(j.hip, j.knee1, 0.2, SHORTS, 'l1a')}
      {limb(j.knee1, j.foot, 0.15, SKIN, 'l1b')}
      {limb(j.hip, j.knee2, 0.2, SHORTS, 'l2a')}
      {limb(j.knee2, j.foot2, 0.15, SKIN, 'l2b')}
      {limb(lerp(j.knee1, j.foot, 0.45), j.foot, 0.155, dunkel, 'st1')}
      {limb(lerp(j.knee2, j.foot2, 0.45), j.foot2, 0.155, dunkel, 'st2')}
      {/* Schuhe */}
      <circle cx={j.foot[0]} cy={j.foot[1]} r={0.1} fill="#0b1016" />
      <circle cx={j.foot2[0]} cy={j.foot2[1]} r={0.1} fill="#0b1016" />
      {/* Hose an der Huefte */}
      <circle cx={j.hip[0]} cy={j.hip[1]} r={0.2} fill={SHORTS} />
      {/* Rumpf im Torwarttrikot, mit Schattenseite fuer etwas Volumen */}
      {limb(j.hip, j.sho, 0.44, kit, 'torso')}
      {limb([j.hip[0] + 0.12, j.hip[1]], [j.sho[0] + 0.12, j.sho[1]], 0.16, dunkel, 'torsoShade')}
      {/* hinterer Arm mit Handschuh */}
      {limb(sho2, glove2, 0.12, dunkel, 'arm2')}
      <circle cx={glove2[0]} cy={glove2[1]} r={0.14} fill={GLOVE} stroke="#c2ccd8" strokeWidth={0.02} />
      {/* vorderer Arm: Trikotaermel + Unterarm zum Ball */}
      {limb(j.sho, lerp(j.sho, j.glove, 0.5), 0.16, kit, 'arm1sleeve')}
      {limb(lerp(j.sho, j.glove, 0.45), j.glove, 0.12, SKIN, 'arm1')}
      {/* Kopf mit angedeutetem Haar */}
      <circle cx={j.head[0]} cy={j.head[1]} r={0.18} fill={SKIN}
        stroke="rgba(0,0,0,0.18)" strokeWidth={0.02} />
      <path d={`M ${j.head[0] - 0.18} ${j.head[1] - 0.02} a 0.18 0.18 0 0 1 0.36 0 z`}
        fill="#3a2a22" opacity={0.85} />
      {/* vorderer Handschuh */}
      <circle cx={j.glove[0]} cy={j.glove[1]} r={0.15} fill={GLOVE} stroke="#c2ccd8" strokeWidth={0.025} />
    </g>
  );
}

// --- Verteidiger in der Frontansicht -----------------------------------

/**
 * Ein Verteidiger, der einen Schuss blockt.
 *
 * Vorher stand nach einem geblockten Schuss nur ein Satz unter dem Torblick,
 * waehrend der Ball ungehindert weiterflog - man sah nie, wer da im Weg
 * stand. Diese Figur stellt ihn dorthin, wo er den Ball wirklich erreicht
 * hat: Bein raus bei flachem Ball, Koerper und Arme angelegt auf Huefthoehe,
 * im Sprung bei allem darueber.
 *
 * Koordinaten wie beim Torhueter - Meter, Hoehe negativ nach oben. `scale`
 * macht die Figur groesser, weil ein Verteidiger naeher an der Kamera steht
 * als das Tor dahinter.
 */
export function DefenderFigure(
  { x, reachX, reachZ, kit = OPPONENT_KIT, scale = 1 }:
  { x: number; reachX: number; reachZ: number; kit?: string; scale?: number },
) {
  const dunkel = dunkler(kit);
  const s = scale;
  // Wie hoch kommt der Ball? Danach richtet sich die Haltung.
  const hoch = reachZ > 1.25;
  const flach = reachZ < 0.55;
  const seite = reachX >= x ? 1 : -1;
  // Im Sprung verlaesst die Figur den Boden, sonst steht sie fest.
  const lift = hoch ? clamp((reachZ - 1.25) * 0.55, 0, 0.42) : 0;

  const boden = -lift * s;
  const hip: Pt = [x, boden - 0.92 * s];
  const sho: Pt = [x + seite * 0.06 * s, boden - 1.5 * s];
  const head: Pt = [sho[0] + seite * 0.04 * s, sho[1] - 0.26 * s];

  // Standbein und Blockbein. Bei flachem Ball streckt sich das vordere Bein
  // bis zum Ball, sonst stehen beide unter dem Koerper.
  const standFoot: Pt = [x - seite * 0.26 * s, boden - (hoch ? 0.34 * s : 0)];
  const blockFoot: Pt = flach
    ? [reachX, -Math.max(0.06, reachZ)]
    : [x + seite * (hoch ? 0.4 : 0.54) * s, boden - (hoch ? 0.48 : 0) * s];
  const knieStand: Pt = mitte(hip, standFoot);
  const knieBlockRoh = mitte(hip, blockFoot);
  const knieBlock: Pt = [knieBlockRoh[0] + seite * 0.05 * s, knieBlockRoh[1] - 0.05 * s];

  // Arme: bei hohem Ball hinter dem Ruecken (kein Handspiel), sonst am Koerper.
  const hand1: Pt = hoch
    ? [sho[0] - seite * 0.3 * s, sho[1] + 0.26 * s]
    : [sho[0] - seite * 0.36 * s, sho[1] + 0.42 * s];
  const hand2: Pt = hoch
    ? [sho[0] - seite * 0.16 * s, sho[1] + 0.4 * s]
    : [sho[0] + seite * 0.34 * s, sho[1] + 0.44 * s];

  const limb = (a: Pt, b: Pt, w: number, color: string, key: string) => (
    <line key={key} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]}
      stroke={color} strokeWidth={w * s} strokeLinecap="round" />
  );

  return (
    <g>
      {/* Schatten - im Sprung kleiner und blasser */}
      <ellipse cx={x} cy={-0.02} rx={0.44 * s * (hoch ? 0.7 : 1)} ry={0.1 * s}
        fill={`rgba(0,0,0,${hoch ? 0.18 : 0.32})`} />
      {/* Arme hinter dem Rumpf */}
      {limb(sho, hand1, 0.13, dunkel, 'da1')}
      {limb(sho, hand2, 0.13, dunkel, 'da2')}
      <circle cx={hand1[0]} cy={hand1[1]} r={0.09 * s} fill={SKIN} />
      <circle cx={hand2[0]} cy={hand2[1]} r={0.09 * s} fill={SKIN} />
      {/* Beine */}
      {limb(hip, knieStand, 0.21, SHORTS, 'ds1')}
      {limb(knieStand, standFoot, 0.16, SKIN, 'ds2')}
      {limb(lerp(knieStand, standFoot, 0.45), standFoot, 0.165, dunkel, 'dst1')}
      {limb(hip, knieBlock, 0.21, SHORTS, 'db1')}
      {limb(knieBlock, blockFoot, 0.16, SKIN, 'db2')}
      {limb(lerp(knieBlock, blockFoot, 0.45), blockFoot, 0.165, dunkel, 'dst2')}
      <circle cx={standFoot[0]} cy={standFoot[1]} r={0.1 * s} fill="#0b1016" />
      <circle cx={blockFoot[0]} cy={blockFoot[1]} r={0.1 * s} fill="#0b1016" />
      {/* Hose */}
      <circle cx={hip[0]} cy={hip[1]} r={0.21 * s} fill={SHORTS} />
      {/* Rumpf im Trikot, mit Schattenseite */}
      {limb(hip, sho, 0.46, kit, 'dtorso')}
      {limb([hip[0] + 0.13 * s, hip[1]], [sho[0] + 0.13 * s, sho[1]], 0.17, dunkel, 'dshade')}
      {/* Kopf */}
      <circle cx={head[0]} cy={head[1]} r={0.18 * s} fill={SKIN}
        stroke="rgba(0,0,0,0.2)" strokeWidth={0.02 * s} />
      <path d={`M ${head[0] - 0.18 * s} ${head[1] - 0.02 * s} a ${0.18 * s} ${0.18 * s} 0 0 1 ${0.36 * s} 0 z`}
        fill="#2c1f1a" opacity={0.85} />
    </g>
  );
}

// --- Canvas-Figuren (Vogelperspektive) ---------------------------------

export interface HumanOpts {
  label?: string;
  radius?: number;
  /** Blickrichtung in Radiant (0 = nach oben zum Tor). */
  facing?: number;
  /** Sekundaerfarbe fuer Details. */
  skin?: string;
  /**
   * Laufphase in Radiant. Beine und Arme schwingen gegenlaeufig; 0 laesst die
   * Figur ruhig stehen. Ohne das war jede Figur auf dem Feld eine erstarrte
   * Scheibe, auch waehrend sie sich bewegte.
   */
  stride?: number;
}

/**
 * Fussballer aus der Vogelperspektive: Schatten, Beine, Trikot mit Aermeln,
 * Kopf mit Haaransatz. Von oben erkennt man einen Menschen vor allem an den
 * Schultern und an den Beinen, die unter ihnen hervorkommen.
 */
export function drawHumanPlayer(
  ctx: CanvasRenderingContext2D, sx: number, sy: number, jersey: string, opts: HumanOpts = {},
) {
  const r = opts.radius ?? 10;
  const facing = opts.facing ?? 0;
  const skin = opts.skin ?? SKIN;
  const schwung = Math.sin(opts.stride ?? 0);
  const trim = dunkler(jersey, 0.4);

  ctx.save();
  ctx.translate(sx, sy);

  // Schatten
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(2, r * 1.2, r * 1.05, r * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.rotate(facing);
  ctx.lineCap = 'round';

  // Beine: ragen deutlich unter dem Rumpf hervor und schwingen
  // gegenlaeufig. Sie muessen laenger sein als die Rumpfellipse hoch ist,
  // sonst steckt die ganze Bewegung unsichtbar im Trikot.
  for (const seite of [-1, 1]) {
    const aus = schwung * seite * r * 0.5;
    const fussY = r * 1.72 + aus;
    ctx.strokeStyle = skin;
    ctx.lineWidth = r * 0.28;
    ctx.beginPath();
    ctx.moveTo(seite * r * 0.36, r * 0.6);
    ctx.lineTo(seite * r * 0.44, fussY);
    ctx.stroke();
    // Stutzen ueber dem unteren Drittel
    ctx.strokeStyle = trim;
    ctx.lineWidth = r * 0.3;
    ctx.beginPath();
    ctx.moveTo(seite * r * 0.42, r * 1.32 + aus * 0.72);
    ctx.lineTo(seite * r * 0.44, fussY);
    ctx.stroke();
    // Schuh
    ctx.fillStyle = '#0b1016';
    ctx.beginPath();
    ctx.ellipse(seite * r * 0.44, fussY + r * 0.08, r * 0.17, r * 0.13, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Arme: schwingen entgegen den Beinen und liegen seitlich neben dem Rumpf.
  ctx.strokeStyle = skin;
  ctx.lineWidth = r * 0.23;
  for (const seite of [-1, 1]) {
    const aus = -schwung * seite * r * 0.45;
    ctx.beginPath();
    ctx.moveTo(seite * r * 0.72, -r * 0.15);
    ctx.lineTo(seite * r * 1.24, r * 0.55 + aus);
    ctx.stroke();
  }

  // Schultern / Oberkoerper im Trikot (leicht laenglich in Blickrichtung)
  ctx.fillStyle = jersey;
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 0.95, r * 1.15, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.45)';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // Aermel als abgesetzte Kappen auf den Schultern - macht aus der Scheibe
  // ein Trikot.
  ctx.fillStyle = trim;
  ctx.beginPath();
  ctx.ellipse(-r * 0.82, -r * 0.05, r * 0.3, r * 0.42, 0.35, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(r * 0.82, -r * 0.05, r * 0.3, r * 0.42, -0.35, 0, Math.PI * 2);
  ctx.fill();

  // Licht von oben links auf der Schulter
  ctx.fillStyle = 'rgba(255,255,255,0.13)';
  ctx.beginPath();
  ctx.ellipse(-r * 0.28, -r * 0.42, r * 0.4, r * 0.48, 0.3, 0, Math.PI * 2);
  ctx.fill();

  // Kopf vorne (zum Tor gewandt), Haaransatz nach hinten. Er sitzt hoeher
  // als der Rumpf reicht, sonst waere er nur ein Fleck auf der Schulter.
  const kopfY = -r * 1.06;
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(0, kopfY, r * 0.46, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(46,32,26,0.85)';
  ctx.beginPath();
  ctx.arc(0, kopfY + r * 0.07, r * 0.46, 0.12 * Math.PI, 0.88 * Math.PI);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(0, kopfY, r * 0.46, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();

  if (opts.label) {
    // Die Nummer muss auf hellen wie auf dunklen Trikots lesbar bleiben.
    ctx.fillStyle = lesbarAuf(jersey);
    ctx.font = `bold ${Math.round(r * 0.95)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(opts.label, sx, sy + r * 0.12);
  }
}

/**
 * Torhueter in der Frontansicht auf dem Canvas (fuer die Torwart-Szene).
 * toScreen bildet Meter (x seitlich, z Hoehe) auf Pixel ab.
 */
export function drawHumanKeeper(
  ctx: CanvasRenderingContext2D,
  toScreen: (x: number, z: number) => [number, number],
  diveX: number, diveZ: number, kit = KEEPER_KIT,
) {
  // dieselbe Skelett-Logik wie die SVG-Figur, nur mit positiver Hoehe.
  const j = keeperJoints(diveX, diveZ);
  const flipY = (p: Pt): Pt => [p[0], -p[1]];
  const hip = flipY(j.hip), sho = flipY(j.sho), head = flipY(j.head);
  const foot = flipY(j.foot), foot2 = flipY(j.foot2);
  const knee1 = flipY(j.knee1), knee2 = flipY(j.knee2), glove = flipY(j.glove);
  const side = diveX >= 0 ? 1 : -1;
  const glove2: Pt = [glove[0] - side * 0.18, glove[1] - 0.16];
  const sho2: Pt = [sho[0] - side * 0.06, sho[1] - 0.05];
  const dunkel = kit === KEEPER_KIT ? KEEPER_KIT_DARK : dunkler(kit);

  const scale = Math.abs(toScreen(1, 0)[0] - toScreen(0, 0)[0]);
  const seg = (a: Pt, b: Pt, w: number, color: string) => {
    const [ax, ay] = toScreen(a[0], a[1]);
    const [bx, by] = toScreen(b[0], b[1]);
    ctx.strokeStyle = color; ctx.lineWidth = Math.max(1, w * scale); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
  };
  const dot = (p: Pt, r: number, color: string) => {
    const [px, py] = toScreen(p[0], p[1]);
    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(px, py, Math.max(1.5, r * scale), 0, Math.PI * 2); ctx.fill();
  };

  // Schatten
  const [shx, shy] = toScreen(j.baseX, 0);
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath();
  ctx.ellipse(shx, shy, (0.5 + Math.abs(j.dive) * 0.5) * scale, 0.12 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  seg(hip, knee1, 0.2, SHORTS); seg(knee1, foot, 0.16, SKIN);
  seg(hip, knee2, 0.2, SHORTS); seg(knee2, foot2, 0.16, SKIN);
  seg(mitte(knee1, foot), foot, 0.165, dunkel);
  seg(mitte(knee2, foot2), foot2, 0.165, dunkel);
  dot(foot, 0.1, '#0b1016'); dot(foot2, 0.1, '#0b1016');
  dot(hip, 0.2, SHORTS);
  seg(hip, sho, 0.44, kit);
  seg([hip[0] + 0.12, hip[1]], [sho[0] + 0.12, sho[1]], 0.16, dunkel);
  seg(sho2, glove2, 0.12, dunkel); dot(glove2, 0.14, GLOVE);
  seg(sho, mitte(sho, glove), 0.16, kit);
  seg(mitte(sho, glove), glove, 0.12, SKIN);
  dot(head, 0.18, SKIN);
  dot(glove, 0.15, GLOVE);
}

export { KEEPER_KIT };

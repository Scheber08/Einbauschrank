/**
 * Menschliche Spielerfiguren fuer die Spielszenen.
 * - KeeperFigure: Frontansicht eines Torhueters (SVG, Koordinaten in Metern,
 *   Ursprung Tormitte am Boden, Hoehe negativ nach oben).
 * - drawHumanPlayer / drawHumanKeeper: Vogelperspektive bzw. Frontansicht auf
 *   dem Canvas.
 */
import { clamp } from '../../engine/rng';

const KEEPER_KIT = '#16c172';
const KEEPER_KIT_DARK = '#0f9257';
const SKIN = '#e3ad82';
const SHORTS = '#101b13';
const GLOVE = '#f4f7fb';

type Pt = [number, number];
const lerp = (a: Pt, b: Pt, t: number): Pt => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

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

  const limb = (a: Pt, b: Pt, w: number, color: string, key: string) => (
    <line key={key} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]}
      stroke={color} strokeWidth={w} strokeLinecap="round" />
  );

  return (
    <g>
      {/* Schatten am Boden */}
      <ellipse cx={j.baseX} cy={-0.02} rx={0.5 + Math.abs(j.dive) * 0.5} ry={0.1}
        fill="rgba(0,0,0,0.28)" />
      {/* Beine mit Knie */}
      {limb(j.hip, j.knee1, 0.18, SKIN, 'l1a')}
      {limb(j.knee1, j.foot, 0.15, SKIN, 'l1b')}
      {limb(j.hip, j.knee2, 0.18, SKIN, 'l2a')}
      {limb(j.knee2, j.foot2, 0.15, SKIN, 'l2b')}
      {/* Schuhe */}
      <circle cx={j.foot[0]} cy={j.foot[1]} r={0.1} fill={SHORTS} />
      <circle cx={j.foot2[0]} cy={j.foot2[1]} r={0.1} fill={SHORTS} />
      {/* Hose an der Huefte */}
      <circle cx={j.hip[0]} cy={j.hip[1]} r={0.2} fill={SHORTS} />
      {/* Rumpf im Torwarttrikot */}
      {limb(j.hip, j.sho, 0.44, kit, 'torso')}
      {/* hinterer Arm mit Handschuh */}
      {limb(sho2, glove2, 0.12, KEEPER_KIT_DARK, 'arm2')}
      <circle cx={glove2[0]} cy={glove2[1]} r={0.14} fill={GLOVE} stroke="#c2ccd8" strokeWidth={0.02} />
      {/* vorderer Arm: Trikotaermel + Unterarm zum Ball */}
      {limb(j.sho, lerp(j.sho, j.glove, 0.5), 0.16, kit, 'arm1sleeve')}
      {limb(lerp(j.sho, j.glove, 0.45), j.glove, 0.12, SKIN, 'arm1')}
      {/* Kopf */}
      <circle cx={j.head[0]} cy={j.head[1]} r={0.18} fill={SKIN}
        stroke="rgba(0,0,0,0.18)" strokeWidth={0.02} />
      {/* vorderer Handschuh */}
      <circle cx={j.glove[0]} cy={j.glove[1]} r={0.15} fill={GLOVE} stroke="#c2ccd8" strokeWidth={0.025} />
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
}

/**
 * Fussballer aus der Vogelperspektive: Schatten, Schultern im Trikot, Kopf.
 * Wirkt dadurch deutlich menschlicher als eine flache Scheibe.
 */
export function drawHumanPlayer(
  ctx: CanvasRenderingContext2D, sx: number, sy: number, jersey: string, opts: HumanOpts = {},
) {
  const r = opts.radius ?? 10;
  const facing = opts.facing ?? 0;
  const skin = opts.skin ?? SKIN;

  ctx.save();
  ctx.translate(sx, sy);

  // Schatten
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(2, 4, r * 1.0, r * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.rotate(facing);

  // Schultern / Oberkoerper im Trikot (leicht laenglich in Blickrichtung)
  ctx.fillStyle = jersey;
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 0.95, r * 1.15, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.45)';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // Arme als kleine Stummel seitlich
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.ellipse(-r * 0.9, r * 0.1, r * 0.28, r * 0.5, 0.3, 0, Math.PI * 2);
  ctx.ellipse(r * 0.9, r * 0.1, r * 0.28, r * 0.5, -0.3, 0, Math.PI * 2);
  ctx.fill();

  // Kopf vorne (zum Tor gewandt)
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(0, -r * 0.7, r * 0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.restore();

  if (opts.label) {
    ctx.fillStyle = '#04220f';
    ctx.font = `bold ${Math.round(r * 0.95)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(opts.label, sx, sy + 1);
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

  seg(hip, knee1, 0.18, SKIN); seg(knee1, foot, 0.15, SKIN);
  seg(hip, knee2, 0.18, SKIN); seg(knee2, foot2, 0.15, SKIN);
  dot(foot, 0.1, SHORTS); dot(foot2, 0.1, SHORTS);
  dot(hip, 0.2, SHORTS);
  seg(hip, sho, 0.44, kit);
  seg(sho2, glove2, 0.12, KEEPER_KIT_DARK); dot(glove2, 0.14, GLOVE);
  seg(sho, [(sho[0] + glove[0]) / 2, (sho[1] + glove[1]) / 2], 0.16, kit);
  seg([(sho[0] + glove[0]) / 2, (sho[1] + glove[1]) / 2], glove, 0.12, SKIN);
  dot(head, 0.18, SKIN);
  dot(glove, 0.15, GLOVE);
}

export { KEEPER_KIT };

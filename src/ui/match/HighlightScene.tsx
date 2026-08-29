/**
 * Interaktive Spielszenen in 2D-Vogelperspektive
 * (Konzept Abschnitt 21, 22, 24, 25, 26).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CROSSBAR, GOAL_HALF_WIDTH, availableMoves, describeShot, hitsWall, resolveDribble, resolveDuel,
  resolvePass, resolveSave, resolveShot, simulateBallFlight,
  type BallInput, type DribbleMove, type Flight, type ShotResolution,
} from '../../engine/ballAction';
import type { Challenge, ChallengeResult } from '../../engine/matchTypes';
import { Rng, clamp } from '../../engine/rng';
import type { DifficultySettings, Player } from '../../engine/types';
import type { BlockPoint } from '../../engine/ballAction';
import { DefenderFigure, OPPONENT_KIT } from './figures';
import { KeeperFigure, drawHumanKeeper, drawHumanPlayer } from './figures';
import { t as tr, tDecimal, tVariant } from '../../i18n';
import { useLocale } from '../../i18n/useLocale';

const VIEW_W = 880;
const VIEW_H = 440;

export interface SceneProps {
  challenge: Challenge;
  player: Player;
  difficulty: DifficultySettings;
  seed: number;
  onDone: (result: ChallengeResult) => void;
}

export default function HighlightScene(props: SceneProps) {
  useLocale();
  const { kind } = props.challenge;
  if (kind === 'duel' || kind === 'interception' || kind === 'dribble') {
    return <TimingChallenge {...props} />;
  }
  if (kind === 'save' || kind === 'penaltySave') {
    return <SaveChallenge {...props} />;
  }
  return <BallChallenge {...props} />;
}

/**
 * Wie viele Sekunden bleiben, bis der Gegner da ist.
 * 0 bedeutet: keine Hetze - bei ruhendem Ball wartet der Gegner ebenfalls.
 *
 * Ohne diese Uhr liesse sich jede Szene beliebig lange auspendeln; genau das
 * nimmt einer Grosschance die Spannung. Der Wert ist bewusst grosszuegig -
 * es geht um Druck, nicht um Hektik.
 */
function pressureSeconds(challenge: Challenge, difficulty: DifficultySettings): number {
  if (challenge.kind === 'penalty' || challenge.kind === 'freeKick') return 0;
  // Die Uhr laeuft ueber die ganze Szene, also ueber Richtung, Kraft und
  // Ballkontakt zusammen. Sie ist bewusst grosszuegig bemessen: Wer weiss, was
  // er tut, schafft es locker - nur das ewige Auspendeln faellt weg.
  // Wer mehr Hektik will, senkt BASE; wer mehr Ruhe will, erhoeht sie.
  const BASE = 8.5;
  return clamp((BASE - challenge.pressure * 3.4) / difficulty.meterSpeed, 3.4, 13);
}

/**
 * Laufende Uhr fuer den Gegnerdruck. Liefert den Rest als Anteil (1 bis 0) und
 * ruft `onExpire` genau einmal auf. Rechnet mit der Systemuhr statt mit
 * Einzelbildern, damit die Zeit auch bei stockender Bildrate stimmt.
 */
function usePressureClock(seconds: number, active: boolean, onExpire: () => void): number {
  const [left, setLeft] = useState(1);
  const firedRef = useRef(false);
  const expireRef = useRef(onExpire);
  expireRef.current = onExpire;

  useEffect(() => {
    if (!active || seconds <= 0) return;
    const start = performance.now();
    firedRef.current = false;
    let raf = 0;
    const loop = () => {
      const rest = clamp(1 - (performance.now() - start) / (seconds * 1000), 0, 1);
      setLeft(rest);
      if (rest <= 0) {
        if (!firedRef.current) { firedRef.current = true; expireRef.current(); }
        return;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [seconds, active]);

  return seconds > 0 ? left : 1;
}

/**
 * Laesst eine Ergebnisanzeige von selbst weiterlaufen. Ein gelungener Moment
 * darf kurz stehen bleiben, alles andere bremst den Spielfluss nur. Der
 * "Weiter"-Knopf bleibt daneben als Abkuerzung bestehen.
 */
function useAutoAdvance(active: boolean, good: boolean, run: () => void) {
  const runRef = useRef(run);
  runRef.current = run;
  useEffect(() => {
    if (!active) return;
    const timer = window.setTimeout(() => runRef.current(), good ? 2400 : 1500);
    return () => window.clearTimeout(timer);
  }, [active, good]);
}

/** Balken, der den heranrueckenden Gegner sichtbar macht. */
function PressureBar({ left }: { left: number }) {
  const colour = left > 0.5 ? '#43d99a' : left > 0.22 ? '#e5cd7c' : '#ff6b7a';
  return (
    <div className="pressure-bar" title={tr('match.timeUntilPressure')}>
      <span style={{ width: `${left * 100}%`, background: colour }} />
    </div>
  );
}

function Frame(
  { challenge, step, steps, hint, footer, pressureLeft, children }:
  {
    challenge: Challenge; step: number; steps: string[]; hint: string;
    footer?: React.ReactNode; pressureLeft?: number; children: React.ReactNode;
  },
) {
  return (
    <div className="scene-overlay">
      <div className="scene">
        {pressureLeft !== undefined && <PressureBar left={pressureLeft} />}
        <div className="scene-head">
          <span className="title">{challenge.title}</span>
          <span className="pill">{challenge.minute}.</span>
          <span className="pill">
            {challenge.homeName} {challenge.scoreline[0]}:{challenge.scoreline[1]} {challenge.awayName}
          </span>
          {challenge.bigChance && <span className="pill warn">{tr('match.bigChance')}</span>}
          <span className="spacer" />
          <span className="step-dots">
            {steps.map((_, i) => (
              <i key={i} className={i === step ? 'on' : i < step ? 'done' : ''} />
            ))}
          </span>
          <span className="small muted">{steps[step] ?? ''}</span>
        </div>
        {children}
        <div className="scene-foot">
          <span className="small muted" style={{ flex: 1 }}>{hint}</span>
          {footer}
        </div>
      </div>
    </div>
  );
}

// --- Torblick: Frontansicht des Tores ----------------------------------

/**
 * Zeigt, wo der Ball die Torlinie kreuzt und wohin der Torwart gesprungen ist.
 * Dient sowohl als Vorschau waehrend der Eingabe als auch als Auswertung.
 */
/**
 * Ausgeliehen an die Figuren-Vorschau: dort laesst sich der Blockfall
 * ansehen, ohne ihn im Spiel erst treffen zu muessen. Eine Nachbildung in
 * der Vorschau waere frueher oder spaeter vom Original abgewichen - genau
 * das soll sie nicht.
 */
export function GoalView(
  { crossing, keeper, preview, outcome, label, note, animate, block, shotFrom }:
  {
    crossing?: { x: number; z: number } | null;
    keeper?: { diveX: number; diveZ: number } | null;
    preview?: { x: number; z: number } | null;
    outcome?: string;
    label?: string;
    note?: string;
    /** Beim Ergebnis: Ball einfliegen und Torwart hechten lassen. */
    animate?: boolean;
    /** Wo ein Verteidiger oder die Mauer den Ball aufgehalten hat. */
    block?: BlockPoint | null;
    /** Entfernung des Schuetzen zum Tor - fuer die Groesse des Blockers. */
    shotFrom?: number;
  },
) {
  const inFrame = (p: { x: number; z: number }) =>
    Math.abs(p.x) < GOAL_HALF_WIDTH && p.z >= 0 && p.z < CROSSBAR;

  // Fortschritt 0..1 fuer die Ergebnis-Animation.
  const [t, setT] = useState(animate ? 0 : 1);
  useEffect(() => {
    if (!animate) { setT(1); return; }
    setT(0);
    const start = performance.now();
    let raf = 0;
    const loop = (now: number) => {
      const p = Math.min(1, (now - start) / 480);
      setT(p);
      if (p < 1) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [animate, crossing?.x, crossing?.z]);

  const ease = t * (2 - t); // easeOutQuad
  // Torwart hechtet aus der Grundstellung in die Ecke.
  const kx = keeper ? keeper.diveX * ease : 0;
  const kz = keeper ? 0.95 + (keeper.diveZ - 0.95) * ease : 0.95;

  /**
   * Der Blick geht von hinter dem Schuetzen aufs Tor: Was naeher an der
   * Kamera steht, erscheint groesser. Streng gerechnet waere ein Verteidiger
   * vier Meter vor dem Schuetzen fast dreimal so gross wie das Tor dahinter
   * und verdeckte den halben Kasten. Deshalb eine **abgeflachte**
   * Perspektive: linear von 1 an der Torlinie bis 1,55 beim Schuetzen. Sie
   * ordnet die Tiefe richtig ein und bleibt lesbar - eine Stilisierung,
   * keine strenge Optik. Die Kamera sitzt dabei auf der Mittelachse.
   */
  const naehe = block
    ? clamp(1 + (block.y / Math.max(6, shotFrom ?? 18)) * 0.55, 1, 1.55)
    : 1;
  // Ein weit aussen geblockter Ball schoebe den Verteidiger aus dem Bild -
  // gemessen stand er bei x = -6,6 in einem Rahmen, der bei -6 endet, und war
  // damit genau das, was er nicht mehr sein sollte: unsichtbar. Ball und
  // Blocker rutschen deshalb gemeinsam so weit herein, dass beide im Bild
  // bleiben; ihr Abstand zueinander bleibt dabei unveraendert.
  const RAND = 4.7;
  const rohX = block ? block.x * naehe : 0;
  const verschub = clamp(rohX, -RAND, RAND) - rohX;
  const blockX = rohX + verschub;
  const blockZ = block ? block.z * naehe : 0;
  // Beim flachen Ball steht der Verteidiger neben dem Ball und streckt das
  // Bein; sonst deckt sein Koerper den Punkt selbst.
  const standX = clamp(blockX - (blockZ < 0.55 ? 0.5 * naehe : 0), -RAND, RAND);

  // Ball fliegt aus der Ferne (klein) zum Auftreffpunkt - oder nur bis
  // dorthin, wo ihn jemand aufgehalten hat.
  const ballT = animate ? Math.min(1, t * 1.15) : 1;
  const ziel = block ? { x: blockX, z: blockZ } : crossing;
  const bx = ziel ? ziel.x * (0.25 + 0.75 * ballT) : 0;
  const bz = ziel ? 0.7 + (ziel.z - 0.7) * ballT : 0;
  const isGoal = outcome === 'goal';

  return (
    <div style={{ flex: '1 1 320px', minWidth: 260 }}>
      {label && <div className="tiny dim center" style={{ marginBottom: 4 }}>{label}</div>}
      <svg viewBox="-6 -3.2 12 3.9" style={{ width: '100%', display: 'block' }}
        role="img" aria-label={tr('scene.goalView')}>
        {/* Hintergrund und Rasen */}
        <rect x={-6} y={-3.2} width={12} height={3.9} fill="#0d3a20" />
        <rect x={-6} y={0} width={12} height={0.7} fill="#0f4d29" />
        <line x1={-6} y1={0} x2={6} y2={0} stroke="rgba(255,255,255,0.5)" strokeWidth={0.04} />

        {/* Tor-Aufleuchten bei einem Treffer */}
        {isGoal && t > 0.7 && (
          <rect x={-GOAL_HALF_WIDTH} y={-CROSSBAR} width={GOAL_HALF_WIDTH * 2} height={CROSSBAR}
            fill="rgba(55,214,122,0.18)" />
        )}

        {/* Netz */}
        <rect x={-GOAL_HALF_WIDTH} y={-CROSSBAR} width={GOAL_HALF_WIDTH * 2} height={CROSSBAR}
          fill="rgba(255,255,255,0.07)" />
        {Array.from({ length: 15 }, (_, i) => (
          <line key={`v${i}`}
            x1={-GOAL_HALF_WIDTH + (GOAL_HALF_WIDTH * 2 / 15) * (i + 1)} y1={-CROSSBAR}
            x2={-GOAL_HALF_WIDTH + (GOAL_HALF_WIDTH * 2 / 15) * (i + 1)} y2={0}
            stroke="rgba(255,255,255,0.16)" strokeWidth={0.015} />
        ))}
        {Array.from({ length: 5 }, (_, i) => (
          <line key={`h${i}`}
            x1={-GOAL_HALF_WIDTH} y1={-CROSSBAR + (CROSSBAR / 5) * (i + 1)}
            x2={GOAL_HALF_WIDTH} y2={-CROSSBAR + (CROSSBAR / 5) * (i + 1)}
            stroke="rgba(255,255,255,0.16)" strokeWidth={0.015} />
        ))}

        {/* Das Netz beult sich dort aus, wo der Ball einschlaegt - vorher
            hing es voellig unbeeindruckt da, waehrend der Ball hindurchflog. */}
        {isGoal && crossing && t > 0.72 && (
          <ellipse cx={crossing.x * 1.02} cy={-crossing.z}
            rx={0.75 * (t - 0.72) / 0.28} ry={0.62 * (t - 0.72) / 0.28}
            fill="rgba(255,255,255,0.2)" />
        )}

        {/* Torrahmen */}
        <path d={`M ${-GOAL_HALF_WIDTH} 0 L ${-GOAL_HALF_WIDTH} ${-CROSSBAR} L ${GOAL_HALF_WIDTH} ${-CROSSBAR} L ${GOAL_HALF_WIDTH} 0`}
          fill="none" stroke="#ffffff" strokeWidth={0.14} strokeLinecap="square" />

        {/* Torwart: menschliche Figur - beim Ergebnis im Sprung, sonst in
            Grundstellung, damit man sieht, wen man ueberwinden muss. */}
        {keeper
          ? <KeeperFigure diveX={kx} diveZ={kz} />
          : <KeeperFigure diveX={0} diveZ={0.95} />}

        {/* Vorschau des voraussichtlichen Auftreffpunkts */}
        {preview && (
          <g>
            <circle cx={preview.x} cy={-preview.z} r={0.3} fill="none"
              stroke={inFrame(preview) ? '#43d99a' : '#ff8a95'}
              strokeWidth={0.07} strokeDasharray="0.18 0.14" />
            <circle cx={preview.x} cy={-preview.z} r={0.08}
              fill={inFrame(preview) ? '#43d99a' : '#ff8a95'} />
          </g>
        )}

        {/* Wer den Ball aufgehalten hat. Steht vor dem Tor, weil er
            naeher an der Kamera ist als der Kasten. */}
        {block && block.kind === 'wall' && (
          <g opacity={0.96}>
            {[-1.5, -0.5, 0.5, 1.5].map((i) => {
              // Die Mauer bleibt als Ganzes im Bild, nicht nur ihre Mitte.
              const mx = clamp(blockX, -RAND + 1.9, RAND - 1.9) + i * 0.78 * naehe;
              return (
                <DefenderFigure key={i} x={mx} reachX={mx} reachZ={blockZ}
                  kit={OPPONENT_KIT} scale={naehe} />
              );
            })}
          </g>
        )}
        {block && block.kind === 'defender' && (
          <DefenderFigure x={standX} reachX={blockX} reachZ={blockZ}
            kit={OPPONENT_KIT} scale={naehe} />
        )}

        {/* Wohin der Ball gegangen waere - macht sichtbar, dass die
            Richtung stimmte und nur der Weg zu war. */}
        {block && crossing && t > 0.6 && (
          <line x1={blockX} y1={-blockZ} x2={crossing.x} y2={-crossing.z}
            stroke="rgba(255,255,255,0.34)" strokeWidth={0.05}
            strokeDasharray="0.2 0.18" />
        )}

        {/* Ball (fliegt ein) und Netzjubel */}
        {(crossing || block) && (
          <g>
            {isGoal && crossing && t >= 1 && (
              <circle cx={crossing.x} cy={-crossing.z} r={0.5} fill="none"
                stroke="#43d99a" strokeWidth={0.09} opacity={0.9} />
            )}
            {/* Prallmarke am Blockpunkt */}
            {block && t >= 1 && (
              <circle cx={blockX} cy={-blockZ} r={0.34 * naehe} fill="none"
                stroke="#ff8a95" strokeWidth={0.07} opacity={0.85} />
            )}
            <circle cx={bx} cy={-bz} r={(0.22 + 0.06 * ballT) * (block ? naehe : 1)}
              fill="#ffffff" stroke="#20303f" strokeWidth={0.05} />
          </g>
        )}

        {/* Hinweis, wenn der Ball das Tor gar nicht erreicht */}
        {note && !crossing && !preview && (
          <text x={0} y={-1.2} textAnchor="middle" fontSize={0.42}
            fill="#ff8a95" fontWeight={600}>{note}</text>
        )}
      </svg>
    </div>
  );
}

// --- Gemeinsame Zeichenroutinen ---------------------------------------

interface Transform {
  scale: number;
  originY: number;
  toScreen: (x: number, y: number) => [number, number];
  toWorld: (sx: number, sy: number) => [number, number];
}

function makeTransform(maxDepth: number): Transform {
  const xHalf = 21;
  const topPad = 34;
  const scale = Math.min(VIEW_W / (xHalf * 2), (VIEW_H - topPad - 18) / maxDepth);
  const toScreen = (x: number, y: number): [number, number] =>
    [VIEW_W / 2 + x * scale, topPad + y * scale];
  const toWorld = (sx: number, sy: number): [number, number] =>
    [(sx - VIEW_W / 2) / scale, (sy - topPad) / scale];
  return { scale, originY: topPad, toScreen, toWorld };
}

function drawPitch(ctx: CanvasRenderingContext2D, t: Transform) {
  ctx.fillStyle = '#0f4d29';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  const stripe = 7 * t.scale;
  ctx.fillStyle = 'rgba(255,255,255,0.028)';
  for (let i = 0; i * stripe < VIEW_H; i += 2) {
    ctx.fillRect(0, t.originY + i * stripe, VIEW_W, stripe);
  }

  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 2;

  const [, lineY] = t.toScreen(0, 0);
  ctx.beginPath();
  ctx.moveTo(0, lineY);
  ctx.lineTo(VIEW_W, lineY);
  ctx.stroke();

  const [boxLeft, boxTop] = t.toScreen(-20.15, 0);
  ctx.strokeRect(boxLeft, boxTop, 40.3 * t.scale, 16.5 * t.scale);

  const [smallLeft] = t.toScreen(-9.16, 0);
  ctx.strokeRect(smallLeft, boxTop, 18.32 * t.scale, 5.5 * t.scale);

  const [px, py] = t.toScreen(0, 11);
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.beginPath();
  ctx.arc(px, py, 2.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(px, py, 9.15 * t.scale, 0.35 * Math.PI, 0.65 * Math.PI);
  ctx.stroke();

  const [gLeft, gY] = t.toScreen(-GOAL_HALF_WIDTH, 0);
  const goalW = GOAL_HALF_WIDTH * 2 * t.scale;
  const goalDepth = 2.2 * t.scale;
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  ctx.fillRect(gLeft, gY - goalDepth, goalW, goalDepth);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 4;
  ctx.strokeRect(gLeft, gY - goalDepth, goalW, goalDepth);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1;
  for (let i = 1; i < 9; i++) {
    const x = gLeft + (goalW / 9) * i;
    ctx.beginPath();
    ctx.moveTo(x, gY - goalDepth);
    ctx.lineTo(x, gY);
    ctx.stroke();
  }
}

function drawPlayer(
  ctx: CanvasRenderingContext2D, t: Transform,
  x: number, y: number, color: string, label?: string, radius = 9, facing = 0,
  stride = 0,
) {
  const [sx, sy] = t.toScreen(x, y);
  drawHumanPlayer(ctx, sx, sy, color, { label, radius: radius * 1.05, facing, stride });
}

function drawBall(ctx: CanvasRenderingContext2D, t: Transform, x: number, y: number, z: number) {
  const [sx, sy] = t.toScreen(x, y);
  const lift = z * t.scale * 0.55;
  // Schatten schrumpft und verblasst mit der Flughoehe.
  ctx.fillStyle = `rgba(0,0,0,${clamp(0.42 - z * 0.05, 0.12, 0.42)})`;
  ctx.beginPath();
  ctx.ellipse(sx, sy, (5 + z * 0.5) * clamp(1 - z * 0.05, 0.5, 1), 2.6 + z * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();

  const cx = sx;
  const cy = sy - lift;
  const r = 5.5 + z * 0.55;
  // Kugeliger Ball mit leichtem Licht von oben links.
  const grad = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.2, cx, cy, r);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(1, '#c9d2dc');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  // Rotierendes Fuenfeck als Muster - der Ball scheint zu rollen.
  const spin = x * 0.9 + y * 0.5;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(spin);
  ctx.fillStyle = 'rgba(30,42,58,0.9)';
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
    const rr = r * 0.42;
    const px = Math.cos(a) * rr;
    const py = Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = 'rgba(20,30,45,0.6)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
}

// --- Schuss, Freistoss, Elfmeter, Pass ---------------------------------

type BallStep = 'target' | 'aim' | 'power' | 'contact' | 'flight' | 'result';

function BallChallenge({ challenge, player, difficulty, seed, onDone }: SceneProps) {
  const passLike = challenge.kind === 'pass' || challenge.kind === 'cross' || challenge.kind === 'throughBall';
  const isHeader = challenge.kind === 'header';
  // Steht der Spieler in einer Vorlagen-Szene selbst gut zum Abschluss (kurze,
  // einigermassen zentrale Distanz), ist der Schuss die Standardaktion - der Pass
  // bleibt per Knopf moeglich. In tiefen/breiten Positionen bleibt der Pass Standard.
  const goodShotPosition = passLike && challenge.distance <= 18 && Math.abs(challenge.offset) <= 12;
  // In einer Vorlagen-Szene darf der Nutzer selbst abschliessen, statt zu passen -
  // sonst wuerde ein gewollter Schuss als Fehlpass gewertet.
  const [selfShoot, setSelfShoot] = useState(goodShotPosition);
  const isPass = passLike && !selfShoot;
  const stepOrder: BallStep[] = isPass
    ? ['target', 'aim', 'power', 'contact', 'flight', 'result']
    : ['aim', 'power', 'contact', 'flight', 'result'];
  const stepLabels = isPass
    ? [tr('scene.teammate'), tr('scene.direction'), tr('scene.power'), tr('scene.contact'), '', '']
    : [tr('scene.direction'), isHeader ? tr('scene.force') : tr('scene.power'), tr('scene.contact'), '', ''];

  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [step, setStep] = useState<BallStep>(passLike && !goodShotPosition ? 'target' : 'aim');
  const [targetId, setTargetId] = useState<string | null>(challenge.targets?.[0]?.id ?? null);
  const [aim, setAim] = useState<{ x: number; y: number } | null>(null);
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const [contactHover, setContactHover] = useState({ x: 0, y: 0 });
  const [lockedPower, setLockedPower] = useState(0.5);
  const [resultText, setResultText] = useState('');
  const [reason, setReason] = useState('');

  const powerRef = useRef(0);
  const chargingRef = useRef(false);
  const chargeStartRef = useRef(0);
  const [powerDisplay, setPowerDisplay] = useState(0);
  // `stop` begrenzt den abgespielten Flug: Bei einem Block endet der Ball
  // dort, wo ihn jemand aufgehalten hat, statt weiter Richtung Tor zu
  // fliegen, als waere nichts gewesen.
  const flightRef = useRef<{ flight: Flight; index: number; stop: number } | null>(null);
  const shotRef = useRef<ShotResolution | null>(null);
  const finalRef = useRef<ChallengeResult | null>(null);
  const phaseRef = useRef(0);
  /** Laeuft nur waehrend des Torjubels und treibt die Ringe. */
  const jubelRef = useRef(0);

  const depth = Math.max(24, challenge.distance + 12);
  const t = useMemo(() => makeTransform(depth), [depth]);

  // Gegenspieler einmalig festlegen, damit sie nicht springen.
  const defenders = useMemo(() => {
    const rng = new Rng(seed);
    const count = challenge.kind === 'penalty' ? 0 : Math.round(1 + challenge.pressure * 4);
    return Array.from({ length: count }, () => ({
      x: clamp(challenge.offset + rng.normal(0, 6), -18, 18),
      y: clamp(challenge.distance * rng.float(0.15, 0.8), 1.5, challenge.distance - 1),
      // Leichte Eigenbewegung, damit die Szene lebendig wirkt.
      speed: rng.float(0.4, 1.3),
      phase: rng.float(0, Math.PI * 2),
      amp: rng.float(0.3, 1.1),
    }));
  }, [challenge, seed]);

  const wall = useMemo(() => {
    if (challenge.kind !== 'freeKick') return [];
    const n = challenge.wall ?? 4;
    const dist = 9.15;
    const dx = -challenge.offset;
    const dy = -challenge.distance;
    const len = Math.hypot(dx, dy) || 1;
    const wx = challenge.offset + (dx / len) * dist;
    const wy = challenge.distance + (dy / len) * dist;
    return Array.from({ length: n }, (_, i) => ({ x: wx + (i - (n - 1) / 2) * 0.78, y: wy }));
  }, [challenge]);

  const keeperPos = useMemo(
    () => ({ x: clamp(challenge.offset * 0.12, -1.6, 1.6), y: 1.2 }), [challenge],
  );

  /** Voraussichtlicher Auftreffpunkt ohne Ausfuehrungsfehler. */
  const preview = useMemo(() => {
    if (step !== 'contact' || !aim || isPass) return null;
    const flight = simulateBallFlight({
      startX: challenge.offset,
      startY: challenge.distance,
      aimX: aim.x,
      aimY: aim.y,
      power: lockedPower,
      contactX: contactHover.x,
      contactY: contactHover.y,
      shotPower: isHeader ? player.attrs.heading : player.attrs.shotPower,
      curve: player.attrs.curve,
    });
    return flight.crossing ? { x: flight.crossing.x, z: flight.crossing.z } : null;
  }, [step, aim, contactHover, lockedPower, challenge, player, isPass, isHeader]);

  /** Beim Freistoss: Geht der Ball mit dieser Ausfuehrung ueber die Mauer? */
  const wallBlocks = useMemo(() => {
    if (challenge.kind !== 'freeKick' || step !== 'contact' || !aim) return false;
    const flight = simulateBallFlight({
      startX: challenge.offset,
      startY: challenge.distance,
      aimX: aim.x,
      aimY: aim.y,
      power: lockedPower,
      contactX: contactHover.x,
      contactY: contactHover.y,
      shotPower: player.attrs.shotPower,
      curve: player.attrs.curve,
    });
    return hitsWall(flight, challenge);
  }, [step, aim, contactHover, lockedPower, challenge, player]);

  /**
   * Grobe Zielhilfe schon waehrend des Zielens: wo kreuzt der Ball die Torlinie?
   * Mit repraesentativer Kraft und mittigem Kontakt gerechnet - so sieht man
   * sofort, ob man das schmale Tor ueberhaupt anvisiert, statt es erst nach dem
   * Kontaktpunkt zu erfahren.
   */
  const aimGuide = useMemo(() => {
    if (isPass) return null;
    if (step !== 'aim' && step !== 'power') return null;
    const dir = step === 'aim' ? (hover ?? aim) : aim;
    if (!dir) return null;
    const flight = simulateBallFlight({
      startX: challenge.offset,
      startY: challenge.distance,
      aimX: dir.x,
      aimY: dir.y,
      power: 0.74,
      contactX: 0,
      contactY: 0,
      shotPower: isHeader ? player.attrs.heading : player.attrs.shotPower,
      curve: player.attrs.curve,
    });
    return flight.crossing ? { x: flight.crossing.x, z: flight.crossing.z } : null;
  }, [step, hover, aim, challenge.offset, challenge.distance, isPass, isHeader,
    player.attrs.heading, player.attrs.shotPower, player.attrs.curve]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    drawPitch(ctx, t);

    const moving = step === 'aim' || step === 'power';
    for (const d of defenders) {
      const drift = moving ? Math.sin(phaseRef.current * d.speed + d.phase) * d.amp : 0;
      // Die Laufphase folgt der Eigenbewegung: wer sich verschiebt, bewegt
      // auch die Beine. Vorher glitten die Figuren wie Spielsteine.
      const takt = moving ? phaseRef.current * d.speed * 2.6 + d.phase : 0;
      drawPlayer(ctx, t, d.x + drift, d.y + drift * 0.35, OPPONENT_KIT,
        undefined, 9, 0, takt);
    }
    for (const w of wall) drawPlayer(ctx, t, w.x, w.y, OPPONENT_KIT, undefined, 8);

    // Torwart bewegt sich leicht auf der Linie
    const kDrift = moving ? Math.sin(phaseRef.current * 0.9) * 0.5 : 0;
    drawPlayer(ctx, t, keeperPos.x + kDrift, keeperPos.y, '#e5cd7c', 'TW',
      9, 0, moving ? phaseRef.current * 1.8 : 0);

    if (isPass && challenge.targets) {
      for (const target of challenge.targets) {
        const selected = target.id === targetId;
        drawPlayer(ctx, t, target.x, target.y, selected ? '#43d99a' : '#2bb7ff',
          String(target.shirtNumber), selected ? 11 : 9);
        if (selected) {
          const [sx, sy] = t.toScreen(target.x, target.y);
          ctx.strokeStyle = 'rgba(55,214,122,0.85)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(sx, sy, 17, 0, Math.PI * 2);
          ctx.stroke();
          ctx.fillStyle = 'rgba(255,255,255,0.7)';
          ctx.font = '10px system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(`Deckung ${Math.round(target.marked * 100)}%`, sx, sy + 30);
        }
      }
    }

    const ballPos = flightRef.current
      ? flightRef.current.flight.points[flightRef.current.index]
      : { x: challenge.offset, y: challenge.distance, z: 0 };

    const guide = step === 'aim' ? (hover ?? aim) : aim;
    if (guide && (step === 'aim' || step === 'power' || step === 'contact')) {
      const [bx, by] = t.toScreen(challenge.offset, challenge.distance);
      const [gx, gy] = t.toScreen(guide.x, guide.y);
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 2;
      ctx.setLineDash([7, 5]);
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(gx, gy);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath();
      ctx.arc(gx, gy, 4.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Zielhilfe: Einschlagpunkt auf der Torlinie (gruen im Tor, rot daneben).
    if (aimGuide && (step === 'aim' || step === 'power')) {
      const onTarget = Math.abs(aimGuide.x) < GOAL_HALF_WIDTH && aimGuide.z < CROSSBAR;
      const col = onTarget ? '#43d99a' : '#ff8a95';
      const [gl, gy0] = t.toScreen(-GOAL_HALF_WIDTH, 0);
      const gw = GOAL_HALF_WIDTH * 2 * t.scale;
      // Tormund einfaerben, je nachdem ob der Schuss aufs Tor geht.
      ctx.fillStyle = onTarget ? 'rgba(55,214,122,0.16)' : 'rgba(255,138,149,0.12)';
      ctx.fillRect(gl, gy0 - 7, gw, 7);
      // Marker auf der Linie.
      const [mx, my] = t.toScreen(clamp(aimGuide.x, -21, 21), 0);
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(mx, my, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.45)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Flugbahn mit Spur
    if (flightRef.current) {
      const { flight, index } = flightRef.current;
      ctx.lineWidth = 2.5;
      for (let i = 1; i <= index; i += 2) {
        const p = flight.points[i];
        const prev = flight.points[i - 1];
        const fade = Math.max(0, 1 - (index - i) / 55);
        ctx.strokeStyle = `rgba(255,255,255,${0.12 + fade * 0.55})`;
        ctx.beginPath();
        ctx.moveTo(...offsetPoint(t, prev));
        ctx.lineTo(...offsetPoint(t, p));
        ctx.stroke();
      }
    }

    // Wer den Ball aufhaelt, steht auch von oben da - sonst bliebe der Ball
    // mitten auf dem Rasen stehen, ohne dass jemand daran schuld waere.
    const blocker = shotRef.current?.block;
    if (blocker && (step === 'flight' || step === 'result')
      && flightRef.current && flightRef.current.index >= flightRef.current.stop - 4) {
      drawPlayer(ctx, t, blocker.x, blocker.y + 0.5, OPPONENT_KIT, undefined, 10, Math.PI);
    }

    drawBall(ctx, t, ballPos.x, ballPos.y, ballPos.z);

    // Prallmarke am Blockpunkt
    if (blocker && step === 'result') {
      const [px, py] = offsetPoint(t, blocker);
      ctx.strokeStyle = 'rgba(255,138,149,0.85)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(px, py, 13, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (!flightRef.current) {
      drawPlayer(ctx, t, challenge.offset - 0.9, challenge.distance + 1.1, '#43d99a',
        String(player.shirtNumber), 11);
    }

    // Torjubel: gruener Schleier und drei Ringe, die vom Einschlagpunkt
    // nach aussen laufen. Vorher lag nur eine gruene Flaeche darueber.
    if (step === 'result' && finalRef.current?.outcome === 'goal') {
      ctx.fillStyle = 'rgba(55,214,122,0.16)';
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      const [jx, jy] = t.toScreen(shotRef.current?.crossing?.x ?? 0, 0);
      for (let i = 0; i < 3; i++) {
        const r = 26 + ((jubelRef.current * 2.4 + i * 34) % 110);
        ctx.strokeStyle = `rgba(67, 217, 154, ${clamp(1 - r / 130, 0, 0.75)})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(jx, jy, r, r * 0.42, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }, [t, defenders, wall, keeperPos, isPass, challenge, targetId, step, hover, aim,
    aimGuide, player.shirtNumber]);

  useEffect(() => { draw(); }, [draw]);

  // Der Torjubel laeuft weiter, waehrend der Rest der Szene steht.
  useEffect(() => {
    if (step !== 'result' || finalRef.current?.outcome !== 'goal') return;
    jubelRef.current = 0;
    let raf = 0;
    const loop = () => {
      jubelRef.current += 1;
      draw();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [step, draw]);

  // Leichte Bewegung in der Szene, solange gezielt wird.
  useEffect(() => {
    if (step !== 'aim' && step !== 'power') return;
    let raf = 0;
    const loop = () => {
      phaseRef.current += 0.02;
      draw();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [step, draw]);

  /**
   * Kraft aus der verstrichenen Haltedauer. Die Anzeige laeuft auf und wieder
   * zurueck. Bewusst aus der Uhrzeit berechnet und nicht aus Einzelbildern:
   * so bleibt die Mechanik unabhaengig von Bildrate und Hintergrundtabs.
   */
  const powerFromElapsed = useCallback((elapsedMs: number) => {
    const rate = 1.05 * difficulty.meterSpeed;
    const phase = ((elapsedMs / 1000) * rate) % 2;
    return phase <= 1 ? phase : 2 - phase;
  }, [difficulty.meterSpeed]);

  useEffect(() => {
    if (step !== 'power') return;
    let raf = 0;
    const loop = () => {
      if (chargingRef.current) {
        powerRef.current = powerFromElapsed(performance.now() - chargeStartRef.current);
        setPowerDisplay(powerRef.current);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [step, powerFromElapsed]);

  // Flug abspielen
  useEffect(() => {
    if (step !== 'flight' || !flightRef.current) return;
    const interval = window.setInterval(() => {
      const current = flightRef.current;
      if (!current) return;
      current.index = Math.min(current.index + 3, current.stop);
      draw();
      if (current.index >= current.stop) {
        window.clearInterval(interval);
        setStep('result');
      }
    }, 16);
    return () => window.clearInterval(interval);
  }, [step, draw]);

  function canvasPoint(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const sx = ((e.clientX - rect.left) / rect.width) * VIEW_W;
    const sy = ((e.clientY - rect.top) / rect.height) * VIEW_H;
    return t.toWorld(sx, sy);
  }

  function handleClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const [wx, wy] = canvasPoint(e);
    if (step === 'target' && challenge.targets) {
      let best = challenge.targets[0];
      let bestDist = Infinity;
      for (const target of challenge.targets) {
        const d = Math.hypot(target.x - wx, target.y - wy);
        if (d < bestDist) { bestDist = d; best = target; }
      }
      setTargetId(best.id);
      setStep('aim');
      return;
    }
    if (step === 'aim') {
      setAim({ x: clamp(wx, -21, 21), y: clamp(wy, -2, challenge.distance + 4) });
      setStep('power');
    }
  }

  function handleMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (step !== 'aim') return;
    const [wx, wy] = canvasPoint(e);
    setHover({ x: clamp(wx, -21, 21), y: clamp(wy, -2, challenge.distance + 4) });
  }

  function startCharge() {
    if (step !== 'power' || chargingRef.current) return;
    chargingRef.current = true;
    chargeStartRef.current = performance.now();
  }

  function releaseCharge() {
    if (step !== 'power' || !chargingRef.current) return;
    chargingRef.current = false;
    // Massgeblich ist die Haltedauer, nicht der zuletzt gezeichnete Frame.
    const power = Math.max(0.08, powerFromElapsed(performance.now() - chargeStartRef.current));
    powerRef.current = power;
    setPowerDisplay(power);
    setLockedPower(power);
    setStep('contact');
  }

  function fire(cx: number, cy: number, aimOverride?: { x: number; y: number }) {
    const shotAim = aimOverride ?? aim;
    if (!shotAim) return;
    const rng = new Rng(seed ^ 0x9e3779b9);
    const input: BallInput = {
      aimX: shotAim.x, aimY: shotAim.y,
      power: Math.max(0.08, powerRef.current),
      contactX: cx, contactY: cy,
    };

    if (isPass) {
      const resolution = resolvePass(input, challenge, player, targetId ?? '', difficulty, rng);
      flightRef.current = { flight: resolution.flight, index: 0, stop: stoppIndex(resolution) };
      finalRef.current = {
        outcome: resolution.outcome,
        quality: resolution.quality,
        targetId: resolution.targetId,
      };
      setResultText(resolution.outcome === 'passCompleted'
        ? trv(seed, 'scene.result.passOk')
        : resolution.reason === 'tooHard' ? trv(seed, 'scene.result.tooHard')
        : resolution.reason === 'tooShort' ? trv(seed, 'scene.result.tooShort')
        : resolution.reason === 'pastTeammate' ? trv(seed, 'scene.result.pastTeammate')
        : trv(seed, 'scene.result.intercepted'));
      setReason(resolution.outcome === 'passCompleted'
        ? trv(seed, 'scene.result.deviation', { m: tDecimal(resolution.error, 1) })
        : resolution.reason === 'tooHard'
          ? trv(seed, 'scene.result.uncontrollable')
        : resolution.reason === 'tooShort'
          ? trv(seed, 'scene.result.tooWeak')
        : resolution.reason === 'pastTeammate'
          ? trv(seed, 'scene.result.missedBy', { m: tDecimal(resolution.error, 1) })
          : trv(seed, 'scene.result.passBlocked'));
    } else {
      const resolution = resolveShot(input, challenge, player, difficulty, rng);
      shotRef.current = resolution;
      flightRef.current = { flight: resolution.flight, index: 0, stop: stoppIndex(resolution) };
      finalRef.current = { outcome: resolution.outcome, quality: resolution.quality };
      setResultText({
        goal: trv(seed, 'scene.result.goal'),
        saved: trv(seed, 'scene.result.saved'),
        offTarget: trv(seed, 'scene.result.wide'),
        blocked: trv(seed, 'scene.result.blocked'),
        post: trv(seed, 'scene.result.woodwork'),
      }[resolution.outcome as string] ?? tr('scene.finish'));
      setReason(describeShot(resolution, input, challenge.distance));
    }
    setStep('flight');
  }

  // --- Gegnerdruck ------------------------------------------------------
  // Der Gegner rueckt heran, waehrend gezielt wird. Laeuft die Zeit ab, wird
  // mit dem gespielt, was gerade eingestellt ist: ueberhastet, aber nie
  // verloren - ein Abschluss aus der Not ist besser als gar keiner.
  const pressureTime = useMemo(
    () => pressureSeconds(challenge, difficulty), [challenge, difficulty],
  );
  const clockRuns = step === 'target' || step === 'aim' || step === 'power' || step === 'contact';

  const timeLeft = usePressureClock(pressureTime, clockRuns, () => {
    if (!clockRuns) return;
    const rushed = aim ?? hover ?? { x: 0, y: Math.min(8, challenge.distance * 0.35) };
    if (step === 'power' && chargingRef.current) {
      powerRef.current = Math.max(
        0.08, powerFromElapsed(performance.now() - chargeStartRef.current),
      );
    } else if (step !== 'contact') {
      powerRef.current = 0.55;
    }
    chargingRef.current = false;
    fire(0, 0, rushed);
  });

  // Tastatursteuerung
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Im Kontaktschritt schiesst die Leertaste sofort mittig ab - fuer alle,
      // die den Feinschliff nicht jedes Mal brauchen.
      if (e.code === 'Space' && step === 'contact' && e.type === 'keydown') {
        e.preventDefault();
        fire(0, 0);
        return;
      }
      if (e.code !== 'Space') return;
      e.preventDefault();
      if (e.type === 'keydown') startCharge();
      else releaseCharge();
    }
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKey);
    };
  });

  const stepIndex = stepOrder.indexOf(step);
  const hints: Record<BallStep, string> = {
    target: tr('scene.hintPass'),
    aim: tr('scene.hintDirection'),
    power: tr('scene.hintPower'),
    contact: tr('scene.hintContact'),
    flight: '',
    result: reason,
  };

  const isGoal = finalRef.current?.outcome === 'goal' || finalRef.current?.outcome === 'passCompleted';

  useAutoAdvance(step === 'result', isGoal, () => {
    if (finalRef.current) onDone(finalRef.current);
  });

  return (
    <Frame challenge={passLike && selfShoot ? { ...challenge, title: tr('scene.finish') } : challenge}
      step={stepIndex} steps={stepLabels}
      hint={step === 'flight' ? challenge.hint : hints[step]}
      pressureLeft={clockRuns && pressureTime > 0 ? timeLeft : undefined}
      footer={
        <>
          {step === 'target' && (
            <button className="primary" onClick={() => { setSelfShoot(true); setStep('aim'); }}>
              Selbst abschliessen
            </button>
          )}
          {passLike && selfShoot && step === 'aim' && (
            <button onClick={() => { setSelfShoot(false); setStep('target'); }}>
              Lieber abspielen
            </button>
          )}
          {step === 'power' && (
            <>
              <div className="power-meter"><span style={{ width: `${powerDisplay * 100}%` }} /></div>
              <span className="mono small">{Math.round(powerDisplay * 100)}%</span>
            </>
          )}
          {step === 'result' && (
            <button className="primary" onClick={() => finalRef.current && onDone(finalRef.current)}>
              Weiter
            </button>
          )}
        </>
      }>
      {step === 'contact' ? (
        <div style={{
          background: '#0a2a17', padding: '0.8rem', display: 'flex',
          gap: '1rem', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center',
        }}>
          <ContactPicker onPick={fire} onHover={setContactHover} />
          {!isPass && (
            <div style={{ flex: '1 1 320px', minWidth: 260 }}>
              <GoalView preview={preview} label={tr('scene.predictedImpact')}
                note={tr('scene.tooLittlePower')} />
              {challenge.kind === 'freeKick' && (
                <div className="tiny center" style={{
                  marginTop: 4, fontWeight: 650,
                  color: wallBlocks ? '#ff8a95' : '#43d99a',
                }}>
                  {wallBlocks
                    ? tr('scene.wallInTheWay')
                    : tr('scene.overTheWall')}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <canvas
          ref={canvasRef}
          width={VIEW_W}
          height={VIEW_H}
          onClick={handleClick}
          onPointerMove={handleMove}
          onPointerDown={startCharge}
          onPointerUp={releaseCharge}
          onPointerCancel={releaseCharge}
          onPointerLeave={releaseCharge}
        />
      )}

      {step === 'result' && (
        <div style={{ background: '#0a2a17', padding: '0.4rem 0.8rem 0.8rem' }}>
          <div className="center" style={{
            fontSize: '1.4rem', fontWeight: 760, padding: '0.3rem 0',
            color: isGoal ? '#43d99a' : finalRef.current?.outcome === 'post' ? '#e5cd7c' : '#e8c46a',
          }}>
            {resultText}
          </div>
          {!isPass && shotRef.current && (
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <GoalView
                crossing={shotRef.current.crossing}
                keeper={shotRef.current.keeper}
                block={shotRef.current.block}
                shotFrom={challenge.distance}
                outcome={finalRef.current?.outcome}
                label={tr('scene.goalView')}
                animate
              />
            </div>
          )}
        </div>
      )}
    </Frame>
  );
}

/**
 * Bis zu welchem Punkt der Flug abgespielt wird.
 *
 * Ohne Block bis zum Ende der Bahn. Mit Block bis zu dem Punkt, an dem der
 * Verteidiger oder die Mauer den Ball erwischt hat - danach gehoert der Ball
 * nicht mehr dem Schuetzen.
 */
function stoppIndex(res: { flight: Flight; block?: BlockPoint | null }): number {
  const letzte = res.flight.points.length - 1;
  const b = res.block;
  if (!b) return letzte;
  let best = letzte;
  let bestAbstand = Infinity;
  for (let i = 0; i <= letzte; i++) {
    const p = res.flight.points[i];
    const d = Math.hypot(p.x - b.x, p.y - b.y);
    if (d < bestAbstand) { bestAbstand = d; best = i; }
  }
  return best;
}
function offsetPoint(t: Transform, p: { x: number; y: number; z: number }): [number, number] {
  const [sx, sy] = t.toScreen(p.x, p.y);
  return [sx, sy - p.z * t.scale * 0.55];
}

/** Nahansicht des Balls zur Wahl des Kontaktpunkts (Konzept Abschnitt 22.4). */
/**
 * Eine von mehreren Fassungen eines Ergebnistextes.
 *
 * Der Wurf kommt aus dem Startwert der Szene: Damit ist die Auswahl
 * reproduzierbar und verschiebt keinen Zufallsstrom der Spielsimulation.
 * Schluessel ohne Fassungen - etwa die Hinweise zur Mechanik - fallen in
 * `tVariant` auf ihre Einzelfassung zurueck und bleiben damit bewusst
 * immer gleich: Eine Erklaerung soll bei jeder Wiederholung gleich klingen.
 */
function trv(seed: number, key: string, params?: Record<string, string | number>): string {
  return tVariant(key, ((seed >>> 7) % 997) / 997, params);
}
function ContactPicker(
  { onPick, onHover }:
  { onPick: (x: number, y: number) => void; onHover: (p: { x: number; y: number }) => void },
) {
  const size = 250;
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);

  function toLocal(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = 1 - ((e.clientY - rect.top) / rect.height) * 2;
    const len = Math.hypot(x, y);
    const scale = len > 1 ? 1 / len : 1;
    return { x: x * scale, y: y * scale };
  }

  const point = hover;
  const description = !point ? tr('scene.moveMouseOverBall')
    : point.y < -0.4 ? tr('scene.contactBottom')
    : point.y > 0.4 ? tr('scene.contactTop')
    : Math.abs(point.x) > 0.4
      ? tr(point.x > 0 ? 'scene.contactRight' : 'scene.contactLeft')
    : tr('scene.contactMiddle');

  return (
    <div style={{ textAlign: 'center', flex: '0 0 auto' }}>
      <svg width={size} height={size} viewBox="-1.15 -1.15 2.3 2.3"
        style={{ cursor: 'crosshair', maxWidth: '100%' }}
        onPointerMove={(e) => { const p = toLocal(e); setHover(p); onHover(p); }}
        onPointerLeave={() => setHover(null)}
        onClick={(e) => { const p = toLocal(e); onPick(p.x, p.y); }}>
        <circle cx={0} cy={0} r={1} fill="#f7f9fc" stroke="#20303f" strokeWidth={0.02} />
        <polygon points="0,-0.42 0.4,-0.13 0.25,0.34 -0.25,0.34 -0.4,-0.13"
          fill="#1b2430" opacity={0.9} />
        {[0, 72, 144, 216, 288].map((angle) => {
          const rad = (angle - 90) * Math.PI / 180;
          return (
            <circle key={angle} cx={Math.cos(rad) * 0.78} cy={Math.sin(rad) * 0.78}
              r={0.16} fill="#1b2430" opacity={0.75} />
          );
        })}
        <line x1={-1} y1={0} x2={1} y2={0} stroke="#2bb7ff" strokeWidth={0.012} opacity={0.55} />
        <line x1={0} y1={-1} x2={0} y2={1} stroke="#2bb7ff" strokeWidth={0.012} opacity={0.55} />
        {point && (
          <>
            <circle cx={point.x} cy={-point.y} r={0.11} fill="none"
              stroke="#43d99a" strokeWidth={0.05} />
            <circle cx={point.x} cy={-point.y} r={0.035} fill="#43d99a" />
          </>
        )}
      </svg>
      <div className="small muted" style={{ marginTop: '0.3rem', maxWidth: 250 }}>{description}</div>
    </div>
  );
}

// --- Zweikampf und Dribbling (Timing) ----------------------------------

function TimingChallenge({ challenge, player, difficulty, seed, onDone }: SceneProps) {
  const isDribble = challenge.kind === 'dribble';
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const moves = useMemo(
    () => (isDribble ? availableMoves(player.attrs.dribbling) : []),
    [isDribble, player.attrs.dribbling],
  );
  const [move, setMove] = useState<DribbleMove | null>(null);
  const [phase, setPhase] = useState<'move' | 'run' | 'result'>(
    isDribble && moves.length > 1 ? 'move' : 'run',
  );
  const [resultText, setResultText] = useState('');
  const posRef = useRef(0);
  const rafRef = useRef(0);
  const startRef = useRef(performance.now());
  const finalRef = useRef<ChallengeResult | null>(null);

  const skill = isDribble
    ? player.attrs.dribbling * 0.45 + player.attrs.agility * 0.2
      + player.attrs.balance * 0.15 + player.attrs.ballControl * 0.2
    : player.attrs.tackling * 0.45 + player.attrs.anticipation * 0.25
      + player.attrs.defPositioning * 0.2 + player.attrs.reactions * 0.1;
  const activeMove = move ?? moves[0] ?? null;
  const window_ = ((isDribble ? 0.12 : 0.1) + skill / (isDribble ? 480 : 520))
    * difficulty.targetSize * (isDribble ? activeMove?.windowScale ?? 1 : 1);
  const duration = 2.2;
  const idealAt = 0.62;

  const draw = useCallback((progress: number) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    ctx.fillStyle = '#0f4d29';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    for (let i = 0; i < VIEW_H; i += 56) ctx.fillRect(0, i, VIEW_W, 28);

    const laneY = 190;
    const startX = 130;
    const endX = VIEW_W - 150;
    const x = startX + (endX - startX) * progress;

    const zoneCentre = startX + (endX - startX) * idealAt;
    const zoneHalf = ((endX - startX) * (window_ / duration));
    ctx.fillStyle = 'rgba(55,214,122,0.22)';
    ctx.fillRect(zoneCentre - zoneHalf, laneY - 60, zoneHalf * 2, 120);
    ctx.strokeStyle = 'rgba(55,214,122,0.8)';
    ctx.lineWidth = 2;
    ctx.strokeRect(zoneCentre - zoneHalf, laneY - 60, zoneHalf * 2, 120);

    // Bewegungsstreifen hinter der laufenden Figur - laesst Tempo spueren.
    const streak = (cx: number, cy: number, dir: number) => {
      ctx.strokeStyle = 'rgba(255,255,255,0.16)';
      ctx.lineWidth = 2;
      for (let k = 0; k < 3; k++) {
        const yy = cy - 6 + k * 7;
        ctx.beginPath();
        ctx.moveTo(cx - dir * (18 + k * 8), yy);
        ctx.lineTo(cx - dir * (40 + k * 8), yy);
        ctx.stroke();
      }
    };

    // Kleiner, kugeliger Ball am Fuss.
    const miniBall = (bx: number, by: number) => {
      const r = 7;
      const g = ctx.createRadialGradient(bx - 2, by - 2, 1, bx, by, r);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(1, '#c9d2dc');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(bx, by, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(20,30,45,0.5)'; ctx.lineWidth = 1; ctx.stroke();
    };

    const figR = 16;
    const num = String(player.shirtNumber);
    // Der Laufschritt folgt dem Fortschritt: die Beine bewegen sich genau
    // so schnell, wie die Figur ueber den Rasen kommt.
    const takt = progress * 22;
    // Figuren blicken in Laufrichtung (facing = +/- PI/2 dreht sie seitlich).
    if (isDribble) {
      streak(x, laneY, 1);
      drawHumanPlayer(ctx, endX + 40, laneY, OPPONENT_KIT,
        { label: 'GS', radius: figR, facing: -Math.PI / 2, stride: takt * 0.6 });
      drawHumanPlayer(ctx, x, laneY, '#43d99a',
        { label: num, radius: figR, facing: Math.PI / 2, stride: takt });
      miniBall(x + 24, laneY + 10);
    } else {
      streak(x, laneY, -1);
      drawHumanPlayer(ctx, startX - 40, laneY, '#43d99a',
        { label: num, radius: figR, facing: Math.PI / 2, stride: takt * 0.6 });
      drawHumanPlayer(ctx, x, laneY, OPPONENT_KIT,
        { label: 'GS', radius: figR, facing: -Math.PI / 2, stride: takt });
      miniBall(x - 24, laneY + 10);
    }

    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      isDribble
        ? tr('scene.triggerInGreen', { move: activeMove ? tr(activeMove.name) : tr('scene.feint') })
        : tr('scene.grabInGreen'),
      VIEW_W / 2, 62,
    );
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillText(tr('scene.spaceOrClick'), VIEW_W / 2, 86);
    ctx.fillText(`Gegenspieler: ${Math.round(challenge.opponent)}`, VIEW_W / 2, VIEW_H - 36);
  }, [isDribble, player.shirtNumber, challenge.opponent, window_, activeMove]);

  const trigger = useCallback((timedOut = false) => {
    if (phase !== 'run') return;
    cancelAnimationFrame(rafRef.current);
    // Zeitpunkt aus der Uhr statt aus dem letzten gezeichneten Bild.
    const elapsed = (performance.now() - startRef.current) / 1000;
    const progress = timedOut ? 1 : Math.min(1, elapsed / duration);
    posRef.current = progress;
    const offsetSeconds = timedOut
      ? duration * (1 - idealAt)
      : (progress - idealAt) * duration;
    const rng = new Rng(seed ^ 0x85ebca6b);
    const result = isDribble
      ? resolveDribble({ offset: offsetSeconds }, challenge, player, difficulty, rng, activeMove ?? undefined)
      : resolveDuel({ offset: offsetSeconds }, challenge, player, difficulty, rng);
    finalRef.current = result;
    setResultText({
      duelWon: trv(seed, 'scene.result.ballWon'),
      duelLost: trv(seed, 'scene.result.opponentThrough'),
      foulCommitted: trv(seed, 'scene.result.fouled'),
      dribbleWon: trv(seed, 'scene.result.beatenMan'),
      dribbleLost: trv(seed, 'scene.result.ballLost'),
      foulSuffered: trv(seed, 'scene.result.foulWon'),
    }[result.outcome as string] ?? tr('scene.duel'));
    setPhase('result');
  }, [phase, isDribble, challenge, player, difficulty, seed, activeMove]);

  useEffect(() => {
    if (phase !== 'run') return;
    startRef.current = performance.now();
    const loop = (now: number) => {
      const elapsed = (now - startRef.current) / 1000;
      const progress = Math.min(1, elapsed / duration);
      posRef.current = progress;
      draw(progress);
      if (progress >= 1) return;
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    // Sicherheitsnetz: die Szene loest sich auch dann auf, wenn keine
    // Einzelbilder geliefert werden, etwa in einem Hintergrundtab.
    const timeout = window.setTimeout(() => trigger(true), duration * 1000 + 80);
    return () => {
      cancelAnimationFrame(rafRef.current);
      window.clearTimeout(timeout);
    };
  }, [phase, draw, trigger]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.code === 'Space') { e.preventDefault(); trigger(); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [trigger]);

  const steps = isDribble && moves.length > 1 ? [tr('scene.feint'), tr('scene.timing'), ''] : [tr('scene.timing'), ''];
  const stepIndex = phase === 'move' ? 0 : phase === 'run' ? (steps.length === 3 ? 1 : 0) : steps.length - 1;

  const timingWon = finalRef.current?.outcome === 'dribbleWon'
    || finalRef.current?.outcome === 'duelWon'
    || finalRef.current?.outcome === 'foulSuffered';
  useAutoAdvance(phase === 'result', timingWon, () => {
    if (finalRef.current) onDone(finalRef.current);
  });

  // Auch die Fintenwahl steht unter Druck - der Gegner wartet nicht, bis man
  // sich entschieden hat. Laeuft die Zeit ab, wird der einfachste Zug gespielt.
  const movePressure = useMemo(
    () => pressureSeconds(challenge, difficulty), [challenge, difficulty],
  );
  const moveTimeLeft = usePressureClock(movePressure, phase === 'move', () => {
    if (phase !== 'move') return;
    setMove(moves[0] ?? null);
    setPhase('run');
  });

  return (
    <Frame challenge={challenge} step={stepIndex} steps={steps}
      pressureLeft={phase === 'move' && movePressure > 0 ? moveTimeLeft : undefined}
      hint={phase === 'move'
        ? tr('scene.hintFeint')
        : phase === 'run' ? challenge.hint : (finalRef.current?.detail ?? '')}
      footer={phase === 'result' ? (
        <button className="primary" onClick={() => finalRef.current && onDone(finalRef.current)}>
          Weiter
        </button>
      ) : undefined}>

      {phase === 'move' ? (
        <div style={{ background: '#0a2a17', padding: '1rem', minHeight: 260 }}>
          <div className="grid two">
            {moves.map((m) => (
              <button key={m.key}
                style={{ textAlign: 'left', padding: '0.6rem 0.8rem' }}
                onClick={() => { setMove(m); setPhase('run'); }}>
                <div className="row between">
                  <strong>{tr(m.name)}</strong>
                  <span className="pill" style={{
                    borderColor: m.windowScale < 0.9 ? '#6d2731' : m.windowScale > 1.2 ? '#1f6b3f' : undefined,
                  }}>
                    {m.windowScale < 0.9 ? 'schwer' : m.windowScale > 1.2 ? 'sicher' : 'normal'}
                  </span>
                </div>
                <div className="tiny muted">{tr(m.description)}</div>
              </button>
            ))}
          </div>
          <p className="tiny dim" style={{ marginTop: '0.7rem', marginBottom: 0 }}>
            Weitere Bewegungen schaltest du ueber steigende Dribblingwerte frei.
            Aktuell: {player.attrs.dribbling}.
          </p>
        </div>
      ) : (
        <canvas ref={canvasRef} width={VIEW_W} height={VIEW_H} onClick={() => trigger()} />
      )}

      {phase === 'result' && (
        <div className="center" style={{
          padding: '0.6rem', fontSize: '1.25rem', fontWeight: 720,
          color: finalRef.current?.outcome === 'duelWon' || finalRef.current?.outcome === 'dribbleWon'
            ? '#43d99a' : finalRef.current?.outcome === 'foulSuffered' ? '#e5cd7c' : '#e8c46a',
        }}>{resultText}</div>
      )}
    </Frame>
  );
}

// --- Torwartszene ------------------------------------------------------

function SaveChallenge({ challenge, player, difficulty, seed, onDone }: SceneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [step, setStep] = useState<'dive' | 'timing' | 'result'>('dive');
  const [dive, setDive] = useState<{ x: number; z: number } | null>(null);
  const [hover, setHover] = useState<{ x: number; z: number } | null>(null);
  const [resultText, setResultText] = useState('');
  const finalRef = useRef<ChallengeResult | null>(null);
  const crossingRef = useRef<{ x: number; z: number } | null>(null);
  const markerRef = useRef(0);
  const timingStartRef = useRef(0);
  const rafRef = useRef(0);

  const goalW = 560;
  const goalH = goalW * (CROSSBAR / (GOAL_HALF_WIDTH * 2));
  const originX = (VIEW_W - goalW) / 2;
  const originY = 90;

  const toGoal = (sx: number, sy: number) => ({
    x: ((sx - originX) / goalW - 0.5) * GOAL_HALF_WIDTH * 2,
    z: (1 - (sy - originY) / goalH) * CROSSBAR,
  });
  const toScreen = (x: number, z: number): [number, number] => [
    originX + (x / (GOAL_HALF_WIDTH * 2) + 0.5) * goalW,
    originY + (1 - z / CROSSBAR) * goalH,
  ];

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    ctx.fillStyle = '#0d3a20';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.fillStyle = '#0f4d29';
    ctx.fillRect(0, originY + goalH, VIEW_W, VIEW_H - originY - goalH);

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 7;
    ctx.strokeRect(originX, originY, goalW, goalH);
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 16; i++) {
      const x = originX + (goalW / 16) * i;
      ctx.beginPath(); ctx.moveTo(x, originY); ctx.lineTo(x, originY + goalH); ctx.stroke();
    }
    for (let i = 1; i < 7; i++) {
      const y = originY + (goalH / 7) * i;
      ctx.beginPath(); ctx.moveTo(originX, y); ctx.lineTo(originX + goalW, y); ctx.stroke();
    }

    // Was die Koerperhaltung des Schuetzen verraet: ein ungenauer Hinweis auf
    // die Ecke. Er macht die Wahl zu einer Entscheidung statt zu einem Raten.
    const tell = challenge.incoming?.tell;
    if (tell !== undefined && step !== 'result') {
      const [tx] = toScreen(clamp(tell, -GOAL_HALF_WIDTH, GOAL_HALF_WIDTH), 0);
      const top = originY;
      const bottom = originY + goalH;
      const grad = ctx.createLinearGradient(tx - 90, 0, tx + 90, 0);
      grad.addColorStop(0, 'rgba(245,197,66,0)');
      grad.addColorStop(0.5, 'rgba(245,197,66,0.22)');
      grad.addColorStop(1, 'rgba(245,197,66,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(tx - 90, top, 180, bottom - top);
      ctx.strokeStyle = 'rgba(245,197,66,0.55)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(tx, top);
      ctx.lineTo(tx, bottom);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(245,197,66,0.9)';
      ctx.font = '12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(tr('scene.bodyPointsHere'), tx, top - 10);
    }

    const point = dive ?? hover;
    if (point) {
      const [sx, sy] = toScreen(point.x, point.z);
      ctx.strokeStyle = dive ? '#43d99a' : 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(sx, sy, 34, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = dive ? 'rgba(55,214,122,0.22)' : 'rgba(255,255,255,0.12)';
      ctx.fill();
    }

    // Menschlicher Torhueter: in Grundstellung, oder im Sprung zur gewaehlten Ecke.
    drawHumanKeeper(ctx, toScreen, dive ? dive.x : 0, dive ? dive.z : 0.95);

    if (crossingRef.current && step === 'result') {
      const [bx, by] = toScreen(crossingRef.current.x, crossingRef.current.z);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(bx, by, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#20303f';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    if (step === 'timing') {
      const barY = VIEW_H - 56;
      const barW = 480;
      const barX = (VIEW_W - barW) / 2;
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(barX, barY, barW, 22);
      const zoneHalf = barW * 0.08 * difficulty.targetSize;
      ctx.fillStyle = 'rgba(55,214,122,0.35)';
      ctx.fillRect(barX + barW / 2 - zoneHalf, barY, zoneHalf * 2, 22);
      ctx.fillStyle = '#2bb7ff';
      ctx.fillRect(barX + markerRef.current * barW - 3, barY - 4, 6, 30);
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.font = 'bold 14px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(tr('scene.jumpHint'), VIEW_W / 2, barY - 14);
    }

    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      step === 'dive' ? tr('scene.chooseCornerHeight') : step === 'timing' ? tr('scene.jumpNow') : resultText,
      VIEW_W / 2, 48,
    );
  }, [dive, hover, step, difficulty.targetSize, resultText, goalH, goalW, originX,
    challenge.incoming?.tell]);

  useEffect(() => { draw(); }, [draw]);

  /** Position der Timingleiste aus der verstrichenen Zeit. */
  const markerAt = (now: number) => {
    const phase = ((now - timingStartRef.current) / 900) % 2;
    return phase <= 1 ? phase : 2 - phase;
  };

  useEffect(() => {
    if (step !== 'timing') return;
    timingStartRef.current = performance.now();
    const loop = (now: number) => {
      markerRef.current = markerAt(now);
      draw();
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, draw]);

  const commitSave = useCallback(() => {
    if (step !== 'timing' || !dive) return;
    cancelAnimationFrame(rafRef.current);
    // Aus der Uhr statt aus dem letzten Bild, damit die Parade auch dann
    // fair bleibt, wenn keine Einzelbilder geliefert werden.
    markerRef.current = markerAt(performance.now());
    const timing = (markerRef.current - 0.5) * 0.6;
    const rng = new Rng(seed ^ 0xc2b2ae35);
    const resolution = resolveSave(
      { diveX: dive.x, diveZ: dive.z, timing }, challenge, player, difficulty, rng,
    );
    crossingRef.current = resolution.crossing;
    finalRef.current = { outcome: resolution.outcome, quality: resolution.quality };
    setResultText({
      saveMade: trv(seed, 'scene.result.parried'),
      caught: trv(seed, 'scene.result.caught'),
      goalConceded: trv(seed, 'scene.result.goal'),
    }[resolution.outcome as string] ?? tr('scene.finish'));
    setStep('result');
  }, [step, dive, seed, challenge, player, difficulty]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.code === 'Space') { e.preventDefault(); commitSave(); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [commitSave]);

  function pointerPos(e: React.MouseEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const sx = ((e.clientX - rect.left) / rect.width) * VIEW_W;
    const sy = ((e.clientY - rect.top) / rect.height) * VIEW_H;
    const p = toGoal(sx, sy);
    return {
      x: clamp(p.x, -GOAL_HALF_WIDTH - 0.4, GOAL_HALF_WIDTH + 0.4),
      z: clamp(p.z, 0, CROSSBAR + 0.3),
    };
  }

  const distanceHint = crossingRef.current && dive
    ? tr('scene.distanceToBall', {
      m: tDecimal(Math.hypot(
        crossingRef.current.x - dive.x, crossingRef.current.z - dive.z), 2),
    })
    : '';

  const saved = finalRef.current?.outcome === 'saveMade'
    || finalRef.current?.outcome === 'caught';
  useAutoAdvance(step === 'result', saved, () => {
    if (finalRef.current) onDone(finalRef.current);
  });

  return (
    <Frame challenge={challenge} step={step === 'dive' ? 0 : step === 'timing' ? 1 : 2}
      steps={[tr('scene.corner'), tr('scene.jump'), '']}
      hint={step === 'result' ? distanceHint : challenge.hint}
      footer={step === 'result' ? (
        <button className="primary" onClick={() => finalRef.current && onDone(finalRef.current)}>
          Weiter
        </button>
      ) : undefined}>
      <canvas ref={canvasRef} width={VIEW_W} height={VIEW_H}
        onPointerMove={(e) => { if (step === 'dive') setHover(pointerPos(e)); }}
        onPointerLeave={() => setHover(null)}
        onClick={(e) => {
          if (step === 'dive') { setDive(pointerPos(e)); setStep('timing'); }
          else if (step === 'timing') commitSave();
        }} />
    </Frame>
  );
}

/**
 * Interaktive Spielszenen in 2D-Vogelperspektive
 * (Konzept Abschnitt 21, 22, 24, 25, 26).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CROSSBAR, GOAL_HALF_WIDTH, resolveDribble, resolveDuel, resolvePass, resolveSave,
  resolveShot, type BallInput, type Flight,
} from '../../engine/ballAction';
import type { Challenge, ChallengeResult } from '../../engine/matchTypes';
import { Rng, clamp } from '../../engine/rng';
import type { DifficultySettings, Player } from '../../engine/types';

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
  const { kind } = props.challenge;
  if (kind === 'duel' || kind === 'interception' || kind === 'dribble') {
    return <TimingChallenge {...props} />;
  }
  if (kind === 'save' || kind === 'penaltySave') {
    return <SaveChallenge {...props} />;
  }
  return <BallChallenge {...props} />;
}

function Frame(
  { challenge, step, steps, hint, footer, children }:
  {
    challenge: Challenge; step: number; steps: string[]; hint: string;
    footer?: React.ReactNode; children: React.ReactNode;
  },
) {
  return (
    <div className="scene-overlay">
      <div className="scene">
        <div className="scene-head">
          <span className="title">{challenge.title}</span>
          <span className="pill">{challenge.minute}.</span>
          <span className="pill">
            {challenge.homeName} {challenge.scoreline[0]}:{challenge.scoreline[1]} {challenge.awayName}
          </span>
          {challenge.bigChance && <span className="pill warn">Grosschance</span>}
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
  // Rasen mit Streifen
  ctx.fillStyle = '#0f4d29';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  const stripe = 7 * t.scale;
  ctx.fillStyle = 'rgba(255,255,255,0.028)';
  for (let i = 0; i * stripe < VIEW_H; i += 2) {
    ctx.fillRect(0, t.originY + i * stripe, VIEW_W, stripe);
  }

  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 2;

  // Torlinie
  const [, lineY] = t.toScreen(0, 0);
  ctx.beginPath();
  ctx.moveTo(0, lineY);
  ctx.lineTo(VIEW_W, lineY);
  ctx.stroke();

  // Strafraum 40,3 x 16,5 m
  const [boxLeft, boxTop] = t.toScreen(-20.15, 0);
  ctx.strokeRect(boxLeft, boxTop, 40.3 * t.scale, 16.5 * t.scale);

  // Torraum 18,32 x 5,5 m
  const [smallLeft] = t.toScreen(-9.16, 0);
  ctx.strokeRect(smallLeft, boxTop, 18.32 * t.scale, 5.5 * t.scale);

  // Elfmeterpunkt
  const [px, py] = t.toScreen(0, 11);
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.beginPath();
  ctx.arc(px, py, 2.5, 0, Math.PI * 2);
  ctx.fill();

  // Strafraumbogen
  ctx.beginPath();
  ctx.arc(px, py, 9.15 * t.scale, 0.35 * Math.PI, 0.65 * Math.PI);
  ctx.stroke();

  // Tor
  const [gLeft, gY] = t.toScreen(-GOAL_HALF_WIDTH, 0);
  const goalW = GOAL_HALF_WIDTH * 2 * t.scale;
  const goalDepth = 2.2 * t.scale;
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  ctx.fillRect(gLeft, gY - goalDepth, goalW, goalDepth);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 4;
  ctx.strokeRect(gLeft, gY - goalDepth, goalW, goalDepth);
  // Netzlinien
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
  x: number, y: number, color: string, label?: string, radius = 9,
) {
  const [sx, sy] = t.toScreen(x, y);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(sx + 2, sy + 4, radius * 0.9, radius * 0.45, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(sx, sy, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  if (label) {
    ctx.fillStyle = '#04220f';
    ctx.font = 'bold 10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, sx, sy);
  }
}

function drawBall(ctx: CanvasRenderingContext2D, t: Transform, x: number, y: number, z: number) {
  const [sx, sy] = t.toScreen(x, y);
  const lift = z * t.scale * 0.55;
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath();
  ctx.ellipse(sx, sy, 5 + z * 0.5, 2.6 + z * 0.25, 0, 0, Math.PI * 2);
  ctx.fill();
  const r = 5.5 + z * 0.55;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(sx, sy - lift, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#20303f';
  ctx.lineWidth = 1;
  ctx.stroke();
}

// --- Schuss, Freistoss, Elfmeter, Pass ---------------------------------

type BallStep = 'target' | 'aim' | 'power' | 'contact' | 'flight' | 'result';

function BallChallenge({ challenge, player, difficulty, seed, onDone }: SceneProps) {
  const isPass = challenge.kind === 'pass' || challenge.kind === 'cross' || challenge.kind === 'throughBall';
  const stepOrder: BallStep[] = isPass
    ? ['target', 'aim', 'power', 'contact', 'flight', 'result']
    : ['aim', 'power', 'contact', 'flight', 'result'];
  const stepLabels = isPass
    ? ['Mitspieler', 'Richtung', 'Kraft', 'Ballkontakt', '', '']
    : ['Richtung', 'Kraft', 'Ballkontakt', '', ''];

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [step, setStep] = useState<BallStep>(stepOrder[0]);
  const [targetId, setTargetId] = useState<string | null>(challenge.targets?.[0]?.id ?? null);
  const [aim, setAim] = useState<{ x: number; y: number } | null>(null);
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const [contact, setContact] = useState<{ x: number; y: number } | null>(null);
  const [resultText, setResultText] = useState('');

  const powerRef = useRef(0);
  const chargingRef = useRef(false);
  const dirRef = useRef(1);
  const [powerDisplay, setPowerDisplay] = useState(0);
  const flightRef = useRef<{ flight: Flight; index: number } | null>(null);
  const finalRef = useRef<ChallengeResult | null>(null);
  const rafRef = useRef(0);

  const depth = Math.max(24, challenge.distance + 12);
  const t = useMemo(() => makeTransform(depth), [depth]);

  // Gegenspieler einmalig festlegen, damit sie nicht springen.
  const defenders = useMemo(() => {
    const rng = new Rng(seed);
    const count = challenge.kind === 'penalty' ? 0
      : Math.round(1 + challenge.pressure * 4);
    return Array.from({ length: count }, () => ({
      x: clamp(challenge.offset + rng.normal(0, 6), -18, 18),
      y: clamp(challenge.distance * rng.float(0.15, 0.8), 1.5, challenge.distance - 1),
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
    return Array.from({ length: n }, (_, i) => ({ x: wx + (i - (n - 1) / 2) * 0.75, y: wy }));
  }, [challenge]);

  const keeperPos = useMemo(() => ({ x: clamp(challenge.offset * 0.12, -1.6, 1.6), y: 1.2 }), [challenge]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    drawPitch(ctx, t);

    for (const d of defenders) drawPlayer(ctx, t, d.x, d.y, '#d84b5a');
    for (const w of wall) drawPlayer(ctx, t, w.x, w.y, '#d84b5a', undefined, 8);
    drawPlayer(ctx, t, keeperPos.x, keeperPos.y, '#f5c542', 'TW');

    // Mitspieler bei Passsituationen
    if (isPass && challenge.targets) {
      for (const target of challenge.targets) {
        const selected = target.id === targetId;
        drawPlayer(ctx, t, target.x, target.y, selected ? '#37d67a' : '#2bb7ff',
          String(target.shirtNumber), selected ? 11 : 9);
        if (selected) {
          const [sx, sy] = t.toScreen(target.x, target.y);
          ctx.strokeStyle = 'rgba(55,214,122,0.85)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(sx, sy, 17, 0, Math.PI * 2);
          ctx.stroke();
          // Deckungsgrad
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

    // Richtungslinie
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

    // Flugbahn nachzeichnen
    if (flightRef.current) {
      const { flight, index } = flightRef.current;
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i <= index; i += 2) {
        const p = flight.points[i];
        const [sx, sy] = t.toScreen(p.x, p.y);
        const lift = p.z * t.scale * 0.55;
        if (i === 0) ctx.moveTo(sx, sy - lift); else ctx.lineTo(sx, sy - lift);
      }
      ctx.stroke();
    }

    drawBall(ctx, t, ballPos.x, ballPos.y, ballPos.z);

    // Spielerfigur am Ball
    if (!flightRef.current) {
      drawPlayer(ctx, t, challenge.offset - 0.9, challenge.distance + 1.1, '#37d67a',
        String(player.shirtNumber), 11);
    }
  }, [t, defenders, wall, keeperPos, isPass, challenge, targetId, step, hover, aim, player.shirtNumber]);

  useEffect(() => { draw(); }, [draw]);

  // Kraftanzeige laden
  useEffect(() => {
    if (step !== 'power') return;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      if (chargingRef.current) {
        powerRef.current += dt * 1.05 * difficulty.meterSpeed * dirRef.current;
        if (powerRef.current >= 1) { powerRef.current = 1; dirRef.current = -1; }
        if (powerRef.current <= 0) { powerRef.current = 0; dirRef.current = 1; }
        setPowerDisplay(powerRef.current);
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [step, difficulty.meterSpeed]);

  // Flug abspielen
  useEffect(() => {
    if (step !== 'flight' || !flightRef.current) return;
    const interval = window.setInterval(() => {
      const current = flightRef.current;
      if (!current) return;
      current.index = Math.min(current.index + 3, current.flight.points.length - 1);
      draw();
      if (current.index >= current.flight.points.length - 1) {
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
    if (step !== 'power') return;
    chargingRef.current = true;
  }

  function releaseCharge() {
    if (step !== 'power' || !chargingRef.current) return;
    chargingRef.current = false;
    setStep('contact');
  }

  function pickContact(cx: number, cy: number) {
    setContact({ x: cx, y: cy });
    fire(cx, cy);
  }

  function fire(cx: number, cy: number) {
    if (!aim) return;
    const rng = new Rng(seed ^ 0x9e3779b9);
    const input: BallInput = {
      aimX: aim.x, aimY: aim.y,
      power: Math.max(0.08, powerRef.current),
      contactX: cx, contactY: cy,
    };

    if (isPass) {
      const resolution = resolvePass(input, challenge, player, targetId ?? '', difficulty, rng);
      flightRef.current = { flight: resolution.flight, index: 0 };
      finalRef.current = {
        outcome: resolution.outcome,
        quality: resolution.quality,
        targetId: resolution.targetId,
      };
      setResultText(resolution.outcome === 'passCompleted'
        ? 'Pass kommt an!'
        : 'Der Pass wird abgefangen.');
    } else {
      const resolution = resolveShot(input, challenge, player, difficulty, rng);
      flightRef.current = { flight: resolution.flight, index: 0 };
      finalRef.current = { outcome: resolution.outcome, quality: resolution.quality };
      setResultText({
        goal: 'TOR!',
        saved: 'Der Torwart ist dran.',
        offTarget: 'Vorbei.',
        blocked: 'Geblockt.',
        post: 'Aluminium!',
      }[resolution.outcome as string] ?? 'Abschluss');
    }
    setStep('flight');
  }

  // Tastatursteuerung
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
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
    target: 'Klicke den Mitspieler an, den du anspielen willst.',
    aim: 'Bewege die Maus und klicke, um die Richtung festzulegen.',
    power: 'Halte die Maustaste oder die Leertaste gedrueckt und lasse bei der gewuenschten Kraft los.',
    contact: 'Waehle den Punkt am Ball: unten hebt an, oben haelt flach, seitlich erzeugt Effet.',
    flight: '',
    result: '',
  };

  return (
    <Frame challenge={challenge} step={stepIndex} steps={stepLabels}
      hint={step === 'flight' || step === 'result' ? challenge.hint : hints[step]}
      footer={
        <>
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
        <ContactPicker onPick={pickContact} selected={contact} />
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
        <div className="center" style={{
          padding: '0.6rem', fontSize: '1.3rem', fontWeight: 720,
          color: finalRef.current?.outcome === 'goal' ? '#37d67a'
            : finalRef.current?.outcome === 'passCompleted' ? '#37d67a' : '#ffb020',
        }}>
          {resultText}
        </div>
      )}
    </Frame>
  );
}

/** Nahansicht des Balls zur Wahl des Kontaktpunkts (Konzept Abschnitt 22.4). */
function ContactPicker(
  { onPick, selected }:
  { onPick: (x: number, y: number) => void; selected: { x: number; y: number } | null },
) {
  const size = 300;
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const point = selected ?? hover;

  function toLocal(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = 1 - ((e.clientY - rect.top) / rect.height) * 2;
    const len = Math.hypot(x, y);
    const scale = len > 1 ? 1 / len : 1;
    return { x: x * scale, y: y * scale };
  }

  const description = !point ? 'Waehle einen Kontaktpunkt'
    : point.y < -0.4 ? 'Unterseite: der Ball wird angehoben, hohe Flugbahn'
    : point.y > 0.4 ? 'Oberseite: flache Bahn mit Topspin'
    : Math.abs(point.x) > 0.4 ? `Seitlich ${point.x > 0 ? 'rechts' : 'links'}: deutlicher Effet`
    : 'Mitte: gerader Ball mit voller Kraft';

  return (
    <div style={{ background: '#0a2a17', padding: '0.8rem', textAlign: 'center' }}>
      <svg width={size} height={size} viewBox="-1.15 -1.15 2.3 2.3"
        style={{ cursor: 'crosshair', maxWidth: '100%' }}
        onPointerMove={(e) => setHover(toLocal(e))}
        onPointerLeave={() => setHover(null)}
        onClick={(e) => { const p = toLocal(e); onPick(p.x, p.y); }}>
        <circle cx={0} cy={0} r={1} fill="#f7f9fc" stroke="#20303f" strokeWidth={0.02} />
        {/* Fussballmuster */}
        <polygon points="0,-0.42 0.4,-0.13 0.25,0.34 -0.25,0.34 -0.4,-0.13"
          fill="#1b2430" opacity={0.9} />
        {[0, 72, 144, 216, 288].map((angle) => {
          const rad = (angle - 90) * Math.PI / 180;
          return (
            <circle key={angle} cx={Math.cos(rad) * 0.78} cy={Math.sin(rad) * 0.78}
              r={0.16} fill="#1b2430" opacity={0.75} />
          );
        })}
        {/* Hilfslinien */}
        <line x1={-1} y1={0} x2={1} y2={0} stroke="#2bb7ff" strokeWidth={0.012} opacity={0.55} />
        <line x1={0} y1={-1} x2={0} y2={1} stroke="#2bb7ff" strokeWidth={0.012} opacity={0.55} />
        {point && (
          <>
            <circle cx={point.x} cy={-point.y} r={0.11} fill="none"
              stroke="#37d67a" strokeWidth={0.05} />
            <circle cx={point.x} cy={-point.y} r={0.035} fill="#37d67a" />
          </>
        )}
      </svg>
      <div className="small muted" style={{ marginTop: '0.4rem' }}>{description}</div>
    </div>
  );
}

// --- Zweikampf und Dribbling (Timing) ----------------------------------

function TimingChallenge({ challenge, player, difficulty, seed, onDone }: SceneProps) {
  const isDribble = challenge.kind === 'dribble';
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<'run' | 'result'>('run');
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
  const window_ = ((isDribble ? 0.12 : 0.1) + skill / (isDribble ? 480 : 520)) * difficulty.targetSize;
  /** Gesamtdauer des Anlaufs in Sekunden. */
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

    const laneY = 170;
    const startX = 130;
    const endX = VIEW_W - 150;
    const x = startX + (endX - startX) * progress;

    // Zielzone
    const zoneCentre = startX + (endX - startX) * idealAt;
    const zoneHalf = ((endX - startX) * (window_ / duration));
    ctx.fillStyle = 'rgba(55,214,122,0.22)';
    ctx.fillRect(zoneCentre - zoneHalf, laneY - 60, zoneHalf * 2, 120);
    ctx.strokeStyle = 'rgba(55,214,122,0.8)';
    ctx.lineWidth = 2;
    ctx.strokeRect(zoneCentre - zoneHalf, laneY - 60, zoneHalf * 2, 120);

    // Gegenspieler und eigener Spieler
    const drawDisc = (cx: number, cy: number, color: string, label: string, r = 20) => {
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.ellipse(cx + 3, cy + 8, r, r * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#04220f';
      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, cx, cy);
    };

    if (isDribble) {
      drawDisc(x, laneY, '#37d67a', String(player.shirtNumber));
      drawDisc(endX + 40, laneY, '#d84b5a', 'GS');
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(x + 24, laneY + 8, 7, 0, Math.PI * 2);
      ctx.fill();
    } else {
      drawDisc(x, laneY, '#d84b5a', 'GS');
      drawDisc(startX - 40, laneY, '#37d67a', String(player.shirtNumber));
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(x + 22, laneY + 8, 7, 0, Math.PI * 2);
      ctx.fill();
    }

    // Anzeige
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      isDribble ? 'Finte im gruenen Bereich ausloesen' : 'Im gruenen Bereich zupacken',
      VIEW_W / 2, 60,
    );
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillText('Leertaste oder Klick', VIEW_W / 2, 84);
    ctx.fillText(`Gegenspieler: ${Math.round(challenge.opponent)}`, VIEW_W / 2, VIEW_H - 40);
  }, [isDribble, player.shirtNumber, challenge.opponent, window_]);

  useEffect(() => {
    if (phase !== 'run') return;
    startRef.current = performance.now();
    const loop = (now: number) => {
      const elapsed = (now - startRef.current) / 1000;
      const progress = Math.min(1, elapsed / duration);
      posRef.current = progress;
      draw(progress);
      if (progress >= 1) {
        trigger(true);
        return;
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, draw]);

  const trigger = useCallback((timedOut = false) => {
    if (phase !== 'run') return;
    cancelAnimationFrame(rafRef.current);
    const offsetSeconds = timedOut
      ? duration * (1 - idealAt)
      : (posRef.current - idealAt) * duration;
    const rng = new Rng(seed ^ 0x85ebca6b);
    const result = isDribble
      ? resolveDribble({ offset: offsetSeconds }, challenge, player, difficulty, rng)
      : resolveDuel({ offset: offsetSeconds }, challenge, player, difficulty, rng);
    finalRef.current = result;
    setResultText({
      duelWon: 'Ball erobert!',
      duelLost: 'Der Gegner kommt durch.',
      foulCommitted: 'Foul - der Schiedsrichter pfeift.',
      dribbleWon: 'Ausgespielt!',
      dribbleLost: 'Ball verloren.',
      foulSuffered: 'Foul geholt.',
    }[result.outcome as string] ?? 'Zweikampf');
    setPhase('result');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, isDribble, challenge, player, difficulty, seed]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.code === 'Space') { e.preventDefault(); trigger(); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [trigger]);

  return (
    <Frame challenge={challenge} step={phase === 'run' ? 0 : 1} steps={['Timing', '']}
      hint={phase === 'run' ? challenge.hint : (finalRef.current?.detail ?? '')}
      footer={phase === 'result' ? (
        <button className="primary" onClick={() => finalRef.current && onDone(finalRef.current)}>
          Weiter
        </button>
      ) : undefined}>
      <canvas ref={canvasRef} width={VIEW_W} height={VIEW_H} onClick={() => trigger()} />
      {phase === 'result' && (
        <div className="center" style={{
          padding: '0.6rem', fontSize: '1.25rem', fontWeight: 720,
          color: finalRef.current?.outcome === 'duelWon' || finalRef.current?.outcome === 'dribbleWon'
            ? '#37d67a' : '#ffb020',
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
  const rafRef = useRef(0);

  // Frontansicht des Tores
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

    // Torrahmen und Netz
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

    // Gewaehlte Sprungposition
    const point = dive ?? hover;
    if (point) {
      const [sx, sy] = toScreen(point.x, point.z);
      ctx.strokeStyle = dive ? '#37d67a' : 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(sx, sy, 34, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = dive ? 'rgba(55,214,122,0.22)' : 'rgba(255,255,255,0.12)';
      ctx.fill();
    }

    // Torwartfigur
    const [kx, ky] = toScreen(dive ? dive.x * 0.85 : 0, dive ? dive.z * 0.7 : 0.9);
    ctx.fillStyle = '#f5c542';
    ctx.beginPath();
    ctx.ellipse(kx, ky, 22, 30, dive ? (dive.x > 0 ? 0.5 : -0.5) : 0, 0, Math.PI * 2);
    ctx.fill();

    // Ball
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

    // Timingleiste
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
      ctx.fillText('Absprung: Leertaste oder Klick', VIEW_W / 2, barY - 14);
    }

    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      step === 'dive' ? 'Waehle Ecke und Hoehe' : step === 'timing' ? 'Jetzt abspringen' : resultText,
      VIEW_W / 2, 48,
    );
  }, [dive, hover, step, difficulty.targetSize, resultText, goalH, goalW, originX]);

  useEffect(() => { draw(); }, [draw]);

  useEffect(() => {
    if (step !== 'timing') return;
    const start = performance.now();
    const loop = (now: number) => {
      const elapsed = ((now - start) / 900) % 2;
      markerRef.current = elapsed <= 1 ? elapsed : 2 - elapsed;
      draw();
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [step, draw]);

  const commitSave = useCallback(() => {
    if (step !== 'timing' || !dive) return;
    cancelAnimationFrame(rafRef.current);
    const timing = (markerRef.current - 0.5) * 0.6;
    const rng = new Rng(seed ^ 0xc2b2ae35);
    const resolution = resolveSave(
      { diveX: dive.x, diveZ: dive.z, timing }, challenge, player, difficulty, rng,
    );
    crossingRef.current = resolution.crossing;
    finalRef.current = { outcome: resolution.outcome, quality: resolution.quality };
    setResultText({
      saveMade: 'Parade!',
      caught: 'Sicher gefangen!',
      goalConceded: 'Der Ball ist drin.',
    }[resolution.outcome as string] ?? 'Abschluss');
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

  return (
    <Frame challenge={challenge} step={step === 'dive' ? 0 : step === 'timing' ? 1 : 2}
      steps={['Ecke', 'Absprung', '']}
      hint={step === 'result' ? resultText : challenge.hint}
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

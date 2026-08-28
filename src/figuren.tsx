/** Vorschau-Gallerie der Spielfiguren (nur zur visuellen Kontrolle). */
import { createRoot } from 'react-dom/client';
import { CROSSBAR, GOAL_HALF_WIDTH } from './engine/ballAction';
import { KeeperFigure, drawHumanKeeper, drawHumanPlayer } from './ui/match/figures';

const GW = GOAL_HALF_WIDTH;

// --- Frontansicht: Torhueter in verschiedenen Sprungpositionen ---------
const dives: { x: number; z: number; label: string }[] = [
  { x: 0, z: 0.95, label: 'Grundstellung' },
  { x: 2.9, z: 0.5, label: 'flach rechts' },
  { x: -2.9, z: 0.5, label: 'flach links' },
  { x: 3.1, z: 2.0, label: 'oben rechts' },
  { x: -3.1, z: 2.0, label: 'oben links' },
  { x: 0.6, z: 1.9, label: 'hoch mittig' },
];

function GoalCell({ x, z, label }: { x: number; z: number; label: string }) {
  return (
    <div className="cell">
      <svg viewBox="-6 -3.2 12 3.9" style={{ width: '100%', display: 'block' }}>
        <rect x={-6} y={-3.2} width={12} height={3.9} fill="#0d3a20" />
        <rect x={-6} y={0} width={12} height={0.7} fill="#0f4d29" />
        <line x1={-6} y1={0} x2={6} y2={0} stroke="rgba(255,255,255,0.5)" strokeWidth={0.04} />
        <rect x={-GW} y={-CROSSBAR} width={GW * 2} height={CROSSBAR} fill="rgba(255,255,255,0.06)" />
        <path d={`M ${-GW} 0 L ${-GW} ${-CROSSBAR} L ${GW} ${-CROSSBAR} L ${GW} 0`}
          fill="none" stroke="#fff" strokeWidth={0.14} />
        <KeeperFigure diveX={x} diveZ={z} />
        <circle cx={x} cy={-z} r={0.24} fill="#fff" stroke="#20303f" strokeWidth={0.05} />
      </svg>
      <div className="cap">{label}</div>
    </div>
  );
}

// --- Vogelperspektive: Feldspieler und Torwart -------------------------
function TopDownCell() {
  const ref = (canvas: HTMLCanvasElement | null) => {
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // ein paar Spieler mit unterschiedlichen Trikots und Blickrichtungen
    drawHumanPlayer(ctx, 60, 70, '#43d99a', { label: '9', radius: 14, facing: 0 });
    drawHumanPlayer(ctx, 130, 90, '#d84b5a', { label: '4', radius: 14, facing: 2.6 });
    drawHumanPlayer(ctx, 200, 70, '#2bb7ff', { label: '10', radius: 14, facing: 0.6 });
    drawHumanPlayer(ctx, 270, 95, '#e5cd7c', { label: '1', radius: 14, facing: 3.14 });
  };
  return (
    <div className="cell">
      <canvas ref={ref} width={330} height={160} />
      <div className="cap">Feldspieler (Vogelperspektive)</div>
    </div>
  );
}

function KeeperCanvasCell() {
  const ref = (canvas: HTMLCanvasElement | null) => {
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#0d3a20';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const goalW = 280; const goalH = goalW * (CROSSBAR / (GW * 2));
    const ox = (canvas.width - goalW) / 2; const oy = 30;
    ctx.fillStyle = '#0f4d29';
    ctx.fillRect(0, oy + goalH, canvas.width, canvas.height - oy - goalH);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 5;
    ctx.strokeRect(ox, oy, goalW, goalH);
    const toScreen = (x: number, z: number): [number, number] => [
      ox + (x / (GW * 2) + 0.5) * goalW,
      oy + (1 - z / CROSSBAR) * goalH,
    ];
    drawHumanKeeper(ctx, toScreen, 2.4, 1.6);
  };
  return (
    <div className="cell">
      <canvas ref={ref} width={330} height={180} />
      <div className="cap">Torwart-Szene (Canvas-Frontansicht)</div>
    </div>
  );
}

function App() {
  return (
    <>
      <h2>Torhueter — Frontansicht (SVG)</h2>
      <div className="grid">
        {dives.map((d) => <GoalCell key={d.label} {...d} />)}
      </div>
      <h2>Vogelperspektive und Canvas-Torwart</h2>
      <div className="grid">
        <TopDownCell />
        <KeeperCanvasCell />
      </div>
    </>
  );
}

// Root ueber HMR hinweg wiederverwenden, damit keine Doppel-createRoot-Warnung faellt.
const holder = window as unknown as { __figurenRoot?: ReturnType<typeof createRoot> };
holder.__figurenRoot ??= createRoot(document.getElementById('root')!);
holder.__figurenRoot.render(<App />);

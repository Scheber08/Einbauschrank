/** Vorschau-Gallerie der Spielfiguren (nur zur visuellen Kontrolle). */
import { createRoot } from 'react-dom/client';
import { CROSSBAR, GOAL_HALF_WIDTH } from './engine/ballAction';
import { GoalView } from './ui/match/HighlightScene';
import { DefenderFigure } from './ui/match/figures';
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
    // dieselben Figuren im Lauf, damit die Beinbewegung sichtbar wird
    drawHumanPlayer(ctx, 60, 130, '#43d99a', { label: '9', radius: 14, facing: 0, stride: 1.1 });
    drawHumanPlayer(ctx, 130, 130, '#d84b5a', { label: '4', radius: 14, facing: 0, stride: -1.1 });
    drawHumanPlayer(ctx, 200, 130, '#2bb7ff', { label: '10', radius: 14, facing: 0, stride: 0.4 });
    drawHumanPlayer(ctx, 270, 130, '#f2f6fb', { label: '1', radius: 14, facing: 0, stride: -0.4 });
  };
  return (
    <div className="cell">
      <canvas ref={ref} width={330} height={200} />
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


// --- Frontansicht: Verteidiger, der einen Schuss blockt ---------------
const blocks: { x: number; z: number; scale: number; label: string }[] = [
  { x: -0.9, z: 0.25, scale: 1.5, label: 'flach, Bein raus' },
  { x: 0.8, z: 0.9, scale: 1.5, label: 'Huefthoehe' },
  { x: 1.6, z: 1.8, scale: 1.5, label: 'hoch, im Sprung' },
];

function BlockCell({ x, z, scale, label }: { x: number; z: number; scale: number; label: string }) {
  // Der Blocker steht etwas seitlich, wenn er das Bein ausstreckt.
  const standX = z < 0.55 ? x - 0.55 * scale : x;
  return (
    <div className="cell">
      <svg viewBox="-6 -4.4 12 5.1" style={{ width: '100%', display: 'block' }}>
        <rect x={-6} y={-4.4} width={12} height={5.1} fill="#0d3a20" />
        <rect x={-6} y={0} width={12} height={0.7} fill="#0f4d29" />
        <line x1={-6} y1={0} x2={6} y2={0} stroke="rgba(255,255,255,0.5)" strokeWidth={0.04} />
        <rect x={-GW} y={-CROSSBAR} width={GW * 2} height={CROSSBAR} fill="rgba(255,255,255,0.06)" />
        <path d={`M ${-GW} 0 L ${-GW} ${-CROSSBAR} L ${GW} ${-CROSSBAR} L ${GW} 0`}
          fill="none" stroke="#fff" strokeWidth={0.14} />
        <KeeperFigure diveX={0} diveZ={0.95} />
        <DefenderFigure x={standX} reachX={x} reachZ={z} scale={scale} />
        <circle cx={x} cy={-z * scale} r={0.24 * scale} fill="#fff" stroke="#20303f" strokeWidth={0.05} />
      </svg>
      <div className="cap">{label}</div>
    </div>
  );
}

// --- Der echte Torblick mit Block ------------------------------------
// Bewusst der Originalbaustein und keine Nachbildung: hier faellt auf,
// wenn eine Figur aus dem Rahmen laeuft. Genau das tat sie zuerst - ein
// weit aussen geblockter Ball schob den Verteidiger bis x = -6,6 in einem
// Rahmen, der bei -6 endet.
const bloecke: { name: string; block: {
  x: number; y: number; z: number; kind: 'wall' | 'defender';
}; crossing: { x: number; z: number }; distance: number }[] = [
  {
    name: 'flach, mittig',
    block: { x: 0.4, y: 6, z: 0.3, kind: 'defender' },
    crossing: { x: 1.2, z: 0.5 }, distance: 18,
  },
  {
    name: 'Huefthoehe, weit aussen',
    block: { x: -3.1, y: 9, z: 0.9, kind: 'defender' },
    crossing: { x: -2.6, z: 1.1 }, distance: 22,
  },
  {
    name: 'hoch, dicht am Schuetzen',
    block: { x: 1.4, y: 14, z: 1.7, kind: 'defender' },
    crossing: { x: 2.2, z: 1.9 }, distance: 20,
  },
  {
    name: 'Mauer beim Freistoss',
    block: { x: -1.2, y: 9.15, z: 0.45, kind: 'wall' },
    crossing: { x: -2.0, z: 0.8 }, distance: 20,
  },
];

function App() {
  return (
    <>
      <h2>Torhueter — Frontansicht (SVG)</h2>
      <div className="grid">
        {dives.map((d) => <GoalCell key={d.label} {...d} />)}
      </div>
      <h2>Verteidiger blockt (SVG)</h2>
      <div className="grid">
        {blocks.map((b) => <BlockCell key={b.label} {...b} />)}
      </div>
      <h2>Torblick mit Block (der echte Baustein)</h2>
      <div className="grid">
        {bloecke.map((b) => (
          <div className="cell" key={b.name}>
            <GoalView crossing={b.crossing} block={b.block}
              shotFrom={b.distance} outcome="blocked" />
            <div className="cap">{b.name}</div>
          </div>
        ))}
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

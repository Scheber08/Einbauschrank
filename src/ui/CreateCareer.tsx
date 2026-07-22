import { useMemo, useState } from 'react';
import { POSITIONS, POSITION_LABELS, POSITION_NEIGHBOURS, type PositionCode } from '../engine/attributes';
import { BACKGROUND_LIST } from '../engine/backgrounds';
import { COUNTRIES } from '../engine/countries';
import { NAME_POOLS } from '../engine/names';
import { Rng, randomSeed } from '../engine/rng';
import { startNewCareer } from '../state/actions';
import { setState } from '../state/store';
import type { BackgroundKey, Difficulty, Foot } from '../engine/types';
import { Panel } from './components';

const DIFFICULTIES: { key: Difficulty; label: string; hint: string }[] = [
  { key: 'einfach', label: 'Einfach', hint: 'Groessere Trefferbereiche, schnellere Entwicklung, mehr Einsatzzeit.' },
  { key: 'normal', label: 'Normal', hint: 'Ausgeglichene Simulation und realistische Entwicklung.' },
  { key: 'schwer', label: 'Schwer', hint: 'Kleinere Trefferbereiche, langsamere Entwicklung, strengere Trainer.' },
  { key: 'simulation', label: 'Karriere-Simulation', hint: 'Sehr realistisch, wenig Einfluss durch Minispiele, kein sichtbares Potenzial.' },
];

const HAIR_COLORS = ['#2b2118', '#5b3a1e', '#a86b2c', '#d8b46a', '#8e8e8e', '#1a1a1a'];
const SKIN_TONES = ['#f3d3b6', '#e5b48c', '#c78f63', '#9b6440', '#6f4326', '#4a2c1a'];
const EYE_COLORS = ['#4a3120', '#2f6b8f', '#3f7a4a', '#6b6b6b'];
const BOOT_COLORS = ['#ffffff', '#111111', '#e0261f', '#1f6ee0', '#37d67a', '#f5c542'];

export default function CreateCareer() {
  const [saveName, setSaveName] = useState('Meine Karriere');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [age, setAge] = useState(17);
  const [nationality, setNationality] = useState('falkenland');
  const [position, setPosition] = useState<PositionCode>('ST');
  const [altPositions, setAltPositions] = useState<PositionCode[]>([]);
  const [foot, setFoot] = useState<Foot>('rechts');
  const [height, setHeight] = useState(180);
  const [weight, setWeight] = useState(74);
  const [shirtNumber, setShirtNumber] = useState(9);
  const [background, setBackground] = useState<BackgroundKey>('academy');
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');

  const [skinTone, setSkinTone] = useState(0);
  const [hairStyle, setHairStyle] = useState(1);
  const [hairColor, setHairColor] = useState(HAIR_COLORS[0]);
  const [beard, setBeard] = useState(0);
  const [eyeColor, setEyeColor] = useState(EYE_COLORS[0]);
  const [boots, setBoots] = useState(BOOT_COLORS[0]);

  const bg = useMemo(() => BACKGROUND_LIST.find((b) => b.key === background)!, [background]);
  const neighbours = POSITION_NEIGHBOURS[position];
  const valid = firstName.trim().length > 0 && lastName.trim().length > 0;

  function randomName() {
    const rng = new Rng(randomSeed());
    const pool = NAME_POOLS[nationality] ?? NAME_POOLS.falkenland;
    setFirstName(rng.pick(pool.firstNames));
    setLastName(rng.pick(pool.lastNames));
  }

  function toggleAlt(pos: PositionCode) {
    setAltPositions((prev) => prev.includes(pos)
      ? prev.filter((p) => p !== pos)
      : prev.length < 2 ? [...prev, pos] : prev);
  }

  function submit() {
    if (!valid) return;
    void startNewCareer({
      saveName: saveName.trim() || 'Karriere',
      difficulty,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      age,
      nationality,
      position,
      altPositions: altPositions.filter((p) => p !== position),
      foot,
      height,
      weight,
      shirtNumber,
      appearance: { skinTone, hairStyle, hairColor, beard, eyeColor, boots },
      background,
    });
  }

  return (
    <div className="menu-wrap" style={{ alignItems: 'start' }}>
      <div className="menu">
        <div className="row between" style={{ marginBottom: '1rem' }}>
          <h1 style={{ margin: 0 }}>Spieler erstellen</h1>
          <button className="ghost" onClick={() => setState({ screen: 'menu' })}>Zurueck</button>
        </div>

        <Panel title="Grunddaten">
          <div className="grid two">
            <div>
              <label>Name des Spielstands</label>
              <input value={saveName} onChange={(e) => setSaveName(e.target.value)} />
            </div>
            <div>
              <label>Nationalitaet</label>
              <select value={nationality} onChange={(e) => setNationality(e.target.value)}>
                {COUNTRIES.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} - {c.style}</option>
                ))}
              </select>
            </div>
            <div>
              <label>Vorname</label>
              <input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="z. B. Jonas" />
            </div>
            <div>
              <label>Nachname</label>
              <div className="row" style={{ flexWrap: 'nowrap' }}>
                <input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="z. B. Falkner" />
                <button className="small ghost" onClick={randomName} title="Zufaelliger Name">Zufall</button>
              </div>
            </div>
            <div>
              <label>Alter: {age} Jahre</label>
              <input type="range" min={15} max={18} value={age}
                onChange={(e) => setAge(Number(e.target.value))} />
            </div>
            <div>
              <label>Rueckennummer</label>
              <input type="number" min={1} max={99} value={shirtNumber}
                onChange={(e) => setShirtNumber(Math.max(1, Math.min(99, Number(e.target.value) || 1)))} />
            </div>
            <div>
              <label>Groesse: {height} cm</label>
              <input type="range" min={160} max={205} value={height}
                onChange={(e) => setHeight(Number(e.target.value))} />
            </div>
            <div>
              <label>Gewicht: {weight} kg</label>
              <input type="range" min={55} max={100} value={weight}
                onChange={(e) => setWeight(Number(e.target.value))} />
            </div>
          </div>

          <div style={{ marginTop: '0.8rem' }}>
            <label>Starker Fuss</label>
            <div className="chip-row">
              {(['rechts', 'links'] as Foot[]).map((f) => (
                <span key={f} className={`chip ${foot === f ? 'active' : ''}`}
                  onClick={() => setFoot(f)}>{f}</span>
              ))}
            </div>
          </div>
        </Panel>

        <Panel title="Position">
          <label>Hauptposition</label>
          <div className="chip-row" style={{ marginBottom: '0.8rem' }}>
            {POSITIONS.map((p) => (
              <span key={p} className={`chip ${position === p ? 'active' : ''}`}
                onClick={() => { setPosition(p); setAltPositions([]); }}>
                {p} - {POSITION_LABELS[p]}
              </span>
            ))}
          </div>
          {neighbours.length > 0 && (
            <>
              <label>Nebenpositionen (bis zu zwei)</label>
              <div className="chip-row">
                {neighbours.map((p) => (
                  <span key={p} className={`chip ${altPositions.includes(p) ? 'active' : ''}`}
                    onClick={() => toggleAlt(p)}>{POSITION_LABELS[p]}</span>
                ))}
              </div>
            </>
          )}
        </Panel>

        <Panel title="Karrierehintergrund">
          <div className="grid two">
            {BACKGROUND_LIST.map((b) => (
              <button key={b.key}
                className={background === b.key ? 'primary' : ''}
                style={{ textAlign: 'left', padding: '0.7rem 0.85rem', height: '100%' }}
                onClick={() => setBackground(b.key)}>
                <div style={{ fontWeight: 680, marginBottom: 2 }}>{b.name}</div>
                <div className="tiny" style={{ opacity: 0.85 }}>{b.description}</div>
              </button>
            ))}
          </div>
          <div className="grid two small" style={{ marginTop: '0.8rem' }}>
            <div>
              <h4>Vorteile</h4>
              <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
                {bg.pros.map((x) => <li key={x} className="muted">{x}</li>)}
              </ul>
            </div>
            <div>
              <h4>Nachteile</h4>
              <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
                {bg.cons.map((x) => <li key={x} className="muted">{x}</li>)}
              </ul>
            </div>
          </div>
          <p className="tiny dim" style={{ marginTop: '0.6rem', marginBottom: 0 }}>
            Startliga: {bg.startLevel === 1 ? 'erste Liga' : bg.startLevel === 2 ? 'zweite Liga' : 'dritte Liga'}
          </p>
        </Panel>

        <Panel title="Aussehen">
          <div className="row" style={{ gap: '1.4rem', alignItems: 'flex-start' }}>
            <PlayerPreview
              skin={SKIN_TONES[skinTone]} hair={hairColor} hairStyle={hairStyle}
              beard={beard} eye={eyeColor} boots={boots} number={shirtNumber}
            />
            <div style={{ flex: 1, minWidth: 240 }}>
              <SwatchRow label="Hautfarbe" colors={SKIN_TONES}
                selected={SKIN_TONES[skinTone]} onPick={(_, i) => setSkinTone(i)} />
              <SwatchRow label="Haarfarbe" colors={HAIR_COLORS}
                selected={hairColor} onPick={(c) => setHairColor(c)} />
              <SwatchRow label="Augenfarbe" colors={EYE_COLORS}
                selected={eyeColor} onPick={(c) => setEyeColor(c)} />
              <SwatchRow label="Schuhe" colors={BOOT_COLORS}
                selected={boots} onPick={(c) => setBoots(c)} />
              <div className="grid two" style={{ marginTop: '0.5rem' }}>
                <div>
                  <label>Frisur</label>
                  <input type="range" min={0} max={4} value={hairStyle}
                    onChange={(e) => setHairStyle(Number(e.target.value))} />
                </div>
                <div>
                  <label>Bart</label>
                  <input type="range" min={0} max={3} value={beard}
                    onChange={(e) => setBeard(Number(e.target.value))} />
                </div>
              </div>
            </div>
          </div>
        </Panel>

        <Panel title="Schwierigkeitsgrad">
          <div className="grid two">
            {DIFFICULTIES.map((d) => (
              <button key={d.key}
                className={difficulty === d.key ? 'primary' : ''}
                style={{ textAlign: 'left', padding: '0.6rem 0.8rem' }}
                onClick={() => setDifficulty(d.key)}>
                <div style={{ fontWeight: 680 }}>{d.label}</div>
                <div className="tiny" style={{ opacity: 0.85 }}>{d.hint}</div>
              </button>
            ))}
          </div>
        </Panel>

        <div className="row" style={{ margin: '1rem 0 2rem' }}>
          <button className="primary" disabled={!valid} onClick={submit}>
            Karriere beginnen
          </button>
          {!valid && <span className="small dim">Bitte Vor- und Nachnamen eintragen.</span>}
        </div>
      </div>
    </div>
  );
}

function SwatchRow(
  { label, colors, selected, onPick }:
  { label: string; colors: string[]; selected: string; onPick: (color: string, index: number) => void },
) {
  return (
    <div style={{ marginBottom: '0.55rem' }}>
      <label>{label}</label>
      <div className="row" style={{ gap: '0.35rem' }}>
        {colors.map((c, i) => (
          <button key={c} onClick={() => onPick(c, i)}
            aria-label={`${label} ${i + 1}`}
            style={{
              width: 28, height: 28, padding: 0, borderRadius: 6, background: c,
              borderColor: selected === c ? '#37d67a' : 'var(--border)',
              borderWidth: selected === c ? 2 : 1,
            }} />
        ))}
      </div>
    </div>
  );
}

/** Sehr einfache Vorschau - das Aussehen wird spaeter ausgebaut. */
function PlayerPreview(
  { skin, hair, hairStyle, beard, eye, boots, number }:
  { skin: string; hair: string; hairStyle: number; beard: number; eye: string; boots: string; number: number },
) {
  return (
    <svg width={140} height={210} viewBox="0 0 140 210" role="img" aria-label="Spielervorschau"
      style={{ background: '#0c1729', border: '1px solid var(--border-soft)', borderRadius: 10 }}>
      {/* Beine */}
      <rect x={54} y={132} width={13} height={48} rx={5} fill={skin} />
      <rect x={73} y={132} width={13} height={48} rx={5} fill={skin} />
      {/* Schuhe */}
      <rect x={50} y={178} width={20} height={10} rx={4} fill={boots} />
      <rect x={70} y={178} width={20} height={10} rx={4} fill={boots} />
      {/* Hose */}
      <rect x={51} y={112} width={38} height={26} rx={6} fill="#f2f4f8" />
      {/* Trikot */}
      <rect x={46} y={68} width={48} height={50} rx={9} fill="#1f6ee0" />
      <rect x={36} y={70} width={12} height={34} rx={6} fill="#1f6ee0" />
      <rect x={92} y={70} width={12} height={34} rx={6} fill="#1f6ee0" />
      <text x={70} y={100} textAnchor="middle" fontSize={20} fontWeight={700} fill="#fff">{number}</text>
      {/* Arme */}
      <rect x={34} y={100} width={11} height={26} rx={5} fill={skin} />
      <rect x={95} y={100} width={11} height={26} rx={5} fill={skin} />
      {/* Kopf */}
      <circle cx={70} cy={48} r={20} fill={skin} />
      {/* Haare */}
      {hairStyle > 0 && (
        <path
          d={hairStyle === 1 ? 'M50 44 Q70 22 90 44 Q70 34 50 44'
            : hairStyle === 2 ? 'M50 46 Q70 18 90 46 L90 38 Q70 26 50 38 Z'
            : hairStyle === 3 ? 'M49 50 Q70 20 91 50 Q86 32 70 30 Q54 32 49 50'
            : 'M52 40 Q70 24 88 40 L88 34 Q70 28 52 34 Z'}
          fill={hair}
        />
      )}
      {/* Augen */}
      <circle cx={63} cy={47} r={2.6} fill={eye} />
      <circle cx={77} cy={47} r={2.6} fill={eye} />
      {/* Bart */}
      {beard > 0 && (
        <path d={`M56 ${56 + beard} Q70 ${68 + beard * 1.5} 84 ${56 + beard}`}
          stroke={hair} strokeWidth={beard * 2.2} fill="none" strokeLinecap="round" opacity={0.85} />
      )}
    </svg>
  );
}

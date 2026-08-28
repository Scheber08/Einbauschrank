import { START_POINTS, type AttrGroup } from '../engine/game';
import { talentLabelKey, type TalentProfile } from '../engine/potential';
import { useMemo, useState } from 'react';
import { POSITIONS, POSITION_LABELS, POSITION_NEIGHBOURS, type PositionCode } from '../engine/attributes';
import { BACKGROUND_LIST } from '../engine/backgrounds';
import { COUNTRIES } from '../engine/countries';
import { realCountry } from '../engine/realData';
import { HAIR_COLORS, SKIN_TONES } from './PlayerAvatar';
import { NAME_POOLS } from '../engine/names';
import { namePoolOf, nationName, nationsByRegion, regionName } from '../engine/nations';
import { Rng, randomSeed } from '../engine/rng';
import { startNewCareer } from '../state/actions';
import { setState } from '../state/store';
import type { BackgroundKey, Difficulty, Foot } from '../engine/types';
import { Panel } from './components';
import { t } from '../i18n';
import { useLocale } from '../i18n/useLocale';

/** Nur die Kennung steht hier - Name und Beschreibung liegen im Katalog. */
const DIFFICULTIES: Difficulty[] = ['einfach', 'normal', 'schwer', 'simulation'];

// Haut- und Haarfarben teilt sich die Erstellung mit dem Portraet, sonst
// sieht der fertige Spieler anders aus als in der Vorschau.
const EYE_COLORS = ['#4a3120', '#2f6b8f', '#3f7a4a', '#6b6b6b'];
const BOOT_COLORS = ['#ffffff', '#111111', '#e0261f', '#1f6ee0', '#43d99a', '#e5cd7c'];

/** Reihenfolge der Attributgruppen in der Punkteverteilung. */
const GRUPPEN_ORDNUNG: AttrGroup[] = [
  'technical', 'physical', 'mental', 'defensive', 'goalkeeping',
];

export default function CreateCareer() {
  useLocale();
  const [saveName, setSaveName] = useState(t('create.defaultSaveName'));
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [age, setAge] = useState(17);
  // Wo gespielt wird und woher der Spieler kommt, sind getrennte Angaben.
  const [homeCountry, setHomeCountry] = useState('falkenland');
  const [nationality, setNationality] = useState('de');
  const [position, setPosition] = useState<PositionCode>('ST');
  const [altPositions, setAltPositions] = useState<PositionCode[]>([]);
  const [foot, setFoot] = useState<Foot>('rechts');
  const [height, setHeight] = useState(180);
  const [weight, setWeight] = useState(74);
  const [shirtNumber, setShirtNumber] = useState(9);
  const [background, setBackground] = useState<BackgroundKey>('academy');
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  const [talent, setTalent] = useState<TalentProfile>('steady');
  /** Frei gewaehlte Startliga; null heisst: die Herkunft entscheidet. */
  const [startLevel, setStartLevel] = useState<number | null>(null);
  /** Verteilte Startpunkte je Attributgruppe. */
  const [punkte, setPunkte] = useState<Record<AttrGroup, number>>({
    technical: 0, physical: 0, mental: 0, defensive: 0, goalkeeping: 0,
  });

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
    const pool = NAME_POOLS[namePoolOf(nationality)] ?? NAME_POOLS.falkenland;
    setFirstName(rng.pick(pool.firstNames));
    setLastName(rng.pick(pool.lastNames));
  }

  /** Wie viele Punkte schon vergeben sind. */
  const vergeben = GRUPPEN_ORDNUNG.reduce((a, g) => a + punkte[g], 0);

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
      homeCountry,
      position,
      altPositions: altPositions.filter((p) => p !== position),
      foot,
      height,
      weight,
      shirtNumber,
      appearance: { skinTone, hairStyle, hairColor, beard, eyeColor, boots },
      background,
      talent,
      attributePoints: punkte,
      startLevel: startLevel ?? undefined,
    });
  }

  return (
    <div className="menu-wrap" style={{ alignItems: 'start' }}>
      <div className="menu">
        <div className="row between" style={{ marginBottom: '1rem' }}>
          <h1 style={{ margin: 0 }}>{t('create.title')}</h1>
          <button className="ghost" onClick={() => setState({ screen: 'menu' })}>{t('common.back')}</button>
        </div>

        <Panel title={t('create.basics')}>
          <div className="grid two">
            <div>
              <label>{t('create.saveName')}</label>
              <input value={saveName} onChange={(e) => setSaveName(e.target.value)} />
            </div>
            <div>
              <label>{t('create.playCountry')}</label>
              <select value={homeCountry} onChange={(e) => setHomeCountry(e.target.value)}>
                {COUNTRIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {realCountry(c.id)?.displayName ?? nationName(c.id)}
                    {' - '}{t(`country.${c.id}.style`)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label>{t('create.homeCountry')}</label>
              <select value={nationality} onChange={(e) => setNationality(e.target.value)}>
                {nationsByRegion().map((group) => (
                  <optgroup key={group.region} label={regionName(group.region)}>
                    {group.nations.map((n) => (
                      <option key={n.id} value={n.id}>{nationName(n.id)}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
            <div>
              <label>{t('create.firstName')}</label>
              <input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder={t('create.firstNamePlaceholder')} />
            </div>
            <div>
              <label>{t('create.lastName')}</label>
              <div className="row" style={{ flexWrap: 'nowrap' }}>
                <input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder={t('create.lastNamePlaceholder')} />
                <button className="small ghost" onClick={randomName} title={t('create.randomName')}>{t('create.random')}</button>
              </div>
            </div>
            <div>
              <label>{t('create.age', { n: age })}</label>
              <input type="range" min={15} max={18} value={age}
                onChange={(e) => setAge(Number(e.target.value))} />
            </div>
            <div>
              <label>{t('create.shirtNumber')}</label>
              <input type="number" min={1} max={99} value={shirtNumber}
                onChange={(e) => setShirtNumber(Math.max(1, Math.min(99, Number(e.target.value) || 1)))} />
            </div>
            <div>
              <label>{t('create.height', { n: height })}</label>
              <input type="range" min={160} max={205} value={height}
                onChange={(e) => setHeight(Number(e.target.value))} />
            </div>
            <div>
              <label>{t('create.weight', { n: weight })}</label>
              <input type="range" min={55} max={100} value={weight}
                onChange={(e) => setWeight(Number(e.target.value))} />
            </div>
          </div>

          <div style={{ marginTop: '0.8rem' }}>
            <label>{t('create.strongFoot')}</label>
            <div className="chip-row">
              {(['rechts', 'links'] as Foot[]).map((f) => (
                <span key={f} className={`chip ${foot === f ? 'active' : ''}`}
                  onClick={() => setFoot(f)}>{f}</span>
              ))}
            </div>
          </div>
        </Panel>

        <Panel title={t('create.position')}>
          <label>{t('create.mainPosition')}</label>
          <div className="chip-row" style={{ marginBottom: '0.8rem' }}>
            {POSITIONS.map((p) => (
              <span key={p} className={`chip ${position === p ? 'active' : ''}`}
                onClick={() => { setPosition(p); setAltPositions([]); }}>
                {p} - {t(t(POSITION_LABELS[p]))}
              </span>
            ))}
          </div>
          {neighbours.length > 0 && (
            <>
              <label>{t('create.altPositions')}</label>
              <div className="chip-row">
                {neighbours.map((p) => (
                  <span key={p} className={`chip ${altPositions.includes(p) ? 'active' : ''}`}
                    onClick={() => toggleAlt(p)}>{t(t(POSITION_LABELS[p]))}</span>
                ))}
              </div>
            </>
          )}
        </Panel>

        <Panel title={t('create.background')}>
          <div className="grid two">
            {BACKGROUND_LIST.map((b) => (
              <button key={b.key}
                className={background === b.key ? 'primary' : ''}
                style={{ textAlign: 'left', padding: '0.7rem 0.85rem', height: '100%' }}
                onClick={() => setBackground(b.key)}>
                <div style={{ fontWeight: 680, marginBottom: 2 }}>{t(b.name)}</div>
                <div className="tiny" style={{ opacity: 0.85 }}>{t(b.description)}</div>
              </button>
            ))}
          </div>
          <div className="grid two small" style={{ marginTop: '0.8rem' }}>
            <div>
              <h4>{t('create.pros')}</h4>
              <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
                {bg.pros.map((x) => <li key={x} className="muted">{t(x)}</li>)}
              </ul>
            </div>
            <div>
              <h4>{t('create.cons')}</h4>
              <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
                {bg.cons.map((x) => <li key={x} className="muted">{t(x)}</li>)}
              </ul>
            </div>
          </div>
          <p className="tiny dim" style={{ marginTop: '0.6rem', marginBottom: 0 }}>
            {t('create.startLeague', {
              tier: t(bg.startLevel === 1 ? 'tier.first'
                : bg.startLevel === 2 ? 'tier.second' : 'tier.third'),
            })}
          </p>
        </Panel>

        <Panel title={t('create.appearance')}>
          <div className="row" style={{ gap: '1.4rem', alignItems: 'flex-start' }}>
            <PlayerPreview
              skin={SKIN_TONES[skinTone]} hair={hairColor} hairStyle={hairStyle}
              beard={beard} eye={eyeColor} boots={boots} number={shirtNumber}
            />
            <div style={{ flex: 1, minWidth: 240 }}>
              <SwatchRow label={t('create.skinTone')} colors={SKIN_TONES}
                selected={SKIN_TONES[skinTone]} onPick={(_, i) => setSkinTone(i)} />
              <SwatchRow label={t('create.hairColor')} colors={HAIR_COLORS}
                selected={hairColor} onPick={(c) => setHairColor(c)} />
              <SwatchRow label={t('create.eyeColor')} colors={EYE_COLORS}
                selected={eyeColor} onPick={(c) => setEyeColor(c)} />
              <SwatchRow label={t('create.boots')} colors={BOOT_COLORS}
                selected={boots} onPick={(c) => setBoots(c)} />
              <div className="grid two" style={{ marginTop: '0.5rem' }}>
                <div>
                  <label>{t('create.hairStyle')}</label>
                  <input type="range" min={0} max={4} value={hairStyle}
                    onChange={(e) => setHairStyle(Number(e.target.value))} />
                </div>
                <div>
                  <label>{t('create.beard')}</label>
                  <input type="range" min={0} max={3} value={beard}
                    onChange={(e) => setBeard(Number(e.target.value))} />
                </div>
              </div>
            </div>
          </div>
        </Panel>

        {/* Der Spieler nahm bisher hin, was gewuerfelt wurde: Attribute,
            Startliga und die Frage, wie weit es reicht, standen alle fest,
            bevor er zum ersten Mal auf dem Platz stand. */}
        <Panel title={t('create.talent')}>
          <div className="grid two">
            {(['early', 'steady', 'late'] as TalentProfile[]).map((key) => (
              <button key={key}
                className={talent === key ? 'primary' : ''}
                style={{ textAlign: 'left', padding: '0.6rem 0.8rem' }}
                onClick={() => setTalent(key)}>
                <div style={{ fontWeight: 680 }}>{t(talentLabelKey(key))}</div>
                <div className="tiny" style={{ opacity: 0.85 }}>
                  {t(`talent.${key}.desc`)}
                </div>
              </button>
            ))}
          </div>
          <p className="tiny dim" style={{ marginTop: '0.5rem' }}>
            {t('create.talentHint')}
          </p>
        </Panel>

        <Panel title={t('create.points', { n: START_POINTS - vergeben })}>
          {GRUPPEN_ORDNUNG.map((gruppe) => (
            <div key={gruppe} className="row between" style={{ marginBottom: '0.3rem' }}>
              <span className="small">{t(`create.group.${gruppe}`)}</span>
              <span className="row" style={{ gap: '0.3rem' }}>
                <button className="small ghost" disabled={punkte[gruppe] <= 0}
                  onClick={() => setPunkte((p) => ({ ...p, [gruppe]: p[gruppe] - 1 }))}>
                  &minus;
                </button>
                <span className="mono" style={{ minWidth: '1.6rem', textAlign: 'center' }}>
                  {punkte[gruppe]}
                </span>
                <button className="small ghost" disabled={vergeben >= START_POINTS}
                  onClick={() => setPunkte((p) => ({ ...p, [gruppe]: p[gruppe] + 1 }))}>
                  +
                </button>
              </span>
            </div>
          ))}
          <p className="tiny dim" style={{ marginTop: '0.5rem' }}>
            {t('create.pointsHint')}
          </p>
        </Panel>

        <Panel title={t('create.startLevel')}>
          <div className="row" style={{ flexWrap: 'wrap', gap: '0.35rem' }}>
            <button className={startLevel === null ? 'primary' : ''}
              onClick={() => setStartLevel(null)}>
              {t('create.startLevel.auto')}
            </button>
            {[1, 2, 3].map((lvl) => (
              <button key={lvl} className={startLevel === lvl ? 'primary' : ''}
                onClick={() => setStartLevel(lvl)}>
                {t(`create.startLevel.${lvl}`)}
              </button>
            ))}
          </div>
          <p className="tiny dim" style={{ marginTop: '0.5rem' }}>
            {t('create.startLevelHint')}
          </p>
        </Panel>

        <Panel title={t('create.difficulty')}>
          <div className="grid two">
            {DIFFICULTIES.map((key) => (
              <button key={key}
                className={difficulty === key ? 'primary' : ''}
                style={{ textAlign: 'left', padding: '0.6rem 0.8rem' }}
                onClick={() => setDifficulty(key)}>
                <div style={{ fontWeight: 680 }}>{t(`difficulty.${key}.name`)}</div>
                <div className="tiny" style={{ opacity: 0.85 }}>{t(`difficulty.${key}.desc`)}</div>
              </button>
            ))}
          </div>
        </Panel>

        <div className="row" style={{ margin: '1rem 0 2rem' }}>
          <button className="primary" disabled={!valid} onClick={submit}>{t('create.start')}</button>
          {!valid && <span className="small dim">{t('create.nameRequired')}</span>}
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
              borderColor: selected === c ? '#43d99a' : 'var(--border)',
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
    <svg width={140} height={210} viewBox="0 0 140 210" role="img" aria-label={t('create.preview')}
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

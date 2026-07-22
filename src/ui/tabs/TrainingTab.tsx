import { ATTR_LABELS } from '../../engine/attributes';
import { INTENSITY_FACTORS, TRAINING_EFFECTS, TRAINING_LABELS } from '../../engine/development';
import { userClub } from '../../engine/game';
import { setIndividualGoal, setTraining } from '../../state/actions';
import { useAppState } from '../../state/store';
import type { TrainingFocus, TrainingIntensity } from '../../engine/types';
import { Meter, Panel, Pill } from '../components';

const FOCUS_ORDER: TrainingFocus[] = [
  'ballControl', 'dribbling', 'passing', 'crossing', 'shooting', 'freeKicks', 'penalties',
  'heading', 'defending', 'tactics', 'goalkeeping',
  'pace', 'strength', 'stamina', 'agility', 'mental', 'recovery',
];

const INTENSITIES: TrainingIntensity[] = ['leicht', 'normal', 'intensiv', 'sehr intensiv'];

export default function TrainingTab() {
  const game = useAppState().game!;
  const user = game.players[game.userPlayerId];
  const club = userClub(game);
  const plan = game.training;
  const factors = INTENSITY_FACTORS[plan.intensity];
  const effects = TRAINING_EFFECTS[plan.focus];

  return (
    <>
      <Panel title="Trainingsschwerpunkt">
        <p className="small muted">
          Trainiert wird die ganze Woche, ausgewertet am Freitag im Abschlusstraining.
          Wie schnell du dich entwickelst, haengt von Alter, Potenzial, Trainingsqualitaet
          des Vereins, Einsatzzeiten und Professionalitaet ab.
        </p>
        <div className="chip-row">
          {FOCUS_ORDER.map((focus) => (
            <span key={focus}
              className={`chip ${plan.focus === focus ? 'active' : ''}`}
              onClick={() => setTraining(focus, plan.intensity)}>
              {TRAINING_LABELS[focus]}
            </span>
          ))}
        </div>

        <div style={{ marginTop: '1rem' }}>
          <label>Intensitaet</label>
          <div className="chip-row">
            {INTENSITIES.map((i) => (
              <span key={i}
                className={`chip ${plan.intensity === i ? 'active' : ''}`}
                onClick={() => setTraining(plan.focus, i)}>{i}</span>
            ))}
          </div>
        </div>

        <div className="grid three" style={{ marginTop: '1rem' }}>
          <div className="stat">
            <div className="value">{Math.round(factors.gain * 100)}%</div>
            <div className="label">Fortschritt</div>
          </div>
          <div className="stat">
            <div className="value" style={{ color: factors.fatigue > 1.5 ? '#ffb020' : undefined }}>
              {Math.round(factors.fatigue * 100)}%
            </div>
            <div className="label">Ermuedung</div>
          </div>
          <div className="stat">
            <div className="value" style={{ color: factors.injury > 1.5 ? '#ff7a86' : undefined }}>
              {Math.round(factors.injury * 100)}%
            </div>
            <div className="label">Verletzungsrisiko</div>
          </div>
        </div>
      </Panel>

      <div className="grid two">
        <Panel title="Was verbessert wird">
          {Object.keys(effects).length === 0 && (
            <p className="muted small">
              Regeneration verbessert keine Werte, stellt aber Fitness wieder her und
              senkt das Verletzungsrisiko deutlich.
            </p>
          )}
          {Object.entries(effects)
            .sort((a, b) => (b[1] as number) - (a[1] as number))
            .map(([key, weight]) => (
              <div className="row between small" key={key} style={{ padding: '0.15rem 0' }}>
                <span className="muted">{ATTR_LABELS[key as keyof typeof ATTR_LABELS]}</span>
                <span className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
                  <span className="mono tiny dim">{user.attrs[key as keyof typeof user.attrs]}</span>
                  <span className="bar" style={{ width: 70 }}>
                    <span style={{ width: `${(weight as number) * 100}%`, background: '#3a8fd0' }} />
                  </span>
                </span>
              </div>
            ))}
        </Panel>

        <Panel title="Rahmenbedingungen">
          <Meter label="Trainingsanlagen des Vereins" value={club?.training ?? 50} />
          <Meter label="Nachwuchsarbeit" value={club?.youth ?? 50} />
          <Meter label="Professionalitaet" value={user.attrs.professionalism} />
          <Meter label="Spielpraxis" value={user.sharpness} />
          <Meter label="Fitness" value={user.fitness} />
          <div className="row" style={{ marginTop: '0.5rem' }}>
            <Pill>Wachstumsrate {user.growth.toFixed(2)}</Pill>
            {game.difficulty !== 'schwer' && game.difficulty !== 'simulation' && (
              <Pill tone="good">Potenzial {user.potential}</Pill>
            )}
          </div>
        </Panel>
      </div>

      <Panel title="Individuelles Langzeitziel">
        <p className="small muted">
          Ein Langzeitziel bleibt bestehen, auch wenn du den Wochenschwerpunkt wechselst.
        </p>
        <div className="chip-row">
          <span className={`chip ${plan.individualGoal === null ? 'active' : ''}`}
            onClick={() => setIndividualGoal(null)}>Kein Ziel</span>
          {FOCUS_ORDER.filter((f) => f !== 'recovery').map((focus) => (
            <span key={focus}
              className={`chip ${plan.individualGoal === focus ? 'active' : ''}`}
              onClick={() => setIndividualGoal(focus)}>
              {TRAINING_LABELS[focus]}
            </span>
          ))}
        </div>
      </Panel>
    </>
  );
}

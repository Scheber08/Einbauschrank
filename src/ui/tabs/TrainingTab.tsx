import { DIFFICULTY_SETTINGS } from '../../engine/types';
import { ATTR_LABELS } from '../../engine/attributes';
import { INTENSITY_FACTORS, TRAINING_EFFECTS, TRAINING_LABELS } from '../../engine/development';
import { userClub } from '../../engine/game';
import { mentorInfluence } from '../../engine/relationships';
import { freeKickStanding, penaltyStanding } from '../../engine/setpieces';
import {
  setExtraSessions, setIndividualGoal, setLifestyle, setSetPieceClaim,
  setTraining, setTransferWish,
} from '../../state/actions';
import {
  extraSessionEffect, lifestyleLabelKey,
  type Lifestyle, type SetPieceClaim,
} from '../../engine/choices';
import { useAppState } from '../../state/store';
import type { TrainingFocus, TrainingIntensity } from '../../engine/types';
import { Meter, Panel, Pill } from '../components';
import { t, tDecimal } from '../../i18n';
import { useLocale } from '../../i18n/useLocale';

const FOCUS_ORDER: TrainingFocus[] = [
  'ballControl', 'dribbling', 'passing', 'crossing', 'shooting', 'freeKicks', 'penalties',
  'heading', 'defending', 'tactics', 'goalkeeping',
  'pace', 'strength', 'stamina', 'agility', 'mental', 'recovery',
];

const INTENSITIES: TrainingIntensity[] = ['leicht', 'normal', 'intensiv', 'sehr intensiv'];

export default function TrainingTab() {
  useLocale();
  const game = useAppState().game!;
  const user = game.players[game.userPlayerId];
  const club = userClub(game);
  const plan = game.training;
  const factors = INTENSITY_FACTORS[plan.intensity];
  const effects = TRAINING_EFFECTS[plan.focus];

  // Mentor: Einfluss, Name und der Grund, falls er gerade nicht wirkt.
  const mentor = game.mentorId ? game.players[game.mentorId] : null;
  const mentorGain = mentorInfluence(game);
  const mentorName = mentor ? `${mentor.firstName} ${mentor.lastName}` : '';
  // Wer bei Standards antritt, entscheidet die Spielsimulation nach den
  // Attributen - sichtbar war das nirgends. Ein Spieler konnte die
  // Schwerpunkte "Freistoesse" und "Elfmeter" eine Laufbahn lang trainieren,
  // ohne je zu erfahren, ob es reicht.
  const elfmeter = penaltyStanding(game, user.clubId ?? null);
  const freistoss = freeKickStanding(game, user.clubId ?? null);
  const standZeile = (stand: typeof elfmeter, key: string) => {
    if (!stand) return null;
    if (stand.takes) {
      return <span className="pill good">{t(`train.${key}.yes`)}</span>;
    }
    return (
      <span className="muted tiny">
        {t(`train.${key}.no`, {
          name: stand.ahead ? `${stand.ahead.firstName.charAt(0)}. ${stand.ahead.lastName}` : '',
          n: stand.gap,
        })}
      </span>
    );
  };
  const mentorRel = mentor ? Math.round(game.relationships[mentor.id] ?? 0) : 0;
  const mentorPct = Math.round(mentorGain * 100);
  // Zu Beginn steht der Bonus bei ein bis zwei Prozent. Als nackte Zahl liest
  // sich das wie ein Fehler ("Entwicklung 1 Prozent schneller"), dabei ist es der
  // Anfang einer Beziehung, die ueber Saisons waechst. Deshalb steht das
  // Verhaeltnis immer dabei - und solange der Bonus klein ist, sagt der Text, dass
  // da noch etwas kommt, statt eine Zahl zu behaupten, die nichts bedeutet.
  const mentorHint = !mentor
    ? <span className='muted tiny'>{t('train.mentor.none')}</span>
    : mentorGain <= 0
      ? (
        <span className='muted tiny'>
          {t('train.mentor.distant', { mentor: mentorName })}
        </span>
      )
      : mentorPct < 2
        ? (
          <span className='muted tiny'>
            {t('train.mentor.early', { mentor: mentorName, rel: mentorRel })}
          </span>
        )
        : (
          <Pill tone='good'>
            {t('train.mentor.hint', {
              mentor: mentorName, rel: mentorRel, bonus: mentorPct,
            })}
          </Pill>
        );
  return (
    <>
      <Panel title={t('training.focus')}>
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
              {t(TRAINING_LABELS[focus])}
            </span>
          ))}
        </div>

        <div style={{ marginTop: '1rem' }}>
          <label>{t('training.intensity')}</label>
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
            <div className="label">{t('training.progress')}</div>
          </div>
          <div className="stat">
            <div className="value" style={{ color: factors.fatigue > 1.5 ? '#d8a657' : undefined }}>
              {Math.round(factors.fatigue * 100)}%
            </div>
            <div className="label">{t('training.fatigue')}</div>
          </div>
          <div className="stat">
            <div className="value" style={{ color: factors.injury > 1.5 ? '#d05a5a' : undefined }}>
              {Math.round(factors.injury * 100)}%
            </div>
            <div className="label">{t('training.injuryRisk')}</div>
          </div>
        </div>
      </Panel>

      <div className="grid two">
        <Panel title={t('training.improves')}>
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
                <span className="muted">{t(t(ATTR_LABELS[key as keyof typeof ATTR_LABELS]))}</span>
                <span className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
                  <span className="mono tiny dim">{user.attrs[key as keyof typeof user.attrs]}</span>
                  <span className="bar" style={{ width: 70 }}>
                    <span style={{ width: `${(weight as number) * 100}%`, background: '#3a8fd0' }} />
                  </span>
                </span>
              </div>
            ))}
        </Panel>

        <Panel title={t('training.conditions')}>
          <Meter label={t('training.clubFacilities')} value={club?.training ?? 50} />
          <Meter label={t('club.youthWork')} value={club?.youth ?? 50} />
          <Meter label={t('training.professionalism')} value={user.attrs.professionalism} />
          <Meter label={t('training.sharpness')} value={user.sharpness} />
          <Meter label={t('player.fitness')} value={user.fitness} />
          {/* Der Mentor beschleunigt die Entwicklung. Ohne diese Zeile waere der
              Vorteil unsichtbar - und damit so folgenlos wie das blosse Abzeichen
              in der Kaderliste, das er vorher war. */}
          <div className="row between small" style={{ marginTop: '0.4rem' }}>
            <span className="muted">{t('train.mentor.label')}</span>
            {mentorHint}
          </div>
          <div className="row between small" style={{ marginTop: '0.3rem' }}>
            <span className="muted">{t('train.penalties.label')}</span>
            {standZeile(elfmeter, 'penalties')}
          </div>
          <div className="row between small" style={{ marginTop: '0.3rem' }}>
            <span className="muted">{t('train.freeKicks.label')}</span>
            {standZeile(freistoss, 'freeKicks')}
          </div>
          <div className="row" style={{ marginTop: '0.5rem' }}>
            <Pill>{t('training.growthRate', { value: tDecimal(user.growth) })}</Pill>
            {DIFFICULTY_SETTINGS[game.difficulty].showPotential && (
              <Pill tone="good">{t('training.potentialPill', { value: user.potential })}</Pill>
            )}
          </div>
        </Panel>
      </div>

      {/* Vier Entscheidungen mit Preis. Bis hierher gab es genau drei
          Stellschrauben - Schwerpunkt, Ziel und Berateraufträge; alles
          andere passierte mit einem. Keine dieser Optionen ist gratis. */}
      <Panel title={t('choices.lifestyle')}>
        <p className="small muted">{t('choices.lifestyleHint')}</p>
        <div className="grid two">
          {(['professional', 'balanced', 'nightlife'] as Lifestyle[]).map((key) => (
            <button key={key}
              className={(game.lifestyle ?? 'balanced') === key ? 'primary' : ''}
              style={{ textAlign: 'left', padding: '0.6rem 0.8rem' }}
              onClick={() => setLifestyle(key)}>
              <div style={{ fontWeight: 680 }}>{t(lifestyleLabelKey(key))}</div>
              <div className="tiny" style={{ opacity: 0.85 }}>
                {t(`lifestyle.${key}.desc`)}
              </div>
            </button>
          ))}
        </div>
      </Panel>

      <Panel title={t('choices.extra')}>
        <p className="small muted">{t('choices.extraHint')}</p>
        <div className="chip-row">
          {[0, 1, 2].map((n) => (
            <span key={n}
              className={`chip ${(game.extraSessions ?? 0) === n ? 'active' : ''}`}
              onClick={() => setExtraSessions(n)}>
              {t(`choices.extra.${n}`)}
            </span>
          ))}
        </div>
        <p className="tiny dim" style={{ marginTop: '0.45rem' }}>
          {t('choices.extraCost', {
            growth: Math.round((extraSessionEffect(game.extraSessions ?? 0).growth - 1) * 100),
            risk: Math.round((extraSessionEffect(game.extraSessions ?? 0).injury - 1) * 100),
          })}
        </p>
      </Panel>

      <Panel title={t('choices.setPieces')}>
        <p className="small muted">{t('choices.setPiecesHint')}</p>
        <div className="chip-row">
          {(['none', 'penalties', 'freeKicks', 'both'] as SetPieceClaim[]).map((c) => (
            <span key={c}
              className={`chip ${(game.setPieceClaim ?? 'none') === c ? 'active' : ''}`}
              onClick={() => setSetPieceClaim(c)}>
              {t(`choices.claim.${c}`)}
            </span>
          ))}
        </div>
      </Panel>

      <Panel title={t('choices.transfer')}>
        <p className="small muted">{t('choices.transferHint')}</p>
        <div className="chip-row">
          <span className={`chip ${!game.transferWish?.active ? 'active' : ''}`}
            onClick={() => setTransferWish(null)}>
            {t('choices.transfer.stay')}
          </span>
          {[1, 2, 3].map((lvl) => (
            <span key={lvl}
              className={`chip ${game.transferWish?.active
                && game.transferWish.level === lvl ? 'active' : ''}`}
              onClick={() => setTransferWish({ active: true, level: lvl })}>
              {t(`create.startLevel.${lvl}`)}
            </span>
          ))}
          <span className={`chip ${game.transferWish?.active
            && game.transferWish.level === undefined ? 'active' : ''}`}
            onClick={() => setTransferWish({ active: true })}>
            {t('choices.transfer.any')}
          </span>
        </div>
      </Panel>

      <Panel title={t('training.longGoal')}>
        <p className="small muted">{t('training.longGoalHint')}</p>
        <div className="chip-row">
          <span className={`chip ${plan.individualGoal === null ? 'active' : ''}`}
            onClick={() => setIndividualGoal(null)}>{t('training.noGoal')}</span>
          {FOCUS_ORDER.filter((f) => f !== 'recovery').map((focus) => (
            <span key={focus}
              className={`chip ${plan.individualGoal === focus ? 'active' : ''}`}
              onClick={() => setIndividualGoal(focus)}>
              {t(t(TRAINING_LABELS[focus]))}
            </span>
          ))}
        </div>
      </Panel>
    </>
  );
}

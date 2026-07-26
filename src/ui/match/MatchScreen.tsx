import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { autoResolveChallenge } from '../../engine/ballAction';
import { formatDate } from '../../engine/date';
import { finishUserMatch, prepareUserMatch } from '../../engine/game';
import {
  applyInterviewAnswer, buildPostMatchInterview,
  type Interview, type InterviewOption,
} from '../../engine/media';
import {
  MatchEngine, MENTALITY_LABELS,
  type HalftimeDecision, type InjuryDecision, type Mentality, type MatchOutcome,
  type TeamStatTotals,
} from '../../engine/matchEngine';
import type { Challenge, ChallengeResult, LiveEvent } from '../../engine/matchTypes';
import { expectedAttendance, matchImportance } from '../../engine/rivalry';
import { Rng } from '../../engine/rng';
import { DIFFICULTY_SETTINGS } from '../../engine/types';
import { advanceCalendar, saveCurrent } from '../../state/actions';
import { commit, setState, useAppState } from '../../state/store';
import ClubCrest from '../ClubCrest';
import { Empty, Meter, Panel, Pill, rating, ratingColor, shortName } from '../components';
import HighlightScene from './HighlightScene';

type Mode = 'simulate' | 'ownHighlights' | 'allHighlights';
type Phase = 'setup' | 'running' | 'done';

const SPEEDS = [
  { label: 'Langsam', ms: 260 },
  { label: 'Normal', ms: 130 },
  { label: 'Schnell', ms: 55 },
  { label: 'Sehr schnell', ms: 16 },
];

export default function MatchScreen() {
  const app = useAppState();
  const game = app.game!;
  // Beim Betreten festhalten: nach Spielende wird pendingMatchId geleert,
  // die Zusammenfassung soll aber weiter sichtbar bleiben.
  const [matchId] = useState(() => game.pendingMatchId);

  const [phase, setPhase] = useState<Phase>('setup');
  const [mode, setMode] = useState<Mode>('ownHighlights');
  const [speedIndex, setSpeedIndex] = useState(1);
  const [paused, setPaused] = useState(false);
  const [mentality, setMentalityState] = useState<Mentality>('balanced');
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [halftime, setHalftime] = useState<HalftimeDecision | null>(null);
  const [injury, setInjury] = useState<InjuryDecision | null>(null);
  const [interview, setInterview] = useState<Interview | null>(null);
  const [interviewReaction, setInterviewReaction] = useState<InterviewOption | null>(null);
  const [outcome, setOutcome] = useState<MatchOutcome | null>(null);
  const [, forceRender] = useState(0);

  const engineRef = useRef<MatchEngine | null>(null);
  const rngRef = useRef<Rng | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  const prepared = useMemo(
    () => (matchId ? prepareUserMatch(game, matchId, mode !== 'simulate') : null),
    [matchId, mode, game.version],
  );

  const match = matchId ? game.matches[matchId] : null;
  const homeClub = match ? game.clubs[match.homeClubId] : null;
  const awayClub = match ? game.clubs[match.awayClubId] : null;
  const competition = match ? game.competitions[match.competitionId] : null;
  // Bedeutung und erwartete Kulisse - macht Derbys und grosse Spiele spuerbar.
  const importance = match ? matchImportance(game, match)
    : { derby: null, label: null, pressure: 0, crowd: 1 };
  const attendance = match
    ? (match.attendance || expectedAttendance(game, match, 0.5)) : 0;

  const finalise = useCallback(() => {
    const engine = engineRef.current;
    if (!engine || !matchId) return;
    const result = engine.finish();
    if (rngRef.current) game.rngState = rngRef.current.state;
    finishUserMatch(game, matchId, result);
    setOutcome(result);
    setPhase('done');

    // Interview nach dem Spiel (Konzept Abschnitt 39).
    const match = game.matches[matchId];
    if (match?.userStats && rngRef.current) {
      const iv = buildPostMatchInterview(game, match, match.userStats, rngRef.current);
      game.rngState = rngRef.current.state;
      if (iv) setInterview(iv);
    }

    commit();
    void saveCurrent(true);
  }, [game, matchId]);

  function answerInterview(optionId: string) {
    if (!interview) return;
    const reaction = applyInterviewAnswer(game, interview, optionId);
    setInterviewReaction(reaction);
    commit();
    void saveCurrent(true);
  }

  // Spieluhr
  useEffect(() => {
    if (phase !== 'running' || paused || challenge || halftime || injury) return;
    const engine = engineRef.current;
    if (!engine) return;

    const timer = window.setInterval(() => {
      const step = engine.step();
      if (engine.pendingHalftime) {
        setHalftime(engine.pendingHalftime);
        forceRender((v) => v + 1);
        return;
      }
      if (engine.pendingInjury) {
        setInjury(engine.pendingInjury);
        forceRender((v) => v + 1);
        return;
      }
      if (step.pending) {
        setChallenge(step.pending);
        forceRender((v) => v + 1);
        return;
      }
      forceRender((v) => v + 1);
      if (step.finished) {
        window.clearInterval(timer);
        finalise();
      }
    }, SPEEDS[speedIndex].ms);

    return () => window.clearInterval(timer);
  }, [phase, paused, challenge, halftime, injury, speedIndex, finalise]);

  // Timeline nach unten scrollen
  useEffect(() => {
    const el = timelineRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  });

  function start(selected: Mode) {
    if (!matchId || !prepared) return;
    setMode(selected);
    const rng = new Rng(game.rngState);
    rngRef.current = rng;
    const engine = new MatchEngine({
      ...prepareUserMatch(game, matchId, selected !== 'simulate')!.setup,
      highlightMode: selected === 'allHighlights' ? 'all' : 'own',
      rng,
    });
    engine.setMentality(mentality);
    engineRef.current = engine;

    if (selected === 'simulate') {
      const user = game.players[game.userPlayerId];
      const difficulty = DIFFICULTY_SETTINGS[game.difficulty];
      engine.runToEnd((c) => autoResolveChallenge(c, user, difficulty, rng));
      setPhase('running');
      // finalise nach dem Rendern, damit der Zustand konsistent bleibt
      window.setTimeout(() => finalise(), 0);
      return;
    }
    setPhase('running');
  }

  function changeMentality(m: Mentality) {
    setMentalityState(m);
    engineRef.current?.setMentality(m);
  }

  function resolveHalftime(optionId: string) {
    engineRef.current?.resolveHalftime(optionId);
    setHalftime(null);
    forceRender((v) => v + 1);
  }

  function resolveInjury(choice: 'play' | 'off') {
    engineRef.current?.resolveInjury(choice);
    setInjury(null);
    forceRender((v) => v + 1);
  }

  function handleChallengeDone(result: ChallengeResult) {
    const engine = engineRef.current;
    setChallenge(null);
    if (!engine) return;
    engine.resolve(result);
    forceRender((v) => v + 1);
    if (engine.finished) finalise();
  }

  function leave() {
    advanceCalendar(1);
    setState({ screen: 'career' });
  }

  if (!match || !homeClub || !awayClub || !prepared) {
    return (
      <div className="match-screen">
        <Panel><Empty text="Kein Spiel gefunden." /></Panel>
        <button onClick={() => setState({ screen: 'career' })}>Zurueck</button>
      </div>
    );
  }

  const engine = engineRef.current;
  const score = engine ? engine.score : [0, 0];
  const events = engine?.events ?? [];
  const user = game.players[game.userPlayerId];
  const userStats = engine?.userStats;

  return (
    <div className="match-screen">
      <div className="scoreboard">
        <div className="team">
          <ClubCrest club={homeClub} size={38} />
          <span>{homeClub.name}</span>
        </div>
        <div className="center">
          <div className="score">{score[0]}:{score[1]}</div>
          <div className="clock">
            {phase === 'setup' ? formatDate(match.date)
              : phase === 'done' ? 'Abpfiff'
              : `${engine?.minute ?? 0}. Minute`}
          </div>
        </div>
        <div className="team away">
          <span>{awayClub.name}</span>
          <ClubCrest club={awayClub} size={38} />
        </div>
      </div>

      <div className="row between" style={{ margin: '0.7rem 0' }}>
        <div className="row">
          <Pill>{competition?.name}</Pill>
          <Pill>{match.roundName ?? `${match.matchday}. Spieltag`}</Pill>
          <Pill>{homeClub.stadiumName}</Pill>
          <Pill>{attendance.toLocaleString('de-DE')} Zuschauer</Pill>
          {importance.label && <Pill tone="warn">{importance.label}</Pill>}
        </div>
        {phase === 'running' && mode !== 'simulate' && (
          <div className="row">
            <button className="small ghost" onClick={() => setPaused((p) => !p)}>
              {paused ? 'Fortsetzen' : 'Pause'}
            </button>
            <div className="chip-row">
              {SPEEDS.map((s, i) => (
                <span key={s.label} className={`chip ${speedIndex === i ? 'active' : ''}`}
                  onClick={() => setSpeedIndex(i)}>{s.label}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      {phase === 'running' && mode !== 'simulate' && (prepared.userInLineup || prepared.userOnBench) && (
        <Panel title="Deine Ausrichtung">
          <div className="row between">
            <MentalityRow value={mentality} onChange={changeMentality} />
            <span className="tiny dim">{mentalityHint(mentality)}</span>
          </div>
        </Panel>
      )}

      {phase === 'setup' && (
        <Panel title="Wie moechtest du dieses Spiel erleben?">
          <div className="row" style={{ marginBottom: '0.9rem' }}>
            {prepared.userInLineup && <Pill tone="good">Du stehst in der Startelf</Pill>}
            {!prepared.userInLineup && prepared.userOnBench && <Pill tone="warn">Du sitzt auf der Bank</Pill>}
            {!prepared.userInLineup && !prepared.userOnBench && (
              <Pill tone="bad">
                {user.injury ? `Verletzt: ${user.injury.name}`
                  : user.suspension > 0 ? 'Gesperrt' : 'Nicht im Kader'}
              </Pill>
            )}
          </div>

          {!prepared.userInLineup && !prepared.userOnBench && !user.injury && user.suspension === 0 && (
            <p className="small muted">
              Der Trainer setzt dieses Mal auf andere. Arbeite im Training an deinen
              Werten, halte die Fitness hoch und verbessere die Trainerbeziehung -
              dann rueckst du in den Kader. Das Spiel kannst du simulieren lassen.
            </p>
          )}

          {(prepared.userInLineup || prepared.userOnBench) && (
            <div style={{ marginBottom: '0.9rem' }}>
              <label>Deine Verfassung</label>
              <div className="grid three">
                <Meter label="Fitness" value={user.fitness} />
                <Meter label="Form" value={user.form} />
                <Meter label="Spielpraxis" value={user.sharpness} />
              </div>
              {user.fitness < 65 && (
                <p className="tiny" style={{ color: 'var(--warn)', margin: '0.1rem 0 0' }}>
                  Wenig Fitness - mit „Kraefte schonen" haelst du laenger durch, sonst
                  laesst die Leistung gegen Spielende nach.
                </p>
              )}
              {user.sharpness < 55 && user.fitness >= 65 && (
                <p className="tiny dim" style={{ margin: '0.1rem 0 0' }}>
                  Wenig Spielpraxis - nach wenig Einsatzzeit brauchst du etwas, um in den
                  Rhythmus zu kommen.
                </p>
              )}
            </div>
          )}

          {(prepared.userInLineup || prepared.userOnBench) && (
            <div style={{ marginBottom: '0.9rem' }}>
              <label>Ausrichtung fuer dieses Spiel (jederzeit aenderbar)</label>
              <div className="row between">
                <MentalityRow value={mentality} onChange={changeMentality} />
                <span className="tiny dim">{mentalityHint(mentality)}</span>
              </div>
            </div>
          )}

          <div className="grid three">
            <button style={{ textAlign: 'left', padding: '0.8rem' }} onClick={() => start('simulate')}>
              <div style={{ fontWeight: 680 }}>Komplett simulieren</div>
              <div className="tiny muted">
                Das Spiel wird berechnet. Du erhaeltst Ergebnis, Bewertung und Statistik.
              </div>
            </button>
            <button className="primary" style={{ textAlign: 'left', padding: '0.8rem' }}
              disabled={!prepared.userInLineup && !prepared.userOnBench}
              onClick={() => start('ownHighlights')}>
              <div style={{ fontWeight: 680 }}>Nur eigene Highlights</div>
              <div className="tiny" style={{ opacity: 0.85 }}>
                Der zentrale Modus: Du spielst jede Schluesselszene deines Spielers selbst.
              </div>
            </button>
            <button style={{ textAlign: 'left', padding: '0.8rem' }}
              disabled={!prepared.userInLineup && !prepared.userOnBench}
              onClick={() => start('allHighlights')}>
              <div style={{ fontWeight: 680 }}>Alle wichtigen Szenen</div>
              <div className="tiny muted">
                Wie oben, aber du bist auch ohne Ball gefragt: mehr Zweikaempfe und
                Klaerungen gegnerischer Grosschancen.
              </div>
            </button>
          </div>

          <div className="grid two" style={{ marginTop: '1rem' }}>
            <div>
              <h4>{homeClub.name}</h4>
              <LineupList game={game} ids={prepared.homeLineup.starters.map((s) => s.playerId)}
                positions={prepared.homeLineup.starters.map((s) => s.position)} />
            </div>
            <div>
              <h4>{awayClub.name}</h4>
              <LineupList game={game} ids={prepared.awayLineup.starters.map((s) => s.playerId)}
                positions={prepared.awayLineup.starters.map((s) => s.position)} />
            </div>
          </div>
        </Panel>
      )}

      {phase !== 'setup' && engine && (
        <TeamStatsPanel
          home={engine.teamStats.home} away={engine.teamStats.away}
          homeShort={homeClub.short} awayShort={awayClub.short} full={phase === 'done'} />
      )}

      {phase !== 'setup' && (
        <div className="grid two">
          <Panel title="Spielverlauf">
            <div className="timeline" ref={timelineRef}>
              {events.length === 0 && <Empty text="Anpfiff steht bevor." />}
              {events.map((e, i) => <EventRow key={i} event={e} />)}
            </div>
          </Panel>

          <Panel title="Deine Leistung">
            {!userStats || userStats.minutes === 0 ? (
              <Empty text="Du bist noch nicht im Spiel." />
            ) : (
              <>
                <div className="grid four">
                  <div className="stat"><div className="value">{userStats.goals}</div><div className="label">Tore</div></div>
                  <div className="stat"><div className="value">{userStats.assists}</div><div className="label">Vorlagen</div></div>
                  <div className="stat"><div className="value">{userStats.minutes}</div><div className="label">Minuten</div></div>
                  <div className="stat">
                    <div className="value" style={{ color: ratingColor(userStats.rating) }}>
                      {phase === 'done' ? rating(userStats.rating) : '-'}
                    </div>
                    <div className="label">Note</div>
                  </div>
                </div>
                <div className="small" style={{ marginTop: '0.7rem' }}>
                  <StatLine label="Schuesse" value={`${userStats.shotsOnTarget}/${userStats.shots}`} />
                  <StatLine label="Paesse" value={`${userStats.passesCompleted}/${userStats.passes}`} />
                  <StatLine label="Schluesselpaesse" value={userStats.keyPasses} />
                  <StatLine label="Zweikaempfe" value={`${userStats.duelsWon}/${userStats.duels}`} />
                  {userStats.tackles > 0 && <StatLine label="Graetschen" value={userStats.tackles} />}
                  {userStats.saves > 0 && <StatLine label="Paraden" value={userStats.saves} />}
                  {userStats.yellowCards > 0 && <StatLine label="Gelbe Karten" value={userStats.yellowCards} />}
                </div>
              </>
            )}

            {phase === 'done' && outcome && (
              <div style={{ marginTop: '1rem' }}>
                {outcome.penalties && (
                  <p className="pill warn">
                    Elfmeterschiessen {outcome.penalties[0]}:{outcome.penalties[1]}
                  </p>
                )}
                {outcome.motmId === game.userPlayerId && (
                  <p className="pill good">Spieler des Spiels</p>
                )}
                {outcome.userInputQuality !== null && (
                  <p className="tiny dim">
                    Ausfuehrungsqualitaet deiner Aktionen:{' '}
                    {Math.round(outcome.userInputQuality * 100)}%
                  </p>
                )}

                {interview && !interviewReaction && (
                  <div style={{
                    marginTop: '0.8rem', padding: '0.7rem 0.8rem',
                    border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                    background: '#0c1729',
                  }}>
                    <div className="tiny dim">Interview nach dem Spiel</div>
                    <div style={{ fontWeight: 620, margin: '0.2rem 0 0.6rem' }}>
                      „{interview.question}"
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      {interview.options.map((o) => (
                        <button key={o.id} style={{ textAlign: 'left', padding: '0.5rem 0.7rem' }}
                          onClick={() => answerInterview(o.id)}>
                          <div className="small" style={{ fontWeight: 600 }}>{o.label}</div>
                          <div className="tiny dim">{o.tone}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {interviewReaction && (
                  <div style={{
                    marginTop: '0.8rem', padding: '0.7rem 0.8rem',
                    border: '1px solid var(--border-soft)', borderRadius: 'var(--radius-sm)',
                    background: '#0c1729',
                  }}>
                    <div className="tiny dim">Deine Antwort</div>
                    <div className="small" style={{ fontStyle: 'italic', marginBottom: '0.3rem' }}>
                      „{interviewReaction.label}"
                    </div>
                    <div className="small muted">{interviewReaction.reaction}</div>
                    <InterviewEffects effect={interviewReaction.effect} />
                  </div>
                )}

                <button className="primary" style={{ width: '100%', marginTop: '0.5rem' }}
                  onClick={leave}>
                  {interview && !interviewReaction ? 'Interview ueberspringen und zurueck' : 'Zurueck zur Karriere'}
                </button>
              </div>
            )}
          </Panel>
        </div>
      )}

      {challenge && (
        <HighlightScene
          challenge={challenge}
          player={user}
          difficulty={DIFFICULTY_SETTINGS[game.difficulty]}
          seed={(game.rngState ^ (challenge.minute * 2654435761)) >>> 0}
          onDone={handleChallengeDone}
        />
      )}

      {halftime && (
        <HalftimeModal
          decision={halftime}
          homeShort={homeClub.short}
          awayShort={awayClub.short}
          onChoose={resolveHalftime}
        />
      )}

      {injury && <InjuryModal decision={injury} onChoose={resolveInjury} />}
    </div>
  );
}

function InjuryModal(
  { decision, onChoose }:
  { decision: InjuryDecision; onChoose: (c: 'play' | 'off') => void },
) {
  const sevTone = decision.severity === 'schwer' ? 'bad'
    : decision.severity === 'mittel' ? 'warn' : '';
  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="row between" style={{ marginBottom: '0.4rem' }}>
          <h2 style={{ margin: 0 }}>Verletzung ({decision.minute}.)</h2>
          <span className={`pill ${sevTone}`}>{decision.severity}</span>
        </div>
        <p className="muted">
          Du bist angeschlagen. Der Betreuer schaetzt bei sofortiger Auswechslung
          etwa {decision.estimatedDays} Tage Pause. Weiterspielen ist moeglich,
          riskiert aber eine Verschlimmerung - und du bist geschwaecht.
        </p>
        <div className="grid two" style={{ marginTop: '0.6rem' }}>
          <button className="primary" style={{ textAlign: 'left', padding: '0.7rem 0.85rem' }}
            onClick={() => onChoose('off')}>
            <div style={{ fontWeight: 680 }}>Auswechseln lassen</div>
            <div className="tiny" style={{ opacity: 0.85 }}>
              Sicher. Etwa {decision.estimatedDays} Tage Pause, normale Genesung.
            </div>
          </button>
          <button style={{ textAlign: 'left', padding: '0.7rem 0.85rem' }}
            onClick={() => onChoose('play')}>
            <div style={{ fontWeight: 680 }}>Auf die Zaehne beissen</div>
            <div className="tiny muted">
              Weiterspielen mit Leistungseinbruch. Geht es gut, kommst du
              glimpflich davon - sonst wird es schlimmer.
            </div>
          </button>
        </div>
        {!decision.canSubstitute && (
          <p className="tiny dim" style={{ marginTop: '0.5rem' }}>
            Alle Wechsel sind aufgebraucht. Ein Ausscheiden liesse dein Team in
            Unterzahl zurueck.
          </p>
        )}
      </div>
    </div>
  );
}

function HalftimeModal(
  { decision, homeShort, awayShort, onChoose }:
  {
    decision: HalftimeDecision; homeShort: string; awayShort: string;
    onChoose: (id: string) => void;
  },
) {
  const [h, a] = decision.scoreline;
  const own = decision.userSide === 'home' ? h : a;
  const opp = decision.userSide === 'home' ? a : h;
  const tone = own > opp ? 'good' : own < opp ? 'bad' : 'warn';
  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="row between" style={{ marginBottom: '0.4rem' }}>
          <h2 style={{ margin: 0 }}>Halbzeit</h2>
          <span className={`pill ${tone}`}>{homeShort} {h}:{a} {awayShort}</span>
        </div>
        <p className="muted" style={{ fontStyle: 'italic' }}>„{decision.coachMessage}"</p>
        {!decision.onPitch && (
          <p className="tiny dim">
            Du sitzt auf der Bank - deine Ansage wirkt gedaempfter, aber du kannst
            die Mannschaft trotzdem einstellen.
          </p>
        )}
        <div className="grid two" style={{ marginTop: '0.6rem' }}>
          {decision.options.map((o) => (
            <button key={o.id}
              style={{ textAlign: 'left', padding: '0.7rem 0.85rem', height: '100%' }}
              onClick={() => onChoose(o.id)}>
              <div style={{ fontWeight: 680, marginBottom: 2 }}>{o.label}</div>
              <div className="tiny muted">{o.description}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

const MENTALITY_ORDER: Mentality[] = ['attack', 'balanced', 'contain', 'conserve'];

function MentalityRow(
  { value, onChange }: { value: Mentality; onChange: (m: Mentality) => void },
) {
  return (
    <div className="chip-row">
      {MENTALITY_ORDER.map((m) => (
        <span key={m} className={`chip ${value === m ? 'active' : ''}`}
          onClick={() => onChange(m)}>{MENTALITY_LABELS[m]}</span>
      ))}
    </div>
  );
}

function InterviewEffects({ effect }: { effect: InterviewOption['effect'] }) {
  const items: { label: string; value: number }[] = [
    { label: 'Moral', value: effect.morale ?? 0 },
    { label: 'Trainer', value: effect.coach ?? 0 },
    { label: 'Fans', value: effect.fans ?? 0 },
    { label: 'Image', value: effect.image ?? 0 },
    { label: 'Reputation', value: effect.reputation ?? 0 },
  ].filter((i) => i.value !== 0);
  if (items.length === 0) return null;
  return (
    <div className="row" style={{ gap: '0.35rem', marginTop: '0.4rem', flexWrap: 'wrap' }}>
      {items.map((i) => (
        <span key={i.label} className={`pill ${i.value > 0 ? 'good' : 'bad'}`}>
          {i.label} {i.value > 0 ? `+${i.value}` : i.value}
        </span>
      ))}
    </div>
  );
}

function mentalityHint(m: Mentality): string {
  switch (m) {
    case 'attack': return 'Mehr Abschluesse und Dribblings, hoher Kraftverbrauch.';
    case 'contain': return 'Mehr Zweikaempfe und Klaerungen, weniger im Angriff.';
    case 'conserve': return 'Zurueckhaltung, schont die Fitness fuer spaeter.';
    default: return 'Ausgeglichene Beteiligung in Angriff und Abwehr.';
  }
}

function EventRow({ event }: { event: LiveEvent }) {
  const cls = event.type === 'goal' ? 'goal'
    : event.type === 'yellow' || event.type === 'red' || event.type === 'secondYellow' ? 'card' : '';
  return (
    <div className={`ev ${cls} ${event.user ? 'user' : ''}`}>
      <span className="min">{event.minute > 0 ? `${event.minute}'` : ''}</span>
      <span>
        {event.text}
        {event.type === 'goal' && event.score && (
          <strong className="mono"> ({event.score[0]}:{event.score[1]})</strong>
        )}
      </span>
    </div>
  );
}

function StatLine({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="row between" style={{ padding: '0.1rem 0' }}>
      <span className="muted">{label}</span>
      <span className="mono">{value}</span>
    </div>
  );
}

/** Direkter Mannschaftsvergleich (Heim gruen, Auswaerts blau). */
function TeamStatsPanel(
  { home, away, homeShort, awayShort, full }:
  {
    home: TeamStatTotals; away: TeamStatTotals;
    homeShort: string; awayShort: string; full: boolean;
  },
) {
  const rows: { label: string; h: number; a: number; pct?: boolean }[] = [
    { label: 'Schuesse', h: home.shots, a: away.shots },
    { label: 'aufs Tor', h: home.shotsOnTarget, a: away.shotsOnTarget },
  ];
  if (full) {
    // Ballbesitz aus dem Passvolumen - erst nach Abpfiff vollstaendig.
    const totalPass = home.passes + away.passes;
    if (totalPass > 0) {
      const hp = Math.round((home.passes / totalPass) * 100);
      rows.push({ label: 'Ballbesitz', h: hp, a: 100 - hp, pct: true });
    }
    if (home.fouls + away.fouls > 0) rows.push({ label: 'Fouls', h: home.fouls, a: away.fouls });
    if (home.cards + away.cards > 0) rows.push({ label: 'Karten', h: home.cards, a: away.cards });
  }
  return (
    <Panel title="Spielstatistik">
      <div className="row between" style={{ marginBottom: '0.55rem' }}>
        <span className="tiny" style={{ color: 'var(--accent)', fontWeight: 700 }}>{homeShort}</span>
        <span className="tiny dim">{full ? 'Endstand' : 'live'}</span>
        <span className="tiny" style={{ color: 'var(--accent-2)', fontWeight: 700 }}>{awayShort}</span>
      </div>
      {rows.map((r) => <StatCompare key={r.label} {...r} />)}
    </Panel>
  );
}

function StatCompare({ label, h, a, pct }: { label: string; h: number; a: number; pct?: boolean }) {
  const hp = pct ? h : (h + a > 0 ? (h / (h + a)) * 100 : 50);
  return (
    <div className="stat-cmp">
      <div className="stat-cmp-head">
        <span className="mono" style={{ fontWeight: 600 }}>{pct ? `${h}%` : h}</span>
        <span className="tiny dim">{label}</span>
        <span className="mono" style={{ fontWeight: 600 }}>{pct ? `${a}%` : a}</span>
      </div>
      <div className="cmp-bar">
        <span className="h" style={{ width: `${hp}%` }} />
        <span className="a" style={{ width: `${100 - hp}%` }} />
      </div>
    </div>
  );
}

function LineupList(
  { game, ids, positions }:
  { game: ReturnType<typeof useAppState>['game']; ids: string[]; positions: string[] },
) {
  if (!game) return null;
  return (
    <table>
      <tbody>
        {ids.map((id, i) => {
          const p = game.players[id];
          if (!p) return null;
          return (
            <tr key={id} className={p.isUser ? 'user' : ''}>
              <td className="tiny dim" style={{ width: 26 }}>{positions[i]}</td>
              <td className="tiny dim" style={{ width: 22 }}>{p.shirtNumber}</td>
              <td>{p.isUser ? <strong>{p.firstName} {p.lastName}</strong>
                : shortName(p.firstName, p.lastName)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

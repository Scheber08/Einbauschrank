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
import { attendanceRoll, expectedAttendance, matchImportance } from '../../engine/rivalry';
import { matchReferee, refereeLabelKey } from '../../engine/referee';
import { formatKickoff, matchKickoff } from '../../engine/kickoff';
import { matchWeather, weatherLabelKey } from '../../engine/weather';
import { Rng } from '../../engine/rng';
import { TACTIC_LABELS, DIFFICULTY_SETTINGS } from '../../engine/types';
import { advanceCalendar, saveCurrent } from '../../state/actions';
import { commit, setState, useAppState } from '../../state/store';
import ClubCrest from '../ClubCrest';
import FormationPitch from '../FormationPitch';
import MatchTimeline from './MatchTimeline';
import { Empty, Meter, Panel, Pill, rating, ratingColor, shortName } from '../components';
import HighlightScene from './HighlightScene';
import { t, tNumber, tVariant } from '../../i18n';
import { useLocale } from '../../i18n/useLocale';

type Mode = 'simulate' | 'ownHighlights' | 'allHighlights';
type Phase = 'setup' | 'running' | 'done';

/** Katalogschluessel je Tempostufe - uebersetzt wird bei der Anzeige. */
const SPEEDS = [
  { label: 'match.speed.slow', ms: 260 },
  { label: 'match.speed.normal', ms: 130 },
  { label: 'match.speed.fast', ms: 55 },
  { label: 'match.speed.veryFast', ms: 16 },
];

/** Ereignisse, die eine eigene Einblendung bekommen statt nur eine Tickerzeile. */
const BIG_MOMENTS = new Set<LiveEvent['type']>([
  'goal', 'ownGoal', 'red', 'secondYellow', 'penaltyAwarded', 'penaltyMiss',
]);

/** Schluessel je Grossereignis - der Text kommt aus dem Sprachkatalog. */
const MOMENT_KEY: Partial<Record<LiveEvent['type'], string>> = {
  goal: 'moment.goal',
  ownGoal: 'moment.ownGoal',
  red: 'moment.red',
  secondYellow: 'moment.secondYellow',
  penaltyAwarded: 'moment.penaltyAwarded',
  penaltyMiss: 'moment.penaltyMiss',
};

export default function MatchScreen() {
  useLocale();
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
  /** Grosses Ereignis, das die Uhr kurz anhaelt statt im Ticker unterzugehen. */
  const [moment, setMoment] = useState<LiveEvent | null>(null);
  const [lineupView, setLineupView] = useState<'pitch' | 'list'>('pitch');
  const [interview, setInterview] = useState<Interview | null>(null);
  const [interviewReaction, setInterviewReaction] = useState<InterviewOption | null>(null);
  const [outcome, setOutcome] = useState<MatchOutcome | null>(null);
  const [, forceRender] = useState(0);

  const engineRef = useRef<MatchEngine | null>(null);
  const rngRef = useRef<Rng | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  /** Das Spiel endete waehrend einer Einblendung - erst danach abrechnen. */
  const finishedRef = useRef(false);

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
    ? (match.attendance || expectedAttendance(game, match, attendanceRoll(match.id))) : 0;

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
    if (phase !== 'running' || paused || challenge || halftime || injury || moment) return;
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
      // Ein Tor darf nicht als eine Zeile unter vielen vorbeirauschen. Die Uhr
      // haelt kurz an, das Ereignis bekommt die Buehne - danach laeuft es von
      // selbst weiter.
      const big = step.events.find((e) => BIG_MOMENTS.has(e.type));
      if (big) {
        setMoment(big);
        forceRender((v) => v + 1);
        if (step.finished) { window.clearInterval(timer); finishedRef.current = true; }
        return;
      }
      forceRender((v) => v + 1);
      if (step.finished) {
        window.clearInterval(timer);
        finalise();
      }
    }, SPEEDS[speedIndex].ms);

    return () => window.clearInterval(timer);
  }, [phase, paused, challenge, halftime, injury, moment, speedIndex, finalise]);

  // Der Moment blendet sich selbst wieder aus.
  useEffect(() => {
    if (!moment) return;
    const timer = window.setTimeout(() => {
      setMoment(null);
      if (finishedRef.current) { finishedRef.current = false; finalise(); }
    }, 1900);
    return () => window.clearTimeout(timer);
  }, [moment, finalise]);

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
        <Panel><Empty text={t('empty.noMatch')} /></Panel>
        <button onClick={() => setState({ screen: 'career' })}>{t('common.back')}</button>
      </div>
    );
  }

  const engine = engineRef.current;
  const score = engine ? engine.score : [0, 0];
  const events = engine?.events ?? [];
  const user = game.players[game.userPlayerId];
  // Der Verein auf der anderen Seite - fuer den Hinweis auf seine Spielweise.
  const gegner = user?.clubId && homeClub && awayClub
    ? (user.clubId === homeClub.id ? awayClub : user.clubId === awayClub.id ? homeClub : null)
    : null;
  // Wie voll das Rund ist, und welche Zeile dazu passt. Der Wurf haengt an
  // der Partiekennung, damit die Zeile beim erneuten Oeffnen dieselbe ist.
  const auslastung = Math.min(1, attendance / (homeClub?.stadiumCapacity || 1));
  const fuelle = auslastung >= 0.85 ? 'Full' : auslastung >= 0.5 ? 'Mid' : 'Thin';
  const heimseite = user?.clubId === homeClub?.id ? 'home' : 'away';
  const wetter = match ? matchWeather(match.id, match.date) : null;
  const anstoss = match ? matchKickoff(match.id, match.date) : null;
  const schiri = match && homeClub
    ? matchReferee(match.id, homeClub.countryId) : null;
  const kulisse = match
    ? tVariant(match.neutralVenue ? 'ms.crowd.neutral' : 'ms.crowd.' + heimseite + fuelle,
      attendanceRoll(match.id))
    : '';
  const userStats = engine?.userStats;

  return (
    <div className="match-screen">
      <div className="scoreboard">
        <div className="team">
          <ClubCrest club={homeClub} size={38} />
          <span>{homeClub.name}</span>
        </div>
        <div className="center">
          {/* Der Schluessel loest die Animation aus: bei jedem neuen Stand
              wird das Feld neu gesetzt und pocht einmal. Ohne das aenderte
              sich lautlos eine Ziffer. */}
          <div className="score" key={`${score[0]}:${score[1]}`}>{score[0]}:{score[1]}</div>
          <div className="clock">
            {phase === 'setup' ? formatDate(match.date)
              : phase === 'done' ? t('match.fullTime')
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
          <Pill>{t('ms.attendance', { n: tNumber(attendance) })}</Pill>
          {wetter && <Pill>{t(weatherLabelKey(wetter))}</Pill>}
          {anstoss && (
            <Pill>{t('calendar.kickoff', { time: formatKickoff(anstoss) })}</Pill>
          )}
          {importance.label && <Pill tone="warn">{importance.label}</Pill>}
        </div>
        {phase === 'running' && mode !== 'simulate' && (
          <div className="row">
            <button className="small ghost" onClick={() => setPaused((p) => !p)}>
              {paused ? t('match.resume') : t('match.pause')}
            </button>
            <div className="chip-row">
              {SPEEDS.map((s, i) => (
                <span key={s.label} className={`chip ${speedIndex === i ? 'active' : ''}`}
                  onClick={() => setSpeedIndex(i)}>{t(s.label)}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      {phase === 'running' && mode !== 'simulate' && (prepared.userInLineup || prepared.userOnBench) && (
        <Panel title={t('ms.yourApproach')}>
          <div className="row between">
            <MentalityRow value={mentality} onChange={changeMentality} />
            <span className="tiny dim">{mentalityHint(mentality)}</span>
          </div>
        </Panel>
      )}

      {/* Was fuer ein Gegner das ist. Die Spielweise setzt den eigenen
          Szenen mehr oder weniger Druck entgegen - ohne diese Zeile waere
          das eine Mechanik, die niemand sieht. */}
      {/* Wie voll es ist und was das fuer den eigenen Spieler bedeutet.
          Ein ausverkauftes Auswaertsspiel setzt die Szenen unter Druck,
          das eigene volle Haus nimmt ihn - ohne diese Zeile bliebe das
          eine Zahl auf einem Pill. */}
      {phase === 'setup' && kulisse && (
        <Panel title={t('ms.atmosphere')}>
          <div className="row between">
            <span>{kulisse}</span>
            <span className="tiny dim">
              {t('ms.crowd.fill', { p: Math.round(auslastung * 100) })}
            </span>
          </div>
        </Panel>
      )}

      {phase === 'setup' && schiri && (
        <Panel title={t('ms.referee')}>
          <div className="row between">
            <span>
              <strong>{schiri.name}</strong>
              {' - '}
              {t(refereeLabelKey(schiri.style))}
            </span>
            <span className="tiny dim">
              {tVariant('ms.ref.' + schiri.style, attendanceRoll(match!.id))}
            </span>
          </div>
        </Panel>
      )}

      {phase === 'setup' && gegner && (
        <Panel title={t('ms.opponentStyle')}>
          <div className="row between">
            <span>
              <strong>{gegner.name}</strong>
              {' - '}
              {t(TACTIC_LABELS[gegner.tacticStyle])}
            </span>
            <span className="tiny dim">{t(`ms.style.${gegner.tacticStyle}`)}</span>
          </div>
        </Panel>
      )}

      {phase === 'setup' && (
        <Panel title={t('ms.howToExperience')}>
          <div className="row" style={{ marginBottom: '0.9rem' }}>
            {prepared.userInLineup && <Pill tone="good">{t('squad.youStart')}</Pill>}
            {!prepared.userInLineup && prepared.userOnBench && <Pill tone="warn">{t('squad.youAreBenched')}</Pill>}
            {!prepared.userInLineup && !prepared.userOnBench && (
              <Pill tone="bad">
                {user.injury ? t('match.injuredWith', { injury: t(user.injury.name) })
                  : user.suspension > 0 ? t('squad.suspended') : t('match.notInSquad')}
              </Pill>
            )}
          </div>

          {!prepared.userInLineup && !prepared.userOnBench && !user.injury && user.suspension === 0 && (
            <p className="small muted">
              Der Trainer setzt dieses Mal auf andere. Arbeite im Training an deinen
              Werten, halte die Fitness hoch und verbessere die Trainerbeziehung -
              dann rückst du in den Kader. Das Spiel kannst du simulieren lassen.
            </p>
          )}

          {(prepared.userInLineup || prepared.userOnBench) && (
            <div style={{ marginBottom: '0.9rem' }}>
              <label>{t('match.yourCondition')}</label>
              <div className="grid three">
                <Meter label={t('player.fitness')} value={user.fitness} />
                <Meter label={t('player.form')} value={user.form} />
                <Meter label={t('training.sharpness')} value={user.sharpness} />
              </div>
              {user.fitness < 65 && (
                <p className="tiny" style={{ color: 'var(--warn)', margin: '0.1rem 0 0' }}>
                  Wenig Fitness - mit „Kräfte schonen" hältst du länger durch, sonst
                  lässt die Leistung gegen Spielende nach.
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
              <label>{t('match.stanceTitle')}</label>
              <div className="row between">
                <MentalityRow value={mentality} onChange={changeMentality} />
                <span className="tiny dim">{mentalityHint(mentality)}</span>
              </div>
            </div>
          )}

          <div className="grid three">
            <button style={{ textAlign: 'left', padding: '0.8rem' }} onClick={() => start('simulate')}>
              <div style={{ fontWeight: 680 }}>{t('match.simulateAll')}</div>
              <div className="tiny muted">
                Das Spiel wird berechnet. Du erhältst Ergebnis, Bewertung und Statistik.
              </div>
            </button>
            <button className="primary" style={{ textAlign: 'left', padding: '0.8rem' }}
              disabled={!prepared.userInLineup && !prepared.userOnBench}
              onClick={() => start('ownHighlights')}>
              <div style={{ fontWeight: 680 }}>{t('match.ownHighlightsOnly')}</div>
              <div className="tiny" style={{ opacity: 0.85 }}>
                Der zentrale Modus: Du spielst jede Schlüsselszene deines Spielers selbst.
              </div>
            </button>
            <button style={{ textAlign: 'left', padding: '0.8rem' }}
              disabled={!prepared.userInLineup && !prepared.userOnBench}
              onClick={() => start('allHighlights')}>
              <div style={{ fontWeight: 680 }}>{t('match.allScenes')}</div>
              <div className="tiny muted">
                Wie oben, aber du bist auch ohne Ball gefragt: mehr Zweikämpfe und
                Klärungen gegnerischer Großchancen.
              </div>
            </button>
          </div>

          <div style={{ marginTop: '1rem' }}>
            <h4 style={{ marginBottom: '0.5rem' }}>{t('match.balanceOfPlay')}</h4>
            <StrengthCompare
              home={prepared.homeLineup} away={prepared.awayLineup}
              homeShort={homeClub.short} awayShort={awayClub.short}
            />
          </div>

          <div className="row between" style={{ marginTop: '1rem', marginBottom: '0.5rem' }}>
            <h4 style={{ margin: 0 }}>{t('match.lineups')}</h4>
            <div className="row" style={{ gap: '0.3rem' }}>
              <span className={`chip ${lineupView === 'pitch' ? 'active' : ''}`}
                onClick={() => setLineupView('pitch')}>{t('match.pitchView')}</span>
              <span className={`chip ${lineupView === 'list' ? 'active' : ''}`}
                onClick={() => setLineupView('list')}>{t('match.listView')}</span>
            </div>
          </div>

          {lineupView === 'pitch' ? (
            <div className="formation-pair">
              <FormationPitch
                slots={prepared.homeLineup.starters}
                players={game.players}
                colors={homeClub.colors}
                formation={prepared.homeLineup.formation}
                userPlayerId={game.userPlayerId}
                label={homeClub.name}
              />
              <FormationPitch
                slots={prepared.awayLineup.starters}
                players={game.players}
                colors={awayClub.colors}
                formation={prepared.awayLineup.formation}
                userPlayerId={game.userPlayerId}
                label={awayClub.name}
              />
            </div>
          ) : (
            <div className="grid two">
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
          )}
        </Panel>
      )}

      {phase !== 'setup' && engine && (
        <TeamStatsPanel
          home={engine.teamStats.home} away={engine.teamStats.away}
          homeShort={homeClub.short} awayShort={awayClub.short} full={phase === 'done'} />
      )}

      {phase !== 'setup' && engine && events.length > 0 && (
        <Panel title={t('ms.course')}>
          <MatchTimeline
            events={events}
            minute={engine.minute}
            fullTime={engine.scheduledEnd}
            homeShort={homeClub.short}
            awayShort={awayClub.short}
          />
        </Panel>
      )}

      {phase !== 'setup' && (
        <div className="grid two">
          <Panel title={t('ms.timeline')}>
            <div className="timeline" ref={timelineRef}>
              {events.length === 0 && <Empty text={t('empty.kickoffSoon')} />}
              {events.map((e, i) => (
                <EventRow key={i} event={e} fresh={i === events.length - 1} />
              ))}
            </div>
          </Panel>

          <Panel title={t('ms.yourPerformance')}>
            {!userStats || userStats.minutes === 0 ? (
              <Empty text={t('empty.notOnPitchYet')} />
            ) : (
              <>
                <div className="grid four">
                  <div className="stat"><div className="value">{userStats.goals}</div><div className="label">{t('stats.goals')}</div></div>
                  <div className="stat"><div className="value">{userStats.assists}</div><div className="label">{t('stats.assists')}</div></div>
                  <div className="stat"><div className="value">{userStats.minutes}</div><div className="label">{t('stats.minutes')}</div></div>
                  <div className="stat">
                    <div className="value" style={{ color: ratingColor(userStats.rating) }}>
                      {phase === 'done' ? rating(userStats.rating) : '-'}
                    </div>
                    <div className="label">{t('stats.rating')}</div>
                  </div>
                </div>
                <div className="small" style={{ marginTop: '0.7rem' }}>
                  <StatLine label={t('stats.shots')} value={`${userStats.shotsOnTarget}/${userStats.shots}`} />
                  <StatLine label={t('match.passes')} value={`${userStats.passesCompleted}/${userStats.passes}`} />
                  <StatLine label={t('stats.keyPasses')} value={userStats.keyPasses} />
                  <StatLine label={t('ms.duels')} value={`${userStats.duelsWon}/${userStats.duels}`} />
                  {userStats.tackles > 0 && <StatLine label={t('stats.tackles')} value={userStats.tackles} />}
                  {userStats.saves > 0 && <StatLine label={t('stats.saves')} value={userStats.saves} />}
                  {userStats.yellowCards > 0 && <StatLine label={t('stats.yellowCards')} value={userStats.yellowCards} />}
                </div>
              </>
            )}

            {phase === 'done' && outcome && (
              <div style={{ marginTop: '1rem' }}>
                {outcome.penalties && (
                  <p className="pill warn">
                    Elfmeterschießen {outcome.penalties[0]}:{outcome.penalties[1]}
                  </p>
                )}
                {outcome.motmId === game.userPlayerId && (
                  <p className="pill good">{t('match.motm')}</p>
                )}
                {outcome.userInputQuality !== null && (
                  <p className="tiny dim">
                    Ausführungsqualität deiner Aktionen:{' '}
                    {Math.round(outcome.userInputQuality * 100)}%
                  </p>
                )}

                {interview && !interviewReaction && (
                  <div style={{
                    marginTop: '0.8rem', padding: '0.7rem 0.8rem',
                    border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                    background: '#0c1729',
                  }}>
                    <div className="tiny dim">{t('match.interview')}</div>
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
                    <div className="tiny dim">{t('match.yourAnswer')}</div>
                    <div className="small" style={{ fontStyle: 'italic', marginBottom: '0.3rem' }}>
                      „{interviewReaction.label}"
                    </div>
                    <div className="small muted">{interviewReaction.reaction}</div>
                    <InterviewEffects effect={interviewReaction.effect} />
                  </div>
                )}

                <button className="primary" style={{ width: '100%', marginTop: '0.5rem' }}
                  onClick={leave}>
                  {interview && !interviewReaction ? t('match.skipInterview') : t('match.backToCareer')}
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
          leadership={user.attrs.leadership}
          onChoose={resolveHalftime}
        />
      )}

      {injury && <InjuryModal decision={injury} onChoose={resolveInjury} />}

      {moment && (
        <MomentOverlay
          event={moment}
          homeShort={homeClub.short}
          awayShort={awayClub.short}
          onSkip={() => {
            setMoment(null);
            if (finishedRef.current) { finishedRef.current = false; finalise(); }
          }}
        />
      )}
    </div>
  );
}

/**
 * Kurze Einblendung fuer die grossen Momente. Ein Klick ueberspringt sie,
 * sonst verschwindet sie von selbst.
 */
/**
 * Konfetti fuer ein eigenes Tor.
 *
 * Die Positionen kommen aus dem Index, nicht aus Math.random: so flackert
 * nichts bei einem Neuzeichnen, und die Feier sieht bei jedem Tor gleich
 * ordentlich aus. Reine CSS-Bewegung, keine Bilddatei.
 */
function Konfetti() {
  const farben = ['var(--accent)', 'var(--accent-2)', 'var(--accent-3)',
    'var(--accent-4)', 'var(--gold)'];
  return (
    <div className="konfetti" aria-hidden="true">
      {Array.from({ length: 26 }, (_, i) => (
        <i key={i} style={{
          left: `${(i * 37) % 100}%`,
          background: farben[i % farben.length],
          animationDelay: `${(i % 9) * 0.11}s`,
          animationDuration: `${1.5 + (i % 5) * 0.22}s`,
          width: i % 3 === 0 ? '5px' : '7px',
          height: i % 3 === 0 ? '9px' : '6px',
        }} />
      ))}
    </div>
  );
}

function MomentOverlay(
  { event, homeShort, awayShort, onSkip }:
  {
    event: LiveEvent; homeShort: string; awayShort: string; onSkip: () => void;
  },
) {
  const scored = event.type === 'goal' || event.type === 'ownGoal';
  const tone = event.user ? 'user' : scored ? 'goal' : 'warn';
  // Ein eigenes Tor ist der Augenblick, auf den die ganze Karriere zielt.
  // Der bekommt Strahlen, Konfetti und eine Druckwelle - alles andere die
  // ruhige Karte.
  const feier = event.user && event.type === 'goal';
  return (
    <div className={`moment ${tone} ${feier ? 'party' : ''}`} onClick={onSkip}>
      {feier && <div className="moment-rays" aria-hidden="true" />}
      {feier && <Konfetti />}
      <div className="moment-card">
        {feier && <span className="moment-wave" aria-hidden="true" />}
        <div className="moment-minute">{event.minute}.</div>
        <div className="moment-label">{t(MOMENT_KEY[event.type] ?? 'match.event')}</div>
        {event.score && (
          <div className="moment-score">
            {homeShort} <b>{event.score[0]}:{event.score[1]}</b> {awayShort}
          </div>
        )}
        <div className="moment-text">{event.text}</div>
      </div>
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
          <h2 style={{ margin: 0 }}>{t('match.injuryAt', { minute: decision.minute })}</h2>
          <span className={`pill ${sevTone}`}>{decision.severity}</span>
        </div>
        <p className="muted">
          Du bist angeschlagen. Der Betreuer schätzt bei sofortiger Auswechslung
          etwa {decision.estimatedDays} Tage Pause. Weiterspielen ist möglich,
          riskiert aber eine Verschlimmerung - und du bist geschwächt.
        </p>
        <div className="grid two" style={{ marginTop: '0.6rem' }}>
          <button className="primary" style={{ textAlign: 'left', padding: '0.7rem 0.85rem' }}
            onClick={() => onChoose('off')}>
            <div style={{ fontWeight: 680 }}>{t('match.halftimeSubOff')}</div>
            <div className="tiny" style={{ opacity: 0.85 }}>
              Sicher. Etwa {decision.estimatedDays} Tage Pause, normale Genesung.
            </div>
          </button>
          <button style={{ textAlign: 'left', padding: '0.7rem 0.85rem' }}
            onClick={() => onChoose('play')}>
            <div style={{ fontWeight: 680 }}>{t('match.halftimeFightOn')}</div>
            <div className="tiny muted">
              Weiterspielen mit Leistungseinbruch. Geht es gut, kommst du
              glimpflich davon - sonst wird es schlimmer.
            </div>
          </button>
        </div>
        {!decision.canSubstitute && (
          <p className="tiny dim" style={{ marginTop: '0.5rem' }}>
            Alle Wechsel sind aufgebraucht. Ein Ausscheiden liesse dein Team in
            Unterzahl zurück.
          </p>
        )}
      </div>
    </div>
  );
}

function HalftimeModal(
  { decision, homeShort, awayShort, leadership, onChoose }:
  {
    decision: HalftimeDecision; homeShort: string; awayShort: string;
    /** Fuehrungsstaerke des eigenen Spielers - sie traegt die Ansprache. */
    leadership: number;
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
          <h2 style={{ margin: 0 }}>{t('match.halftime')}</h2>
          <span className={`pill ${tone}`}>{homeShort} {h}:{a} {awayShort}</span>
        </div>
        <p className="muted" style={{ fontStyle: 'italic' }}>„{decision.coachMessage}"</p>
        {!decision.onPitch && (
          <p className="tiny dim">{t('match.halftimeFromBench')}</p>
        )}
        <div className="grid two" style={{ marginTop: '0.6rem' }}>
          {decision.options.map((o) => (
            <button key={o.id}
              style={{ textAlign: 'left', padding: '0.7rem 0.85rem', height: '100%' }}
              onClick={() => onChoose(o.id)}>
              <div style={{ fontWeight: 680, marginBottom: 2 }}>{o.label}</div>
              <div className="tiny muted">{o.description}</div>
              {/* Die Ansprache skaliert mit der eigenen Fuehrungsstaerke
                  (Faktor (Fuehrung - 55) / 100 in der Spielsimulation). Ohne
                  diesen Hinweis waehlt man blind: Bei niedriger Fuehrung ist
                  die Ansprache schwaecher als das schlichte Anlaufen. */}
              {o.leadership && (
                <div className="tiny" style={{ marginTop: 4, color: leadership >= 55 ? 'var(--good, #7fe6c4)' : 'var(--bad, #c86)' }}>
                  {t(leadership >= 70 ? 'match.rally.strong'
                    : leadership >= 55 ? 'match.rally.ok' : 'match.rally.weak',
                    { value: leadership })}
                </div>
              )}
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
          onClick={() => onChange(m)}>{t(MENTALITY_LABELS[m])}</span>
      ))}
    </div>
  );
}

function InterviewEffects({ effect }: { effect: InterviewOption['effect'] }) {
  const items: { label: string; value: number }[] = [
    { label: t('player.morale'), value: effect.morale ?? 0 },
    { label: t('player.coach'), value: effect.coach ?? 0 },
    { label: t('player.fans'), value: effect.fans ?? 0 },
    { label: t('player.image'), value: effect.image ?? 0 },
    { label: t('club.reputation'), value: effect.reputation ?? 0 },
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
    case 'attack': return t('match.stance.attackDesc');
    case 'contain': return t('match.stance.defendDesc');
    case 'conserve': return t('match.stance.holdDesc');
    default: return t('match.stance.balancedDesc');
  }
}

/** Sinnbild je Ereignisart - macht den Ticker auf einen Blick lesbar. */
function EventIcon({ type }: { type: LiveEvent['type'] }) {
  const common = { width: 13, height: 13, viewBox: '0 0 16 16', 'aria-hidden': true as const };
  switch (type) {
    case 'goal':
    case 'ownGoal':
      return (
        <svg {...common}><circle cx="8" cy="8" r="6.4" fill="#f4f7fb"
          stroke="rgba(0,0,0,0.4)" strokeWidth="1" />
        <path d="M8 3.6 l2.6 1.9 -1 3.1 h-3.2 l-1 -3.1 Z" fill="#16253d" /></svg>
      );
    case 'yellow':
      return <svg {...common}><rect x="5" y="2.5" width="6" height="11" rx="1" fill="#e5cd7c" /></svg>;
    case 'red':
    case 'secondYellow':
      return <svg {...common}><rect x="5" y="2.5" width="6" height="11" rx="1" fill="#e2697a" /></svg>;
    case 'sub':
      return (
        <svg {...common}><path d="M3 5.5 h8 M9 3 l2.5 2.5 L9 8 M13 10.5 h-8 M7 8 l-2.5 2.5 L7 13"
          stroke="var(--accent-2)" strokeWidth="1.4" fill="none"
          strokeLinecap="round" strokeLinejoin="round" /></svg>
      );
    case 'injury':
      return (
        <svg {...common}><path d="M8 3 v10 M3 8 h10" stroke="var(--bad)"
          strokeWidth="2.4" strokeLinecap="round" /></svg>
      );
    case 'save':
      return (
        <svg {...common}><path d="M2.5 12 q5.5 -8 11 0" stroke="var(--accent-2)"
          strokeWidth="1.6" fill="none" strokeLinecap="round" /></svg>
      );
    case 'miss':
      return (
        <svg {...common}><circle cx="8" cy="8" r="5.4" fill="none"
          stroke="var(--dim)" strokeWidth="1.4" />
        <path d="M5.5 5.5 l5 5" stroke="var(--dim)" strokeWidth="1.4"
          strokeLinecap="round" /></svg>
      );
    case 'chance':
      return (
        <svg {...common}><path d="M8 2.5 l1.7 3.9 4.1 .4 -3.1 2.8 .9 4.1 L8 11.6 4.4 13.7 l.9 -4.1 -3.1 -2.8 4.1 -.4 Z"
          fill="none" stroke="var(--warn)" strokeWidth="1.2" strokeLinejoin="round" /></svg>
      );
    case 'penaltyAwarded':
    case 'penaltyMiss':
      return (
        <svg {...common}><circle cx="8" cy="8" r="2" fill="var(--warn)" />
        <rect x="2" y="3" width="12" height="10" rx="1" fill="none"
          stroke="var(--warn)" strokeWidth="1.2" /></svg>
      );
    default:
      return <span className="ev-dot" />;
  }
}

function EventRow({ event, fresh }: { event: LiveEvent; fresh?: boolean }) {
  const cls = event.type === 'goal' || event.type === 'ownGoal' ? 'goal'
    : event.type === 'yellow' || event.type === 'red' || event.type === 'secondYellow' ? 'card'
    : event.type === 'save' || event.type === 'miss' || event.type === 'chance' ? 'chance' : '';
  return (
    <div className={`ev ${cls} ${event.user ? 'user' : ''} ${fresh ? 'fresh' : ''}`}>
      <span className="min">{event.minute > 0 ? `${event.minute}'` : ''}</span>
      <span className="ev-icon"><EventIcon type={event.type} /></span>
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
    { label: t('stats.shots'), h: home.shots, a: away.shots },
    { label: 'aufs Tor', h: home.shotsOnTarget, a: away.shotsOnTarget },
  ];
  if (full) {
    // Ballbesitz aus dem Passvolumen - erst nach Abpfiff vollstaendig.
    const totalPass = home.passes + away.passes;
    if (totalPass > 0) {
      const hp = Math.round((home.passes / totalPass) * 100);
      rows.push({ label: t('match.possession'), h: hp, a: 100 - hp, pct: true });
    }
    if (home.fouls + away.fouls > 0) rows.push({ label: t('match.fouls'), h: home.fouls, a: away.fouls });
    if (home.cards + away.cards > 0) rows.push({ label: t('match.cards'), h: home.cards, a: away.cards });
  }
  return (
    <Panel title={t('ms.matchStats')}>
      <div className="row between" style={{ marginBottom: '0.55rem' }}>
        <span className="tiny" style={{ color: 'var(--accent)', fontWeight: 700 }}>{homeShort}</span>
        <span className="tiny dim">{full ? t('match.finalScore') : 'live'}</span>
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

/**
 * Direkter Vergleich der Mannschaftsstaerken vor dem Anpfiff. Die Werte
 * berechnet die Aufstellung ohnehin fuer die Simulation - sichtbar gemacht
 * beantworten sie die Frage, die man sich vor jedem Spiel stellt: Wie stark
 * ist der Gegner wirklich?
 */
function StrengthCompare(
  { home, away, homeShort, awayShort }:
  {
    home: { attack: number; midfield: number; defence: number; keeper: number };
    away: { attack: number; midfield: number; defence: number; keeper: number };
    homeShort: string; awayShort: string;
  },
) {
  const rows = [
    { label: t('squad.attack'), h: home.attack, a: away.attack },
    { label: t('squad.midfield'), h: home.midfield, a: away.midfield },
    { label: t('squad.defence'), h: home.defence, a: away.defence },
    { label: t('match.keeper'), h: home.keeper, a: away.keeper },
  ];
  return (
    <div>
      <div className="row between" style={{ marginBottom: '0.4rem' }}>
        <span className="tiny" style={{ color: 'var(--accent)', fontWeight: 700 }}>{homeShort}</span>
        <span className="tiny" style={{ color: 'var(--accent-2)', fontWeight: 700 }}>{awayShort}</span>
      </div>
      {rows.map((r) => {
        const h = Math.round(r.h);
        const a = Math.round(r.a);
        return (
          <div className="strength-row" key={r.label}>
            <span className="mono tiny" style={{ textAlign: 'right' }}>{h}</span>
            <div className="strength-bar home">
              <span style={{ width: `${h}%`, background: 'var(--accent)' }} />
            </div>
            <span className="strength-label">{r.label}</span>
            <div className="strength-bar">
              <span style={{ width: `${a}%`, background: 'var(--accent-2)' }} />
            </div>
            <span className="mono tiny">{a}</span>
          </div>
        );
      })}
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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { autoResolveChallenge } from '../../engine/ballAction';
import { formatDate } from '../../engine/date';
import { finishUserMatch, prepareUserMatch } from '../../engine/game';
import { MatchEngine, type MatchOutcome } from '../../engine/matchEngine';
import type { Challenge, ChallengeResult, LiveEvent } from '../../engine/matchTypes';
import { Rng } from '../../engine/rng';
import { DIFFICULTY_SETTINGS } from '../../engine/types';
import { advanceCalendar, saveCurrent } from '../../state/actions';
import { commit, setState, useAppState } from '../../state/store';
import { Empty, Panel, Pill, rating, ratingColor, shortName } from '../components';
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
  const [challenge, setChallenge] = useState<Challenge | null>(null);
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

  const finalise = useCallback(() => {
    const engine = engineRef.current;
    if (!engine || !matchId) return;
    const result = engine.finish();
    if (rngRef.current) game.rngState = rngRef.current.state;
    finishUserMatch(game, matchId, result);
    setOutcome(result);
    setPhase('done');
    commit();
    void saveCurrent(true);
  }, [game, matchId]);

  // Spieluhr
  useEffect(() => {
    if (phase !== 'running' || paused || challenge) return;
    const engine = engineRef.current;
    if (!engine) return;

    const timer = window.setInterval(() => {
      const step = engine.step();
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
  }, [phase, paused, challenge, speedIndex, finalise]);

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
        <div className="team">{homeClub.name}</div>
        <div className="center">
          <div className="score">{score[0]}:{score[1]}</div>
          <div className="clock">
            {phase === 'setup' ? formatDate(match.date)
              : phase === 'done' ? 'Abpfiff'
              : `${engine?.minute ?? 0}. Minute`}
          </div>
        </div>
        <div className="team away">{awayClub.name}</div>
      </div>

      <div className="row between" style={{ margin: '0.7rem 0' }}>
        <div className="row">
          <Pill>{competition?.name}</Pill>
          <Pill>{match.roundName ?? `${match.matchday}. Spieltag`}</Pill>
          <Pill>{homeClub.stadiumName}</Pill>
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
                <button className="primary" style={{ width: '100%', marginTop: '0.5rem' }}
                  onClick={leave}>
                  Zurueck zur Karriere
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
    </div>
  );
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

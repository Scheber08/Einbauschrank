import { useState } from 'react';
import { computeOverall } from '../engine/attributes';
import { ageOn, formatDate, seasonLabel } from '../engine/date';
import { nextUserMatch, userClub, userLeague } from '../engine/game';
import type { SeasonReport } from '../engine/season';
import type { TrainingOutcome } from '../engine/development';
import { advanceCalendar, backToMenu, saveCurrent } from '../state/actions';
import { setState, useAppState, type CareerTab } from '../state/store';
import { Bar, Meter, initials, money } from './components';
import CalendarTab from './tabs/CalendarTab';
import ChronicleTab from './tabs/ChronicleTab';
import NewsTab from './tabs/NewsTab';
import OverviewTab from './tabs/OverviewTab';
import PlayerTab from './tabs/PlayerTab';
import SquadTab from './tabs/SquadTab';
import StatsTab from './tabs/StatsTab';
import TableTab from './tabs/TableTab';
import TrainingTab from './tabs/TrainingTab';
import TransfersTab from './tabs/TransfersTab';

const TABS: { key: CareerTab; label: string }[] = [
  { key: 'overview', label: 'Uebersicht' },
  { key: 'calendar', label: 'Kalender' },
  { key: 'training', label: 'Training' },
  { key: 'player', label: 'Mein Spieler' },
  { key: 'squad', label: 'Mannschaft' },
  { key: 'table', label: 'Wettbewerbe' },
  { key: 'stats', label: 'Statistiken' },
  { key: 'transfers', label: 'Transfers' },
  { key: 'news', label: 'Nachrichten' },
  { key: 'chronicle', label: 'Chronik' },
];

export default function CareerShell() {
  const app = useAppState();
  const game = app.game!;
  const [seasonReport, setSeasonReport] = useState<SeasonReport | null>(null);
  const [training, setTraining] = useState<TrainingOutcome | null>(null);

  const user = game.players[game.userPlayerId];
  const club = userClub(game);
  const league = userLeague(game);
  const upcoming = nextUserMatch(game);
  const unread = game.news.filter((n) => !n.read).length;
  const ability = computeOverall(user.attrs, user.position);

  function advance(days = 60) {
    const result = advanceCalendar(days);
    if (result.matchToPlay) {
      setState({ screen: 'match' });
      return;
    }
    if (result.seasonReport) setSeasonReport(result.seasonReport);
    else if (result.training) setTraining(result.training);
  }

  return (
    <div className="career">
      <aside className="sidebar">
        <section className="panel identity">
          <div className="avatar" style={{ background: club?.colors[0] ?? '#37d67a' }}>
            {initials(user.firstName, user.lastName)}
          </div>
          <div className="name">{user.firstName} {user.lastName}</div>
          <div className="small muted">
            {user.position} - {ageOn(user.birthDate, game.date)} Jahre
          </div>
          <div className="small" style={{ color: club?.colors[0] }}>{club?.name ?? 'Vereinslos'}</div>
          <div className="tiny dim">{league?.name}</div>

          <div className="row between" style={{ marginTop: '0.7rem', marginBottom: '0.3rem' }}>
            <span className="tiny dim">Gesamtstaerke</span>
            <span className="mono" style={{ fontWeight: 700 }}>{ability}</span>
          </div>
          <Bar value={ability} />
          {game.difficulty !== 'schwer' && game.difficulty !== 'simulation' && (
            <div className="tiny dim" style={{ marginTop: 4 }}>Potenzial bis {user.potential}</div>
          )}
        </section>

        <section className="panel">
          <Meter label="Form" value={user.form} />
          <Meter label="Fitness" value={user.fitness} />
          <Meter label="Moral" value={user.morale} />
          <Meter label="Trainer" value={game.coachRelation} />
          {user.injury && (
            <div className="pill bad" style={{ marginTop: '0.4rem' }}>
              {user.injury.name} - noch {user.injury.daysOut} Tage
            </div>
          )}
          {user.suspension > 0 && (
            <div className="pill warn" style={{ marginTop: '0.4rem' }}>
              Gesperrt fuer {user.suspension} Spiele
            </div>
          )}
        </section>

        <nav className="nav panel" style={{ padding: '0.4rem' }}>
          {TABS.map((tab) => (
            <button key={tab.key}
              className={app.tab === tab.key ? 'active' : ''}
              onClick={() => setState({ tab: tab.key })}>
              {tab.label}
              {tab.key === 'news' && unread > 0 && (
                <span className="pill" style={{ marginLeft: 6 }}>{unread}</span>
              )}
              {tab.key === 'transfers' && game.offers.length > 0 && (
                <span className="pill good" style={{ marginLeft: 6 }}>{game.offers.length}</span>
              )}
            </button>
          ))}
        </nav>

        <section className="panel">
          <div className="tiny dim">{formatDate(game.date)}</div>
          <div className="small muted" style={{ marginBottom: '0.5rem' }}>
            Saison {seasonLabel(game.season)}
          </div>
          <button className="primary" style={{ width: '100%' }} onClick={() => advance()}>
            {upcoming ? 'Weiter bis zum Spiel' : 'Weiter'}
          </button>
          <div className="row" style={{ marginTop: '0.4rem' }}>
            <button className="small ghost" style={{ flex: 1 }} onClick={() => advance(1)}>+1 Tag</button>
            <button className="small ghost" style={{ flex: 1 }} onClick={() => void saveCurrent()}>Speichern</button>
          </div>
          <button className="small ghost" style={{ width: '100%', marginTop: '0.35rem' }}
            onClick={() => { void saveCurrent(true); backToMenu(); }}>
            Hauptmenue
          </button>
          <div className="tiny dim" style={{ marginTop: '0.4rem' }}>
            Marktwert {money(user.marketValue)}
          </div>
        </section>
      </aside>

      <main>
        {app.tab === 'overview' && <OverviewTab />}
        {app.tab === 'calendar' && <CalendarTab />}
        {app.tab === 'training' && <TrainingTab />}
        {app.tab === 'player' && <PlayerTab />}
        {app.tab === 'squad' && <SquadTab />}
        {app.tab === 'table' && <TableTab />}
        {app.tab === 'stats' && <StatsTab />}
        {app.tab === 'transfers' && <TransfersTab />}
        {app.tab === 'news' && <NewsTab />}
        {app.tab === 'chronicle' && <ChronicleTab />}
      </main>

      {training && <TrainingModal outcome={training} onClose={() => setTraining(null)} />}
      {seasonReport && <SeasonModal report={seasonReport} onClose={() => setSeasonReport(null)} />}
    </div>
  );
}

function TrainingModal({ outcome, onClose }: { outcome: TrainingOutcome; onClose: () => void }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Trainingswoche</h2>
        {outcome.gains.length === 0 && (
          <p className="muted">
            Diese Woche hat keine messbaren Fortschritte gebracht. Das ist normal -
            Entwicklung braucht Zeit, Einsatzzeiten und Geduld.
          </p>
        )}
        {outcome.gains.length > 0 && (
          <>
            <p className="muted">Diese Woche haben sich folgende Werte verbessert:</p>
            <ul>
              {outcome.gains.map((g) => (
                <li key={g.attr}>
                  {g.label} <strong style={{ color: '#7ce6a5' }}>+{g.amount}</strong>
                </li>
              ))}
            </ul>
          </>
        )}
        {outcome.overallAfter > outcome.overallBefore && (
          <p>
            Gesamtstaerke: {outcome.overallBefore} {'->'}{' '}
            <strong style={{ color: '#7ce6a5' }}>{outcome.overallAfter}</strong>
          </p>
        )}
        {outcome.injured && (
          <p style={{ color: '#ff9aa6' }}>
            Verletzung im Training: {outcome.injured.name}, etwa {outcome.injured.totalDays} Tage Pause.
          </p>
        )}
        <button className="primary" onClick={onClose}>Weiter</button>
      </div>
    </div>
  );
}

function SeasonModal({ report, onClose }: { report: SeasonReport; onClose: () => void }) {
  const game = useAppState().game!;
  const summary = report.userSummary;
  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2>Saison {seasonLabel(report.season)} abgeschlossen</h2>

        {summary && (
          <div className="grid four" style={{ margin: '0.8rem 0' }}>
            <div className="stat"><div className="value">{summary.appearances}</div><div className="label">Spiele</div></div>
            <div className="stat"><div className="value">{summary.goals}</div><div className="label">Tore</div></div>
            <div className="stat"><div className="value">{summary.assists}</div><div className="label">Vorlagen</div></div>
            <div className="stat">
              <div className="value">{summary.avgRating.toFixed(2).replace('.', ',')}</div>
              <div className="label">Note</div>
            </div>
          </div>
        )}

        <h4>Meister</h4>
        <ul className="small">
          {report.champions.map((c) => (
            <li key={c.competitionId}>
              {game.competitions[c.competitionId]?.name}: <strong>{game.clubs[c.clubId]?.name}</strong>
            </li>
          ))}
        </ul>

        {report.awards.filter((a) => a.playerId === game.userPlayerId).length > 0 && (
          <>
            <h4>Deine Auszeichnungen</h4>
            <ul className="small">
              {report.awards.filter((a) => a.playerId === game.userPlayerId).map((a) => (
                <li key={a.id} style={{ color: '#f5c542' }}>{a.label} ({a.value})</li>
              ))}
            </ul>
          </>
        )}

        {report.promoted.length > 0 && (
          <>
            <h4>Aufsteiger</h4>
            <p className="small muted">
              {report.promoted.map((p) => game.clubs[p.clubId]?.name).filter(Boolean).join(', ')}
            </p>
          </>
        )}
        {report.relegated.length > 0 && (
          <>
            <h4>Absteiger</h4>
            <p className="small muted">
              {report.relegated.map((p) => game.clubs[p.clubId]?.name).filter(Boolean).join(', ')}
            </p>
          </>
        )}

        {game.offers.length > 0 && (
          <p className="pill good" style={{ marginTop: '0.6rem' }}>
            {game.offers.length} neue Vertragsangebote im Bereich Transfers
          </p>
        )}

        <div className="row" style={{ marginTop: '1rem' }}>
          <button className="primary" onClick={onClose}>Neue Saison beginnen</button>
        </div>
      </div>
    </div>
  );
}

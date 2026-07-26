import { useState } from 'react';
import { computeOverall } from '../engine/attributes';
import { COUNTRY_BY_ID } from '../engine/countries';
import { ageOn, formatDate, seasonLabel } from '../engine/date';
import { nextUserMatch, userClub, userLeague } from '../engine/game';
import type { SeasonReport } from '../engine/season';
import type { TrainingOutcome } from '../engine/development';
import type { LifeEvent, LifeOption } from '../engine/events';
import type { WncResult } from '../engine/types';
import { clubSponsors } from '../engine/identity';
import { advanceCalendar, applyLifeEvent, backToMenu, saveCurrent } from '../state/actions';
import { setState, useAppState, type CareerTab } from '../state/store';
import ClubCrest from './ClubCrest';
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
  const [lifeEvent, setLifeEvent] = useState<LifeEvent | null>(null);
  const [wnc, setWnc] = useState<WncResult | null>(null);

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
    // Der World Nations Cup faellt mit dem Saisonende zusammen: beide anzeigen.
    if (result.wnc) setWnc(result.wnc);
    if (result.lifeEvent) setLifeEvent(result.lifeEvent);
    else if (result.seasonReport) setSeasonReport(result.seasonReport);
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
          <div className="row" style={{ gap: '0.45rem', alignItems: 'center', justifyContent: 'center' }}>
            {club && <ClubCrest club={club} size={26} />}
            <div className="small" style={{ color: club?.colors[0] }}>{club?.name ?? 'Vereinslos'}</div>
          </div>
          <div className="tiny dim">{league?.name}</div>
          {club && (
            <div className="tiny dim" style={{ marginTop: 2 }}>
              {club.stadiumName} - Sponsor {clubSponsors(club).shirt}
            </div>
          )}

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
          <Meter label="Fans" value={game.fanRelation} />
          <Meter label="Oeffentliches Image" value={game.publicImage} />
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
          {(game.nationalNominated || game.nationalCaps > 0) && (
            <div style={{ marginTop: '0.5rem' }}>
              <div className="tiny dim">Nationalmannschaft</div>
              <div className="row" style={{ gap: '0.35rem', marginTop: 2 }}>
                {game.nationalNominated && <span className="pill good">Nominiert</span>}
                {game.nationalCaps > 0 && (
                  <span className="pill">{game.nationalCaps} Spiele, {game.nationalGoals} Tore</span>
                )}
              </div>
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
          {game.retirement ? (
            <div className="pill good" style={{ width: '100%', textAlign: 'center' }}>
              Laufbahn beendet
            </div>
          ) : (
            <button className="primary" style={{ width: '100%' }} onClick={() => advance()}>
              {upcoming ? 'Weiter bis zum Spiel' : 'Weiter'}
            </button>
          )}
          <div className="row" style={{ marginTop: '0.4rem' }}>
            {!game.retirement && (
              <button className="small ghost" style={{ flex: 1 }} onClick={() => advance(1)}>+1 Tag</button>
            )}
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

      {wnc && <WncModal result={wnc} nation={COUNTRY_BY_ID[user.nationality]?.name}
        onClose={() => setWnc(null)} />}
      {lifeEvent && <LifeEventModal event={lifeEvent} onClose={() => setLifeEvent(null)} />}
      {training && <TrainingModal outcome={training} onClose={() => setTraining(null)} />}
      {seasonReport && <SeasonModal report={seasonReport} onClose={() => setSeasonReport(null)} />}
    </div>
  );
}

function WncModal(
  { result, nation, onClose }:
  { result: WncResult; nation?: string; onClose: () => void },
) {
  const won = result.userNominated && result.userNationReached === 'Sieg';
  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2>World Nations Cup {result.year}</h2>
        <p style={{ fontSize: '1.1rem' }}>
          Weltmeister: <strong style={{ color: '#f5c542' }}>{result.championName}</strong>
          <span className="muted"> (Finale gegen {result.runnerUpName})</span>
        </p>
        {result.userNominated ? (
          <div style={{ marginTop: '0.6rem' }}>
            {won ? (
              <p style={{ color: '#37d67a', fontWeight: 680 }}>
                Du bist Weltmeister mit {nation}! Der groesste Erfolg deiner Karriere.
              </p>
            ) : (
              <p>
                Mit {nation} bis zum <strong>{result.userNationReached}</strong> gekommen.
              </p>
            )}
            <div className="row" style={{ gap: '0.35rem' }}>
              <span className="pill">{result.userCaps} Laenderspiele</span>
              {result.userGoals > 0 && <span className="pill good">{result.userGoals} Tore</span>}
            </div>
          </div>
        ) : (
          <p className="muted" style={{ marginTop: '0.6rem' }}>
            Du warst diesmal nicht dabei. Mit starken Leistungen und guter Form
            rueckst du in den Kader deiner Nation.
          </p>
        )}
        <button className="primary" style={{ marginTop: '1rem' }} onClick={onClose}>Weiter</button>
      </div>
    </div>
  );
}

function LifeEventModal({ event, onClose }: { event: LifeEvent; onClose: () => void }) {
  const [chosen, setChosen] = useState<LifeOption | null>(null);

  function choose(id: string) {
    setChosen(applyLifeEvent(event, id));
  }

  const effectItems = (o: LifeOption) => ([
    { label: 'Moral', value: o.effect.morale ?? 0 },
    { label: 'Fitness', value: o.effect.fitness ?? 0 },
    { label: 'Spielpraxis', value: o.effect.sharpness ?? 0 },
    { label: 'Image', value: o.effect.image ?? 0 },
    { label: 'Fans', value: o.effect.fans ?? 0 },
    { label: 'Trainer', value: o.effect.coach ?? 0 },
  ].filter((i) => i.value !== 0));

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="row between" style={{ marginBottom: '0.3rem' }}>
          <h2 style={{ margin: 0 }}>{event.title}</h2>
          <span className="pill">{event.category}</span>
        </div>
        <p className="muted">{event.description}</p>

        {!chosen && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.6rem' }}>
            {event.options.map((o) => (
              <button key={o.id} style={{ textAlign: 'left', padding: '0.6rem 0.8rem' }}
                onClick={() => choose(o.id)}>
                <div style={{ fontWeight: 660 }}>{o.label}</div>
                <div className="tiny muted">{o.description}</div>
              </button>
            ))}
          </div>
        )}

        {chosen && (
          <div style={{ marginTop: '0.6rem' }}>
            <div className="small" style={{ fontStyle: 'italic', marginBottom: '0.3rem' }}>
              „{chosen.label}"
            </div>
            <div className="row" style={{ gap: '0.35rem', flexWrap: 'wrap' }}>
              {effectItems(chosen).map((i) => (
                <span key={i.label} className={`pill ${i.value > 0 ? 'good' : 'bad'}`}>
                  {i.label} {i.value > 0 ? `+${i.value}` : i.value}
                </span>
              ))}
              {effectItems(chosen).length === 0 && <span className="tiny dim">Keine spuerbaren Folgen.</span>}
            </div>
            <button className="primary" style={{ marginTop: '0.8rem' }} onClick={onClose}>Weiter</button>
          </div>
        )}
      </div>
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

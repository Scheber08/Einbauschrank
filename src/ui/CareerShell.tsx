import { DIFFICULTY_SETTINGS } from '../engine/types';
import { useState } from 'react';
import { computeOverall } from '../engine/attributes';
import { nationName } from '../engine/nations';
import { t, tDecimal, tn, tNumber } from '../i18n';
import { useLocale } from '../i18n/useLocale';
import { ageOn, formatDate, seasonLabel } from '../engine/date';
import { nextUserMatch, userClub, userLeague } from '../engine/game';
import type { SeasonReport } from '../engine/season';
import type { TrainingOutcome } from '../engine/development';
import type { LifeEvent, LifeOption } from '../engine/events';
import type { WncResult } from '../engine/types';
import { clubSponsors } from '../engine/identity';
import {
  advanceCalendar, advanceToMatch, applyLifeEvent, backToMenu, saveCurrent,
} from '../state/actions';
import {
  setState, useAppState, type CareerTab, type SkipSummary,
} from '../state/store';
import ClubCrest from './ClubCrest';
import { Bar, Meter, money, Pill, rating, ratingColor } from './components';
import PlayerAvatar from './PlayerAvatar';
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
import NavIcon from './NavIcon';

const TABS: { key: CareerTab; label: string }[] = [
  { key: 'overview', label: 'tab.overview' },
  { key: 'calendar', label: 'tab.calendar' },
  { key: 'training', label: 'tab.training' },
  { key: 'player', label: 'tab.player' },
  { key: 'squad', label: 'tab.squad' },
  { key: 'table', label: 'tab.competitions' },
  { key: 'stats', label: 'tab.stats' },
  { key: 'transfers', label: 'tab.transfers' },
  { key: 'news', label: 'tab.news' },
  { key: 'chronicle', label: 'tab.chronicle' },
];

export default function CareerShell() {
  // Der Rahmen zeichnet die Reiter und die Seitenleiste - ein Sprachwechsel
  // muss hier ankommen, sonst bleibt die halbe Ansicht stehen.
  useLocale();
  const app = useAppState();
  const game = app.game!;
  const [seasonReport, setSeasonReport] = useState<SeasonReport | null>(null);
  const [training, setTraining] = useState<TrainingOutcome | null>(null);
  const [lifeEvent, setLifeEvent] = useState<LifeEvent | null>(null);
  /** Sammelbericht eines Kalendersprungs. */
  const skip = app.skipReport;
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

  /** Ohne Trainingsberichte und Zwischenereignisse bis zum Anpfiff. */
  function skipToMatch() {
    const result = advanceToMatch();
    if (result.matchToPlay) {
      setState({ screen: 'match' });
      return;
    }
    if (result.wnc) setWnc(result.wnc);
    if (result.seasonReport) setSeasonReport(result.seasonReport);
  }

  return (
    <div className="career">
      {/* Kopfleiste ueber beiden Spalten: Verein, Datum und die Kennzahlen,
          die man staendig im Blick haben will. In den Vorbildern aus den
          fruehen 2000ern steht genau das immer oben. */}
      <header className="topbar">
        <div className="club">
          {club && <ClubCrest club={club} size={34} />}
          <div style={{ minWidth: 0 }}>
            <div className="club-name" style={{ color: club?.colors[0] }}>
              {club?.name ?? t('club.none')}
            </div>
            <div className="league">{league?.name}</div>
          </div>
        </div>
        <div className="topbar-figures">
          <div className="topbar-figure">
            <div className="v">{formatDate(game.date)}</div>
            <div className="k">{t('shell.seasonLabel', { label: seasonLabel(game.season) })}</div>
          </div>
          <div className="topbar-figure">
            <div className="v">{ability}</div>
            <div className="k">{t('player.overall')}</div>
          </div>
          <div className="topbar-figure">
            <div className="v">{money(user.marketValue)}</div>
            <div className="k">{t('player.marketValue')}</div>
          </div>
        </div>
      </header>

      <aside className="sidebar">
        <section className="panel identity">
          <PlayerAvatar
            look={user.appearance}
            jersey={club?.colors[0]}
            trim={club?.colors[1]}
            size={92}
            name={`${user.firstName} ${user.lastName}`}
          />
          <div className="name">{user.firstName} {user.lastName}</div>
          <div className="small muted">
            {user.position} - {t('player.years', {
              n: ageOn(user.birthDate, game.date),
            })}
          </div>
          <div className="row" style={{ gap: '0.45rem', alignItems: 'center', justifyContent: 'center' }}>
            {club && <ClubCrest club={club} size={26} />}
            <div className="small" style={{ color: club?.colors[0] }}>
              {club?.name ?? t('club.none')}
            </div>
          </div>
          <div className="tiny dim">{league?.name}</div>
          {club && (
            <div className="tiny dim" style={{ marginTop: 2 }}>
              {t('shell.sponsorLine', {
                stadium: club.stadiumName, sponsor: clubSponsors(club).shirt,
              })}
            </div>
          )}

          <div className="row between" style={{ marginTop: '0.7rem', marginBottom: '0.3rem' }}>
            <span className="tiny dim">{t('player.overall')}</span>
            <span className="mono" style={{ fontWeight: 700 }}>{ability}</span>
          </div>
          <Bar value={ability} />
          {/* Einzige Quelle ist die Schwierigkeitseinstellung - nicht eine hier
              wiederholte Aufzaehlung der Stufen. */}
          {DIFFICULTY_SETTINGS[game.difficulty].showPotential && (
            <div className="tiny dim" style={{ marginTop: 4 }}>
              {t('player.potentialUpTo', { value: user.potential })}
            </div>
          )}
        </section>

        <section className="panel">
          <Meter label={t('player.form')} value={user.form} />
          <Meter label={t('player.fitness')} value={user.fitness} />
          <Meter label={t('player.morale')} value={user.morale} />
          <Meter label={t('player.coach')} value={game.coachRelation} />
          <Meter label={t('player.fans')} value={game.fanRelation} />
          <Meter label={t('player.image')} value={game.publicImage} />
          {user.injury && (
            <div className="pill bad" style={{ marginTop: '0.4rem' }}>
              {t('shell.injuryDaysLeft', { injury: t(user.injury.name), n: user.injury.daysOut })}
            </div>
          )}
          {user.suspension > 0 && (
            <div className="pill warn" style={{ marginTop: '0.4rem' }}>
              {t('shell.suspendedGames', { n: user.suspension })}
            </div>
          )}
          {(game.nationalNominated || game.nationalCaps > 0) && (
            <div style={{ marginTop: '0.5rem' }}>
              <div className="tiny dim">{t('shell.nationalTeam')}</div>
              <div className="row" style={{ gap: '0.35rem', marginTop: 2 }}>
                {game.nationalNominated && <span className="pill good">{t('shell.nominated')}</span>}
                {game.nationalCaps > 0 && (
                  <span className="pill">
                    {t('shell.capsAndGoals', {
                      caps: game.nationalCaps, goals: game.nationalGoals,
                    })}
                  </span>
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
              <NavIcon icon={tab.key} />
              <span className="nav-text">{t(tab.label)}</span>
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
            {t('shell.seasonLabel', { label: seasonLabel(game.season) })}
          </div>
          {game.retirement ? (
            <div className="pill good" style={{ width: '100%', textAlign: 'center' }}>
              {t('shell.careerOver')}
            </div>
          ) : (
            <>
              <button className="primary" style={{ width: '100%' }} onClick={() => advance()}>
                {upcoming ? t('shell.advanceToMatch') : t('shell.advance')}
              </button>
              {upcoming && (
                <button className="small" style={{ width: '100%', marginTop: '0.35rem' }}
                  onClick={skipToMatch}
                  title={t('shell.skipHint')}>
                  {t('shell.skipToKickoff')}
                </button>
              )}
            </>
          )}
          <div className="row" style={{ marginTop: '0.4rem' }}>
            {!game.retirement && (
              <button className="small ghost" style={{ flex: 1 }}
                onClick={() => advance(1)}>{t('shell.oneDay')}</button>
            )}
            <button className="small ghost" style={{ flex: 1 }}
              onClick={() => void saveCurrent()}>{t('common.save')}</button>
          </div>
          <button className="small ghost" style={{ width: '100%', marginTop: '0.35rem' }}
            onClick={() => { void saveCurrent(true); backToMenu(); }}>
            {t('shell.mainMenu')}
          </button>
          <div className="tiny dim" style={{ marginTop: '0.4rem' }}>
            {t('shell.marketValue', { value: money(user.marketValue) })}
          </div>
        </section>
      </aside>

      {/* Der key sorgt dafuer, dass beim Wechsel neu gemountet und damit die
          Einblendung erneut abgespielt wird - der Wechsel wird sichtbar. */}
      <main key={app.tab} className="tab-pane">
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

      {wnc && <WncModal result={wnc}
        nation={nationName(user.nationality)}
        onClose={() => setWnc(null)} />}
      {skip && (
        <SkipModal bericht={skip} onClose={() => {
          // Erst den Bericht schliessen, dann das, was den Sprung beendet
          // hat - sonst liegen zwei Dialoge uebereinander.
          setState({ skipReport: null });
          if (skip.matchToPlay) { setState({ screen: 'match' }); return; }
          if (skip.lifeEvent) setLifeEvent(skip.lifeEvent);
          else if (skip.seasonReport) setSeasonReport(skip.seasonReport);
          if (skip.wnc) setWnc(skip.wnc);
        }} />
      )}
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
  const won = result.userNominated && result.userNationReached === 'won';
  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2>World Nations Cup {result.year}</h2>
        <p style={{ fontSize: '1.1rem' }}>
          {t('wnc.champion')}: 
          <strong style={{ color: '#e5cd7c' }}>{result.championName}</strong>
          <span className="muted">
            {' '}({t('wnc.finalAgainst', { team: result.runnerUpName })})
          </span>
        </p>
        {result.userNominated ? (
          <div style={{ marginTop: '0.6rem' }}>
            {won ? (
              <p style={{ color: '#43d99a', fontWeight: 680 }}>
                {t('wnc.youWon', { nation: nation ?? '' })}
              </p>
            ) : (
              <p>
                {t('wnc.youReached', {
                  nation: nation ?? '',
                  round: t(`wnc.round.${result.userNationReached ?? 'group'}`),
                })}
              </p>
            )}
            <div className="row" style={{ gap: '0.35rem' }}>
              <span className="pill">{t('wnc.caps', { n: result.userCaps })}</span>
              {result.userGoals > 0 && (
                <span className="pill good">{t('wnc.goals', { n: result.userGoals })}</span>
              )}
            </div>
          </div>
        ) : (
          <p className="muted" style={{ marginTop: '0.6rem' }}>
            {t('wnc.notCalled')}
          </p>
        )}
        <button className="primary" style={{ marginTop: '1rem' }}
          onClick={onClose}>{t('shell.advance')}</button>
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
    { label: t('player.morale'), value: o.effect.morale ?? 0 },
    { label: t('player.fitness'), value: o.effect.fitness ?? 0 },
    { label: t('training.sharpness'), value: o.effect.sharpness ?? 0 },
    { label: t('player.image'), value: o.effect.image ?? 0 },
    { label: t('player.fans'), value: o.effect.fans ?? 0 },
    { label: t('player.coach'), value: o.effect.coach ?? 0 },
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
              {effectItems(chosen).length === 0 && (
                <span className="tiny dim">{t('event.noEffect')}</span>
              )}
            </div>
            <button className="primary" style={{ marginTop: '0.8rem' }}
              onClick={onClose}>{t('shell.advance')}</button>
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
        <h2>{t('training.week')}</h2>
        {outcome.gains.length === 0 && (
          <p className="muted">{t('training.noGains')}</p>
        )}
        {outcome.gains.length > 0 && (
          <>
            <p className="muted">{t('training.gains')}</p>
            <ul>
              {outcome.gains.map((g) => (
                <li key={g.attr}>
                  {g.label} <strong style={{ color: '#7fe6c4' }}>+{g.amount}</strong>
                </li>
              ))}
            </ul>
          </>
        )}
        {outcome.overallAfter > outcome.overallBefore && (
          <p>
            {t('player.overall')}: {outcome.overallBefore} {'->'}{' '}
            <strong style={{ color: '#7fe6c4' }}>{outcome.overallAfter}</strong>
          </p>
        )}
        {outcome.injured && (
          <p style={{ color: '#ff9aa6' }}>
            {t('training.injured', {
              injury: t(outcome.injured.name), n: outcome.injured.totalDays,
            })}
          </p>
        )}
        <button className="primary" onClick={onClose}>{t('shell.advance')}</button>
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
        <h2>{t('report.title', { label: seasonLabel(report.season) })}</h2>

        {summary && (
          <div className="grid four" style={{ margin: '0.8rem 0' }}>
            <div className="stat"><div className="value">{summary.appearances}</div>
              <div className="label">{t('stats.apps')}</div></div>
            <div className="stat"><div className="value">{summary.goals}</div>
              <div className="label">{t('stats.goals')}</div></div>
            <div className="stat"><div className="value">{summary.assists}</div>
              <div className="label">{t('stats.assists')}</div></div>
            <div className="stat">
              <div className="value">{tDecimal(summary.avgRating)}</div>
              <div className="label">{t('stats.rating')}</div>
            </div>
          </div>
        )}

        <h4>{t('report.champions')}</h4>
        <ul className="small">
          {report.champions.map((c) => (
            <li key={c.competitionId}>
              {game.competitions[c.competitionId]?.name}: <strong>{game.clubs[c.clubId]?.name}</strong>
            </li>
          ))}
        </ul>

        {report.awards.filter((a) => a.playerId === game.userPlayerId).length > 0 && (
          <>
            <h4>{t('report.yourAwards')}</h4>
            <ul className="small">
              {report.awards.filter((a) => a.playerId === game.userPlayerId).map((a) => (
                <li key={a.id} style={{ color: '#e5cd7c' }}>{a.label} ({a.value})</li>
              ))}
            </ul>
          </>
        )}

        {report.promoted.length > 0 && (
          <>
            <h4>{t('report.promoted')}</h4>
            <p className="small muted">
              {report.promoted.map((p) => game.clubs[p.clubId]?.name).filter(Boolean).join(', ')}
            </p>
          </>
        )}
        {report.relegated.length > 0 && (
          <>
            <h4>{t('report.relegated')}</h4>
            <p className="small muted">
              {report.relegated.map((p) => game.clubs[p.clubId]?.name).filter(Boolean).join(', ')}
            </p>
          </>
        )}

        {game.offers.length > 0 && (
          <p className="pill good" style={{ marginTop: '0.6rem' }}>
            {tn('career.newOffers', game.offers.length)}
          </p>
        )}

        <div className="row" style={{ marginTop: '1rem' }}>
          <button className="primary" onClick={onClose}>{t('report.startNextSeason')}</button>
        </div>
      </div>
    </div>
  );
}

/**
 * Was auf dem Weg zum Zieldatum passiert ist.
 *
 * Ohne diese Aufstellung waere ein Sprung ein schwarzes Loch: drei Wochen
 * vergangen, zwei Spiele gelaufen, und man erfaehrt es nur, wenn man
 * hinterher die Tabelle aufschlaegt.
 */
function SkipModal({ bericht, onClose }:
{ bericht: SkipSummary; onClose: () => void }) {
  const grundText: Record<SkipSummary['grund'], string> = {
    ziel: 'calendar.report.reachedTarget',
    spiel: 'calendar.report.stoppedMatch',
    ereignis: 'calendar.report.stoppedEvent',
    saison: 'calendar.report.stoppedSeason',
    ende: 'calendar.report.stoppedRetired',
    grenze: 'calendar.report.stoppedLimit',
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{t('calendar.report.title')}</h2>
        <div className="row" style={{ flexWrap: 'wrap', gap: '0.3rem' }}>
          <Pill>{tn('calendar.report.days', bericht.days)}</Pill>
          <Pill>{formatDate(bericht.von)} &rarr; {formatDate(bericht.bis)}</Pill>
          {bericht.meldungen > 0 && (
            <Pill>{tn('calendar.report.news', bericht.meldungen)}</Pill>
          )}
          {bericht.trainingsPlus > 0 && (
            <Pill tone="good">
              {t('calendar.report.training', { n: tNumber(bericht.trainingsPlus) })}
            </Pill>
          )}
        </div>
        <p className="muted">{t(grundText[bericht.grund])}</p>

        {/* Ueber ein paar Tage aendert sich nichts; ueber eine ganze Saison
            ist genau das die Geschichte, die man lesen will. */}
        {(bericht.staerkeNachher !== bericht.staerkeVorher
          || bericht.potenzialNachher !== bericht.potenzialVorher) && (
          <div className="row" style={{ flexWrap: 'wrap', gap: '0.3rem' }}>
            {bericht.staerkeNachher !== bericht.staerkeVorher && (
              <Pill tone={bericht.staerkeNachher > bericht.staerkeVorher ? 'good' : 'bad'}>
                {t('calendar.report.ability', {
                  from: bericht.staerkeVorher, to: bericht.staerkeNachher,
                })}
              </Pill>
            )}
            {bericht.potenzialNachher !== bericht.potenzialVorher && (
              <Pill tone={bericht.potenzialNachher > bericht.potenzialVorher ? 'good' : 'bad'}>
                {t('calendar.report.potential', {
                  from: bericht.potenzialVorher, to: bericht.potenzialNachher,
                })}
              </Pill>
            )}
          </div>
        )}

        {/* Als Pillen statt als Satz: sonst braucht jede Zahl ihre eigene
            Mehrzahlregel und man liest "1 Vorlagen".

            Gezaehlt werden **Einsaetze**, nicht Vereinspartien. Die Liste
            unten enthaelt auch Spiele, in denen er nicht auf dem Platz
            stand - stuenden die hier mit, waere die Zahl hoeher als im
            Saisonbericht und niemand wuesste, welche stimmt. */}
        {bericht.eigeneSpiele.length > 3 && (
          <div className="row" style={{ flexWrap: 'wrap', gap: '0.3rem' }}>
            <Pill>{tn('calendar.report.matches',
              bericht.eigeneSpiele.filter((s) => s.note !== null).length)}</Pill>
            <Pill>{tn('calendar.report.goalsTotal', bericht.tore)}</Pill>
            <Pill>{tn('calendar.report.assistsTotal', bericht.vorlagen)}</Pill>
            {bericht.schnittnote > 0 && (
              <Pill>{t('calendar.report.avg', {
                rating: tDecimal(bericht.schnittnote, 2),
              })}</Pill>
            )}
          </div>
        )}

        {/* Ueber eine ganze Saison sind es vierzig Zeilen - dann zaehlt die
            Zusammenfassung oben, und hier stehen nur die letzten zwoelf. */}
        {bericht.eigeneSpiele.length > 0 && (
          <table>
            <tbody>
              {bericht.eigeneSpiele.slice(-12).map((s: SkipSummary['eigeneSpiele'][number]) => (
                <tr key={s.matchId}>
                  <td className="tiny dim" style={{ whiteSpace: 'nowrap' }}>
                    {formatDate(s.datum)}
                  </td>
                  <td className="tiny dim">
                    {s.daheim ? t('calendar.report.home') : t('calendar.report.away')}
                  </td>
                  <td>{s.gegner}</td>
                  <td className="center mono">
                    <strong>{s.tore}:{s.gegentore}</strong>
                  </td>
                  <td className="num">
                    {s.note !== null && (
                      <span className="mono tiny" style={{ color: ratingColor(s.note) }}>
                        {rating(s.note)}
                      </span>
                    )}
                  </td>
                  <td className="tiny dim num">
                    {s.eigeneTore > 0 && t('calendar.report.goals', { n: s.eigeneTore })}
                    {s.vorlagen > 0 && ' ' + t('calendar.report.assists', { n: s.vorlagen })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <button className="primary" onClick={onClose}>{t('common.ok')}</button>
      </div>
    </div>
  );
}

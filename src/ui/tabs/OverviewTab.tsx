import { formatDate, seasonLabel } from '../../engine/date';
import {
  nextUserMatch, recentUserMatches, sortedTable, userClub, userLeague, userSeasonSummary,
} from '../../engine/game';
import { TRAINING_LABELS } from '../../engine/development';
import { matchImportance } from '../../engine/rivalry';
import { setState, useAppState } from '../../state/store';
import ClubCrest from '../ClubCrest';
import { Empty, FormDots, Panel, Pill, rating, ratingColor } from '../components';
import { t } from '../../i18n';
import { useLocale } from '../../i18n/useLocale';

export default function OverviewTab() {
  useLocale();
  const game = useAppState().game!;
  const user = game.players[game.userPlayerId];
  const club = userClub(game);
  const league = userLeague(game);
  const next = nextUserMatch(game);
  const season = userSeasonSummary(game);
  const recent = recentUserMatches(game, 5);

  const table = league ? sortedTable(game, league.id) : [];
  const position = club ? table.findIndex((r) => r.clubId === club.id) + 1 : 0;
  const row = club ? table.find((r) => r.clubId === club.id) : undefined;

  const opponent = next
    ? game.clubs[next.homeClubId === club?.id ? next.awayClubId : next.homeClubId]
    : null;
  const isHome = next?.homeClubId === club?.id;
  const nextImportance = next ? matchImportance(game, next) : null;

  return (
    <>
      <div className="grid two">
        <Panel title={t('overview.nextMatch')}>
          {!next && <Empty text={t('overview.noMatch')} />}
          {next && opponent && (
            <>
              <div className="row between">
                <div className="row" style={{ gap: '0.7rem', alignItems: 'center' }}>
                  <ClubCrest club={opponent} size={52} />
                  <div>
                    <div style={{ fontSize: '1.15rem', fontWeight: 680 }}>
                      {isHome ? 'gegen' : 'bei'} {opponent.name}
                    </div>
                    <div className="small muted">
                      {game.competitions[next.competitionId]?.name}
                      {next.roundName ? ` - ${next.roundName}` : ` - ${next.matchday}. Spieltag`}
                    </div>
                    <div className="tiny dim">{formatDate(next.date)}</div>
                    <div className="tiny dim">
                      {isHome ? club?.stadiumName : opponent.stadiumName}
                      {' - Trainer '}{opponent.managerName}
                    </div>
                  </div>
                </div>
                <div className="center">
                  <div className="tiny dim">{t('club.reputation')}</div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 700 }}>{opponent.reputation}</div>
                </div>
              </div>
              <div className="row" style={{ marginTop: '0.7rem' }}>
                <Pill>{isHome ? t('overview.homeMatch') : t('overview.awayMatch')}</Pill>
                {nextImportance?.label && <Pill tone="warn">{nextImportance.label}</Pill>}
                <Pill>{opponent.city}</Pill>
                <Pill>{opponent.formation}</Pill>
                {user.injury && <Pill tone="bad">{t('overview.injured')}</Pill>}
                {user.suspension > 0 && <Pill tone="warn">{t('squad.suspended')}</Pill>}
              </div>
            </>
          )}
        </Panel>

        <Panel title={league?.name ?? t('contract.league')}>
          {!row && <Empty text={t('overview.noMatchesYet')} />}
          {row && (
            <>
              <div className="row between">
                <div>
                  <div style={{ fontSize: '2rem', fontWeight: 780, lineHeight: 1 }}>
                    {row.played > 0 ? `${position}.` : '-'}
                  </div>
                  <div className="small muted">{club?.name}</div>
                </div>
                <div className="center">
                  <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{row.points}</div>
                  <div className="tiny dim">{t('overview.points')}</div>
                </div>
                <div className="center">
                  <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>
                    {row.goalsFor - row.goalsAgainst > 0 ? '+' : ''}{row.goalsFor - row.goalsAgainst}
                  </div>
                  <div className="tiny dim">{t('overview.goalDiff')}</div>
                </div>
              </div>
              <div className="row between" style={{ marginTop: '0.6rem' }}>
                <span className="small muted">
                  {row.played} Spiele - {row.won}S {row.drawn}U {row.lost}N
                </span>
                <FormDots form={row.form} />
              </div>
            </>
          )}
        </Panel>
      </div>

      <Panel title={`Deine Saison ${seasonLabel(game.season)}`}>
        <div className="grid four">
          <div className="stat"><div className="value">{season.appearances}</div><div className="label">{t('overview.appearances')}</div></div>
          <div className="stat"><div className="value">{season.goals}</div><div className="label">{t('stats.goals')}</div></div>
          <div className="stat"><div className="value">{season.assists}</div><div className="label">{t('stats.assists')}</div></div>
          <div className="stat">
            <div className="value" style={{ color: ratingColor(season.avgRating) }}>
              {season.avgRating > 0 ? rating(season.avgRating) : '-'}
            </div>
            <div className="label">{t('overview.average')}</div>
          </div>
        </div>
      </Panel>

      <div className="grid two">
        <Panel title={t('overview.objectives')}>
          {game.objectives.length === 0 && <Empty text={t('overview.noObjectives')} />}
          {game.objectives.map((obj) => {
            const pct = obj.kind === 'teamPosition'
              ? (obj.current > 0 ? Math.max(0, 100 - (obj.current - obj.target) * 12) : 0)
              : Math.min(100, (obj.current / obj.target) * 100);
            return (
              <div key={obj.id} style={{ marginBottom: '0.6rem' }}>
                <div className="row between small">
                  <span>{obj.label}</span>
                  <span className={obj.done ? 'pill good' : 'pill'}>
                    {obj.kind === 'rating'
                      ? rating(obj.current)
                      : obj.kind === 'teamPosition'
                        ? (obj.current > 0 ? `${obj.current}.` : '-')
                        : `${obj.current}/${obj.target}`}
                  </span>
                </div>
                <div className="bar" style={{ marginTop: 3 }}>
                  <span style={{
                    width: `${Math.max(0, Math.min(100, pct))}%`,
                    background: obj.done ? '#2fae63' : '#3a8fd0',
                  }} />
                </div>
              </div>
            );
          })}
        </Panel>

        <Panel title={t('overview.lastMatches')} action={
          <button className="small ghost" onClick={() => setState({ tab: 'calendar' })}>{t('tab.calendar')}</button>
        }>
          {recent.length === 0 && <Empty text={t('overview.noMatchesYet')} />}
          {recent.map((m) => {
            const home = game.clubs[m.homeClubId];
            const away = game.clubs[m.awayClubId];
            const stats = m.userStats;
            const won = club && ((m.homeClubId === club.id && (m.homeScore ?? 0) > (m.awayScore ?? 0))
              || (m.awayClubId === club.id && (m.awayScore ?? 0) > (m.homeScore ?? 0)));
            const drew = m.homeScore === m.awayScore;
            return (
              <div className="row between small" key={m.id}
                style={{ padding: '0.3rem 0', borderBottom: '1px solid var(--border-soft)' }}>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span className={won ? 'pill good' : drew ? 'pill' : 'pill bad'}
                    style={{ marginRight: 6 }}>
                    {m.homeScore}:{m.awayScore}
                  </span>
                  {home?.short} - {away?.short}
                </span>
                {stats ? (
                  <span className="mono tiny" style={{ color: ratingColor(stats.rating) }}>
                    {rating(stats.rating)}
                    {stats.goals > 0 && ` - ${stats.goals}T`}
                    {stats.assists > 0 && ` ${stats.assists}V`}
                  </span>
                ) : <span className="tiny dim">nicht im Kader</span>}
              </div>
            );
          })}
        </Panel>
      </div>

      <div className="grid two">
        <Panel title={t('overview.trainingPlan')} action={
          <button className="small ghost" onClick={() => setState({ tab: 'training' })}>{t('overview.change')}</button>
        }>
          <div className="row between">
            <span>{t(t(TRAINING_LABELS[game.training.focus]))}</span>
            <Pill>{game.training.intensity}</Pill>
          </div>
          {game.training.individualGoal && (
            <div className="small muted" style={{ marginTop: '0.4rem' }}>
              Individuelles Ziel: {t(t(TRAINING_LABELS[game.training.individualGoal]))}
            </div>
          )}
        </Panel>

        <Panel title={t('overview.headlines')} action={
          <button className="small ghost" onClick={() => setState({ tab: 'news' })}>Alle</button>
        }>
          {game.news.slice(0, 4).map((n) => (
            <div key={n.id} className="small" style={{ padding: '0.25rem 0' }}>
              <div style={{ fontWeight: 600 }}>{n.headline}</div>
              <div className="tiny dim">{formatDate(n.date)}</div>
            </div>
          ))}
          {game.news.length === 0 && <Empty text={t('overview.noHeadlines')} />}
        </Panel>
      </div>
    </>
  );
}

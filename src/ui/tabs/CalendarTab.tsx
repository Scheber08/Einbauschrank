import { useMemo, useState } from 'react';
import { formatDate, month, monthName, year } from '../../engine/date';
import { userClub } from '../../engine/game';
import { useAppState } from '../../state/store';
import { Empty, Panel, rating, ratingColor } from '../components';

export default function CalendarTab() {
  const game = useAppState().game!;
  const club = userClub(game);
  const [showAll, setShowAll] = useState(false);

  const matches = useMemo(() => {
    const all = Object.values(game.matches)
      .filter((m) => m.season === game.season)
      .filter((m) => showAll || !club
        || m.homeClubId === club.id || m.awayClubId === club.id)
      .sort((a, b) => a.date.localeCompare(b.date));
    return all;
  }, [game.matches, game.season, club, showAll, game.version]);

  const groups = useMemo(() => {
    const map = new Map<string, typeof matches>();
    for (const m of matches) {
      const key = `${year(m.date)}-${String(month(m.date)).padStart(2, '0')}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(m);
    }
    return [...map.entries()];
  }, [matches]);

  return (
    <Panel title="Spielplan" action={
      <div className="row">
        <span className="chip" onClick={() => setShowAll(false)}
          style={{ opacity: showAll ? 0.55 : 1 }}>Eigene Spiele</span>
        <span className="chip" onClick={() => setShowAll(true)}
          style={{ opacity: showAll ? 1 : 0.55 }}>Alle Spiele</span>
      </div>
    }>
      {groups.length === 0 && <Empty text="Keine Spiele im Kalender." />}
      <div className="scroll">
        {groups.map(([key, list]) => (
          <div key={key} style={{ marginBottom: '1rem' }}>
            <h4 style={{ position: 'sticky', top: 0, background: 'var(--panel)', padding: '0.3rem 0' }}>
              {monthName(Number(key.slice(5)))} {key.slice(0, 4)}
            </h4>
            <table>
              <tbody>
                {list.map((m) => {
                  const home = game.clubs[m.homeClubId];
                  const away = game.clubs[m.awayClubId];
                  const isUser = club && (m.homeClubId === club.id || m.awayClubId === club.id);
                  const comp = game.competitions[m.competitionId];
                  return (
                    <tr key={m.id} className={isUser ? 'user' : ''}>
                      <td className="tiny dim" style={{ whiteSpace: 'nowrap' }}>
                        {formatDate(m.date)}
                      </td>
                      <td className="tiny dim">{comp?.short}</td>
                      <td style={{ textAlign: 'right' }}>{home?.name}</td>
                      <td className="center mono" style={{ width: 74, whiteSpace: 'nowrap' }}>
                        {m.played ? (
                          <strong>{m.homeScore}:{m.awayScore}</strong>
                        ) : <span className="dim">-:-</span>}
                        {m.penalties && (
                          <div className="tiny dim">n.E. {m.penalties[0]}:{m.penalties[1]}</div>
                        )}
                      </td>
                      <td>{away?.name}</td>
                      <td className="num" style={{ width: 76 }}>
                        {m.userStats ? (
                          <span className="mono tiny" style={{ color: ratingColor(m.userStats.rating) }}>
                            {rating(m.userStats.rating)}
                            {m.userStats.goals > 0 && ` ${m.userStats.goals}T`}
                          </span>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </Panel>
  );
}

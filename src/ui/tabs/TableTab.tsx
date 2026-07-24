import { useMemo, useState } from 'react';
import { sortedTable, userClub } from '../../engine/game';
import { COUNTRIES } from '../../engine/countries';
import { leaguesOfCountry, cupOfCountry } from '../../engine/season';
import { topAssists, topScorers } from '../../engine/stats';
import { CUP_ROUNDS } from '../../engine/cup';
import { useAppState } from '../../state/store';
import { Empty, FormDots, Panel, shortName } from '../components';

export default function TableTab() {
  const game = useAppState().game!;
  const club = userClub(game);
  // Nur Laender mit erzeugten Ligen anbieten.
  const countries = useMemo(
    () => COUNTRIES.filter((c) => leaguesOfCountry(game, c.id).length > 0),
    [game.version],
  );
  const [country, setCountry] = useState(club?.countryId ?? countries[0]?.id ?? '');
  const leagues = useMemo(() => leaguesOfCountry(game, country), [country, game.version]);
  const cup = useMemo(() => cupOfCountry(game, country), [country, game.version]);
  const [selectedRaw, setSelected] = useState('');
  // Bei Laenderwechsel automatisch die erste Liga des Landes zeigen.
  const selected = leagues.some((l) => l.id === selectedRaw) || selectedRaw === cup?.id
    ? selectedRaw
    : (club?.countryId === country ? club?.leagueId : undefined) ?? leagues[0]?.id ?? '';

  const isCup = selected === cup?.id;
  const competition = game.competitions[selected];
  const table = useMemo(
    () => (isCup || !competition ? [] : sortedTable(game, selected)),
    [selected, isCup, competition, game.version],
  );

  const scorers = useMemo(
    () => topScorers(game, selected, game.season, 12),
    [selected, game.season, game.version],
  );
  const assists = useMemo(
    () => topAssists(game, selected, game.season, 12),
    [selected, game.season, game.version],
  );

  const cupMatches = useMemo(() => {
    if (!isCup || !cup) return [];
    return Object.values(game.matches)
      .filter((m) => m.competitionId === cup.id && m.season === game.season)
      .sort((a, b) => b.matchday - a.matchday || a.date.localeCompare(b.date));
  }, [isCup, cup, game.season, game.version]);

  const promotionSpots = competition && competition.level > 1 ? [1, 2] : [];
  const relegationSpots = competition && competition.level < 3 ? [19, 20] : [];

  return (
    <>
      <Panel title="Wettbewerbe" action={
        <div className="chip-row">
          {leagues.map((l) => (
            <span key={l.id} className={`chip ${selected === l.id ? 'active' : ''}`}
              onClick={() => setSelected(l.id)}>{l.short}</span>
          ))}
          {cup && (
            <span className={`chip ${selected === cup.id ? 'active' : ''}`}
              onClick={() => setSelected(cup.id)}>Pokal</span>
          )}
        </div>
      }>
        {countries.length > 1 && (
          <div className="chip-row" style={{ marginBottom: '0.6rem' }}>
            {countries.map((c) => (
              <span key={c.id} className={`chip ${country === c.id ? 'active' : ''}`}
                onClick={() => setCountry(c.id)}>{c.name}</span>
            ))}
          </div>
        )}
        <h3 style={{ marginBottom: '0.6rem' }}>{competition?.name}</h3>

        {isCup && (
          <>
            {cupMatches.length === 0 && <Empty text="Der Pokal hat noch nicht begonnen." />}
            <div className="scroll">
              <table>
                <tbody>
                  {cupMatches.map((m) => (
                    <tr key={m.id} className={
                      club && (m.homeClubId === club.id || m.awayClubId === club.id) ? 'user' : ''}>
                      <td className="tiny dim">{CUP_ROUNDS[m.matchday - 1] ?? m.roundName}</td>
                      <td style={{ textAlign: 'right' }}>{game.clubs[m.homeClubId]?.name}</td>
                      <td className="center mono" style={{ width: 70 }}>
                        {m.played ? `${m.homeScore}:${m.awayScore}` : <span className="dim">-:-</span>}
                        {m.penalties && (
                          <div className="tiny dim">n.E. {m.penalties[0]}:{m.penalties[1]}</div>
                        )}
                      </td>
                      <td>{game.clubs[m.awayClubId]?.name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {!isCup && (
          <div className="scroll">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 28 }}>#</th>
                  <th>Verein</th>
                  <th className="num">Sp</th>
                  <th className="num">S</th>
                  <th className="num">U</th>
                  <th className="num">N</th>
                  <th className="num">Tore</th>
                  <th className="num">Diff</th>
                  <th className="num">Pkt</th>
                  <th>Form</th>
                </tr>
              </thead>
              <tbody>
                {table.map((row, i) => {
                  const pos = i + 1;
                  const isUser = club?.id === row.clubId;
                  const promo = promotionSpots.includes(pos);
                  const releg = relegationSpots.includes(pos);
                  const playoff = (competition!.level > 1 && pos === 3)
                    || (competition!.level < 3 && pos === 18);
                  return (
                    <tr key={row.clubId} className={isUser ? 'user' : promo ? 'highlight' : ''}>
                      <td className="mono" style={{
                        borderLeft: `3px solid ${promo ? '#2fae63' : releg ? '#b8404d'
                          : playoff ? '#c98a1c' : 'transparent'}`,
                      }}>{pos}</td>
                      <td>{game.clubs[row.clubId]?.name}</td>
                      <td className="num mono">{row.played}</td>
                      <td className="num mono">{row.won}</td>
                      <td className="num mono">{row.drawn}</td>
                      <td className="num mono">{row.lost}</td>
                      <td className="num mono tiny">{row.goalsFor}:{row.goalsAgainst}</td>
                      <td className="num mono">{row.goalsFor - row.goalsAgainst > 0 ? '+' : ''}
                        {row.goalsFor - row.goalsAgainst}</td>
                      <td className="num mono"><strong>{row.points}</strong></td>
                      <td><FormDots form={row.form} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <div className="grid two">
        <Panel title="Torjaeger">
          {scorers.length === 0 && <Empty text="Noch keine Tore." />}
          <table>
            <tbody>
              {scorers.map((s, i) => {
                const p = game.players[s.playerId];
                if (!p) return null;
                return (
                  <tr key={s.playerId} className={p.isUser ? 'user' : ''}>
                    <td className="dim mono tiny" style={{ width: 22 }}>{i + 1}</td>
                    <td>{p.isUser ? <strong>{p.firstName} {p.lastName}</strong>
                      : shortName(p.firstName, p.lastName)}</td>
                    <td className="tiny dim">
                      {p.clubId ? game.clubs[p.clubId]?.short : '-'}
                    </td>
                    <td className="num mono"><strong>{s.goals}</strong></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Panel>

        <Panel title="Vorlagen">
          {assists.length === 0 && <Empty text="Noch keine Vorlagen." />}
          <table>
            <tbody>
              {assists.map((s, i) => {
                const p = game.players[s.playerId];
                if (!p) return null;
                return (
                  <tr key={s.playerId} className={p.isUser ? 'user' : ''}>
                    <td className="dim mono tiny" style={{ width: 22 }}>{i + 1}</td>
                    <td>{p.isUser ? <strong>{p.firstName} {p.lastName}</strong>
                      : shortName(p.firstName, p.lastName)}</td>
                    <td className="tiny dim">{p.clubId ? game.clubs[p.clubId]?.short : '-'}</td>
                    <td className="num mono"><strong>{s.assists}</strong></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Panel>
      </div>
    </>
  );
}

import { useMemo, useState } from 'react';
import { sortedTable, userClub } from '../../engine/game';
import { COUNTRIES } from '../../engine/countries';
import { CC_ID, CC_NAME, championsCupTable } from '../../engine/international';
import { CT_ID, CT_NAME } from '../../engine/trophy';
import { leaguesOfCountry, cupOfCountry } from '../../engine/season';
import { topAssists, topScorers } from '../../engine/stats';
import { CUP_ROUNDS } from '../../engine/cup';
import { useAppState } from '../../state/store';
import ClubCrest from '../ClubCrest';
import { Empty, FormDots, Panel, Pill, shortName } from '../components';
import { t } from '../../i18n';
import { useLocale } from '../../i18n/useLocale';

export default function TableTab() {
  useLocale();
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
      <ChampionsCupPanel />
      <TrophyPanel />

      <Panel title={t('table.title')} action={
        <div className="chip-row">
          {leagues.map((l) => (
            <span key={l.id} className={`chip ${selected === l.id ? 'active' : ''}`}
              onClick={() => setSelected(l.id)}>{l.short}</span>
          ))}
          {cup && (
            <span className={`chip ${selected === cup.id ? 'active' : ''}`}
              onClick={() => setSelected(cup.id)}>{t('table.cup')}</span>
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
            {cupMatches.length === 0 && <Empty text={t('table.cupNotStarted')} />}
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
                  <th>{t('table.club')}</th>
                  <th className="num">Sp</th>
                  <th className="num">S</th>
                  <th className="num">U</th>
                  <th className="num">N</th>
                  <th className="num">{t('table.goals')}</th>
                  <th className="num">{t('table.diff')}</th>
                  <th className="num">Pkt</th>
                  <th>{t('table.form')}</th>
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
                        borderLeft: `3px solid ${promo ? '#3ecf8e' : releg ? '#d05a5a'
                          : playoff ? '#5aa9d6' : 'transparent'}`,
                      }}>{pos}</td>
                      <td>
                        <span className="row" style={{ gap: '0.45rem', alignItems: 'center' }}>
                          {game.clubs[row.clubId] && (
                            <ClubCrest club={game.clubs[row.clubId]} size={20} />
                          )}
                          {game.clubs[row.clubId]?.name}
                        </span>
                      </td>
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
        <Panel title={t('table.topScorers')}>
          {scorers.length === 0 && <Empty text={t('table.noGoals')} />}
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

        <Panel title={t('table.topAssists')}>
          {assists.length === 0 && <Empty text={t('table.noAssists')} />}
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

function ChampionsCupPanel() {
  const game = useAppState().game!;
  const club = userClub(game);
  const cc = game.competitions[CC_ID];
  const [view, setView] = useState<'table' | 'ko'>('table');

  const table = useMemo(() => (cc ? championsCupTable(game) : []), [cc, game.version]);
  const koMatches = useMemo(() => {
    if (!cc) return [];
    return Object.values(game.matches)
      .filter((m) => m.competitionId === CC_ID && m.season === game.season && (m.matchday ?? 0) >= 100)
      .sort((a, b) => (a.matchday ?? 0) - (b.matchday ?? 0) || a.date.localeCompare(b.date));
  }, [cc, game.season, game.version]);

  if (!cc) return null;

  return (
    <Panel title={CC_NAME} action={
      <div className="chip-row">
        <span className={`chip ${view === 'table' ? 'active' : ''}`}
          onClick={() => setView('table')}>{t('table.leaguePhase')}</span>
        <span className={`chip ${view === 'ko' ? 'active' : ''}`}
          onClick={() => setView('ko')}>K.-o.-Phase</span>
      </div>
    }>
      {view === 'table' && (
        <>
          {table.every((r) => r.played === 0) && (
            <Empty text={t('table.leaguePhaseNotStarted')} />
          )}
          {table.some((r) => r.played > 0) && (
            <div className="scroll">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 28 }}>#</th><th>{t('table.club')}</th>
                    <th className="num">Sp</th><th className="num">{t('table.goals')}</th>
                    <th className="num">{t('table.diff')}</th><th className="num">Pkt</th><th>{t('table.form')}</th>
                  </tr>
                </thead>
                <tbody>
                  {table.map((row, i) => {
                    const pos = i + 1;
                    const isUser = club?.id === row.clubId;
                    // 1-16 kommen weiter, 1-8 direkt ins Achtelfinale.
                    const border = pos <= 8 ? '#3ecf8e' : pos <= 16 ? '#5aa9d6' : '#d05a5a';
                    return (
                      <tr key={row.clubId} className={isUser ? 'user' : ''}>
                        <td className="mono" style={{ borderLeft: `3px solid ${border}` }}>{pos}</td>
                        <td>{game.clubs[row.clubId]?.name}</td>
                        <td className="num mono">{row.played}</td>
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
          <p className="tiny dim" style={{ marginTop: '0.5rem', marginBottom: 0 }}>
            {cc.clubIds.length} Teilnehmer aus fuenf Laendern. Die besten 16 der Ligaphase
            erreichen die K.-o.-Phase, ab Platz 17 ist Schluss.
          </p>
        </>
      )}

      {view === 'ko' && (
        <>
          {koMatches.length === 0 && <Empty text={t('empty.koLater')} />}
          <div className="scroll">
            <table>
              <tbody>
                {koMatches.map((m) => (
                  <tr key={m.id} className={
                    club && (m.homeClubId === club.id || m.awayClubId === club.id) ? 'user' : ''}>
                    <td className="tiny dim">{m.roundName}</td>
                    <td style={{ textAlign: 'right' }}>{game.clubs[m.homeClubId]?.name}</td>
                    <td className="center mono" style={{ width: 66 }}>
                      {m.played ? `${m.homeScore}:${m.awayScore}` : <span className="dim">-:-</span>}
                      {m.penalties && <div className="tiny dim">n.E. {m.penalties[0]}:{m.penalties[1]}</div>}
                    </td>
                    <td>{game.clubs[m.awayClubId]?.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Panel>
  );
}

/** Zweiter europaeischer Wettbewerb - reines K.-o.-Turnier (Abschnitt 11). */
function TrophyPanel() {
  const game = useAppState().game!;
  const club = userClub(game);
  const ct = game.competitions[CT_ID];

  const matches = useMemo(() => {
    if (!ct) return [];
    return Object.values(game.matches)
      .filter((m) => m.competitionId === CT_ID && m.season === game.season)
      .sort((a, b) => (a.matchday ?? 0) - (b.matchday ?? 0) || a.date.localeCompare(b.date));
  }, [ct, game.season, game.version]);

  if (!ct) return null;

  return (
    <Panel title={CT_NAME} action={<Pill>{ct.clubIds.length} Teilnehmer</Pill>}>
      {matches.length === 0 && <Empty text={t('empty.drawPending')} />}
      {matches.length > 0 && (
        <div className="scroll">
          <table>
            <tbody>
              {matches.map((m) => (
                <tr key={m.id} className={
                  club && (m.homeClubId === club.id || m.awayClubId === club.id) ? 'user' : ''}>
                  <td className="tiny dim">{m.roundName}</td>
                  <td style={{ textAlign: 'right' }}>{game.clubs[m.homeClubId]?.name}</td>
                  <td className="center mono" style={{ width: 66 }}>
                    {m.played ? `${m.homeScore}:${m.awayScore}` : <span className="dim">-:-</span>}
                    {m.penalties && <div className="tiny dim">n.E. {m.penalties[0]}:{m.penalties[1]}</div>}
                  </td>
                  <td>{game.clubs[m.awayClubId]?.name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="tiny dim" style={{ marginTop: '0.5rem', marginBottom: 0 }}>
        Der zweite europaeische Wettbewerb: Hier spielen die Vereine, die den Champions
        Cup knapp verpasst haben - im reinen K.-o.-Modus vom Achtelfinale bis zum Finale.
      </p>
    </Panel>
  );
}

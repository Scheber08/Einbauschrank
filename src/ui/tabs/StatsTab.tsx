import { useMemo, useState } from 'react';
import { seasonLabel } from '../../engine/date';
import { collectStats, recordList, sumStats } from '../../engine/stats';
import { useAppState } from '../../state/store';
import { Empty, Panel, rating, ratingColor } from '../components';

export default function StatsTab() {
  const game = useAppState().game!;
  const [seasonFilter, setSeasonFilter] = useState<number | 'all'>('all');
  const [compFilter, setCompFilter] = useState<string | 'all'>('all');
  const [clubFilter, setClubFilter] = useState<string | 'all'>('all');

  const all = useMemo(
    () => collectStats(game, game.userPlayerId),
    [game.userPlayerId, game.version],
  );

  const seasons = useMemo(
    () => [...new Set(all.map((s) => s.season))].sort((a, b) => b - a),
    [all],
  );
  const competitions = useMemo(
    () => [...new Set(all.map((s) => s.competitionId))],
    [all],
  );
  const clubs = useMemo(() => [...new Set(all.map((s) => s.clubId))], [all]);

  const filtered = all.filter((s) =>
    (seasonFilter === 'all' || s.season === seasonFilter)
    && (compFilter === 'all' || s.competitionId === compFilter)
    && (clubFilter === 'all' || s.clubId === clubFilter));

  const total = sumStats(filtered);
  const avg = total.appearances > 0 ? total.ratingSum / total.appearances : 0;
  const records = recordList(game);

  const bySeason = useMemo(() => {
    const map = new Map<number, typeof all>();
    for (const s of filtered) {
      if (!map.has(s.season)) map.set(s.season, []);
      map.get(s.season)!.push(s);
    }
    return [...map.entries()].sort((a, b) => b[0] - a[0]);
  }, [filtered]);

  return (
    <>
      <Panel title="Filter">
        <div className="row" style={{ gap: '1rem', alignItems: 'flex-start' }}>
          <div style={{ minWidth: 130 }}>
            <label>Saison</label>
            <select value={String(seasonFilter)}
              onChange={(e) => setSeasonFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}>
              <option value="all">Gesamte Karriere</option>
              {seasons.map((s) => <option key={s} value={s}>{seasonLabel(s)}</option>)}
            </select>
          </div>
          <div style={{ minWidth: 170 }}>
            <label>Wettbewerb</label>
            <select value={compFilter} onChange={(e) => setCompFilter(e.target.value)}>
              <option value="all">Alle Wettbewerbe</option>
              {competitions.map((c) => (
                <option key={c} value={c}>{game.competitions[c]?.name ?? c}</option>
              ))}
            </select>
          </div>
          <div style={{ minWidth: 170 }}>
            <label>Verein</label>
            <select value={clubFilter} onChange={(e) => setClubFilter(e.target.value)}>
              <option value="all">Alle Vereine</option>
              {clubs.map((c) => (
                <option key={c} value={c}>{game.clubs[c]?.name ?? c}</option>
              ))}
            </select>
          </div>
        </div>
      </Panel>

      <Panel title="Bilanz">
        {total.appearances === 0 && <Empty text="Fuer diese Auswahl liegen keine Daten vor." />}
        {total.appearances > 0 && (
          <>
            <div className="grid four">
              <div className="stat"><div className="value">{total.appearances}</div><div className="label">Spiele</div></div>
              <div className="stat"><div className="value">{total.goals}</div><div className="label">Tore</div></div>
              <div className="stat"><div className="value">{total.assists}</div><div className="label">Vorlagen</div></div>
              <div className="stat">
                <div className="value" style={{ color: ratingColor(avg) }}>{rating(avg)}</div>
                <div className="label">Schnittnote</div>
              </div>
            </div>
            <div className="grid four" style={{ marginTop: '0.7rem' }}>
              <div className="stat"><div className="value">{total.starts}</div><div className="label">Startelf</div></div>
              <div className="stat"><div className="value">{total.minutes}</div><div className="label">Minuten</div></div>
              <div className="stat"><div className="value">{total.motm}</div><div className="label">Spieler des Spiels</div></div>
              <div className="stat">
                <div className="value">{total.shots > 0 ? Math.round(total.goals / total.shots * 100) : 0}%</div>
                <div className="label">Torquote</div>
              </div>
            </div>

            <div className="grid two" style={{ marginTop: '1rem' }}>
              <div>
                <h4>Offensive</h4>
                <StatRow label="Schuesse" value={total.shots} />
                <StatRow label="Schuesse aufs Tor" value={total.shotsOnTarget} />
                <StatRow label="Schluesselpaesse" value={total.keyPasses} />
                <StatRow label="Heimtore" value={total.homeGoals} />
                <StatRow label="Auswaertstore" value={total.awayGoals} />
                <StatRow label="Dribblings" value={`${total.dribblesCompleted}/${total.dribbles}`} />
              </div>
              <div>
                <h4>Defensive und Disziplin</h4>
                <StatRow label="Zweikaempfe gewonnen"
                  value={`${total.duelsWon}/${total.duels}`} />
                <StatRow label="Graetschen" value={total.tackles} />
                <StatRow label="Abgefangene Baelle" value={total.interceptions} />
                <StatRow label="Gelbe Karten" value={total.yellowCards} />
                <StatRow label="Rote Karten" value={total.redCards} />
                <StatRow label="Passquote" value={total.passes > 0
                  ? `${Math.round(total.passesCompleted / total.passes * 100)}%` : '-'} />
                {total.saves > 0 && <StatRow label="Paraden" value={total.saves} />}
                {total.cleanSheets > 0 && <StatRow label="Ohne Gegentor" value={total.cleanSheets} />}
              </div>
            </div>
          </>
        )}
      </Panel>

      <Panel title="Saison fuer Saison">
        {bySeason.length === 0 && <Empty text="Noch keine abgeschlossenen Saisons." />}
        {bySeason.length > 0 && (
          <div className="scroll">
            <table>
              <thead>
                <tr>
                  <th>Saison</th>
                  <th>Wettbewerb</th>
                  <th>Verein</th>
                  <th className="num">Sp</th>
                  <th className="num">Min</th>
                  <th className="num">Tore</th>
                  <th className="num">Vorl.</th>
                  <th className="num">Note</th>
                </tr>
              </thead>
              <tbody>
                {bySeason.map(([season, entries]) => entries.map((s, i) => (
                  <tr key={`${season}-${s.competitionId}-${s.clubId}`}>
                    <td className="mono tiny">{i === 0 ? seasonLabel(season) : ''}</td>
                    <td className="tiny">{game.competitions[s.competitionId]?.short ?? '-'}</td>
                    <td className="tiny dim">{game.clubs[s.clubId]?.short ?? '-'}</td>
                    <td className="num mono">{s.appearances}</td>
                    <td className="num mono">{s.minutes}</td>
                    <td className="num mono"><strong>{s.goals}</strong></td>
                    <td className="num mono">{s.assists}</td>
                    <td className="num mono" style={{
                      color: ratingColor(s.appearances ? s.ratingSum / s.appearances : 0),
                    }}>
                      {s.appearances ? rating(s.ratingSum / s.appearances) : '-'}
                    </td>
                  </tr>
                )))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <div className="grid two">
        <Panel title="Rekordbuch">
          {records.length === 0 && <Empty text="Noch keine Rekorde eingetragen." />}
          {records.map((r) => (
            <div className="row between small" key={r.key} style={{ padding: '0.25rem 0' }}>
              <span>
                <div>{r.label}</div>
                <div className="tiny dim">{r.scope} - {seasonLabel(r.season)}</div>
              </span>
              <span className="center">
                <div style={{ fontWeight: 700 }}>{r.displayValue}</div>
                <div className="tiny dim">{r.holderName}</div>
              </span>
            </div>
          ))}
        </Panel>

        <Panel title="Auszeichnungen">
          {game.awards.filter((a) => a.playerId === game.userPlayerId).length === 0 && (
            <Empty text="Noch keine Auszeichnungen gewonnen." />
          )}
          {game.awards.filter((a) => a.playerId === game.userPlayerId).slice().reverse().map((a) => (
            <div className="row between small" key={a.id} style={{ padding: '0.25rem 0' }}>
              <span style={{ color: '#f5c542' }}>{a.label}</span>
              <span className="tiny dim">{seasonLabel(a.season)} - {a.value}</span>
            </div>
          ))}
        </Panel>
      </div>
    </>
  );
}

function StatRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="row between small" style={{ padding: '0.12rem 0' }}>
      <span className="muted">{label}</span>
      <span className="mono">{value}</span>
    </div>
  );
}

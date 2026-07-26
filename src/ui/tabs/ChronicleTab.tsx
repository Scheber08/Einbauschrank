import { useState } from 'react';
import { formatDate, seasonLabel } from '../../engine/date';
import { canRetire, careerStatus } from '../../engine/retirement';
import { careerTotals } from '../../engine/stats';
import { retireCareer } from '../../state/actions';
import { useAppState } from '../../state/store';
import { Empty, Panel, rating, ratingColor } from '../components';

const EVENT_ICONS: Record<string, string> = {
  start: 'Start',
  debut: 'Debuet',
  firstGoal: 'Tor',
  firstAssist: 'Vorlage',
  hattrick: 'Hattrick',
  title: 'Titel',
  award: 'Preis',
  transfer: 'Wechsel',
  injury: 'Verletzung',
  promotion: 'Aufstieg',
  relegation: 'Abstieg',
  contract: 'Vertrag',
};

export default function ChronicleTab() {
  const game = useAppState().game!;
  const user = game.players[game.userPlayerId];
  const totals = careerTotals(game);
  const events = game.careerEvents.slice().reverse();
  const avg = totals.appearances > 0 ? totals.ratingSum / totals.appearances : 0;
  const done = game.retirement;
  const [confirmRetire, setConfirmRetire] = useState(false);

  return (
    <>
      {done && (
        <Panel title="Laufbahn abgeschlossen">
          <div className="center" style={{ padding: '0.4rem 0 0.8rem' }}>
            <div className="tiny dim">Karriere beendet {formatDate(done.date)} mit {done.age} Jahren</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#f5c542', margin: '0.3rem 0' }}>
              {done.status}
            </div>
            <div className="small muted">{user.firstName} {user.lastName}</div>
          </div>
          <div className="grid four">
            <div className="stat"><div className="value">{done.appearances}</div><div className="label">Pflichtspiele</div></div>
            <div className="stat"><div className="value">{done.goals}</div><div className="label">Tore</div></div>
            <div className="stat"><div className="value">{done.assists}</div><div className="label">Vorlagen</div></div>
            <div className="stat"><div className="value">{done.honours}</div><div className="label">Titel</div></div>
          </div>
          {done.clubs.length > 0 && (
            <p className="small muted" style={{ marginBottom: 0 }}>
              Stationen: {done.clubs.join(' - ')}
            </p>
          )}
        </Panel>
      )}

      <Panel title="Karrierebilanz">
        <div className="grid four">
          <div className="stat"><div className="value">{totals.appearances}</div><div className="label">Pflichtspiele</div></div>
          <div className="stat"><div className="value">{totals.goals}</div><div className="label">Tore</div></div>
          <div className="stat"><div className="value">{totals.assists}</div><div className="label">Vorlagen</div></div>
          <div className="stat">
            <div className="value" style={{ color: ratingColor(avg) }}>
              {avg > 0 ? rating(avg) : '-'}
            </div>
            <div className="label">Schnittnote</div>
          </div>
        </div>
        <p className="small muted" style={{ marginTop: '0.8rem', marginBottom: 0 }}>
          Aktueller Karrierestatus:{' '}
          <strong style={{ color: '#f5c542' }}>
            {careerStatus(totals.goals, totals.appearances, game.honours.length)}
          </strong>
          {' - '}
          {user.firstName} {user.lastName}, {game.honours.length} Titel und Auszeichnungen.
        </p>
        {canRetire(game) && (
          <div style={{ marginTop: '0.9rem', paddingTop: '0.8rem', borderTop: '1px solid var(--border-soft)' }}>
            {!confirmRetire ? (
              <button className="small ghost" onClick={() => setConfirmRetire(true)}>
                Laufbahn beenden
              </button>
            ) : (
              <div>
                <p className="small" style={{ marginTop: 0 }}>
                  Die aktive Laufbahn wirklich beenden? Danach bleibt nur noch die Chronik -
                  gespielt wird nicht mehr.
                </p>
                <div className="row">
                  <button className="primary small" onClick={() => retireCareer()}>
                    Ja, Karriere beenden
                  </button>
                  <button className="small ghost" onClick={() => setConfirmRetire(false)}>
                    Weiterspielen
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </Panel>

      {game.honours.length > 0 && (
        <Panel title="Erfolge">
          <div className="chip-row">
            {game.honours.slice().reverse().map((h, i) => (
              <span className="chip" key={i} style={{ borderColor: '#6d5520', color: '#ffd479' }}>
                {seasonLabel(h.season)} - {h.label}
              </span>
            ))}
          </div>
        </Panel>
      )}

      {(game.nationalCaps > 0 || game.wncHistory.length > 0) && (
        <Panel title="Nationalmannschaft">
          <div className="grid two" style={{ marginBottom: game.wncHistory.length > 0 ? '0.8rem' : 0 }}>
            <div className="stat"><div className="value">{game.nationalCaps}</div><div className="label">Laenderspiele</div></div>
            <div className="stat"><div className="value">{game.nationalGoals}</div><div className="label">Laenderspieltore</div></div>
          </div>
          {game.wncHistory.length > 0 && (
            <table>
              <tbody>
                {game.wncHistory.slice().reverse().map((w) => (
                  <tr key={w.year}>
                    <td className="mono tiny">{w.year}</td>
                    <td>Weltmeister: <strong>{w.championName}</strong></td>
                    <td className="tiny">
                      {w.userNominated
                        ? <span className={w.userNationReached === 'Sieg' ? 'pill good' : 'pill'}>
                            {w.userNationReached === 'Sieg' ? 'Titel' : w.userNationReached}
                            {w.userGoals > 0 ? ` · ${w.userGoals} Tore` : ''}
                          </span>
                        : <span className="dim">nicht dabei</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      )}

      <Panel title="Karrierechronik">
        {events.length === 0 && <Empty text="Noch keine Ereignisse verzeichnet." />}
        <div className="scroll">
          {events.map((e) => (
            <div key={e.id} style={{
              display: 'grid', gridTemplateColumns: '92px 1fr', gap: '0.7rem',
              padding: '0.5rem 0', borderBottom: '1px solid var(--border-soft)',
            }}>
              <div>
                <div className="tiny dim">{formatDate(e.date)}</div>
                <span className="pill">{EVENT_ICONS[e.type] ?? 'Ereignis'}</span>
              </div>
              <div>
                <div style={{ fontWeight: 620 }}>{e.title}</div>
                <div className="small muted">{e.description}</div>
                {e.clubId && (
                  <div className="tiny dim">{game.clubs[e.clubId]?.name}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </>
  );
}

import { formatDate, seasonLabel } from '../../engine/date';
import { careerTotals } from '../../engine/stats';
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

/** Bewertung der Laufbahn am Karriereende (Konzept Abschnitt 2). */
function careerStatus(goals: number, apps: number, honours: number): string {
  const score = apps * 0.4 + goals * 2 + honours * 12;
  if (score > 900) return 'Fussballikone';
  if (score > 650) return 'Weltfussballer';
  if (score > 450) return 'Internationaler Superstar';
  if (score > 300) return 'Nationaler Star';
  if (score > 190) return 'Vereinslegende';
  if (score > 120) return 'Publikumsliebling';
  if (score > 60) return 'Stammspieler';
  if (score > 20) return 'Solider Profi';
  return 'Amateur';
}

export default function ChronicleTab() {
  const game = useAppState().game!;
  const user = game.players[game.userPlayerId];
  const totals = careerTotals(game);
  const events = game.careerEvents.slice().reverse();
  const avg = totals.appearances > 0 ? totals.ratingSum / totals.appearances : 0;

  return (
    <>
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

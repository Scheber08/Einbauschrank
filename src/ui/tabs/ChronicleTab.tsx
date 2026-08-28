import { userNationalSquad } from '../../engine/national';
import { nationName } from '../../engine/nations';
import { POSITION_LABELS, computeOverall } from '../../engine/attributes';
import { useMemo, useState } from 'react';
import { formatDate, seasonLabel } from '../../engine/date';
import { canRetire, careerStatus } from '../../engine/retirement';
import { careerTotals } from '../../engine/stats';
import { retireCareer } from '../../state/actions';
import { useAppState } from '../../state/store';
import { Empty, Panel, rating, ratingColor } from '../components';
import { t } from '../../i18n';
import { useLocale } from '../../i18n/useLocale';

/**
 * Kurzform je Ereignisart. Die Werte sind Schluessel in den Sprachkatalogen -
 * ein unbekannter Typ faellt auf `event.unknown` zurueck, und der Rauchtest
 * meldet, wenn ein neuer Typ ohne Eintrag bleibt.
 */
export const EVENT_KEYS: Record<string, string> = {
  start: 'event.start',
  debut: 'event.debut',
  firstGoal: 'event.firstGoal',
  firstAssist: 'event.firstAssist',
  hattrick: 'event.hattrick',
  title: 'event.title',
  award: 'event.award',
  transfer: 'event.transfer',
  injury: 'event.injury',
  promotion: 'event.promotion',
  relegation: 'event.relegation',
  contract: 'event.contract',
  milestone: 'event.milestone',
  derby: 'event.derby',
  coach: 'event.coach',
  national: 'event.national',
  international: 'event.international',
  other: 'event.other',
};

export default function ChronicleTab() {
  useLocale();
  const game = useAppState().game!;
  const user = game.players[game.userPlayerId];
  const totals = careerTotals(game);
  const events = game.careerEvents.slice().reverse();
  const avg = totals.appearances > 0 ? totals.ratingSum / totals.appearances : 0;
  const done = game.retirement;
  const [confirmRetire, setConfirmRetire] = useState(false);

  // Die 23 staerksten Spieler der eigenen Herkunft - dieselbe Auswahl, die
  // die Engine fuer das Turnier trifft.
  const nationalkader = useMemo(
    () => userNationalSquad(game).slice(0, 12),
    [game.players, game.version],
  );
  // Rang auf der eigenen Position im ganzen Land.
  const eigenerRang = useMemo(() => {
    const eigen = computeOverall(user.attrs, user.position);
    const davor = Object.values(game.players).filter(
      (p) => p.id !== user.id && p.nationality === user.nationality
        && p.position === user.position
        && computeOverall(p.attrs, p.position) > eigen).length;
    return davor + 1;
  }, [game.players, game.version]);
  return (
    <>
      {done && (
        <Panel title={t('chronicle.finished')}>
          <div className="center" style={{ padding: '0.4rem 0 0.8rem' }}>
            <div className="tiny dim">{t('chronicle.endedAt', { date: formatDate(done.date), age: done.age })}</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#e5cd7c', margin: '0.3rem 0' }}>
              {done.status}
            </div>
            <div className="small muted">{user.firstName} {user.lastName}</div>
          </div>
          <div className="grid four">
            <div className="stat"><div className="value">{done.appearances}</div><div className="label">{t('chronicle.competitiveApps')}</div></div>
            <div className="stat"><div className="value">{done.goals}</div><div className="label">{t('stats.goals')}</div></div>
            <div className="stat"><div className="value">{done.assists}</div><div className="label">{t('stats.assists')}</div></div>
            <div className="stat"><div className="value">{done.honours}</div><div className="label">{t('chronicle.titles')}</div></div>
          </div>
          {done.clubs.length > 0 && (
            <p className="small muted" style={{ marginBottom: 0 }}>
              Stationen: {done.clubs.join(' - ')}
            </p>
          )}
        </Panel>
      )}

      <Panel title={t('chronicle.totals')}>
        <div className="grid four">
          <div className="stat"><div className="value">{totals.appearances}</div><div className="label">{t('chronicle.competitiveApps')}</div></div>
          <div className="stat"><div className="value">{totals.goals}</div><div className="label">{t('stats.goals')}</div></div>
          <div className="stat"><div className="value">{totals.assists}</div><div className="label">{t('stats.assists')}</div></div>
          <div className="stat">
            <div className="value" style={{ color: ratingColor(avg) }}>
              {avg > 0 ? rating(avg) : '-'}
            </div>
            <div className="label">{t('stats.avgRating')}</div>
          </div>
        </div>
        <p className="small muted" style={{ marginTop: '0.8rem', marginBottom: 0 }}>
          Aktueller Karrierestatus:{' '}
          <strong style={{ color: '#e5cd7c' }}>
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
        <Panel title={t('chronicle.honours')}>
          <div className="chip-row">
            {game.honours.slice().reverse().map((h, i) => (
              <span className="chip" key={i} style={{ borderColor: '#3a4a52', color: '#8ad8e8' }}>
                {seasonLabel(h.season)} - {h.label}
              </span>
            ))}
          </div>
        </Panel>
      )}

      {/* Der Abschnitt erscheint, sobald die Nationalmannschaft in Reichweite
          kommt - nicht erst nach der ersten Nominierung. Der eigene Rang im
          Land ist genau dann die interessante Zahl: Er sagt, wie weit es noch
          ist. Wer weit weg ist, sieht ihn nicht und wird nicht entmutigt. */}
      {(game.nationalCaps > 0 || game.wncHistory.length > 0 || game.nationalNominated
        || eigenerRang <= 40) && (
        <Panel title={t('chronicle.national')}>
          <div className="grid two" style={{ marginBottom: '0.8rem' }}>
            <div className="stat"><div className="value">{game.nationalCaps}</div><div className="label">{t('chronicle.caps')}</div></div>
            <div className="stat"><div className="value">{game.nationalGoals}</div><div className="label">{t('chronicle.capGoals')}</div></div>
          </div>

          {/* Der Kader der eigenen Herkunft. Ohne ihn war eine Nominierung eine
              Zahl ohne Umgebung - man erfuhr nie, mit wem man spielt und wer
              auf der eigenen Position davor liegt. */}
          {nationalkader.length > 0 && (
            <div style={{ marginBottom: game.wncHistory.length > 0 ? '0.8rem' : 0 }}>
              <div className="tiny dim" style={{ marginBottom: '0.35rem' }}>
                {t('chronicle.squadOf', { nation: nationName(user.nationality) })}
              </div>
              <table>
                <tbody>
                  {nationalkader.map((p, i) => (
                    <tr key={p.id} className={p.id === user.id ? 'own-row' : undefined}>
                      <td className="mono tiny dim">{i + 1}</td>
                      <td className="tiny">{t(POSITION_LABELS[p.position])}</td>
                      <td>
                        {p.id === user.id
                          ? <strong>{p.firstName} {p.lastName}</strong>
                          : `${p.firstName.charAt(0)}. ${p.lastName}`}
                      </td>
                      <td className="mono tiny">{computeOverall(p.attrs, p.position)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {eigenerRang > 0 && (
                <div className="tiny dim" style={{ marginTop: '0.35rem' }}>
                  {t('chronicle.ownRank', {
                    n: eigenerRang,
                    position: t(POSITION_LABELS[user.position]),
                  })}
                </div>
              )}
            </div>
          )}
          {game.wncHistory.length > 0 && (
            <table>
              <tbody>
                {game.wncHistory.slice().reverse().map((w) => (
                  <tr key={w.year}>
                    <td className="mono tiny">{w.year}</td>
                    <td>{t('chronicle.worldChampion')}<strong>{w.championName}</strong></td>
                    <td className="tiny">
                      {w.userNominated
                        ? <span className={w.userNationReached === 'won' ? 'pill good' : 'pill'}>
                            {t(`wnc.round.${w.userNationReached ?? 'group'}`)}
                            {w.userGoals > 0
                              ? ` · ${t('chronicle.goalsSuffix', { n: w.userGoals })}`
                              : ''}
                          </span>
                        : <span className="dim">{t('chronicle.notInvolved')}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      )}

      <Panel title={t('chronicle.title')}>
        {events.length === 0 && <Empty text={t('chronicle.empty')} />}
        <div className="scroll">
          {events.map((e) => (
            <div key={e.id} style={{
              display: 'grid', gridTemplateColumns: '92px 1fr', gap: '0.7rem',
              padding: '0.5rem 0', borderBottom: '1px solid var(--border-soft)',
            }}>
              <div>
                <div className="tiny dim">{formatDate(e.date)}</div>
                <span className="pill">{t(EVENT_KEYS[e.type] ?? 'event.unknown')}</span>
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

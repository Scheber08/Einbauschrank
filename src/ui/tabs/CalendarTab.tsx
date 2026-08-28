import { useMemo, useState } from 'react';
import {
  addDays, dayOfMonth, formatDate, isBefore, month, monthName, weekday, year,
} from '../../engine/date';
import { userClub } from '../../engine/game';
import { advanceUntil } from '../../state/actions';
import { useAppState } from '../../state/store';
import { Empty, Panel, rating, ratingColor } from '../components';
import { t } from '../../i18n';
import { useLocale } from '../../i18n/useLocale';

/**
 * Der Kalender.
 *
 * Er war eine reine Terminliste: man sah, wann gespielt wird, konnte aber
 * nichts damit anfangen. Weiterkommen ging nur ueber den Knopf in der
 * Seitenleiste, der bis zum naechsten Ereignis vorspult - wer drei Wochen
 * ueberspringen wollte, klickte dreissig Mal.
 *
 * Jetzt ist er das, was ein Karrierekalender sein soll: ein Ziel anklicken
 * und hinspringen. Angehalten wird nur bei Dingen, die eine Entscheidung
 * verlangen; alles andere laeuft durch und steht hinterher im Sammelbericht.
 */
export default function CalendarTab() {
  useLocale();
  const game = useAppState().game!;
  const club = userClub(game);
  const [showAll, setShowAll] = useState(false);
  const [eigeneSimulieren, setEigeneSimulieren] = useState(false);
  const [laeuft, setLaeuft] = useState(false);

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

  /** Eigene Partien nach Datum - fuer die Punkte im Monatsraster. */
  const eigeneNachTag = useMemo(() => {
    const map = new Map<string, typeof matches[number]>();
    if (!club) return map;
    for (const m of Object.values(game.matches)) {
      if (m.homeClubId !== club.id && m.awayClubId !== club.id) continue;
      map.set(m.date, m);
    }
    return map;
  }, [game.matches, club, game.version]);

  function springen(ziel: string) {
    if (game.retirement || laeuft) return;
    if (!isBefore(game.date, ziel)) return;
    setLaeuft(true);
    // Der Sammelbericht landet im Zustand; die Schale zeigt ihn an und
    // fuehrt die Folgedialoge. Lag er hier, war er weg, sobald ein
    // Ereignis den Reiter wechselt - also genau dann, wenn er am meisten
    // zu erzaehlen hat.
    advanceUntil(ziel, { eigeneSimulieren });
    setLaeuft(false);
  }

  const ziele: { label: string; datum: string }[] = [
    { label: t('calendar.jump.week'), datum: addDays(game.date, 7) },
    { label: t('calendar.jump.twoWeeks'), datum: addDays(game.date, 14) },
    { label: t('calendar.jump.month'), datum: addDays(game.date, 30) },
  ];

  return (
    <>
      <Panel title={t('calendar.skip.title')}>
        <div className="row" style={{ flexWrap: 'wrap', gap: '0.35rem' }}>
          {ziele.map((z) => (
            <button key={z.label} className="small" disabled={laeuft || !!game.retirement}
              onClick={() => springen(z.datum)}>
              {z.label}
            </button>
          ))}
          <label className="tiny dim row" style={{ gap: '0.3rem', marginLeft: 'auto' }}>
            <input type="checkbox" checked={eigeneSimulieren}
              onChange={(e) => setEigeneSimulieren(e.target.checked)} />
            {t('calendar.skip.simulateOwn')}
          </label>
        </div>
        <p className="tiny dim" style={{ marginTop: '0.45rem' }}>
          {eigeneSimulieren ? t('calendar.skip.hintSim') : t('calendar.skip.hintStop')}
        </p>
      </Panel>


      <Panel title={t('calendar.title')} action={
        <div className="row">
          <span className="chip" onClick={() => setShowAll(false)}
            style={{ opacity: showAll ? 0.55 : 1 }}>{t('calendar.ownMatches')}</span>
          <span className="chip" onClick={() => setShowAll(true)}
            style={{ opacity: showAll ? 1 : 0.55 }}>{t('calendar.allMatches')}</span>
        </div>
      }>
        {groups.length === 0 && <Empty text={t('calendar.empty')} />}
        <div className="scroll">
          {groups.map(([key, list]) => {
            const jahr = Number(key.slice(0, 4));
            const monat = Number(key.slice(5));
            return (
              <div key={key} style={{ marginBottom: '1rem' }}>
                <h4 style={{
                  position: 'sticky', top: 0, background: 'var(--panel)',
                  padding: '0.3rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem',
                }}>
                  {monthName(monat)} {jahr}
                </h4>

                <Monatsraster jahr={jahr} monat={monat} heute={game.date}
                  eigene={eigeneNachTag} clubId={club?.id ?? null}
                  gesperrt={laeuft || !!game.retirement}
                  onSpringen={springen} />

                <table>
                  <tbody>
                    {list.map((m) => {
                      const home = game.clubs[m.homeClubId];
                      const away = game.clubs[m.awayClubId];
                      const isUser = club && (m.homeClubId === club.id || m.awayClubId === club.id);
                      const comp = game.competitions[m.competitionId];
                      const erreichbar = !m.played && isBefore(game.date, m.date)
                        && !game.retirement;
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
                          <td style={{ width: 34 }}>
                            {erreichbar && (
                              <button className="small ghost" disabled={laeuft}
                                title={t('calendar.jump.toDate', { date: formatDate(m.date) })}
                                onClick={() => springen(m.date)}>&rsaquo;&rsaquo;</button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      </Panel>
    </>
  );
}

/**
 * Ein Monat als Raster.
 *
 * Eine Terminliste beantwortet "wann ist das naechste Spiel", ein Raster
 * beantwortet "wie dicht steht der Dezember" - und genau das will man wissen,
 * bevor man einen Sprung setzt.
 */
function Monatsraster({
  jahr, monat, heute, eigene, clubId, gesperrt, onSpringen,
}: {
  jahr: number;
  monat: number;
  heute: string;
  eigene: Map<string, { date: string; homeClubId: string; played: boolean }>;
  clubId: string | null;
  gesperrt: boolean;
  onSpringen: (datum: string) => void;
}) {
  const erster = `${jahr}-${String(monat).padStart(2, '0')}-01`;
  const tage: (string | null)[] = [];
  // Montag als erster Wochentag: weekday() liefert 0 fuer Sonntag.
  const vorlauf = (weekday(erster) + 6) % 7;
  for (let i = 0; i < vorlauf; i++) tage.push(null);
  for (let d = erster; month(d) === monat; d = addDays(d, 1)) tage.push(d);

  return (
    <div className="cal-grid">
      {tage.map((tag, i) => {
        if (!tag) return <span key={`leer-${i}`} className="cal-cell empty" />;
        const partie = eigene.get(tag);
        const daheim = partie && clubId ? partie.homeClubId === clubId : false;
        const vergangen = isBefore(tag, heute);
        const istHeute = tag === heute;
        const springbar = !gesperrt && isBefore(heute, tag);
        return (
          <button
            key={tag}
            className={[
              'cal-cell',
              vergangen ? 'past' : '',
              istHeute ? 'today' : '',
              partie ? (daheim ? 'home' : 'away') : '',
            ].filter(Boolean).join(' ')}
            disabled={!springbar}
            title={springbar ? t('calendar.jump.toDate', { date: formatDate(tag) }) : formatDate(tag)}
            onClick={() => springbar && onSpringen(tag)}
          >
            {dayOfMonth(tag)}
          </button>
        );
      })}
    </div>
  );
}

import { useMemo, useState } from 'react';
import { computeOverall } from '../../engine/attributes';
import { ageOn } from '../../engine/date';
import { userClub } from '../../engine/game';
import { selectLineup } from '../../engine/lineup';
import { clubSponsors } from '../../engine/identity';
import { nationCode, nationName } from '../../engine/nations';
import { t, tNumber } from '../../i18n';
import { useLocale } from '../../i18n/useLocale';
import { RELATION_LABELS, relationList } from '../../engine/relationships';
import { wageBill, wageRoom } from '../../engine/finance';
import { derbyKind, derbyLabel, rivalsOf } from '../../engine/rivalry';
import { squadOf } from '../../engine/worldGen';
import { TACTIC_LABELS, DIFFICULTY_SETTINGS } from '../../engine/types';
import { useAppState } from '../../state/store';
import ClubCrest from '../ClubCrest';
import FormationPitch from '../FormationPitch';
import { Empty, Meter, Panel, Pill, money, shortName } from '../components';

type SortKey = 'position' | 'ability' | 'age' | 'form' | 'value';

export default function SquadTab() {
  useLocale();
  const game = useAppState().game!;
  const club = userClub(game);
  const [sort, setSort] = useState<SortKey>('position');

  const squad = useMemo(
    () => (club ? squadOf(game.players, club.id) : []),
    [club, game.players, game.version],
  );

  const lineup = useMemo(() => {
    if (!club || squad.length === 0) return null;
    return selectLineup(club, squad, {
      coachRelation: game.coachRelation,
      userBonus: DIFFICULTY_SETTINGS[game.difficulty].playtimeBonus,
    });
  }, [club, squad, game.coachRelation, game.difficulty, game.version]);

  const starterIds = new Set(lineup?.starters.map((s) => s.playerId) ?? []);
  const sponsors = club ? clubSponsors(club) : { shirt: '-', kit: '-' };
  // Wie viel Gehalt der Verein noch vergeben kann - als Stufe, nicht als
  // Zahl: Die genaue Summe waere eine Auskunft, die ein Spieler nicht haette.
  const kassenlage = (() => {
    if (!club) return { stufe: 'plenty' as const, eng: false };
    const last = wageBill(game, club.id);
    const raum = wageRoom(club, last);
    const anteil = raum / Math.max(1, club.wageBudget);
    if (anteil <= 0) return { stufe: 'none' as const, eng: true };
    if (anteil < 0.06) return { stufe: 'tight' as const, eng: true };
    if (anteil < 0.18) return { stufe: 'some' as const, eng: false };
    return { stufe: 'plenty' as const, eng: false };
  })();
  const rivals = useMemo(
    () => (club ? rivalsOf(game, club.id) : []),
    [club, game.clubs, game.version],
  );
  const benchIds = new Set(lineup?.bench ?? []);

  const sorted = useMemo(() => {
    const order = ['TW', 'IV', 'LV', 'RV', 'DM', 'ZM', 'OM', 'LA', 'RA', 'ST'];
    return squad.slice().sort((a, b) => {
      switch (sort) {
        case 'ability':
          return computeOverall(b.attrs, b.position) - computeOverall(a.attrs, a.position);
        case 'age':
          return ageOn(a.birthDate, game.date) - ageOn(b.birthDate, game.date);
        case 'form': return b.form - a.form;
        case 'value': return b.marketValue - a.marketValue;
        default:
          return order.indexOf(a.position) - order.indexOf(b.position)
            || computeOverall(b.attrs, b.position) - computeOverall(a.attrs, a.position);
      }
    });
  }, [squad, sort, game.date]);

  if (!club) return <Panel><Empty text={t('empty.noClub')} /></Panel>;

  return (
    <>
      <Panel title={club.name} action={
        <div className="row">
          <Pill>{club.formation}</Pill>
          <Pill>{t('club.reputation')} {club.reputation}</Pill>
        </div>
      }>
        <div className="grid four">
          <div className="stat"><div className="value">{squad.length}</div>
            <div className="label">{t('squad.size')}</div></div>
          <div className="stat">
            <div className="value">{lineup ? Math.round(lineup.attack) : '-'}</div>
            <div className="label">{t('squad.attack')}</div>
          </div>
          <div className="stat">
            <div className="value">{lineup ? Math.round(lineup.midfield) : '-'}</div>
            <div className="label">{t('squad.midfield')}</div>
          </div>
          <div className="stat">
            <div className="value">{lineup ? Math.round(lineup.defence) : '-'}</div>
            <div className="label">{t('squad.defence')}</div>
          </div>
        </div>
        {lineup && (
          <div style={{ marginTop: '0.9rem' }}>
            <div className="row between" style={{ marginBottom: '0.4rem' }}>
              <span className="tiny dim">{t('squad.expectedEleven')}</span>
              <span className="tiny dim">
                {starterIds.has(game.userPlayerId) ? t('squad.youStart')
                  : benchIds.has(game.userPlayerId) ? t('squad.youAreBenched')
                  : t('squad.youAreOut')}
              </span>
            </div>
            <div style={{ maxWidth: 340, margin: '0 auto' }}>
              <FormationPitch
                slots={lineup.starters}
                players={game.players}
                colors={club.colors}
                formation={club.formation}
                userPlayerId={game.userPlayerId}
              />
            </div>
          </div>
        )}

        <div className="grid two" style={{ marginTop: '0.9rem' }}>
          <div>
            <Meter label={t('club.trainingFacilities')} value={club.training} />
            <Meter label={t('club.youthWork')} value={club.youth} />
          </div>
          <div className="small muted">
            <div className="row between"><span>{t('club.manager')}</span><span>{club.managerName}</span></div>
            <div className="row between"><span>{t('club.stadium')}</span><span>{club.stadiumName}</span></div>
            <div className="row between"><span>{t('club.capacity')}</span>
              <span>{tNumber(club.stadiumCapacity)}</span></div>
            <div className="row between"><span>{t('club.playStyle')}</span>
              <span>{t(TACTIC_LABELS[club.tacticStyle])}</span></div>
            <div className="row between"><span>{t('club.shirtSponsor')}</span><span>{sponsors.shirt}</span></div>
            <div className="row between"><span>{t('club.kitMaker')}</span><span>{sponsors.kit}</span></div>
            {/* Die Kassenlage entscheidet, ob der Verein eine Gehaltsforderung
                erfuellen und ueberhaupt noch einkaufen kann. Ohne diese Zeile
                waere das eine unsichtbare Wand: Der Berater kaeme mit leeren
                Haenden zurueck, ohne dass man je haette wissen koennen, warum. */}
            <div className="row between"><span>{t('club.wageRoom')}</span>
              <span className={kassenlage.eng ? 'bad' : undefined}>
                {t(`club.wageRoom.${kassenlage.stufe}`)}
              </span></div>
            <div className="row between"><span>{t('club.transferFunds')}</span>
              <span>{money(club.budget)}</span></div>
          </div>
        </div>

        {rivals.length > 0 && (
          <div style={{ marginTop: '0.9rem', paddingTop: '0.7rem', borderTop: '1px solid var(--border-soft)' }}>
            <div className="tiny dim" style={{ marginBottom: '0.4rem' }}>{t('club.rivals')}</div>
            <div className="row" style={{ gap: '0.6rem', flexWrap: 'wrap' }}>
              {rivals.map((r) => (
                <div key={r.id} className="row" style={{ gap: '0.4rem', alignItems: 'center' }}>
                  <ClubCrest club={r} size={22} />
                  <div>
                    <div className="small">{r.name}</div>
                    <div className="tiny dim">{derbyLabel(derbyKind(club, r, game.clubs))}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Panel>

      <RelationshipsPanel />

      <Panel title={t('squad.title')} action={
        <div className="chip-row">
          {([['position', 'squad.position'], ['ability', 'squad.overall'],
            ['age', 'squad.age'], ['form', 'squad.form'],
            ['value', 'squad.value']] as [SortKey, string][]).map(([key, label]) => (
            <span key={key} className={`chip ${sort === key ? 'active' : ''}`}
              onClick={() => setSort(key)}>{t(label)}</span>
          ))}
        </div>
      }>
        <div className="scroll">
          <table>
            <thead>
              <tr>
                <th style={{ width: 30 }}>#</th>
                <th>{t('squad.name')}</th>
                <th style={{ width: 34 }}>{t('squad.country')}</th>
                <th>{t('squad.position')}</th>
                <th className="num">{t('squad.age')}</th>
                <th className="num">{t('squad.overall')}</th>
                <th className="num">{t('squad.form')}</th>
                <th className="num">{t('squad.fitness')}</th>
                <th className="num">{t('squad.value')}</th>
                <th>{t('squad.status')}</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((p) => {
                const ability = computeOverall(p.attrs, p.position);
                return (
                  <tr key={p.id} className={p.isUser ? 'user' : ''}>
                    <td className="dim mono tiny">{p.shirtNumber}</td>
                    <td>
                      {p.isUser ? <strong>{p.firstName} {p.lastName}</strong>
                        : shortName(p.firstName, p.lastName)}
                    </td>
                    <td className="tiny dim mono" title={nationName(p.nationality)}>
                      {nationCode(p.nationality)}
                    </td>
                    <td className="tiny muted">{p.position}</td>
                    <td className="num mono">{ageOn(p.birthDate, game.date)}</td>
                    <td className="num mono"><strong>{ability}</strong></td>
                    <td className="num mono">{Math.round(p.form)}</td>
                    <td className="num mono">{Math.round(p.fitness)}</td>
                    <td className="num tiny dim">{money(p.marketValue)}</td>
                    <td className="tiny">
                      {p.injury ? <span className="pill bad">{t(p.injury.name)}</span>
                        : p.suspension > 0 ? <span className="pill warn">{t('squad.suspended')}</span>
                        : starterIds.has(p.id) ? <span className="pill good">{t('squad.starter')}</span>
                        : benchIds.has(p.id) ? <span className="pill">{t('squad.bench')}</span>
                        : <span className="dim">{t('squad.stand')}</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="tiny dim" style={{ marginTop: '0.6rem', marginBottom: 0 }}>
          Startelf und Bank sind die aktuelle Einschaetzung des Trainers. Sie kann sich
          durch Form, Fitness und deine Trainerbeziehung von Spiel zu Spiel aendern.
        </p>
      </Panel>
    </>
  );
}

function RelationshipsPanel() {
  const game = useAppState().game!;
  const relations = useMemo(() => relationList(game), [game.version]);
  if (relations.filter((r) => r.kind !== 'neutral').length === 0) return null;

  const tone = (kind: string) => (kind === 'mentor' || kind === 'friend' ? 'good'
    : kind === 'rival' || kind === 'conflict' ? 'bad' : undefined);

  return (
    <Panel title={t('squad.relations')}>
      <p className="tiny dim" style={{ marginTop: 0 }}>
        Gute Freunde bieten sich im Spiel haeufiger an, ein starkes Umfeld hebt deine Moral.
        Beziehungen entwickeln sich mit gemeinsamer Spielzeit.
      </p>
      <div className="grid two">
        {relations.filter((r) => r.kind !== 'neutral').map((r) => {
          const p = game.players[r.playerId];
          if (!p) return null;
          return (
            <div className="row between small" key={r.playerId}
              style={{ padding: '0.25rem 0', borderBottom: '1px solid var(--border-soft)' }}>
              <span>
                {shortName(p.firstName, p.lastName)}
                <span className="tiny dim"> · {p.position}</span>
              </span>
              <Pill tone={tone(r.kind) as 'good' | 'bad' | undefined}>
                {t(RELATION_LABELS[r.kind])}{' '}
                {r.value > 0 ? `+${Math.round(r.value)}` : Math.round(r.value)}
              </Pill>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

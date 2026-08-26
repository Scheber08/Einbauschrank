import { useMemo, useState } from 'react';
import { computeOverall } from '../../engine/attributes';
import { ageOn } from '../../engine/date';
import { userClub } from '../../engine/game';
import { selectLineup } from '../../engine/lineup';
import { clubSponsors } from '../../engine/identity';
import { RELATION_LABELS, relationList } from '../../engine/relationships';
import { derbyKind, derbyLabel, rivalsOf } from '../../engine/rivalry';
import { squadOf } from '../../engine/worldGen';
import { DIFFICULTY_SETTINGS } from '../../engine/types';
import { useAppState } from '../../state/store';
import ClubCrest from '../ClubCrest';
import FormationPitch from '../FormationPitch';
import { Empty, Meter, Panel, Pill, money, shortName } from '../components';

type SortKey = 'position' | 'ability' | 'age' | 'form' | 'value';

export default function SquadTab() {
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

  if (!club) return <Panel><Empty text="Kein Verein." /></Panel>;

  return (
    <>
      <Panel title={club.name} action={
        <div className="row">
          <Pill>{club.formation}</Pill>
          <Pill>Reputation {club.reputation}</Pill>
        </div>
      }>
        <div className="grid four">
          <div className="stat"><div className="value">{squad.length}</div><div className="label">Kadergroesse</div></div>
          <div className="stat">
            <div className="value">{lineup ? Math.round(lineup.attack) : '-'}</div>
            <div className="label">Angriff</div>
          </div>
          <div className="stat">
            <div className="value">{lineup ? Math.round(lineup.midfield) : '-'}</div>
            <div className="label">Mittelfeld</div>
          </div>
          <div className="stat">
            <div className="value">{lineup ? Math.round(lineup.defence) : '-'}</div>
            <div className="label">Abwehr</div>
          </div>
        </div>
        {lineup && (
          <div style={{ marginTop: '0.9rem' }}>
            <div className="row between" style={{ marginBottom: '0.4rem' }}>
              <span className="tiny dim">Voraussichtliche Startelf</span>
              <span className="tiny dim">
                {starterIds.has(game.userPlayerId) ? 'Du stehst in der Startelf'
                  : benchIds.has(game.userPlayerId) ? 'Du sitzt auf der Bank'
                  : 'Du bist derzeit nicht im Kader'}
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
            <Meter label="Trainingsanlagen" value={club.training} />
            <Meter label="Nachwuchsarbeit" value={club.youth} />
          </div>
          <div className="small muted">
            <div className="row between"><span>Trainer</span><span>{club.managerName}</span></div>
            <div className="row between"><span>Stadion</span><span>{club.stadiumName}</span></div>
            <div className="row between"><span>Kapazitaet</span>
              <span>{club.stadiumCapacity.toLocaleString('de-DE')}</span></div>
            <div className="row between"><span>Spielstil</span><span>{club.tacticStyle}</span></div>
            <div className="row between"><span>Trikotsponsor</span><span>{sponsors.shirt}</span></div>
            <div className="row between"><span>Ausruester</span><span>{sponsors.kit}</span></div>
          </div>
        </div>

        {rivals.length > 0 && (
          <div style={{ marginTop: '0.9rem', paddingTop: '0.7rem', borderTop: '1px solid var(--border-soft)' }}>
            <div className="tiny dim" style={{ marginBottom: '0.4rem' }}>Rivalen</div>
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

      <Panel title="Kader" action={
        <div className="chip-row">
          {([['position', 'Position'], ['ability', 'Staerke'], ['age', 'Alter'],
            ['form', 'Form'], ['value', 'Wert']] as [SortKey, string][]).map(([key, label]) => (
            <span key={key} className={`chip ${sort === key ? 'active' : ''}`}
              onClick={() => setSort(key)}>{label}</span>
          ))}
        </div>
      }>
        <div className="scroll">
          <table>
            <thead>
              <tr>
                <th style={{ width: 30 }}>#</th>
                <th>Name</th>
                <th>Pos</th>
                <th className="num">Alter</th>
                <th className="num">Staerke</th>
                <th className="num">Form</th>
                <th className="num">Fit</th>
                <th className="num">Wert</th>
                <th>Status</th>
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
                    <td className="tiny muted">{p.position}</td>
                    <td className="num mono">{ageOn(p.birthDate, game.date)}</td>
                    <td className="num mono"><strong>{ability}</strong></td>
                    <td className="num mono">{Math.round(p.form)}</td>
                    <td className="num mono">{Math.round(p.fitness)}</td>
                    <td className="num tiny dim">{money(p.marketValue)}</td>
                    <td className="tiny">
                      {p.injury ? <span className="pill bad">{p.injury.name}</span>
                        : p.suspension > 0 ? <span className="pill warn">Gesperrt</span>
                        : starterIds.has(p.id) ? <span className="pill good">Startelf</span>
                        : benchIds.has(p.id) ? <span className="pill">Bank</span>
                        : <span className="dim">Tribuene</span>}
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
    <Panel title="Beziehungen im Team">
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
                {RELATION_LABELS[r.kind]} {r.value > 0 ? `+${Math.round(r.value)}` : Math.round(r.value)}
              </Pill>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

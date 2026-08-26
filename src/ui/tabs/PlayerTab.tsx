import { useState } from 'react';
import {
  ATTR_GROUPS, POSITION_LABELS, computeOverall, effectiveOverall,
} from '../../engine/attributes';
import { BACKGROUNDS } from '../../engine/backgrounds';
import { nationName } from '../../engine/nations';
import { ageOn, formatShort } from '../../engine/date';
import { userClub } from '../../engine/game';
import { renewContract } from '../../state/actions';
import { useAppState } from '../../state/store';
import AttributeRadar from '../AttributeRadar';
import { AttrList, Meter, Panel, Pill, money, salary } from '../components';

export default function PlayerTab() {
  const game = useAppState().game!;
  const user = game.players[game.userPlayerId];
  const club = userClub(game);
  const league = club ? game.competitions[club.leagueId] : null;
  const [group, setGroup] = useState(user.position === 'TW' ? 'goalkeeping' : 'technical');

  const ability = computeOverall(user.attrs, user.position);
  const showPotential = game.difficulty !== 'schwer' && game.difficulty !== 'simulation';

  const bg = user.background ? BACKGROUNDS[user.background] : null;

  const activeGroup = ATTR_GROUPS.find((g) => g.key === group) ?? ATTR_GROUPS[0];

  // Staerkste und schwaechste Gruppe - der Radar zeigt es, die Worte benennen es.
  const groupMeans = ATTR_GROUPS
    .filter((g) => (g.key === 'goalkeeping' ? user.position === 'TW' : true))
    .map((g) => ({
      label: g.label,
      value: g.attrs.reduce((a, k) => a + (user.attrs[k] ?? 0), 0) / Math.max(1, g.attrs.length),
    }));
  const strongest = groupMeans.reduce((b, g) => (g.value > b.value ? g : b), groupMeans[0]);
  const weakest = groupMeans.reduce((b, g) => (g.value < b.value ? g : b), groupMeans[0]);

  return (
    <>
      <Panel title={`${user.firstName} ${user.lastName}`} action={
        <div className="row">
          <Pill>Nr. {user.shirtNumber}</Pill>
          <Pill>{user.foot === 'links' ? 'Linksfuss' : 'Rechtsfuss'}</Pill>
        </div>
      }>
        <div className="grid four">
          <div className="stat"><div className="value">{ability}</div><div className="label">Gesamtstaerke</div></div>
          <div className="stat">
            <div className="value">{showPotential ? user.potential : '?'}</div>
            <div className="label">Potenzial</div>
          </div>
          <div className="stat"><div className="value">{ageOn(user.birthDate, game.date)}</div><div className="label">Alter</div></div>
          <div className="stat"><div className="value">{user.reputation}</div><div className="label">Reputation</div></div>
        </div>

        <div className="grid two" style={{ marginTop: '0.9rem' }}>
          <div>
            <div className="row between small"><span className="muted">Position</span>
              <span>{POSITION_LABELS[user.position]}</span></div>
            <div className="row between small"><span className="muted">Nebenpositionen</span>
              <span>{user.altPositions.length ? user.altPositions.join(', ') : '-'}</span></div>
            <div className="row between small"><span className="muted">Nationalitaet</span>
              <span>{nationName(user.nationality)}</span></div>
            <div className="row between small"><span className="muted">Geboren</span>
              <span>{formatShort(user.birthDate)}</span></div>
            <div className="row between small"><span className="muted">Groesse / Gewicht</span>
              <span>{user.height} cm / {user.weight} kg</span></div>
            <div className="row between small"><span className="muted">Marktwert</span>
              <span>{money(user.marketValue)}</span></div>
          </div>
          <div>
            <Meter label="Form" value={user.form} />
            <Meter label="Fitness" value={user.fitness} />
            <Meter label="Moral" value={user.morale} />
            <Meter label="Selbstvertrauen" value={user.confidence} />
            <Meter label="Spielpraxis" value={user.sharpness} />
          </div>
        </div>

        {bg && (
          <p className="tiny dim" style={{ marginTop: '0.6rem', marginBottom: 0 }}>
            Hintergrund: {bg.name} - {bg.description}
          </p>
        )}
      </Panel>

      <Panel title="Profil">
        <div className="profile-split">
          <AttributeRadar player={user} />
          <div className="small muted">
            <p style={{ marginTop: 0 }}>
              Das Netz zeigt den Durchschnitt jeder Attributgruppe. Es macht auf
              einen Blick sichtbar, welcher Spielertyp du geworden bist - und wo
              gezieltes Training am meisten bewirkt.
            </p>
            <div className="row between small">
              <span className="muted">Staerkste Gruppe</span>
              <span style={{ color: 'var(--accent)' }}>{strongest.label}</span>
            </div>
            <div className="row between small">
              <span className="muted">Schwaechste Gruppe</span>
              <span style={{ color: 'var(--warn)' }}>{weakest.label}</span>
            </div>
          </div>
        </div>
      </Panel>

      <Panel title="Attribute" action={
        <div className="chip-row">
          {ATTR_GROUPS.map((g) => (
            <span key={g.key} className={`chip ${group === g.key ? 'active' : ''}`}
              onClick={() => setGroup(g.key)}>{g.label}</span>
          ))}
        </div>
      }>
        <AttrList attrs={user.attrs} keys={activeGroup.attrs} />
      </Panel>

      <div className="grid two">
        <Panel title="Positionsstaerken">
          <p className="tiny dim">
            So stark waerst du auf anderen Positionen. Fremde Rollen kosten Leistung.
          </p>
          {[user.position, ...user.altPositions,
            ...(['IV', 'ZM', 'OM', 'ST'] as const).filter(
              (p) => p !== user.position && !user.altPositions.includes(p))]
            .slice(0, 6)
            .map((pos) => {
              const value = effectiveOverall(user.attrs, user.position, user.altPositions, pos);
              return (
                <div className="row between small" key={pos} style={{ padding: '0.2rem 0' }}>
                  <span className="muted">{POSITION_LABELS[pos]}</span>
                  <span className="row" style={{ gap: 8, flexWrap: 'nowrap' }}>
                    <span className="bar" style={{ width: 110 }}>
                      <span style={{ width: `${value}%`, background: pos === user.position ? '#2fae63' : '#3a8fd0' }} />
                    </span>
                    <span className="mono" style={{ width: 24, textAlign: 'right' }}>{value}</span>
                  </span>
                </div>
              );
            })}
        </Panel>

        <Panel title="Vertrag">
          {!user.contract && <p className="muted small">Kein laufender Vertrag.</p>}
          {user.contract && (
            <>
              <div className="row between small"><span className="muted">Verein</span><span>{club?.name}</span></div>
              <div className="row between small"><span className="muted">Liga</span><span>{league?.name}</span></div>
              <div className="row between small"><span className="muted">Rolle</span><span>{user.contract.role}</span></div>
              <div className="row between small"><span className="muted">Gehalt</span><span>{salary(user.contract.salary)}</span></div>
              <div className="row between small"><span className="muted">Laufzeit bis</span><span>{formatShort(user.contract.until)}</span></div>
              {user.contract.goalBonus > 0 && (
                <div className="row between small"><span className="muted">Torpraemie</span>
                  <span>{user.contract.goalBonus.toLocaleString('de-DE')} EUR</span></div>
              )}
              <div className="row" style={{ marginTop: '0.8rem' }}>
                <button className="small" onClick={() => renewContract(3)}>Um 3 Jahre verlaengern</button>
                <button className="small ghost" onClick={() => renewContract(5)}>Um 5 Jahre</button>
              </div>
            </>
          )}
        </Panel>
      </div>
    </>
  );
}

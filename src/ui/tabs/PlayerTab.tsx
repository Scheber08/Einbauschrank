import { DIFFICULTY_SETTINGS } from '../../engine/types';
import { useState } from 'react';
import {
  ATTR_GROUPS, POSITION_LABELS, computeOverall, effectiveOverall,
} from '../../engine/attributes';
import { BACKGROUNDS } from '../../engine/backgrounds';
import { isFinalContractSeason } from '../../engine/contract';
import { nationName } from '../../engine/nations';
import { t, tNumber } from '../../i18n';
import { useLocale } from '../../i18n/useLocale';
import { ageOn, formatShort } from '../../engine/date';
import { userClub } from '../../engine/game';
import { traitLabelKey } from '../../engine/traits';
import PlayerCard from '../PlayerCard';
import { renewContract } from '../../state/actions';
import { useAppState } from '../../state/store';
import AttributeRadar from '../AttributeRadar';
import { AttrList, Meter, Panel, Pill, money, salary } from '../components';

export default function PlayerTab() {
  useLocale();
  const game = useAppState().game!;
  const user = game.players[game.userPlayerId];
  const club = userClub(game);
  const league = club ? game.competitions[club.leagueId] : null;
  const [group, setGroup] = useState(user.position === 'TW' ? 'goalkeeping' : 'technical');

  const ability = computeOverall(user.attrs, user.position);
  const showPotential = DIFFICULTY_SETTINGS[game.difficulty].showPotential;

  const bg = user.background ? BACKGROUNDS[user.background] : null;

  const activeGroup = ATTR_GROUPS.find((g) => g.key === group) ?? ATTR_GROUPS[0];

  // Staerkste und schwaechste Gruppe - der Radar zeigt es, die Worte benennen es.
  const groupMeans = ATTR_GROUPS
    .filter((g) => (g.key === 'goalkeeping' ? user.position === 'TW' : true))
    .map((g) => ({
      label: t(g.label),
      value: g.attrs.reduce((a, k) => a + (user.attrs[k] ?? 0), 0) / Math.max(1, g.attrs.length),
    }));
  const strongest = groupMeans.reduce((b, g) => (g.value > b.value ? g : b), groupMeans[0]);
  const weakest = groupMeans.reduce((b, g) => (g.value < b.value ? g : b), groupMeans[0]);

  return (
    <>
      <Panel title={`${user.firstName} ${user.lastName}`} action={
        <div className="row">
          <Pill>Nr. {user.shirtNumber}</Pill>
          <Pill>{t(user.foot === 'links' ? 'player.leftFooted' : 'player.rightFooted')}</Pill>
        </div>
      }>
        <div className="grid four">
          <div className="stat"><div className="value">{ability}</div>
            <div className="label">{t('player.overall')}</div></div>
          <div className="stat">
            <div className="value">{showPotential ? user.potential : '?'}</div>
            <div className="label">{t('player.potential')}</div>
          </div>
          <div className="stat"><div className="value">{ageOn(user.birthDate, game.date)}</div>
            <div className="label">{t('squad.age')}</div></div>
          <div className="stat"><div className="value">{user.reputation}</div>
            <div className="label">{t('club.reputation')}</div></div>
        </div>

        <div className="grid two" style={{ marginTop: '0.9rem' }}>
          <div>
            <div className="row between small"><span className="muted">{t('squad.position')}</span>
              <span>{t(t(POSITION_LABELS[user.position]))}</span></div>
            <div className="row between small"><span className="muted">{t('player.altPositions')}</span>
              <span>{user.altPositions.length ? user.altPositions.join(', ') : '-'}</span></div>
            <div className="row between small"><span className="muted">{t('player.nationality')}</span>
              <span>{nationName(user.nationality)}</span></div>
            <div className="row between small"><span className="muted">{t('player.born')}</span>
              <span>{formatShort(user.birthDate)}</span></div>
            <div className="row between small"><span className="muted">{t('player.heightWeight')}</span>
              <span>{user.height} cm / {user.weight} kg</span></div>
            <div className="row between small"><span className="muted">{t('player.marketValue')}</span>
              <span>{money(user.marketValue)}</span></div>
          </div>
          <div>
            <Meter label={t('player.form')} value={user.form} />
            <Meter label={t('player.fitness')} value={user.fitness} />
            <Meter label={t('player.morale')} value={user.morale} />
            <Meter label={t('player.confidence')} value={user.confidence} />
            <Meter label={t('training.sharpness')} value={user.sharpness} />
          </div>
        </div>

        {/* Der Kartenstand stand nirgends. Ohne ihn gibt es die Anspannung nicht,
            die vier Verwarnungen im Fussball ausmachen - man erfaehrt von der
            Sperre erst, wenn sie da ist. */}
        {(user.yellowCardsInLeague > 0 || user.suspension > 0) && (
          <div className='row' style={{ marginTop: '0.6rem', gap: 8, flexWrap: 'wrap' }}>
            {user.yellowCardsInLeague > 0 && (
              <Pill tone={user.yellowCardsInLeague >= 4 ? 'bad' : undefined}>
                {t('player.yellowCards')}: {user.yellowCardsInLeague} / 5
              </Pill>
            )}
            {user.yellowCardsInLeague === 4 && (
              <span className='tiny' style={{ color: 'var(--bad, #c86)' }}>
                {t('player.yellowWarn')}
              </span>
            )}
            {user.suspension > 0 && (
              <Pill tone='bad'>{t('shell.suspendedGames', { n: user.suspension })}</Pill>
            )}
          </div>
        )}

        {bg && (
          <p className="tiny dim" style={{ marginTop: '0.6rem', marginBottom: 0 }}>
            {t('player.background', { name: t(bg.name), description: t(bg.description) })}
          </p>
        )}
      </Panel>

      <Panel title={t('player.profile')}>
        <div className="profile-split">
          <AttributeRadar player={user} />
          <div className="small muted">
            <p style={{ marginTop: 0 }}>{t('player.radarHint')}</p>
            <div className="row between small">
              <span className="muted">{t('player.strongestGroup')}</span>
              <span style={{ color: 'var(--accent)' }}>{strongest.label}</span>
            </div>
            <div className="row between small">
              <span className="muted">{t('player.weakestGroup')}</span>
              <span style={{ color: 'var(--warn)' }}>{weakest.label}</span>
            </div>
          </div>
        </div>
      </Panel>

      {/* Die Karte zuerst: sechs Werte, eine Zahl, ein Gesicht. Die Akte
          darunter listet weiter alle 54 Attribute - fuer den, der an
          einem einzelnen arbeitet. */}
      <div className="row" style={{ justifyContent: 'center', margin: '0 0 0.75rem' }}>
        <PlayerCard player={user} club={club ?? null} traits={game.traits ?? []} />
      </div>

      {/* Die Handschrift des Spielers. Ein Spieler bestand aus 54 Zahlen
          und sonst nichts - zwei Stuermer mit derselben Gesamtstaerke
          waren nicht zu unterscheiden. */}
      <Panel title={t('player.traits')}>
        {(game.traits ?? []).length === 0 ? (
          <p className="small muted">{t('player.traitsEmpty')}</p>
        ) : (
          <div>
            {(game.traits ?? []).map((k) => (
              <div key={k} className="row between" style={{ marginBottom: '0.35rem' }}>
                <strong>{t(traitLabelKey(k))}</strong>
                <span className="tiny dim" style={{ textAlign: 'right', maxWidth: '62%' }}>
                  {t(`trait.${k}.desc`)}
                </span>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel title={t('player.attributes')} action={
        <div className="chip-row">
          {ATTR_GROUPS.map((g) => (
            <span key={g.key} className={`chip ${group === g.key ? 'active' : ''}`}
              onClick={() => setGroup(g.key)}>{t(g.label)}</span>
          ))}
        </div>
      }>
        <AttrList attrs={user.attrs} keys={activeGroup.attrs} />
      </Panel>

      <div className="grid two">
        <Panel title={t('player.positionStrengths')}>
          <p className="tiny dim">
            {t('player.positionHint')}
          </p>
          {[user.position, ...user.altPositions,
            ...(['IV', 'ZM', 'OM', 'ST'] as const).filter(
              (p) => p !== user.position && !user.altPositions.includes(p))]
            .slice(0, 6)
            .map((pos) => {
              const value = effectiveOverall(user.attrs, user.position, user.altPositions, pos);
              return (
                <div className="row between small" key={pos} style={{ padding: '0.2rem 0' }}>
                  <span className="muted">{t(t(POSITION_LABELS[pos]))}</span>
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

        <Panel title={t('contract.title')}>
          {!user.contract && <p className="muted small">{t('contract.none')}</p>}
          {/* Ein auslaufender Vertrag darf nicht nur im Postfach stehen - er
              entscheidet darueber, ob man den Verein im Sommer verlaesst. */}
          {user.contract && isFinalContractSeason(game) && (
            <div className="pill warn" style={{ display: 'block', marginBottom: '0.6rem' }}>
              {t('contract.expiryWarning')}
            </div>
          )}
          {user.contract && (
            <>
              <div className="row between small"><span className="muted">{t('contract.club')}</span>
                <span>{club?.name}</span></div>
              <div className="row between small"><span className="muted">{t('contract.league')}</span>
                <span>{league?.name}</span></div>
              <div className="row between small"><span className="muted">{t('contract.role')}</span>
                <span>{t(`role.${user.contract.role}`)}</span></div>
              <div className="row between small"><span className="muted">{t('contract.salary')}</span>
                <span>{salary(user.contract.salary)}</span></div>
              <div className="row between small"><span className="muted">{t('contract.until')}</span>
                <span>{formatShort(user.contract.until)}</span></div>
              {user.contract.goalBonus > 0 && (
                <div className="row between small"><span className="muted">{t('contract.goalBonus')}</span>
                  <span>{tNumber(user.contract.goalBonus)} EUR</span></div>
              )}
              <div className="row" style={{ marginTop: '0.8rem' }}>
                <button className="small" onClick={() => renewContract(3)}>
                  {t('contract.extendYears', { n: 3 })}</button>
                <button className="small ghost" onClick={() => renewContract(5)}>
                  {t('contract.extendYearsShort', { n: 5 })}</button>
              </div>
            </>
          )}
        </Panel>
      </div>
    </>
  );
}

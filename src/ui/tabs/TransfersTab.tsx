import { AGENT_TASK_LABELS, agentAvailability } from '../../engine/agent';
import { POSITION_LABELS } from '../../engine/attributes';
import { competitionOutlook, positionCompetition } from '../../engine/competition';
import { formatShort } from '../../engine/date';
import { userClub } from '../../engine/game';
import { clubSponsors } from '../../engine/identity';
import type { AgentTaskKind } from '../../engine/types';
import { acceptOffer, declineAllOffers, requestAgentTask } from '../../state/actions';
import { useAppState } from '../../state/store';
import ClubCrest from '../ClubCrest';
import { Empty, Meter, Panel, Pill, money, salary } from '../components';
import { feeShare } from '../../engine/finance';
import { t, tNumber } from '../../i18n';
import { useLocale } from '../../i18n/useLocale';

export default function TransfersTab() {
  useLocale();
  const game = useAppState().game!;
  const user = game.players[game.userPlayerId];
  const club = userClub(game);

  return (
    <>
      <Panel title={t('transfers.market')}>
        <div className="grid four">
          <div className="stat"><div className="value">{money(user.marketValue)}</div><div className="label">{t('player.marketValue')}</div></div>
          <div className="stat"><div className="value">{Math.round(user.reputation)}</div><div className="label">{t('club.reputation')}</div></div>
          <div className="stat"><div className="value">{game.offers.length}</div><div className="label">{t('transfers.offersHeading')}</div></div>
          <div className="stat">
            <div className="value">{user.contract ? formatShort(user.contract.until).slice(6) : '-'}</div>
            <div className="label">{t('transfers.contractUntil')}</div>
          </div>
        </div>
        <div className="grid two" style={{ marginTop: '0.8rem' }}>
          <Meter label={t('agent.coachRelation')} value={game.coachRelation} />
          <Meter label={t('agent.fanRelation')} value={game.fanRelation} />
        </div>
        {game.loan && (
          <p className="small" style={{ marginBottom: 0, color: 'var(--warn)' }}>
            {t('transfers.loanNote', {
              until: formatShort(game.loan.until),
              club: club?.name ?? '',
              parent: game.clubs[game.loan.parentClubId]?.name ?? '',
            })}
          </p>
        )}
      </Panel>

      <AgentPanel />

      <Panel title={t('transfers.offers')} action={
        game.offers.length > 0
          ? <button className="small ghost" onClick={declineAllOffers}>{t('transfers.rejectAll')}</button>
          : undefined
      }>
        {game.offers.length === 0 && (
          <Empty text={t('transfers.noOffers')} />
        )}
        <div className="grid two">
          {/* Wer schon unterschrieben hat, soll das dauerhaft sehen -
              samt dem, was ihn bis zum Saisonende erwartet. */}
          {game.preContract && (() => {
            const ziel = game.clubs[game.preContract.clubId];
            if (!ziel) return null;
            return (
              <div className="panel offer-card" style={{ margin: 0 }}>
                <div className="row" style={{ gap: '0.6rem', alignItems: 'center' }}>
                  <ClubCrest club={ziel} size={44} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 680 }}>{ziel.name}</div>
                    <div className="tiny dim">{t('transfers.preSigned')}</div>
                  </div>
                  <Pill tone="good">{t('transfers.preContract')}</Pill>
                </div>
                <p className="small muted" style={{ margin: '0.6rem 0 0' }}>
                  {t('transfers.preSignedBody', {
                    club: ziel.name,
                    role: t(`role.${game.preContract.role}`),
                    salary: tNumber(game.preContract.salary),
                  })}
                </p>
              </div>
            );
          })()}
          {game.offers.map((offer) => {
            const offerClub = game.clubs[offer.clubId];
            const league = offerClub ? game.competitions[offerClub.leagueId] : null;
            if (!offerClub) return null;
            const better = offer.leagueLevel < (club
              ? game.competitions[club.leagueId]?.level ?? 3 : 3);
            const sponsors = clubSponsors(offerClub);
            const raise = user.contract
              ? Math.round((offer.salary / Math.max(1, user.contract.salary) - 1) * 100)
              : 0;
            // Letzte bekannte Platzierung des Vereins fuer den Eindruck vom Niveau.
            const lastSeason = offerClub.history[offerClub.history.length - 1];
            // Die entscheidende Frage vor einem Wechsel: Spiele ich dort?
            const konkurrenz = positionCompetition(game, offerClub.id, user);
            const aussicht = competitionOutlook(konkurrenz);
            return (
              <div className="panel offer-card" key={offer.id} style={{ margin: 0 }}>
                <div className="row" style={{ gap: '0.6rem', alignItems: 'center' }}>
                  <ClubCrest club={offerClub} size={44} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 680 }}>{offerClub.name}</div>
                    <div className="tiny dim">{league?.name} - {offerClub.city}</div>
                  </div>
                  {offer.renewal && <Pill tone="good">{t('transfers.renewal')}</Pill>}
                  {offer.loan && <Pill tone="warn">{t('transfers.loan')}</Pill>}
                  {offer.preContract && <Pill tone="warn">{t('transfers.preContract')}</Pill>}
                  {better && !offer.renewal && !offer.loan && <Pill tone="good">{t('transfers.higherLeague')}</Pill>}
                </div>

                <div className="tiny dim" style={{ margin: '0.5rem 0 0.1rem' }}>
                  {offerClub.stadiumName} - {t('transfers.seats', { n: tNumber(offerClub.stadiumCapacity) })}
                </div>
                <div className="tiny dim" style={{ marginBottom: '0.5rem' }}>
                  {t('transfers.clubLine', {
                    manager: offerClub.managerName, sponsor: sponsors.shirt,
                  })}
                  {lastSeason?.position
                    ? ` - ${t('transfers.lastSeasonPlace', { n: lastSeason.position })}`
                    : ''}
                </div>

                <div className="small" style={{ margin: '0.6rem 0' }}>
                  <div className="row between"><span className="muted">{t('contract.role')}</span><span>{t(`role.${offer.role}`)}</span></div>
                  <div className="row between">
                    <span className="muted">{t('contract.salary')}</span>
                    <span>
                      {salary(offer.salary)}
                      {raise !== 0 && (
                        <span className={raise > 0 ? 'pos' : 'neg'} style={{ marginLeft: 6 }}>
                          {raise > 0 ? `+${raise}%` : `${raise}%`}
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="row between"><span className="muted">{t('transfers.duration')}</span>
                    <span>{t('transfers.years', { n: offer.years })}</span></div>
                  {!offer.renewal && (
                    <div className="row between">
                      <span className="muted">{t('transfers.fee')}</span>
                      <span>{money(offer.fee)}</span>
                    </div>
                  )}
                  <div className="row between"><span className="muted">{t('contract.goalBonus')}</span>
                    <span>{tNumber(offer.goalBonus)} EUR</span></div>
                </div>

                {/* Was die Abloese fuer DIESEN Verein bedeutet. Eine nackte Zahl
                    sagt nichts darueber aus, ob der Verein sich streckt oder aus
                    der Portokasse zahlt - und genau das ist die Auskunft, die
                    einen Wechsel zu einer Entscheidung macht. */}
                {!offer.renewal && offerClub && (() => {
                  const anteil = feeShare(offerClub, offer.fee);
                  const stufe = anteil >= 0.6 ? 'record'
                    : anteil >= 0.25 ? 'heavy' : 'easy';
                  return (
                    <div className="tiny dim" style={{ marginTop: 4 }}>
                      {t(`transfers.effort.${stufe}`, {
                        club: offerClub.name,
                        percent: Math.min(999, Math.round(anteil * 100)),
                      })}
                    </div>
                  );
                })()}

                {/* Ohne diese Zeile war ein Wechsel ein Gehaltsvergleich - man
                    erfuhr erst nach der Unterschrift, ob man spielt. */}
                <div className="offer-competition">
                  <div className="row between tiny">
                    <span className="muted">{t('comp.title', {
                      position: t(POSITION_LABELS[user.position]),
                    })}</span>
                    <Pill tone={aussicht === 'hard' ? 'bad'
                      : aussicht === 'tight' ? 'warn' : 'good'}>
                      {t(`comp.outlook.${aussicht}`)}
                    </Pill>
                  </div>
                  <div className="tiny dim" style={{ marginTop: 2 }}>
                    {konkurrenz.count === 0
                      ? t('comp.none')
                      : t('comp.line', {
                        n: konkurrenz.count,
                        best: konkurrenz.best,
                        rank: konkurrenz.rank,
                      })}
                  </div>
                </div>

                <div className="grid two" style={{ gap: '0.5rem' }}>
                  <Meter label={t('club.reputation')} value={offerClub.reputation} />
                  <Meter label={t('tab.training')} value={offerClub.training} />
                </div>

                <p className="tiny dim">{offer.pitch}</p>
                <button className="primary small" style={{ width: '100%' }}
                  onClick={() => acceptOffer(offer.id)}>
                  {offer.renewal ? t('transfers.extend')
                    : offer.loan ? t('transfers.acceptLoan')
                    : offer.preContract ? t('transfers.signPreContract')
                    : t('transfers.accept')}
                </button>
              </div>
            );
          })}
        </div>
      </Panel>

      <Panel title={t('transfers.note')}>
        <p className="small muted" style={{ margin: 0 }}>
          {t('transfers.offersHint')}
        </p>
      </Panel>
    </>
  );
}

/** Berater: Auftraege erteilen und den Stand einsehen (Abschnitt 35). */
function AgentPanel() {
  const game = useAppState().game!;
  const agent = game.agent;
  if (!agent) return null;
  const availability = agentAvailability(game);
  const tasks: AgentTaskKind[] = ['findClub', 'raiseSalary', 'demandRole'];

  const beschreibung: Record<AgentTaskKind, string> = {
    findClub: t('agent.task.search'),
    raiseSalary: t('agent.task.salary'),
    demandRole: t('agent.task.role'),
  };

  return (
    <Panel title={t('transfers.agent')} action={<Pill>Provision {(agent.commission * 100).toFixed(1)} %</Pill>}>
      <div className="row between" style={{ marginBottom: '0.6rem' }}>
        <div>
          <div style={{ fontWeight: 680 }}>{agent.name}</div>
          <div className="tiny dim">
            {agent.quality >= 80 ? t('agent.tier.top')
              : agent.quality >= 60 ? t('agent.tier.established')
              : agent.quality >= 40 ? t('agent.tier.solid') : t('agent.tier.rookie')}
          </div>
        </div>
      </div>
      <div className="grid two">
        <Meter label={t('agent.negotiation')} value={agent.quality} />
        <Meter label={t('agent.trust')} value={agent.trust} />
      </div>

      {agent.task ? (
        <p className="small" style={{ marginBottom: 0 }}>
          <strong>{t(AGENT_TASK_LABELS[agent.task.kind])}</strong>{' '}
          {t('transfers.taskRunning', { date: formatShort(agent.task.dueOn) })}
        </p>
      ) : (
        <>
          <div className="grid three" style={{ marginTop: '0.5rem' }}>
            {tasks.map((kind) => (
              <button key={kind} style={{ textAlign: 'left', padding: '0.6rem 0.7rem' }}
                disabled={!availability.canRequest}
                onClick={() => requestAgentTask(kind)}>
                <div className="small" style={{ fontWeight: 640 }}>{t(AGENT_TASK_LABELS[kind])}</div>
                <div className="tiny dim">{beschreibung[kind]}</div>
              </button>
            ))}
          </div>
          <p className="tiny dim" style={{ marginTop: '0.5rem', marginBottom: 0 }}>
            {availability.canRequest
              ? t('transfers.agentRequestsLeft', { n: 3 - agent.requestsThisSeason })
              : availability.reason}
          </p>
        </>
      )}
    </Panel>
  );
}

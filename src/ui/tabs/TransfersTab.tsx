import { formatShort } from '../../engine/date';
import { userClub } from '../../engine/game';
import { acceptOffer, declineAllOffers } from '../../state/actions';
import { useAppState } from '../../state/store';
import { Empty, Meter, Panel, Pill, money, salary } from '../components';

export default function TransfersTab() {
  const game = useAppState().game!;
  const user = game.players[game.userPlayerId];
  const club = userClub(game);

  return (
    <>
      <Panel title="Deine Marktlage">
        <div className="grid four">
          <div className="stat"><div className="value">{money(user.marketValue)}</div><div className="label">Marktwert</div></div>
          <div className="stat"><div className="value">{user.reputation}</div><div className="label">Reputation</div></div>
          <div className="stat"><div className="value">{game.offers.length}</div><div className="label">Angebote</div></div>
          <div className="stat">
            <div className="value">{user.contract ? formatShort(user.contract.until).slice(6) : '-'}</div>
            <div className="label">Vertrag bis</div>
          </div>
        </div>
        <div className="grid two" style={{ marginTop: '0.8rem' }}>
          <Meter label="Beziehung zum Trainer" value={game.coachRelation} />
          <Meter label="Beliebtheit bei den Fans" value={game.fanRelation} />
        </div>
      </Panel>

      <Panel title="Vertragsangebote" action={
        game.offers.length > 0
          ? <button className="small ghost" onClick={declineAllOffers}>Alle ablehnen</button>
          : undefined
      }>
        {game.offers.length === 0 && (
          <Empty text="Aktuell liegen keine Angebote vor. Angebote entstehen nach starken Saisons." />
        )}
        <div className="grid two">
          {game.offers.map((offer) => {
            const offerClub = game.clubs[offer.clubId];
            const league = offerClub ? game.competitions[offerClub.leagueId] : null;
            if (!offerClub) return null;
            const better = offer.leagueLevel < (club
              ? game.competitions[club.leagueId]?.level ?? 3 : 3);
            return (
              <div className="panel" key={offer.id} style={{ margin: 0 }}>
                <div className="row between">
                  <div>
                    <div style={{ fontWeight: 680 }}>{offerClub.name}</div>
                    <div className="tiny dim">{league?.name}</div>
                  </div>
                  {better && <Pill tone="good">Hoehere Liga</Pill>}
                </div>

                <div className="small" style={{ margin: '0.6rem 0' }}>
                  <div className="row between"><span className="muted">Rolle</span><span>{offer.role}</span></div>
                  <div className="row between"><span className="muted">Gehalt</span><span>{salary(offer.salary)}</span></div>
                  <div className="row between"><span className="muted">Laufzeit</span><span>{offer.years} Jahre</span></div>
                  <div className="row between"><span className="muted">Ablöse</span><span>{money(offer.fee)}</span></div>
                  <div className="row between"><span className="muted">Torpraemie</span>
                    <span>{offer.goalBonus.toLocaleString('de-DE')} EUR</span></div>
                  <div className="row between"><span className="muted">Reputation</span>
                    <span>{offerClub.reputation}</span></div>
                  <div className="row between"><span className="muted">Training</span>
                    <span>{offerClub.training}</span></div>
                </div>

                <p className="tiny dim">{offer.pitch}</p>
                <button className="primary small" style={{ width: '100%' }}
                  onClick={() => acceptOffer(offer.id)}>
                  Angebot annehmen
                </button>
              </div>
            );
          })}
        </div>
      </Panel>

      <Panel title="Hinweis">
        <p className="small muted" style={{ margin: 0 }}>
          Der Transfermarkt ist in dieser Version bewusst schlank gehalten: Angebote
          entstehen nach jeder Saison abhaengig von Leistung, Alter und Reputation.
          Leihen, Vorvertraege, Tauschgeschaefte und Beraterverhandlungen aus Abschnitt 34
          und 35 des Konzepts folgen in einem spaeteren Ausbauschritt.
        </p>
      </Panel>
    </>
  );
}

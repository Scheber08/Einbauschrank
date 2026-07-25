import { formatShort } from '../../engine/date';
import { userClub } from '../../engine/game';
import { clubSponsors } from '../../engine/identity';
import { acceptOffer, declineAllOffers } from '../../state/actions';
import { useAppState } from '../../state/store';
import ClubCrest from '../ClubCrest';
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
            const sponsors = clubSponsors(offerClub);
            const raise = user.contract
              ? Math.round((offer.salary / Math.max(1, user.contract.salary) - 1) * 100)
              : 0;
            // Letzte bekannte Platzierung des Vereins fuer den Eindruck vom Niveau.
            const lastSeason = offerClub.history[offerClub.history.length - 1];
            return (
              <div className="panel offer-card" key={offer.id} style={{ margin: 0 }}>
                <div className="row" style={{ gap: '0.6rem', alignItems: 'center' }}>
                  <ClubCrest club={offerClub} size={44} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 680 }}>{offerClub.name}</div>
                    <div className="tiny dim">{league?.name} - {offerClub.city}</div>
                  </div>
                  {offer.renewal && <Pill tone="good">Verlaengerung</Pill>}
                  {better && !offer.renewal && <Pill tone="good">Hoehere Liga</Pill>}
                </div>

                <div className="tiny dim" style={{ margin: '0.5rem 0 0.1rem' }}>
                  {offerClub.stadiumName} - {offerClub.stadiumCapacity.toLocaleString('de-DE')} Plaetze
                </div>
                <div className="tiny dim" style={{ marginBottom: '0.5rem' }}>
                  Trainer {offerClub.managerName} - Sponsor {sponsors.shirt}
                  {lastSeason?.position ? ` - Vorsaison ${lastSeason.position}.` : ''}
                </div>

                <div className="small" style={{ margin: '0.6rem 0' }}>
                  <div className="row between"><span className="muted">Rolle</span><span>{offer.role}</span></div>
                  <div className="row between">
                    <span className="muted">Gehalt</span>
                    <span>
                      {salary(offer.salary)}
                      {raise !== 0 && (
                        <span className={raise > 0 ? 'pos' : 'neg'} style={{ marginLeft: 6 }}>
                          {raise > 0 ? `+${raise}%` : `${raise}%`}
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="row between"><span className="muted">Laufzeit</span><span>{offer.years} Jahre</span></div>
                  {!offer.renewal && (
                    <div className="row between"><span className="muted">Ablöse</span><span>{money(offer.fee)}</span></div>
                  )}
                  <div className="row between"><span className="muted">Torpraemie</span>
                    <span>{offer.goalBonus.toLocaleString('de-DE')} EUR</span></div>
                </div>

                <div className="grid two" style={{ gap: '0.5rem' }}>
                  <Meter label="Reputation" value={offerClub.reputation} />
                  <Meter label="Training" value={offerClub.training} />
                </div>

                <p className="tiny dim">{offer.pitch}</p>
                <button className="primary small" style={{ width: '100%' }}
                  onClick={() => acceptOffer(offer.id)}>
                  {offer.renewal ? 'Verlaengern' : 'Angebot annehmen'}
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

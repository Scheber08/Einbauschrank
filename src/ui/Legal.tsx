/**
 * Impressum und Datenschutz.
 *
 * Das Impressum ist eine Vorlage: Die Angaben in eckigen Klammern muessen vor
 * der Veroeffentlichung ersetzt werden. Die Datenschutzerklaerung beschreibt,
 * was die Anwendung tatsaechlich tut - und das ist wenig, weil nichts den
 * Browser des Besuchers verlaesst.
 */
import { setState } from '../state/store';
import { Panel } from './components';

/** Zentrale Stelle fuer die Betreiberangaben. Vor dem Hochladen ausfuellen. */
const BETREIBER = {
  name: '[Vor- und Nachname]',
  strasse: '[Strasse und Hausnummer]',
  ort: '[PLZ und Ort]',
  land: 'Deutschland',
  email: '[E-Mail-Adresse]',
};

const UNAUSGEFUELLT = Object.values(BETREIBER).some((v) => v.startsWith('['));

export default function Legal() {
  return (
    <div className="menu-wrap" style={{ alignItems: 'start' }}>
      <div className="menu">
        <div className="row between" style={{ marginBottom: '1rem' }}>
          <h1 style={{ margin: 0 }}>Impressum und Datenschutz</h1>
          <button className="ghost" onClick={() => setState({ screen: 'menu' })}>Zurueck</button>
        </div>

        {UNAUSGEFUELLT && (
          <div className="pill warn" style={{ display: 'block', marginBottom: '0.8rem' }}>
            Vorlage noch nicht ausgefuellt: Die Angaben in eckigen Klammern stehen in
            src/ui/Legal.tsx und muessen vor der Veroeffentlichung ersetzt werden.
          </div>
        )}

        <Panel title="Impressum">
          <p className="small" style={{ marginTop: 0 }}>Angaben gemaess § 5 DDG:</p>
          <p className="small">
            {BETREIBER.name}<br />
            {BETREIBER.strasse}<br />
            {BETREIBER.ort}<br />
            {BETREIBER.land}
          </p>
          <p className="small">
            <strong>Kontakt</strong><br />
            E-Mail: {BETREIBER.email}
          </p>
          <p className="small">
            <strong>Verantwortlich fuer den Inhalt</strong><br />
            {BETREIBER.name}, Anschrift wie oben.
          </p>
          <p className="tiny muted">
            Dieses Angebot ist ein privates, nicht kommerzielles Hobbyprojekt. Es
            werden keine Waren oder Dienstleistungen angeboten und keine Einnahmen
            erzielt.
          </p>
        </Panel>

        <Panel title="Datenschutz">
          <p className="small" style={{ marginTop: 0 }}>
            <strong>Kurz gesagt: Diese Seite sammelt nichts.</strong> Das Spiel laeuft
            vollstaendig in deinem Browser. Es gibt keine Benutzerkonten, keine
            Anmeldung, keine Cookies zu Werbe- oder Analysezwecken und keine
            Reichweitenmessung.
          </p>

          <h4>Was gespeichert wird - und wo</h4>
          <p className="small">
            Spielstaende, geladene Datenbanken und Einstellungen liegen in der
            lokalen Ablage deines Browsers (IndexedDB und localStorage). Diese Daten
            bleiben auf deinem Geraet, werden nicht uebertragen und sind fuer den
            Betreiber dieser Seite nicht einsehbar. Du kannst sie jederzeit loeschen,
            indem du im Browser die Websitedaten fuer diese Seite entfernst.
          </p>

          <h4>Hochgeladene Dateien</h4>
          <p className="small">
            Waehlst du im Editor einen Ordner mit CSV-Dateien oder ein Bild aus, wird
            dieser Inhalt ausschliesslich im Browser gelesen und dort abgelegt. Es
            findet kein Upload auf einen Server statt - der Begriff "hochladen" meint
            hier allein das Einlesen in den eigenen Browser.
          </p>

          <h4>Server-Logdateien</h4>
          <p className="small">
            Beim Abruf der Seite uebertraegt dein Browser technisch notwendige Daten
            an den Webserver (IP-Adresse, Zeitpunkt, aufgerufene Datei, Browsertyp).
            Diese Verarbeitung erfolgt auf Grundlage von Art. 6 Abs. 1 lit. f DSGVO
            zum sicheren und stoerungsfreien Betrieb. Umfang und Speicherdauer richten
            sich nach den Einstellungen des Hosting-Anbieters.
          </p>

          <h4>Keine Weitergabe an Dritte</h4>
          <p className="small">
            Es werden keine Inhalte von fremden Servern nachgeladen - keine
            Schriftarten, keine Karten, keine eingebetteten Videos. Damit entstehen
            auch keine Verbindungen zu Dritten beim Aufruf der Seite.
          </p>

          <h4>Deine Rechte</h4>
          <p className="small">
            Dir stehen die Rechte auf Auskunft, Berichtigung, Loeschung,
            Einschraenkung der Verarbeitung, Datenuebertragbarkeit und Widerspruch zu
            sowie ein Beschwerderecht bei einer Aufsichtsbehoerde. Da ueber die
            Logdateien hinaus keine personenbezogenen Daten verarbeitet werden,
            genuegt fuer Anfragen eine Nachricht an die oben genannte Adresse.
          </p>
        </Panel>

        <Panel title="Inhalte und Namensrechte">
          <p className="small" style={{ marginTop: 0 }}>
            Vereine, Stadien, Staedte und Personen in diesem Spiel sind frei erfunden.
            Aehnlichkeiten mit bestehenden Vereinen oder lebenden Personen sind nicht
            beabsichtigt.
          </p>
          <p className="small">
            Laender- und Nationsnamen sind geografische Bezeichnungen und als solche
            keine Marken. Die Ligen tragen bewusst beschreibende Namen wie
            &bdquo;Deutschland Erste Liga&ldquo; und keine Wettbewerbsmarken.
          </p>
          <p className="small">
            Besucherinnen und Besucher koennen ueber den Editor eigene Namen laden.
            Diese Daten bleiben in ihrem Browser und sind weder Teil dieses Angebots
            noch fuer andere sichtbar. Fuer solche selbst eingebrachten Inhalte ist
            allein verantwortlich, wer sie einbringt.
          </p>
        </Panel>
      </div>
    </div>
  );
}

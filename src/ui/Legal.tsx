/**
 * Datenschutz und Namensrechte.
 *
 * **Das Impressum ist bewusst herausgenommen.** Solange die Seite nicht
 * veroeffentlicht ist, gehoeren Name und Anschrift des Betreibers nirgendwo
 * hin - auch nicht als Platzhalter im Quelltext eines oeffentlichen Repos.
 *
 * Vor einer Veroeffentlichung muss es zurueck: Fuer ein in Deutschland
 * abrufbares Angebot ist ein Impressum nach § 5 DDG Pflicht. Die Textbausteine
 * dafuer liegen weiterhin im Sprachkatalog unter `legal.imprint*`, sind also
 * nur wieder einzusetzen.
 *
 * Die Datenschutzerklaerung beschreibt, was die Anwendung tatsaechlich tut -
 * und das ist wenig, weil nichts den Browser des Besuchers verlaesst.
 */
import { setState } from '../state/store';
import { Panel } from './components';
import { t } from '../i18n';
import { useLocale } from '../i18n/useLocale';

export default function Legal() {
  useLocale();
  return (
    <div className="menu-wrap" style={{ alignItems: 'start' }}>
      <div className="menu">
        <div className="row between" style={{ marginBottom: '1rem' }}>
          <h1 style={{ margin: 0 }}>{t('legal.title')}</h1>
          <button className="ghost" onClick={() => setState({ screen: 'menu' })}>
            {t('common.back')}
          </button>
        </div>

        <Panel title={t('legal.privacy')}>
          <p className="small" style={{ marginTop: 0 }}>
            <strong>{t('legal.privacyLead')}</strong> {t('legal.privacyIntro')}
          </p>

          <h4>{t('legal.storageTitle')}</h4>
          <p className="small">{t('legal.storageBody')}</p>

          <h4>{t('legal.filesTitle')}</h4>
          <p className="small">{t('legal.filesBody')}</p>

          <h4>{t('legal.logsTitle')}</h4>
          <p className="small">{t('legal.logsBody')}</p>

          <h4>{t('legal.thirdPartyTitle')}</h4>
          <p className="small">{t('legal.thirdPartyBody')}</p>
        </Panel>

        <Panel title={t('legal.namesTitle')}>
          <p className="small" style={{ marginTop: 0 }}>{t('legal.namesFiction')}</p>
          <p className="small">{t('legal.namesGeography')}</p>
          <p className="small">{t('legal.namesOwnData')}</p>
        </Panel>
      </div>
    </div>
  );
}

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  deleteSave, duplicateSave, exportSave, importSave, listSaves, type SaveMeta,
} from '../engine/save';
import { setState, showToast } from '../state/store';
import type { CrestClub } from '../engine/identity';
import ClubCrest from './ClubCrest';
import { Empty, Panel } from './components';
import { DriftingBall, FeatureIcon, PitchBackdrop, type MenuIcon } from './MenuArt';
import LanguageSwitch from './LanguageSwitch';
import { t } from '../i18n';
import { useLocale } from '../i18n/useLocale';

/**
 * Die Werbeflaeche des Hauptmenues. Nur Symbol und Schluessel stehen hier -
 * die Texte liegen im Sprachkatalog unter `menu.feature.<key>.title/.body`.
 */
const FEATURES: { icon: MenuIcon; key: string }[] = [
  { icon: 'boot', key: 'moments' },
  { icon: 'table', key: 'league' },
  { icon: 'trophy', key: 'history' },
];

/**
 * Vereinsdaten fuer das Wappen. Aeltere Spielstaende kennen die Farben noch
 * nicht - dann bleibt der Platz leer, statt ein falsches Wappen zu zeigen.
 */
function crestOf(save: SaveMeta): CrestClub | null {
  if (!save.clubId || !save.clubColors) return null;
  return {
    id: save.clubId,
    name: save.clubName,
    short: save.clubShort ?? '',
    colors: save.clubColors,
    reputation: save.clubReputation ?? 50,
  };
}

export default function MainMenu() {
  // Meldet die Ansicht an der Sprachumschaltung an, damit ein Wechsel sofort
  // durchschlaegt statt erst beim naechsten Zustandswechsel.
  useLocale();
  const [saves, setSaves] = useState<SaveMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const fileInput = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    try {
      setSaves(await listSaves());
    } catch {
      showToast(t('menu.savesUnreadable'), 'bad');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  /**
   * Die Spiellogik wird erst hier geladen, nicht schon beim Oeffnen der Seite.
   * Das Menue kommt dadurch deutlich frueher - der Rest kommt, sobald jemand
   * wirklich eine Karriere beginnt oder fortsetzt.
   */
  async function openCareer(saveId: string) {
    const { loadCareer } = await import('../state/actions');
    await loadCareer(saveId);
  }

  async function handleDelete(save: SaveMeta) {
    if (!window.confirm(`Spielstand "${save.saveName}" wirklich löschen?`)) return;
    await deleteSave(save.saveId);
    await refresh();
    showToast(t('menu.saveDeleted'), 'info');
  }

  async function handleExport(save: SaveMeta) {
    const json = await exportSave(save.saveId);
    if (!json) return;
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${save.saveName.replace(/[^a-z0-9]+/gi, '-')}.rtg.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImport(file: File) {
    try {
      await importSave(await file.text());
      await refresh();
      showToast(t('menu.saveImported'), 'good');
    } catch (err) {
      showToast(err instanceof Error ? err.message : t('menu.importFailed'), 'bad');
    }
  }

  return (
    <div className="menu-wrap">
      <div className="menu">
        <header className="hero">
          <PitchBackdrop />
          <DriftingBall />
          <div className="hero-body">
            <div className="logo">ROAD TO GLORY</div>
            <p className="tagline">{t('app.tagline')}</p>

            <div className="menu-actions">
              <button className="primary" onClick={() => setState({ screen: 'create' })}>
                {t('menu.newCareer')}
              </button>
              <button
                onClick={() => saves[0] && void openCareer(saves[0].saveId)}
                disabled={saves.length === 0}
              >
                {saves[0]
                  ? t('menu.continueWith', { name: saves[0].playerName })
                  : t('menu.continue')}
              </button>
              <button className="ghost" onClick={() => fileInput.current?.click()}>
                {t('menu.importSave')}
              </button>
              <button className="ghost" onClick={() => setState({ screen: 'data' })}>
                {t('menu.data')}
              </button>
            </div>
            <LanguageSwitch />
          </div>
        </header>

        <div style={{ display: 'none' }}>
          <input
            ref={fileInput}
            type="file"
            accept=".json,application/json"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleImport(file);
              e.target.value = '';
            }}
          />
        </div>

        <Panel title={t('menu.saves')}>
          {loading && <Empty text={t('common.loading')} />}
          {!loading && saves.length === 0 && (
            <Empty text={t('menu.noSaves')} />
          )}
          {saves.map((save, i) => (
            <div className="save-card" key={save.saveId}
              style={{ animationDelay: `${Math.min(i, 6) * 45}ms` }}>
              {crestOf(save) && <ClubCrest club={crestOf(save)!} size={42} />}
              <div className="save-info">
                <div className="row" style={{ gap: '0.5rem' }}>
                  <strong>{save.playerName}</strong>
                  <span className="pill">{save.position}</span>
                  <span className="pill">{t('player.years', { n: save.age })}</span>
                  <span className="pill">{t(`difficulty.${save.difficulty}`)}</span>
                </div>
                <div className="small muted">
                  {save.clubName} - {save.leagueName} - {t('menu.season', { season: save.season })}
                  {save.careerYears > 1
                    && ` - ${t('menu.careerYear', { n: save.careerYears })}`}
                </div>
                <div className="save-stats tiny">
                  <span><b>{save.appearances}</b> {t('stats.apps')}</span>
                  <span><b>{save.goals}</b> {t('stats.goals')}</span>
                  {save.honours.length > 0 && (
                    <span className="honour">{save.honours.join(' · ')}</span>
                  )}
                </div>
              </div>
              <div className="save-actions">
                <button className="primary small" onClick={() => void openCareer(save.saveId)}>
                  {t('common.load')}
                </button>
                <button className="small ghost" title={t('common.duplicate')} onClick={async () => {
                  await duplicateSave(save.saveId);
                  await refresh();
                }}>{t('common.copy')}</button>
                <button className="small ghost"
                  onClick={() => void handleExport(save)}>{t('common.export')}</button>
                <button className="small danger"
                  onClick={() => void handleDelete(save)}>{t('common.delete')}</button>
              </div>
            </div>
          ))}
        </Panel>

        <Panel title={t('menu.features')}>
          <div className="feature-grid">
            {FEATURES.map((f) => (
              <div className="feature" key={f.key}>
                <FeatureIcon icon={f.icon} />
                <h4>{t(`menu.feature.${f.key}.title`)}</h4>
                <p className="muted small">{t(`menu.feature.${f.key}.body`)}</p>
              </div>
            ))}
          </div>
        </Panel>

        <footer className="menu-foot">
          <span className="tiny dim">{t('menu.disclaimer')}</span>
          <button className="linklike tiny" onClick={() => setState({ screen: 'legal' })}>
            {t('menu.legal')}
          </button>
        </footer>
      </div>
    </div>
  );
}

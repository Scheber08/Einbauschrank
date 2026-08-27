/**
 * Datenbanken verwalten: eigene CSV-Ordner laden, auswaehlen und bearbeiten.
 *
 * Alles bleibt im Browser dieses Rechners. Nichts wird hochgeladen, nichts
 * gelangt in einen Build oder ins Repository.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createEmptyDatabase, deleteDatabase, exportDatabase, getActiveName, importFolder,
  listDatabases, loadDatabase,
  saveDatabase, setActiveDatabase, setActiveName,
  type CustomClub, type CustomDatabase, type ImportReport,
} from '../engine/customDb';
import { setState, showToast } from '../state/store';
import { Empty, Panel } from './components';
import DatabaseEditor from './DatabaseEditor';
import { t, tn } from '../i18n';
import { useLocale } from '../i18n/useLocale';

export default function DataManager() {
  useLocale();
  const [databases, setDatabases] = useState<CustomDatabase[]>([]);
  const [active, setActive] = useState<string | null>(getActiveName());
  const [report, setReport] = useState<ImportReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<CustomDatabase | null>(null);
  const [newName, setNewName] = useState('');
  const folderInput = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    try { setDatabases(await listDatabases()); } catch { /* nichts gespeichert */ }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  async function handleFolder(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setBusy(true);
    setReport(null);
    try {
      const files = Array.from(fileList);
      // Ordnername aus dem relativen Pfad des ersten Eintrags.
      const rel = (files[0] as File & { webkitRelativePath?: string }).webkitRelativePath ?? '';
      const folder = rel.split('/')[0] || t('data.defaultName');
      const result = await importFolder(files, folder);
      setReport(result);
      if (result.database) {
        await saveDatabase(result.database);
        await refresh();
        showToast(t('data.loaded', { name: result.database.name }), 'good');
      }
    } catch (err) {
      setReport({
        database: null,
        errors: [err instanceof Error ? err.message : t('data.importFailed')],
        warnings: [],
        stats: { competitions: 0, clubs: 0, players: 0, images: 0 },
      });
    } finally {
      setBusy(false);
    }
  }

  /**
   * Sichert die Datenbank als CSV-Dateien. Sie kommen nacheinander als
   * einzelne Downloads - Browser mit Mehrfachdownload-Sperre fragen dabei
   * einmal nach.
   */
  function downloadCsv(db: CustomDatabase) {
    const files = exportDatabase(db);
    files.forEach((file, i) => {
      window.setTimeout(() => {
        const blob = new Blob([file.content], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.filename;
        a.click();
        URL.revokeObjectURL(url);
      }, i * 220);
    });
    showToast(tn('data.filesSaved', files.length), 'info');
  }

  async function activate(name: string | null) {
    setActiveName(name);
    setActive(name);
    setActiveDatabase(name ? await loadDatabase(name) : null);
    showToast(name ? t('data.willBeUsed', { name })
      : t('data.backToDefaults'), 'info');
  }

  async function remove(name: string) {
    if (!window.confirm(t('data.confirmRemove', { name }))) return;
    await deleteDatabase(name);
    if (active === name) { setActive(null); setActiveDatabase(null); }
    await refresh();
  }

  if (editing) {
    return (
      <DatabaseEditor
        database={editing}
        onClose={() => setEditing(null)}
        onSave={async (db) => {
          await saveDatabase(db);
          if (active === db.name) setActiveDatabase(db);
          await refresh();
          setEditing(null);
          showToast(t('data.saved'), 'good');
        }}
      />
    );
  }

  return (
    <div className="menu-wrap" style={{ alignItems: 'start' }}>
      <div className="menu">
        <div className="row between" style={{ marginBottom: '1rem' }}>
          <h1 style={{ margin: 0 }}>{t('data.title')}</h1>
          <button className="ghost" onClick={() => setState({ screen: 'menu' })}>{t('common.back')}</button>
        </div>

        <Panel title={t('data.createNew')}>
          <p className="small muted" style={{ marginTop: 0 }}>
            {t('data.createHint')}
          </p>
          <div className="row" style={{ gap: '0.5rem', flexWrap: 'wrap' }}>
            <input value={newName} onChange={(e) => setNewName(e.target.value)}
              placeholder={t('data.namePlaceholder')} style={{ flex: '1 1 14rem' }} />
            <button className="primary" disabled={!newName.trim()} onClick={() => {
              const db = createEmptyDatabase(newName.trim());
              if (databases.some((d) => d.name === db.name)) {
                showToast(t('data.nameTaken'), 'bad');
                return;
              }
              setEditing(db);
            }}>{t('data.createAndEdit')}</button>
          </div>
        </Panel>

        <Panel title={t('data.loadFolder')}>
          {/* In zwei Haelften uebersetzt, damit die Dateiangabe ihre
              Auszeichnung behaelt. Beide Sprachen sind so geschrieben, dass
              der Satz um <code>main.csv</code> herum aufgeht. */}
          <p className="small muted" style={{ marginTop: 0 }}>
            {t('data.folderHintA')} <code>main.csv</code> {t('data.folderHintB')}
          </p>
          <div className="row" style={{ gap: '0.5rem', flexWrap: 'wrap' }}>
            <button className="primary" disabled={busy}
              onClick={() => folderInput.current?.click()}>
              {busy ? t('data.reading') : t('data.chooseFolder')}
            </button>
            <a className="chip" href="/beispiel-datenbank/LIESMICH.txt" target="_blank" rel="noreferrer">
              {t('data.exampleLink')}
            </a>
          </div>
          <input
            ref={folderInput}
            type="file"
            multiple
            // Ordnerauswahl - von Chrome, Edge und Firefox unterstuetzt.
            {...{ webkitdirectory: '', directory: '' }}
            style={{ display: 'none' }}
            onChange={(e) => { void handleFolder(e.target.files); e.target.value = ''; }}
          />

          {report && (
            <div style={{ marginTop: '0.8rem' }}>
              {report.errors.map((e) => (
                <div className="pill bad" key={e} style={{ display: 'block', marginBottom: 4 }}>{e}</div>
              ))}
              {report.warnings.map((w) => (
                <div className="pill warn" key={w} style={{ display: 'block', marginBottom: 4 }}>{w}</div>
              ))}
              {report.database && (
                <div className="small">
                  {t('data.readPrefix')}{' '}
                  <b>{report.stats.competitions}</b> {tn('data.competitions', report.stats.competitions)},{' '}
                  <b>{report.stats.clubs}</b> {tn('data.clubs', report.stats.clubs)},{' '}
                  <b>{report.stats.players}</b> {tn('data.players', report.stats.players)},{' '}
                  <b>{report.stats.images}</b> {tn('data.images', report.stats.images)}.
                </div>
              )}
            </div>
          )}
        </Panel>

        <Panel title={t('data.existing')}>
          {databases.length === 0 && (
            <Empty text={t('data.none')} />
          )}
          {databases.map((db) => {
            const clubs = db.competitions.reduce((a, c) => a + c.clubs.length, 0);
            const players = db.competitions.reduce(
              (a, c) => a + c.clubs.reduce((b, cl) => b + cl.squad.length, 0), 0);
            return (
              <div className="save-card" key={db.name}>
                <div className="save-info">
                  <div className="row" style={{ gap: '0.5rem' }}>
                    <strong>{db.name}</strong>
                    {active === db.name && <span className="pill good">{t('data.active')}</span>}
                  </div>
                  <div className="save-stats tiny">
                    <span><b>{db.competitions.length}</b> {tn('data.competitions', db.competitions.length)}</span>
                    <span><b>{clubs}</b> {tn('data.clubs', clubs)}</span>
                    <span><b>{players}</b> {tn('data.players', players)}</span>
                    <span><b>{Object.keys(db.images).length}</b> {tn('data.images', Object.keys(db.images).length)}</span>
                  </div>
                </div>
                <div className="save-actions">
                  <button className="primary small" onClick={() => void activate(db.name)}
                    disabled={active === db.name}>{t('common.use')}</button>
                  <button className="small ghost" onClick={() => setEditing(db)}>{t('common.edit')}</button>
                  <button className="small ghost" onClick={() => downloadCsv(db)}
                    title={t('data.saveAsCsv')}>{t('common.export')}</button>
                  <button className="small danger" onClick={() => void remove(db.name)}>{t('common.remove')}</button>
                </div>
              </div>
            );
          })}
          {active && (
            <button className="small ghost" style={{ marginTop: '0.5rem' }}
              onClick={() => void activate(null)}>
              {t('data.useNone')}
            </button>
          )}
        </Panel>

        <Panel title={t('data.legalNote')}>
          <p className="small muted" style={{ margin: 0 }}>
            {t('data.legalBody')}
          </p>
        </Panel>
      </div>
    </div>
  );
}

export type { CustomClub };

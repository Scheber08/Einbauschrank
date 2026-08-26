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

export default function DataManager() {
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
      const folder = rel.split('/')[0] || 'Eigene Datenbank';
      const result = await importFolder(files, folder);
      setReport(result);
      if (result.database) {
        await saveDatabase(result.database);
        await refresh();
        showToast(`"${result.database.name}" geladen.`, 'good');
      }
    } catch (err) {
      setReport({
        database: null,
        errors: [err instanceof Error ? err.message : 'Import fehlgeschlagen.'],
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
    showToast(`${files.length} Dateien werden gesichert.`, 'info');
  }

  async function activate(name: string | null) {
    setActiveName(name);
    setActive(name);
    setActiveDatabase(name ? await loadDatabase(name) : null);
    showToast(name ? `"${name}" wird ab der naechsten Karriere verwendet.`
      : 'Es werden wieder die mitgelieferten Namen verwendet.', 'info');
  }

  async function remove(name: string) {
    if (!window.confirm(`Datenbank "${name}" wirklich entfernen?`)) return;
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
          showToast('Aenderungen gespeichert.', 'good');
        }}
      />
    );
  }

  return (
    <div className="menu-wrap" style={{ alignItems: 'start' }}>
      <div className="menu">
        <div className="row between" style={{ marginBottom: '1rem' }}>
          <h1 style={{ margin: 0 }}>Datenbanken</h1>
          <button className="ghost" onClick={() => setState({ screen: 'menu' })}>Zurueck</button>
        </div>

        <Panel title="Neu anlegen">
          <p className="small muted" style={{ marginTop: 0 }}>
            Ohne Dateien loslegen: Du bekommst zwei leere Ligen und einen Pokal und
            baust Vereine, Kader und Wappen direkt hier auf der Seite auf.
          </p>
          <div className="row" style={{ gap: '0.5rem', flexWrap: 'wrap' }}>
            <input value={newName} onChange={(e) => setNewName(e.target.value)}
              placeholder="Name der Datenbank" style={{ flex: '1 1 14rem' }} />
            <button className="primary" disabled={!newName.trim()} onClick={() => {
              const db = createEmptyDatabase(newName.trim());
              if (databases.some((d) => d.name === db.name)) {
                showToast('Eine Datenbank mit diesem Namen gibt es bereits.', 'bad');
                return;
              }
              setEditing(db);
            }}>Anlegen und bearbeiten</button>
          </div>
        </Panel>

        <Panel title="Eigenen Ordner laden">
          <p className="small muted" style={{ marginTop: 0 }}>
            Waehle einen Ordner mit CSV-Dateien. Er braucht eine <code>main.csv</code> mit
            den Wettbewerben und je eine Datei mit den Vereinen. Kader und Wappen sind
            optional. Die Daten bleiben in diesem Browser - sie werden nicht hochgeladen.
          </p>
          <div className="row" style={{ gap: '0.5rem', flexWrap: 'wrap' }}>
            <button className="primary" disabled={busy}
              onClick={() => folderInput.current?.click()}>
              {busy ? 'Wird gelesen...' : 'Ordner auswaehlen'}
            </button>
            <a className="chip" href="/beispiel-datenbank/LIESMICH.txt" target="_blank" rel="noreferrer">
              Aufbau und Beispiel ansehen
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
                  Gelesen: <b>{report.stats.competitions}</b> Wettbewerbe,{' '}
                  <b>{report.stats.clubs}</b> Vereine, <b>{report.stats.players}</b> Spieler,{' '}
                  <b>{report.stats.images}</b> Bilder.
                </div>
              )}
            </div>
          )}
        </Panel>

        <Panel title="Vorhandene Datenbanken">
          {databases.length === 0 && (
            <Empty text="Noch keine eigene Datenbank geladen. Es gelten die mitgelieferten Namen." />
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
                    {active === db.name && <span className="pill good">aktiv</span>}
                  </div>
                  <div className="save-stats tiny">
                    <span><b>{db.competitions.length}</b> Wettbewerbe</span>
                    <span><b>{clubs}</b> Vereine</span>
                    <span><b>{players}</b> Spieler</span>
                    <span><b>{Object.keys(db.images).length}</b> Bilder</span>
                  </div>
                </div>
                <div className="save-actions">
                  <button className="primary small" onClick={() => void activate(db.name)}
                    disabled={active === db.name}>Verwenden</button>
                  <button className="small ghost" onClick={() => setEditing(db)}>Bearbeiten</button>
                  <button className="small ghost" onClick={() => downloadCsv(db)}
                    title="Als CSV-Dateien sichern">Export</button>
                  <button className="small danger" onClick={() => void remove(db.name)}>Entfernen</button>
                </div>
              </div>
            );
          })}
          {active && (
            <button className="small ghost" style={{ marginTop: '0.5rem' }}
              onClick={() => void activate(null)}>
              Keine Datenbank verwenden
            </button>
          )}
        </Panel>

        <Panel title="Rechtlicher Hinweis">
          <p className="small muted" style={{ margin: 0 }}>
            Die mitgelieferten Namen sind frei erfunden. Vereinsnamen und Wappen sind in
            der Regel geschuetzt, Spielernamen beruehren Persoenlichkeitsrechte. Fuer den
            privaten Gebrauch am eigenen Rechner ist eine eigene Datenbank unproblematisch.
            Gib sie aber nicht weiter und veroeffentliche keinen damit erzeugten Build.
          </p>
        </Panel>
      </div>
    </div>
  );
}

export type { CustomClub };

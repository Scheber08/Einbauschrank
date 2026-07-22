import { useCallback, useEffect, useRef, useState } from 'react';
import {
  deleteSave, duplicateSave, exportSave, importSave, listSaves, type SaveMeta,
} from '../engine/save';
import { loadCareer } from '../state/actions';
import { setState, showToast } from '../state/store';
import { Empty, Panel } from './components';

export default function MainMenu() {
  const [saves, setSaves] = useState<SaveMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const fileInput = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    try {
      setSaves(await listSaves());
    } catch {
      showToast('Spielstaende konnten nicht gelesen werden.', 'bad');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  async function handleDelete(save: SaveMeta) {
    if (!window.confirm(`Spielstand "${save.saveName}" wirklich loeschen?`)) return;
    await deleteSave(save.saveId);
    await refresh();
    showToast('Spielstand geloescht.', 'info');
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
      showToast('Spielstand importiert.', 'good');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Import fehlgeschlagen.', 'bad');
    }
  }

  return (
    <div className="menu-wrap">
      <div className="menu">
        <div className="logo">ROAD TO GLORY</div>
        <p className="tagline">
          Eine Fussballkarriere aus der Sicht eines einzelnen Spielers.
          Vom Nachwuchstalent zur Legende - mit selbst gespielten Schluesselmomenten.
        </p>

        <div className="row" style={{ marginBottom: '1.2rem' }}>
          <button className="primary" onClick={() => setState({ screen: 'create' })}>
            Neue Karriere starten
          </button>
          <button
            onClick={() => saves[0] && void loadCareer(saves[0].saveId)}
            disabled={saves.length === 0}
          >
            Zuletzt gespielt fortsetzen
          </button>
          <button className="ghost" onClick={() => fileInput.current?.click()}>
            Spielstand importieren
          </button>
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

        <Panel title="Spielstaende">
          {loading && <Empty text="Wird geladen..." />}
          {!loading && saves.length === 0 && (
            <Empty text="Noch keine Karriere vorhanden. Starte deine erste Laufbahn." />
          )}
          {saves.map((save) => (
            <div className="save-card" key={save.saveId}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="row" style={{ gap: '0.5rem' }}>
                  <strong>{save.playerName}</strong>
                  <span className="pill">{save.position}</span>
                  <span className="pill">{save.age} Jahre</span>
                  <span className="pill">{save.difficulty}</span>
                </div>
                <div className="small muted">
                  {save.clubName} - {save.leagueName} - Saison {save.season}
                  {save.careerYears > 1 && ` - ${save.careerYears}. Karrierejahr`}
                </div>
                <div className="tiny dim">
                  {save.appearances} Spiele, {save.goals} Tore
                  {save.honours.length > 0 && ` - ${save.honours.join(', ')}`}
                </div>
              </div>
              <div className="row" style={{ gap: '0.35rem' }}>
                <button className="primary small" onClick={() => void loadCareer(save.saveId)}>
                  Laden
                </button>
                <button className="small ghost" title="Duplizieren" onClick={async () => {
                  await duplicateSave(save.saveId);
                  await refresh();
                }}>Kopie</button>
                <button className="small ghost" onClick={() => void handleExport(save)}>Export</button>
                <button className="small danger" onClick={() => void handleDelete(save)}>Loeschen</button>
              </div>
            </div>
          ))}
        </Panel>

        <Panel title="Was dich erwartet">
          <div className="grid three small">
            <div>
              <h4>Eigene Schluesselmomente</h4>
              <p className="muted">
                Richtung, Kraft und Ballkontaktpunkt bestimmst du selbst. Ein Schuss
                ins Toreck ist eine Entscheidung, keine Wuerfelprobe.
              </p>
            </div>
            <div>
              <h4>Lebendige Liga</h4>
              <p className="muted">
                Drei Ligen, 60 Vereine, ein Pokal, Auf- und Abstieg. Alles laeuft
                weiter, ob du beteiligt bist oder nicht.
              </p>
            </div>
            <div>
              <h4>Vollstaendige Historie</h4>
              <p className="muted">
                Jede Saison, jedes Tor und jeder Rekord bleibt dauerhaft gespeichert
                und nach Wettbewerb und Verein filterbar.
              </p>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}

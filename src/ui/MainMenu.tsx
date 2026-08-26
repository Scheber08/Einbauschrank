import { useCallback, useEffect, useRef, useState } from 'react';
import {
  deleteSave, duplicateSave, exportSave, importSave, listSaves, type SaveMeta,
} from '../engine/save';
import { setState, showToast } from '../state/store';
import type { CrestClub } from '../engine/identity';
import ClubCrest from './ClubCrest';
import { Empty, Panel } from './components';
import { DriftingBall, FeatureIcon, PitchBackdrop, type MenuIcon } from './MenuArt';

const FEATURES: { icon: MenuIcon; title: string; text: string }[] = [
  {
    icon: 'boot',
    title: 'Eigene Schluesselmomente',
    text: 'Richtung, Kraft und Ballkontaktpunkt bestimmst du selbst. Ein Schuss '
      + 'ins Toreck ist eine Entscheidung, keine Wuerfelprobe.',
  },
  {
    icon: 'table',
    title: 'Lebendige Liga',
    text: 'Drei Ligen, 60 Vereine, ein Pokal, Auf- und Abstieg. Alles laeuft '
      + 'weiter, ob du beteiligt bist oder nicht.',
  },
  {
    icon: 'trophy',
    title: 'Vollstaendige Historie',
    text: 'Jede Saison, jedes Tor und jeder Rekord bleibt dauerhaft gespeichert '
      + 'und nach Wettbewerb und Verein filterbar.',
  },
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
        <header className="hero">
          <PitchBackdrop />
          <DriftingBall />
          <div className="hero-body">
            <div className="logo">ROAD TO GLORY</div>
            <p className="tagline">
              Eine Fussballkarriere aus der Sicht eines einzelnen Spielers.
              Vom Nachwuchstalent zur Legende - mit selbst gespielten Schluesselmomenten.
            </p>

            <div className="menu-actions">
              <button className="primary" onClick={() => setState({ screen: 'create' })}>
                Neue Karriere starten
              </button>
              <button
                onClick={() => saves[0] && void openCareer(saves[0].saveId)}
                disabled={saves.length === 0}
              >
                {saves[0] ? `Weiter mit ${saves[0].playerName}` : 'Zuletzt gespielt fortsetzen'}
              </button>
              <button className="ghost" onClick={() => fileInput.current?.click()}>
                Spielstand importieren
              </button>
              <button className="ghost" onClick={() => setState({ screen: 'data' })}>
                Datenbanken &amp; Editor
              </button>
            </div>
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

        <Panel title="Spielstaende">
          {loading && <Empty text="Wird geladen..." />}
          {!loading && saves.length === 0 && (
            <Empty text="Noch keine Karriere vorhanden. Starte deine erste Laufbahn." />
          )}
          {saves.map((save, i) => (
            <div className="save-card" key={save.saveId}
              style={{ animationDelay: `${Math.min(i, 6) * 45}ms` }}>
              {crestOf(save) && <ClubCrest club={crestOf(save)!} size={42} />}
              <div className="save-info">
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
                <div className="save-stats tiny">
                  <span><b>{save.appearances}</b> Spiele</span>
                  <span><b>{save.goals}</b> Tore</span>
                  {save.honours.length > 0 && (
                    <span className="honour">{save.honours.join(' · ')}</span>
                  )}
                </div>
              </div>
              <div className="save-actions">
                <button className="primary small" onClick={() => void openCareer(save.saveId)}>
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
          <div className="feature-grid">
            {FEATURES.map((f) => (
              <div className="feature" key={f.title}>
                <FeatureIcon icon={f.icon} />
                <h4>{f.title}</h4>
                <p className="muted small">{f.text}</p>
              </div>
            ))}
          </div>
        </Panel>

        <footer className="menu-foot">
          <span className="tiny dim">
            Alle Laender, Vereine und Personen sind frei erfunden.
          </span>
          <button className="linklike tiny" onClick={() => setState({ screen: 'legal' })}>
            Impressum und Datenschutz
          </button>
        </footer>
      </div>
    </div>
  );
}

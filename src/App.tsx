import { Suspense, lazy } from 'react';
import { useAppState } from './state/store';
import MainMenu from './ui/MainMenu';

/**
 * Nur das Hauptmenue liegt im ersten Paket - alles andere wird erst geladen,
 * wenn es gebraucht wird. Wer die Seite oeffnet, wartet so nicht auf den
 * Spielbildschirm oder den Editor, die er vielleicht nie aufruft.
 */
const CreateCareer = lazy(() => import('./ui/CreateCareer'));
const DataManager = lazy(() => import('./ui/DataManager'));
const CareerShell = lazy(() => import('./ui/CareerShell'));
const MatchScreen = lazy(() => import('./ui/match/MatchScreen'));
const Legal = lazy(() => import('./ui/Legal'));

/** Kurze Anzeige, waehrend ein Bereich nachgeladen wird. */
function Loading() {
  return (
    <div className="busy">
      <div className="center">
        <div className="spinner" />
        <div className="muted">Wird geladen...</div>
      </div>
    </div>
  );
}

export default function App() {
  const app = useAppState();

  return (
    <div className="app">
      <Suspense fallback={<Loading />}>
        {app.screen === 'menu' && <MainMenu />}
        {app.screen === 'create' && <CreateCareer />}
        {app.screen === 'data' && <DataManager />}
        {app.screen === 'legal' && <Legal />}
        {app.screen === 'career' && app.game && <CareerShell />}
        {app.screen === 'match' && app.game && <MatchScreen />}
      </Suspense>

      {app.busy && (
        <div className="busy">
          <div className="center">
            <div className="spinner" />
            <div className="muted">{app.busy}</div>
          </div>
        </div>
      )}

      {app.toast && (
        <div className={`toast ${app.toast.tone}`}>{app.toast.text}</div>
      )}
    </div>
  );
}

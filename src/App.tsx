import { useAppState } from './state/store';
import CareerShell from './ui/CareerShell';
import CreateCareer from './ui/CreateCareer';
import MainMenu from './ui/MainMenu';
import MatchScreen from './ui/match/MatchScreen';

export default function App() {
  const app = useAppState();

  return (
    <div className="app">
      {app.screen === 'menu' && <MainMenu />}
      {app.screen === 'create' && <CreateCareer />}
      {app.screen === 'career' && app.game && <CareerShell />}
      {app.screen === 'match' && app.game && <MatchScreen />}

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

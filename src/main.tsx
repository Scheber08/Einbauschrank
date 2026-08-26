import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { restoreActiveDatabase } from './engine/customDb';
import './styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('Wurzelelement nicht gefunden.');

// Die zuletzt gewaehlte Datenbank laden, bevor eine Karriere erzeugt werden
// kann. Schlaegt das fehl, startet das Spiel mit den mitgelieferten Namen -
// ein fehlender Datenbestand darf den Start nie blockieren.
restoreActiveDatabase()
  .catch(() => undefined)
  .finally(() => {
    createRoot(root).render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  });

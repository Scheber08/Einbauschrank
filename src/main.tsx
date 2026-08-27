import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { restoreActiveDatabase } from './engine/customDb';
import { restoreLocale } from './i18n';
import './styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('Wurzelelement nicht gefunden.');

// Zwei Dinge muessen vor dem ersten Rendern stehen:
//  - die Sprache, weil sie ueber jeden Text entscheidet, der danach entsteht,
//    und weil ihr Katalog nachgeladen wird;
//  - die zuletzt gewaehlte Datenbank, bevor eine Karriere erzeugt werden kann.
// Beides darf den Start nicht blockieren: schlaegt es fehl, laeuft das Spiel
// mit den mitgelieferten Namen und den Schluesseln als Text weiter.
Promise.all([
  restoreLocale().catch(() => undefined),
  restoreActiveDatabase().catch(() => undefined),
])
  .finally(() => {
    createRoot(root).render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  });

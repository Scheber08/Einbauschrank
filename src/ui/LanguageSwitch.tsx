/**
 * Sprachumschalter.
 *
 * Steht bewusst im Hauptmenue und im Karriererahmen, nicht in einem
 * Einstellungsdialog: Wer die Seite in der falschen Sprache oeffnet, soll sie
 * ohne Suche wechseln koennen.
 */
import { LOCALES, getLocale, setLocale, type Locale } from '../i18n';
import { useLocale } from '../i18n/useLocale';

export default function LanguageSwitch({ compact }: { compact?: boolean }) {
  useLocale();
  const aktuell = getLocale();

  return (
    <div className={compact ? 'lang-switch compact' : 'lang-switch'} role="group"
      aria-label="Sprache / Language">
      {LOCALES.map((l) => (
        <button
          key={l.id}
          type="button"
          className={l.id === aktuell ? 'lang-option active' : 'lang-option'}
          aria-pressed={l.id === aktuell}
          // Der Katalog wird nachgeladen; die Ansicht zeichnet neu, sobald
          // er da ist. Ein Fehlschlag laesst die alte Sprache stehen.
          onClick={() => { void setLocale(l.id as Locale); }}
        >
          {l.id.toUpperCase()}
          <span className="lang-full">{l.name}</span>
        </button>
      ))}
    </div>
  );
}

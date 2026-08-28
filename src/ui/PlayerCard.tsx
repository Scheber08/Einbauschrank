import {
  computeOverall, summaryLabelKey, summaryValues,
} from '../engine/attributes';
import { nationName } from '../engine/nations';
import { traitLabelKey } from '../engine/traits';
import { t } from '../i18n';
import ClubCrest from './ClubCrest';
import PlayerAvatar from './PlayerAvatar';
import type { Club, Player } from '../engine/types';
import type { TraitKey } from '../engine/traits';

/**
 * Die Spielerkarte.
 *
 * Die Spielerakte listet 54 Attribute einzeln. Das ist richtig fuer den, der
 * an einem Wert arbeitet, und unbrauchbar fuer die Frage, die man sich nach
 * einem Wechsel oder drei Jahren zuerst stellt: *was fuer ein Spieler ist das
 * eigentlich?* Sechs Werte, eine Zahl, ein Gesicht - fertig.
 *
 * Die Gestaltung ist bewusst eigen. Das Genre der Sammelkarte ist frei, die
 * konkrete Aufmachung bekannter Fussballspiele ist es nicht - hier steht
 * deshalb die Palette dieses Spiels, kein fremdes Vorbild.
 */

/** Wie wertvoll die Karte aussieht. Vier Stufen, nach Gesamtstaerke. */
function stufe(overall: number): {
  key: string; ring: string; glanz: string; grund: string;
} {
  if (overall >= 85) {
    return {
      key: 'legend', ring: '#e5cd7c', glanz: 'rgba(229, 205, 124, 0.5)',
      grund: 'linear-gradient(160deg, #3b3520 0%, #22262f 55%, #1b2029 100%)',
    };
  }
  if (overall >= 72) {
    return {
      key: 'elite', ring: '#43d99a', glanz: 'rgba(67, 217, 154, 0.42)',
      grund: 'linear-gradient(160deg, #1e3a33 0%, #1e2836 55%, #1a212c 100%)',
    };
  }
  if (overall >= 58) {
    return {
      key: 'solid', ring: '#5fb2e8', glanz: 'rgba(95, 178, 232, 0.38)',
      grund: 'linear-gradient(160deg, #1f3244 0%, #1e2836 55%, #1a212c 100%)',
    };
  }
  return {
    key: 'rising', ring: '#9b7ff0', glanz: 'rgba(155, 127, 240, 0.34)',
    grund: 'linear-gradient(160deg, #2a2542 0%, #1e2836 55%, #1a212c 100%)',
  };
}

export default function PlayerCard(
  { player, club, traits = [], breite = 290 }:
  { player: Player; club: Club | null; traits?: TraitKey[]; breite?: number },
) {
  const overall = computeOverall(player.attrs, player.position);
  const werte = summaryValues(player.attrs, player.position);
  const s = stufe(overall);
  // Die Karte skaliert ueber eine einzige Zahl, damit sie in einer schmalen
  // Spalte genauso sitzt wie auf einem breiten Bildschirm.
  const e = breite / 290;

  return (
    <div
      className="player-card"
      style={{
        width: breite,
        background: s.grund,
        border: `1px solid ${s.ring}`,
        boxShadow: `0 0 0 1px rgba(0,0,0,0.4), 0 10px 26px rgba(0,0,0,0.45),
          inset 0 1px 0 rgba(255,255,255,0.09)`,
        borderRadius: 10 * e,
        padding: `${14 * e}px ${14 * e}px ${12 * e}px`,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Lichtschein von oben links - gibt der Flaeche Tiefe, ohne dass ein
          Bild geladen werden muss. */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: `radial-gradient(${140 * e}px ${110 * e}px at 22% 6%, ${s.glanz}, transparent 70%)`,
      }} />

      <div className="row between" style={{ position: 'relative', alignItems: 'flex-start' }}>
        <div style={{ textAlign: 'center', lineHeight: 1 }}>
          <div style={{
            fontSize: 34 * e, fontWeight: 800, color: s.ring,
            fontVariantNumeric: 'tabular-nums',
          }}>
            {overall}
          </div>
          <div style={{
            fontSize: 12 * e, fontWeight: 700, letterSpacing: '0.08em',
            color: 'var(--muted)', marginTop: 2 * e,
          }}>
            {player.position}
          </div>
          <div style={{ fontSize: 9 * e, color: 'var(--dim)', marginTop: 4 * e }}>
            {nationName(player.nationality)}
          </div>
        </div>

        <div style={{ marginTop: -2 * e }}>
          <PlayerAvatar
            look={player.appearance}
            jersey={club?.colors[0]}
            trim={club?.colors[1]}
            size={92 * e}
          />
        </div>

        <div style={{ opacity: 0.95 }}>
          {club && <ClubCrest club={club} size={30 * e} />}
        </div>
      </div>

      <div style={{
        textAlign: 'center', marginTop: 6 * e, position: 'relative',
        fontSize: 15 * e, fontWeight: 700, letterSpacing: '0.02em',
      }}>
        {player.firstName} {player.lastName}
      </div>

      <div style={{
        height: 1, background: `linear-gradient(90deg, transparent, ${s.ring}, transparent)`,
        opacity: 0.5, margin: `${8 * e}px 0`,
      }} />

      {/* Sechs Werte statt vierundfuenfzig.

          Kuerzel **ueber** dem Wert, nicht daneben: nebeneinander in einer
          schmalen Spalte stand der Wert naeher am naechsten Kuerzel als am
          eigenen, und "TEM 71 SCH 69" las sich als Unsinn. */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
        gap: `${9 * e}px ${4 * e}px`, position: 'relative',
      }}>
        {werte.map((w) => (
          <div key={w.key} style={{ textAlign: 'center', lineHeight: 1.15 }}>
            <div style={{
              fontSize: 8.5 * e, letterSpacing: '0.1em', color: 'var(--dim)',
              fontWeight: 700,
            }}>
              {t(summaryLabelKey(w.key))}
            </div>
            <div style={{
              fontSize: 17 * e, fontWeight: 800, fontVariantNumeric: 'tabular-nums',
              color: w.value >= 80 ? s.ring : 'var(--text)',
              marginTop: 1 * e,
            }}>
              {w.value}
            </div>
          </div>
        ))}
      </div>

      {/* Die erworbenen Staerken - das, was ihn von einem gleich starken
          Spieler unterscheidet. */}
      {traits.length > 0 && (
        <div className="row" style={{
          flexWrap: 'wrap', gap: 3 * e, marginTop: 9 * e, position: 'relative',
        }}>
          {traits.slice(0, 4).map((k) => (
            <span key={k} style={{
              fontSize: 8.5 * e, padding: `${2 * e}px ${5 * e}px`,
              borderRadius: 99, border: `1px solid ${s.ring}`,
              color: s.ring, opacity: 0.9, whiteSpace: 'nowrap',
            }}>
              {t(traitLabelKey(k))}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

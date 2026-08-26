/**
 * Editor fuer eine geladene Datenbank.
 *
 * Bearbeitet werden Wettbewerbe, Vereine, Kader und Wappen. Gearbeitet wird auf
 * einer Kopie - erst "Speichern" schreibt zurueck, "Abbrechen" verwirft alles.
 */
import { useMemo, useState } from 'react';
import type { CustomClub, CustomCompetition, CustomDatabase } from '../engine/customDb';
import { nationsByRegion } from '../engine/nations';
import { Empty, Panel } from './components';

/** Tiefe Kopie, damit Abbrechen wirklich alles verwirft. */
function clone(db: CustomDatabase): CustomDatabase {
  return JSON.parse(JSON.stringify(db)) as CustomDatabase;
}

const POSITIONS = ['', 'TW', 'IV', 'LV', 'RV', 'DM', 'ZM', 'OM', 'LA', 'RA', 'ST'];

export default function DatabaseEditor(
  { database, onClose, onSave }:
  { database: CustomDatabase; onClose: () => void; onSave: (db: CustomDatabase) => void },
) {
  const [db, setDb] = useState<CustomDatabase>(() => clone(database));
  const [compIndex, setCompIndex] = useState(0);
  const [clubIndex, setClubIndex] = useState(0);
  const [dirty, setDirty] = useState(false);

  const comp: CustomCompetition | undefined = db.competitions[compIndex];
  const club: CustomClub | undefined = comp?.clubs[clubIndex];

  /** Aendert die Datenbank ueber eine Funktion und merkt sich, dass etwas offen ist. */
  function update(fn: (draft: CustomDatabase) => void) {
    setDb((prev) => {
      const next = clone(prev);
      fn(next);
      return next;
    });
    setDirty(true);
  }

  const crestOptions = useMemo(() => ['', ...Object.keys(db.images)], [db.images]);

  async function addImage(files: FileList | null) {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (file.size > 512 * 1024) {
      window.alert('Das Bild ist groesser als 512 KB. Bitte kleiner speichern.');
      return;
    }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
    const key = file.name.toLowerCase();
    update((d) => {
      d.images[key] = dataUrl;
      const target = d.competitions[compIndex]?.clubs[clubIndex];
      if (target) target.crest = key;
    });
  }

  return (
    <div className="menu-wrap" style={{ alignItems: 'start' }}>
      <div className="menu">
        <div className="row between" style={{ marginBottom: '1rem' }}>
          <input value={db.name} aria-label="Name der Datenbank"
            style={{ fontSize: '1.3rem', fontWeight: 700, flex: '1 1 12rem', maxWidth: '26rem' }}
            onChange={(e) => update((d) => { d.name = e.target.value; })} />
          <div className="row" style={{ gap: '0.4rem' }}>
            <button className="primary" disabled={!dirty || !db.name.trim()}
              onClick={() => onSave(db)}>
              Speichern
            </button>
            <button className="ghost" onClick={() => {
              if (dirty && !window.confirm('Aenderungen verwerfen?')) return;
              onClose();
            }}>Abbrechen</button>
          </div>
        </div>

        <Panel title="Wettbewerbe" action={
          <button className="small ghost" onClick={() => update((d) => {
            d.competitions.push({
              id: `neu-${d.competitions.length + 1}`, kind: 'liga',
              country: d.competitions[0]?.country ?? 'eigenes',
              name: 'Neuer Wettbewerb', level: d.competitions.length + 1, clubs: [],
            });
          })}>Hinzufuegen</button>
        }>
          <div className="chip-row">
            {db.competitions.map((c, i) => (
              <span key={i} className={`chip ${i === compIndex ? 'active' : ''}`}
                onClick={() => { setCompIndex(i); setClubIndex(0); }}>
                {c.name} <span className="dim">({c.clubs.length})</span>
              </span>
            ))}
          </div>

          {comp && (
            <div className="grid two" style={{ marginTop: '0.8rem' }}>
              <label>Name
                <input value={comp.name} onChange={(e) => update((d) => {
                  d.competitions[compIndex].name = e.target.value;
                })} />
              </label>
              <label>Kennung des Landes
                <input value={comp.country} onChange={(e) => update((d) => {
                  d.competitions[compIndex].country = e.target.value;
                })} />
              </label>
              <label>Angezeigter Landesname
                <input value={db.countries[comp.country] ?? ''} onChange={(e) => update((d) => {
                  d.countries[d.competitions[compIndex].country] = e.target.value;
                })} />
              </label>
              <div style={{ alignSelf: 'end' }}>
                <button className="small danger" onClick={() => update((d) => {
                  d.competitions.splice(compIndex, 1);
                  setCompIndex(0); setClubIndex(0);
                })}>Wettbewerb entfernen</button>
              </div>
              <label>Art
                <select value={comp.kind} onChange={(e) => update((d) => {
                  d.competitions[compIndex].kind = e.target.value as 'liga' | 'pokal';
                })}>
                  <option value="liga">Liga</option>
                  <option value="pokal">Pokal</option>
                </select>
              </label>
              <label>Ebene (1 = hoechste)
                <input type="number" min={1} max={9} value={comp.level ?? 1}
                  onChange={(e) => update((d) => {
                    d.competitions[compIndex].level = Number(e.target.value) || 1;
                  })} />
              </label>
            </div>
          )}
        </Panel>

        {comp && (
          <Panel title={`Vereine in ${comp.name}`} action={
            <button className="small ghost" onClick={() => update((d) => {
              d.competitions[compIndex].clubs.push({ name: 'Neuer Verein', squad: [] });
            })}>Verein hinzufuegen</button>
          }>
            {comp.clubs.length === 0 && <Empty text="Noch keine Vereine in diesem Wettbewerb." />}
            <div className="chip-row">
              {comp.clubs.map((c, i) => (
                <span key={i} className={`chip ${i === clubIndex ? 'active' : ''}`}
                  onClick={() => setClubIndex(i)}>{c.name}</span>
              ))}
            </div>
          </Panel>
        )}

        {club && (
          <Panel title={club.name} action={
            <button className="small danger" onClick={() => update((d) => {
              d.competitions[compIndex].clubs.splice(clubIndex, 1);
              setClubIndex(0);
            })}>Verein entfernen</button>
          }>
            <div className="grid two">
              <label>Name
                <input value={club.name} onChange={(e) => update((d) => {
                  d.competitions[compIndex].clubs[clubIndex].name = e.target.value;
                })} />
              </label>
              <label>Kuerzel
                <input value={club.short ?? ''} maxLength={4} onChange={(e) => update((d) => {
                  d.competitions[compIndex].clubs[clubIndex].short = e.target.value;
                })} />
              </label>
              <label>Stadt
                <input value={club.city ?? ''} onChange={(e) => update((d) => {
                  d.competitions[compIndex].clubs[clubIndex].city = e.target.value;
                })} />
              </label>
              <label>Stadion
                <input value={club.stadium ?? ''} onChange={(e) => update((d) => {
                  d.competitions[compIndex].clubs[clubIndex].stadium = e.target.value;
                })} />
              </label>
              <label>Kapazitaet
                <input type="number" value={club.capacity ?? ''} onChange={(e) => update((d) => {
                  d.competitions[compIndex].clubs[clubIndex].capacity = Number(e.target.value) || undefined;
                })} />
              </label>
              <label>Ruf (1-100)
                <input type="number" min={1} max={100} value={club.reputation ?? ''}
                  onChange={(e) => update((d) => {
                    d.competitions[compIndex].clubs[clubIndex].reputation = Number(e.target.value) || undefined;
                  })} />
              </label>
              <label>Farbe 1
                <input type="color" value={club.colors?.[0] ?? '#2f4f78'}
                  onChange={(e) => update((d) => {
                    const c = d.competitions[compIndex].clubs[clubIndex];
                    c.colors = [e.target.value, c.colors?.[1] ?? '#ffffff'];
                  })} />
              </label>
              <label>Farbe 2
                <input type="color" value={club.colors?.[1] ?? '#ffffff'}
                  onChange={(e) => update((d) => {
                    const c = d.competitions[compIndex].clubs[clubIndex];
                    c.colors = [c.colors?.[0] ?? '#2f4f78', e.target.value];
                  })} />
              </label>
            </div>

            <div className="row" style={{ gap: '0.8rem', marginTop: '0.8rem', alignItems: 'center' }}>
              {club.crest && db.images[club.crest] && (
                <img src={db.images[club.crest]} alt="" width={48} height={48}
                  style={{ borderRadius: 6, background: '#0c1729' }} />
              )}
              <label style={{ flex: 1 }}>Wappen
                <select value={club.crest ?? ''} onChange={(e) => update((d) => {
                  d.competitions[compIndex].clubs[clubIndex].crest = e.target.value || undefined;
                })}>
                  {crestOptions.map((k) => (
                    <option key={k} value={k}>{k || 'kein Bild'}</option>
                  ))}
                </select>
              </label>
              <label className="chip" style={{ cursor: 'pointer' }}>
                Bild hochladen
                <input type="file" accept="image/*" style={{ display: 'none' }}
                  onChange={(e) => { void addImage(e.target.files); e.target.value = ''; }} />
              </label>
            </div>

            <div className="row between" style={{ marginTop: '1rem', marginBottom: '0.4rem' }}>
              <strong className="small">Kader ({club.squad.length})</strong>
              <button className="small ghost" onClick={() => update((d) => {
                d.competitions[compIndex].clubs[clubIndex].squad.push({ name: 'Neuer Spieler' });
              })}>Spieler hinzufuegen</button>
            </div>
            <div className="scroll" style={{ maxHeight: 320 }}>
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th style={{ width: 90 }}>Position</th>
                    <th style={{ width: 130 }}>Herkunft</th>
                    <th style={{ width: 40 }} />
                  </tr>
                </thead>
                <tbody>
                  {club.squad.map((p, i) => (
                    <tr key={i}>
                      <td>
                        <input value={p.name} onChange={(e) => update((d) => {
                          d.competitions[compIndex].clubs[clubIndex].squad[i].name = e.target.value;
                        })} />
                      </td>
                      <td>
                        <select value={p.pos ?? ''} onChange={(e) => update((d) => {
                          d.competitions[compIndex].clubs[clubIndex].squad[i].pos = e.target.value || undefined;
                        })}>
                          {POSITIONS.map((pos) => (
                            <option key={pos} value={pos}>{pos || 'beliebig'}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <select value={p.nation ?? ''} onChange={(e) => update((d) => {
                          d.competitions[compIndex].clubs[clubIndex].squad[i].nation =
                            e.target.value || undefined;
                        })}>
                          <option value="">wuerfeln</option>
                          {nationsByRegion().map((g) => (
                            <optgroup key={g.region} label={g.region}>
                              {g.nations.map((n) => (
                                <option key={n.id} value={n.id}>{n.name}</option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                      </td>
                      <td>
                        <button className="small danger" onClick={() => update((d) => {
                          d.competitions[compIndex].clubs[clubIndex].squad.splice(i, 1);
                        })}>x</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {club.squad.length === 0 && (
                <Empty text="Kein Kader hinterlegt - das Spiel erzeugt dann alle Namen selbst." />
              )}
            </div>
          </Panel>
        )}
      </div>
    </div>
  );
}

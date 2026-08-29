/**
 * Editor fuer eine geladene Datenbank.
 *
 * Bearbeitet werden Wettbewerbe, Vereine, Kader und Wappen. Gearbeitet wird auf
 * einer Kopie - erst "Speichern" schreibt zurueck, "Abbrechen" verwirft alles.
 */
import { useMemo, useState } from 'react';
import type { CustomClub, CustomCompetition, CustomDatabase } from '../engine/customDb';
import { nationName, nationsByRegion, regionName } from '../engine/nations';
import { t } from '../i18n';
import { useLocale } from '../i18n/useLocale';
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
  useLocale();
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
      window.alert(t('editor.imageTooLarge'));
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
          <input value={db.name} aria-label={t('editor.dbName')}
            style={{ fontSize: '1.3rem', fontWeight: 700, flex: '1 1 12rem', maxWidth: '26rem' }}
            onChange={(e) => update((d) => { d.name = e.target.value; })} />
          <div className="row" style={{ gap: '0.4rem' }}>
            <button className="primary" disabled={!dirty || !db.name.trim()}
              onClick={() => onSave(db)}>{t('common.save')}</button>
            <button className="ghost" onClick={() => {
              if (dirty && !window.confirm(t('editor.discardChanges'))) return;
              onClose();
            }}>{t('common.cancel')}</button>
          </div>
        </div>

        <Panel title={t('editor.competitions')} action={
          <button className="small ghost" onClick={() => update((d) => {
            d.competitions.push({
              id: `neu-${d.competitions.length + 1}`, kind: 'liga',
              country: d.competitions[0]?.country ?? 'eigenes',
              name: t('editor.newCompetition'), level: d.competitions.length + 1, clubs: [],
            });
          })}>{t('common.add')}</button>
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
              <label>{t('squad.name')}<input value={comp.name} onChange={(e) => update((d) => {
                  d.competitions[compIndex].name = e.target.value;
                })} />
              </label>
              <label>{t('editor.countryId')}
                <input value={comp.country} onChange={(e) => update((d) => {
                  d.competitions[compIndex].country = e.target.value;
                })} />
              </label>
              <label>{t('editor.countryName')}
                <input value={db.countries[comp.country] ?? ''} onChange={(e) => update((d) => {
                  d.countries[d.competitions[compIndex].country] = e.target.value;
                })} />
              </label>
              <div style={{ alignSelf: 'end' }}>
                <button className="small danger" onClick={() => update((d) => {
                  d.competitions.splice(compIndex, 1);
                  setCompIndex(0); setClubIndex(0);
                })}>{t('editor.removeCompetition')}</button>
              </div>
              <label>{t('editor.kind')}
                <select value={comp.kind} onChange={(e) => update((d) => {
                  d.competitions[compIndex].kind = e.target.value as 'liga' | 'pokal';
                })}>
                  <option value="liga">{t('editor.league')}</option>
                  <option value="pokal">{t('editor.cup')}</option>
                </select>
              </label>
              <label>{t('editor.level')}
                <input type="number" min={1} max={9} value={comp.level ?? 1}
                  onChange={(e) => update((d) => {
                    d.competitions[compIndex].level = Number(e.target.value) || 1;
                  })} />
              </label>
            </div>
          )}
        </Panel>

        {comp && (
          <Panel title={t('editor.clubsIn', { name: comp.name })} action={
            <button className="small ghost" onClick={() => update((d) => {
              d.competitions[compIndex].clubs.push({ name: t('editor.newClub'), squad: [] });
            })}>{t('editor.addClub')}</button>
          }>
            {comp.clubs.length === 0 && <Empty text={t('editor.noClubs')} />}
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
            })}>{t('editor.removeClub')}</button>
          }>
            <div className="grid two">
              <label>{t('squad.name')}<input value={club.name} onChange={(e) => update((d) => {
                  d.competitions[compIndex].clubs[clubIndex].name = e.target.value;
                })} />
              </label>
              <label>{t('editor.short')}
                <input value={club.short ?? ''} maxLength={4} onChange={(e) => update((d) => {
                  d.competitions[compIndex].clubs[clubIndex].short = e.target.value;
                })} />
              </label>
              <label>{t('editor.city')}
                <input value={club.city ?? ''} onChange={(e) => update((d) => {
                  d.competitions[compIndex].clubs[clubIndex].city = e.target.value;
                })} />
              </label>
              <label>{t('editor.stadium')}
                <input value={club.stadium ?? ''} onChange={(e) => update((d) => {
                  d.competitions[compIndex].clubs[clubIndex].stadium = e.target.value;
                })} />
              </label>
              <label>{t('editor.capacity')}
                <input type="number" value={club.capacity ?? ''} onChange={(e) => update((d) => {
                  d.competitions[compIndex].clubs[clubIndex].capacity = Number(e.target.value) || undefined;
                })} />
              </label>
              <label>{t('editor.reputation')}
                <input type="number" min={1} max={100} value={club.reputation ?? ''}
                  onChange={(e) => update((d) => {
                    d.competitions[compIndex].clubs[clubIndex].reputation = Number(e.target.value) || undefined;
                  })} />
              </label>
              <label>{t('editor.color1')}
                <input type="color" value={club.colors?.[0] ?? '#2f4f78'}
                  onChange={(e) => update((d) => {
                    const c = d.competitions[compIndex].clubs[clubIndex];
                    c.colors = [e.target.value, c.colors?.[1] ?? '#ffffff'];
                  })} />
              </label>
              <label>{t('editor.color2')}
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
              <label style={{ flex: 1 }}>{t('editor.crest')}
                <select value={club.crest ?? ''} onChange={(e) => update((d) => {
                  d.competitions[compIndex].clubs[clubIndex].crest = e.target.value || undefined;
                })}>
                  {crestOptions.map((k) => (
                    <option key={k} value={k}>{k || t('db.noImage')}</option>
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
              <strong className="small">{t('editor.squad', { n: club.squad.length })}</strong>
              <button className="small ghost" onClick={() => update((d) => {
                d.competitions[compIndex].clubs[clubIndex].squad.push({ name: t('editor.newPlayer') });
              })}>{t('editor.addPlayer')}</button>
            </div>
            <div className="scroll" style={{ maxHeight: 320 }}>
              <table>
                <thead>
                  <tr>
                    <th>{t('squad.name')}</th>
                    <th style={{ width: 90 }}>{t('squad.position')}</th>
                    <th style={{ width: 130 }}>{t('editor.origin')}</th>
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
                          <option value="">{t('editor.rollOrigin')}</option>
                          {nationsByRegion().map((g) => (
                            <optgroup key={g.region} label={regionName(g.region)}>
                              {g.nations.map((n) => (
                                <option key={n.id} value={n.id}>{nationName(n.id)}</option>
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
                <Empty text={t('editor.noSquad')} />
              )}
            </div>
          </Panel>
        )}
      </div>
    </div>
  );
}

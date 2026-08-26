/**
 * Kleiner CSV-Leser fuer eigene Datenbanken.
 *
 * Bewusst eigenstaendig statt einer Bibliothek: Das Format ist ueberschaubar,
 * dafuer muss es mit dem umgehen, was Tabellenprogramme tatsaechlich
 * ausspucken - Semikolon oder Komma als Trenner, Anfuehrungszeichen mit
 * eingebetteten Trennern und Zeilenumbruechen, BOM am Dateianfang.
 */

/** Eine Zeile als Zuordnung Spaltenname -> Wert. */
export type CsvRow = Record<string, string>;

/** Erkennt den Trenner an der Kopfzeile: gewinnt, was haeufiger vorkommt. */
function detectDelimiter(head: string): string {
  const candidates = [';', ',', '\t'];
  let best = ';';
  let bestCount = -1;
  for (const d of candidates) {
    const count = head.split(d).length - 1;
    if (count > bestCount) { bestCount = count; best = d; }
  }
  return bestCount > 0 ? best : ';';
}

/** Zerlegt den Text in Felder, unter Beachtung von Anfuehrungszeichen. */
function splitRecords(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else quoted = false;
      } else field += ch;
      continue;
    }

    if (ch === '"') { quoted = true; continue; }
    if (ch === delimiter) { row.push(field); field = ''; continue; }
    if (ch === '\r') continue;
    if (ch === '\n') {
      row.push(field); field = '';
      rows.push(row); row = [];
      continue;
    }
    field += ch;
  }

  row.push(field);
  if (row.length > 1 || row[0].trim() !== '') rows.push(row);
  return rows;
}

/**
 * Liest eine CSV-Datei. Die erste Zeile ist die Kopfzeile; Spaltennamen werden
 * kleingeschrieben und von Leerzeichen befreit, damit "Kapazitaet " und
 * "kapazitaet" dasselbe treffen. Leerzeilen und mit # beginnende Zeilen
 * werden uebersprungen - so lassen sich Kommentare in die Datei schreiben.
 */
export function parseCsv(text: string): CsvRow[] {
  let clean = text.replace(/^﻿/, '');
  // Erlaeuternde Zeilen oberhalb der Kopfzeile abschneiden. Ohne das wuerde
  // ein Kommentar als Spaltenueberschrift gelesen und die Datei waere leer.
  const lines = clean.split(/\r?\n/);
  let start = 0;
  while (start < lines.length
    && (lines[start].trimStart().startsWith('#') || lines[start].trim() === '')) start++;
  clean = lines.slice(start).join('\n');
  if (!clean.trim()) return [];

  const firstLine = clean.slice(0, clean.indexOf('\n') === -1 ? undefined : clean.indexOf('\n'));
  const delimiter = detectDelimiter(firstLine);
  const records = splitRecords(clean, delimiter);
  if (records.length === 0) return [];

  const header = records[0].map((h) => h.trim().toLowerCase());
  const out: CsvRow[] = [];

  for (let i = 1; i < records.length; i++) {
    const rec = records[i];
    if (rec.length === 1 && rec[0].trim() === '') continue;
    if (rec[0].trimStart().startsWith('#')) continue;

    const row: CsvRow = {};
    let empty = true;
    header.forEach((key, index) => {
      const value = (rec[index] ?? '').trim();
      row[key] = value;
      if (value !== '') empty = false;
    });
    if (!empty) out.push(row);
  }
  return out;
}

/** Wert einer Spalte, mit Alternativnamen - fuer deutsche und englische Kopfzeilen. */
export function field(row: CsvRow, ...names: string[]): string {
  for (const n of names) {
    const v = row[n.toLowerCase()];
    if (v !== undefined && v !== '') return v;
  }
  return '';
}

/** Zahl aus einer Spalte; akzeptiert "45.000" und "45 000". */
export function num(row: CsvRow, ...names: string[]): number | undefined {
  const raw = field(row, ...names);
  if (!raw) return undefined;
  const parsed = Number(raw.replace(/[.\s]/g, '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : undefined;
}

/** Schreibt Zeilen zurueck als CSV - fuer den Export aus dem Editor. */
export function toCsv(rows: CsvRow[], columns: string[], delimiter = ';'): string {
  const esc = (v: string) => (
    v.includes(delimiter) || v.includes('"') || v.includes('\n')
      ? `"${v.replace(/"/g, '""')}"` : v
  );
  const lines = [columns.join(delimiter)];
  for (const row of rows) {
    lines.push(columns.map((c) => esc(row[c] ?? '')).join(delimiter));
  }
  return lines.join('\n');
}

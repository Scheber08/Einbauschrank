# Eigene Datenpakete

Hier liegen optionale Datenpakete, mit denen sich die erfundenen Vereine,
Ligen und Kadernamen durch eigene ersetzen lassen.

## Wichtig: Diese Dateien bleiben lokal

Alle Dateien mit der Endung `.local.json` stehen in `.gitignore` und werden
**nie** committet oder gepusht. Das ist Absicht: Das Repository bleibt frei von
geschuetzten Vereins- und Personennamen und damit veroeffentlichbar, waehrend
die eigene Datenbasis auf dem eigenen Rechner bleibt.

Der erzeugte Produktionsbuild (`npm run build` -> `dist/`) enthaelt die Daten
dagegen sehr wohl. `dist/` ist ebenfalls in `.gitignore` - ein solcher Build
sollte nicht weitergegeben werden.

Fehlt hier jede `.local.json`, laeuft das Spiel unveraendert mit den erfundenen
Namen aus `src/engine/names.ts`. Es gibt keinen Pflichtinhalt.

## Format

Eine Datei pro Land, benannt nach Belieben, z. B. `deutschland.local.json`:

```json
{
  "country": "falkenland",
  "displayName": "Beispielland",
  "cupName": "Landespokal",
  "leagues": [
    {
      "level": 1,
      "name": "Erste Liga",
      "clubs": [
        {
          "name": "Beispiel FC",
          "short": "BFC",
          "city": "Beispielstadt",
          "colors": ["#dc052d", "#ffffff"],
          "stadium": "Beispielarena",
          "capacity": 75000,
          "reputation": 95,
          "manager": "Vorname Nachname",
          "squad": [
            { "name": "Vorname Nachname", "pos": "TW" },
            "Ohne Positionsangabe geht auch"
          ]
        }
      ]
    }
  ]
}
```

### Felder

| Feld | Pflicht | Bedeutung |
| --- | --- | --- |
| `country` | ja | Id aus `engine/countries.ts`: `falkenland`, `albion`, `iberia`, `calcio`, `gallia` |
| `displayName` | nein | Ersetzt den Landesnamen in der Oberflaeche |
| `cupName` | nein | Name des nationalen Pokals |
| `leagues[].level` | ja | `1` = hoechste Spielklasse, `2`, `3` |
| `leagues[].name` | nein | Liganame |
| `clubs[].name` | ja | Vereinsname |
| `clubs[].short` | nein | Kuerzel bis vier Zeichen; sonst aus dem Namen abgeleitet |
| `clubs[].city`, `stadium`, `capacity` | nein | sonst wie bisher erzeugt |
| `clubs[].colors` | nein | `[primaer, sekundaer]` als Hex-Werte |
| `clubs[].reputation` | nein | 1-100; steuert Kaderstaerke, Budget und Zuschauer |
| `clubs[].manager` | nein | Trainername |
| `clubs[].squad` | nein | Kadernamen, siehe unten |

### Reihenfolge zaehlt

Die Vereine werden in der angegebenen Reihenfolge auf die Tabellenplaetze
verteilt - der erste Eintrag ist der staerkste Verein der Liga. Ohne eigenen
`reputation`-Wert leitet der Generator die Staerke aus dieser Position ab.

**Jede Liga braucht 20 Vereine.** Das Spiel rechnet mit 20 Mannschaften und 38
Spieltagen. Wer aus einer Liga mit 18 Vereinen kommt, fuellt auf zwei
Zwanzigerfelder auf; sonst greift fuer die restlichen Plaetze der erfundene
Fallback, und die Liga wird gemischt.

### Kadernamen

`squad` ersetzt ausschliesslich **Namen**. Alle Spielwerte - Attribute,
Potenzial, Alter, Marktwert, Vertrag - entstehen weiterhin aus der
Vereinsreputation. Ein Name macht also niemanden stark.

Mit `pos` landet ein Name auf der passenden Position (`TW`, `IV`, `LV`, `RV`,
`DM`, `ZM`, `OM`, `LA`, `RA`, `ST`). Ohne Angabe werden die Namen der Reihe nach
auf die staerksten Kaderplaetze verteilt. Ein Kader umfasst mehr als 20 Spieler;
nicht belegte Plaetze behalten erzeugte Namen.

## Aenderungen wirksam machen

Die Welt entsteht **einmal beim Start einer Karriere**. Bestehende Spielstaende
behalten ihre alten Vereine - fuer neue Daten braucht es eine neue Karriere.
Nach dem Bearbeiten einer Datei den Entwicklungsserver neu starten, damit Vite
sie neu einliest.

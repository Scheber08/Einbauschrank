# Road to Glory

Browserbasiertes Fussball-Karrierespiel. Du steuerst keinen Verein, sondern einen
einzelnen selbst erstellten Fussballer - von der Jugend bis zur Legende. Die
wichtigsten Momente spielst du selbst: Richtung, Kraft und Ballkontaktpunkt
bestimmst du, waehrend im Hintergrund eine vollstaendige Fussballwelt weiterlaeuft.

Dies ist die **erste spielbare Version (0.1)** nach dem Konzept. Sie entspricht
Phase 1 bis 4 des Entwicklungsplans und geht beim Umfang ueber die in Abschnitt 61
beschriebene Minimalversion hinaus.

## Starten

```bash
npm install
```

```bash
npm run dev
```

Danach `http://localhost:5173` im Browser oeffnen.

Weitere Befehle:

```bash
npm run build
```

```bash
npm run typecheck
```

## Was in dieser Version enthalten ist

| Konzeptabschnitt | Umsetzung |
| --- | --- |
| 4-6 Spielwelt, Ligensystem | Falkenland vollstaendig: 3 Ligen, 60 Vereine, rund 1.500 Spieler |
| 7-8 Ligamodus, Auf- und Abstieg | 38 Spieltage, alle Tabellenkriterien, direkter Auf- und Abstieg, Relegation ueber Hin- und Rueckspiel |
| 9 Nationaler Pokal | Alle 60 Vereine, Vorrunde bis Finale, Verlaengerung und Elfmeterschiessen |
| 14-15 Spielerstellung | Grunddaten, Positionen, Aussehen, fuenf Karrierehintergruende |
| 16-17 Attribute, Potenzial | 54 Attribute in fuenf Gruppen, positionsabhaengige Gesamtstaerke, veraenderliches Potenzial |
| 18-19 Wochenablauf, Training | Wochentraining mit 17 Schwerpunkten und vier Intensitaetsstufen |
| 20-26 Spielmodi und Gameplay | Simulation, eigene Highlights, alle wichtigen Szenen; Schuss, Pass, Zweikampf, Dribbling mit Finten, Freistoss mit Mauer, Elfmeter, Torwartparade |
| 22-23 Ballsteuerung | Richtung, Kraftanzeige, Ballkontaktpunkt mit echter Flugbahnberechnung inklusive Effet und Schwerkraft, Live-Torblick als Vorschau und Auswertung |
| 27-28 Simulation, Taktik | Minutenweise Detailsimulation fuer eigene Spiele, schnelle Hintergrundsimulation fuer alle uebrigen; sieben Formationen, acht Spielstile |
| 29 Trainerbeziehung | Beeinflusst Aufstellung, Einsatzzeit und Kaderplatz |
| 33-34 Vertraege, Transfers | Vertragsverlaengerung, Angebote nach jeder Saison, Wechsel des eigenen Spielers, Transferbewegungen der Computerspieler |
| 36-38 Marktwert, Form, Fitness | Dynamischer Marktwert, Form, Moral, Fitness, Spielpraxis, Selbstvertrauen |
| 37 Verletzungen | Neun Verletzungsarten mit Heilungsverlauf und dauerhaften Folgen bei schweren Faellen |
| 39 Medien | Nachrichtensystem mit Kategorien und Filter; Interviews nach markanten Spielen mit drei Antworttonlagen (Wirkung auf Moral, Trainer, Fans, Image, Reputation) |
| 31-32 Leben abseits des Platzes | Woechentliche Ereignisse (Sponsor, Mannschaftsabend, Charity, Zusatztraining, soziale Medien) mit Wirkung auf Moral, Fitness, Image, Fans und Trainerbeziehung |
| 41-42 Saisonziele, Bewertung | Vier Saisonziele, positionsabhaengige Notenberechnung von 1,0 bis 10,0 |
| 43-48 Statistiken, Rekorde | Vollstaendige Einzel- und Saisonstatistik, Filter nach Saison, Wettbewerb und Verein, Rekordbuch |
| 49-50 Chronik, Auszeichnungen | Karrierechronik mit Meilensteinen, fuenf Auszeichnungen je Liga und Saison |
| 51 Saisonkalender | Juli bis Juni mit Winterpause, Pokalrunden unter der Woche, Relegation im Juni |
| 53 Save-System | Mehrere Spielstaende in IndexedDB, Autosave, Umbenennen, Duplizieren, Export und Import |
| 56 Leistungsoptimierung | Zwei Detailstufen: Detailsimulation fuer relevante Spiele, schnelle Simulation fuer den Rest |
| 57 Oberflaeche | Karriere-Dashboard mit zehn Bereichen, responsiv fuer Desktop und Tablet |
| 59 Schwierigkeitsgrad | Vier Stufen mit Auswirkung auf Trefferbereiche, Entwicklung, Verletzungen und Einsatzzeit |

## Noch nicht enthalten

Diese Punkte aus dem Konzept sind bewusst spaeteren Ausbauschritten vorbehalten:

- **Abschnitt 5, 10-13**: Die vier weiteren Laender sind als Datensatz und
  Spielstil hinterlegt (auslaendische Spieler kommen bereits vor), haben aber
  noch keine eigenen Ligen. Damit fehlen auch Continental Champions Cup,
  Continental Trophy, Nationalmannschaften und World Nations Cup.
- **Abschnitt 30, 40**: Beziehungen zu Mitspielern und ein voll ausgebautes
  soziales Netzwerk. (Interviews, Ereignisse ausserhalb des Platzes und das
  oeffentliche Image aus Abschnitt 31/32/39 sind umgesetzt: nach Spielen gibt es
  Interviews, unter der Woche persoenliche Entscheidungen, und Moral, Trainer-
  beziehung, Fanbeliebtheit sowie Image reagieren darauf.)
- **Abschnitt 35**: Beratersystem.
- **Abschnitt 34**: Leihen, Vorvertraege und Tauschgeschaefte. Der Transfermarkt
  ist derzeit auf Angebote an den eigenen Spieler und eine einfache Umverteilung
  der Computerspieler reduziert.
- **Abschnitt 20.4**: Erweiterte Spielersteuerung ueber ein komplettes Spiel.
- **Abschnitt 58**: Sound und Musik.

## Aufbau des Projekts

```
src/
  engine/            Spiellogik, vollstaendig unabhaengig von der Oberflaeche
    rng.ts           Deterministischer Zufallsgenerator je Spielstand
    date.ts          Kalenderrechnung
    types.ts         Zentrale Datentypen des Spielstands
    attributes.ts    54 Attribute, Positionen, Gesamtstaerkeberechnung
    countries.ts     Die fuenf fiktiven Laender
    names.ts         Fiktive Namens- und Ortspools
    backgrounds.ts   Karrierehintergruende
    playerGen.ts     Spielererzeugung, Marktwert, Gehalt
    worldGen.ts      Laender, Ligen, Vereine, Kader
    fixtures.ts      Spielplan und Saisonkalender
    cup.ts           Pokalauslosung
    table.ts         Tabellenberechnung
    lineup.ts        Aufstellung und Mannschaftsstaerken
    matchSim.ts      Gemeinsame Bausteine und Hintergrundsimulation
    matchEngine.ts   Minutenweise Detailsimulation mit Unterbrechung fuer Highlights
    matchTypes.ts    Typen fuer Highlights
    ballAction.ts    Ballphysik, Ausfuehrungsfehler, Torwartlogik
    development.ts   Training, Entwicklung, Verletzungen, Form
    season.ts        Saisonstart und -ende, Relegation, Auszeichnungen, Transfers
    stats.ts         Statistikverwaltung und Rekorde
    game.ts          Karrierestart, Tagesablauf, Spielabwicklung
    save.ts          IndexedDB-Spielstaende
  state/             Zustandsspeicher und Aktionen der Oberflaeche
  ui/                React-Komponenten
    tabs/            Die zehn Bereiche des Karriere-Dashboards
    match/           Spielbildschirm und interaktive Canvas-Szenen
```

Die Engine kennt React nicht und laesst sich unabhaengig testen oder spaeter
serverseitig verwenden.

## Steuerung einer Ballaktion

Eine Ballaktion laeuft in drei Schritten ab (bei Paessen in vier):

1. **Richtung** - Zielpunkt auf dem Spielfeld anklicken.
2. **Kraft** - Maustaste oder Leertaste gedrueckt halten, die Anzeige laeuft auf
   und wieder zurueck. Beim gewuenschten Wert loslassen. Massgeblich ist die
   Haltedauer, nicht die Bildrate.
3. **Ballkontakt** - In der Nahansicht den Punkt am Ball waehlen. Daneben zeigt
   ein **Torblick** live, wo der Ball ankaeme:
   - Mitte: normaler Schuss, rund neun Grad Abflugwinkel
   - Unterseite: der Ball wird angehoben, bis rund 26 Grad - Lupfer und Flanken
   - Oberseite: flache Bahn mit Topspin, Bodenpaesse und Flachschuesse
   - Seitlich: Effet, ueber 20 Meter kruemmt sich die Bahn um rund drei Meter

Aus diesen Eingaben wird eine echte Flugbahn berechnet, mit Schwerkraft,
Luftwiderstand und Magnus-Effekt. Die Attribute des Spielers, der Gegnerdruck,
Form, Fitness und Selbstvertrauen verrauschen die Eingabe: Eine gute Eingabe
erhoeht die Erfolgschance, garantiert sie aber nicht. Ein Weltklassespieler
gleicht kleine Fehler aus, ein Jugendspieler nicht.

Nach jedem Abschluss zeigt der Torblick den tatsaechlichen Auftreffpunkt und den
Sprung des Torwarts, dazu eine Begruendung: "Zu zentral gezielt", "Zu hoch
angesetzt", "Der Effet traegt den Ball rechts vorbei". So laesst sich die
Mechanik lernen, statt nur ein Ergebnis hinzunehmen.

### Weitere Spielsituationen

- **Dribbling** (Abschnitt 24): erst die Bewegung waehlen, dann den Moment
  treffen. Von "Ball vorlegen" bis "Hackentrick" - schwierigere Finten haben ein
  engeres Zeitfenster, bringen aber deutlich mehr. Sie werden ueber steigende
  Dribblingwerte freigeschaltet. Ein gelungenes Dribbling fuehrt direkt in eine
  bessere Abschlusssituation.
- **Freistoss**: mit Mauer, ueber oder um sie herum. Antreten darf, wer zu den
  beiden besten Schuetzen der Mannschaft gehoert - ein Platz, den man sich ueber
  das Freistosstraining erarbeitet.
- **Zweikampf und Torwartparade**: Zeitfenster, deren Groesse von den Attributen
  und vom Schwierigkeitsgrad abhaengt.

Die drei Spielmodi unterscheiden sich spuerbar:

- **Komplett simulieren**: nur Ergebnis, Bewertung und Statistik.
- **Nur eigene Highlights**: du spielst jede Ballaktion deines Spielers selbst.
- **Alle wichtigen Szenen**: zusaetzlich bist du ohne Ball gefragt - mehr
  Zweikaempfe und Klaerungen gegnerischer Grosschancen (Konzept Abschnitt 20.3).
  Wie oft du dich in Schuesse wirfst, haengt von deiner Position ab: Verteidiger
  haeufig, Stuermer kaum.

Waehrend der Partie waehlst du jederzeit deine **Ausrichtung**:

- **Nach vorne**: mehr Abschluesse und Dribblings, hoher Kraftverbrauch.
- **Ausbalanciert**: ausgeglichene Beteiligung.
- **Defensiv**: mehr Zweikaempfe und Klaerungen, weniger im Angriff.
- **Kraefte schonen**: Zurueckhaltung, schont die Fitness fuer die Schlussphase.

So entscheidest du zwischen den Highlights, ob du ein Spiel an dich reisst oder
Kraefte fuer spaeter sparst.

**Halbzeit:** Zur Pause haelt die Partie an. Der Trainer sagt je nach Spielstand
etwas, und du waehlst eine Reaktion - kompakt verteidigen, so weitermachen,
volle Offensive oder die Mannschaft mitreissen. Die Wahl veraendert Angriff und
Abwehr deines Teams in der zweiten Haelfte sowie den Kraftverbrauch; "Mannschaft
mitreissen" wirkt umso staerker, je hoeher deine Fuehrungsstaerke ist.

**Verletzung:** Ziehst du dir im Spiel eine Blessur zu, entscheidest du selbst
(Konzept Abschnitt 37): auswechseln lassen (sicher, normale Genesung) oder auf
die Zaehne beissen. Weiterspielen kostet Leistung und riskiert je nach Schwere
eine Verschlimmerung mit deutlich laengerem Ausfall - meistens, aber nicht immer,
geht es glimpflich aus.

Alle Timingmechaniken rechnen mit der Uhr statt mit Einzelbildern. Sie bleiben
damit fair, auch wenn der Browser gerade keine Bilder liefert.

## Entwicklerwerkzeug

`devtest.html` ist ein Rauchtest der Spiellogik. Er erzeugt eine Karriere,
spielt drei komplette Saisons durch und prueft Tabellen, Torquoten, Pokalverlauf,
Auf- und Abstieg, Statistiken und die Groesse des Spielstands. Zusaetzlich
laesst er 39 Spiele im Highlight-Modus laufen und prueft, welche Situationen
entstehen, ob die Entwicklung des Spielers stimmt und ob die Ballphysik
plausible Ergebnisse liefert (gute gegen schlechte Eingabe, Wirkung des
Kontaktpunkts, Staerke des Effets). Aufruf bei laufendem Entwicklungsserver:

```bash
npm run dev
```

Danach `http://localhost:5173/devtest.html` oeffnen. Der Test ist nicht Teil des
Produktionsbuilds.

## Hinweis zu Lizenzen

Alle Laender, Ligen, Vereine, Staedte, Stadien und Spielernamen sind frei
erfunden. Es werden keine echten Vereinsnamen, Wappen oder Personen verwendet.

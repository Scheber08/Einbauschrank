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
| 4-6 Spielwelt, Ligensystem | Alle fuenf Laender: 15 Ligen, 300 Vereine, rund 7.500 Spieler, 5 Pokale. Das eigene Land wird voll detailliert simuliert, die uebrigen ergebnis-orientiert (Konzept Abschnitt 56) |
| 7-8 Ligamodus, Auf- und Abstieg | 38 Spieltage, alle Tabellenkriterien, direkter Auf- und Abstieg, Relegation ueber Hin- und Rueckspiel |
| 9 Nationaler Pokal | Alle 60 Vereine, Vorrunde bis Finale, Verlaengerung und Elfmeterschiessen |
| 10 Continental Champions Cup | 24 Teilnehmer aus fuenf Laendern, Ligaphase (8 Spiele, gemeinsame Tabelle), K.-o.-Phase Achtelfinale bis Finale; eigene Teilnahme spielbar, Sieger in Chronik und Rekorden |
| 11 Continental Trophy | Zweiter Vereinswettbewerb parallel zum Champions Cup, mit eigener Auslosung und Chronikeintrag |
| 12-13 Nationalmannschaft, World Nations Cup | Nominierung des eigenen Spielers nach Staerke, Form und Positionskonkurrenz; World Nations Cup alle vier Jahre (16 Nationen, Gruppen- und K.-o.-Phase) mit Laenderspielen, Toren und Titel in der Chronik |
| 14-15 Spielerstellung | Grunddaten, Positionen, Aussehen, fuenf Karrierehintergruende |
| 16-17 Attribute, Potenzial | 54 Attribute in fuenf Gruppen, positionsabhaengige Gesamtstaerke, veraenderliches Potenzial |
| 18-19 Wochenablauf, Training | Wochentraining mit 17 Schwerpunkten und vier Intensitaetsstufen |
| 20-26 Spielmodi und Gameplay | Simulation, eigene Highlights, alle wichtigen Szenen; Schuss, Pass, Zweikampf, Dribbling mit Finten, Freistoss mit Mauer, Elfmeter, Torwartparade |
| 22-23 Ballsteuerung | Richtung, Kraftanzeige, Ballkontaktpunkt mit echter Flugbahnberechnung inklusive Effet und Schwerkraft, Live-Torblick als Vorschau und Auswertung |
| 27-28 Simulation, Taktik | Minutenweise Detailsimulation fuer eigene Spiele, schnelle Hintergrundsimulation fuer alle uebrigen; sieben Formationen, acht Spielstile |
| 29 Trainerbeziehung | Beeinflusst Aufstellung, Einsatzzeit und Kaderplatz |
| 33-34 Vertraege, Transfers | Vertragsverlaengerung, Angebote nach jeder Saison, Wechsel des eigenen Spielers, Transferbewegungen der Computerspieler |
| 34 Leihgeschaefte | Wer kaum spielt, bekommt Leihangebote aus tieferen Spielklassen - zur Winterpause und zum Saisonende |
| 35 Beratersystem | Ein Berater sucht Vereine, verhandelt Gehalt nach und fordert eine groessere Rolle ein; Auftraege kosten Zeit und Vertrauen |
| 36-38 Marktwert, Form, Fitness | Dynamischer Marktwert, Form, Moral, Fitness, Spielpraxis, Selbstvertrauen |
| 37 Verletzungen | Neun Verletzungsarten mit Heilungsverlauf und dauerhaften Folgen bei schweren Faellen |
| 39 Medien | Nachrichtensystem mit Kategorien und Filter; Interviews nach markanten Spielen mit drei Antworttonlagen (Wirkung auf Moral, Trainer, Fans, Image, Reputation) |
| 40 Soziales Netzwerk | Feed mit Fan-, Medien- und Kritikerstimmen; eigene Beitraege wirken auf Ansehen, Fans und Umfeld |
| 30 Beziehungen zu Mitspielern | Mentor, Freunde und Rivalen, die sich mit gemeinsamer Spielzeit entwickeln; Freunde bieten sich im Spiel oefter an, das Umfeld beeinflusst die Moral |
| 31-32 Leben abseits des Platzes | Woechentliche Ereignisse (Sponsor, Mannschaftsabend, Charity, Zusatztraining, soziale Medien) mit Wirkung auf Moral, Fitness, Image, Fans und Trainerbeziehung |
| 41-42 Saisonziele, Bewertung | Vier Saisonziele, positionsabhaengige Notenberechnung von 1,0 bis 10,0 |
| 43-48 Statistiken, Rekorde | Vollstaendige Einzel- und Saisonstatistik, Filter nach Saison, Wettbewerb und Verein, Rekordbuch |
| 49-50 Chronik, Auszeichnungen | Karrierechronik mit Meilensteinen, fuenf Auszeichnungen je Liga und Saison |
| 51 Saisonkalender | Juli bis Juni mit Winterpause, Pokalrunden unter der Woche, Relegation im Juni |
| 53 Save-System | Mehrere Spielstaende in IndexedDB, Autosave, Umbenennen, Duplizieren, Export und Import |
| 56 Leistungsoptimierung | Zwei Detailstufen: Detailsimulation fuer relevante Spiele, schnelle Simulation fuer den Rest |
| 57 Oberflaeche | Karriere-Dashboard mit zehn Bereichen, responsiv fuer Desktop und Tablet |
| 59 Schwierigkeitsgrad | Vier Stufen mit Auswirkung auf Trefferbereiche, Entwicklung, Verletzungen und Einsatzzeit |

## Oberflaeche

Alles wird als Inline-SVG gezeichnet, ohne Bilddateien:

- **Aufstellungen** als Feldgrafik, Trikots in Vereinsfarben, der eigene Spieler
  hervorgehoben - im Spielbildschirm fuer beide Mannschaften, im Kaderbereich
  fuer die voraussichtliche Startelf.
- **Kraefteverhaeltnis** vor dem Anpfiff: Angriff, Mittelfeld, Abwehr und
  Torwart beider Teams im direkten Balkenvergleich.
- **Spielverlauf** als Zeitachse mit Treffern, Karten und Wechseln beider
  Seiten, darunter ein Druckverlauf je Viertelstunde.
- **Attributprofil** als Netzdiagramm ueber die Attributgruppen.
- **Vereinswappen** und **Spielerportraet**, beide aus den Spielstandsdaten
  abgeleitet.

## Noch nicht enthalten

Diese Punkte aus dem Konzept sind bewusst spaeteren Ausbauschritten vorbehalten:

- Die Spiele des World Nations Cup werden derzeit simuliert; die Beteiligung des
  eigenen Spielers (Laenderspiele, Tore, Turnierverlauf) fliesst in die Karriere
  ein, ist aber noch nicht interaktiv spielbar.
- **Abschnitt 34**: Vorvertraege und Tauschgeschaefte. Leihen sind umgesetzt,
  der uebrige Transfermarkt bleibt auf Angebote an den eigenen Spieler und eine
  einfache Umverteilung der Computerspieler beschraenkt.
- **Abschnitt 20.4**: Erweiterte Spielersteuerung ueber ein komplettes Spiel.
- **Abschnitt 58**: Sound und Musik.

## Veroeffentlichen

Das Spiel ist eine reine Browseranwendung ohne Server-Anteil: Der Build ist eine
statische Seite, die auf jedem Webspace liegen kann. Spielstaende und geladene
Datenbanken liegen in IndexedDB, also im Browser jedes einzelnen Besuchers -
es gibt nichts zu synchronisieren und keine Nutzerdaten auf dem Server.

**Fuer eine oeffentliche Seite immer so bauen:**

```bash
npm run build:public
```

Der Unterschied ist wichtig: `npm run build` kompiliert die privaten
Datenpakete aus `src/data/` mit ins ausgelieferte JavaScript - sie waeren
damit oeffentlich abrufbar. `npm run build:public` laesst sie ersatzlos weg
und liefert nur die frei erfundenen Namen aus. Besucher koennen sich ihre
eigene Datenbank weiterhin im Browser laden; diese verlaesst ihren Rechner nie.

**Vor dem Hochladen ausfuellen:** Die Betreiberangaben fuer das Impressum stehen
als Vorlage in `src/ui/Legal.tsx` (Konstante `BETREIBER`). Solange dort noch
Platzhalter stehen, weist die Seite selbst darauf hin.

Danach den Inhalt von `dist/` auf den Webserver legen. Weitere Voraussetzungen
gibt es nicht - kein Node, keine Datenbank, kein Backend.

Die Anwendung ist in Teile zerlegt, damit der erste Aufruf nicht auf alles
warten muss: Beim Oeffnen laedt nur das Hauptmenue. Spiellogik, Karrierebereich,
Spielbildschirm und Editor kommen erst, wenn sie gebraucht werden.

| Teil | wird geladen |
| --- | --- |
| Menue und Rahmen | beim Oeffnen |
| Spiellogik | beim Start oder Laden einer Karriere |
| Karrierebereich | beim Betreten der Karriere |
| Spielbildschirm | beim ersten Spiel |
| Editor | beim Oeffnen der Datenbanken |

## Ligen und Wettbewerbe

Anzahl und Groesse der Ligen sind nicht fest vorgegeben. Ohne eigene Daten
spielt jedes Land drei Ligen zu zwanzig Vereinen; eine geladene Datenbank kann
beliebig viele Ebenen mit beliebiger Vereinszahl beschreiben. Spielplan,
Tabelle, Auf- und Abstieg sowie die Relegation richten sich danach: Eine Liga
mit achtzehn Vereinen spielt 34 Spieltage, eine mit zwoelf entsprechend 22.

## Eigene Vereins- und Spielernamen

Alle mitgelieferten Laender, Vereine und Personen sind frei erfunden.

Der empfohlene Weg fuer eigene Namen fuehrt ueber **Datenbanken & Editor** im
Hauptmenue: Dort laesst sich ein Ordner mit CSV-Dateien laden, im Spiel
bearbeiten und mit eigenen Wappen versehen. Diese Daten liegen ausschliesslich
im Browser und koennen gar nicht in einen Build geraten. Aufbau und ein
vollstaendiges Beispiel liegen unter `public/beispiel-datenbank/`.

Alternativ - und nur fuer den privaten Gebrauch - koennen Datenpakete als JSON
unter `src/data/` liegen; Format und Felder stehen in
[src/data/README.md](src/data/README.md). Diese Dateien landen in einem
normalen Build, siehe Abschnitt "Veroeffentlichen".

Solche Dateien enden auf `.local.json` und stehen in `.gitignore`: Sie bleiben
auf dem eigenen Rechner und landen nie im Repository. Fehlt ein Datenpaket,
laeuft das Spiel unveraendert mit den erfundenen Namen. Ein damit erzeugter
Produktionsbuild (`dist/`) enthaelt die Daten allerdings sehr wohl und sollte
entsprechend nicht weitergegeben werden.

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
    international.ts Champions Cup
    trophy.ts        Continental Trophy
    national.ts      Nationalmannschaft und World Nations Cup
    loan.ts          Leihgeschaefte
    agent.ts         Spielerberater
    social.ts        Sozialer Feed
    media.ts         Nachrichten und Interviews
    events.ts        Ereignisse abseits des Platzes
    relationships.ts Mentor, Freunde, Rivalen
    rivalry.ts       Derbys und Spielbedeutung
    identity.ts      Wappen und Sponsoren, aus der Vereins-Id abgeleitet
    stats.ts         Statistikverwaltung und Rekorde
    retirement.ts    Karriereende
    game.ts          Karrierestart, Tagesablauf, Spielabwicklung
    save.ts          IndexedDB-Spielstaende
    realData.ts      Optionale eigene Vereins- und Spielernamen
  data/              Eigene Datenpakete (gitignoriert) und ihre Beschreibung
  state/             Zustandsspeicher und Aktionen der Oberflaeche
  ui/                React-Komponenten
    tabs/            Die zehn Bereiche des Karriere-Dashboards
    match/           Spielbildschirm und interaktive Canvas-Szenen
    FormationPitch   Aufstellung als Feldgrafik
    AttributeRadar   Attributprofil als Netzdiagramm
    ClubCrest        Vereinswappen als SVG
    PlayerAvatar     Spielerportraet als SVG
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

# Road to Glory

Browserbasiertes Fußball-Karrierespiel. Du steuerst keinen Verein, sondern einen
einzelnen selbst erstellten Fußballer - von der Jugend bis zur Legende. Die
wichtigsten Momente spielst du selbst: Richtung, Kraft und Ballkontaktpunkt
bestimmst du, während im Hintergrund eine vollständige Fußballwelt weiterläuft.

Dies ist die **erste spielbare Version (0.1)** nach dem Konzept. Sie entspricht
Phase 1 bis 4 des Entwicklungsplans und geht beim Umfang über die in Abschnitt 61
beschriebene Minimalversion hinaus.

## Starten

```bash
npm install
```

```bash
npm run dev
```

Danach `http://localhost:5173` im Browser öffnen.

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
| 4-6 Spielwelt, Ligensystem | Neun Länder: 27 Ligen, 540 Vereine, rund 13.500 Spieler, 9 nationale Pokale. Das eigene Land wird voll detailliert simuliert, die übrigen ergebnis-orientiert (Konzept Abschnitt 56) |
| 7-8 Ligamodus, Auf- und Abstieg | 38 Spieltage, alle Tabellenkriterien, direkter Auf- und Abstieg, Relegation über Hin- und Rückspiel |
| 9 Nationaler Pokal | Alle 60 Vereine, Vorrunde bis Finale, Verlängerung und Elfmeterschießen |
| 10 Continental Champions Cup | 24 Teilnehmer aus neun Ländern, Ligaphase (8 Spiele, gemeinsame Tabelle), K.-o.-Phase Achtelfinale bis Finale; eigene Teilnahme spielbar, Sieger in Chronik und Rekorden |
| 11 Continental Trophy | Zweiter Vereinswettbewerb parallel zum Champions Cup, mit eigener Auslosung und Chronikeintrag |
| 12-13 Nationalmannschaft, World Nations Cup | Nominierung des eigenen Spielers nach Stärke, Form und Positionskonkurrenz; World Nations Cup alle vier Jahre (16 Nationen, Gruppen- und K.-o.-Phase) mit Länderspielen, Toren und Titel in der Chronik. Die eigene Nation ist immer im Feld, auch ohne eigenes Ligasystem |
| 14-15 Spielerstellung | Grunddaten, Positionen, Aussehen, fünf Karrierehintergründe. Spielland und Herkunftsland werden getrennt gewählt: 81 Nationen aus allen Erdteilen |
| 16-17 Attribute, Potenzial | 54 Attribute in fünf Gruppen, positionsabhängige Gesamtstärke, veränderliches Potenzial |
| 18-19 Wochenablauf, Training | Wochentraining mit 17 Schwerpunkten und vier Intensitätsstufen |
| 20-26 Spielmodi und Gameplay | Simulation, eigene Highlights, alle wichtigen Szenen; Schuss, Pass, Zweikampf, Dribbling mit Finten, Freistoß mit Mauer, Elfmeter, Torwartparade |
| 22-23 Ballsteuerung | Richtung, Kraftanzeige, Ballkontaktpunkt mit echter Flugbahnberechnung inklusive Effet und Schwerkraft, Live-Torblick als Vorschau und Auswertung |
| 20-26 Flanke und Block | Wer außen durchkommt, flankt in den Strafraum - die Flankenstärke entscheidet mit, ein angekommener Ball wird zum Kopfball. Ein geblockter Schuss zeigt den Verteidiger dort, wo er den Ball wirklich erwischt hat |
| Spieltag: Umfeld | Schiedsrichter mit fünf Stilen, Wetter, Anstoßzeit und Flutlicht, Zuschauerzahl und Auslastung, gegnerische Formation - alles wirkt auf die Szenen, nicht nur auf die Anzeige |
| Spielerstärken | Zehn erwerbbare Eigenschaften (Freistoßspezialist, Kopfballungeheuer, Nervenstark und weitere), die sich aus Anlage und Nachweis im Spiel entwickeln |
| Eigene Entscheidungen | Lebensweise, Zusatzeinheiten, Anspruch auf Standards, Wechselwunsch - dazu am Karrierestart verteilbare Attributpunkte und die Wahl des Talentverlaufs |
| Spielerkarte | Die 54 Attribute zu sechs Werten verdichtet, mit Gesicht, Wappen und Stärkestufe |
| 27-28 Simulation, Taktik | Minutenweise Detailsimulation für eigene Spiele, schnelle Hintergrundsimulation für alle übrigen; sieben Formationen, acht Spielstile |
| 29 Trainerbeziehung | Beeinflusst Aufstellung, Einsatzzeit und Kaderplatz |
| 33-34 Verträge, Transfers | Vertragsverlängerung, Angebote nach jeder Saison, Wechsel des eigenen Spielers, Transferbewegungen der Computerspieler |
| 34 Vorverträge | Im letzten halben Vertragsjahr fällt keine Ablöse mehr an: Vereine bieten ablösefrei für die kommende Saison, das Gehalt handelt man selbst aus. Der eigene Verein erfährt es - Trainerbeziehung und Verlängerungsangebot sind danach weg |
| 34 Leihgeschäfte | Wer kaum spielt, bekommt Leihangebote aus tieferen Spielklassen - zur Winterpause und zum Saisonende |
| 35 Beratersystem | Ein Berater sucht Vereine, verhandelt Gehalt nach und fordert eine größere Rolle ein; Aufträge kosten Zeit und Vertrauen |
| 36-38 Marktwert, Form, Fitness | Dynamischer Marktwert, Form, Moral, Fitness, Spielpraxis, Selbstvertrauen |
| 37 Verletzungen | Neun Verletzungsarten mit Heilungsverlauf und dauerhaften Folgen bei schweren Fällen |
| 39 Medien | Nachrichtensystem mit Kategorien und Filter; Interviews nach markanten Spielen mit drei Antworttonlagen (Wirkung auf Moral, Trainer, Fans, Image, Reputation) |
| 40 Soziales Netzwerk | Feed mit Fan-, Medien- und Kritikerstimmen; eigene Beiträge wirken auf Ansehen, Fans und Umfeld |
| 30 Beziehungen zu Mitspielern | Mentor, Freunde und Rivalen, die sich mit gemeinsamer Spielzeit entwickeln; Freunde bieten sich im Spiel öfter an, das Umfeld beeinflusst die Moral |
| 31-32 Leben abseits des Platzes | Wöchentliche Ereignisse (Sponsor, Mannschaftsabend, Charity, Zusatztraining, soziale Medien) mit Wirkung auf Moral, Fitness, Image, Fans und Trainerbeziehung |
| 41-42 Saisonziele, Bewertung | Vier Saisonziele, positionsabhängige Notenberechnung von 1,0 bis 10,0 |
| 43-48 Statistiken, Rekorde | Vollständige Einzel- und Saisonstatistik, Filter nach Saison, Wettbewerb und Verein, Rekordbuch |
| 49-50 Chronik, Auszeichnungen | Karrierechronik mit Meilensteinen, fünf Auszeichnungen je Liga und Saison |
| 51 Saisonkalender, Zeitsprünge | Juli bis Juni mit Winterpause, Pokalrunden unter der Woche, Relegation im Juni. Sprung auf ein Datum, auf das nächste Spiel oder über eine ganze Saison; eigene Spiele halten wahlweise an, Entscheidungen immer |
| 53 Save-System | Mehrere Spielstände in IndexedDB, Autosave, Umbenennen, Duplizieren, Export und Import |
| 56 Leistungsoptimierung | Zwei Detailstufen: Detailsimulation für relevante Spiele, schnelle Simulation für den Rest |
| 57 Oberfläche | Karriere-Dashboard mit zehn Bereichen, responsiv für Desktop und Tablet |
| Sprachen | Deutsch und Englisch, vollständig aus einem Katalog mit rund 2.450 Einträgen je Sprache; der Rauchtest prüft beide Seiten auf Vollständigkeit |
| 59 Schwierigkeitsgrad | Vier Stufen mit Auswirkung auf Trefferbereiche, Entwicklung, Verletzungen und Einsatzzeit |

## Oberfläche

Alles wird als Inline-SVG gezeichnet, ohne Bilddateien:

- **Aufstellungen** als Feldgrafik, Trikots in Vereinsfarben, der eigene Spieler
  hervorgehoben - im Spielbildschirm für beide Mannschaften, im Kaderbereich
  für die voraussichtliche Startelf.
- **Kräfteverhältnis** vor dem Anpfiff: Angriff, Mittelfeld, Abwehr und
  Torwart beider Teams im direkten Balkenvergleich.
- **Spielverlauf** als Zeitachse mit Treffern, Karten und Wechseln beider
  Seiten, darunter ein Druckverlauf je Viertelstunde.
- **Attributprofil** als Netzdiagramm über die Attributgruppen.
- **Vereinswappen** und **Spielerporträt**, beide aus den Spielstandsdaten
  abgeleitet.
- **Spielerkarte** mit sechs verdichteten Werten, Gesicht, Wappen und einer
  Rahmenfarbe nach Gesamtstärke.
- **Torblick** nach jedem Abschluss: wo der Ball die Linie kreuzt, wohin der
  Torwart gehechtet ist und - bei einem Block - wo der Verteidiger stand.
- **Spielfiguren** in Vogelperspektive mit Laufbewegung, dazu Torhüter und
  Verteidiger in der Frontansicht.
- **Länderprofil** bei der Spielerstellung: Beschreibung, Besonderheiten und
  Balken für Ansehen, Geld und Nachwuchsarbeit.

## Noch nicht enthalten

Diese Punkte aus dem Konzept sind bewusst späteren Ausbauschritten vorbehalten:

- Die Spiele des World Nations Cup werden derzeit simuliert; die Beteiligung des
  eigenen Spielers (Länderspiele, Tore, Turnierverlauf) fließt in die Karriere
  ein, ist aber noch nicht interaktiv spielbar.
- **Abschnitt 34**: Tauschgeschäfte. Leihen und Vorverträge sind umgesetzt,
  der übrige Transfermarkt bleibt auf Angebote an den eigenen Spieler und eine
  einfache Umverteilung der Computerspieler beschränkt.
- **Abschnitt 20.4**: Erweiterte Spielersteuerung über ein komplettes Spiel.
- **Abschnitt 58**: Sound und Musik.

## Veröffentlichen

Das Spiel ist eine reine Browseranwendung ohne Server-Anteil: Der Build ist eine
statische Seite, die auf jedem Webspace liegen kann. Spielstände und geladene
Datenbanken liegen in IndexedDB, also im Browser jedes einzelnen Besuchers -
es gibt nichts zu synchronisieren und keine Nutzerdaten auf dem Server.

**Für eine öffentliche Seite immer so bauen:**

```bash
npm run build:public
```

Der Unterschied ist wichtig: `npm run build` kompiliert die privaten
Datenpakete aus `src/data/` mit ins ausgelieferte JavaScript - sie wären
damit öffentlich abrufbar. `npm run build:public` lässt sie ersatzlos weg
und liefert nur die frei erfundenen Namen aus. Besucher können sich ihre
eigene Datenbank weiterhin im Browser laden; diese verlässt ihren Rechner nie.

**Vor dem Hochladen ausfüllen:** Die Betreiberangaben für das Impressum stehen
als Vorlage in `src/ui/Legal.tsx` (Konstante `BETREIBER`). Solange dort noch
Platzhalter stehen, weist die Seite selbst darauf hin.

Danach den Inhalt von `dist/` auf den Webserver legen. Weitere Voraussetzungen
gibt es nicht - kein Node, keine Datenbank, kein Backend.

Die Anwendung ist in Teile zerlegt, damit der erste Aufruf nicht auf alles
warten muss: Beim Öffnen lädt nur das Hauptmenü. Spiellogik, Karrierebereich,
Spielbildschirm und Editor kommen erst, wenn sie gebraucht werden.

| Teil | wird geladen |
| --- | --- |
| Menü und Rahmen | beim Öffnen |
| Spiellogik | beim Start oder Laden einer Karriere |
| Karrierebereich | beim Betreten der Karriere |
| Spielbildschirm | beim ersten Spiel |
| Editor | beim Öffnen der Datenbanken |

## Herkunft und Spielort

Wo jemand spielt und woher er kommt, sind zwei verschiedene Dinge. Bei der
Spielerstellung werden beide getrennt gewählt: das Spielland aus den neun
Ländern mit eigenem Ligasystem, das Herkunftsland aus 81 Nationen.

Jede Nation hat ein fußballerisches Gewicht. Es steuert zweierlei: wie viele
Legionäre sie in die Ligen schickt - Argentinien deutlich mehr als Bolivien -
und wie stark ihre Auswahl im World Nations Cup auftritt. Wo genug Spieler
einer Herkunft in den Ligen stehen, zählt deren tatsächliche Stärke mit, so
dass eine goldene Generation sich auch im Turnier bemerkbar macht.

In einer kleineren Nation kommt man leichter in die Auswahl als in einer
großen - die Wahl des Herkunftslandes ist damit auch eine spielerische
Entscheidung, nicht nur eine kosmetische.

## Ligen und Wettbewerbe

Anzahl und Größe der Ligen sind nicht fest vorgegeben. Ohne eigene Daten
spielt jedes Land drei Ligen zu zwanzig Vereinen; eine geladene Datenbank kann
beliebig viele Ebenen mit beliebiger Vereinszahl beschreiben. Spielplan,
Tabelle, Auf- und Abstieg sowie die Relegation richten sich danach: Eine Liga
mit achtzehn Vereinen spielt 34 Spieltage, eine mit zwölf entsprechend 22.

## Eigene Vereins- und Spielernamen

Alle mitgelieferten Vereine, Stadien, Städte und Personen sind frei erfunden.
Ländernamen sind geografische Bezeichnungen und damit frei verwendbar; die
Ligen tragen beschreibende Namen wie "Deutschland Erste Liga" statt
geschützter Wettbewerbsmarken.

Der empfohlene Weg für eigene Namen führt über **Datenbanken & Editor** im
Hauptmenü: Dort lässt sich ein Ordner mit CSV-Dateien laden, im Spiel
bearbeiten und mit eigenen Wappen versehen. Diese Daten liegen ausschließlich
im Browser und können gar nicht in einen Build geraten. Aufbau und ein
vollständiges Beispiel liegen unter `public/beispiel-datenbank/`.

Kaderdateien haben die Spalten `verein;name;position;nation`. Position und
Nation sind freiwillig; bei der Nation reicht die Kennung (`br`) oder der Name
(`Brasilien`, auch `Österreich` mit Umlaut). Bleibt die Spalte leer, würfelt
das Spiel die Herkunft aus dem Gewicht der Nationen. Alle Spielwerte erzeugt
das Spiel weiterhin selbst - eine Datenbank liefert nur Namen und Herkunft.

Alternativ - und nur für den privaten Gebrauch - können Datenpakete als JSON
unter `src/data/` liegen; Format und Felder stehen in
[src/data/README.md](src/data/README.md). Diese Dateien landen in einem
normalen Build, siehe Abschnitt "Veröffentlichen".

Solche Dateien enden auf `.local.json` und stehen in `.gitignore`: Sie bleiben
auf dem eigenen Rechner und landen nie im Repository. Fehlt ein Datenpaket,
läuft das Spiel unverändert mit den erfundenen Namen. Ein damit erzeugter
Produktionsbuild (`dist/`) enthält die Daten allerdings sehr wohl und sollte
entsprechend nicht weitergegeben werden.

## Aufbau des Projekts

```
src/
  engine/            Spiellogik, vollständig unabhängig von der Oberfläche
    rng.ts           Deterministischer Zufallsgenerator je Spielstand
    date.ts          Kalenderrechnung
    types.ts         Zentrale Datentypen des Spielstands
    attributes.ts    54 Attribute, Positionen, Gesamtstärkeberechnung
    countries.ts     Die neun bespielbaren Länder mit eigenem Ligasystem
    nations.ts       Herkunftsländer der Spieler, weltweit
    names.ts         Fiktive Namens- und Ortspools
    backgrounds.ts   Karrierehintergründe
    playerGen.ts     Spielererzeugung, Marktwert, Gehalt
    worldGen.ts      Länder, Ligen, Vereine, Kader
    fixtures.ts      Spielplan und Saisonkalender
    cup.ts           Pokalauslosung
    table.ts         Tabellenberechnung
    lineup.ts        Aufstellung und Mannschaftsstärken
    matchSim.ts      Gemeinsame Bausteine und Hintergrundsimulation
    matchEngine.ts   Minutenweise Detailsimulation mit Unterbrechung für Highlights
    matchTypes.ts    Typen für Highlights
    ballAction.ts    Ballphysik, Ausführungsfehler, Torwartlogik
    development.ts   Training, Entwicklung, Verletzungen, Form
    season.ts        Saisonstart und -ende, Relegation, Auszeichnungen, Transfers
    international.ts Champions Cup
    trophy.ts        Continental Trophy
    national.ts      Nationalmannschaft und World Nations Cup
    loan.ts          Leihgeschäfte
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
    save.ts          IndexedDB-Spielstände
    realData.ts      Optionale eigene Vereins- und Spielernamen
  data/              Eigene Datenpakete (gitignoriert) und ihre Beschreibung
  state/             Zustandsspeicher und Aktionen der Oberfläche
  ui/                React-Komponenten
    tabs/            Die zehn Bereiche des Karriere-Dashboards
    match/           Spielbildschirm und interaktive Canvas-Szenen
    FormationPitch   Aufstellung als Feldgrafik
    AttributeRadar   Attributprofil als Netzdiagramm
    ClubCrest        Vereinswappen als SVG
    PlayerAvatar     Spielerporträt als SVG
```

Die Engine kennt React nicht und lässt sich unabhängig testen oder später
serverseitig verwenden.

## Steuerung einer Ballaktion

Eine Ballaktion läuft in drei Schritten ab (bei Pässen in vier):

1. **Richtung** - Zielpunkt auf dem Spielfeld anklicken.
2. **Kraft** - Maustaste oder Leertaste gedrückt halten, die Anzeige läuft auf
   und wieder zurück. Beim gewünschten Wert loslassen. Maßgeblich ist die
   Haltedauer, nicht die Bildrate.
3. **Ballkontakt** - In der Nahansicht den Punkt am Ball wählen. Daneben zeigt
   ein **Torblick** live, wo der Ball ankäme:
   - Mitte: normaler Schuss, rund neun Grad Abflugwinkel
   - Unterseite: der Ball wird angehoben, bis rund 26 Grad - Lupfer und Flanken
   - Oberseite: flache Bahn mit Topspin, Bodenpässe und Flachschüsse
   - Seitlich: Effet, über 20 Meter krümmt sich die Bahn um rund drei Meter

Aus diesen Eingaben wird eine echte Flugbahn berechnet, mit Schwerkraft,
Luftwiderstand und Magnus-Effekt. Die Attribute des Spielers, der Gegnerdruck,
Form, Fitness und Selbstvertrauen verrauschen die Eingabe: Eine gute Eingabe
erhöht die Erfolgschance, garantiert sie aber nicht. Ein Weltklassespieler
gleicht kleine Fehler aus, ein Jugendspieler nicht.

Nach jedem Abschluss zeigt der Torblick den tatsächlichen Auftreffpunkt und den
Sprung des Torwarts, dazu eine Begründung: "Zu zentral gezielt", "Zu hoch
angesetzt", "Der Effet trägt den Ball rechts vorbei". So lässt sich die
Mechanik lernen, statt nur ein Ergebnis hinzunehmen.

### Weitere Spielsituationen

- **Dribbling** (Abschnitt 24): erst die Bewegung wählen, dann den Moment
  treffen. Von "Ball vorlegen" bis "Hackentrick" - schwierigere Finten haben ein
  engeres Zeitfenster, bringen aber deutlich mehr. Sie werden über steigende
  Dribblingwerte freigeschaltet. Ein gelungenes Dribbling führt direkt in eine
  bessere Abschlusssituation.
- **Freistoß**: mit Mauer, über oder um sie herum. Antreten darf, wer zu den
  beiden besten Schützen der Mannschaft gehört - ein Platz, den man sich über
  das Freistosstraining erarbeitet.
- **Zweikampf und Torwartparade**: Zeitfenster, deren Größe von den Attributen
  und vom Schwierigkeitsgrad abhängt.

Die drei Spielmodi unterscheiden sich spürbar:

- **Komplett simulieren**: nur Ergebnis, Bewertung und Statistik.
- **Nur eigene Highlights**: du spielst jede Ballaktion deines Spielers selbst.
- **Alle wichtigen Szenen**: zusätzlich bist du ohne Ball gefragt - mehr
  Zweikämpfe und Klärungen gegnerischer Großchancen (Konzept Abschnitt 20.3).
  Wie oft du dich in Schüsse wirfst, hängt von deiner Position ab: Verteidiger
  häufig, Stürmer kaum.

Während der Partie wählst du jederzeit deine **Ausrichtung**:

- **Nach vorne**: mehr Abschlüsse und Dribblings, hoher Kraftverbrauch.
- **Ausbalanciert**: ausgeglichene Beteiligung.
- **Defensiv**: mehr Zweikämpfe und Klärungen, weniger im Angriff.
- **Kräfte schonen**: Zurückhaltung, schont die Fitness für die Schlussphase.

So entscheidest du zwischen den Highlights, ob du ein Spiel an dich reißt oder
Kräfte für später sparst.

**Halbzeit:** Zur Pause hält die Partie an. Der Trainer sagt je nach Spielstand
etwas, und du wählst eine Reaktion - kompakt verteidigen, so weitermachen,
volle Offensive oder die Mannschaft mitreißen. Die Wahl verändert Angriff und
Abwehr deines Teams in der zweiten Hälfte sowie den Kraftverbrauch; "Mannschaft
mitreißen" wirkt umso stärker, je höher deine Führungsstärke ist.

**Verletzung:** Ziehst du dir im Spiel eine Blessur zu, entscheidest du selbst
(Konzept Abschnitt 37): auswechseln lassen (sicher, normale Genesung) oder auf
die Zähne beißen. Weiterspielen kostet Leistung und riskiert je nach Schwere
eine Verschlimmerung mit deutlich längerem Ausfall - meistens, aber nicht immer,
geht es glimpflich aus.

Alle Timingmechaniken rechnen mit der Uhr statt mit Einzelbildern. Sie bleiben
damit fair, auch wenn der Browser gerade keine Bilder liefert.

## Entwicklerwerkzeug

`devtest.html` ist ein Rauchtest der Spiellogik. Er erzeugt eine Karriere,
spielt drei komplette Saisons durch und prüft Tabellen, Torquoten, Pokalverlauf,
Auf- und Abstieg, Statistiken und die Größe des Spielstands. Zusätzlich
lässt er 39 Spiele im Highlight-Modus laufen und prüft, welche Situationen
entstehen, ob die Entwicklung des Spielers stimmt und ob die Ballphysik
plausible Ergebnisse liefert (gute gegen schlechte Eingabe, Wirkung des
Kontaktpunkts, Stärke des Effets). Aufruf bei laufendem Entwicklungsserver:

```bash
npm run dev
```

Danach `http://localhost:5173/devtest.html` öffnen. Der Test ist nicht Teil des
Produktionsbuilds.

## Hinweis zu Lizenzen

Vereine, Städte, Stadien und Spielernamen sind frei erfunden. Es werden keine
echten Vereinsnamen, Wappen oder Personen verwendet. Länder- und Nationsnamen
sind geografische Bezeichnungen und keine Marken; die Ligen tragen
beschreibende Namen statt geschützter Wettbewerbsmarken.

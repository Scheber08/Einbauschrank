/**
 * Vereinsfinanzen: Was sich ein Verein leisten kann.
 *
 * `club.budget` (Ablösemittel) und `club.wageBudget` (Gehaltsrahmen) gab es von
 * Anfang an. Gelesen wurden sie nie - nur einmal im Jahr bei Auf- und Abstieg
 * mit einem Faktor multipliziert. Entsprechend waren sie auch nie geeicht:
 * Gemessen an den echten Kadern lag jeder Erstligist **fünf- bis dreizehnfach**
 * über seinem Gehaltsbudget, und das Transferbudget des stärksten Vereins
 * reichte nicht für ein Zehntel seines teuersten Spielers.
 *
 * Beide Werte kommen jetzt aus dem tatsächlichen Kader (`worldGen.setzeBudgets`)
 * und werden hier gelesen: Ein Verein bietet nur, was er bezahlen kann, und
 * jeder Transfer verschiebt Geld von einem Verein zum anderen.
 *
 * Warum das dem Spiel etwas bringt: Vorher war die Frage "wer holt mich?" allein
 * eine Frage der Reputation. Jetzt kann ein Verein, der im Sommer schon
 * eingekauft hat, sich den nächsten nicht mehr leisten - und ein Aufsteiger mit
 * frischem Geld greift plötzlich nach oben.
 */
import type { Club, GameState, Id } from './types';

/** Gehaltslast aller Vereine in einem Durchgang. */
export type WageIndex = Map<Id, number>;

/**
 * Baut die Gehaltslast je Verein in einem einzigen Durchlauf.
 *
 * Einzeln je Verein zu summieren wäre O(Spieler x Vereine); bei 7.500 Spielern
 * und mehreren hundert Wechseln pro Transferfenster ist das der Unterschied
 * zwischen "unmerklich" und "das Spiel steht".
 */
export function buildWageIndex(state: GameState): WageIndex {
  const index: WageIndex = new Map();
  for (const p of Object.values(state.players)) {
    if (!p.clubId || !p.contract) continue;
    index.set(p.clubId, (index.get(p.clubId) ?? 0) + p.contract.salary);
  }
  return index;
}

/** Gehaltslast eines einzelnen Vereins. Für Einzelabfragen in der Oberfläche. */
export function wageBill(state: GameState, clubId: Id): number {
  let sum = 0;
  for (const p of Object.values(state.players)) {
    if (p.clubId === clubId && p.contract) sum += p.contract.salary;
  }
  return sum;
}

/** Wie viel Gehalt der Verein noch vergeben kann. Kann negativ sein. */
export function wageRoom(club: Club, bill: number): number {
  return club.wageBudget - bill;
}

/**
 * Kann sich der Verein diesen Zugang leisten?
 *
 * Beide Grenzen sind bewusst weich: Ein Verein darf sich strecken, wenn der
 * Spieler es wert ist - deshalb `toleranz`. Ohne diese Luft wäre der
 * Transfermarkt starr, und ein Verein könnte nie über seine Verhältnisse
 * hinauswachsen, was gerade den Reiz eines Aufsteigers ausmacht.
 */
export function canSign(
  club: Club, bill: number, fee: number, salary: number, toleranz = 1,
): boolean {
  if (fee > club.budget * toleranz) return false;
  if (salary > wageRoom(club, bill) * toleranz) return false;
  return true;
}

/**
 * Verbucht einen Transfer: Der Käufer zahlt, der abgebende Verein bekommt.
 *
 * Ein ablösefreier Wechsel (`fee` gleich 0) verschiebt kein Geld, verbraucht
 * aber Gehaltsrahmen - das ist der eigentliche Grund, warum ein solcher Wechsel
 * für einen klammen Verein trotzdem nicht immer möglich ist.
 */
export function bookSigning(
  buyer: Club, seller: Club | null, fee: number, index: WageIndex | null,
  salary: number, oldSalary = 0,
) {
  if (fee > 0) {
    buyer.budget = Math.max(0, Math.round(buyer.budget - fee));
    if (seller) seller.budget = Math.round(seller.budget + fee);
  }
  if (index) {
    index.set(buyer.id, (index.get(buyer.id) ?? 0) + salary);
    if (seller) index.set(seller.id, Math.max(0, (index.get(seller.id) ?? 0) - oldSalary));
  }
}

/**
 * Wie stark greift dieser Verein für diese Ablöse in die Tasche?
 *
 * Rückgabe: Anteil am verfügbaren Transferbudget. Die Oberfläche macht daraus
 * eine Aussage ("Rekordablöse für diesen Verein") - erst dadurch ist an einem
 * Angebot ablesbar, was es dem Verein bedeutet.
 */
export function feeShare(club: Club, fee: number): number {
  if (club.budget <= 0) return fee > 0 ? 99 : 0;
  return fee / club.budget;
}

/**
 * Setzt die Budgets zum Saisonwechsel neu.
 *
 * Bewusst kein Fortschreiben des Vorjahreswerts: Über zwanzig Saisons driftet
 * jede Fortschreibung weg (die alte Auf-/Abstiegsskalierung mit 1,35 und 0,72
 * hätte einen Fahrstuhlverein binnen weniger Jahre ruiniert oder aufgebläht).
 * Stattdessen wird jede Saison neu aus dem Kader gerechnet - so bleibt die
 * Wirtschaft an das gebunden, was tatsächlich auf dem Platz steht.
 *
 * `erfolg` verschiebt das Ergebnis um bis zu ein Fünftel: Wer oben mitspielt,
 * hat im nächsten Sommer mehr in der Hand.
 */
/**
 * Wieviel eine Spielklasse einbringt, als Faktor auf Budget und
 * Gehaltsrahmen. Erste Liga deutlich mehr, dritte deutlich weniger.
 */
const KLASSEN_EINNAHMEN: Record<number, number> = { 1: 1.45, 2: 1, 3: 0.72 };

export function resetBudgets(
  state: GameState, erfolgJeVerein: Map<Id, number>, zufall: () => number,
) {
  const bill = buildWageIndex(state);
  const wert = new Map<Id, number>();
  for (const p of Object.values(state.players)) {
    if (!p.clubId) continue;
    wert.set(p.clubId, (wert.get(p.clubId) ?? 0) + p.marketValue);
  }

  for (const club of Object.values(state.clubs)) {
    const last = bill.get(club.id) ?? 0;
    const kaderwert = wert.get(club.id) ?? 0;
    // 1 heisst Mittelmass, darunter schwach, darueber stark.
    const erfolg = erfolgJeVerein.get(club.id) ?? 1;

    // Die Spielklasse bestimmt die Einnahmen mit.
    //
    // Vorher hing das Budget allein an Kaderwert und bisheriger
    // Gehaltslast. Ein Aufsteiger hatte damit genau so wenig Geld wie in
    // der Liga darunter, konnte niemanden holen und stieg prompt wieder
    // ab; ein Absteiger behielt seinen teuren Kader und kam sofort
    // zurueck. Gemessen ueber drei Saisons: 43 Prozent der Aufsteiger
    // gingen direkt wieder runter, 35 Prozent der Absteiger direkt wieder
    // hoch - ein Fahrstuhl statt einer Liga.
    //
    // Fernsehgeld und Zuschauer unterscheiden sich zwischen erster und
    // dritter Liga um ein Vielfaches. Genau das fehlte.
    const klasse = KLASSEN_EINNAHMEN[
      state.competitions[club.leagueId]?.level ?? 3] ?? 1;

    // Bewusst **ohne** den Klassenfaktor: Der Gehaltsrahmen wird aus der
    // bisherigen Gehaltslast fortgeschrieben. Ein dauerhafter Aufschlag
    // wuerde sich Saison um Saison aufschaukeln - genau die Drift, vor der
    // der Kommentar am Saisonwechsel warnt. Die Spielklasse wirkt deshalb
    // nur auf den Transferetat, und der kommt aus dem Kaderwert.
    const luft = 1.08 + zufall() * 0.22;
    club.wageBudget = Math.max(5000, Math.round(last * luft * (0.9 + erfolg * 0.1)));

    const anteil = (0.07 + zufall() * 0.07) * (0.8 + erfolg * 0.2);
    club.budget = Math.max(50000,
      Math.round(kaderwert * anteil * klasse / 10000) * 10000);
  }
}

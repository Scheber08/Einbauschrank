/**
 * Deterministischer Zufallsgenerator.
 * Jeder Spielstand besitzt einen Seed, damit sich eine Karriere exakt
 * reproduzieren laesst (wichtig fuer Debugging und spaetere Cloud-Saves).
 */
export class Rng {
  private s: number;

  constructor(seed: number) {
    this.s = seed >>> 0 || 1;
  }

  /** Aktueller interner Zustand - wird im Spielstand gespeichert. */
  get state(): number {
    return this.s;
  }

  set state(v: number) {
    this.s = v >>> 0 || 1;
  }

  /** Gleichverteilt in [0, 1). */
  next(): number {
    // mulberry32
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Ganzzahl in [min, max] inklusive. */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** Gleitkomma in [min, max). */
  float(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** true mit Wahrscheinlichkeit p. */
  chance(p: number): boolean {
    return this.next() < p;
  }

  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }

  /** Zieht ohne Zuruecklegen und veraendert das Array nicht. */
  sample<T>(arr: readonly T[], n: number): T[] {
    const copy = arr.slice();
    this.shuffle(copy);
    return copy.slice(0, n);
  }

  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /** Normalverteilung (Box-Muller), begrenzt auf +/- 3 Sigma. */
  normal(mean = 0, sd = 1): number {
    const u = Math.max(this.next(), 1e-9);
    const v = this.next();
    const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    return mean + clamp(z, -3, 3) * sd;
  }

  /** Gewichtete Auswahl. Gewichte muessen >= 0 sein. */
  weighted<T>(items: readonly T[], weightOf: (item: T, index: number) => number): T {
    let total = 0;
    const weights: number[] = [];
    for (let i = 0; i < items.length; i++) {
      const w = Math.max(0, weightOf(items[i], i));
      weights.push(w);
      total += w;
    }
    if (total <= 0) return this.pick(items);
    let r = this.next() * total;
    for (let i = 0; i < items.length; i++) {
      r -= weights[i];
      if (r <= 0) return items[i];
    }
    return items[items.length - 1];
  }

  /** Poisson-verteilte Zufallszahl (Knuth), fuer Torzahlen der Hintergrundsimulation. */
  poisson(lambda: number): number {
    const l = Math.exp(-Math.max(0.01, lambda));
    let k = 0;
    let p = 1;
    do {
      k++;
      p *= this.next();
    } while (p > l && k < 25);
    return k - 1;
  }
}

export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Erzeugt einen zufaelligen Seed fuer einen neuen Spielstand. */
export function randomSeed(): number {
  return (Math.random() * 0xffffffff) >>> 0;
}

/**
 * Generator liczb losowych z ziarnem (mulberry32). Cala symulacja losuje tylko stad,
 * wiec to samo ziarno zawsze daje te sama sesje — na tym stoja testy i powtorki.
 */
export class Rng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  /** Liczba z przedzialu [0, 1). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), 1 | t);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Liczba z przedzialu [min, max). */
  range(min: number, max: number): number {
    return min + (max - min) * this.next();
  }

  /** Liczba calkowita z przedzialu [min, max] (wlacznie). */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new RangeError("cannot pick from an empty list");
    return items[Math.floor(this.next() * items.length)] as T;
  }

  /** Ziarno dla niezaleznego podsystemu (np. gospodarki w sesji). */
  nextSeed(): number {
    return Math.floor(this.next() * 4294967296);
  }

  /** Niezalezny strumien dla podsystemu: zmiany w jednym nie przesuwaja losowan w drugim. */
  fork(): Rng {
    return new Rng(this.nextSeed());
  }
}

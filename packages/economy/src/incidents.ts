import { TECH, type Ticker } from "./companies.js";
import { HAZARDS, effectOf, type EconomicEvent, type Effect } from "./events.js";
import type { Rng } from "./rng.js";
import { rateDecision, rollHazards } from "./rules.js";

const RATE_MEETING_EVERY = 45;
const HOLIDAY_DAY = 300; // dzien roku, w ktorym rusza sezon swiateczny

/** Mnozniki, ktore zdarzenia nakladaja na caly rynek naraz. */
export type MarketFactor = "coal" | "demand" | "confidence";

/**
 * Zdarzenia w miasteczku: co trwa, co czeka na start i jakie mnozniki dzialaja dzisiaj.
 * Losuje zawsze tyle samo razy dziennie, wiec przebiegi z i bez wstrzyknietego zdarzenia
 * zostaja zsynchronizowane.
 */
export class Incidents {
  private effects: Effect[] = [];
  private pending: EconomicEvent[] = [];

  /** Zdarzenie wywolane recznie — zadziala od nastepnego dnia. */
  inject(event: EconomicEvent): void {
    this.pending.push(event);
  }

  active(): readonly Effect[] {
    return this.effects;
  }

  /** Mnoznik mocy produkcyjnej spolki. */
  capacity(t: Ticker): number {
    return this.effects.reduce((f, e) => (e.ticker === t && e.capacity !== undefined ? f * e.capacity : f), 1);
  }

  factor(kind: MarketFactor): number {
    return this.effects.reduce((f, e) => f * (e[kind] ?? 1), 1);
  }

  /** Premia cenowa od maszyny z trwajacych kontraktow (0,1 = +10%). */
  premium(): number {
    return this.effects.reduce((sum, e) => sum + (e.premium ?? 0), 0);
  }

  storm(): boolean {
    return this.effects.some((e) => e.shipsBlocked);
  }

  /**
   * Nowy dzien: wygasle efekty znikaja, a lista zdarzen dnia to wstrzykniete plus wylosowane, posiedzenie
   * banku centralnego co 45 dni i sezon swiateczny. `live` = false w rozruchu: losujemy, ale nic nie startuje.
   */
  startDay(day: number, rng: Rng, rateBp: number, live: boolean): EconomicEvent[] {
    this.effects = this.effects.filter((e) => e.until > day);
    const fired = [...this.pending];
    this.pending = [];
    const rolled = rollHazards(HAZARDS, rng, (kind, ticker) => this.effects.some((e) => e.kind === kind && e.ticker === ticker));
    const decision = rng.next(); // losowane codziennie, zeby strumien sie nie przesuwal
    if (!live) return fired;
    fired.push(...rolled);
    if (day % RATE_MEETING_EVERY === 0) fired.push({ kind: "STOPY", days: 1, size: rateDecision(rateBp, decision) });
    if (day % TECH.daysPerYear === HOLIDAY_DAY) fired.push({ kind: "SWIETA", ticker: "KSZ", days: 30 });
    return fired;
  }

  /** Zdarzenie zaczyna dzialac (jesli ma trwaly efekt). */
  start(event: EconomicEvent, day: number): void {
    const effect = effectOf(event, day);
    if (effect) this.effects.push(effect);
  }
}

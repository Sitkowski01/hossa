import { Level, type RestingOrder } from "./level.js";
import { validate, type BookEvent, type OrderCancelled, type OrderRequest, type OrderRested, type PriceLevel, type Side } from "./order.js";

/** Migawka arkusza: zlecenia czekajace w kolejnosci priorytetu i id ostatniego przyjetego zlecenia. */
export interface Snapshot {
  readonly orders: readonly OrderRested[];
  readonly lastOrderId: number;
}

/**
 * Ceny jednej strony arkusza, posortowane tak, ze najlepsza jest na KONCU tablicy:
 * zdjecie wyczerpanego najlepszego poziomu to wtedy `pop()` w O(1), a nie `shift()` w O(n).
 * Kupno rosnaco (najwyzsza cena na koncu), sprzedaz malejaco (najnizsza na koncu).
 */
class SideBook {
  readonly levels = new Map<number, Level>();
  private readonly prices: number[] = [];

  constructor(private readonly side: Side) {}

  /** true, gdy cena `a` jest gorsza dla tej strony niz `b` (blizej poczatku tablicy). */
  private worse(a: number, b: number): boolean {
    return this.side === "BUY" ? a < b : a > b;
  }

  best(): Level | undefined {
    const price = this.prices.at(-1);
    return price === undefined ? undefined : this.levels.get(price);
  }

  levelFor(price: number): Level {
    let level = this.levels.get(price);
    if (!level) {
      level = new Level(price);
      this.levels.set(price, level);
      this.prices.splice(this.position(price), 0, price);
    }
    return level;
  }

  /**
   * Usuwa poziom. Najlepszy (najczestszy przypadek przy kojarzeniu) to pop() w O(1); glebszy
   * (anulowanie) — wyszukiwanie binarne i splice. Splice przesuwa tablice, ale poziomow sa
   * dziesiatki, nie miliony, wiec tablica wygrywa z drzewem prostota.
   */
  drop(level: Level): void {
    // Przyjmuje istniejacy poziom (nie sama cene), wiec nie da sie zdjac poziomu, ktorego nie ma.
    const price = level.price;
    this.levels.delete(price);
    if (this.prices.at(-1) === price) {
      this.prices.pop();
    } else {
      this.prices.splice(this.position(price), 1);
    }
  }

  /** Wyszukiwanie binarne: indeks ceny albo miejsce, w ktorym trzeba ja wstawic. */
  private position(price: number): number {
    let lo = 0;
    let hi = this.prices.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (this.worse(this.prices[mid] as number, price)) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  /** Poziomy od najlepszej ceny. */
  *bestFirst(): Generator<Level> {
    for (let i = this.prices.length - 1; i >= 0; i--) {
      yield this.levels.get(this.prices[i] as number) as Level;
    }
  }
}

/**
 * Arkusz zlecen jednego instrumentu z kojarzeniem wedlug ceny, a potem czasu (price-time priority).
 *
 * Najpierw wygrywa lepsza cena: najwyzsza oferta kupna, najnizsza sprzedazy. Przy tej samej
 * cenie wygrywa zlecenie, ktore przyszlo wczesniej. Arkusz jest deterministyczny: ta sama
 * sekwencja zlecen zawsze daje te same zdarzenia — na tym opieraja sie powtorki sesji i testy.
 */
export class OrderBook {
  private readonly bids = new SideBook("BUY");
  private readonly asks = new SideBook("SELL");
  private readonly index = new Map<number, RestingOrder>();
  private lastId = 0;

  submit(order: OrderRequest): BookEvent[] {
    validate(order);
    if (order.id <= this.lastId) {
      throw new RangeError(`order id must increase: got ${String(order.id)} after ${String(this.lastId)}`);
    }
    this.lastId = order.id;

    const events: BookEvent[] = [];
    const remaining = this.match(order, events);
    if (remaining > 0) {
      if (order.type === "MARKET") {
        events.push({ kind: "CANCELLED", orderId: order.id, quantity: remaining, reason: "NO_LIQUIDITY" });
      } else {
        this.rest(order, remaining);
        events.push({ kind: "RESTED", orderId: order.id, side: order.side, price: order.price, quantity: remaining });
      }
    }
    return events;
  }

  /** Anuluje zlecenie czekajace w arkuszu. `undefined`, gdy go tam nie ma (zrealizowane, anulowane, nieznane). */
  cancel(orderId: number): OrderCancelled | undefined {
    const order = this.index.get(orderId);
    if (!order) {
      return undefined;
    }
    this.index.delete(orderId);
    const side = this.sideOf(order.side);
    const level = side.levels.get(order.price) as Level;
    level.remove(order);
    if (level.isEmpty()) {
      side.drop(level);
    }
    return { kind: "CANCELLED", orderId, quantity: order.remaining, reason: "REQUESTED" };
  }

  /** Zlecenia czekajace jako RESTED: najpierw kupno od najlepszej ceny, potem sprzedaz; przy jednej cenie od najstarszego. */
  snapshot(): Snapshot {
    const orders: OrderRested[] = [];
    for (const side of [this.bids, this.asks]) {
      for (const level of side.bestFirst()) {
        for (const o of level.orders()) {
          orders.push({ kind: "RESTED", orderId: o.id, side: o.side, price: o.price, quantity: o.remaining });
        }
      }
    }
    return { orders, lastOrderId: this.lastId };
  }

  /** Id ostatniego przyjetego zlecenia; nastepne musi byc wieksze. 0, gdy jeszcze zadnego nie bylo. */
  lastOrderId(): number {
    return this.lastId;
  }

  bestBid(): number | undefined {
    return this.bids.best()?.price;
  }

  bestAsk(): number | undefined {
    return this.asks.best()?.price;
  }

  /** Najlepsze `levels` poziomow danej strony, od najlepszej ceny. */
  depth(side: Side, levels: number): PriceLevel[] {
    if (!Number.isInteger(levels) || levels < 0) {
      throw new RangeError(`levels must be a non-negative integer, was ${String(levels)}`);
    }
    const out: PriceLevel[] = [];
    for (const level of this.sideOf(side).bestFirst()) {
      if (out.length === levels) break;
      out.push(level.view());
    }
    return out;
  }

  private match(taker: OrderRequest, events: BookEvent[]): number {
    const opposite = taker.side === "BUY" ? this.asks : this.bids;
    let remaining = taker.quantity;
    while (remaining > 0) {
      const best = opposite.best();
      if (!best || !crosses(taker, best.price)) {
        break;
      }
      remaining = best.fill(taker.id, taker.side, remaining, events, (id) => this.index.delete(id));
      if (best.isEmpty()) {
        opposite.drop(best);
      }
    }
    return remaining;
  }

  private rest(order: OrderRequest, remaining: number): void {
    const resting: RestingOrder = { id: order.id, side: order.side, price: order.price, remaining };
    this.sideOf(order.side).levelFor(order.price).add(resting);
    this.index.set(order.id, resting);
  }

  private sideOf(side: Side): SideBook {
    return side === "BUY" ? this.bids : this.asks;
  }
}

function crosses(taker: OrderRequest, bestOppositePrice: number): boolean {
  if (taker.type === "MARKET") {
    return true;
  }
  return taker.side === "BUY" ? bestOppositePrice <= taker.price : bestOppositePrice >= taker.price;
}

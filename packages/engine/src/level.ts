import type { BookEvent, PriceLevel, Side } from "./order.js";

/** Zlecenie czekajace w arkuszu. Mutowalne, bo kazda czesciowa realizacja zmniejsza reszte. */
export interface RestingOrder {
  readonly id: number;
  readonly side: Side;
  readonly price: number;
  remaining: number;
}

/**
 * Kolejka zlecen czekajacych po jednej cenie.
 *
 * Map zamiast tablicy: Map w JavaScripcie pamieta kolejnosc wstawiania (czyli priorytet
 * czasowy), a jednoczesnie usuwa zlecenie po id w O(1). W tablicy anulowanie zlecenia
 * ze srodka kolejki kosztowaloby O(n). To odpowiednik LinkedHashMap z Parkietu.
 */
export class Level {
  private readonly queue = new Map<number, RestingOrder>();
  private total = 0;

  constructor(readonly price: number) {}

  add(order: RestingOrder): void {
    this.queue.set(order.id, order);
    this.total += order.remaining;
  }

  remove(order: RestingOrder): void {
    this.queue.delete(order.id);
    this.total -= order.remaining;
  }

  /**
   * Kojarzy przychodzace zlecenie z kolejka, od najstarszego.
   *
   * @param onMakerFilled dostaje id kazdego zlecenia z kolejki zrealizowanego w calosci
   * @returns ile z przychodzacego zlecenia zostalo po przejsciu przez ten poziom
   */
  fill(takerId: number, takerSide: Side, wanted: number, events: BookEvent[], onMakerFilled: (id: number) => void): number {
    for (const maker of this.queue.values()) {
      if (wanted === 0) {
        break;
      }
      const traded = Math.min(wanted, maker.remaining);
      maker.remaining -= traded;
      this.total -= traded;
      wanted -= traded;
      events.push({ kind: "TRADE", makerOrderId: maker.id, takerOrderId: takerId, takerSide, price: this.price, quantity: traded });
      if (maker.remaining === 0) {
        // Usuwanie biezacego klucza w trakcie iteracji po Map jest w JS bezpieczne.
        this.queue.delete(maker.id);
        onMakerFilled(maker.id);
      }
    }
    return wanted;
  }

  /** Zlecenia od najstarszego — do migawki arkusza. */
  orders(): IterableIterator<RestingOrder> {
    return this.queue.values();
  }

  isEmpty(): boolean {
    return this.queue.size === 0;
  }

  view(): PriceLevel {
    return { price: this.price, quantity: this.total, orders: this.queue.size };
  }
}

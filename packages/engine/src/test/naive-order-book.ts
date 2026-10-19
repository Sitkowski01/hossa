import type { BookEvent, OrderCancelled, OrderRequest, Side } from "../order.js";

interface Resting {
  id: number;
  side: Side;
  price: number;
  remaining: number;
}

/**
 * Wzorzec do testow roznicowych (port NaiveOrderBook z Parkietu): arkusz napisany tak
 * prosto, jak sie da. Przy kazdym zleceniu sortuje cala liste — wolny, ale poprawnosc
 * widac golym okiem, i wlasnie dlatego sluzy za wyrocznie.
 */
export class NaiveOrderBook {
  private orders: Resting[] = [];

  submit(taker: OrderRequest): BookEvent[] {
    const events: BookEvent[] = [];
    const candidates = this.orders
      .filter((o) => o.side !== taker.side)
      .filter((o) => taker.type === "MARKET" || (taker.side === "BUY" ? o.price <= taker.price : o.price >= taker.price))
      .sort((a, b) => (taker.side === "BUY" ? a.price - b.price : b.price - a.price) || a.id - b.id);

    let left = taker.quantity;
    for (const maker of candidates) {
      if (left === 0) break;
      const qty = Math.min(left, maker.remaining);
      maker.remaining -= qty;
      left -= qty;
      events.push({ kind: "TRADE", makerOrderId: maker.id, takerOrderId: taker.id, takerSide: taker.side, price: maker.price, quantity: qty });
    }
    this.orders = this.orders.filter((o) => o.remaining > 0);

    if (left > 0 && taker.type === "MARKET") {
      events.push({ kind: "CANCELLED", orderId: taker.id, quantity: left, reason: "NO_LIQUIDITY" });
    } else if (left > 0) {
      this.orders.push({ id: taker.id, side: taker.side, price: taker.price, remaining: left });
      events.push({ kind: "RESTED", orderId: taker.id, side: taker.side, price: taker.price, quantity: left });
    }
    return events;
  }

  cancel(id: number): OrderCancelled | undefined {
    const order = this.orders.find((o) => o.id === id);
    if (!order) return undefined;
    this.orders = this.orders.filter((o) => o !== order);
    return { kind: "CANCELLED", orderId: id, quantity: order.remaining, reason: "REQUESTED" };
  }
}

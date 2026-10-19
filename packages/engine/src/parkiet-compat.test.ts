import { describe, expect, it } from "vitest";
import { orderRequest, type BookEvent, type OrderRested, type OrderType, type PriceLevel, type Side } from "./order.js";
import { OrderBook } from "./order-book.js";
import golden from "./test/parkiet-golden.json" with { type: "json" };

/**
 * Zgodnosc z oryginalem: przebiegi nagrane z silnika Parkietu (Java) — patrz
 * tools/golden/GoldenVectors.java. Port w TypeScripcie musi na te same polecenia odpowiedziec
 * identycznymi zdarzeniami (co do pola i kolejnosci), miec po kazdym kroku te same najlepsze
 * ceny, a na koncu ta sama migawke i glebokosc arkusza.
 */
interface Top {
  bid: number | null;
  ask: number | null;
}
type Step =
  | ({ op: "order"; id: number; side: Side; type: OrderType; price: number; quantity: number; events: BookEvent[] } & Top)
  | ({ op: "cancel"; id: number; events: BookEvent[] } & Top);
interface Scenario {
  steps: Step[];
  end: { lastOrderId: number; snapshot: OrderRested[]; buy: PriceLevel[]; sell: PriceLevel[] };
}

const scenarios = golden as Scenario[];

describe("compatibility with the Parkiet engine (Java)", () => {
  it("has recorded scenarios to check against", () => {
    expect(scenarios.length).toBeGreaterThanOrEqual(10);
  });

  it.each(scenarios.map((s, i) => [i, s] as const))("scenario %i behaves identically", (_i, { steps, end }) => {
    const book = new OrderBook();
    for (const step of steps) {
      let events: BookEvent[];
      if (step.op === "order") {
        events = book.submit(orderRequest(step.id, step.side, step.type, step.price, step.quantity));
      } else {
        const cancelled = book.cancel(step.id);
        events = cancelled ? [cancelled] : [];
      }
      expect(events, `${step.op} ${String(step.id)}`).toEqual(step.events);
      expect({ bid: book.bestBid() ?? null, ask: book.bestAsk() ?? null }, `top after ${step.op} ${String(step.id)}`).toEqual({
        bid: step.bid,
        ask: step.ask,
      });
    }
    expect(book.lastOrderId()).toBe(end.lastOrderId);
    expect(book.snapshot().orders).toEqual(end.snapshot);
    expect(book.depth("BUY", 1000)).toEqual(end.buy);
    expect(book.depth("SELL", 1000)).toEqual(end.sell);
  });
});

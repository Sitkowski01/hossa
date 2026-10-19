import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { orderRequest, type BookEvent, type OrderRequest, type Side } from "./order.js";
import { OrderBook } from "./order-book.js";
import { NaiveOrderBook } from "./test/naive-order-book.js";

/** Polecenie w losowym scenariuszu: zlecenie albo anulowanie ktoregos z wczesniejszych. */
type Command =
  | { kind: "order"; side: Side; market: boolean; price: number; quantity: number }
  | { kind: "cancel"; pick: number };

// Waski zakres cen i ilosci, zeby zlecenia czesto sie krzyzowaly i czesciowo realizowaly.
const command: fc.Arbitrary<Command> = fc.oneof(
  { weight: 5, arbitrary: fc.record({ kind: fc.constant("order" as const), side: fc.constantFrom<Side>("BUY", "SELL"), market: fc.integer({ min: 0, max: 9 }).map((n) => n < 2), price: fc.integer({ min: 95, max: 105 }), quantity: fc.integer({ min: 1, max: 20 }) }) },
  { weight: 1, arbitrary: fc.record({ kind: fc.constant("cancel" as const), pick: fc.nat() }) },
);

function run(commands: Command[], onStep: (fast: OrderBook, events: BookEvent[], expected: BookEvent[], order?: OrderRequest) => void): void {
  const fast = new OrderBook();
  const naive = new NaiveOrderBook();
  let id = 0;
  for (const c of commands) {
    if (c.kind === "order") {
      id += 1;
      const order = c.market ? orderRequest(id, c.side, "MARKET", 0, c.quantity) : orderRequest(id, c.side, "LIMIT", c.price, c.quantity);
      onStep(fast, fast.submit(order), naive.submit(order), order);
    } else if (id > 0) {
      const target = (c.pick % id) + 1;
      const got = fast.cancel(target);
      const want = naive.cancel(target);
      onStep(fast, got ? [got] : [], want ? [want] : []);
    }
  }
}

describe("OrderBook against the naive oracle", () => {
  it("produces exactly the same events for any sequence of orders and cancels", () => {
    fc.assert(
      fc.property(fc.array(command, { maxLength: 300 }), (commands) => {
        run(commands, (_book, events, expected) => {
          expect(events).toEqual(expected);
        });
      }),
      { numRuns: 300 },
    );
  });

  it("keeps the invariants after every step", () => {
    fc.assert(
      fc.property(fc.array(command, { maxLength: 200 }), (commands) => {
        run(commands, (book, events, _expected, order) => {
          const bid = book.bestBid();
          const ask = book.bestAsk();
          // arkusz nigdy nie jest skrzyzowany: po kojarzeniu kupno < sprzedaz
          if (bid !== undefined && ask !== undefined) expect(bid).toBeLessThan(ask);
          if (order) {
            // ilosc zlecenia = suma transakcji + reszta (czeka albo przepada)
            const accounted = events.reduce((sum, e) => sum + (e.kind === "TRADE" ? e.quantity : e.quantity), 0);
            expect(accounted).toBe(order.quantity);
            // zlecenie LIMIT nigdy nie handluje gorzej niz jego cena graniczna
            for (const e of events) {
              if (e.kind === "TRADE" && order.type === "LIMIT") {
                expect(order.side === "BUY" ? e.price <= order.price : e.price >= order.price).toBe(true);
              }
            }
          }
          // migawka zgadza sie z widokiem zagregowanym
          const snap = book.snapshot();
          const resting = snap.orders.reduce((sum, o) => sum + o.quantity, 0);
          const levels = [...book.depth("BUY", 1000), ...book.depth("SELL", 1000)].reduce((sum, l) => sum + l.quantity, 0);
          expect(levels).toBe(resting);
        });
      }),
      { numRuns: 200 },
    );
  });
});

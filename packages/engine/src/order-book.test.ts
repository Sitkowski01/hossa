import { beforeEach, describe, expect, it } from "vitest";
import { limit, market, type OrderRequest } from "./order.js";
import { OrderBook } from "./order-book.js";

let book: OrderBook;
beforeEach(() => {
  book = new OrderBook();
});

describe("limit orders", () => {
  it("rests when the book is empty", () => {
    expect(book.submit(limit(1, "BUY", 100, 5))).toEqual([{ kind: "RESTED", orderId: 1, side: "BUY", price: 100, quantity: 5 }]);
    expect(book.bestBid()).toBe(100);
    expect(book.bestAsk()).toBeUndefined();
  });

  it("does not trade when prices do not cross", () => {
    book.submit(limit(1, "SELL", 101, 5));
    expect(book.submit(limit(2, "BUY", 100, 5))).toEqual([{ kind: "RESTED", orderId: 2, side: "BUY", price: 100, quantity: 5 }]);
    expect([book.bestBid(), book.bestAsk()]).toEqual([100, 101]);
  });

  it("trades at the maker price, not the taker limit", () => {
    book.submit(limit(1, "SELL", 100, 5));
    expect(book.submit(limit(2, "BUY", 105, 5))).toEqual([
      { kind: "TRADE", makerOrderId: 1, takerOrderId: 2, takerSide: "BUY", price: 100, quantity: 5 },
    ]);
    expect(book.bestAsk()).toBeUndefined();
    expect(book.bestBid()).toBeUndefined();
  });

  it("trades at an exactly equal price", () => {
    book.submit(limit(1, "BUY", 100, 2));
    expect(book.submit(limit(2, "SELL", 100, 2))[0]).toMatchObject({ kind: "TRADE", price: 100, quantity: 2, takerSide: "SELL" });
  });

  it("partially fills a maker and leaves the rest", () => {
    book.submit(limit(1, "SELL", 100, 10));
    book.submit(limit(2, "BUY", 100, 4));
    expect(book.depth("SELL", 5)).toEqual([{ price: 100, quantity: 6, orders: 1 }]);
  });

  it("rests the unfilled remainder of the taker", () => {
    book.submit(limit(1, "SELL", 100, 3));
    expect(book.submit(limit(2, "BUY", 100, 5))).toEqual([
      { kind: "TRADE", makerOrderId: 1, takerOrderId: 2, takerSide: "BUY", price: 100, quantity: 3 },
      { kind: "RESTED", orderId: 2, side: "BUY", price: 100, quantity: 2 },
    ]);
  });

  it("walks several price levels from the best one", () => {
    book.submit(limit(1, "SELL", 102, 1));
    book.submit(limit(2, "SELL", 100, 1));
    book.submit(limit(3, "SELL", 101, 1));
    const trades = book.submit(limit(4, "BUY", 102, 3)).map((e) => (e.kind === "TRADE" ? e.price : -1));
    expect(trades).toEqual([100, 101, 102]);
  });

  it("stops at the taker limit", () => {
    book.submit(limit(1, "BUY", 100, 1));
    book.submit(limit(2, "BUY", 98, 1));
    const events = book.submit(limit(3, "SELL", 99, 2));
    expect(events.map((e) => e.kind)).toEqual(["TRADE", "RESTED"]);
    expect([book.bestBid(), book.bestAsk()]).toEqual([98, 99]);
  });

  it("fills the older order first at the same price", () => {
    book.submit(limit(1, "SELL", 100, 2));
    book.submit(limit(2, "SELL", 100, 2));
    const makers = book.submit(limit(3, "BUY", 100, 3)).map((e) => (e.kind === "TRADE" ? [e.makerOrderId, e.quantity] : []));
    expect(makers).toEqual([
      [1, 2],
      [2, 1],
    ]);
  });

  it("rejects an id that does not increase", () => {
    book.submit(limit(5, "BUY", 100, 1));
    expect(() => book.submit(limit(5, "BUY", 100, 1))).toThrow(/order id must increase: got 5 after 5/);
    expect(() => book.submit(limit(4, "BUY", 100, 1))).toThrow(/must increase/);
    expect(book.lastOrderId()).toBe(5);
  });
});

describe("validation at the book boundary", () => {
  // Zlecenia przychodza tez z JSON-a i z Web Workera, gdzie typy TS nie istnieja.
  it.each([
    [{ id: Number.NaN, side: "BUY", type: "LIMIT", price: 100, quantity: 1 }, /id must be a positive integer/],
    [{ id: 1, side: "SELL", type: "LIMIT", price: 100, quantity: 0.5 }, /quantity must be an integer/],
    [{ id: 1, side: "buy", type: "LIMIT", price: 100, quantity: 1 }, /side must be BUY or SELL/],
    [{ id: 1, side: "BUY", type: "limit", price: 0, quantity: 1 }, /type must be LIMIT or MARKET/],
  ])("rejects %o without touching the book", (order, error) => {
    expect(() => book.submit(order as unknown as OrderRequest)).toThrow(error);
    expect(book.lastOrderId()).toBe(0);
    expect(book.snapshot().orders).toEqual([]);
  });
});

describe("market orders", () => {
  it("takes liquidity across levels at any price", () => {
    book.submit(limit(1, "BUY", 100, 2));
    book.submit(limit(2, "BUY", 50, 2));
    expect(book.submit(market(3, "SELL", 4))).toEqual([
      { kind: "TRADE", makerOrderId: 1, takerOrderId: 3, takerSide: "SELL", price: 100, quantity: 2 },
      { kind: "TRADE", makerOrderId: 2, takerOrderId: 3, takerSide: "SELL", price: 50, quantity: 2 },
    ]);
  });

  it("cancels what it could not fill and never rests", () => {
    book.submit(limit(1, "SELL", 100, 2));
    expect(book.submit(market(2, "BUY", 5)).at(-1)).toEqual({ kind: "CANCELLED", orderId: 2, quantity: 3, reason: "NO_LIQUIDITY" });
    expect(book.bestBid()).toBeUndefined();
  });

  it("is cancelled in full on an empty book", () => {
    expect(book.submit(market(1, "SELL", 5))).toEqual([{ kind: "CANCELLED", orderId: 1, quantity: 5, reason: "NO_LIQUIDITY" }]);
  });
});

describe("cancel", () => {
  it("removes a resting order with its remaining quantity", () => {
    book.submit(limit(1, "BUY", 100, 5));
    book.submit(limit(2, "SELL", 100, 2));
    expect(book.cancel(1)).toEqual({ kind: "CANCELLED", orderId: 1, quantity: 3, reason: "REQUESTED" });
    expect(book.bestBid()).toBeUndefined();
  });

  it("keeps the level when other orders still wait there", () => {
    book.submit(limit(1, "SELL", 100, 1));
    book.submit(limit(2, "SELL", 100, 4));
    book.cancel(1);
    expect(book.depth("SELL", 1)).toEqual([{ price: 100, quantity: 4, orders: 1 }]);
  });

  it("removes a level that is not the best one", () => {
    book.submit(limit(1, "BUY", 100, 1));
    book.submit(limit(2, "BUY", 99, 1));
    book.submit(limit(3, "BUY", 98, 1));
    book.cancel(2);
    expect(book.depth("BUY", 5).map((l) => l.price)).toEqual([100, 98]);
  });

  it.each([
    ["unknown", 42],
    ["already filled", 1],
  ])("returns undefined for an %s order", (_name, id) => {
    book.submit(limit(1, "SELL", 100, 1));
    book.submit(limit(2, "BUY", 100, 1));
    expect(book.cancel(id)).toBeUndefined();
  });

  it("cannot cancel the same order twice", () => {
    book.submit(limit(1, "SELL", 100, 1));
    expect(book.cancel(1)).toBeDefined();
    expect(book.cancel(1)).toBeUndefined();
  });
});

describe("depth and snapshot", () => {
  beforeEach(() => {
    book.submit(limit(1, "BUY", 99, 1));
    book.submit(limit(2, "BUY", 100, 2));
    book.submit(limit(3, "BUY", 100, 3));
    book.submit(limit(4, "SELL", 102, 4));
    book.submit(limit(5, "SELL", 101, 5));
  });

  it("aggregates levels from the best price", () => {
    expect(book.depth("BUY", 10)).toEqual([
      { price: 100, quantity: 5, orders: 2 },
      { price: 99, quantity: 1, orders: 1 },
    ]);
    expect(book.depth("SELL", 1)).toEqual([{ price: 101, quantity: 5, orders: 1 }]);
    expect(book.depth("SELL", 0)).toEqual([]);
  });

  it.each([-1, 1.5])("rejects depth %s", (levels) => {
    expect(() => book.depth("BUY", levels)).toThrow(/levels must be a non-negative integer/);
  });

  it("lists resting orders in priority order", () => {
    expect(book.snapshot()).toEqual({
      lastOrderId: 5,
      orders: [
        { kind: "RESTED", orderId: 2, side: "BUY", price: 100, quantity: 2 },
        { kind: "RESTED", orderId: 3, side: "BUY", price: 100, quantity: 3 },
        { kind: "RESTED", orderId: 1, side: "BUY", price: 99, quantity: 1 },
        { kind: "RESTED", orderId: 5, side: "SELL", price: 101, quantity: 5 },
        { kind: "RESTED", orderId: 4, side: "SELL", price: 102, quantity: 4 },
      ],
    });
  });

  it("starts empty", () => {
    expect(new OrderBook().snapshot()).toEqual({ orders: [], lastOrderId: 0 });
  });
});

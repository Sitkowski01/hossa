import { describe, expect, it } from "vitest";
import { OrderIds, SymbolMarket, TICK, roundTick, type Trader } from "./symbol-market.js";

const trader = (id: string): Trader => ({ id, account: { position: 0, cash: 0 }, resting: new Set() });

describe("roundTick", () => {
  it("rounds to 5 grosze and never below one tick", () => {
    expect(roundTick(1002)).toBe(1000);
    expect(roundTick(1003)).toBe(1005);
    expect(roundTick(1)).toBe(TICK);
    expect(roundTick(-50)).toBe(TICK);
    expect(roundTick(5e12)).toBe(1_000_000_000);
  });
});

describe("SymbolMarket", () => {
  it("settles a trade between the two traders at the maker price", () => {
    const m = new SymbolMarket("RUD", 3000, new OrderIds());
    const seller = trader("s");
    const buyer = trader("b");
    m.openDay(1);
    m.submit(seller, "SELL", "LIMIT", 3000, 10);
    expect(seller.resting.size).toBe(1);
    m.submit(buyer, "BUY", "LIMIT", 3100, 4);
    expect(buyer.account).toEqual({ position: 4, cash: -12_000 });
    expect(seller.account).toEqual({ position: -4, cash: 12_000 });
    expect(seller.resting.size).toBe(1); // reszta 6 akcji dalej czeka
    expect(m.last).toBe(3000);
    expect(m.candles[0]).toEqual({ day: 1, open: 3000, high: 3000, low: 3000, close: 3000, volume: 4 });
  });

  it("forgets a resting order once it is filled in full", () => {
    const m = new SymbolMarket("RUD", 3000, new OrderIds());
    const maker = trader("m");
    m.submit(maker, "BUY", "LIMIT", 2990, 5);
    m.submit(trader("t"), "SELL", "MARKET", 0, 5);
    expect(maker.resting.size).toBe(0);
    expect(maker.account.position).toBe(5);
  });

  it("taker selling into a bid: buyer is the maker", () => {
    const m = new SymbolMarket("RUD", 3000, new OrderIds());
    const maker = trader("m");
    const taker = trader("t");
    m.submit(maker, "BUY", "LIMIT", 2990, 3);
    m.submit(taker, "SELL", "LIMIT", 2900, 3);
    expect(maker.account).toEqual({ position: 3, cash: -8970 });
    expect(taker.account).toEqual({ position: -3, cash: 8970 });
  });

  it("tracks high and low within a day", () => {
    const m = new SymbolMarket("RUD", 3000, new OrderIds());
    const a = trader("a");
    const b = trader("b");
    m.openDay(1);
    m.submit(a, "SELL", "LIMIT", 3050, 1);
    m.submit(b, "BUY", "MARKET", 0, 1);
    m.submit(a, "BUY", "LIMIT", 2950, 1);
    m.submit(b, "SELL", "MARKET", 0, 1);
    expect(m.candles[0]).toMatchObject({ open: 3000, high: 3050, low: 2950, close: 2950, volume: 2 });
  });

  it("ignores orders smaller than one share and cancels everything of a trader", () => {
    const m = new SymbolMarket("RUD", 3000, new OrderIds());
    const t = trader("t");
    expect(m.submit(t, "BUY", "LIMIT", 2990, 0.4)).toEqual([]);
    m.submit(t, "BUY", "LIMIT", 2990, 1);
    m.submit(t, "BUY", "LIMIT", 2980, 1);
    m.cancelAll(t);
    expect(t.resting.size).toBe(0);
    expect(m.book.bestBid()).toBeUndefined();
  });

  it("uses the midpoint when both sides exist and the last price otherwise", () => {
    const m = new SymbolMarket("RUD", 3000, new OrderIds());
    expect(m.mid()).toBe(3000);
    m.submit(trader("a"), "BUY", "LIMIT", 2990, 1);
    expect(m.mid()).toBe(3000);
    m.submit(trader("b"), "SELL", "LIMIT", 3020, 1);
    expect(m.mid()).toBe(3005);
  });

  it("measures volatility and remembers prices step by step", () => {
    const m = new SymbolMarket("RUD", 3000, new OrderIds());
    m.endStep();
    expect(m.volatility).toBe(0);
    m.last = 3300;
    m.endStep();
    expect(m.volatility).toBeCloseTo(0.1 / 20);
    expect(m.priceAgo(1)).toBe(3300);
    expect(m.priceAgo(2)).toBe(3000);
    expect(m.priceAgo(99)).toBe(3000);
    for (let i = 0; i < 500; i++) m.endStep();
    expect(m.history.length).toBe(400);
  });
});

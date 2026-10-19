import { Rng } from "@hossa/economy";
import { describe, expect, it } from "vitest";
import { Fundamental, MarketMaker, type BotContext } from "./bots.js";
import { OrderIds, SymbolMarket } from "./symbol-market.js";

/**
 * Dokladne reguly botow: konkretne ceny, wielkosci i czestotliwosc dzialania. Testy kierunkowe
 * („kupuje, gdy tanio”) nie wylapywaly bledow w formulach — pokazaly to testy mutacyjne w CI.
 */
const ctx = (market: SymbolMarket, fair = 3000, step = 0): BotContext => ({ market, step, stepsPerDay: 20, fair: () => fair });
const prices = (m: SymbolMarket, side: "BUY" | "SELL") => m.book.depth(side, 10).map((l) => l.price);

describe("MarketMaker quotes exactly", () => {
  it("around the price, 0,2% apart per level, 300 shares each", () => {
    const m = new SymbolMarket("RUD", 3000, new OrderIds());
    new MarketMaker("mm", new Rng(1)).act(ctx(m));
    expect(prices(m, "BUY")).toEqual([2995, 2990, 2980]);
    expect(prices(m, "SELL")).toEqual([3005, 3010, 3020]);
    expect(m.book.depth("BUY", 3).map((l) => l.quantity)).toEqual([300, 300, 300]);
  });

  it("shifts all quotes down by 0,2% when holding half of its maximum stock", () => {
    const m = new SymbolMarket("RUD", 3000, new OrderIds());
    const mm = new MarketMaker("mm", new Rng(1));
    mm.account.position = 2500;
    mm.act(ctx(m));
    expect(prices(m, "BUY")).toEqual([2990, 2980, 2975]);
    expect(prices(m, "SELL")).toEqual([3000, 3005, 3010]);
  });

  it("stays in the market at the edge of the nervousness threshold", () => {
    for (let seed = 0; seed < 30; seed++) {
      const m = new SymbolMarket("RUD", 3000, new OrderIds());
      m.volatility = 0.012;
      new MarketMaker("mm", new Rng(seed)).act(ctx(m));
      expect(m.book.bestBid()).toBeDefined();
    }
  });
});

describe("Fundamental", () => {
  it("acts in about one step out of five", () => {
    const bot = new Fundamental("f", new Rng(3), 0, 0, 0.02);
    let acted = 0;
    for (let i = 0; i < 1000; i++) {
      const m = new SymbolMarket("RUD", 3000, new OrderIds());
      bot.act(ctx(m, 3600));
      if (m.book.bestBid() !== undefined) acted++;
    }
    expect(acted).toBeGreaterThan(150);
    expect(acted).toBeLessThan(250);
  });

  const firstAct = (fair: number, threshold: number, start = 3000) => {
    for (let seed = 0; seed < 100; seed++) {
      const m = new SymbolMarket("RUD", start, new OrderIds());
      new Fundamental("f", new Rng(seed), 0, 0, threshold).act(ctx(m, fair));
      if (m.book.snapshot().orders.length > 0) return m;
    }
    throw new Error("bot never acted");
  };

  it("buys a little under its estimate when the estimate is close to the price", () => {
    const m = firstAct(3040, 0.01); // luka 1,33%: kupuje po min(3040 x 0,995, 3000 x 1,01) = 3025
    expect(m.book.depth("BUY", 1)).toEqual([{ price: 3025, quantity: 200, orders: 1 }]);
  });

  it("sells a little over its estimate", () => {
    const m = firstAct(2960, 0.01); // sprzedaje po max(2960 x 1,005, 3000 x 0,99) = 2975
    expect(m.book.depth("SELL", 1)).toEqual([{ price: 2975, quantity: 200, orders: 1 }]);
  });

  it("caps its order at three times the base size and its price at 1% above market", () => {
    const m = firstAct(4500, 0.02);
    expect(m.book.depth("BUY", 1)).toEqual([{ price: 3030, quantity: 450, orders: 1 }]);
  });

  it("replaces its previous order instead of stacking them", () => {
    const m = new SymbolMarket("RUD", 3000, new OrderIds());
    const bot = new Fundamental("f", new Rng(12), 0, 0, 0.02);
    for (let i = 0; i < 60; i++) bot.act(ctx(m, 3600));
    expect(bot.resting.size).toBe(1);
  });

  it("trades exactly at its threshold (a gap of 25% with a 25% threshold)", () => {
    const m = firstAct(2500, 0.25, 2000);
    expect(m.book.bestBid()).toBeDefined();
  });
});

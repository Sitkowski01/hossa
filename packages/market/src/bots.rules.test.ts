import { Rng, TICKERS, type News } from "@hossa/economy";
import { describe, expect, it } from "vitest";
import { Fundamental, MarketMaker, Momentum, NewsTrader, NoiseTrader, crowdFor, type BotContext } from "./bots.js";
import { OrderIds, SymbolMarket, type Trader } from "./symbol-market.js";

/**
 * Dokladne reguly botow: konkretne ceny, wielkosci i czestotliwosc dzialania. Testy kierunkowe
 * („kupuje, gdy tanio”) nie wylapywaly bledow w formulach — pokazaly to testy mutacyjne w CI.
 */
const ctx = (market: SymbolMarket, fair = 3000, step = 0): BotContext => ({ market, step, stepsPerDay: 20, fair: () => fair });
const other = (): Trader => ({ id: "x", account: { position: 0, cash: 0 }, resting: new Set() });
const prices = (m: SymbolMarket, side: "BUY" | "SELL") => m.book.depth(side, 10).map((l) => l.price);
const news = (weight: number): News => ({ day: 1, kind: "STRAJK", headline: "test", impacts: { RUD: -1 }, weight });

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

describe("NewsTrader", () => {
  const liquid = () => {
    const m = new SymbolMarket("RUD", 3000, new OrderIds());
    m.submit(other(), "BUY", "LIMIT", 2995, 100_000);
    m.submit(other(), "SELL", "LIMIT", 3005, 100_000);
    return m;
  };

  it("trades exactly the drawn amount, a slice per step until done", () => {
    const m = liquid();
    const bot = new NewsTrader("n", new Rng(2));
    const expected = Math.round(-1 * 1 * new Rng(2).range(0.6, 1.8) * 2500);
    bot.onNews(-1, news(1));
    const after: number[] = [];
    for (let i = 0; i < 40; i++) {
      bot.act(ctx(m));
      after.push(bot.account.position);
    }
    expect(bot.account.position).toBe(expected);
    expect(Math.abs(after[0] ?? 0)).toBeLessThan(Math.abs(expected) / 3); // rozklada, nie wali wszystkiego naraz
    expect(Math.abs(after[1] ?? 0)).toBeLessThan(Math.abs(expected) / 2);
  });

  it("weightless news does not change the pace of an order already being worked", () => {
    const run = (extra: boolean) => {
      const m = liquid();
      const bot = new NewsTrader("n", new Rng(5));
      bot.onNews(0.8, news(1));
      bot.act(ctx(m));
      if (extra) bot.onNews(0.8, news(0));
      const path: number[] = [];
      for (let i = 0; i < 10; i++) {
        bot.act(ctx(m));
        path.push(bot.account.position);
      }
      return path;
    };
    expect(run(true)).toEqual(run(false));
  });
});

describe("Momentum", () => {
  const trending = (to: number) => {
    const m = new SymbolMarket("RUD", 3000, new OrderIds());
    m.submit(other(), "BUY", "LIMIT", 2000, 100_000);
    m.submit(other(), "SELL", "LIMIT", 4000, 100_000);
    m.endStep();
    m.last = to;
    return m;
  };

  it("acts in about a quarter of steps and follows the direction of the move", () => {
    const up = new Momentum("a", new Rng(9));
    const down = new Momentum("b", new Rng(9));
    const mu = trending(3200);
    const md = trending(2800);
    let trades = 0;
    for (let i = 0; i < 400; i++) {
      const before = up.account.position;
      up.act(ctx(mu));
      down.act(ctx(md));
      if (up.account.position !== before) trades++;
    }
    expect(up.account.position).toBeGreaterThan(0);
    expect(down.account.position).toBeLessThan(0);
    expect(trades).toBeGreaterThan(70);
    expect(trades).toBeLessThan(130);
  });

  it("sits out a flat market even when it could trade both ways", () => {
    const bot = new Momentum("c", new Rng(9));
    const m = trending(3000);
    for (let i = 0; i < 100; i++) bot.act(ctx(m));
    expect(bot.account.position).toBe(0);
  });
});

describe("NoiseTrader", () => {
  it("cancels an order only after more than 40 steps, counting from when it was placed", () => {
    const m = new SymbolMarket("RUD", 3000, new OrderIds());
    const bot = new NoiseTrader("no", new Rng(4));
    let step = 30;
    while (bot.resting.size === 0) bot.act(ctx(m, 3000, step++)); // pierwsze zlecenie czeka w arkuszu
    const first = [...bot.resting][0] as number;
    const placedAt = step - 1;
    bot.act(ctx(m, 3000, placedAt + 5));
    expect(bot.resting.has(first)).toBe(true);
    bot.act(ctx(m, 3000, placedAt + 40));
    expect(bot.resting.has(first)).toBe(true);
    bot.act(ctx(m, 3000, placedAt + 41));
    expect(bot.resting.has(first)).toBe(false);
    expect(m.book.snapshot().orders.some((o) => o.orderId === first)).toBe(false);
  });

  it("spreads its orders over several price levels, in steps of 5 grosze", () => {
    const m = new SymbolMarket("RUD", 3000, new OrderIds());
    const bot = new NoiseTrader("no", new Rng(11));
    for (let step = 0; step < 40; step++) bot.act(ctx(m, 3000, step));
    const levels = new Set(m.book.snapshot().orders.map((o) => o.price));
    expect(levels.size).toBeGreaterThanOrEqual(5);
  });
});

describe("crowdFor", () => {
  it("gives every trader a unique name and the fundamentalists different views", () => {
    const crowds = TICKERS.map((t) => crowdFor(t, new Rng(1)));
    const ids = crowds.flat().map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[A-Z]{3}-/);
    const views = crowdFor("RUD", new Rng(2)).filter((b) => b.kind === "fundamentalny");
    const bias = views.map((b) => (b as unknown as { bias: number }).bias);
    expect(new Set(bias).size).toBe(3);
    expect(Math.min(...bias)).toBeGreaterThanOrEqual(-0.05);
    expect(Math.max(...bias)).toBeLessThanOrEqual(0.05);
    const many = Array.from({ length: 50 }, (_, s) => crowdFor("RUD", new Rng(s)).filter((b) => b.kind === "fundamentalny"))
      .flat()
      .map((b) => (b as unknown as { bias: number }).bias);
    expect(Math.min(...many)).toBeLessThan(-0.02); // poglady rozrzucone w obie strony
    for (let k = 0; k < 3; k++) {
      // kazdy z trzech fundamentalnych z osobna ma raz poglad nizszy, raz wyzszy od wyceny
      const own = Array.from({ length: 50 }, (_, s) => crowdFor("RUD", new Rng(s)).filter((b) => b.kind === "fundamentalny")[k])
        .map((b) => (b as unknown as { bias: number }).bias);
      expect(Math.min(...own)).toBeLessThan(0);
      expect(Math.max(...own)).toBeGreaterThan(0);
    }
    expect(Math.max(...many)).toBeGreaterThan(0.02);
  });
});

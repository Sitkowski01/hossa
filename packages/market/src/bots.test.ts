import { Rng, type News } from "@hossa/economy";
import { describe, expect, it } from "vitest";
import { Fundamental, MarketMaker, NewsTrader, type BotContext } from "./bots.js";
import { OrderIds, SymbolMarket, type Trader } from "./symbol-market.js";

const ctx = (market: SymbolMarket, fair = 3000, step = 0): BotContext => ({ market, step, stepsPerDay: 20, fair: () => fair });
const rng = (seed = 1) => new Rng(seed);
const other = (): Trader => ({ id: "x", account: { position: 0, cash: 0 }, resting: new Set() });
const news = (weight: number): News => ({ day: 1, kind: "STRAJK", headline: "test", impacts: { RUD: -1 }, weight });

describe("MarketMaker", () => {
  it("quotes three levels on both sides around the price", () => {
    const m = new SymbolMarket("RUD", 3000, new OrderIds());
    new MarketMaker("mm", rng()).act(ctx(m));
    const bids = m.book.depth("BUY", 10);
    const asks = m.book.depth("SELL", 10);
    expect(bids).toHaveLength(3);
    expect(asks).toHaveLength(3);
    expect((bids[0]?.price ?? 0) < 3000 && (asks[0]?.price ?? 0) > 3000).toBe(true);
    expect(bids[0]?.quantity).toBe(300);
  });

  it("replaces its quotes instead of piling them up", () => {
    const m = new SymbolMarket("RUD", 3000, new OrderIds());
    const mm = new MarketMaker("mm", rng());
    mm.act(ctx(m));
    mm.act(ctx(m));
    expect(mm.resting.size).toBe(6);
  });

  it("quotes lower when it already holds too many shares", () => {
    const m = new SymbolMarket("RUD", 3000, new OrderIds());
    const mm = new MarketMaker("mm", rng());
    mm.account.position = 5000;
    mm.act(ctx(m));
    expect(m.book.bestAsk()).toBeLessThan(3010);
  });

  it("widens the spread and shrinks size when the market is nervous, sometimes leaving it", () => {
    const calm = new SymbolMarket("RUD", 3000, new OrderIds());
    new MarketMaker("mm", rng()).act(ctx(calm));
    const nervous = new SymbolMarket("RUD", 3000, new OrderIds());
    nervous.volatility = 0.01;
    new MarketMaker("mm", rng()).act(ctx(nervous));
    const spread = (m: SymbolMarket) => (m.book.bestAsk() ?? 0) - (m.book.bestBid() ?? 0);
    expect(spread(nervous)).toBeGreaterThan(spread(calm));
    expect(nervous.book.depth("BUY", 1)[0]?.quantity).toBeLessThan(300);

    let quoted = 0;
    for (let seed = 0; seed < 40; seed++) {
      const panic = new SymbolMarket("RUD", 3000, new OrderIds());
      panic.volatility = 0.05;
      new MarketMaker("mm", rng(seed)).act(ctx(panic));
      if (panic.book.bestBid() !== undefined) quoted++;
    }
    expect(quoted).toBeGreaterThan(5);
    expect(quoted).toBeLessThan(35);
  });
});

describe("Fundamental", () => {
  const acting = (fn: (seed: number) => void) => {
    for (let seed = 0; seed < 30; seed++) fn(seed); // dziala z prawdopodobienstwem 0,2 na krok
  };

  it("buys when the price is well below its estimate and sells when well above", () => {
    acting((seed) => {
      const cheap = new SymbolMarket("RUD", 3000, new OrderIds());
      new Fundamental("f", rng(seed), 0, 0, 0.02).act(ctx(cheap, 3600));
      expect(cheap.book.bestAsk()).toBeUndefined();
      const dear = new SymbolMarket("RUD", 3000, new OrderIds());
      new Fundamental("f", rng(seed), 0, 0, 0.02).act(ctx(dear, 2400));
      expect(dear.book.bestBid()).toBeUndefined();
    });
    let bought = false;
    acting((seed) => {
      const cheap = new SymbolMarket("RUD", 3000, new OrderIds());
      new Fundamental("f", rng(seed), 0, 0, 0.02).act(ctx(cheap, 3600));
      if (cheap.book.bestBid() !== undefined) {
        bought = true;
        expect(cheap.book.bestBid()).toBeLessThanOrEqual(3030);
        expect(cheap.book.depth("BUY", 1)[0]?.quantity).toBe(450);
      }
    });
    expect(bought).toBe(true);
  });

  it("does nothing inside its threshold", () => {
    acting((seed) => {
      const m = new SymbolMarket("RUD", 3000, new OrderIds());
      new Fundamental("f", rng(seed), 0, 0, 0.05).act(ctx(m, 3060));
      expect(m.book.snapshot().orders).toEqual([]);
    });
  });

  it("applies its own bias to the estimate", () => {
    let sold = false;
    acting((seed) => {
      const m = new SymbolMarket("RUD", 3000, new OrderIds());
      new Fundamental("f", rng(seed), 0, -0.2, 0.02).act(ctx(m, 3000));
      if (m.book.bestAsk() !== undefined) sold = true;
    });
    expect(sold).toBe(true);
  });
});

describe("NewsTrader", () => {
  it("turns bad news into market sells spread over several steps", () => {
    const m = new SymbolMarket("RUD", 3000, new OrderIds());
    m.submit(other(), "BUY", "LIMIT", 2995, 100_000);
    const bot = new NewsTrader("n", rng(2));
    bot.onNews(-1, news(1));
    for (let i = 0; i < 40; i++) bot.act(ctx(m));
    expect(bot.account.position).toBeLessThanOrEqual(-1500);
    expect(bot.account.position).toBeGreaterThanOrEqual(-4500);
    const before = bot.account.position;
    bot.act(ctx(m));
    expect(bot.account.position).toBe(before);
  });

  it("buys on good news and ignores weightless news", () => {
    const m = new SymbolMarket("RUD", 3000, new OrderIds());
    m.submit(other(), "SELL", "LIMIT", 3005, 100_000);
    const bot = new NewsTrader("n", rng(3));
    bot.onNews(0.5, news(0));
    bot.act(ctx(m));
    expect(bot.account.position).toBe(0);
    bot.onNews(0.5, news(1));
    bot.act(ctx(m));
    expect(bot.account.position).toBeGreaterThan(0);
  });
});

import { Rng, type News } from "@hossa/economy";
import { describe, expect, it } from "vitest";
import { Fundamental, MarketMaker, Momentum, NewsTrader, NoiseTrader, crowdFor, type BotContext } from "./bots.js";
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

describe("Momentum and NoiseTrader", () => {
  it("momentum follows a strong move and sits out a flat market", () => {
    const up = new SymbolMarket("RUD", 3000, new OrderIds());
    up.submit(other(), "SELL", "LIMIT", 3300, 100_000);
    up.endStep();
    up.last = 3200;
    const flat = new SymbolMarket("RUD", 3000, new OrderIds());
    flat.submit(other(), "SELL", "LIMIT", 3010, 100_000);
    flat.endStep();
    const bot = new Momentum("mo", rng(5));
    const calm = new Momentum("mo2", rng(5));
    for (let i = 0; i < 30; i++) {
      bot.act(ctx(up));
      calm.act(ctx(flat));
    }
    expect(bot.account.position).toBeGreaterThan(0);
    expect(calm.account.position).toBe(0);
  });

  it("noise places small orders near the price and cancels old ones", () => {
    const m = new SymbolMarket("RUD", 3000, new OrderIds());
    const bot = new NoiseTrader("no", rng(4));
    for (let step = 0; step < 30; step++) bot.act(ctx(m, 3000, step));
    expect(bot.resting.size).toBeGreaterThan(5);
    for (const o of m.book.snapshot().orders) expect(Math.abs(o.price - 3000)).toBeLessThanOrEqual(45);
    bot.act(ctx(m, 3000, 100));
    expect(bot.resting.size).toBeLessThanOrEqual(1);
  });
});

describe("review fixes stay fixed", () => {
  it("noise trader forgets orders that others filled, so its memory does not grow", () => {
    const m = new SymbolMarket("RUD", 3000, new OrderIds());
    const bot = new NoiseTrader("no", rng(6));
    const sweeper = other();
    for (let step = 0; step < 400; step++) {
      bot.act(ctx(m, 3000, step));
      m.submit(sweeper, "BUY", "MARKET", 0, 10_000);
      m.submit(sweeper, "SELL", "MARKET", 0, 10_000);
    }
    const placed = (bot as unknown as { placed: Map<number, number> }).placed;
    expect(placed.size).toBeLessThanOrEqual(bot.resting.size + 1);
  });

  it("momentum looks back three days, whatever the number of steps per day", () => {
    // osobne rynki: zakup jednego bota zmienilby cene widziana przez drugiego
    const market = () => {
      const m = new SymbolMarket("RUD", 3000, new OrderIds());
      m.submit(other(), "SELL", "LIMIT", 3300, 100_000);
      for (let i = 0; i < 30; i++) m.endStep(); // 30 krokow po 3000
      m.last = 3200;
      for (let i = 0; i < 31; i++) m.endStep(); // 31 krokow po 3200
      return m;
    };
    const short = new Momentum("a", rng(7));
    const long = new Momentum("b", rng(7));
    const ms = market();
    const ml = market();
    for (let i = 0; i < 40; i++) {
      short.act({ market: ms, step: 0, stepsPerDay: 10, fair: () => 3000 }); // 30 krokow wstecz: 3200 -> bez sygnalu
      long.act({ market: ml, step: 0, stepsPerDay: 20, fair: () => 3000 }); // 60 krokow wstecz: 3000 -> wzrost
    }
    expect(short.account.position).toBe(0);
    expect(long.account.position).toBeGreaterThan(0);
  });
});

describe("crowdFor", () => {
  it("staffs every company with the same mix of traders", () => {
    expect(crowdFor("STW", new Rng(1)).map((b) => b.kind)).toEqual([
      "animator", "fundamentalny", "fundamentalny", "fundamentalny", "newsowy", "momentum", "losowy", "losowy",
    ]);
    expect(crowdFor("STW", new Rng(1))[0]?.id).toBe("STW-animator");
  });
});

import { describe, expect, it } from "vitest";
import { COMPANIES, TECH, TICKERS } from "./companies.js";
import { Economy, type DayReport } from "./economy.js";
import { HAZARDS, newsOf, type EconomicEvent } from "./events.js";

/** Dzien po dniu dwa swiaty z tego samego ziarna: bez zdarzenia i ze zdarzeniem. */
function pair(seed: number, at: number, event: EconomicEvent) {
  const base = new Economy(seed);
  const hit = new Economy(seed);
  for (let d = 0; d < at; d++) {
    base.step();
    hit.step();
  }
  hit.inject(event);
  return { base, hit, next: (): [DayReport, DayReport] => [base.step(), hit.step()] };
}

describe("exact accounting of events", () => {
  it("a big contract pays exactly 10% extra on every machine made", () => {
    const { base, hit, next } = pair(61, 5, { kind: "ZAMOWIENIE", ticker: "MTK", days: 10 });
    // Fabryka placi za stal w dniu dostawy; przy wiekszym zamowieniu stali przyjezdza wiecej,
    // wiec te roznice odejmujemy, zeby zostala sama premia.
    const steelArriving = (e: Economy) => e.shipmentsInTransit().filter((x) => x.to === "MTK").reduce((sum, x) => sum + x.quantity, 0);
    let compared = 0;
    for (let d = 0; d < 10; d++) {
      const extraSteel = steelArriving(hit) - steelArriving(base);
      const [b, h] = next();
      if (b.produced.machines === h.produced.machines && b.ship === null && h.ship === null) {
        const premium = Math.round(h.profit.MTK - b.profit.MTK + extraSteel * TECH.steelPriceDomestic);
        expect(premium).toBe(Math.round(h.produced.machines * TECH.machinePrice * 0.1));
        compared++;
      }
    }
    expect(compared).toBeGreaterThan(0);
  });

  it("dearer coal costs exactly 60% more per tonne of steel", () => {
    const { next } = pair(62, 5, { kind: "ENERGIA", ticker: "STW", days: 5 });
    const [b, h] = next();
    expect(h.produced.steel).toBe(b.produced.steel);
    expect(b.profit.STW - h.profit.STW).toBe(Math.round(h.produced.steel * TECH.coalPerSteel * 0.6));
  });

  it("a strike at the mine does not touch the bank's books that day", () => {
    const { base, hit, next } = pair(63, 5, { kind: "STRAJK", ticker: "RUD", days: 5 });
    const [b, h] = next();
    expect(h.profit.GRS).toBe(b.profit.GRS);
    expect(hit.fairValue("GRS")).toBe(base.fairValue("GRS"));
  });

  it("the mine pays only for the ore it produced", () => {
    const { next } = pair(64, 5, { kind: "WYPADEK", ticker: "RUD", days: 5 });
    const [b, h] = next();
    // wypadek: mniej rudy, wiec nizsze koszty zmienne; dostawy do huty w tym dniu jeszcze z wczoraj
    expect(b.profit.RUD - h.profit.RUD).toBe(-(b.produced.ore - h.produced.ore) * TECH.oreVariable);
  });
});

describe("review fixes stay fixed", () => {
  it("every daily profit is a whole number of grosze (shipments go in whole tonnes)", () => {
    const e = new Economy(42);
    for (let d = 0; d < 200; d++) {
      const r = e.step();
      for (const t of TICKERS) expect(Number.isInteger(r.profit[t])).toBe(true);
      for (const s of r.dispatched) expect(Number.isInteger(s.quantity)).toBe(true);
    }
  });

  it("pays dividends the day after the quarter: 30% to townspeople, the rest to outside investors", () => {
    const e = new Economy(56);
    for (let d = 0; d < TECH.daysPerQuarter; d++) e.step();
    const hh = e.ledger.balance("HH");
    const world = e.ledger.balance("SWIAT");
    const owed = TICKERS.reduce((sum, t) => sum + Math.max(0, Math.round(e.lastQuarterProfit[t] * TECH.payout)), 0);
    e.step();
    expect(owed).toBeGreaterThan(0);
    // na dywidendy patrzymy przez wplyw do mieszkancow w dniu wyplaty: co najmniej ich 30%
    expect(e.ledger.inflow("HH")).toBeGreaterThanOrEqual(Math.round(owed * TECH.localOwnership) - TICKERS.length);
    expect(e.ledger.balance("HH") - hh).toBeLessThan(owed);
    expect(e.ledger.balance("SWIAT")).not.toBe(world);
  });

  it("the bank is not punished twice for bad loans in its quarterly report", () => {
    const { base, hit } = pair(57, 30, { kind: "ZLE_DLUGI", ticker: "GRS", days: 1 });
    for (let d = 0; d < 60; d++) {
      base.step();
      hit.step();
    }
    const grs = (e: Economy) => e.last?.news.find((n) => n.kind === "WYNIKI" && "GRS" in n.impacts)?.impacts.GRS ?? Number.NaN;
    expect(hit.day).toBe(TECH.daysPerQuarter);
    expect(Math.abs(grs(hit) - grs(base))).toBeLessThan(0.1);
  });
});

describe("the economy holds together over time", () => {
  it("valuations stay in a sane band during a calm stretch", () => {
    const e = new Economy(54);
    for (let d = 0; d < 40; d++) e.step();
    for (const t of TICKERS) {
      expect(e.fairValue(t) / e.initialFair[t]).toBeGreaterThan(0.7);
      expect(e.fairValue(t) / e.initialFair[t]).toBeLessThan(1.3);
    }
  });

  it("household spending stays tied to income instead of growing without end", () => {
    const e = new Economy(54);
    const first = e.step().retail;
    for (let d = 0; d < 150; d++) {
      const r = e.step();
      expect(r.retail / first).toBeGreaterThan(0.6);
      expect(r.retail / first).toBeLessThan(1.6);
    }
  });

  it("first-quarter results are profits close to expectations for a calm town", () => {
    const e = new Economy(54);
    let last: DayReport | undefined;
    for (let d = 0; d < TECH.daysPerQuarter; d++) last = e.step();
    const results = last?.news.filter((n) => n.kind === "WYNIKI") ?? [];
    const unclamped = results.filter((n) => Math.abs(Object.values(n.impacts)[0] ?? 1) < 1);
    expect(unclamped.length).toBeGreaterThanOrEqual(4);
    for (const t of ["STW", "MTK", "KSZ"] as const) expect(e.lastQuarterProfit[t]).toBeGreaterThan(0);
  });

  it("random events do happen, and the same event never runs twice at once", () => {
    let fired = 0;
    for (const seed of [71, 72, 73]) {
      const e = new Economy(seed);
      for (let d = 0; d < 360; d++) {
        const r = e.step();
        fired += r.news.filter((n) => HAZARDS.some((h) => h.kind === n.kind)).length;
        const running = e.activeEffects().filter((x) => x.kind !== "ZLOZE").map((x) => `${x.kind}:${x.ticker ?? ""}`);
        expect(new Set(running).size).toBe(running.length);
      }
    }
    expect(fired).toBeGreaterThan(10);
  });

  it("a strike at the factory worries its port and its steel supplier", () => {
    expect(newsOf({ kind: "STRAJK", ticker: "MTK", days: 1 }, 1, 500).impacts).toEqual({ MTK: -0.8, BPT: -0.15, STW: -0.15 });
  });

  it("every company has its full name", () => {
    expect(TICKERS.map((t) => COMPANIES[t].name)).toEqual([
      "Kopalnia Rudawa", "Huta Stalwar", "Fabryka Motorek", "Bałtport", "Sieć Koszyk", "Bank Grosz",
    ]);
  });
});

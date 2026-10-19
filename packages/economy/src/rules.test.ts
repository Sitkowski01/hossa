import { describe, expect, it } from "vitest";
import { zl } from "./companies.js";
import { HAZARDS, type EventKind } from "./events.js";
import { applyRate, dividend, quarterNews, rateDecision, rollHazards } from "./rules.js";

/** Generator „na sztywno”: wszystkie zagrozenia trafiaja albo zadne, dlugosc = minimum. */
const fixed = (hit: boolean) => {
  let draws = 0;
  return {
    draws: () => draws,
    rng: {
      chance: () => (draws++, hit),
      int: (min: number) => (draws++, min),
    },
  };
};

describe("rollHazards", () => {
  it("draws twice per hazard whatever happens, so runs stay in sync", () => {
    const f = fixed(false);
    expect(rollHazards(HAZARDS, f.rng, () => false)).toEqual([]);
    expect(f.draws()).toBe(HAZARDS.length * 2);
  });

  it("fires every hazard that hits, with its company and minimum length", () => {
    const events = rollHazards(HAZARDS, fixed(true).rng, () => false);
    expect(events).toEqual(HAZARDS.map((h) => ({ kind: h.kind, ticker: h.ticker, days: h.days[0] })));
  });

  it("does not start an event that is still going on, except a new deposit", () => {
    const active = new Set(["STRAJK:RUD", "ZLOZE:RUD", "SZTORM:BPT"]);
    const events = rollHazards(HAZARDS, fixed(true).rng, (kind: EventKind, t) => active.has(`${kind}:${t}`));
    const fired = events.map((e) => `${e.kind}:${e.ticker ?? ""}`);
    expect(fired).not.toContain("STRAJK:RUD");
    expect(fired).not.toContain("SZTORM:BPT");
    expect(fired).toContain("STRAJK:STW"); // ten sam rodzaj, inna spolka
    expect(fired).toContain("ZLOZE:RUD");
  });
});

describe("rateDecision", () => {
  it.each([
    [500, 0.5, 0],
    [500, 0.7, 25],
    [500, 0.9, 50],
    [500, 0.3, -25],
    [500, 0.1, -50],
    [700, 0.5, -50], // daleko nad celem: tnie
    [400, 0.5, 25], // ponizej celu: podnosi
    [300, 0.99, 50], // nigdy wiecej niz 50 naraz
    [900, 0.01, -50],
  ])("at %i bp with u=%s changes by %i bp", (rate, u, change) => {
    expect(rateDecision(rate, u)).toBe(change);
  });

  it("keeps rates between 1% and 15%", () => {
    expect(applyRate(500, 50)).toBe(550);
    expect(applyRate(120, -50)).toBe(100);
    expect(applyRate(1490, 50)).toBe(1500);
  });
});

describe("quarterly results", () => {
  it("reports profit against expectations", () => {
    expect(quarterNews("STW", 90, zl(12_340_000), zl(10_000_000))).toEqual({
      day: 90,
      kind: "WYNIKI",
      headline: "Huta Stalwar: zysk za 1. kwartał 12,3 mln zł (+23% wobec oczekiwań)",
      impacts: { STW: 0.468 },
      weight: 0.6,
    });
  });

  it("reports a loss and a miss, capping the reaction at -1", () => {
    const n = quarterNews("RUD", 180, zl(-3_000_000), zl(5_000_000));
    expect(n.headline).toBe("Kopalnia Rudawa: zysk za 2. kwartał -3,0 mln zł (-160% wobec oczekiwań)");
    expect(n.impacts.RUD).toBe(-1);
  });

  it("does not go wild when almost nothing was expected", () => {
    const n = quarterNews("BPT", 270, zl(1_500_000), zl(100_000));
    expect(n.headline).toBe("Bałtport: zysk za 3. kwartał 1,5 mln zł (+140% wobec oczekiwań)");
    expect(n.impacts.BPT).toBe(1);
  });

  it("numbers quarters within the year", () => {
    expect(quarterNews("KSZ", 450, zl(2_000_000), zl(2_000_000)).headline).toContain("zysk za 1. kwartał");
    expect(quarterNews("KSZ", 720, zl(2_000_000), zl(2_000_000)).headline).toContain("zysk za 4. kwartał");
  });

  it("judges the surprise without one-off losses the market already knew about", () => {
    const n = quarterNews("GRS", 90, zl(2_000_000), zl(5_000_000), zl(3_000_000));
    expect(n.impacts.GRS).toBe(0);
    expect(n.headline).toContain("2,0 mln zł");
  });

  it("shows an exact hit as +0%", () => {
    expect(quarterNews("KSZ", 360, zl(2_000_000), zl(2_000_000)).headline).toContain("(+0% wobec oczekiwań)");
  });

  it("pays a dividend from profit only", () => {
    expect(dividend(zl(1_000_000))).toBe(zl(800_000));
    expect(dividend(0)).toBe(0);
    expect(dividend(-500)).toBe(0);
  });
});

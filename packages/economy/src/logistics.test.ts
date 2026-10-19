import { describe, expect, it } from "vitest";
import { TECH, TICKERS, zl } from "./companies.js";
import { Economy } from "./economy.js";
import type { EconomicEvent } from "./events.js";

describe("goods add up (mass balance)", () => {
  it("ore and steel are neither created nor lost between the mine, the mill and the factory", () => {
    // Takze w trudnych chwilach: strajk w kopalni (huta bez rudy), strajk w hucie (ruda zalega,
    // zwaly kopalni sie zapelniaja) i awaria fabryki — wtedy dzialaja wszystkie ograniczenia.
    const e = new Economy(51);
    const plan = new Map<number, EconomicEvent>([
      [10, { kind: "STRAJK", ticker: "RUD", days: 10 }],
      [40, { kind: "STRAJK", ticker: "STW", days: 25 }],
      [80, { kind: "AWARIA", ticker: "MTK", days: 10 }],
    ]);
    let yardFull = false;
    for (let d = 0; d < 120; d++) {
      const planned = plan.get(d);
      if (planned) e.inject(planned);
      const before = { ...e.stocks };
      const arriving = e.shipmentsInTransit();
      const ore = arriving.filter((s) => s.good === "ruda").reduce((x, s) => x + s.quantity, 0);
      const steelIn = arriving.filter((s) => s.to === "MTK").reduce((x, s) => x + s.quantity, 0);
      const r = e.step();
      const sent = (to: string, good: string) => r.dispatched.filter((s) => s.to === to && s.good === good).reduce((x, s) => x + s.quantity, 0);
      expect(e.stocks.millOre).toBeCloseTo(before.millOre + ore - r.produced.steel * TECH.orePerSteel, 6);
      expect(e.stocks.mineOre).toBe(before.mineOre + r.produced.ore - sent("STW", "ruda"));
      expect(e.stocks.factorySteel).toBeCloseTo(before.factorySteel + steelIn - r.produced.machines * TECH.steelPerMachine, 6);
      expect(e.stocks.millSteel).toBe(before.millSteel + r.produced.steel - sent("MTK", "stal") - sent("BPT", "stal"));
      expect(sent("BPT", "maszyny")).toBe(r.produced.machines);
      for (const s of r.dispatched) expect(s.quantity).toBeGreaterThan(0);
      expect(sent("MTK", "stal") + sent("BPT", "stal")).toBeLessThanOrEqual(TECH.truckSteel);
      expect(e.stocks.millOre).toBeLessThanOrEqual(TECH.millOreYard + 1e-9);
      expect(e.stocks.mineOre).toBeLessThanOrEqual(TECH.mineYard);
      expect(r.produced.machines).toBeLessThanOrEqual(TECH.machineCapacity * e.capacity("MTK"));
      if (e.stocks.mineOre === TECH.mineYard) yardFull = true;
      expect(r.produced.steel).toBeLessThanOrEqual(before.millOre / TECH.orePerSteel + ore / TECH.orePerSteel + 1e-9);
    }
    expect(yardFull).toBe(true); // strajk w hucie zapelnil zwaly kopalni
  });

  it("in calm times the mill makes exactly its daily capacity from one day of ore", () => {
    const e = new Economy(54);
    for (let d = 0; d < 5; d++) expect(e.step().produced.steel).toBe(TECH.steelCapacity);
  });

  it("values goods waiting for a ship as receivables of the exporters", () => {
    const e = new Economy(52);
    e.step();
    const toPort = (good: string) => e.shipmentsInTransit().filter((s) => s.to === "BPT" && s.good === good).reduce((x, s) => x + s.quantity, 0);
    const steel = e.stocks.portSteel + toPort("stal");
    const machines = e.stocks.portMachines + toPort("maszyny");
    expect(e.pipeline()).toEqual({
      RUD: 0,
      STW: steel * (TECH.steelPriceExport - TECH.portFeeSteel),
      MTK: machines * (TECH.machinePrice - TECH.portFeeMachine),
      BPT: steel * TECH.portFeeSteel + machines * TECH.portFeeMachine,
      KSZ: 0,
      GRS: 0,
    });
    expect(steel + machines).toBeGreaterThan(0);
  });

  it("sends a ship exactly every few days when the sea is calm", () => {
    const e = new Economy(56);
    const shipDays: number[] = [];
    for (let d = 0; d < 40; d++) {
      const r = e.step();
      if (r.ship) shipDays.push(r.day);
      // ziarno wybrane tak, zeby w tych 40 dniach nie bylo sztormu (sztorm ma osobny test)
      expect(e.activeEffects().some((x) => x.shipsBlocked)).toBe(false);
    }
    expect(shipDays.length).toBeGreaterThanOrEqual(7);
    expect(shipDays.slice(1).map((d, i) => d - (shipDays[i] as number))).toEqual(shipDays.slice(1).map(() => TECH.shipEvery));
  });

  it("opens the books with fixed starting balances", () => {
    expect(new Economy(54).ledger.total()).toBe(zl(100_000_000) + zl(100_000_000_000) + TICKERS.length * zl(50_000_000));
  });

  it("household spending follows income smoothly, without jumps", () => {
    const e = new Economy(55);
    let prev = e.step().retail;
    for (let d = 0; d < 80; d++) {
      const r = e.step();
      if (!e.activeEffects().some((x) => x.confidence !== undefined)) {
        expect(Math.abs(r.retail / prev - 1)).toBeLessThan(0.2);
      }
      prev = r.retail;
    }
  });
});

import { describe, expect, it } from "vitest";
import { Ledger } from "./ledger.js";

describe("Ledger", () => {
  it("moves money without creating or destroying it", () => {
    const l = new Ledger({ HH: 1000, RUD: 500 });
    l.transfer("HH", "RUD", 300);
    l.transfer("RUD", "SWIAT", 900);
    expect([l.balance("HH"), l.balance("RUD"), l.balance("SWIAT")]).toEqual([700, -100, 900]);
    expect(l.total()).toBe(1500);
  });

  it("rounds to whole grosze and ignores empty or self transfers", () => {
    const l = new Ledger({ HH: 100 });
    l.transfer("HH", "KSZ", 10.6);
    l.transfer("HH", "HH", 50);
    l.transfer("HH", "KSZ", 0);
    expect(l.balance("KSZ")).toBe(11);
    expect(l.balance("HH")).toBe(89);
    expect(l.inflow("HH")).toBe(0);
  });

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])("rejects transfer of %s", (amount) => {
    expect(() => {
      new Ledger({}).transfer("HH", "KSZ", amount);
    }).toThrow(/non-negative/);
  });

  it("counts today's inflows until the next day starts", () => {
    const l = new Ledger({ RUD: 100 });
    l.transfer("RUD", "HH", 30);
    l.transfer("RUD", "HH", 20);
    expect(l.inflow("HH")).toBe(50);
    l.startDay();
    expect(l.inflow("HH")).toBe(0);
  });
});

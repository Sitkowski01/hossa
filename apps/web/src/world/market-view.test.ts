import { describe, expect, it } from "vitest";
import type { CompanyView, Fundamentals } from "../sim/protocol.js";
import { depth, facts, plant, tape, valuation } from "./market-view.js";

describe("depth", () => {
  it("sprzedaz od najdrozszej, kupno od najlepszej, paski wzgledem najwiekszego poziomu", () => {
    const d = depth(
      [
        { price: 2995, quantity: 100 },
        { price: 2990, quantity: 400 },
      ],
      [
        { price: 3005, quantity: 200 },
        { price: 3010, quantity: 50 },
      ],
    );
    expect(d.asks.map((r) => r.price)).toEqual(["30,10 zł", "30,05 zł"]);
    expect(d.bids.map((r) => r.price)).toEqual(["29,95 zł", "29,90 zł"]);
    expect(d.asks.map((r) => r.share)).toEqual([0.125, 0.5]);
    expect(d.bids.map((r) => r.share)).toEqual([0.25, 1]);
    expect(d.bids[1]?.quantity).toBe("400");
    expect(d.spread).toBe("0,10 zł");
  });

  it("bez jednej strony arkusza nie ma spreadu, a pusty arkusz nie dzieli przez zero", () => {
    expect(depth([{ price: 100, quantity: 5 }], []).spread).toBeNull();
    expect(depth([], [{ price: 100, quantity: 5 }]).spread).toBeNull();
    expect(depth([], [])).toEqual({ asks: [], bids: [], spread: null });
  });
});

describe("tape", () => {
  it("najnowsza transakcja na gorze, strona agresora po polsku", () => {
    const rows = tape([
      { seq: 1, price: 3000, quantity: 1200, side: "BUY" },
      { seq: 2, price: 2995, quantity: 3, side: "SELL" },
    ]);
    expect(rows).toEqual([
      { key: 2, price: "29,95 zł", quantity: "3", side: "sprzedaz" },
      { key: 1, price: "30,00 zł", quantity: "1 200", side: "kupno" },
    ]);
  });
});

describe("valuation", () => {
  it("kurs ponizej wyceny jest okazja (zielony), powyzej ryzykiem (czerwony)", () => {
    expect(valuation(900, 1000)).toEqual({ label: "Kurs do wyceny", value: "10,00% poniżej", sign: 1 });
    expect(valuation(1250, 1000)).toEqual({ label: "Kurs do wyceny", value: "25,00% powyżej", sign: -1 });
  });

  it("roznica ponizej pol procenta to kurs w cenie", () => {
    expect(valuation(1004, 1000).value).toBe("w cenie");
    expect(valuation(996, 1000).value).toBe("w cenie");
    expect(valuation(1006, 1000).value).toBe("0,60% powyżej");
    expect(valuation(994, 1000).value).toBe("0,60% poniżej");
  });
});

describe("facts", () => {
  const company: CompanyView = { name: "Huta Stalwar", price: 3000, open: 2900, fair: 3000, output: 1 };
  const f: Fundamentals = { cash: 5_000_000_00, debt: 300_000_000_00, earningsYear: 60_000_000_00, lastQuarter: -1_000_000_00, marketCap: 600_000_000_00, pe: 10, shares: 20_000_000 };

  it("wycena, kapitalizacja, C/Z, zyski i bilans po kolei", () => {
    expect(facts(company, f)).toEqual([
      { label: "Wartość godziwa", value: "30,00 zł", sign: 0 },
      { label: "Kurs do wyceny", value: "w cenie", sign: 0 },
      { label: "Kapitalizacja", value: "600,00 mln zł", sign: 0 },
      { label: "C/Z", value: "10,0", sign: 0 },
      { label: "Zysk roczny (tempo)", value: "60,00 mln zł", sign: 1 },
      { label: "Ostatni kwartał", value: "−1,00 mln zł", sign: -1 },
      { label: "Gotówka", value: "5,00 mln zł", sign: 0 },
      { label: "Dług", value: "300,00 mln zł", sign: 0 },
    ]);
  });

  it("bez zysku C/Z to kreska, bez dlugu 'brak', zerowy zysk i ujemna gotowka maja swoje kolory", () => {
    const rows = facts(company, { ...f, pe: null, debt: 0, earningsYear: 0, cash: -100 });
    expect(rows.find((r) => r.label === "C/Z")?.value).toBe("—");
    expect(rows.find((r) => r.label === "Dług")?.value).toBe("brak");
    expect(rows.find((r) => r.label === "Zysk roczny (tempo)")?.sign).toBe(0);
    expect(rows.find((r) => r.label === "Gotówka")?.sign).toBe(-1);
    // zero w kasie to jeszcze nie debet
    expect(facts(company, { ...f, cash: 0 }).find((r) => r.label === "Gotówka")?.sign).toBe(0);
    expect(facts(company, { ...f, lastQuarter: 5 }).find((r) => r.label === "Ostatni kwartał")?.sign).toBe(1);
  });
});

describe("plant", () => {
  it("zaklad pokazuje procent mocy, a przy zerze stoi", () => {
    expect(plant("STW", 0.874)).toBe("huta: 87% mocy");
    expect(plant("RUD", 0)).toBe("kopalnia stoi");
    expect(plant("BPT", 1)).toBe("port: 100% mocy");
    expect(plant("MTK", 0.5)).toBe("fabryka: 50% mocy");
    expect(plant("KSZ", 0.9)).toBe("sklepy: 90% mocy");
  });

  it("bank nie ma zakladu", () => {
    expect(plant("GRS", 1)).toBeNull();
  });
});

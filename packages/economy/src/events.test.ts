import { describe, expect, it } from "vitest";
import { TICKERS, zl } from "./companies.js";
import { HAZARDS, effectOf, newsOf, type EventKind } from "./events.js";

describe("events", () => {
  it.each<[EventKind, Record<string, unknown>]>([
    ["STRAJK", { capacity: 0 }],
    ["WYPADEK", { capacity: 0.3 }],
    ["ENERGIA", { coal: 1.6 }],
    ["ZAMOWIENIE", { demand: 1.6, premium: 0.1 }],
    ["AWARIA", { capacity: 0.5 }],
    ["SZTORM", { shipsBlocked: true }],
    ["NASTROJE", { confidence: 0.85 }],
    ["SWIETA", { confidence: 1.35 }],
  ])("%s has its effect for the given number of days", (kind, effect) => {
    expect(effectOf({ kind, ticker: "RUD", days: 7 }, 10)).toEqual({ kind, ticker: "RUD", until: 17, ...effect });
  });

  it("a new deposit lasts forever; rates and bad loans have no lasting effect", () => {
    expect(effectOf({ kind: "ZLOZE", ticker: "RUD", days: 1 }, 3)).toMatchObject({ until: Number.POSITIVE_INFINITY, capacity: 1.2 });
    expect(effectOf({ kind: "STOPY", days: 1, size: 25 }, 3)).toBeUndefined();
    expect(effectOf({ kind: "ZLE_DLUGI", ticker: "GRS", days: 1 }, 3)).toBeUndefined();
  });

  it("a strike hurts the company and the ones that depend on it", () => {
    const news = newsOf({ kind: "STRAJK", ticker: "RUD", days: 10 }, 4, 500);
    expect(news).toMatchObject({ day: 4, kind: "STRAJK", headline: "Strajk w kopalni Rudawa — produkcja stoi", weight: 0.9 });
    expect(news.impacts).toEqual({ RUD: -0.8, STW: -0.3, MTK: -0.1 });
  });

  it("a deposit is good news only for the mine", () => {
    expect(newsOf({ kind: "ZLOZE", ticker: "RUD", days: 1 }, 1, 500).impacts).toEqual({ RUD: 0.7 });
  });

  it("describes rate decisions in both directions and a hold", () => {
    const up = newsOf({ kind: "STOPY", days: 1, size: 50 }, 45, 550);
    expect(up.headline).toBe("Bank centralny podnosi stopy do 5,50%");
    expect(up.impacts.MTK).toBe(-1);
    expect(up.impacts.GRS).toBeCloseTo(-0.6);
    const down = newsOf({ kind: "STOPY", days: 1, size: -25 }, 45, 475);
    expect(down.headline).toBe("Bank centralny obniża stopy do 4,75%");
    expect(down.impacts.RUD).toBe(0.5);
    const hold = newsOf({ kind: "STOPY", days: 1 }, 45, 500); // bez zmiany = utrzymanie
    expect(hold).toMatchObject({ headline: "Bank centralny utrzymuje stopy: 5,00%", impacts: {}, weight: 0.1 });
  });

  it.each(HAZARDS.map((h) => [h.kind, h.ticker] as const))("has a headline for %s (%s)", (kind, ticker) => {
    const news = newsOf({ kind, ticker, days: 5 }, 1, 500);
    expect(news.headline.length).toBeGreaterThan(10);
    expect(Object.keys(news.impacts).length).toBeGreaterThan(0);
    expect(news.weight).toBeGreaterThan(0);
  });

  it("covers every company with a hazard and keeps probabilities small", () => {
    expect(new Set(HAZARDS.map((h) => h.ticker))).toEqual(new Set(TICKERS));
    for (const h of HAZARDS) {
      expect(h.perDay).toBeGreaterThan(0);
      expect(h.perDay).toBeLessThan(0.02);
      expect(h.days[0]).toBeLessThanOrEqual(h.days[1]);
    }
  });

  it("converts zloty to grosze", () => {
    expect(zl(12.345)).toBe(1235);
    expect(zl(0.1 + 0.2)).toBe(30);
  });
});

describe("headlines name the right companies", () => {
  it.each<[EventKind, string, Record<string, number>]>([
    ["STRAJK", "Strajk w hucie Stalwar — produkcja stoi", { STW: -0.8, MTK: -0.3, BPT: -0.1 }],
    ["WYPADEK", "Wypadek w hucie Stalwar: wydobycie spada do 30%", { STW: -0.7, MTK: -0.3, BPT: -0.1 }],
    ["ZLOZE", "Nowe złoże przy hucie Stalwar: wydobycie +20% na stałe", { STW: 0.7 }],
    ["AWARIA", "Awaria linii w hucie Stalwar: produkcja o połowę mniejsza", { STW: -0.5, MTK: -0.3, BPT: -0.1 }],
  ])("%s", (kind, headline, impacts) => {
    const n = newsOf({ kind, ticker: "STW", days: 3 }, 2, 500);
    expect(n.headline).toBe(headline);
    expect(n.impacts).toEqual(impacts);
  });

  it.each<[EventKind, string, Record<string, number>, number]>([
    ["ENERGIA", "Węgiel drożeje o 60% — huta Stalwar pod presją kosztów", { STW: -0.6, MTK: -0.1 }, 0.7],
    ["ZAMOWIENIE", "Fabryka Motorek dostaje duży kontrakt eksportowy po lepszej cenie", { MTK: 0.7, STW: 0.25, BPT: 0.15 }, 0.8],
    ["SZTORM", "Sztorm na Bałtyku — statki nie wpływają do portu", { BPT: -0.5, STW: -0.15, MTK: -0.15 }, 0.7],
    ["NASTROJE", "Mieszkańcy zaciskają pasa — spada sprzedaż w sklepach", { KSZ: -0.6, GRS: -0.1 }, 0.6],
    ["SWIETA", "Rusza świąteczny sezon zakupów", { KSZ: 0.6 }, 0.5],
    ["ZLE_DLUGI", "Bank Grosz spisuje w straty część kredytów", { GRS: -0.7 }, 0.7],
  ])("%s", (kind, headline, impacts, weight) => {
    expect(newsOf({ kind, days: 3 }, 2, 500)).toEqual({ day: 2, kind, headline, impacts, weight });
  });

  it("names every company in the mine strike template", () => {
    const names = TICKERS.map((t) => newsOf({ kind: "STRAJK", ticker: t, days: 1 }, 1, 500).headline);
    expect(names).toEqual([
      "Strajk w kopalni Rudawa — produkcja stoi",
      "Strajk w hucie Stalwar — produkcja stoi",
      "Strajk w fabryce Motorek — produkcja stoi",
      "Strajk w Bałtporcie — produkcja stoi",
      "Strajk w sieci Koszyk — produkcja stoi",
      "Strajk w banku Grosz — produkcja stoi",
    ]);
  });
});

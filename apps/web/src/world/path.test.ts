import { describe, expect, it } from "vitest";
import { densify, roundCorners, type Vec2 } from "./path.js";

const L: Vec2[] = [[0, 0], [100, 0], [100, 50]];

describe("roundCorners", () => {
  it("zostawia poczatek i koniec, a zakret zastepuje lukiem", () => {
    const out = roundCorners(L, 10, 4);
    expect(out[0]).toEqual([0, 0]);
    expect(out.at(-1)).toEqual([100, 50]);
    // luk zaczyna sie 10 m przed wierzcholkiem i konczy 10 m za nim
    expect(out[1]).toEqual([90, 0]);
    expect(out[5]).toEqual([100, 10]);
    expect(out).toHaveLength(2 + 5);
    // srodek luku jest scieciem rogu, nie samym rogiem
    const [mx, mz] = out[3] as Vec2;
    expect(mx).toBeCloseTo(97.5);
    expect(mz).toBeCloseTo(2.5);
  });

  it("na krotkim odcinku zmniejsza promien do polowy jego dlugosci", () => {
    const out = roundCorners([[0, 0], [8, 0], [8, 100]], 10, 2);
    expect(out[1]).toEqual([4, 0]);
    expect(out[3]).toEqual([8, 4]);
  });

  it("dwa punkty i powtorzony wierzcholek zostawia bez zmian", () => {
    expect(roundCorners([[0, 0], [5, 5]], 10)).toEqual([[0, 0], [5, 5]]);
    expect(roundCorners([[0, 0], [0, 0], [5, 0]], 10)).toEqual([[0, 0], [5, 0]]);
  });
});

describe("densify", () => {
  it("dzieli kazdy odcinek tak, zeby zaden krok nie byl dluzszy niz zadany", () => {
    const out = densify(L, 7);
    expect(out[0]).toEqual([0, 0]);
    expect(out.at(-1)).toEqual([100, 50]);
    expect(out).toHaveLength(15 + 8 + 1);
    for (let i = 1; i < out.length; i++) {
      const [ax, az] = out[i - 1] as Vec2;
      const [bx, bz] = out[i] as Vec2;
      expect(Math.hypot(bx - ax, bz - az)).toBeLessThanOrEqual(7 + 1e-9);
    }
  });

  it("pusta lista zostaje pusta", () => {
    expect(densify([], 5)).toEqual([]);
  });
});

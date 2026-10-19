import fc from "fast-check";
import { beforeEach, describe, expect, it } from "vitest";
import { densify, keepRight, polyline, roundCorners, sampleAt, type Vec2, type Vec3 } from "./path.js";

const flat = (pts: readonly Vec2[]): Vec3[] => pts.map(([x, z]) => [x, 0, z]);
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

  it("ten sam zakret przesuniety na mapie daje ten sam luk, przesuniety", () => {
    const shifted = roundCorners(L.map(([x, z]): Vec2 => [x + 5, z + 10]), 10, 4);
    roundCorners(L, 10, 4).forEach(([x, z], i) => {
      expect(shifted[i]?.[0]).toBeCloseTo(x + 5);
      expect(shifted[i]?.[1]).toBeCloseTo(z + 10);
    });
  });

  it("krotki odcinek za zakretem tez zmniejsza promien", () => {
    const out = roundCorners([[0, 0], [100, 0], [100, 8]], 10, 2);
    expect(out[1]).toEqual([96, 0]);
    expect(out[3]).toEqual([100, 4]);
  });

  it("pusta trasa i pojedynczy punkt zostaja bez zmian", () => {
    expect(roundCorners([], 10)).toEqual([]);
    expect(roundCorners([[1, 2]], 10)).toEqual([[1, 2]]);
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

describe("polyline i sampleAt", () => {
  // liczone w kazdym tescie, a nie przy zbieraniu describe — blad w polyline ma oblac test
  let line: ReturnType<typeof polyline>;
  beforeEach(() => {
    line = polyline([[0, 0, 0], [30, 0, 0], [30, 4, 40]]);
  });

  it("na stalej wysokosci liczy dlugosc w poziomie i zostaje na tej wysokosci", () => {
    const raised = polyline([[0, 5, 0], [30, 5, 0], [30, 5, 40]]);
    expect(raised.length).toBe(70);
    expect(sampleAt(raised, 50).position).toEqual([30, 5, 20]);
  });

  it("liczy dlugosc w trzech wymiarach", () => {
    expect(line.cum).toEqual([0, 30, 30 + Math.hypot(4, 40)]);
    expect(line.length).toBeCloseTo(30 + Math.hypot(4, 40));
  });

  it("zwraca pozycje i kierunek jazdy w plaszczyznie", () => {
    const a = sampleAt(line, 15);
    expect(a.position).toEqual([15, 0, 0]);
    expect(a.direction).toEqual([1, 0]);
    const b = sampleAt(line, 30 + line.length / 2 - 15);
    expect(b.position[1]).toBeCloseTo(2);
    expect(b.direction[0]).toBeCloseTo(0);
    expect(b.direction[1]).toBeCloseTo(1);
  });

  it("przycina droge do poczatku i konca trasy", () => {
    expect(sampleAt(line, -5).position).toEqual([0, 0, 0]);
    expect(sampleAt(line, 1e6).position).toEqual([30, 4, 40]);
  });

  it("dziala na trasie z jednego punktu", () => {
    const one = polyline([[1, 2, 3]]);
    expect(one.length).toBe(0);
    expect(sampleAt(one, 5).position).toEqual([1, 2, 3]);
  });

  it("wlasnosc: idac dalej po trasie nigdy nie cofamy sie wzgledem poprzedniej probki", () => {
    const pts = fc.array(fc.tuple(fc.integer({ min: -200, max: 200 }), fc.integer({ min: -200, max: 200 })), { minLength: 2, maxLength: 8 });
    fc.assert(
      fc.property(pts, fc.integer({ min: 1, max: 15 }), (raw, r) => {
        const route = polyline(flat(densify(roundCorners(raw, r), 3)));
        let prev = sampleAt(route, 0).position;
        let travelled = 0;
        for (let s = 1; s <= route.length; s += 1) {
          const p = sampleAt(route, s).position;
          travelled += Math.hypot(p[0] - prev[0], p[2] - prev[2]);
          prev = p;
        }
        // suma krokow po 1 m nie moze przekroczyc dlugosci trasy (sciezka nie skacze)
        expect(travelled).toBeLessThanOrEqual(route.length + 1e-6);
      }),
      { numRuns: 100 },
    );
  });
});

describe("keepRight", () => {
  it("jadac na wschod zjezdza na poludnie (+z), jadac na polnoc (-z) na wschod", () => {
    expect(keepRight([[0, 0], [10, 0]], 2)).toEqual([[0, 2], [10, 2]]);
    expect(keepRight([[0, 0], [0, -10]], 2)).toEqual([[2, 0], [2, -10]]);
  });

  it("na zakrecie przesuwa punkt prostopadle do sredniego kierunku", () => {
    const [, mid] = keepRight([[0, 0], [10, 0], [10, 10]], Math.SQRT2);
    expect(mid?.[0]).toBeCloseTo(9);
    expect(mid?.[1]).toBeCloseTo(1);
  });

  it("pojedynczy punkt zostaje w miejscu", () => {
    expect(keepRight([[3, 4]], 2)).toEqual([[3, 4]]);
  });
});

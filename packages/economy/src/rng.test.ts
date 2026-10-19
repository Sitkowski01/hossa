import { describe, expect, it } from "vitest";
import { Rng } from "./rng.js";

describe("Rng", () => {
  it("repeats the same sequence for the same seed", () => {
    const a = new Rng(42);
    const b = new Rng(42);
    expect(Array.from({ length: 5 }, () => a.next())).toEqual(Array.from({ length: 5 }, () => b.next()));
  });

  it("stays inside the requested ranges", () => {
    const r = new Rng(1);
    for (let i = 0; i < 2000; i++) {
      const x = r.next();
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
      const k = r.int(3, 5);
      expect([3, 4, 5]).toContain(k);
      const y = r.range(-2, 2);
      expect(y).toBeGreaterThanOrEqual(-2);
      expect(y).toBeLessThan(2);
    }
  });

  it("hits every value of int(min, max) and respects chance()", () => {
    const r = new Rng(9);
    const seen = new Set<number>();
    let hits = 0;
    for (let i = 0; i < 4000; i++) {
      seen.add(r.int(1, 4));
      if (r.chance(0.25)) hits++;
    }
    expect([...seen].sort()).toEqual([1, 2, 3, 4]);
    expect(hits / 4000).toBeGreaterThan(0.22);
    expect(hits / 4000).toBeLessThan(0.28);
    expect(new Rng(1).chance(0)).toBe(false);
    expect(new Rng(1).chance(1)).toBe(true);
  });

  it("picks every element and refuses an empty list", () => {
    const r = new Rng(3);
    const seen = new Set(Array.from({ length: 200 }, () => r.pick(["a", "b", "c"])));
    expect([...seen].sort()).toEqual(["a", "b", "c"]);
    expect(() => r.pick([])).toThrow(/empty list/);
  });

  it("forks an independent stream", () => {
    const parent = new Rng(5);
    const child = parent.fork();
    expect(child.next()).not.toBe(parent.next());
  });
});

describe("Rng.fork", () => {
  it("gives different children over time and from different parents", () => {
    const p = new Rng(1);
    const a = p.fork().next();
    const b = p.fork().next();
    expect(a).not.toBe(b);
    expect(new Rng(2).fork().next()).not.toBe(new Rng(3).fork().next());
  });
});

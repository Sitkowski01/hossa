import { describe, expect, it } from "vitest";
import { MS_PER_DAY, SimClock, dayFraction, extrapolate } from "./clock.js";

describe("SimClock", () => {
  it("przy tempie 1× jeden dzien trwa MS_PER_DAY", () => {
    const clock = new SimClock(20);
    for (let i = 0; i < MS_PER_DAY / 100; i++) clock.advance(100);
    expect(clock.time).toBeCloseTo(20);
  });

  it("pierwszy krok wykonuje sie od razu, kolejne na poczatku swoich przedzialow", () => {
    const clock = new SimClock(20);
    expect(clock.stepsDue).toBe(1);
    // jeden krok to MS_PER_DAY / 20 = 2000 ms, podawane klatkami po 250 ms
    for (let i = 0; i < 7; i++) clock.advance(250);
    clock.advance(249);
    expect(clock.stepsDue).toBe(1);
    clock.advance(1);
    expect(clock.time).toBeCloseTo(1);
    const exact = new SimClock(20);
    for (let i = 0; i < 8; i++) exact.advance(250);
    expect(exact.stepsDue).toBe(2);
  });

  it("tempo mnozy uplyw czasu, a pauza go zatrzymuje", () => {
    const fast = new SimClock(20, 16);
    fast.advance(200);
    expect(fast.time).toBeCloseTo((16 * 20 * 200) / MS_PER_DAY);
    const paused = new SimClock(20, 0);
    paused.advance(200);
    expect(paused.time).toBe(0);
    expect(paused.ticksPerMs).toBe(0);
  });

  it("dluga przerwa liczy sie najwyzej jako 250 ms, a czas nie cofa sie", () => {
    const clock = new SimClock(20, 1);
    clock.advance(60_000);
    expect(clock.time).toBeCloseTo((250 * 20) / MS_PER_DAY);
    const before = clock.time;
    clock.advance(-500);
    expect(clock.time).toBe(before);
  });
});

describe("dayFraction i extrapolate", () => {
  it("ulamek dnia liczy sie od poczatku biezacego dnia", () => {
    expect(dayFraction(0, 20)).toBe(0);
    expect(dayFraction(25, 20)).toBe(0.25);
  });

  it("czas plynie dalej po migawce, ale nie wchodzi w nastepny dzien", () => {
    expect(extrapolate(5, 0.01, 100, 20)).toBeCloseTo(6);
    expect(extrapolate(19.5, 0.01, 100, 20)).toBeLessThan(20);
    expect(extrapolate(19.5, 0.01, 100, 20)).toBeGreaterThan(19.99);
    expect(extrapolate(5, 0.01, -100, 20)).toBe(5);
  });
});

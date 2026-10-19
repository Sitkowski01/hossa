import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { DAWN, DUSK, daylight, hourOf } from "./daylight.js";

describe("hourOf", () => {
  it("dzien gospodarki zaczyna sie o swicie i zawija przez polnoc", () => {
    expect(hourOf(0)).toBe(DAWN);
    expect(hourOf(0.5)).toBe(DAWN + 12);
    expect(hourOf(0.9)).toBeCloseTo((DAWN + 21.6) % 24);
  });
});

describe("daylight", () => {
  it("o swicie i zmierzchu slonce jest na horyzoncie, w poludnie najwyzej i na poludniu", () => {
    expect(daylight(DAWN).elevation).toBeCloseTo(0);
    expect(daylight(DUSK).elevation).toBeCloseTo(0);
    const noon = daylight((DAWN + DUSK) / 2);
    expect(noon.elevation).toBeCloseTo(58);
    // poludnie to +z w three.js
    expect(noon.sun[0]).toBeCloseTo(0);
    expect(noon.sun[2]).toBeGreaterThan(0);
  });

  it("rano swieci ze wschodu (+x), wieczorem z zachodu (-x)", () => {
    expect(daylight(DAWN + 1).sun[0]).toBeGreaterThan(0.9);
    expect(daylight(DUSK - 1).sun[0]).toBeLessThan(-0.9);
  });

  it("w nocy slonce jest pod horyzontem, najnizej w srodku nocy", () => {
    const night = (DUSK + (24 - DUSK + DAWN) / 2) % 24;
    expect(daylight(night).elevation).toBeCloseTo(-24);
    expect(daylight(night).sun[1]).toBeLessThan(0);
    expect(daylight(0.5).elevation).toBeLessThan(0);
  });

  it("latarnie zapalaja sie, zanim slonce zajdzie, a gasna po wschodzie", () => {
    expect(daylight(DUSK - 0.1).lampsOn).toBe(true);
    expect(daylight(DUSK - 3).lampsOn).toBe(false);
    expect(daylight(DAWN + 0.1).lampsOn).toBe(true);
    expect(daylight(12).lampsOn).toBe(false);
  });

  it("dzien przechodzi w noc plynnie", () => {
    expect(daylight(12).day).toBe(1);
    expect(daylight(1).day).toBe(0);
    const dusk = daylight(DUSK).day;
    expect(dusk).toBeGreaterThan(0);
    expect(dusk).toBeLessThan(1);
  });

  it("wlasnosc: kierunek do slonca jest jednostkowy i zgodny z wysokoscia", () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 24, maxExcluded: true, noNaN: true }), (h) => {
        const d = daylight(h);
        expect(Math.hypot(...d.sun)).toBeCloseTo(1);
        expect(Math.asin(d.sun[1])).toBeCloseTo((d.elevation * Math.PI) / 180);
        expect(d.day).toBeGreaterThanOrEqual(0);
        expect(d.day).toBeLessThanOrEqual(1);
      }),
    );
  });
});

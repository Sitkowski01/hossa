import { describe, expect, it } from "vitest";
import { smoothstep } from "./smooth.js";

describe("smoothstep", () => {
  it("od 0 do 1 z polowa w srodku i lagodnym poczatkiem", () => {
    expect(smoothstep(0, 1, -1)).toBe(0);
    expect(smoothstep(0, 1, 0.5)).toBe(0.5);
    expect(smoothstep(0, 1, 0.25)).toBe(0.15625);
    expect(smoothstep(0, 1, 2)).toBe(1);
  });

  it("dziala na dowolnym przedziale", () => {
    expect(smoothstep(-6, 10, 2)).toBe(0.5);
    expect(smoothstep(10, 20, 12.5)).toBe(0.15625);
  });
});

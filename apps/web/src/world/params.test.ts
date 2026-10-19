import { describe, expect, it } from "vitest";
import { readParams } from "./params.js";

const random = () => 0.5;

describe("readParams", () => {
  it("bez parametrow: losowe ziarno, tempo 1x, pora dnia z symulacji", () => {
    expect(readParams("", random)).toEqual({ seed: 500_000, speed: 1 });
  });

  it("czyta ziarno, tempo, godzine i kamere", () => {
    expect(readParams("?seed=42&tempo=16&godzina=12.5&kamera=1,2,3,4,5,6", random)).toEqual({
      seed: 42,
      speed: 16,
      hour: 12.5,
      camera: [1, 2, 3, 4, 5, 6],
    });
    expect(readParams("?seed=0&tempo=0&godzina=0", random)).toEqual({ seed: 0, speed: 0, hour: 0 });
  });

  it.each(["abc", "-1", "1.5", "2147483648", ""])("zle ziarno %j zastepuje losowym", (seed) => {
    expect(readParams(`?seed=${seed}`, random).seed).toBe(500_000);
  });

  it("najwieksze dozwolone ziarno przechodzi", () => {
    expect(readParams("?seed=2147483647", random).seed).toBe(2_147_483_647);
  });

  it.each(["3", "abc", "-4", ""])("nieznane tempo %j to 1x", (tempo) => {
    expect(readParams(`?tempo=${tempo}`, random).speed).toBe(1);
  });

  it.each(["24", "-1", "noc", ""])("godzina %j spoza doby jest pomijana", (hour) => {
    expect(readParams(`?godzina=${hour}`, random)).not.toHaveProperty("hour");
  });

  it.each(["1,2,3", "1,2,3,4,5,x", "1,2,3,4,5,6,7"])("kamera %j bez szesciu liczb jest pomijana", (view) => {
    expect(readParams(`?kamera=${view}`, random)).not.toHaveProperty("camera");
  });

  it("godzina tuz przed polnoca przechodzi", () => {
    expect(readParams("?godzina=23.99", random).hour).toBe(23.99);
  });
});

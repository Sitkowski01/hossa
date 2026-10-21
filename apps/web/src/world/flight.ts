import type { Ticker } from "@hossa/economy";
import { TICKERS } from "./companies.js";

export type Vec3 = readonly [number, number, number];

/** Polozenie kamery i punkt, na ktory patrzy (osie three.js: y w gore). */
export interface Pose {
  readonly position: Vec3;
  readonly target: Vec3;
}

/** Czas przelotu kamery do budynku i z powrotem. */
export const FLIGHT_MS = 1200;
/** Kat kamery nad horyzontem po podlocie: ok. 35°, budynek widac z ukosa, razem z placem przed nim. */
const ELEVATION = 0.62;

const TICKER = new RegExp(`^(${TICKERS.join("|")})(_|$)`);

/** Spolka, do ktorej nalezy obiekt makiety, po nazwie z Blendera ("STW_suwnica" -> STW); null dla reszty miasta. */
export function tickerOf(name: string): Ticker | null {
  const m = TICKER.exec(name);
  return m ? (m[1] as Ticker) : null;
}

/** Cubic ease-in-out: przelot rusza i hamuje lagodnie. */
export function ease(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
}

/**
 * Ujecie budynku: kamera patrzy na `target` z odleglosci `distance`, z tego samego kierunku
 * (azymutu), z ktorego patrzyla dotad — przelot nie obraca makiety wokol uzytkownika.
 */
export function focusPose(from: Pose, target: Vec3, distance: number): Pose {
  let dx = from.position[0] - from.target[0];
  let dz = from.position[2] - from.target[2];
  const flat = Math.hypot(dx, dz);
  if (flat < 1e-6) {
    // kamera prosto z gory: brak azymutu, patrzymy od poludnia
    dx = 0;
    dz = 1;
  } else {
    dx /= flat;
    dz /= flat;
  }
  const horizontal = distance * Math.cos(ELEVATION);
  return {
    position: [target[0] + dx * horizontal, target[1] + distance * Math.sin(ELEVATION), target[2] + dz * horizontal],
    target,
  };
}

const lerp = (a: Vec3, b: Vec3, t: number): Vec3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/** Ujecie po `elapsed` ms przelotu z `a` do `b`. */
export function flightAt(a: Pose, b: Pose, elapsed: number, duration = FLIGHT_MS): Pose {
  const t = ease(elapsed / duration);
  return { position: lerp(a.position, b.position, t), target: lerp(a.target, b.target, t) };
}

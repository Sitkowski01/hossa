import { SPEEDS, type Speed } from "../sim/protocol.js";

export interface Params {
  readonly seed: number;
  readonly speed: Speed;
  /** Zatrzymana pora dnia (do zrzutow ekranu). */
  readonly hour?: number;
  /** Polozenie kamery i punkt, na ktory patrzy: x, y, z, celX, celY, celZ. */
  readonly camera?: readonly [number, number, number, number, number, number];
}

const MAX_SEED = 2 ** 31;

/** Liczba z parametru albo NaN, gdy parametru nie ma lub jest pusty (Number("") to 0, nie NaN). */
const numberOf = (text: string | null): number => (text === null || text.trim() === "" ? Number.NaN : Number(text));

/**
 * Parametry z adresu strony: ?seed=42&tempo=4&godzina=12&kamera=x,y,z,celX,celY,celZ.
 * Adres moze przyjsc od kazdego, wiec zle wartosci sa pomijane, a nie przekazywane dalej:
 * NaN jako ziarno zepsuloby cala sesje, a NaN jako godzina zaciemnilby scene.
 */
export function readParams(search: string, random: () => number = Math.random): Params {
  const q = new URLSearchParams(search);
  const seedValue = numberOf(q.get("seed"));
  const seed = Number.isInteger(seedValue) && seedValue >= 0 && seedValue < MAX_SEED ? seedValue : Math.floor(random() * 1e6);
  const speed = SPEEDS.find((s) => String(s) === q.get("tempo")) ?? 1;
  const hourValue = numberOf(q.get("godzina"));
  const hour = hourValue >= 0 && hourValue < 24 ? hourValue : undefined;
  const view = q.get("kamera")?.split(",").map(Number);
  const camera = view?.length === 6 && view.every(Number.isFinite) ? (view as unknown as Params["camera"]) : undefined;
  return { seed, speed, ...(hour === undefined ? {} : { hour }), ...(camera ? { camera } : {}) };
}

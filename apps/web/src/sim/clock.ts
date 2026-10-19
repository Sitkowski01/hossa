import type { Speed } from "./protocol.js";

/** Tyle trwa jeden dzien gospodarki przy tempie 1×. */
export const MS_PER_DAY = 40_000;
/** Dluzsza przerwa (karta w tle, debugger) nie zamienia sie w skok o wiele dni. */
const MAX_FRAME_MS = 250;

/**
 * Zegar symulacji w krokach gieldy. Krok wykonuje sie na poczatku swojego przedzialu czasu,
 * wiec w chwili `time` powinno byc wykonanych floor(time) + 1 krokow.
 */
export class SimClock {
  time = 0;

  constructor(
    readonly stepsPerDay: number,
    public speed: Speed = 1,
  ) {}

  get ticksPerMs(): number {
    return (this.speed * this.stepsPerDay) / MS_PER_DAY;
  }

  advance(ms: number): void {
    this.time += Math.min(Math.max(ms, 0), MAX_FRAME_MS) * this.ticksPerMs;
  }

  get stepsDue(): number {
    return Math.floor(this.time) + 1;
  }
}

/** Ulamek biezacego dnia (0..1). */
export const dayFraction = (time: number, stepsPerDay: number): number => (time % stepsPerDay) / stepsPerDay;

/**
 * Czas widziany przez scene `ms` po migawce: plynie dalej, zeby ciezarowki jechaly plynnie,
 * ale zatrzymuje sie tuz przed nowym dniem — ten zaczyna dopiero kolejna migawka z workera.
 */
export function extrapolate(time: number, ticksPerMs: number, ms: number, stepsPerDay: number): number {
  const dayEnd = (Math.floor(time / stepsPerDay) + 1) * stepsPerDay;
  return Math.min(time + ticksPerMs * Math.max(ms, 0), dayEnd - 1e-6);
}

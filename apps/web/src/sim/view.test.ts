import { TECH, TICKERS, type EconomicEvent } from "@hossa/economy";
import { Session } from "@hossa/market";
import { describe, expect, it } from "vitest";
import { SimClock } from "./clock.js";
import type { Snapshot } from "./protocol.js";
import { Observer, yards } from "./view.js";

/** Sesja jak w workerze: zegar idzie krokami, po kazdym kroku powstaje migawka. */
function run(seed: number, days: number, events: Record<number, EconomicEvent> = {}): Snapshot[] {
  const session = new Session({ seed, stepsPerDay: 4 });
  const clock = new SimClock(session.stepsPerDay);
  const observer = new Observer(seed);
  const shots: Snapshot[] = [];
  for (let step = 0; step < days * session.stepsPerDay; step++) {
    const event = step % session.stepsPerDay === 0 ? events[session.day] : undefined;
    if (event) session.inject(event);
    clock.time = step + 0.5;
    session.tick();
    shots.push(observer.snapshot(session, clock));
  }
  return shots;
}

const lastOfDay = (shots: Snapshot[], day: number): Snapshot => shots.filter((s) => s.day === day).at(-1) as Snapshot;
const firstOfDay = (shots: Snapshot[], day: number): Snapshot => shots.find((s) => s.day === day) as Snapshot;

describe("Observer — migawka przed pierwszym krokiem", () => {
  it("pokazuje spolki po cenach startowych i pusty dziennik", () => {
    const session = new Session({ seed: 1, stepsPerDay: 4 });
    const shot = new Observer(1).snapshot(session, new SimClock(4));
    expect(shot.seed).toBe(1);
    expect(shot.day).toBe(0);
    expect(Object.keys(shot.companies)).toEqual([...TICKERS]);
    for (const t of TICKERS) {
      expect(shot.companies[t].price).toBeGreaterThan(0);
      expect(shot.companies[t].open).toBe(shot.companies[t].price);
    }
    expect(shot.index).toBeCloseTo(1000);
    expect(shot.indexOpen).toBe(1000);
    expect(shot.news).toEqual([]);
    expect(shot.ship).toBe("przy_nabrzezu");
    expect(shot.speed).toBe(1);
    expect(shot.stepsPerDay).toBe(4);
  });
});

describe("Observer — sesja w toku", () => {
  const shots = run(42, 12, { 2: { kind: "ZAMOWIENIE", ticker: "MTK", days: 20 } });
  const last = shots.at(-1) as Snapshot;

  it("czas, dzien i tempo pochodza z zegara i sesji", () => {
    expect(last.day).toBe(12);
    expect(last.time).toBe(12 * 4 - 0.5);
    expect(last.ticksPerMs).toBeCloseTo((4 * 1) / 40_000);
  });

  it("dziennik trzyma najwyzej 8 ostatnich wiadomosci z rosnacymi numerami", () => {
    const withNews = shots.find((s) => s.news.length > 0);
    expect(withNews).toBeDefined();
    for (const s of shots) {
      expect(s.news.length).toBeLessThanOrEqual(8);
      for (let i = 1; i < s.news.length; i++) expect(s.news[i]?.id).toBe((s.news[i - 1]?.id ?? 0) + 1);
    }
  });

  it("wysylki dnia jada tylko znanymi trasami i maja ladunek", () => {
    const routes = new Set(shots.flatMap((s) => s.dispatches.map((d) => d.route)));
    expect([...routes].sort()).toEqual(["MTK-BPT", "RUD-STW", "STW-BPT", "STW-MTK"]);
    for (const d of shots.flatMap((s) => s.dispatches)) expect(d.quantity).toBeGreaterThan(0);
  });

  it("produkcja i place sa w przedziale 0..1, a indeks otwarcia to wczorajsze zamkniecie", () => {
    for (const s of shots) {
      for (const t of TICKERS) expect(s.companies[t].output).toBeGreaterThanOrEqual(0);
      for (const t of TICKERS) expect(s.companies[t].output).toBeLessThanOrEqual(1);
      for (const v of Object.values(s.yards)) expect(v).toBeGreaterThanOrEqual(0);
      for (const v of Object.values(s.yards)) expect(v).toBeLessThanOrEqual(1);
    }
    // ostatnia migawka dnia powstaje juz po zamknieciu, wiec porownujemy z pierwsza migawka nastepnego
    expect(firstOfDay(shots, 7).indexOpen).toBe(lastOfDay(shots, 6).index);
  });

  it("statek w zwyklym tygodniu odplywa i nastepnego dnia wraca", () => {
    const phases = Array.from({ length: 12 }, (_, d) => lastOfDay(shots, d + 1).ship);
    const out = phases.indexOf("wyplywa");
    expect(out).toBeGreaterThanOrEqual(0);
    expect(phases[out + 1]).toBe("wraca");
  });
});

describe("yards", () => {
  it("dzieli zapasy przez pojemnosc placow i przycina do 0..1", () => {
    const y = yards({ mineOre: TECH.mineYard / 2, millOre: TECH.millOreYard * 2, millSteel: 0, factorySteel: 0, backlog: 0, portSteel: 700, portMachines: 100 }, -0.5);
    expect(y).toEqual({ mine: 0.5, millOre: 1, factory: 0, portSteel: 700 / 3500, portMachines: 100 / 1000 });
  });
});

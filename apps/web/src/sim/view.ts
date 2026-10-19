import { TECH, TICKERS, type DayReport, type Stocks, type Ticker } from "@hossa/economy";
import type { Session } from "@hossa/market";
import { nextShipPhase, type ShipPhase } from "../world/traffic.js";
import type { SimClock } from "./clock.js";
import type { CompanyView, Dispatch, Headline, Incident, Route, Snapshot, Yards } from "./protocol.js";

const NEWS_KEPT = 8;
const clamp01 = (x: number): number => Math.min(1, Math.max(0, x));
/** Port mierzy place ladunkiem jednego statku (wysylki z kilku dni). */
const PORT_STEEL = TECH.truckSteel * TECH.shipEvery;
const PORT_MACHINES = TECH.machineCapacity * TECH.shipEvery;

/** Zapelnienie placow wzgledem ich pojemnosci; port mierzy ladunkiem jednego statku. */
export function yards(stocks: Stocks, factoryOutput: number): Yards {
  return {
    mine: clamp01(stocks.mineOre / TECH.mineYard),
    millOre: clamp01(stocks.millOre / TECH.millOreYard),
    factory: clamp01(factoryOutput),
    portSteel: clamp01(stocks.portSteel / PORT_STEEL),
    portMachines: clamp01(stocks.portMachines / PORT_MACHINES),
  };
}

/**
 * W dniu zaladunku gospodarka oproznia port juz w kroku dnia, zanim powstanie pierwsza migawka.
 * Makieta pokazuje wtedy na placach to, co statek zabiera — dzwigi przenosza to rano.
 */
export function loadingDay(y: Yards, loaded: { readonly steel: number; readonly machines: number } | null): Yards {
  if (!loaded) return y;
  return { ...y, portSteel: clamp01(loaded.steel / PORT_STEEL), portMachines: clamp01(loaded.machines / PORT_MACHINES) };
}

const tone = (impacts: Partial<Record<Ticker, number>>): number => {
  const values = Object.values(impacts);
  return values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length;
};

/**
 * Patrzy na sesje i sklada migawke dla sceny. Pamieta tylko to, czego sesja nie trzyma:
 * faze statku z poprzedniego dnia (zeby statek nie przeskakiwal).
 */
export class Observer {
  private ship: ShipPhase = "przy_nabrzezu";
  private seenDay = Number.NaN;

  constructor(private readonly seed: number) {}

  snapshot(session: Session, clock: SimClock): Snapshot {
    const economy = session.economy;
    // gospodarka po rozruchu zawsze ma raport (ostatni dzien rozruchu albo dzisiejszy)
    const report = economy.last as DayReport;
    const day = session.day;
    // rozruch gospodarki (dni <= 0) to przeszlosc — statek startuje przy nabrzezu
    if (report.day > 0 && report.day !== this.seenDay) {
      this.seenDay = report.day;
      const storm = economy.activeEffects().some((e) => e.kind === "SZTORM");
      this.ship = nextShipPhase(this.ship, storm, report.ship !== null);
    }
    const produced = report.produced;
    const output: Record<Ticker, number> = {
      RUD: produced.ore / TECH.oreCapacity,
      STW: produced.steel / TECH.steelCapacity,
      MTK: produced.machines / TECH.machineCapacity,
      BPT: economy.capacity("BPT"),
      KSZ: economy.capacity("KSZ"),
      GRS: economy.capacity("GRS"),
    };
    const companies = {} as Record<Ticker, CompanyView>;
    for (const t of TICKERS) {
      const market = session.markets[t];
      companies[t] = { price: market.last, open: market.candles.at(-1)?.open ?? market.last, fair: session.fairValue(t), output: clamp01(output[t]) };
    }
    // raport jest z dzisiaj, wiec jego wysylki to dzisiejsze wyjazdy
    const dispatches: Dispatch[] = report.dispatched.map((s) => ({ route: `${s.from}-${s.to}` as Route, good: s.good, quantity: s.quantity }));
    const incidents: Incident[] = economy
      .activeEffects()
      .filter((e) => Number.isFinite(e.until))
      .map((e) => ({ kind: e.kind, ...(e.ticker ? { ticker: e.ticker } : {}), daysLeft: e.until - day }));
    const first = Math.max(0, session.news.length - NEWS_KEPT);
    const news: Headline[] = session.news.slice(first).map((n, i) => ({ id: first + i, day: n.day, text: n.headline, tone: tone(n.impacts) }));
    return {
      seed: this.seed,
      day,
      time: clock.time,
      stepsPerDay: session.stepsPerDay,
      ticksPerMs: clock.ticksPerMs,
      speed: clock.speed,
      rateBp: economy.rateBp,
      index: session.index(),
      indexOpen: session.indexHistory.at(-1) ?? 1000,
      companies,
      dispatches,
      yards: loadingDay(yards(economy.stocks, companies.MTK.output), report.ship),
      ship: this.ship,
      incidents,
      news,
    };
  }
}

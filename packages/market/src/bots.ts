import type { News, Rng, Ticker } from "@hossa/economy";
import { TICK, roundTick, type Account, type SymbolMarket, type Trader } from "./symbol-market.js";

export type BotKind = "animator" | "fundamentalny" | "newsowy" | "momentum" | "losowy";

/** Co bot widzi w danym kroku. */
export interface BotContext {
  readonly market: SymbolMarket;
  readonly step: number;
  /** Krokow gieldy na dzien — boty licza okna w dniach, nie w krokach. */
  readonly stepsPerDay: number;
  /** Wartosc godziwa z gospodarki sprzed `lagDays` dni (grosze) — fundamentalni widza ja z opoznieniem. */
  readonly fair: (lagDays: number) => number;
}

export abstract class Bot implements Trader {
  readonly account: Account = { position: 0, cash: 0 };
  readonly resting = new Set<number>();
  abstract readonly kind: BotKind;

  /**
   * Kazdy bot losuje z wlasnego generatora: dodatkowe losowanie jednego gracza (np. po newsie)
   * nie przesuwa losowan pozostalych, wiec przebiegi z i bez zdarzenia roznia sie tylko jego skutkami.
   */
  constructor(
    readonly id: string,
    protected readonly rng: Rng,
  ) {}

  abstract act(ctx: BotContext): void;

  /** Wiadomosc dotyczaca spolki tego bota. Czytaja je tylko gracze na newsach. */
  onNews?(impact: number, news: News): void;
}

/**
 * Animator rynku: stawia drabinke zlecen po obu stronach i zarabia na spreadzie. Gdy rynek robi sie
 * nerwowy, poszerza spread i zmniejsza zlecenia, a czasem w ogole sie wycofuje — plynnosc znika
 * wtedy, kiedy jest najbardziej potrzebna (jak w prawdziwych krachach). Duzy zapas akcji przesuwa
 * jego ceny, zeby sie go pozbyc.
 */
export class MarketMaker extends Bot {
  readonly kind = "animator";

  act({ market }: BotContext): void {
    market.cancelAll(this);
    const vol = market.volatility;
    const flee = this.rng.chance(0.5); // losowane zawsze — staly strumien losowan niezaleznie od stanu
    if (vol > 0.012 && flee) return;
    const ref = market.mid();
    const skew = -Math.max(-1, Math.min(1, this.account.position / 5000)) * ref * 0.004;
    const half = Math.max(TICK, ref * (0.002 + 6 * vol));
    const size = Math.max(10, Math.round(300 / (1 + 60 * vol)));
    for (let level = 0; level < 3; level++) {
      const bid = roundTick(ref + skew - half * (1 + level));
      const ask = Math.max(bid + TICK, roundTick(ref + skew + half * (1 + level)));
      market.submit(this, "BUY", "LIMIT", bid, size);
      market.submit(this, "SELL", "LIMIT", ask, size);
    }
  }
}

/**
 * Inwestor fundamentalny: ma wlasne zdanie o wartosci spolki (wartosc godziwa z opoznieniem
 * i stalym odchyleniem) i kupuje, gdy jest wyraznie taniej, sprzedaje, gdy drozej.
 */
export class Fundamental extends Bot {
  readonly kind = "fundamentalny";

  constructor(
    id: string,
    rng: Rng,
    private readonly lagDays: number,
    private readonly bias: number,
    private readonly threshold: number,
  ) {
    super(id, rng);
  }

  act({ market, fair }: BotContext): void {
    if (!this.rng.chance(0.2)) return;
    market.cancelAll(this);
    const estimate = fair(this.lagDays) * (1 + this.bias);
    const price = market.mid();
    const gap = estimate / price - 1;
    if (Math.abs(gap) < this.threshold) return;
    const quantity = Math.round(150 * Math.min(3, Math.abs(gap) / this.threshold));
    if (gap > 0) {
      market.submit(this, "BUY", "LIMIT", Math.min(estimate * (1 - this.threshold / 2), price * 1.01), quantity);
    } else {
      market.submit(this, "SELL", "LIMIT", Math.max(estimate * (1 + this.threshold / 2), price * 0.99), quantity);
    }
  }
}

/**
 * Gracz na newsach: na wiadomosc o spolce rusza od razu, zleceniami po kazdej cenie, rozlozonymi
 * na kilkanascie krokow. Czesto przesadza (mnoznik 0,6–1,8) — stad przestrzelenia, ktore potem
 * koryguja fundamentalni.
 */
export class NewsTrader extends Bot {
  readonly kind = "newsowy";
  private remaining = 0;
  private stepsLeft = 0;

  override onNews(impact: number, news: News): void {
    const amount = Math.round(impact * news.weight * this.rng.range(0.6, 1.8) * 2500);
    if (amount === 0) return;
    this.remaining += amount;
    this.stepsLeft = this.rng.int(8, 25);
  }

  act({ market }: BotContext): void {
    if (this.remaining === 0) return;
    const slice = Math.round(this.remaining / Math.max(1, this.stepsLeft));
    this.stepsLeft = Math.max(0, this.stepsLeft - 1);
    this.remaining -= slice;
    if (slice > 0) market.submit(this, "BUY", "MARKET", 0, slice);
    else if (slice < 0) market.submit(this, "SELL", "MARKET", 0, -slice);
  }
}

/** Gracz momentum: kupuje to, co rosnie, sprzedaje to, co spada (ostatnie ~3 dni sesji). */
export class Momentum extends Bot {
  readonly kind = "momentum";

  act({ market, stepsPerDay }: BotContext): void {
    if (!this.rng.chance(0.25)) return;
    const change = market.last / market.priceAgo(3 * stepsPerDay) - 1;
    const size = this.rng.int(20, 80); // losowane zawsze — staly strumien losowan
    if (Math.abs(change) < 0.015) return;
    market.submit(this, change > 0 ? "BUY" : "SELL", "MARKET", 0, size);
  }
}

/**
 * Szum: drobne zlecenia blisko ceny, czesc tuz za srodkiem (przecina spread animatora), a w ok. 35%
 * krokow zlecenie po kazdej cenie. Daje rynkowi transakcje w kazdym kroku — bez tego swieca z jednego
 * kroku bylaby zwykle plaska. Stare zlecenia po ~2 dniach anuluje.
 */
export class NoiseTrader extends Bot {
  readonly kind = "losowy";
  private readonly placed = new Map<number, number>();

  act({ market, step }: BotContext): void {
    const rng = this.rng;
    // zlecenia zrealizowane przez innych znikaja z `resting` — zapominamy je, zeby mapa nie rosla bez konca
    for (const id of this.placed.keys()) if (!this.resting.has(id)) this.placed.delete(id);
    for (const id of this.resting) {
      if (step - (this.placed.get(id) ?? step) > 40) {
        market.cancel(this, id);
        this.placed.delete(id);
      }
    }
    const side = rng.chance(0.5) ? "BUY" : "SELL";
    if (rng.chance(0.6)) {
      const offset = rng.int(-3, 8) * TICK * (side === "BUY" ? -1 : 1);
      const events = market.submit(this, side, "LIMIT", market.mid() + offset, rng.int(5, 60));
      for (const e of events) if (e.kind === "RESTED") this.placed.set(e.orderId, step);
    }
    if (rng.chance(0.35)) market.submit(this, side, "MARKET", 0, rng.int(5, 40));
  }
}

/** Obsada jednej spolki: animator, trzech fundamentalnych o roznych pogladach, newsowy, momentum, dwoch losowych. */
export function crowdFor(ticker: Ticker, rng: Rng): Bot[] {
  return [
    new MarketMaker(`${ticker}-animator`, rng.fork()),
    new Fundamental(`${ticker}-fund-1`, rng.fork(), 0, rng.range(-0.03, 0.03), 0.02),
    new Fundamental(`${ticker}-fund-2`, rng.fork(), 3, rng.range(-0.05, 0.05), 0.03),
    new Fundamental(`${ticker}-fund-3`, rng.fork(), 10, rng.range(-0.05, 0.05), 0.04),
    new NewsTrader(`${ticker}-newsowy`, rng.fork()),
    new Momentum(`${ticker}-momentum`, rng.fork()),
    new NoiseTrader(`${ticker}-losowy-1`, rng.fork()),
    new NoiseTrader(`${ticker}-losowy-2`, rng.fork()),
  ];
}

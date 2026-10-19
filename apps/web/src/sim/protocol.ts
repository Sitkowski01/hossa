import type { EventKind, Good, Ticker } from "@hossa/economy";
import type { ShipPhase } from "../world/traffic.js";

/**
 * Wiadomosci miedzy Web Workerem (gielda i gospodarka) a scena. Scena nie zna silnika:
 * dostaje co ~100 ms migawke ze wszystkim, co ma pokazac. Ceny w groszach.
 */

export const SPEEDS = [0, 1, 4, 16] as const;
export type Speed = (typeof SPEEDS)[number];

export type Route = "RUD-STW" | "STW-MTK" | "STW-BPT" | "MTK-BPT";

export interface CompanyView {
  readonly price: number;
  /** Cena otwarcia dzisiejszej sesji. */
  readonly open: number;
  /** Wartosc godziwa z wyceny gospodarki. */
  readonly fair: number;
  /** Dzisiejsza produkcja wzgledem mocy (0..1); 0 = zaklad stoi (strajk). */
  readonly output: number;
}

/** Zapelnienie placow skladowych 0..1 — na makiecie wysokosc zwalow i stosow. */
export interface Yards {
  readonly mine: number;
  readonly millOre: number;
  readonly factory: number;
  readonly portSteel: number;
  readonly portMachines: number;
}

/** Dzisiejsza wysylka na jednej trasie — scena robi z niej kolumne ciezarowek. */
export interface Dispatch {
  readonly route: Route;
  readonly good: Good;
  readonly quantity: number;
}

export interface Incident {
  readonly kind: EventKind;
  readonly ticker?: Ticker;
  readonly daysLeft: number;
}

export interface Headline {
  readonly id: number;
  readonly day: number;
  readonly text: string;
  /** Wydzwiek od -1 do 1 (srednia wplywu na spolki, ktorych dotyczy). */
  readonly tone: number;
}

export interface Snapshot {
  readonly seed: number;
  readonly day: number;
  /** Czas symulacji w krokach gieldy; ulamek to postep biezacego kroku. */
  readonly time: number;
  readonly stepsPerDay: number;
  /** Ile krokow na milisekunde przy obecnym tempie — scena ekstrapoluje czas miedzy migawkami. */
  readonly ticksPerMs: number;
  readonly speed: Speed;
  readonly rateBp: number;
  readonly index: number;
  /** Indeks na zamknieciu poprzedniego dnia. */
  readonly indexOpen: number;
  readonly companies: Readonly<Record<Ticker, CompanyView>>;
  readonly dispatches: readonly Dispatch[];
  readonly yards: Yards;
  readonly ship: ShipPhase;
  readonly incidents: readonly Incident[];
  readonly news: readonly Headline[];
}

export type ToWorker = { readonly type: "start"; readonly seed: number; readonly speed: Speed } | { readonly type: "speed"; readonly speed: Speed };

export interface FromWorker {
  readonly type: "snapshot";
  readonly snapshot: Snapshot;
}

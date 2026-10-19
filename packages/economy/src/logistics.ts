import { TECH, type Ticker } from "./companies.js";
import type { Ledger } from "./ledger.js";

export type Good = "ruda" | "stal" | "maszyny";

/** Ladunek w drodze — na makiecie to ciezarowka. */
export interface Shipment {
  readonly from: Ticker;
  readonly to: Ticker;
  readonly good: Good;
  readonly quantity: number;
  readonly departs: number;
  readonly arrives: number;
}

export interface Stocks {
  mineOre: number; // ruda na zwalach kopalni
  millOre: number; // ruda na placu huty
  millSteel: number;
  factorySteel: number;
  backlog: number; // zamowione, a jeszcze niezrobione maszyny
  portSteel: number; // czeka na statek
  portMachines: number;
}

export interface Produced {
  readonly ore: number;
  readonly steel: number;
  readonly machines: number;
}

/** Warunki dnia z aktywnych zdarzen. */
export interface Conditions {
  readonly capacity: (t: Ticker) => number;
  readonly coal: number;
  readonly demand: number;
  /** Losowy szum zamowien (0,85–1,15). */
  readonly noise: number;
}

/**
 * Liczba calych ton/sztuk, jaka da sie zrobic. Mnozenie przez 1,2 czy 1,6 zostawia w zapasach
 * okruchy typu -1e-13 i wtedy Math.floor dawal -1 maszyne — znalazl to test wlasciwosci (ziarno 48).
 */
const units = (x: number): number => Math.max(0, Math.floor(x + 1e-9));

/**
 * Fizyka miasteczka: wydobycie, huta, fabryka, ciezarowki i statek. Placi za towar przy dostawie
 * (huta kopalni, fabryka hucie) i przy zaladunku na statek (swiat eksporterom, eksporterzy portowi).
 */
export class Logistics {
  readonly stocks: Stocks = { mineOre: 0, millOre: 3000, millSteel: 0, factorySteel: 700, backlog: 0, portSteel: 0, portMachines: 0 };
  transit: Shipment[] = [];

  constructor(private nextShipDay: number) {}

  /** Dostawy z wczoraj: towar na plac odbiorcy i zaplata przy odbiorze (eksport placi swiat dopiero przy statku). */
  deliver(day: number, ledger: Ledger): void {
    for (const s of this.transit.filter((x) => x.arrives === day)) {
      if (s.good === "ruda") {
        this.stocks.millOre += s.quantity;
        ledger.transfer("STW", "RUD", s.quantity * TECH.orePrice);
      } else if (s.to === "MTK") {
        this.stocks.factorySteel += s.quantity;
        ledger.transfer("MTK", "STW", s.quantity * TECH.steelPriceDomestic);
      } else if (s.good === "stal") {
        this.stocks.portSteel += s.quantity;
      } else {
        this.stocks.portMachines += s.quantity;
      }
    }
    this.transit = this.transit.filter((x) => x.arrives !== day);
  }

  /** Produkcja dnia z kosztami zmiennymi. */
  produce(c: Conditions, ledger: Ledger): Produced {
    const st = this.stocks;
    const ore = Math.max(0, Math.min(Math.floor(TECH.oreCapacity * c.capacity("RUD")), TECH.mineYard - st.mineOre));
    st.mineOre += ore;
    ledger.transfer("RUD", "SWIAT", ore * TECH.oreVariable);

    const steel = units(Math.min(TECH.steelCapacity * c.capacity("STW"), st.millOre / TECH.orePerSteel));
    st.millOre = Math.max(0, st.millOre - steel * TECH.orePerSteel);
    st.millSteel += steel;
    ledger.transfer("STW", "SWIAT", steel * (TECH.coalPerSteel * c.coal + TECH.steelVariable));

    st.backlog = Math.min(st.backlog + Math.round(TECH.machineDemand * c.demand * c.noise), TECH.machineDemand * 30);
    const machines = units(Math.min(TECH.machineCapacity * c.capacity("MTK"), st.factorySteel / TECH.steelPerMachine, st.backlog));
    st.factorySteel = Math.max(0, st.factorySteel - machines * TECH.steelPerMachine);
    st.backlog -= machines;
    ledger.transfer("MTK", "SWIAT", machines * TECH.machineVariable);
    return { ore, steel, machines };
  }

  /** Ciezarowki: dojada nastepnego dnia. Wczorajsze juz dojechaly, wiec place widza caly towar. */
  dispatch(day: number, machines: number): Shipment[] {
    const st = this.stocks;
    const sent: Shipment[] = [];
    const send = (from: Ticker, to: Ticker, good: Good, quantity: number) => {
      if (quantity <= 0) return;
      const s = { from, to, good, quantity, departs: day, arrives: day + 1 };
      this.transit.push(s);
      sent.push(s);
    };
    const oreOut = Math.max(0, Math.min(st.mineOre, TECH.truckOre, TECH.millOreYard - st.millOre));
    st.mineOre -= oreOut;
    send("RUD", "STW", "ruda", oreOut);
    // Wysylki w calych tonach: naleznosci i platnosci wychodza wtedy w calych groszach.
    const factoryNeed = Math.max(0, Math.floor(3 * TECH.machineCapacity * TECH.steelPerMachine - st.factorySteel));
    const toFactory = Math.min(st.millSteel, factoryNeed, TECH.truckSteel);
    const toPort = Math.min(st.millSteel - toFactory, TECH.truckSteel - toFactory);
    st.millSteel -= toFactory + toPort;
    send("STW", "MTK", "stal", toFactory);
    send("STW", "BPT", "stal", toPort);
    send("MTK", "BPT", "maszyny", machines);
    return sent;
  }

  /** Statek zabiera wszystko z portu co kilka dni; w sztorm nie wplywa, a port placi za postoj. */
  ship(day: number, storm: boolean, ledger: Ledger): { steel: number; machines: number } | null {
    if (storm) ledger.transfer("BPT", "SWIAT", TECH.stormCost);
    if (day < this.nextShipDay || storm) return null;
    const st = this.stocks;
    const loaded = { steel: st.portSteel, machines: st.portMachines };
    ledger.transfer("SWIAT", "STW", loaded.steel * TECH.steelPriceExport);
    ledger.transfer("SWIAT", "MTK", loaded.machines * TECH.machinePrice);
    ledger.transfer("STW", "BPT", loaded.steel * TECH.portFeeSteel);
    ledger.transfer("MTK", "BPT", loaded.machines * TECH.portFeeMachine);
    st.portSteel = 0;
    st.portMachines = 0;
    this.nextShipDay = day + TECH.shipEvery;
    return loaded;
  }

  /** Naleznosci za towar sprzedany na eksport, ktory jest w drodze do portu albo czeka na statek (grosze). */
  pipeline(): Record<Ticker, number> {
    const toPort = (good: Good) => this.transit.filter((s) => s.to === "BPT" && s.good === good).reduce((sum, s) => sum + s.quantity, 0);
    const steel = this.stocks.portSteel + toPort("stal");
    const machines = this.stocks.portMachines + toPort("maszyny");
    return {
      RUD: 0,
      STW: steel * (TECH.steelPriceExport - TECH.portFeeSteel),
      MTK: machines * (TECH.machinePrice - TECH.portFeeMachine),
      BPT: steel * TECH.portFeeSteel + machines * TECH.portFeeMachine,
      KSZ: 0,
      GRS: 0,
    };
  }
}

import type { Ticker } from "@hossa/economy";
import type { BookLevel, CompanyView, Fundamentals, Print } from "../sim/protocol.js";
import { change, count, money, price } from "./format.js";

export interface DepthRow {
  readonly price: string;
  readonly quantity: string;
  /** Wielkosc poziomu wzgledem najwiekszego po obu stronach (0..1) — szerokosc paska. */
  readonly share: number;
}

export interface Depth {
  /** Oferty sprzedazy od najdrozszej do najtanszej: najlepsza tuz nad spreadem. */
  readonly asks: readonly DepthRow[];
  /** Oferty kupna od najlepszej w dol. */
  readonly bids: readonly DepthRow[];
  /** Roznica miedzy najlepsza sprzedaza a kupnem; brak, gdy jedna strona jest pusta. */
  readonly spread: string | null;
}

/** Arkusz jak na terminalu maklerskim: sprzedaz nad kupnem, spotykaja sie przy spreadzie. */
export function depth(bids: readonly BookLevel[], asks: readonly BookLevel[]): Depth {
  const max = Math.max(1, ...bids.map((l) => l.quantity), ...asks.map((l) => l.quantity));
  const row = (l: BookLevel): DepthRow => ({ price: price(l.price), quantity: count(l.quantity), share: l.quantity / max });
  const bestBid = bids[0];
  const bestAsk = asks[0];
  return {
    asks: asks.map(row).reverse(),
    bids: bids.map(row),
    spread: bestBid && bestAsk ? price(bestAsk.price - bestBid.price) : null,
  };
}

export interface TapeRow {
  readonly key: number;
  readonly price: string;
  readonly quantity: string;
  readonly side: "kupno" | "sprzedaz";
}

/** Tasma transakcji, najnowsza na gorze. Strona to agresor: kupno = ktos kupil z oferty sprzedazy. */
export function tape(prints: readonly Print[]): TapeRow[] {
  return [...prints].reverse().map((p) => ({ key: p.seq, price: price(p.price), quantity: count(p.quantity), side: p.side === "BUY" ? "kupno" : "sprzedaz" }));
}

export interface Fact {
  readonly label: string;
  readonly value: string;
  /** Do pokolorowania: dodatnie na zielono, ujemne na czerwono, bez kierunku na neutralnie. */
  readonly sign: 1 | 0 | -1;
}

const signOf = (x: number): 1 | 0 | -1 => (x > 0 ? 1 : x < 0 ? -1 : 0);

/** Kurs wzgledem wartosci godziwej: "12,50% ponizej", "w cenie" przy roznicy ponizej 0,5%. */
export function valuation(last: number, fair: number): Fact {
  const gap = last / fair - 1;
  if (Math.abs(gap) < 0.005) return { label: "Kurs do wyceny", value: "w cenie", sign: 0 };
  const text = change(Math.abs(gap)).replace("+", "");
  // tanio wzgledem wyceny to szansa dla kupujacego, wiec "ponizej" jest na zielono
  return gap < 0 ? { label: "Kurs do wyceny", value: `${text} poniżej`, sign: 1 } : { label: "Kurs do wyceny", value: `${text} powyżej`, sign: -1 };
}

/** Fundamenty spolki do siatki w panelu. */
export function facts(company: CompanyView, f: Fundamentals): Fact[] {
  return [
    { label: "Wartość godziwa", value: price(company.fair), sign: 0 },
    valuation(company.price, company.fair),
    { label: "Kapitalizacja", value: money(f.marketCap), sign: 0 },
    { label: "C/Z", value: f.pe === null ? "—" : f.pe.toFixed(1).replace(".", ","), sign: 0 },
    { label: "Zysk roczny (tempo)", value: money(f.earningsYear), sign: signOf(f.earningsYear) },
    { label: "Ostatni kwartał", value: money(f.lastQuarter), sign: signOf(f.lastQuarter) },
    { label: "Gotówka", value: money(f.cash), sign: f.cash < 0 ? -1 : 0 },
    { label: "Dług", value: f.debt === 0 ? "brak" : money(f.debt), sign: 0 },
  ];
}

const PLANT: Partial<Record<Ticker, string>> = { RUD: "kopalnia", STW: "huta", MTK: "fabryka", BPT: "port", KSZ: "sklepy" };

/** Stan zakladu z dzisiejszej produkcji; bank nie ma zakladu, wiec dla niego null. */
export function plant(ticker: Ticker, output: number): string | null {
  const what = PLANT[ticker];
  if (!what) return null;
  return output <= 0 ? `${what} stoi` : `${what}: ${String(Math.round(output * 100))}% mocy`;
}

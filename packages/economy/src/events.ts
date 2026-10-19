import type { Ticker } from "./companies.js";

/**
 * Zdarzenia w miasteczku. Kazde zmienia gospodarke (efekt na kilka dni) i trafia do wiadomosci,
 * na ktore reaguja inwestorzy — kurs rusza sie wiec dwa razy: od razu na newsie i potem,
 * gdy zdarzenie naprawde przelozy sie na zyski.
 */
export type EventKind =
  | "STRAJK" // stoi produkcja spolki
  | "WYPADEK" // kopalnia na 30% mocy
  | "ZLOZE" // nowe zloze: kopalnia na stale +20%
  | "ENERGIA" // drozszy wegiel dla huty
  | "ZAMOWIENIE" // duzy kontrakt na maszyny
  | "AWARIA" // fabryka na pol gwizdka
  | "SZTORM" // statki nie wplywaja do portu
  | "NASTROJE" // mieszkancy wydaja mniej
  | "ZLE_DLUGI" // bank spisuje czesc kredytow
  | "STOPY" // decyzja banku centralnego (size = zmiana w punktach bazowych)
  | "SWIETA"; // sezon zakupow

export interface EconomicEvent {
  readonly kind: EventKind;
  readonly ticker?: Ticker;
  readonly days: number;
  /** STOPY: zmiana stopy w punktach bazowych. */
  readonly size?: number;
}

/** Aktywny efekt zdarzenia na gospodarke. Mnozniki: 1 = bez zmian. */
export interface Effect {
  readonly kind: EventKind;
  readonly ticker?: Ticker;
  /** Pierwszy dzien, w ktorym efekt juz nie dziala. */
  readonly until: number;
  readonly capacity?: number;
  readonly demand?: number;
  readonly coal?: number;
  readonly shipsBlocked?: boolean;
  readonly confidence?: number;
  /** Premia cenowa od kazdej wyprodukowanej maszyny (0,1 = +10%) — kontrakt po lepszej cenie. */
  readonly premium?: number;
}

export interface News {
  readonly day: number;
  readonly kind: EventKind | "WYNIKI";
  readonly headline: string;
  /** Wydzwiek dla kazdej spolki, ktorej dotyczy: od -1 (bardzo zle) do +1 (bardzo dobrze). */
  readonly impacts: Partial<Record<Ticker, number>>;
  /** Waga wiadomosci 0..1 — jak mocno ruszy graczy na newsach. */
  readonly weight: number;
}

/** Szansa na zdarzenie danego dnia i zakres jego dlugosci. */
export interface Hazard {
  readonly kind: EventKind;
  /** Kazde losowe zdarzenie dotyczy jakiejs spolki (stopy i swieta nie sa losowane z tej listy). */
  readonly ticker: Ticker;
  readonly perDay: number;
  readonly days: readonly [number, number];
}

export const HAZARDS: readonly Hazard[] = [
  { kind: "STRAJK", ticker: "RUD", perDay: 0.006, days: [8, 20] },
  { kind: "STRAJK", ticker: "STW", perDay: 0.003, days: [6, 14] },
  { kind: "STRAJK", ticker: "MTK", perDay: 0.003, days: [6, 14] },
  { kind: "WYPADEK", ticker: "RUD", perDay: 0.003, days: [10, 25] },
  { kind: "ZLOZE", ticker: "RUD", perDay: 0.0015, days: [1, 1] },
  { kind: "ENERGIA", ticker: "STW", perDay: 0.004, days: [20, 40] },
  { kind: "ZAMOWIENIE", ticker: "MTK", perDay: 0.006, days: [15, 30] },
  { kind: "AWARIA", ticker: "MTK", perDay: 0.004, days: [5, 12] },
  { kind: "SZTORM", ticker: "BPT", perDay: 0.008, days: [4, 10] },
  { kind: "NASTROJE", ticker: "KSZ", perDay: 0.003, days: [25, 40] },
  { kind: "ZLE_DLUGI", ticker: "GRS", perDay: 0.002, days: [1, 1] },
];

/** Kto ucierpi (albo zyska) poslednio, gdy dana spolka stanie: odbiorcy z lancucha dostaw. */
const DOWNSTREAM: Partial<Record<Ticker, Partial<Record<Ticker, number>>>> = {
  RUD: { STW: -0.3, MTK: -0.1 },
  STW: { MTK: -0.3, BPT: -0.1 },
  MTK: { BPT: -0.15, STW: -0.15 },
};

const NAMES: Record<Ticker, string> = {
  RUD: "kopalni Rudawa",
  STW: "hucie Stalwar",
  MTK: "fabryce Motorek",
  BPT: "Bałtporcie",
  KSZ: "sieci Koszyk",
  GRS: "banku Grosz",
};

/** Efekt zdarzenia na gospodarke (bez decyzji o stopach i jednorazowych odpisow — te liczy gospodarka). */
export function effectOf(event: EconomicEvent, day: number): Effect | undefined {
  const until = day + event.days;
  const base = { kind: event.kind, until, ...(event.ticker ? { ticker: event.ticker } : {}) };
  switch (event.kind) {
    case "STRAJK":
      return { ...base, capacity: 0 };
    case "WYPADEK":
      return { ...base, capacity: 0.3 };
    case "ZLOZE":
      return { ...base, until: Number.POSITIVE_INFINITY, capacity: 1.2 };
    case "ENERGIA":
      return { ...base, coal: 1.6 };
    case "ZAMOWIENIE":
      return { ...base, demand: 1.6, premium: 0.1 };
    case "AWARIA":
      return { ...base, capacity: 0.5 };
    case "SZTORM":
      return { ...base, shipsBlocked: true };
    case "NASTROJE":
      return { ...base, confidence: 0.85 };
    case "SWIETA":
      return { ...base, confidence: 1.35 };
    case "ZLE_DLUGI":
    case "STOPY":
      return undefined;
  }
}

/** Wiadomosc o zdarzeniu. `rateBp` — stopa po decyzji (dla STOPY). */
export function newsOf(event: EconomicEvent, day: number, rateBp: number): News {
  const t = event.ticker;
  const at = t ? NAMES[t] : "";
  const own = (s: number, downstream = true): Partial<Record<Ticker, number>> =>
    t ? { ...(downstream ? DOWNSTREAM[t] : {}), [t]: s } : {};
  const n = (headline: string, impacts: Partial<Record<Ticker, number>>, weight: number): News => ({
    day, kind: event.kind, headline, impacts, weight,
  });
  switch (event.kind) {
    case "STRAJK":
      return n(`Strajk w ${at} — produkcja stoi`, own(-0.8), 0.9);
    case "WYPADEK":
      return n(`Wypadek w ${at}: wydobycie spada do 30%`, own(-0.7), 0.8);
    case "ZLOZE":
      return n(`Nowe złoże przy ${at}: wydobycie +20% na stałe`, own(0.7, false), 0.8);
    case "ENERGIA":
      return n("Węgiel drożeje o 60% — huta Stalwar pod presją kosztów", { STW: -0.6, MTK: -0.1 }, 0.7);
    case "ZAMOWIENIE":
      return n("Fabryka Motorek dostaje duży kontrakt eksportowy po lepszej cenie", { MTK: 0.7, STW: 0.25, BPT: 0.15 }, 0.8);
    case "AWARIA":
      return n(`Awaria linii w ${at}: produkcja o połowę mniejsza`, own(-0.5), 0.6);
    case "SZTORM":
      return n("Sztorm na Bałtyku — statki nie wpływają do portu", { BPT: -0.5, STW: -0.15, MTK: -0.15 }, 0.7);
    case "NASTROJE":
      return n("Mieszkańcy zaciskają pasa — spada sprzedaż w sklepach", { KSZ: -0.6, GRS: -0.1 }, 0.6);
    case "SWIETA":
      return n("Rusza świąteczny sezon zakupów", { KSZ: 0.6 }, 0.5);
    case "ZLE_DLUGI":
      return n("Bank Grosz spisuje w straty część kredytów", { GRS: -0.7 }, 0.7);
    case "STOPY": {
      const size = event.size ?? 0;
      const rate = (rateBp / 100).toFixed(2).replace(".", ",");
      if (size === 0) return n(`Bank centralny utrzymuje stopy: ${rate}%`, {}, 0.1);
      const verb = size > 0 ? "podnosi" : "obniża";
      const s = Math.max(-1, Math.min(1, -size / 50));
      return n(`Bank centralny ${verb} stopy do ${rate}%`, { RUD: s, STW: s, MTK: s, BPT: s, KSZ: s, GRS: s * 0.6 }, 0.8);
    }
  }
}

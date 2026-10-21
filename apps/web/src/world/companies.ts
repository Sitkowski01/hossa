import type { Ticker } from "@hossa/economy";

/**
 * Szesc spolek w kolejnosci tablicy notowan. Kopia listy z gospodarki, bo poza workerem wolno
 * brac z niej tylko typy (zeby kod symulacji nie trafil do watku strony). Kompilator pilnuje,
 * ze kopia jest pelna: brak spolki albo literowka to blad typow ponizej.
 */
export const TICKERS = ["RUD", "STW", "MTK", "BPT", "KSZ", "GRS"] as const satisfies readonly Ticker[];

type Assert<T extends true> = T;
export type TickersComplete = Assert<[Exclude<Ticker, (typeof TICKERS)[number]>] extends [never] ? true : false>;

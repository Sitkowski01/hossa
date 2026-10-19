/**
 * Szesc spolek miasteczka. Lancuch dostaw: kopalnia -> huta -> fabryka -> port (eksport),
 * a pensje z calego miasta wracaja do sieci sklepow. Bank pozycza wszystkim.
 *
 * Kwoty w groszach (liczby calkowite), ilosci towarow w tonach albo sztukach, czas w dniach.
 */

export type Ticker = "RUD" | "STW" | "MTK" | "BPT" | "KSZ" | "GRS";
export const TICKERS: readonly Ticker[] = ["RUD", "STW", "MTK", "BPT", "KSZ", "GRS"];

/** Zlotowki na grosze. */
export const zl = (amount: number): number => Math.round(amount * 100);

export interface CompanyInfo {
  readonly ticker: Ticker;
  readonly name: string;
  readonly shares: number;
  /** Premia za ryzyko akcji — im wieksza, tym nizszy mnoznik zysku. */
  readonly premium: number;
  /** Koszty stale dziennie (grosze); czesc to pensje, ktore trafiaja do mieszkancow. */
  readonly fixedCost: number;
  readonly wageShare: number;
  /** Dlug w banku na start (grosze). */
  readonly debt: number;
}

export const COMPANIES: Readonly<Record<Ticker, CompanyInfo>> = {
  RUD: { ticker: "RUD", name: "Kopalnia Rudawa", shares: 10_000_000, premium: 0.08, fixedCost: zl(180_000), wageShare: 0.7, debt: zl(200_000_000) },
  STW: { ticker: "STW", name: "Huta Stalwar", shares: 20_000_000, premium: 0.07, fixedCost: zl(150_000), wageShare: 0.6, debt: zl(300_000_000) },
  MTK: { ticker: "MTK", name: "Fabryka Motorek", shares: 30_000_000, premium: 0.06, fixedCost: zl(600_000), wageShare: 0.6, debt: zl(400_000_000) },
  BPT: { ticker: "BPT", name: "Bałtport", shares: 5_000_000, premium: 0.05, fixedCost: zl(80_000), wageShare: 0.5, debt: zl(120_000_000) },
  KSZ: { ticker: "KSZ", name: "Sieć Koszyk", shares: 4_000_000, premium: 0.05, fixedCost: zl(100_000), wageShare: 0.6, debt: zl(100_000_000) },
  GRS: { ticker: "GRS", name: "Bank Grosz", shares: 4_000_000, premium: 0.06, fixedCost: zl(50_000), wageShare: 0.6, debt: 0 },
};

/** Parametry produkcji i cen — jedno miejsce, zeby gospodarke dalo sie stroic bez szukania po kodzie. */
export const TECH = {
  oreCapacity: 1000, // t rudy dziennie
  orePrice: zl(400), // za tone, huta placi kopalni
  oreVariable: zl(50),
  mineYard: 10_000, // pojemnosc zwalow kopalni — pelne, to wydobycie staje
  steelCapacity: 625, // t stali dziennie (tyle, ile przerobi rudy z jednego dnia wydobycia)
  orePerSteel: 1.6,
  coalPerSteel: zl(300), // koszt wegla na tone stali (razy mnoznik cen energii)
  steelVariable: zl(100),
  steelPriceDomestic: zl(2000), // fabryka placi hucie
  steelPriceExport: zl(1900),
  machineCapacity: 200, // szt. dziennie
  steelPerMachine: 1.2,
  machineVariable: zl(4000),
  machinePrice: zl(15_000),
  machineDemand: 180, // zamowien dziennie
  truckOre: 1200, // t rudy na dzien (kopalnia -> huta)
  millOreYard: 6000, // pojemnosc placu rudy przy hucie: ok. 6 dni pracy
  truckSteel: 700, // t stali na dzien (huta -> fabryka i port)
  shipEvery: 5, // statek co tyle dni
  portFeeSteel: zl(60), // oplata portowa za tone
  portFeeMachine: zl(800), // za sztuke
  stormCost: zl(30_000), // dziennie: postoj statkow na redzie w czasie sztormu, placi port
  propensity: 0.9, // jaka czesc dochodu mieszkancy wydaja w sklepach
  retailMargin: 0.25, // marza sieci sklepow; reszta to towar z importu
  importPortFee: 0.02, // od wartosci importu, dla portu
  bankSpreadBp: 300, // marza banku ponad stope (punkty bazowe)
  depositShare: 0.7, // jaka czesc kredytow bank finansuje lokatami mieszkancow
  badLoans: 0.0025, // odpis zlych dlugow: czesc portfela kredytow
  payout: 0.8, // czesc zysku kwartalnego wyplacana jako dywidenda
  localOwnership: 0.3, // jaka czesc akcji maja mieszkancy miasteczka (reszta to inwestorzy z zewnatrz)
  daysPerQuarter: 90,
  daysPerYear: 360,
} as const;

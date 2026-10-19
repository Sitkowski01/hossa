import type { Ticker } from "./companies.js";

/**
 * Konta w ksiedze: szesc spolek, mieszkancy (HH) i reszta swiata (SWIAT: eksport, import,
 * wegiel, dostawcy). Kazdy przeplyw pieniadza to przelew miedzy dwoma kontami, wiec suma
 * wszystkich sald jest stala — pieniadz nie powstaje ani nie znika po drodze.
 */
export type Account = Ticker | "HH" | "SWIAT";

export class Ledger {
  private readonly balances = new Map<Account, number>();
  /** Wplywy na konto od poczatku biezacego dnia — do liczenia dochodu mieszkancow. */
  private readonly inflowToday = new Map<Account, number>();

  constructor(opening: Partial<Record<Account, number>>) {
    for (const [account, amount] of Object.entries(opening) as [Account, number][]) {
      this.balances.set(account, amount);
    }
  }

  balance(account: Account): number {
    return this.balances.get(account) ?? 0;
  }

  /** Przelew w groszach. Kwota zaokraglana do grosza; ujemnych przelewow nie ma — odwraca sie strony. */
  transfer(from: Account, to: Account, amount: number): void {
    const grosze = Math.round(amount);
    if (!Number.isFinite(grosze) || grosze < 0) {
      throw new RangeError(`transfer must be a non-negative amount, was ${String(amount)}`);
    }
    if (grosze === 0 || from === to) return;
    this.balances.set(from, this.balance(from) - grosze);
    this.balances.set(to, this.balance(to) + grosze);
    this.inflowToday.set(to, (this.inflowToday.get(to) ?? 0) + grosze);
  }

  inflow(account: Account): number {
    return this.inflowToday.get(account) ?? 0;
  }

  startDay(): void {
    this.inflowToday.clear();
  }

  /** Suma wszystkich sald — stala przez cala symulacje. */
  total(): number {
    let sum = 0;
    for (const v of this.balances.values()) sum += v;
    return sum;
  }
}

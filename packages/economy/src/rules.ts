import { COMPANIES, TECH, zl, type Ticker } from "./companies.js";
import type { EconomicEvent, EventKind, Hazard, News } from "./events.js";
import type { Rng } from "./rng.js";

/**
 * Reguly gospodarki jako czyste funkcje: bez stanu, wiec da sie je sprawdzic tabela przypadkow,
 * a nie tylko posrednio przez caly przebieg miasteczka.
 */

/**
 * Losuje zdarzenia dnia. Dla kazdego zagrozenia zawsze dwa losowania (czy wystapi, ile potrwa),
 * niezaleznie od stanu — dzieki temu przebiegi z i bez recznie wstrzyknietego zdarzenia zostaja
 * zsynchronizowane. Zdarzenie, ktore juz trwa, nie zaczyna sie drugi raz (poza nowym zlozem).
 */
export function rollHazards(
  hazards: readonly Hazard[],
  rng: Pick<Rng, "chance" | "int">,
  isActive: (kind: EventKind, ticker: Ticker) => boolean,
): EconomicEvent[] {
  const events: EconomicEvent[] = [];
  for (const h of hazards) {
    const hit = rng.chance(h.perDay);
    const days = rng.int(h.days[0], h.days[1]);
    if (hit && (h.kind === "ZLOZE" || !isActive(h.kind, h.ticker))) events.push({ kind: h.kind, ticker: h.ticker, days });
  }
  return events;
}

/** Cel banku centralnego: 5% (500 punktow bazowych). */
export const TARGET_RATE_BP = 500;

/**
 * Decyzja banku centralnego w punktach bazowych, krokami po 25, najwyzej o 50 naraz.
 * Im dalej stopa od celu, tym silniej ciagnie w jego strone; `u` (0..1) to losowy czynnik.
 */
export function rateDecision(rateBp: number, u: number): number {
  const raw = (TARGET_RATE_BP - rateBp) * 0.3 + (u - 0.5) * 100;
  return Math.max(-50, Math.min(50, Math.round(raw / 25) * 25));
}

/** Nowa stopa po decyzji, w granicach 1–15%. */
export const applyRate = (rateBp: number, change: number): number => Math.max(100, Math.min(1500, rateBp + change));

/**
 * Wiadomosc o wynikach kwartalnych. Niespodzianka liczona wzgledem oczekiwan, ale przy bardzo
 * malych oczekiwaniach dzielimy przez co najmniej 1 mln zl — inaczej zysk 2 mln zamiast 0,1 mln
 * dawalby „+1900%” i rynek by oszalal.
 */
export function quarterNews(t: Ticker, day: number, profit: number, expected: number, oneOff = 0): News {
  // Niespodzianka bez strat jednorazowych (np. odpisu zlych dlugow) — rynek dowiedzial sie o nich
  // w dniu zdarzenia; liczenie ich drugi raz w raporcie ukaraloby spolke podwojnie.
  const surprise = (profit + oneOff - expected) / Math.max(Math.abs(expected), zl(1_000_000));
  const mln = (profit / 100 / 1_000_000).toFixed(1).replace(".", ",");
  const pct = Math.round(surprise * 100);
  const quarter = ((Math.round(day / TECH.daysPerQuarter) - 1) % 4) + 1; // kwartal w roku: 1–4
  return {
    day,
    kind: "WYNIKI",
    headline: `${COMPANIES[t].name}: zysk za ${String(quarter)}. kwartał ${mln} mln zł (${pct >= 0 ? "+" : ""}${String(pct)}% wobec oczekiwań)`,
    impacts: { [t]: Math.max(-1, Math.min(1, surprise * 2)) },
    weight: 0.6,
  };
}

/** Dywidenda za kwartal: czesc zysku; strata nie daje dywidendy. */
export const dividend = (profit: number): number => (profit > 0 ? Math.round(profit * TECH.payout) : 0);

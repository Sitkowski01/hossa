/**
 * Zlecenia i zdarzenia arkusza — port domeny Parkietu (mini-exchange, Java) 1:1.
 *
 * Ceny sa w groszach jako liczby calkowite, nigdy ulamki: 0.1 + 0.2 !== 0.3 w arytmetyce
 * zmiennoprzecinkowej, a gielda nie moze sie mylic o grosz. Zamiana na zlotowki dzieje sie
 * dopiero przy wyswietlaniu.
 */

export type Side = "BUY" | "SELL";

/**
 * LIMIT ma cene graniczna i to, czego nie da sie od razu skojarzyc, czeka w arkuszu.
 * MARKET bierze to, co jest w arkuszu, a reszte anuluje — nigdy w nim nie zostaje.
 */
export type OrderType = "LIMIT" | "MARKET";

/** Gorna granica ceny: 10 mln zl, jak w Parkiecie. */
export const MAX_PRICE = 1_000_000_000;

/**
 * Gorna granica wielkosci zlecenia — CELOWO mniejsza niz w Parkiecie (tam 1 mld).
 * Java liczy na long (do 9,2e18), a JavaScript na number, dokladnym tylko do 2^53 (~9e15).
 * Przy milionie akcji obrot jednego zlecenia (cena x ilosc) to najwyzej 1e15 — wciaz dokladnie.
 */
export const MAX_QUANTITY = 1_000_000;

export interface OrderRequest {
  /** Nadawany przez silnik, dodatni i scisle rosnacy — wyznacza kolejnosc w czasie. */
  readonly id: number;
  readonly side: Side;
  readonly type: OrderType;
  /** Cena graniczna w groszach; dla MARKET zawsze 0. */
  readonly price: number;
  /** Liczba akcji, od 1 do MAX_QUANTITY. */
  readonly quantity: number;
}

export function orderRequest(id: number, side: Side, type: OrderType, price: number, quantity: number): OrderRequest {
  return validate({ id, side, type, price, quantity });
}

/**
 * Sprawdza zlecenie i zwraca je bez zmian. W Javie robi to konstruktor rekordu i zamkniete enumy;
 * tu typy znikaja po kompilacji, a zlecenia przychodza tez z JSON-a i z Web Workera — wiec arkusz
 * sprawdza kazde zlecenie sam, zamiast ufac, ze ktos zbudowal je przez orderRequest().
 */
export function validate(order: OrderRequest): OrderRequest {
  const { id, side, type, price, quantity } = order;
  if ((side as string) !== "BUY" && (side as string) !== "SELL") {
    throw new RangeError(`side must be BUY or SELL, was ${side as string}`);
  }
  if ((type as string) !== "LIMIT" && (type as string) !== "MARKET") {
    throw new RangeError(`type must be LIMIT or MARKET, was ${type as string}`);
  }
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new RangeError(`id must be a positive integer, was ${String(id)}`);
  }
  if (!Number.isSafeInteger(quantity) || quantity <= 0 || quantity > MAX_QUANTITY) {
    throw new RangeError(`quantity must be an integer between 1 and ${String(MAX_QUANTITY)}, was ${String(quantity)}`);
  }
  if (!Number.isSafeInteger(price) || price > MAX_PRICE) {
    throw new RangeError(`price must be an integer of at most ${String(MAX_PRICE)}, was ${String(price)}`);
  }
  if (type === "LIMIT" && price <= 0) {
    throw new RangeError(`limit price must be positive, was ${String(price)}`);
  }
  if (type === "MARKET" && price !== 0) {
    throw new RangeError(`market order has no price, was ${String(price)}`);
  }
  return order;
}

export const limit = (id: number, side: Side, price: number, quantity: number): OrderRequest =>
  orderRequest(id, side, "LIMIT", price, quantity);

export const market = (id: number, side: Side, quantity: number): OrderRequest =>
  orderRequest(id, side, "MARKET", 0, quantity);

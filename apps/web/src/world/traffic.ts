import type { Good } from "@hossa/economy";

/** Ile miesci jedna ciezarowka: tony rudy i stali albo sztuki maszyn. */
export const TRUCK_LOAD: Readonly<Record<Good, number>> = { ruda: 300, stal: 175, maszyny: 50 };
/** Wiecej ciezarowek na jednej trasie naraz robi z drogi korek, a nie pokazuje wiecej. */
export const MAX_TRUCKS = 4;

const FIRST_DEPARTURE = 0.05;
const LAST_DEPARTURE = 0.55;
/** Przejazd trwa taki ulamek dnia — ostatnia ciezarowka dojezdza przed polnoca gospodarki. */
const TRIP = 0.4;

/**
 * Dzisiejsza wysylka jako kolumna ciezarowek: ilu ich trzeba na ladunek (najwyzej MAX_TRUCKS)
 * i kiedy ruszaja (ulamki dnia, rowno od rana do wczesnego popoludnia).
 */
export function departures(good: Good, quantity: number): number[] {
  if (quantity <= 0) return [];
  const trucks = Math.min(MAX_TRUCKS, Math.ceil(quantity / TRUCK_LOAD[good]));
  if (trucks === 1) return [FIRST_DEPARTURE];
  return Array.from({ length: trucks }, (_, i) => FIRST_DEPARTURE + ((LAST_DEPARTURE - FIRST_DEPARTURE) * i) / (trucks - 1));
}

/** Postep (0..1) tych ciezarowek z dzisiejszej wysylki, ktore sa teraz w drodze. */
export function convoy(good: Good, quantity: number, dayFraction: number): number[] {
  return departures(good, quantity)
    .map((departs) => (dayFraction - departs) / TRIP)
    .filter((progress) => progress >= 0 && progress <= 1);
}

/** Gdzie jest statek: przy nabrzezu, w drodze albo na redzie (za falochronem, w sztorm tam czeka). */
export type ShipPhase = "przy_nabrzezu" | "wyplywa" | "wraca" | "na_redzie";

const smooth = (t: number): number => {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
};

/**
 * Odleglosc statku od nabrzeza: 0 = przy nabrzezu, 1 = na redzie. W dniu zaladunku dzwigi
 * pracuja rano, a statek odplywa po poludniu; nowy statek wplywa nastepnego ranka.
 */
export function shipOffset(phase: ShipPhase, dayFraction: number): number {
  switch (phase) {
    case "przy_nabrzezu":
      return 0;
    case "na_redzie":
      return 1;
    case "wyplywa":
      return smooth((dayFraction - 0.3) / 0.5);
    case "wraca":
      return 1 - smooth(dayFraction / 0.5);
  }
}

/**
 * Faza statku na kolejny dzien. Pilnuje ciaglosci: dzien zaczyna sie tam, gdzie skonczyl
 * poprzedni (na redzie po odplynieciu albo przeczekaniu sztormu, inaczej przy nabrzezu).
 */
export function nextShipPhase(previous: ShipPhase, storm: boolean, loaded: boolean): ShipPhase {
  const atSea = previous === "wyplywa" || previous === "na_redzie";
  if (storm) return atSea ? "na_redzie" : "wyplywa";
  if (atSea) return "wraca";
  return loaded ? "wyplywa" : "przy_nabrzezu";
}

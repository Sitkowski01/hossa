/** Dzien gospodarki zaczyna sie o swicie — wtedy ruszaja pierwsze ciezarowki. */
export const DAWN = 5;
export const DUSK = 21;
const NOON_ELEVATION = 58;
const MIDNIGHT_ELEVATION = -24;

/** Godzina na zegarze miasteczka (0..24) dla ulamka dnia gospodarki. */
export const hourOf = (dayFraction: number): number => (DAWN + 24 * dayFraction) % 24;

export interface Daylight {
  readonly hour: number;
  /** Wysokosc slonca nad horyzontem w stopniach (ujemna w nocy). */
  readonly elevation: number;
  /** Kierunek do slonca w osiach three.js (x na wschod, y w gore, z na poludnie), jednostkowy. */
  readonly sun: readonly [number, number, number];
  /** 0 = noc, 1 = pelny dzien; plynnie o swicie i zmierzchu — do mieszania swiatel. */
  readonly day: number;
  /** Latarnie i okna swieca. */
  readonly lampsOn: boolean;
}

const smooth = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * Slonce na niebie o danej godzinie: wschodzi na wschodzie o swicie, w poludnie stoi na poludniu
 * na 58°, zachodzi na zachodzie o zmierzchu. Noc jest krotsza niz dzien, zeby makieta
 * przez wiekszosc czasu byla widoczna.
 */
export function daylight(hour: number): Daylight {
  const dayLength = DUSK - DAWN;
  const isDay = hour >= DAWN && hour <= DUSK;
  const elevation = isDay
    ? NOON_ELEVATION * Math.sin((Math.PI * (hour - DAWN)) / dayLength)
    : MIDNIGHT_ELEVATION * Math.sin((Math.PI * ((hour - DUSK + 24) % 24)) / (24 - dayLength));
  // azymut od polnocy zgodnie z zegarem: 90° wschod, 180° poludnie, 270° zachod
  const azimuth = isDay ? 90 + (180 * (hour - DAWN)) / dayLength : 270 + (180 * ((hour - DUSK + 24) % 24)) / (24 - dayLength);
  const el = (elevation * Math.PI) / 180;
  const az = (azimuth * Math.PI) / 180;
  return {
    hour,
    elevation,
    sun: [Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)],
    day: smooth(-6, 10, elevation),
    lampsOn: elevation < 4,
  };
}

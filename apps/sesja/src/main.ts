/**
 * Sesja w terminalu: gospodarka miasteczka i gielda bez grafiki.
 *
 *   pnpm sesja --seed 42 --dni 180
 *
 * Wypisuje wiadomosci z miasteczka i co tydzien kursy na tle wartosci godziwej.
 * To samo ziarno zawsze daje te sama sesje.
 */
import { parseArgs } from "node:util";
import { COMPANIES, TICKERS } from "@hossa/economy";
import { Session } from "@hossa/market";

const { values } = parseArgs({
  // pnpm przekazuje separator "--" dalej; przyjmujemy oba zapisy: `pnpm sesja --seed 1` i `pnpm sesja -- --seed 1`
  args: process.argv.slice(2).filter((arg) => arg !== "--"),
  options: {
    seed: { type: "string", default: "42" },
    dni: { type: "string", default: "180" },
  },
});
const seed = Number(values.seed);
const days = Number(values.dni);
if (!Number.isInteger(seed) || !Number.isInteger(days) || days <= 0) {
  console.error("Użycie: pnpm sesja --seed <liczba całkowita> --dni <liczba dni > 0>");
  process.exit(1);
}

const zl = (grosze: number) => (grosze / 100).toFixed(2).replace(".", ",");
const pct = (x: number) => `${x >= 0 ? "+" : ""}${(x * 100).toFixed(1).replace(".", ",")}%`;

const session = new Session({ seed });
const open = Object.fromEntries(TICKERS.map((t) => [t, session.markets[t].last]));
console.log(`Hossa · ziarno ${String(seed)} · ${String(days)} dni\n`);

for (let d = 1; d <= days; d++) {
  session.runDays(1);
  for (const n of session.lastDay?.news ?? []) {
    if (n.weight >= 0.3) console.log(`dzień ${String(d).padStart(3)} · ${n.headline}`);
  }
  if (d % 7 === 0 || d === days) {
    const line = TICKERS.map((t) => `${t} ${zl(session.markets[t].last)} (wg ${zl(session.fairValue(t))})`).join("  ");
    console.log(`           indeks ${session.index().toFixed(0)}  ${line}`);
  }
}

console.log("\nSpółka              kurs    zmiana   obrót (akcje)");
for (const t of TICKERS) {
  const m = session.markets[t];
  const volume = m.candles.reduce((v, c) => v + c.volume, 0);
  console.log(`${COMPANIES[t].name.padEnd(18)} ${zl(m.last).padStart(7)}  ${pct(m.last / (open[t] ?? m.last) - 1).padStart(7)}   ${String(volume).padStart(9)}`);
}
console.log(`\nIndeks miasteczka: ${session.index().toFixed(1).replace(".", ",")} pkt (start 1000)`);

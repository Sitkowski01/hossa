/** Cena w groszach jako tekst w zlotych: 3340 -> "33,40 zł". Grosze to liczby calkowite, wiec bez bledow float. */
export function price(grosze: number): string {
  const sign = grosze < 0 ? "-" : "";
  const abs = Math.abs(Math.round(grosze));
  const zl = Math.floor(abs / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${sign}${zl},${String(abs % 100).padStart(2, "0")} zł`;
}

/** Zmiana procentowa ze znakiem, po polsku: 0.0123 -> "+1,23%", -0.5 -> "−50,00%". */
export function change(fraction: number): string {
  const pct = Math.round(fraction * 10_000) / 100;
  const sign = pct > 0 ? "+" : pct < 0 ? "−" : "";
  return `${sign}${Math.abs(pct).toFixed(2).replace(".", ",")}%`;
}

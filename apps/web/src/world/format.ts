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

/** Duza kwota w groszach w skrocie: 123_456_789_00 -> "1,23 mld zł", 4_560_000_00 -> "4,56 mln zł". */
export function money(grosze: number): string {
  const zl = grosze / 100;
  const abs = Math.abs(zl);
  // jednostka po zaokragleniu: 999 999,50 zl w tysiacach to "1000,00", wiec juz "1,00 mln zl"
  const below1000 = (unit: number, digits: number) => Number((abs / unit).toFixed(digits)) < 1000;
  const [value, unit, digits] = !below1000(1e6, 2)
    ? [zl / 1e9, " mld zł", 2]
    : !below1000(1e3, 2)
      ? [zl / 1e6, " mln zł", 2]
      : !below1000(1, 0)
        ? [zl / 1e3, " tys. zł", 2]
        : [zl, " zł", 0];
  // -0,40 zl to po zaokragleniu "-0": zero jest bez znaku
  const text = value.toFixed(digits).replace(".", ",").replace(/^-(?=0(,00)?$)/, "");
  return `${text.replace("-", "−")}${unit}`;
}

/** Kolor dla znaku liczby (wydzwiek wiadomosci, zysk): dodatnia zielona, ujemna czerwona. */
export function toneOf(x: number): "wzrost" | "spadek" | "" {
  return x > 0 ? "wzrost" : x < 0 ? "spadek" : "";
}

/** Liczba sztuk z odstepem tysiecy: 12500 -> "12 500". */
export function count(n: number): string {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/** Kierunek zgodny z tym, co pokazuje `change`: kolor nie moze byc zielony przy "0,00%". */
export function trend(fraction: number): "wzrost" | "spadek" | "" {
  const text = change(fraction);
  return text.startsWith("+") ? "wzrost" : text.startsWith("−") ? "spadek" : "";
}

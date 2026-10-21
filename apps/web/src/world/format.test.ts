import { describe, expect, it } from "vitest";
import { change, count, money, price, toneOf, trend } from "./format.js";

describe("price", () => {
  it("grosze na zlote z przecinkiem i dwoma miejscami", () => {
    expect(price(3340)).toBe("33,40 zł");
    expect(price(5)).toBe("0,05 zł");
    expect(price(0)).toBe("0,00 zł");
  });

  it("tysiace oddziela twarda spacja, a ujemne maja minus", () => {
    expect(price(123_456_789)).toBe("1 234 567,89 zł");
    expect(price(-1050)).toBe("-10,50 zł");
  });
});

describe("change", () => {
  it("procent ze znakiem i polskim przecinkiem", () => {
    expect(change(0.0123)).toBe("+1,23%");
    expect(change(-0.5)).toBe("−50,00%");
    expect(change(0)).toBe("0,00%");
  });

  it("zmiana ponizej setnej procenta to zero bez znaku", () => {
    expect(change(0.00004)).toBe("0,00%");
    expect(change(-0.00004)).toBe("0,00%");
  });
});

describe("money", () => {
  it("skraca do tysiecy, milionow i miliardow z dwoma miejscami", () => {
    expect(money(123_456_789_00)).toBe("123,46 mln zł");
    expect(money(1_230_000_000_00)).toBe("1,23 mld zł");
    expect(money(4_560_00)).toBe("4,56 tys. zł");
    expect(money(999_00)).toBe("999 zł");
    expect(money(1_000_00)).toBe("1,00 tys. zł");
    expect(money(1_000_000_00)).toBe("1,00 mln zł");
    expect(money(1_000_000_000_00)).toBe("1,00 mld zł");
  });

  it("strata ma minus typograficzny", () => {
    expect(money(-2_500_000_00)).toBe("−2,50 mln zł");
    expect(money(-50_00)).toBe("−50 zł");
  });

  it("jednostke wybiera po zaokragleniu, wiec nie ma 1000 tysiecy", () => {
    expect(money(99_960)).toBe("1,00 tys. zł");
    expect(money(99_940)).toBe("999 zł");
    expect(money(99_999_950)).toBe("1,00 mln zł");
    expect(money(99_999_999_900)).toBe("1,00 mld zł");
    expect(money(-99_999_950)).toBe("−1,00 mln zł");
    expect(money(999_994_00)).toBe("999,99 tys. zł");
  });

  it("zero po zaokragleniu nie ma znaku", () => {
    expect(money(-40)).toBe("0 zł");
    expect(money(-60)).toBe("−1 zł");
    expect(money(0)).toBe("0 zł");
  });
});

describe("toneOf", () => {
  it("kolor wedlug znaku, zero bez koloru", () => {
    expect(toneOf(0.001)).toBe("wzrost");
    expect(toneOf(-0.001)).toBe("spadek");
    expect(toneOf(0)).toBe("");
  });
});

describe("count", () => {
  it("oddziela tysiace spacja i zaokragla", () => {
    expect(count(12_500)).toBe("12 500");
    expect(count(999)).toBe("999");
    expect(count(1_234_567.4)).toBe("1 234 567");
  });
});

describe("trend", () => {
  it("kierunek tylko wtedy, gdy zmiana ma znak po zaokragleniu", () => {
    expect(trend(0.01)).toBe("wzrost");
    expect(trend(-0.01)).toBe("spadek");
    expect(trend(0.00004)).toBe("");
    expect(trend(-0.00004)).toBe("");
    expect(trend(0)).toBe("");
  });
});

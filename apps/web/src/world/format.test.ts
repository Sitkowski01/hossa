import { describe, expect, it } from "vitest";
import { change, price } from "./format.js";

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

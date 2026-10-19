import { describe, expect, it } from "vitest";
import { MAX_PRICE, MAX_QUANTITY, limit, market, orderRequest } from "./order.js";

describe("orderRequest", () => {
  it("builds a limit order", () => {
    expect(limit(1, "BUY", 10_050, 7)).toEqual({ id: 1, side: "BUY", type: "LIMIT", price: 10_050, quantity: 7 });
  });

  it("builds a market order with price 0", () => {
    expect(market(2, "SELL", 3)).toEqual({ id: 2, side: "SELL", type: "MARKET", price: 0, quantity: 3 });
  });

  it("accepts the boundary values", () => {
    expect(() => limit(1, "BUY", MAX_PRICE, MAX_QUANTITY)).not.toThrow();
    expect(() => limit(1, "BUY", 1, 1)).not.toThrow();
  });

  it.each([0, -1, 1.5, Number.NaN])("rejects id %s", (id) => {
    expect(() => limit(id, "BUY", 100, 1)).toThrow(/id must be a positive integer/);
  });

  it.each([0, -5, MAX_QUANTITY + 1, 2.5])("rejects quantity %s", (quantity) => {
    expect(() => limit(1, "BUY", 100, quantity)).toThrow(/quantity must be an integer between 1/);
  });

  it.each([MAX_PRICE + 1, 99.5, Number.POSITIVE_INFINITY])("rejects price %s", (price) => {
    expect(() => limit(1, "BUY", price, 1)).toThrow(/price must be an integer of at most/);
  });

  it.each([0, -100])("rejects non-positive limit price %s", (price) => {
    expect(() => limit(1, "SELL", price, 1)).toThrow(/limit price must be positive/);
  });

  it("rejects a market order with a price", () => {
    expect(() => orderRequest(1, "BUY", "MARKET", 100, 1)).toThrow(/market order has no price/);
  });
});

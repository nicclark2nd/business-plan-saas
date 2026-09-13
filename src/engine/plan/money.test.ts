import { describe, expect, it } from "vitest";
import { localeForCurrency, moneyFormatter } from "./money";

describe("money", () => {
  it("keeps AUD reading exactly as it always has", () => {
    // The guard on this whole change: an Australian plan must not move by a single character.
    expect(moneyFormatter("AUD")(2119240)).toBe("2,119,240");
    expect(moneyFormatter("AUD")(0)).toBe("0");
    expect(moneyFormatter("AUD")(-1500)).toBe("-1,500");
  });

  it("groups the four currencies en-AU was getting wrong", () => {
    expect(moneyFormatter("EUR")(2119240)).toBe("2.119.240");
    expect(moneyFormatter("IDR")(2119240)).toBe("2.119.240");
    expect(moneyFormatter("ZAR")(2119240)).toBe("2 119 240");
    // Lakh grouping — the one that changes what the number MEANS to the reader, not just how it looks.
    expect(moneyFormatter("INR")(2119240)).toBe("21,19,240");
  });

  it("leaves the nine comma-grouped currencies identical to each other", () => {
    const same = ["AUD", "NZD", "USD", "GBP", "CAD", "SGD", "PHP", "THB", "MYR"];
    for (const c of same) expect(moneyFormatter(c)(2119240)).toBe("2,119,240");
  });

  it("falls back to en-AU for an unknown, missing or malformed currency", () => {
    expect(localeForCurrency(null)).toBe("en-AU");
    expect(localeForCurrency(undefined)).toBe("en-AU");
    expect(localeForCurrency("")).toBe("en-AU");
    expect(localeForCurrency("XYZ")).toBe("en-AU");
    expect(moneyFormatter("XYZ")(2119240)).toBe("2,119,240");
  });

  it("reads a currency code whatever case or padding it arrives in", () => {
    expect(localeForCurrency("inr")).toBe("en-IN");
    expect(localeForCurrency("  eur  ")).toBe("de-DE");
  });

  it("rounds to whole units and survives rubbish", () => {
    expect(moneyFormatter("AUD")(1234.6)).toBe("1,235");
    expect(moneyFormatter("AUD")(NaN)).toBe("0");
    expect(moneyFormatter("AUD")(null)).toBe("0");
  });
});

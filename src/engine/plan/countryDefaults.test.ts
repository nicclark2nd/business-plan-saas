import { describe, it, expect } from "vitest";
import { COUNTRY_DEFAULTS, countryDefault, followCountry } from "./countryDefaults";
import { COUNTRIES, CURRENCIES } from "@/app/(app)/plans/[planId]/settings/model";

describe("what a country already answers (§6.151)", () => {
  it("covers every country the app offers except Other, with a currency the app offers", () => {
    for (const c of COUNTRIES.filter((c) => c !== "Other")) {
      const d = countryDefault(c);
      expect(d, c).not.toBeNull();
      expect(CURRENCIES).toContain(d!.currency);
    }
    expect(Object.keys(COUNTRY_DEFAULTS).length).toBe(COUNTRIES.length - 1);
  });
  it("moves both when they were still the old country's defaults", () => {
    expect(followCountry("Australia", "New Zealand", { currency: "AUD", tax_rate: 25 })).toEqual({ currency: "NZD", tax_rate: 28 });
  });
  it("keeps what the client chose on purpose", () => {
    expect(followCountry("Australia", "New Zealand", { currency: "USD", tax_rate: 30 })).toEqual({});
    expect(followCountry("Australia", "Thailand", { currency: "AUD", tax_rate: 22 })).toEqual({ currency: "THB" });
  });
  it("treats a plan with no country yet as holding the old generic defaults", () => {
    expect(followCountry(null, "United States", { currency: "AUD", tax_rate: 25 })).toEqual({ currency: "USD", tax_rate: 21 });
  });
  it("does nothing for Other, or for no change", () => {
    expect(followCountry("Australia", "Other", { currency: "AUD", tax_rate: 25 })).toEqual({});
    expect(followCountry("Australia", "Australia", { currency: "AUD", tax_rate: 25 })).toEqual({});
  });
});

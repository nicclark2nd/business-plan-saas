import { describe, it, expect } from "vitest";
import { taxLossesFromHistory, accumulatedProfit, openingTaxLosses } from "./opening";

const year = (period_number: number, net_profit_before_tax: number | null) => ({ period_number, net_profit_before_tax });

describe("tax losses read from the Historic years (§6.148)", () => {
  it("carries SEQ's latest-year loss, which no later year has used", () => {
    // Period 1 is the latest: 88k, 77k and 66k profits came BEFORE the 71k loss, so nothing has used it.
    const r = taxLossesFromHistory([year(1, -71000), year(2, 88235), year(3, 76565), year(4, 65882)]);
    expect(r).toEqual({ amount: 71000, from: [{ period: 1, amount: 71000 }], hadHistory: true });
  });
  it("uses a loss against the next profit, oldest loss first", () => {
    const r = taxLossesFromHistory([year(4, -50000), year(3, -30000), year(2, 60000), year(1, 5000)]);
    expect(r.from).toEqual([{ period: 3, amount: 15000 }]);
    expect(r.amount).toBe(15000);
  });
  it("is nil with no history, or when every loss has been used", () => {
    expect(taxLossesFromHistory([])).toEqual({ amount: 0, from: [], hadHistory: false });
    expect(taxLossesFromHistory([year(2, -10000), year(1, 40000)]).amount).toBe(0);
  });
  it("lets the accountant's figure stand in only when chosen", () => {
    const h = taxLossesFromHistory([year(1, -71000)]);
    expect(openingTaxLosses(h, { chosen: false, amount: 5 })).toBe(71000);
    expect(openingTaxLosses(h, { chosen: true, amount: 60000 })).toBe(60000);
    expect(openingTaxLosses(h, { chosen: true, amount: -3 })).toBe(0);
  });
});

describe("accumulated profit is equity less what the owners put in (§6.148)", () => {
  it("is nil with no history", () => expect(accumulatedProfit(null)).toEqual({ status: "no-history", amount: 0 }));
  it("is not guessed until share capital is given", () => {
    expect(accumulatedProfit({ equity: 250000, share_capital: null })).toEqual({ status: "needs-share-capital", amount: 0, equity: 250000 });
  });
  it("takes share capital off equity, and can be a deficit", () => {
    expect(accumulatedProfit({ equity: 250000, share_capital: 100 })).toMatchObject({ status: "ok", amount: 249900 });
    expect(accumulatedProfit({ equity: 150000, share_capital: 200000 })).toMatchObject({ status: "ok", amount: -50000 });
  });
});

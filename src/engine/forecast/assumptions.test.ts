import { describe, expect, it } from "vitest";
import {
  DEFAULT_DAYS, cashTimingSchedule, daysFromHistory, debtorBalance,
  serializeCashTiming, serializeWorkingCapital, workingCapitalSchedule,
} from "./assumptions";
import { FORECAST_YEARS } from "./model";

describe("forecast assumptions", () => {
  /** The fault this module exists to prevent: an unset grid read as zero is the most optimistic cash flow. */
  it("never silently returns zero days for an unset grid", () => {
    for (const stored of [null, undefined, {}, "nonsense", [], { "1": {} }]) {
      const s = workingCapitalSchedule(stored);
      for (const y of FORECAST_YEARS) expect(s[y], `${JSON.stringify(stored)} Y${y}`).toEqual(DEFAULT_DAYS);
    }
  });

  it("keeps a year the client has set and falls back only for the rest", () => {
    const s = workingCapitalSchedule({ "2": { debtorDays: 60, inventoryDays: 14, creditorDays: 45 } });
    expect(s[2]).toEqual({ debtorDays: 60, inventoryDays: 14, creditorDays: 45 });
    expect(s[1]).toEqual(DEFAULT_DAYS);
    expect(s[5]).toEqual(DEFAULT_DAYS);
  });

  it("treats an explicit zero as a real answer, not as missing", () => {
    const s = workingCapitalSchedule({ "1": { debtorDays: 0, inventoryDays: 0, creditorDays: 0 } });
    expect(s[1]).toEqual({ debtorDays: 0, inventoryDays: 0, creditorDays: 0 });
  });

  it("clamps rubbish rather than carrying it into the forecast", () => {
    const s = workingCapitalSchedule({ "1": { debtorDays: -10, inventoryDays: 99999, creditorDays: 30.6 } });
    expect(s[1]).toEqual({ debtorDays: 0, inventoryDays: 365, creditorDays: 31 });
    const t = cashTimingSchedule({ "1": { taxPaidPct: 140, prepaidClosing: -50, accruedClosing: 1234.567 } });
    expect(t[1].taxPaidPct).toBe(100);
    expect(t[1].prepaidClosing).toBe(0);
    expect(t[1].accruedClosing).toBe(1234.57);
  });

  it("reads the client's own days out of their history", () => {
    // 2,119,240 revenue with 261,378 in debtors is 45 days, near enough.
    expect(daysFromHistory({ revenue: 2119240, cogs: 500000, accounts_receivable: 261378, inventory_wip: 0, accounts_payable: 41096 }))
      .toEqual({ debtorDays: 45, inventoryDays: 0, creditorDays: 30 });
    expect(daysFromHistory(null)).toBeNull();
    expect(daysFromHistory({ revenue: 0 })).toBeNull();   // a startup has nothing to read
  });

  it("round-trips through jsonb with every year present", () => {
    const s = workingCapitalSchedule({ "3": { debtorDays: 21, inventoryDays: 7, creditorDays: 14 } });
    const round = workingCapitalSchedule(serializeWorkingCapital(s));
    expect(round).toEqual(s);
    expect(Object.keys(serializeWorkingCapital(s))).toEqual(["1", "2", "3", "4", "5"]);
    expect(Object.keys(serializeCashTiming(cashTimingSchedule(null)))).toEqual(["1", "2", "3", "4", "5"]);
  });

  it("says what a day is worth, because that is the number that gets it changed", () => {
    expect(debtorBalance(2119240, 45)).toBe(261276);
    expect(debtorBalance(2119240, 0)).toBe(0);
  });

  it("defaults tax to paid in the year it is charged", () => {
    const t = cashTimingSchedule(null);
    for (const y of FORECAST_YEARS) expect(t[y]).toEqual({ taxPaidPct: 100, prepaidClosing: 0, accruedClosing: 0 });
  });
});

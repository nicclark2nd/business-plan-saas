import { describe, it, expect } from "vitest";
import { enteredByYear, overheadByYear, overheadMonths, overheadsByYear, overheadsMonths, planOverheadLines, type Overhead } from "./expenses";

const rent: Overhead = { name: "Rent", source: "entered", current_value: 125000, yearly_change: { "1": 0, "2": 2, "3": 2, "4": 2, "5": 2 }, monthly_distribution: null, start_year: 1 };

describe("overheads", () => {
  it("grows a typed expense year on year, APeX-style", () => {
    expect(enteredByYear(rent)).toEqual([125000, 127500, 130050, 132651, 135304.02]);   // APeX Rent, to the cent
  });

  it("an expense that starts later is nothing before it, and rises only after its own first year", () => {
    const later = { ...rent, start_year: 3, current_value: 10000, yearly_change: { "3": 50, "4": 10, "5": 10 } };
    const y = enteredByYear(later);
    expect(y[0]).toBe(0); expect(y[1]).toBe(0);
    expect(y[2]).toBe(10000);            // its own first year, untouched by the 50 %
    expect(y[3]).toBe(11000);
  });

  it("takes a synced line as given and never grows it — the client set that figure elsewhere", () => {
    const marketing: Overhead = { name: "Marketing", source: "marketing", current_value: 0, yearly_change: { "1": 50, "2": 50 }, monthly_distribution: null };
    expect(overheadByYear(marketing, [5000, 5000, 8000, 8000, 8000])).toEqual([5000, 5000, 8000, 8000, 8000]);
  });

  it("splits Year 1 across the months and always adds to the year", () => {
    const m = overheadMonths(rent);
    expect(m.reduce((a, b) => a + b, 0)).toBe(125000);
    expect(m[0]).toBeCloseTo(125000 / 12, 2);
  });

  it("adds on-costs to the wage lines only, the People line included", () => {
    const wagesOther: Overhead = { name: "Wages — everyone else", source: "entered", current_value: 320000, yearly_change: {}, monthly_distribution: null, on_cost: true };
    const people: Overhead = { name: "Leadership Team salaries", source: "people", current_value: 0, monthly_distribution: null };
    const y = overheadsByYear([{ o: rent }, { o: wagesOther }, { o: people, synced: [215000, 218550, 222164, 225842, 229586] }], 11.5)[0];
    expect(y.wages).toBe(535000);                       // 320,000 + 215,000
    expect(y.onCosts).toBe(61525);                      // 11.5 % of the wages, not of the rent
    expect(y.other).toBe(125000);
    expect(y.total).toBe(535000 + 61525 + 125000);
  });

  it("no on-cost percentage means no on-costs, and the total is just the lines", () => {
    const y = overheadsByYear([{ o: rent }], 0)[0];
    expect(y.onCosts).toBe(0);
    expect(y.total).toBe(125000);
  });

  it("the twelve months reconcile to the year, on-costs included", () => {
    const wages: Overhead = { name: "Wages", source: "entered", current_value: 120000, yearly_change: {}, monthly_distribution: null, on_cost: true };
    const lines = [{ o: rent }, { o: wages }];
    const y = overheadsByYear(lines, 10)[0];
    expect(overheadsMonths(lines, 10).reduce((a, b) => a + b, 0)).toBeCloseTo(y.total, 2);
  });
});

describe("the lines a plan's overheads consist of", () => {
  const rent: Overhead = { name: "Rent", source: "entered", current_value: 125000, yearly_change: null, monthly_distribution: null, start_year: 1 };
  const salaries = [126000, 129780, 136269, 143082, 150237];
  const marketing = [14000, 14000, 14000, 14000, 14000];

  it("counts the Leadership Team and Marketing even when no row exists to hold them", () => {
    const lines = planOverheadLines([rent], salaries, marketing);
    expect(lines).toHaveLength(3);
    expect(overheadsByYear(lines, 11.5)[0].total).toBe(279490);       // 125,000 rent + 126,000 salaries + 14,490 on-costs + 14,000 marketing
  });

  it("does not count a synced line twice when its row does exist", () => {
    const stored: Overhead = { name: "Leadership Team salaries", source: "people", current_value: 0, yearly_change: null, monthly_distribution: null, on_cost: true };
    const lines = planOverheadLines([stored, rent], salaries, marketing);
    expect(lines).toHaveLength(3);
    expect(overheadsByYear(lines, 11.5)[0].total).toBe(279490);
  });

  it("splits the same total across the months, whether the rows exist or not", () => {
    const withoutRows = overheadsMonths(planOverheadLines([rent], salaries, marketing), 11.5);
    expect(withoutRows.reduce((a, b) => a + b, 0)).toBeCloseTo(279490, 1);
  });
});

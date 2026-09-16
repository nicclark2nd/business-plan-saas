/**
 * Break-even — what has to be sold before the business stops losing money (§6.49).
 *
 * Nothing here is a second reading of the plan. Every annual figure comes off `PnlYear`, which the forecast
 * has already built and reconciled, and the monthly figures come off the cash flow the forecast already
 * produced. Break-even is a lens on the forecast, not a model of its own, so it cannot disagree with the
 * profit and loss sitting one screen away.
 *
 * TWO break-evens, deliberately, because clients ask two different questions with the same words:
 *
 *   The year    — accrual. Fixed costs are overheads + fixed cost of sales + depreciation + interest, so
 *                 "break even" means covering everything, the bank included, down to profit before tax.
 *                 Depreciation belongs here: a lender reading the plan wants the asset base earning back.
 *   The months  — cash. Cumulative operating cash less interest paid. Depreciation drops out on its own
 *                 because it never moved any money, and money the OWNER puts in is excluded: an equity
 *                 injection in March is not the business breaking even, and neither is a new loan.
 *
 * They differ, and the screen says so rather than hiding it. The gap between them is working capital.
 */
import { recurring, type AnyProduct } from "../sales/product";
import { productCostYears, type CostProduct } from "../cogs/direct";

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const r2 = (v: number) => Math.round(v * 100) / 100;

/** Only the part of a year the break-even needs. Structural, so `PnlYear` satisfies it without conversion. */
export type ProfitYear = {
  revenue: number; variableCogs: number; fixedCogs: number;
  overheads: number; depreciation: number; interest: number;
};

export type BreakEvenYear = {
  year: number;
  revenue: number;
  variableCosts: number;
  fixedCogs: number; overheads: number; depreciation: number; interest: number;
  /** What must be covered before the first cent of profit: everything that does not move with volume. */
  fixedCosts: number;
  totalCosts: number;
  /** Revenue less variable costs — what each dollar of sales leaves behind to pay the fixed base. */
  contribution: number;
  /** Contribution as a share of revenue, 0–100. Null when there is no revenue to take a share of. */
  contributionRate: number | null;
  /**
   * The revenue at which profit is exactly nil: fixed costs ÷ the contribution rate. It needs no unit, which
   * is why it is the figure this module leads with. Null when contribution is nil or negative — at that
   * point there IS no break-even, because every additional sale loses money, and a number would be a lie.
   */
  breakEvenRevenue: number | null;
  /** Revenue above break-even. Negative is the shortfall. Null when there is no break-even to measure from. */
  headroom: number | null;
  /** Headroom as a share of revenue, 0–100: how far sales can fall before the plan stops paying for itself. */
  marginOfSafety: number | null;
};

export function breakEvenYear(year: number, p: ProfitYear): BreakEvenYear {
  const revenue = r2(num(p.revenue));
  const variableCosts = r2(num(p.variableCogs));
  const fixedCogs = r2(num(p.fixedCogs)), overheads = r2(num(p.overheads));
  const depreciation = r2(num(p.depreciation)), interest = r2(num(p.interest));
  const fixedCosts = r2(fixedCogs + overheads + depreciation + interest);
  const contribution = r2(revenue - variableCosts);
  const contributionRate = revenue > 0 ? r2((contribution / revenue) * 100) : null;
  // A business that loses money on every sale cannot sell its way out of it, however much volume it adds.
  const breakEvenRevenue = contributionRate !== null && contribution > 0
    ? r2(fixedCosts / (contribution / revenue))
    : null;
  const headroom = breakEvenRevenue === null ? null : r2(revenue - breakEvenRevenue);
  return {
    year, revenue, variableCosts, fixedCogs, overheads, depreciation, interest,
    fixedCosts, totalCosts: r2(variableCosts + fixedCosts),
    contribution, contributionRate, breakEvenRevenue, headroom,
    marginOfSafety: headroom === null || revenue <= 0 ? null : r2((headroom / revenue) * 100),
  };
}

export const breakEvenByYear = (pnl: Record<number, ProfitYear>, years: readonly number[] = [1, 2, 3, 4, 5]) =>
  years.map((y) => breakEvenYear(y, pnl[y]));

/**
 * Margin of safety bands. These are the conventional thresholds, not a reading of this business's own
 * history, and the screen labels them that way — a seasonal trade that routinely swings 30 % is not in
 * danger at 20 %, and a business on annual contracts is not safe at 26 %.
 */
export type Safety = "comfortable" | "tight" | "exposed" | "none";
export const safetyOf = (marginOfSafety: number | null): Safety =>
  marginOfSafety === null ? "none" : marginOfSafety >= 25 ? "comfortable" : marginOfSafety >= 10 ? "tight" : "exposed";

// ---------- by service ----------

/**
 * One line's own economics, in ITS own unit (§6.49.1).
 *
 * APeX divided total revenue by total units across every product to get one average selling price, then
 * divided the fixed base by the contribution on that average. Across a book holding a house slab and a foot
 * path that average describes nothing anyone can go and sell, and with an ongoing line it adds jobs to
 * client-months. So there is no blended unit here at all: each line is measured in what it is actually sold
 * in, and the only cross-line figure is break-even REVENUE, which needs no unit.
 */
export type ServiceUnit = "job" | "client";
export type ServiceBreakEven = {
  id: string; name: string;
  unit: ServiceUnit;
  /** Planned volume in the year: jobs for a one-off line, client-years for an ongoing one. */
  planned: number;
  price: number; cost: number; contribution: number;
  contributionRate: number | null;
  /**
   * How many of THIS line alone would carry the whole fixed base. A deliberate counterfactual — it is the
   * only per-line break-even that is true, because fixed costs cannot be split between lines without
   * inventing an allocation the client never agreed to.
   */
  aloneToBreakEven: number | null;
};

export function serviceBreakEven(
  products: (CostProduct & { id?: string; name?: string | null })[],
  fixedCosts: number,
  year = 1,
  sourceFor: (p: CostProduct) => AnyProduct | null = () => null,
): ServiceBreakEven[] {
  const out: ServiceBreakEven[] = [];
  for (const p of products) {
    const y = productCostYears(p, sourceFor(p))[year - 1];
    if (!y) continue;
    // An ongoing line is costed per client-YEAR and counted in client-months, so twelve of those is one unit.
    const unit: ServiceUnit = recurring(p) ? "client" : "job";
    // Divide by the volume UNROUNDED. 114.5 client-months is 9.5416 client-years, and dividing the year's
    // revenue by a 9.54 shown on screen prices the line at 24,004 instead of the 24,000 that was typed.
    const exact = unit === "client" ? y.volume / 12 : y.volume;
    if (exact <= 0) continue;                         // nothing planned this year: nothing to break even on
    const planned = r2(exact);
    const price = r2(y.revenue / exact), cost = r2(y.cost / exact);
    const contribution = r2(price - cost);
    out.push({
      id: String(p.id ?? ""), name: String(p.name ?? "").trim() || "Unnamed",
      unit, planned, price, cost, contribution,
      contributionRate: price > 0 ? r2((contribution / price) * 100) : null,
      aloneToBreakEven: contribution > 0 ? Math.ceil(num(fixedCosts) / contribution) : null,
    });
  }
  return out.sort((a, b) => b.contribution - a.contribution);
}

// ---------- the cash crossover ----------

/** Only the part of a month the crossover needs, so `MonthCash` satisfies it as it stands. */
export type CashMonth = { netOperating: number; interestPaid: number };

export type CashCrossover = {
  /** Cumulative operating cash less interest, month by month — the line the chart draws. */
  cumulative: number[];
  /** The first month it reaches nil or better. Null when the year never gets there. */
  month: number | null;
  /** True when it crosses and then falls back below later in the year — a crossing that did not hold. */
  fallsBack: boolean;
  /** The deepest point, and when. What the business has to fund before it turns. */
  lowest: { month: number; value: number };
};

export function cashCrossover(months: CashMonth[]): CashCrossover {
  const cumulative: number[] = [];
  let run = 0;
  for (const m of months) { run += num(m.netOperating) - num(m.interestPaid); cumulative.push(r2(run)); }
  const month = cumulative.findIndex((v) => v >= 0);
  const lowIndex = cumulative.reduce((best, v, i) => (v < cumulative[best] ? i : best), 0);
  return {
    cumulative,
    month: month === -1 ? null : month + 1,
    fallsBack: month !== -1 && cumulative.slice(month).some((v) => v < 0),
    lowest: { month: lowIndex + 1, value: cumulative.length ? cumulative[lowIndex] : 0 },
  };
}

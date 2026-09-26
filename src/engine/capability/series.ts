import { FORECAST_YEARS } from "@/engine/forecast/model";
import type { CapabilityInput, Metric } from "./model";
import { ebitda, over, r1, r2 } from "./model";
import { cashForDebtService, stressedCash } from "./borrow";
import { LENDER_MIN_DSCR, TRANSFER_FACTORS } from "./judgements";
import type { CapabilityKind } from "./verdict";

/**
 * THE SAME MEASURES, ACROSS THE FORECAST'S FIVE YEARS (§6.129.2).
 *
 * Every card on the capability tabs judges ONE year. That is right for a verdict and wrong for a picture:
 * a 1.4× cover that falls to 0.9× by Year 3 and a 1.4× that climbs to 2.1× are the same dial and opposite
 * stories. The dashboard this was modelled on put a small trend line on every card for exactly that reason,
 * and the plan already holds all five years — it was simply never asked.
 *
 * THE GUARDS TRAVEL WITH THE FORMULAS. Every ratio here that divides by earnings carries the §6.129.1 rule:
 * a year with no earnings is a GAP in the line, not a point. A sparkline that plotted −1.85× leverage in a
 * loss year would put the lie back on the card in miniature, beside the dial that had just stopped telling it.
 *
 * `capability.test.ts` holds each card's value against the point its trend marks, so the dial and the line
 * cannot drift into two answers to one question (§6.41).
 */

const Y = FORECAST_YEARS;
const rev = (i: CapabilityInput, y: number) => i.pnl[y]?.revenue ?? null;
const pctOf = (v: number | null) => (v === null ? null : r1(v * 100));

/** Year on year: four points from five years, each the step INTO the next year. */
const steps = <T,>(f: (y: number) => T) => Y.slice(0, -1).map(f);

export const series = {
  opMargin: (i: CapabilityInput) => Y.map((y) => {
    const p = i.pnl[y];
    return p && p.revenue ? over(p.operatingProfit, p.revenue) : null;
  }),
  growth: (i: CapabilityInput) => steps((y) => {
    const a = rev(i, y), b = rev(i, y + 1);
    return a && b !== null ? over(b - a, a) : null;
  }),
  incMargin: (i: CapabilityInput) => steps((y) => {
    const a = i.pnl[y], b = i.pnl[y + 1];
    if (!a || !b || b.revenue === a.revenue) return null;
    return over((b.revenue - b.cogs) - (a.revenue - a.cogs), b.revenue - a.revenue);
  }),
  cashCycle: (i: CapabilityInput) => Y.map((y) => {
    const d = i.days[y];
    return d ? d.inventoryDays + d.debtorDays - d.creditorDays : null;
  }),
  /* Earnings must be positive to be converted into anything (§6.129.1). */
  conversion: (i: CapabilityInput) => Y.map((y) => {
    const e = ebitda(i.pnl[y]), cf = i.cashFlow[y];
    return cf && e !== null && e > 0 ? over(cf.netOperating, e) : null;
  }),
  wcPerDollar: (i: CapabilityInput) => steps((y) => {
    const owc = (b = i.balanceSheet[y]) => b ? b.accountsReceivable + b.inventory - b.accountsPayable : null;
    const o1 = owc(i.balanceSheet[y]), o2 = owc(i.balanceSheet[y + 1]);
    const a = rev(i, y), b = rev(i, y + 1);
    return o1 !== null && o2 !== null && a !== null && b !== null && a !== b ? over(o2 - o1, b - a) : null;
  }),
  /* No debt is no cover to measure; no cash from trading is a cover of nil, never a negative one (§6.129.1). */
  dscr: (i: CapabilityInput) => Y.map((y) => {
    const s = i.debtService[y] ?? 0, base = cashForDebtService(i, y);
    if (!(s > 0) || base === null) return null;
    return base <= 0 ? 0 : over(base, s);
  }),
  dscrStressed: (i: CapabilityInput) => Y.map((y) => {
    const s = i.debtService[y] ?? 0, st = stressedCash(i, y);
    if (!(s > 0) || st === null) return null;
    return st <= 0 ? 0 : over(st, s);
  }),
  leverage: (i: CapabilityInput) => Y.map((y) => {
    const e = ebitda(i.pnl[y]), b = i.balanceSheet[y];
    return b && e !== null && e > 0 ? over(b.debtCurrent + b.debtNonCurrent - b.cash, e) : null;
  }),
  interestCover: (i: CapabilityInput) => Y.map((y) => {
    const p = i.pnl[y];
    if (!p || !(p.interest > 0)) return null;
    const v = over(p.operatingProfit, p.interest);
    return v === null ? null : Math.max(0, v);
  }),
  currentRatio: (i: CapabilityInput) => Y.map((y) => {
    const b = i.balanceSheet[y];
    return b ? over(b.currentAssets, b.currentLiabilities) : null;
  }),
  quickRatio: (i: CapabilityInput) => Y.map((y) => {
    const b = i.balanceSheet[y];
    return b ? over(b.cash + b.accountsReceivable, b.currentLiabilities) : null;
  }),
  runway: (i: CapabilityInput) => Y.map((y) => {
    const b = i.balanceSheet[y], cf = i.cashFlow[y];
    const out = cf ? Math.abs(cf.paidToSuppliersAndEmployees) / 12 : null;
    return b && out ? over(b.cash + i.undrawn, out) : null;
  }),
  lvr: (i: CapabilityInput) => Y.map((y) => {
    const b = i.balanceSheet[y];
    return b && i.collateral ? over(b.debtCurrent + b.debtNonCurrent, i.collateral) : null;
  }),
  normalisedMargin: (i: CapabilityInput) => Y.map((y) => {
    const e = ebitda(i.pnl[y]), r = rev(i, y);
    return e !== null && r ? over(e + (i.sale.addBacks ?? 0), r) : null;
  }),
  fcfMargin: (i: CapabilityInput) => Y.map((y) => {
    const cf = i.cashFlow[y], p = i.pnl[y];
    return cf && p && p.revenue ? over(cf.netOperating - p.depreciation, p.revenue) : null;
  }),
  roic: (i: CapabilityInput) => Y.map((y) => {
    const p = i.pnl[y], b = i.balanceSheet[y];
    if (!p || !b) return null;
    const tax = p.profitBeforeTax ? Math.max(0, Math.min(0.5, p.tax / p.profitBeforeTax)) : 0.25;
    const invested = b.equity + b.debtCurrent + b.debtNonCurrent;
    return invested > 0 ? over(p.operatingProfit * (1 - tax), invested) : null;
  }),
  assetIntensity: (i: CapabilityInput) => Y.map((y) => {
    const b = i.balanceSheet[y], r = rev(i, y);
    return b && r ? over(b.fixedAssets, r) : null;
  }),
};

/** Which series each card draws, in the card's own units, and which point the dial is judging. */
type TrendSpec = { of: (i: CapabilityInput) => (number | null)[]; unit: "pct" | "raw"; at: number; label: string };
const FIVE = "Year 1 to Year 5";
const STEPS = "Each year into the next";

const SPECS: Record<CapabilityKind, Record<string, TrendSpec>> = {
  grow: {
    operatingMargin: { of: series.opMargin, unit: "pct", at: 1, label: FIVE },
    revenueGrowth: { of: series.growth, unit: "pct", at: 0, label: STEPS },
    incrementalMargin: { of: series.incMargin, unit: "pct", at: 0, label: STEPS },
    cashCycle: { of: series.cashCycle, unit: "raw", at: 0, label: FIVE },
    workingCapitalPerDollar: { of: series.wcPerDollar, unit: "raw", at: 0, label: STEPS },
    cashConversion: { of: series.conversion, unit: "pct", at: 0, label: FIVE },
  },
  borrow: {
    dscr: { of: series.dscr, unit: "raw", at: 0, label: FIVE },
    dscrStressed: { of: series.dscrStressed, unit: "raw", at: 0, label: FIVE },
    leverage: { of: series.leverage, unit: "raw", at: 0, label: FIVE },
    interestCover: { of: series.interestCover, unit: "raw", at: 0, label: FIVE },
    currentRatio: { of: series.currentRatio, unit: "raw", at: 0, label: FIVE },
    quickRatio: { of: series.quickRatio, unit: "raw", at: 0, label: FIVE },
    runway: { of: series.runway, unit: "raw", at: 0, label: FIVE },
    lvr: { of: series.lvr, unit: "pct", at: 0, label: FIVE },
  },
  sell: {
    normalisedMargin: { of: series.normalisedMargin, unit: "pct", at: 0, label: FIVE },
    cashConversion: { of: series.conversion, unit: "pct", at: 0, label: FIVE },
    freeCashFlow: { of: series.fcfMargin, unit: "pct", at: 0, label: FIVE },
    roic: { of: series.roic, unit: "pct", at: 0, label: FIVE },
    revenueGrowth: { of: series.growth, unit: "pct", at: 0, label: STEPS },
    assetIntensity: { of: series.assetIntensity, unit: "raw", at: 0, label: FIVE },
  },
};

/**
 * Hang each card's five-year line on it. A line with fewer than two real points is not a line, so it is
 * left off rather than drawn as a lone dot that looks like a trend.
 */
export function withTrends(kind: CapabilityKind, metrics: Metric[], i: CapabilityInput): Metric[] {
  const specs = SPECS[kind];
  return metrics.map((m) => {
    const spec = specs[m.key];
    if (!spec) return m;
    const raw = spec.of(i);
    const pts = raw.map((v) => (v === null ? null : spec.unit === "pct" ? pctOf(v) : r2(v)));
    if (pts.filter((v) => v !== null).length < 2) return { ...m, trend: undefined, trendAt: undefined };
    return { ...m, trend: pts, trendAt: spec.at, trendLabel: spec.label };
  });
}

/* ------------------------------------------------------------------ *
 * The panels under the cards                                          *
 * ------------------------------------------------------------------ */

/** One product's own five years, from the same projection Sales and COGS run (§6.41). */
export type ProductFacts = { name: string; years: { revenue: number; grossProfit: number }[] };
/** One borrowing line the plan already carries, from the Funding rows. */
export type FacilityFacts = { name: string; kind: string; drawn: number; facility: number; ratePct: number; termMonths: number };

const YEAR_LABELS = Y.map((y) => `Year ${y}`);

export function panels(i: CapabilityInput, products: ProductFacts[]) {
  const yearsWith = Y.filter((y) => i.pnl[y]);
  const has = yearsWith.length > 0;

  /* ---- grow ---- */
  const cycle = {
    categories: YEAR_LABELS,
    stock: Y.map((y) => i.days[y]?.inventoryDays ?? 0),
    debtor: Y.map((y) => i.days[y]?.debtorDays ?? 0),
    creditor: Y.map((y) => i.days[y]?.creditorDays ?? 0),
    cycle: Y.map((y) => { const d = i.days[y]; return d ? d.inventoryDays + d.debtorDays - d.creditorDays : 0; }),
  };
  /*
   * KEEPING IT STANDING vs GROWING IT. Depreciation is the convention for what it costs to stand still — the
   * same convention free cash flow uses on the Sell tab — and anything spent above it is growth. A year that
   * spends LESS than depreciation is running its assets down, and the panel says so rather than showing it
   * as zero growth.
   */
  const capex = {
    categories: YEAR_LABELS,
    maintenance: Y.map((y) => r2(i.pnl[y]?.depreciation ?? 0)),
    growth: Y.map((y) => r2(Math.max(0, (i.capex[y] ?? 0) - (i.pnl[y]?.depreciation ?? 0)))),
    runDown: Y.filter((y) => (i.capex[y] ?? 0) < (i.pnl[y]?.depreciation ?? 0)) as number[],
  };
  const y1Rev = products.reduce((a, p) => a + (p.years[0]?.revenue ?? 0), 0);
  const byProduct = products
    .map((p) => {
      const a = p.years[0], b = p.years[1];
      return {
        name: p.name,
        change: r2((b?.revenue ?? 0) - (a?.revenue ?? 0)),
        margin: a && a.revenue ? r1((a.grossProfit / a.revenue) * 100) : null,
        share: y1Rev > 0 ? r1(((a?.revenue ?? 0) / y1Rev) * 100) : null,
        revenue: a?.revenue ?? 0,
      };
    })
    .filter((p) => p.revenue > 0 || p.change !== 0);
  const avgMargin = (() => {
    const gp = products.reduce((a, p) => a + (p.years[0]?.grossProfit ?? 0), 0);
    return y1Rev > 0 ? r1((gp / y1Rev) * 100) : null;
  })();

  /* ---- borrow ---- */
  const cover = {
    categories: YEAR_LABELS,
    base: series.dscr(i).map((v) => (v === null ? null : r2(v))),
    stressed: series.dscrStressed(i).map((v) => (v === null ? null : r2(v))),
    minimum: LENDER_MIN_DSCR,
  };
  const service = {
    categories: YEAR_LABELS,
    available: Y.map((y) => r2(cashForDebtService(i, y) ?? 0)),
    repayments: Y.map((y) => r2(i.debtService[y] ?? 0)),
  };

  /* ---- sell ---- */
  const revenue = {
    categories: YEAR_LABELS,
    values: Y.map((y) => r2(i.pnl[y]?.revenue ?? 0)),
    /* A loss year is coloured as one — the revenue is real, the business under it is not making money. */
    lossYears: Y.filter((y) => (i.pnl[y]?.operatingProfit ?? 0) < 0) as number[],
  };
  const margins = {
    categories: YEAR_LABELS,
    gross: Y.map((y) => r1(i.pnl[y]?.grossMargin ?? 0)),
    /* A year with no margin to take is a gap in the line (§6.89) — `0` would draw a break-even nobody earned. */
    normalised: series.normalisedMargin(i).map((v) => (v === null ? null : r1(v * 100))),
  };
  const transfer = TRANSFER_FACTORS.map((f) => {
    const r = i.transfer.find((t) => t.factor === f.key);
    return { key: f.key, label: f.label, score: r && r.score > 0 ? r.score : null, note: r?.note ?? null };
  });

  return { has, cycle, capex, byProduct, avgMargin, cover, service, revenue, margins, transfer };
}

export type Panels = ReturnType<typeof panels>;

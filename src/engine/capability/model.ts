import type { BalanceSheetYear, CashFlowYear, PnlYear, WorkingCapitalDays } from "@/engine/forecast/model";
import type { Growth, Sale, Stress, TransferRating } from "./judgements";

/**
 * FINANCIAL CAPABILITIES — the shared shape (§6.128, rebuilt §6.129).
 *
 * Three questions a business owner actually asks: could I sell this, could I borrow against it, can I
 * afford to grow it.
 *
 * THE THREE TABS ARE DASHBOARDS. THEY COLLECT NOTHING.
 *
 * §6.128 built them with their inputs on them — an asking price beside the dial it drives, six
 * transferability scores in a grid under the gauge, a loan proposal in a row of boxes. Nic, seeing it built:
 * "THESE THREE TABS ARE FOR DISPLAY - NOT FOR COLLECTING DATA." The complaint reads as being about layout
 * and is not. Nothing typed on those tabs was ever saved, so every figure was gone on refresh, no report
 * could print any of it, and a score that changes between two visits is not a measurement. A dashboard that
 * collects data is a form wearing a disguise.
 *
 * So every figure now has a home on the step whose subject it is — the cash floor and the downside with the
 * other assumptions, the price in Plan settings → Exit & sale, owner dependence with the people it depends
 * on — and this engine is handed all of them, already stored. `Metric.fix` carries where each one lives, so
 * an unanswered dial can point at the box that answers it instead of growing one.
 *
 * THE PROPOSED LOAN IS GONE ENTIRELY, and its absence is the clearest gain. The borrowing tab used to ask
 * for an amount, a rate and a term for a loan the client was contemplating. The two questions worth asking
 * — is the debt this plan already carries covered, and what would the earnings support on top — are both
 * answered by the plan itself. A loan actually being considered belongs on Funding or in What-If, where the
 * whole forecast moves with it (§6.41).
 *
 * A METRIC THAT CANNOT BE COMPUTED SAYS SO AND SAYS WHY. `value: null` is a first-class answer with a
 * `missing` sentence attached, because the alternative — a zero, or a dash with no explanation — is the
 * screen implying the business scored badly when nobody has been asked the question yet (§6.89).
 */

export type Severity = "good" | "watch" | "bad";

/** A band runs up to `to`; the last one catches everything above. Order matters, low to high. */
export type Band = { to: number; s: Severity };

export type Unit = "pct" | "x" | "money" | "days" | "months" | "cents" | "plain";

export type Metric = {
  key: string;
  name: string;
  /** Null when the plan does not hold what the formula needs. `missing` then says what is wanted. */
  value: number | null;
  /** Pre-formatted for display, because only the caller knows the plan's currency. */
  display: string;
  /** The gauge's own scale — not the data's range, the range a reader should judge the value against. */
  min: number;
  max: number;
  bands: Band[];
  unit: Unit;
  sub?: string;
  /** One sentence about this plan's figure. Written from the value, never generic. */
  note: string;
  /** What good looks like, so a number is not left to be judged alone. */
  bench: string;
  /* The three lines behind "Formula and data confidence" — the reason a client can trust the dial. */
  formula: string;
  reveals: string;
  confidence: string;
  /** Present only when `value` is null: the plain-English thing that would make this answerable. */
  missing?: string;
  /**
   * WHERE THE MISSING FIGURE IS ENTERED (§6.129) — the pencil's destination on a greyed dial.
   *
   * `to` is a path under the plan, area included, so the client lands on the tab that holds the box rather
   * than on the step's first tab to go hunting. Absent when what is missing is a forecast rather than a
   * field: "needs a Year 1 forecast" has no single box to send anybody to.
   */
  fix?: { label: string; to: string };
  /** Year 1 to 5, or three historic points — whatever the metric is honestly a series of. */
  trend?: number[];
  trendLabel?: string;
};

/**
 * WHERE A VALUE SITS, given bands running low to high.
 *
 * A metric where LOW is good (debtor days, leverage) simply declares its bands that way round — there is
 * no "direction" flag, because a flag is a second thing to get right and the band order already says it.
 */
export function statusOf(value: number | null, bands: Band[]): Severity | null {
  if (value === null || !Number.isFinite(value)) return null;
  for (const b of bands) if (value <= b.to) return b.s;
  return bands[bands.length - 1]?.s ?? null;
}

/**
 * THE 0–100 SCORE, AND WHY IT IS NOT AN AVERAGE OF THE NUMBERS.
 *
 * Averaging the values themselves is meaningless — 66 days and 1.32 times do not add up to anything. What
 * can be averaged is the JUDGEMENT: each metric is worth 100, 60 or 20 depending on its band, weighted by
 * how much it matters to the question being asked.
 *
 * A METRIC THAT COULD NOT BE COMPUTED IS LEFT OUT OF BOTH SIDES, not scored as zero. A plan missing one
 * input is not a plan that failed that test, and a score that silently punishes a blank field would have
 * every new client opening on a red dial.
 *
 * `covered` is returned with the score so the screen can say what the score was actually built from. A 71
 * out of six metrics and a 71 out of nine are not the same claim.
 */
const POINTS: Record<Severity, number> = { good: 100, watch: 60, bad: 20 };

export function score(metrics: Metric[], weights: Record<string, number> = {}):
  { value: number | null; covered: number; total: number; capped: string[] } {
  let sum = 0, weight = 0, covered = 0;
  const capped: string[] = [];
  for (const m of metrics) {
    const s = statusOf(m.value, m.bands);
    if (s === null) continue;
    const w = weights[m.key] ?? 1;
    sum += POINTS[s] * w;
    weight += w;
    covered += 1;
    if (s === "bad" && w >= DECISIVE) capped.push(m.key);
  }
  if (!weight) return { value: null, covered, total: metrics.length, capped };

  /**
   * A DECISIVE FAILURE CANNOT BE AVERAGED AWAY (§6.128.1).
   *
   * Caught on the first real plan this screen met. SEQ Concreting forecasts a Year 2 LOSS, and the growth
   * tab scored it 83 — healthy — because eight well-behaved measures outvoted the one that matters. The
   * arithmetic was right and the answer was a lie.
   *
   * > An average is the wrong instrument for a question with a veto in it. A business that loses money
   * > cannot be a healthy growth prospect no matter how tidy its cash cycle is, and a bank does not
   * > average its covenants either.
   *
   * So a metric heavy enough to be decisive, sitting in its worst band, holds the whole score inside the
   * at-risk band. The screen names which one did it, because a capped score with no explanation is just
   * a number the client will argue with.
   */
  const raw = Math.round(sum / weight);
  return {
    value: capped.length ? Math.min(raw, CAP_WHEN_DECISIVE_FAILS) : raw,
    covered, total: metrics.length, capped,
  };
}

/** A weight at or above this is a measure the answer cannot survive failing. */
const DECISIVE = 3;
/** The top of the at-risk band. A capped score sits at its ceiling, not at zero — it is still a reading. */
const CAP_WHEN_DECISIVE_FAILS = 49;

export const SCORE_BANDS: Band[] = [{ to: 50, s: "bad" }, { to: 70, s: "watch" }, { to: 100, s: "good" }];

export const SEVERITY_LABEL: Record<Severity, string> = {
  good: "Healthy", watch: "On track", bad: "At risk",
};

/* ------------------------------------------------------------------ *
 * What the engine is handed                                           *
 * ------------------------------------------------------------------ */

/**
 * The plan, reduced to what these two questions need.
 *
 * Assembled on the server from the SAME forecast run the P&L, the dashboard and the report read (§6.67).
 * The engine never queries anything: it is a pure function of this, which is what makes every dial on the
 * screen testable without a database.
 */
export type CapabilityInput = {
  /** Formats money in the plan's own currency. Passed in for the same reason the report passes it. */
  money: (v: number) => string;
  pnl: Partial<Record<number, PnlYear>>;
  cashFlow: Partial<Record<number, CashFlowYear>>;
  balanceSheet: Partial<Record<number, BalanceSheetYear>>;
  /** The working-capital schedule the forecast itself runs on — never a second reading of it. */
  days: Record<number, WorkingCapitalDays>;
  /** Year 1, twelve closing cash balances and twelve profits, as the dashboard charts them. */
  monthlyCash: number[];
  monthlyProfit: number[];
  /** Existing scheduled principal + interest per plan year, from the funding rows. */
  debtService: Partial<Record<number, number>>;
  /** Capex per year from Fixed Assets, so growth spending can be told from keeping the lights on. */
  capex: Partial<Record<number, number>>;
  /**
   * The judgements the forecast cannot make, ALL OF THEM STORED (§6.129) and every field nullable.
   *
   * `growth` is the cash floor and the cost of capital, from Assumptions → Cash & capital. `stress` is the
   * downside case, from Assumptions → Downside. `sale` is the price and the comparables, from Plan settings →
   * Exit & sale. `transfer` is the six change-of-owner judgements, from Leadership Team → Risk & Succession.
   *
   * Nothing here is defaulted on the way in. A null cost of capital greys the return dial and points at the
   * box; it does not quietly become 11% and hand the client a judgement nobody made (§6.89).
   */
  growth: Growth;
  stress: Stress;
  sale: Sale;
  /** Only the factors actually scored. Six rows means all six answered; fewer means the measure waits. */
  transfer: TransferRating[];
  /** Year 1 revenue that comes from products sold as an ongoing client rather than a one-off job. */
  recurringShare: number | null;
  /**
   * The biggest single product or service as a share of Year 1 revenue.
   *
   * NOT customer concentration, which is what a buyer actually asks and which this app cannot answer —
   * it records products and segments, not who buys. It is the nearest thing the plan honestly holds, and
   * the card that shows it says so rather than letting it be mistaken for the real measure (§6.128.4).
   */
  largestProductShare: number | null;
  /** What the leadership team is paid in Year 1 — the wage bill a buyer inherits or has to replace. */
  leadershipPay: number | null;
  /**
   * What a lender could advance against, summed from Fixed Assets. Null until at least one asset carries a
   * figure — a total of nought across a shed full of machinery is a worse answer than no answer.
   */
  collateral: number | null;
  /**
   * Committed but undrawn facility, from the funding rows the plan already holds — facility total less what
   * has been drawn. Never a field anybody types: Funding records both halves of it already (§6.41).
   */
  undrawn: number;
};

/* ------------------------------------------------------------------ *
 * Small shared arithmetic                                             *
 * ------------------------------------------------------------------ */

export const r2 = (v: number) => Math.round(v * 100) / 100;
export const r1 = (v: number) => Math.round(v * 10) / 10;

/** Division that refuses rather than returning Infinity — every caller wants "unanswerable", not ∞. */
export const over = (a: number | null | undefined, b: number | null | undefined): number | null => {
  if (a === null || a === undefined || b === null || b === undefined) return null;
  if (!Number.isFinite(a) || !Number.isFinite(b) || b === 0) return null;
  return a / b;
};

/** EBITDA, from the plan's own P&L rather than a second definition of it. */
export const ebitda = (p: PnlYear | undefined): number | null =>
  p ? r2(p.operatingProfit + p.depreciation) : null;

/**
 * The annual repayment on a loan, from its amount, rate and term.
 *
 * The standard amortising formula, here rather than in a screen, because the borrowing dial and the
 * headroom sentence beneath it must be the same number (§6.41).
 */
export function annualRepayment(amount: number, ratePct: number, termYears: number): number | null {
  if (!(amount > 0) || !(termYears > 0)) return null;
  const r = ratePct / 100;
  if (r <= 0) return r2(amount / termYears);
  return r2((amount * r) / (1 - Math.pow(1 + r, -termYears)));
}

/** The largest loan whose repayments a given cash flow still covers at a given multiple. */
export function borrowingCapacity(
  cashAvailable: number, existingService: number, ratePct: number, termYears: number, minCover: number,
): number | null {
  const room = cashAvailable / minCover - existingService;
  if (!(room > 0) || !(termYears > 0)) return 0;
  const r = ratePct / 100;
  if (r <= 0) return r2(room * termYears);
  return r2((room * (1 - Math.pow(1 + r, -termYears))) / r);
}

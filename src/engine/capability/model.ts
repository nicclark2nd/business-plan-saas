import type { BalanceSheetYear, CashFlowYear, PnlYear, WorkingCapitalDays } from "@/engine/forecast/model";

/**
 * FINANCIAL CAPABILITIES — the shared shape (§6.128).
 *
 * Three questions a business owner actually asks: could I sell this, could I borrow against it, can I
 * afford to grow it. Two of them are built here; selling needs facts this app has never collected — an
 * asking price, owner add-backs, who holds the customer relationships — and a dial drawn without them
 * would be an opinion with a needle on it.
 *
 * EVERY NUMBER COMES FROM THE FORECAST THE REST OF THE APP RUNS. Nothing on these screens is typed twice.
 * The one exception is the loan being CONSIDERED, which by definition is not in the plan yet — it is a
 * scenario, the same way What-If's levers are, and it is held by the module rather than written into the
 * plan until the client decides to fund it.
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
   * The two judgements the growth question needs and the plan does not hold: how low the client is willing
   * to let cash go, and what their money costs. Typed on the screen like the loan and the asking price —
   * both are the client's own tolerance, not a fact the forecast produces.
   */
  growth: Growth;
  /** Year 1 revenue that comes from products sold as an ongoing client rather than a one-off job. */
  recurringShare: number | null;
  /**
   * What the business is being offered at, and the judgements that go with it. Null until the client
   * prices it — same reasoning as the loan below: somebody wondering what their business is worth has not
   * sold it, and an asking price is a position in a negotiation rather than a fact about the plan.
   */
  sale: Sale | null;
  /**
   * The loan being considered. Null until the client enters one — every borrowing metric that depends on
   * it then reports itself unanswerable rather than quietly pretending the loan is zero.
   */
  proposal: Proposal | null;
  /** How hard to push the downside. Defaults are stated on screen, not hidden in here. */
  stress: Stress;
};

export type Sale = {
  /** Enterprise value being asked. Zero means not priced yet. */
  askingPrice: number;
  /**
   * Owner costs a buyer would not inherit — an above-market salary, the family car, one-off legal fees.
   * Added back to EBITDA, and every dollar of it is a dollar a buyer's accountant will argue about.
   */
  addBacks: number;
  /** What businesses like this one have actually changed hands for, as a multiple of normalised EBITDA. */
  multipleLow: number;
  multipleHigh: number;
  /**
   * Will it survive a change of owner? Six judgements, 1 (weak) to 5 (strong), in TRANSFER_FACTORS order.
   * Empty until somebody scores them — a blank assessment is not a score of zero (§6.89).
   */
  transfer: number[];
};

/** The six things a buyer's advisor actually tests. Fixed, because a moving list cannot be compared. */
export const TRANSFER_FACTORS = [
  { key: "owner", label: "Runs without the owner", hint: "Could the business trade for a month if the owner vanished?" },
  { key: "customers", label: "Customer relationships held by the team", hint: "Do customers deal with the business, or with one person?" },
  { key: "processes", label: "Written-down processes", hint: "Could a new owner find out how the work is actually done?" },
  { key: "staff", label: "Key staff likely to stay", hint: "Would the people who matter still be there in a year?" },
  { key: "contracts", label: "Contracts a buyer can inherit", hint: "Are they assignable, or do they end at a change of control?" },
  { key: "systems", label: "Systems and records", hint: "Are the books and the systems something a buyer could rely on?" },
] as const;

export const DEFAULT_SALE: Sale = { askingPrice: 0, addBacks: 0, multipleLow: 3.5, multipleHigh: 4.8, transfer: [] };

export type Growth = {
  /** The floor the client wants cash to stay above. Zero means "just don't go negative". */
  cashBuffer: number;
  /** What the money funding the growth costs, as a percentage. Sets the bar the return has to clear. */
  costOfCapital: number;
};

export const DEFAULT_GROWTH: Growth = { cashBuffer: 0, costOfCapital: 11 };

export type Proposal = {
  amount: number;
  ratePct: number;
  termYears: number;
  /** Committed but undrawn — an overdraft counts towards runway only if the bank cannot withdraw it. */
  undrawn: number;
  /** What the lender can actually take security over. Null when nobody has valued it. */
  collateral: number | null;
};

export type Stress = {
  /** Sales fall by this much, as a percentage. */
  salesPct: number;
  /** Gross margin falls by this many percentage points. */
  marginPts: number;
  /** Customers pay this many days later. */
  debtorDaysAdded: number;
};

export const DEFAULT_STRESS: Stress = { salesPct: 10, marginPts: 1.5, debtorDaysAdded: 10 };

/** The cover a lender will not go below. Stated once, shown on screen, used by every calculation. */
export const LENDER_MIN_DSCR = 1.25;

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

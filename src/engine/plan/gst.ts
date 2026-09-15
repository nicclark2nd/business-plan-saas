/**
 * GST / VAT (§6.38).
 *
 * The tax a business collects on its sales is never its money. It arrives with every invoice, sits in the
 * bank account looking exactly like cash, and then leaves in one lump at the end of each BAS period. A
 * forecast that ignores it is not slightly optimistic — it is wrong about the balance in every single month,
 * and most wrong in the month the return falls due, which on a June year end is the month after the year
 * the plan is being judged on.
 *
 * Three rules hold this together, and all three are what an accountant would check first:
 *
 *   **1. It never touches the profit and loss.** Revenue, cost of sales and overheads are tax-exclusive
 *   figures and stay that way. Registering for GST does not change a business's profit by a cent, and if
 *   turning the flag on moved the profit line, that would be the bug.
 *
 *   **2. Debtors and creditors are tax-INCLUSIVE.** A customer owes the whole invoice, tax and all. This is
 *   the one place the balance sheet moves, and it is the detail most spreadsheets get wrong.
 *
 *   **3. What is collected but not yet remitted is a liability.** With quarterly returns and a June year
 *   end, the whole June quarter is still owed at 30 June. It belongs in current liabilities, not in cash.
 *
 * **Not everything is taxable, and that is not a nicety.** Wages are the largest line in most plans and
 * carry no GST; claiming input credits on a payroll would invent tens of thousands of dollars a year. Every
 * line that can be taxed or not carries its own flag, defaulting to the ordinary case.
 *
 * This models the **accruals basis** — tax is owed when the invoice is raised and claimable when the bill is
 * received — which is the default and what a plan should assume. A cash-basis election is a refinement this
 * deliberately does not claim.
 */

const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const r2 = (v: number) => Math.round(v * 100) / 100 + 0;

import type { TaxComponent, TaxFrequency } from "./taxRegimes";

export type GstFrequency = TaxFrequency;

export type GstSettings = {
  registered: boolean;
  /** What the client calls it on their own return: GST, VAT, PST, QST, Sales tax (§6.39). */
  label: string;
  /** Per cent. 10 in Australia and New Zealand is 15, the UK 20 — the client states it. */
  rate: number;
  frequency: GstFrequency;
  /**
   * Whole months between a period closing and the money moving. One almost everywhere, two in the UK
   * where the deadline is a month and seven days (§6.39).
   */
  lagMonths: number;
  /**
   * Does the business claim back what it pays on purchases? True for a value-added tax; false for a
   * single-stage sales tax, where there is nothing to claim and `collected − credits` becomes
   * `collected`, which is exactly the right answer for that regime.
   */
  reclaimable: boolean;
};

export const NOT_REGISTERED: GstSettings = { registered: false, label: "GST", rate: 0, frequency: "quarterly", lagMonths: 1, reclaimable: true };

/** One component of a plan's tax, as this engine consumes it. */
export const settingsFor = (c: TaxComponent, registered = true): GstSettings => ({
  registered: registered && n(c.rate) > 0,
  label: c.label,
  rate: Math.min(100, Math.max(0, n(c.rate))),
  frequency: c.frequency,
  lagMonths: Math.max(0, Math.trunc(n(c.lagMonths)) || 0),
  reclaimable: c.reclaimable !== false,
});

/** A stored settings row, cleaned. An unrecognised frequency falls back rather than throwing. */
export function gstSettings(stored: {
  gst_registered?: boolean | null; gst_rate?: number | string | null; gst_frequency?: string | null;
} | null | undefined): GstSettings {
  if (!stored?.gst_registered) return NOT_REGISTERED;
  const f = stored.gst_frequency;
  return {
    registered: true,
    label: "GST",
    rate: Math.min(100, Math.max(0, n(Number(stored.gst_rate)))),
    frequency: f === "monthly" || f === "annually" ? f : "quarterly",
    lagMonths: 1,
    reclaimable: true,
  };
}

/** The tax on a tax-exclusive amount. Nil when the business is not registered, or the line is not taxable. */
export const taxOn = (amount: number, g: GstSettings, applies = true) =>
  g.registered && applies ? r2(n(amount) * (g.rate / 100)) : 0;

/** Tax-inclusive: what actually changes hands. */
export const inclusive = (amount: number, g: GstSettings, applies = true) => r2(n(amount) + taxOn(amount, g, applies));

/**
 * What a return covers and when it is paid.
 *
 * Returns are filed after the period ends, so the money leaves in the month AFTER the last month of the
 * period. That one month of lag is the whole point: it is why a quarter's tax is still sitting in the bank
 * at 30 June, and why the business feels richer than it is right up until it does not.
 *
 * Slot 0 is the first month of the plan year, not January (§6.21). A period whose payment falls beyond the
 * twelve months is still returned, with `paidInMonth` at 12 or more, so the caller can tell the difference
 * between "paid in March" and "still owed at year end".
 */
export type GstPeriod = { months: number[]; paidInMonth: number };

export function gstPeriods(frequency: GstFrequency, lagMonths = 1): GstPeriod[] {
  const size = frequency === "monthly" ? 1 : frequency === "annually" ? 12 : 3;
  const lag = Math.max(0, Math.trunc(n(lagMonths)) || 0);
  const out: GstPeriod[] = [];
  for (let start = 0; start < 12; start += size) {
    const months = Array.from({ length: size }, (_, i) => start + i).filter((m) => m < 12);
    out.push({ months, paidInMonth: months[months.length - 1] + lag });   // filed after the period closes
  }
  return out;
}

export type GstMonth = {
  month: number;
  /** Tax charged on this month's sales, and reclaimable on this month's purchases. */
  collected: number;
  credits: number;
  net: number;
  /** What settles this month for an earlier period: positive is paid out, negative is a refund in. */
  remitted: number;
  /** Net owed at the end of this month. Negative means the tax office owes the business. */
  payable: number;
};

export type GstSchedule = {
  months: GstMonth[];
  collected: number;
  credits: number;
  net: number;
  remitted: number;
  /** Net at the end of the twelve months: positive is a current liability, negative a refund due. */
  closingPayable: number;
};

/**
 * Twelve months of tax, from twelve months of taxable sales and twelve of taxable purchases.
 *
 * `openingPayable` is what was already owed when the year opened — the previous year's final return, which
 * is paid in the first month or two of this one. Dropping it would give the business a free quarter of tax
 * every time a plan year rolls over.
 */
export function gstSchedule(
  taxableSales: number[], taxablePurchases: number[], g: GstSettings, openingPayable = 0,
): GstSchedule {
  // A single-stage sales tax has nothing to claim: the business either never paid it (bought for resale)
  // or wears it inside the cost it already typed. So there are no credits, and `collected − credits`
  // becomes `collected` — the right remittance for that regime, from the same formula (§6.39).
  const credits = g.reclaimable
    ? Array.from({ length: 12 }, (_, i) => taxOn(n(taxablePurchases[i]), g))
    : Array.from({ length: 12 }, () => 0);
  return gstScheduleFromTax(Array.from({ length: 12 }, (_, i) => taxOn(n(taxableSales[i]), g)), credits, g, openingPayable);
}

/**
 * The same schedule, from tax already worked out (§6.39).
 *
 * This is the primitive, and it exists because rounding does not distribute: the tax on
 * (cost of sales + overheads + capex) is not always the tax on each of them added up, and at a rate like
 * Quebec's 9.975 % the difference shows — eleven cents out on the balance sheet, because the liability was
 * computed one way and the cash lines the other. The caller applies the rate once, per line, and hands the
 * results here, so there is only ever one set of figures.
 */
export function gstScheduleFromTax(
  collected: number[], creditsIn: number[], g: GstSettings, openingPayable = 0,
): GstSchedule {
  const zero: GstMonth[] = Array.from({ length: 12 }, (_, i) => ({
    month: i + 1, collected: 0, credits: 0, net: 0, remitted: 0, payable: 0,
  }));
  if (!g.registered) {
    return { months: zero, collected: 0, credits: 0, net: 0, remitted: 0, closingPayable: 0 };
  }
  const credits = Array.from({ length: 12 }, (_, i) => n(creditsIn[i]));

  /**
   * What each month settles: the net of whichever period closed last month, plus anything brought forward.
   *
   * **A negative net is a refund, and it is money coming IN.** A business that buys a 120,000 excavator in a
   * quarter has claimed more than it collected, and the tax office pays the difference back — which is
   * exactly the cash a capital-heavy startup is counting on. Treating it as nothing, and leaving the credit
   * sitting as a negative liability that never resolves, understates cash and puts a figure on the balance
   * sheet that is not a liability at all. So `remitted` is signed: positive is a payment, negative a refund.
   */
  const remitted = Array.from({ length: 12 }, () => 0);
  for (const p of gstPeriods(g.frequency, g.lagMonths)) {
    if (p.paidInMonth > 11) continue;                       // falls after the year; still owed at year end
    const net = p.months.reduce((a, m) => a + collected[m] - credits[m], 0);
    remitted[p.paidInMonth] = r2(remitted[p.paidInMonth] + net);
  }
  // Last year's closing return settles in the first month of this one, whatever the frequency.
  remitted[0] = r2(remitted[0] + n(openingPayable));

  let payable = n(openingPayable);
  const months = zero.map((_, i) => {
    const net = r2(collected[i] - credits[i]);
    payable = r2(payable + net - remitted[i]);
    return { month: i + 1, collected: collected[i], credits: credits[i], net, remitted: remitted[i], payable };
  });

  const total = (a: number[]) => r2(a.reduce((x, y) => x + y, 0));
  return {
    months,
    collected: total(collected), credits: total(credits),
    net: r2(total(collected) - total(credits)),
    remitted: total(remitted),
    closingPayable: months[11].payable,
  };
}

/**
 * What the tax is called where the business trades. A builder in Brisbane does not have a "VAT liability",
 * and a plan that says so reads as though it was written for somebody else (§6.31).
 */
const VAT = new Set([
  "United Kingdom", "Ireland", "Germany", "France", "Spain", "Italy", "Netherlands", "Belgium", "Portugal",
  "Poland", "Sweden", "Denmark", "Norway", "Finland", "Austria", "Switzerland", "South Africa",
]);
const GST = new Set([
  "Australia", "New Zealand", "Canada", "Singapore", "India",
]);
/**
 * Single-stage sales taxes, which are NOT this model (§6.38.2).
 *
 * A value-added tax is charged at every stage and every business claims back what it paid, so only the
 * final consumer bears it. A sales tax is charged once, at retail, to the end customer — a business buying
 * for resale pays nothing and there is no credit to claim, because there was never any tax to claim back.
 * Modelling one as the other invents input credits that do not exist and understates the cost of every
 * purchase. Malaysia replaced its GST with SST in 2018 and belongs here, not above.
 *
 * The engine below still charges on sales correctly for these; what it gets wrong is the claim side, which
 * is why `salesTaxCountry` exists — so the screens can say so rather than quietly producing a wrong number.
 */
const SALES_TAX = new Set(["United States", "Malaysia"]);
export const salesTaxCountry = (country: string | null | undefined) => SALES_TAX.has((country ?? "").trim());

export function taxLabel(country: string | null | undefined): string {
  const c = (country ?? "").trim();
  if (GST.has(c)) return "GST";
  if (VAT.has(c)) return "VAT";
  if (c === "United States") return "Sales tax";
  if (c === "Malaysia") return "SST";
  return "GST";
}

/** The rate a country ordinarily charges, offered as a starting point rather than imposed. */
/**
 * The standard rate each country ordinarily charges, offered as a starting point rather than imposed.
 * Verified against published rates in September 2026 — Finland moved to 25.5 % and was wrong here.
 * A rate is a fact with a date on it, so this is a default the client can always overwrite, never a
 * calculation input the plan depends on.
 */
const RATES: Record<string, number> = {
  Australia: 10, "New Zealand": 15, Singapore: 9, Canada: 5, India: 18, Malaysia: 10, Japan: 10,
  "United Kingdom": 20, Ireland: 23, Germany: 19, France: 20, Spain: 21, Italy: 22,
  Netherlands: 21, Belgium: 21, Portugal: 23, Poland: 23, Sweden: 25, Denmark: 25,
  Norway: 25, Finland: 25.5, Austria: 20, Switzerland: 8.1, "South Africa": 15,
  Estonia: 24, Slovakia: 23, Hungary: 27, Luxembourg: 17, "Czech Republic": 21, Greece: 24,
};
export const suggestedRate = (country: string | null | undefined) => RATES[(country ?? "").trim()] ?? 10;

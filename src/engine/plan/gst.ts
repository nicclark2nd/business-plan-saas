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

export type GstFrequency = "monthly" | "quarterly" | "annually";

export type GstSettings = {
  registered: boolean;
  /** Per cent. 10 in Australia and New Zealand is 15, the UK 20 — the client states it. */
  rate: number;
  frequency: GstFrequency;
};

export const NOT_REGISTERED: GstSettings = { registered: false, rate: 0, frequency: "quarterly" };

/** A stored settings row, cleaned. An unrecognised frequency falls back rather than throwing. */
export function gstSettings(stored: {
  gst_registered?: boolean | null; gst_rate?: number | string | null; gst_frequency?: string | null;
} | null | undefined): GstSettings {
  if (!stored?.gst_registered) return NOT_REGISTERED;
  const f = stored.gst_frequency;
  return {
    registered: true,
    rate: Math.min(100, Math.max(0, n(Number(stored.gst_rate)))),
    frequency: f === "monthly" || f === "annually" ? f : "quarterly",
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

export function gstPeriods(frequency: GstFrequency): GstPeriod[] {
  const size = frequency === "monthly" ? 1 : frequency === "annually" ? 12 : 3;
  const out: GstPeriod[] = [];
  for (let start = 0; start < 12; start += size) {
    const months = Array.from({ length: size }, (_, i) => start + i).filter((m) => m < 12);
    out.push({ months, paidInMonth: months[months.length - 1] + 1 });   // filed after the period closes
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
  const zero: GstMonth[] = Array.from({ length: 12 }, (_, i) => ({
    month: i + 1, collected: 0, credits: 0, net: 0, remitted: 0, payable: 0,
  }));
  if (!g.registered) {
    return { months: zero, collected: 0, credits: 0, net: 0, remitted: 0, closingPayable: 0 };
  }

  const collected = Array.from({ length: 12 }, (_, i) => taxOn(n(taxableSales[i]), g));
  const credits = Array.from({ length: 12 }, (_, i) => taxOn(n(taxablePurchases[i]), g));

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
  for (const p of gstPeriods(g.frequency)) {
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
  "Australia", "New Zealand", "Canada", "Singapore", "India", "Malaysia",
]);

export function taxLabel(country: string | null | undefined): string {
  const c = (country ?? "").trim();
  if (GST.has(c)) return "GST";
  if (VAT.has(c)) return "VAT";
  return c === "United States" ? "Sales tax" : "GST";
}

/** The rate a country ordinarily charges, offered as a starting point rather than imposed. */
const RATES: Record<string, number> = {
  Australia: 10, "New Zealand": 15, Singapore: 9, Canada: 5, India: 18, Malaysia: 6,
  "United Kingdom": 20, Ireland: 23, Germany: 19, France: 20, Spain: 21, Italy: 22,
  Netherlands: 21, Belgium: 21, Portugal: 23, Poland: 23, Sweden: 25, Denmark: 25,
  Norway: 25, Finland: 24, Austria: 20, Switzerland: 8.1, "South Africa": 15,
};
export const suggestedRate = (country: string | null | undefined) => RATES[(country ?? "").trim()] ?? 10;

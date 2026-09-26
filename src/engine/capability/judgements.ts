import type { FundingSource } from "@/engine/funding/sources";

/**
 * THE FIGURES THE CAPABILITY DIALS NEED THAT THE FORECAST CANNOT PRODUCE (§6.129), read in one place.
 *
 * Every one of them used to be typed on the capability dashboard itself and thrown away on refresh. They
 * now live on the step that owns the subject — a cash floor with the other assumptions, an asking price in
 * Plan settings, owner-dependence with the people it depends on — and this module is the single reader that
 * turns that stored row into the shapes the metrics take.
 *
 * ONE READER, because the screen that COLLECTS a figure and the dial that JUDGES it must agree about what is
 * stored and what is blank. Two readings of a nullable column is the §6.41 fault with a new costume: one
 * side treats a missing cost of capital as 11%, the other as unanswerable, and the dial disagrees with the
 * box that fills it.
 *
 * EVERY FIELD IS NULLABLE AND NOTHING HERE SUBSTITUTES A DEFAULT. A cash floor of zero is a real answer —
 * "just don't go negative" — and it has to be distinguishable from nobody having been asked (§6.89). The
 * metrics grey themselves out on null; they do not quietly assume.
 */

/** A number from a numeric column: null stays null, and a blank or unparseable value is null too. */
const n = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
};

export type Growth = {
  /** The floor the client wants cash to stay above. Zero is an answer; null is silence. */
  cashBuffer: number | null;
  /** What the money funding the plan costs, as a percent. Sets the bar the return has to clear. */
  costOfCapital: number | null;
};

export type Stress = {
  /** Sales fall by this much, as a percentage. */
  salesPct: number | null;
  /** Gross margin falls by this many percentage points. */
  marginPts: number | null;
  /** Customers pay this many days later. */
  debtorDaysAdded: number | null;
};

export type Sale = {
  /** Enterprise value being asked. */
  askingPrice: number | null;
  /**
   * Owner costs a buyer would not inherit — an above-market salary, the family car, one-off legal fees.
   * Added back to EBITDA, and every dollar of it is a dollar a buyer's accountant will argue about.
   */
  addBacks: number | null;
  /** What businesses like this one have actually changed hands for, as a multiple of normalised EBITDA. */
  multipleLow: number | null;
  multipleHigh: number | null;
  /**
   * When the range was accepted from a web search, how many sources and on what day (§6.130), so the tab
   * can say so beside it. Absent or null: the client typed it.
   */
  multipleFound?: { sources: number; on: string } | null;
  /** Which forecast year the sale is aimed at, if the client has said. */
  exitYear: number | null;
};

/**
 * The six things a buyer's advisor actually tests. FIXED, because a moving list cannot be compared between
 * two plans or between this year's plan and last year's.
 *
 * Scored on Leadership Team → Risk & Succession, not here: owner dependence is key-person risk, the People
 * module has promised since §6.11 that its Risk & Succession area feeds "key-person risk in funding, SBA and
 * sale reports", and a judgement stored once can be read by both.
 */
export const TRANSFER_FACTORS = [
  { key: "owner", label: "Runs without the owner", hint: "Could the business trade for a month if the owner vanished?" },
  { key: "customers", label: "Customer relationships held by the team", hint: "Do customers deal with the business, or with one person?" },
  { key: "processes", label: "Written-down processes", hint: "Could a new owner find out how the work is actually done?" },
  { key: "staff", label: "Key staff likely to stay", hint: "Would the people who matter still be there in a year?" },
  { key: "contracts", label: "Contracts a buyer can inherit", hint: "Are they assignable, or do they end at a change of control?" },
  { key: "systems", label: "Systems and records", hint: "Are the books and the systems something a buyer could rely on?" },
] as const;

export type TransferFactor = (typeof TRANSFER_FACTORS)[number]["key"];
export type TransferRating = { factor: TransferFactor; score: number; note: string | null };

/** What the screens offer as a starting point. Shown as a hint beside an empty box, never stored behind one. */
export const SUGGESTED_STRESS = { salesPct: 10, marginPts: 1.5, debtorDaysAdded: 10 };
export const SUGGESTED_COST_OF_CAPITAL = 11;

/** The cover a lender will not go below. Stated once, shown on screen, used by every calculation. */
export const LENDER_MIN_DSCR = 1.25;

type Row = Record<string, unknown> | null | undefined;

export function readGrowth(s: Row): Growth {
  return { cashBuffer: n(s?.cash_floor), costOfCapital: n(s?.cost_of_capital) };
}

export function readStress(s: Row): Stress {
  return {
    salesPct: n(s?.stress_sales_pct),
    marginPts: n(s?.stress_margin_pts),
    debtorDaysAdded: n(s?.stress_debtor_days),
  };
}

/**
 * THE YEAR THE SALE IS STRUCK ON (§6.135, open item 36). "Aiming to sell in" was collected and read by
 * nothing but a line of print; a buyer in Year 3 pays for Year 3's earnings, not Year 1's. So the price
 * measures — the multiple, the value range and the earnings bridge — read the year the client chose, and
 * Year 1 when they have not chosen. The health measures (margins, cash conversion, returns) stay on Year 1
 * with their five-year lines beside them, because those are about the business now.
 */
export function saleYear(sale: Pick<Sale, "exitYear">): number {
  const y = sale.exitYear;
  return y !== null && Number.isInteger(y) && y >= 1 && y <= 5 ? y : 1;
}

/**
 * The add-backs are a LIST now (§6.129.3), summed here. No lines is null, not nought: "no add-backs entered"
 * and "the owner has checked and there are none" are different claims, and only the first is on the table.
 */
export function readSale(s: Row, addBacks: { amount?: unknown }[] = []): Sale {
  const lines = addBacks.map((a) => n(a.amount)).filter((v): v is number => v !== null);
  return {
    askingPrice: n(s?.asking_price),
    addBacks: lines.length ? Math.round(lines.reduce((a, b) => a + b, 0) * 100) / 100 : null,
    multipleLow: n(s?.multiple_low), multipleHigh: n(s?.multiple_high),
    multipleFound: Array.isArray(s?.multiple_sources) && typeof s?.multiple_found_on === "string"
      ? { sources: (s.multiple_sources as unknown[]).length, on: s.multiple_found_on as string } : null,
    exitYear: n(s?.intended_exit_year),
  };
}

/**
 * What a lender could actually advance against, from Fixed Assets.
 *
 * NOT the written-down value the balance sheet already holds, which is the wrong number: a bank lends a
 * fraction of what plant is worth and nothing at all against a fit-out. Null until at least one asset
 * carries a figure, because a total of nought across a shed full of machinery is a worse answer than no
 * answer (§6.89).
 */
export function readCollateral(assets: { security_value?: unknown }[]): number | null {
  const given = assets.map((a) => n(a.security_value)).filter((v): v is number => v !== null);
  return given.length ? Math.round(given.reduce((a, b) => a + b, 0) * 100) / 100 : null;
}

/**
 * ENOUGH OF THE PLANT LISTED TO TALK ABOUT SECURITY (§6.135, open item 38).
 *
 * Loan-to-value divides the debt by what a lender would advance against the listed assets. SEQ's last
 * balance sheet carries 129,294 of plant and none of it is listed, so the whole debt was measured against
 * one new machine and read 2500% — correct arithmetic on an incomplete list, and the most alarming number on
 * the page. Until the plant already on the books is substantially listed, the measure waits and says why.
 *
 * Three quarters, not all of it: the listed figures are what the assets are worth now and the balance sheet
 * is what is left of their cost, so the two never match exactly and demanding that they did would hold the
 * measure back for ever.
 */
export const MIN_PLANT_LISTED = 0.75;
export function securityGap(sec: { openingPlant: number | null; listedOwned: number } | undefined):
  { listed: number; plant: number } | null {
  if (!sec || sec.openingPlant === null || sec.openingPlant <= 0) return null;
  return sec.listedOwned >= sec.openingPlant * MIN_PLANT_LISTED ? null : { listed: sec.listedOwned, plant: sec.openingPlant };
}

/**
 * COMMITTED BUT UNDRAWN, out of the funding rows the plan already holds — not a field anybody types.
 *
 * An overdraft counts towards runway only to the extent the bank cannot withdraw it, and Funding already
 * records both halves of that: the facility total and how much of it has been drawn. Asking for it a second
 * time on a dashboard was the clearest case of a fact written twice in the whole feature (§6.41).
 */
export function readUndrawn(funding: FundingSource[]): number {
  let total = 0;
  for (const f of funding) {
    const facility = f.loan?.total_facility_amount ?? 0;
    const drawn = f.loan?.amount_drawn ?? 0;
    if (facility > drawn) total += facility - drawn;
  }
  return Math.round(total * 100) / 100;
}

/**
 * What the plan's own borrowing costs, as a starting point for the cost of capital.
 *
 * Offered as a hint on the Assumptions screen and never stored in the client's place: equity carries no
 * rate, so the weighted average this looks like is not one, and a figure that pretends to be calculated is
 * worse than a figure somebody chose.
 */
export function impliedCostOfCapital(funding: FundingSource[]): number | null {
  const rates = funding.map((f) => f.loan?.interest_rate ?? 0).filter((r) => r > 0);
  return rates.length ? Math.round(Math.max(...rates) * 100) / 100 : null;
}

/**
 * What the tax is called, how much it is, and whether you get it back (§6.39).
 *
 * Four markets, three genuinely different taxes, and one abstraction that covers all of them.
 *
 *   **Australia** — GST 10 %, one tax, reclaimable, BAS a month after the quarter.
 *   **United Kingdom** — VAT 20 %, one tax, reclaimable, due one month AND SEVEN DAYS after the quarter,
 *     which lands the payment two months on, not one. A quarter to 30 June is paid on 7 August.
 *   **Canada** — depends entirely on the province. An HST province charges one combined rate and claims all
 *     of it back. Alberta and the territories charge federal GST alone. British Columbia, Saskatchewan and
 *     Manitoba charge GST *plus* a provincial sales tax that is **not** reclaimable — the business wears it
 *     as a cost. Quebec charges GST plus QST and gets both back.
 *   **United States** — not a value-added tax at all. Charged once at retail, nothing to claim, and the rate
 *     is a state rate plus whatever the county, city and transit district add. There is no national answer.
 *
 * The unifying idea is small: a plan carries a LIST of tax components, and each one says whether the
 * business claims back what it pays on purchases. A non-reclaimable component simply produces no
 * purchase-side credits — and then `collected − credits` is the right remittance formula for every regime
 * at once, because for a sales tax the credits are nil and the business remits the lot. One formula, four
 * countries, and British Columbia's two taxes at two different treatments fall out of it for free.
 */

export type TaxFrequency = "monthly" | "quarterly" | "annually";

export type TaxComponent = {
  /** What the client calls it on their own return: GST, VAT, PST, QST, Sales tax. */
  label: string;
  /** Per cent. */
  rate: number;
  /**
   * Does the business claim back what it pays on its purchases?
   *
   * True for a value-added tax — GST, VAT, HST, QST. False for a single-stage sales tax — US state and
   * local tax, and Canadian PST — where there is nothing to claim because the business either never paid
   * it (resale) or wears it as part of the cost. Getting this wrong invents money that does not exist.
   */
  reclaimable: boolean;
  frequency: TaxFrequency;
  /**
   * Whole months between the end of a period and the money moving. One almost everywhere; **two in the
   * United Kingdom**, where the deadline is a month and seven days, so a quarter ending in June is paid in
   * August. One month out on a quarterly payment is a real hole in a cash flow.
   */
  lagMonths: number;
};

export type Regime = {
  /** A single heading for the screens when there is more than one component: "GST and PST". */
  heading: string;
  components: TaxComponent[];
  /** Said on screen, because every one of these is an assumption the client should be able to challenge. */
  note?: string;
};

const vat = (label: string, rate: number, frequency: TaxFrequency = "quarterly", lagMonths = 1): TaxComponent =>
  ({ label, rate, reclaimable: true, frequency, lagMonths });
const salesTax = (label: string, rate: number, frequency: TaxFrequency = "quarterly", lagMonths = 1): TaxComponent =>
  ({ label, rate, reclaimable: false, frequency, lagMonths });

/* ------------------------------------------------------------------ *
 * Canada — the province decides which of four systems applies         *
 * ------------------------------------------------------------------ */
const HST = (rate: number): Regime => ({
  heading: "HST",
  components: [vat("HST", rate)],
  note: "One combined federal and provincial rate, and the whole of it is claimed back on purchases.",
});
const GST_PST = (pst: number): Regime => ({
  heading: "GST and PST",
  components: [vat("GST", 5), salesTax("PST", pst)],
  note: "GST is claimed back on purchases; PST is not — a business in this province wears the PST it pays as a cost, which is why it is charged on sales here but never claimed.",
});

export const CANADA: Record<string, Regime> = {
  Alberta: { heading: "GST", components: [vat("GST", 5)], note: "Federal GST only — Alberta charges no provincial sales tax." },
  "British Columbia": GST_PST(7),
  Manitoba: GST_PST(7),
  "New Brunswick": HST(15),
  "Newfoundland and Labrador": HST(15),
  "Northwest Territories": { heading: "GST", components: [vat("GST", 5)], note: "Federal GST only." },
  "Nova Scotia": HST(14),
  Nunavut: { heading: "GST", components: [vat("GST", 5)], note: "Federal GST only." },
  Ontario: HST(13),
  "Prince Edward Island": HST(15),
  Quebec: {
    heading: "GST and QST",
    components: [vat("GST", 5), vat("QST", 9.975)],
    note: "Both are claimed back — GST through the federal return, QST through the Quebec one.",
  },
  Saskatchewan: GST_PST(6),
  Yukon: { heading: "GST", components: [vat("GST", 5)], note: "Federal GST only." },
};

/* ------------------------------------------------------------------ *
 * United States — a state rate plus whatever is added locally         *
 * ------------------------------------------------------------------ */
/**
 * State rate, and the state-plus-average-local rate a business actually charges. The combined figure is the
 * honest default for a plan: a Louisiana business charges a shade over 10 %, not the 5 % the state levies.
 * It is an average, so it is a starting point and the client should put in what they really charge.
 */
export const US_STATES: Record<string, { state: number; combined: number }> = {
  Alabama: { state: 4, combined: 9.46 }, Alaska: { state: 0, combined: 1.82 },
  Arizona: { state: 5.6, combined: 8.52 }, Arkansas: { state: 6.5, combined: 9.46 },
  California: { state: 7.25, combined: 8.99 }, Colorado: { state: 2.9, combined: 7.89 },
  Connecticut: { state: 6.35, combined: 6.35 }, Delaware: { state: 0, combined: 0 },
  "District of Columbia": { state: 6, combined: 6 }, Florida: { state: 6, combined: 6.98 },
  Georgia: { state: 4, combined: 7.49 }, Hawaii: { state: 4, combined: 4.5 },
  Idaho: { state: 6, combined: 6.03 }, Illinois: { state: 6.25, combined: 8.96 },
  Indiana: { state: 7, combined: 7 }, Iowa: { state: 6, combined: 6.94 },
  Kansas: { state: 6.5, combined: 8.69 }, Kentucky: { state: 6, combined: 6 },
  Louisiana: { state: 5, combined: 10.11 }, Maine: { state: 5.5, combined: 5.5 },
  Maryland: { state: 6, combined: 6 }, Massachusetts: { state: 6.25, combined: 6.25 },
  Michigan: { state: 6, combined: 6 }, Minnesota: { state: 6.875, combined: 8.14 },
  Mississippi: { state: 7, combined: 7.06 }, Missouri: { state: 4.225, combined: 8.44 },
  Montana: { state: 0, combined: 0 }, Nebraska: { state: 5.5, combined: 6.98 },
  Nevada: { state: 6.85, combined: 8.24 }, "New Hampshire": { state: 0, combined: 0 },
  "New Jersey": { state: 6.625, combined: 6.6 }, "New Mexico": { state: 4.875, combined: 7.67 },
  "New York": { state: 4, combined: 8.54 }, "North Carolina": { state: 4.75, combined: 7 },
  "North Dakota": { state: 5, combined: 7.09 }, Ohio: { state: 5.75, combined: 7.29 },
  Oklahoma: { state: 4.5, combined: 9.06 }, Oregon: { state: 0, combined: 0 },
  Pennsylvania: { state: 6, combined: 6.34 }, "Rhode Island": { state: 7, combined: 7 },
  "South Carolina": { state: 6, combined: 7.49 }, "South Dakota": { state: 4.2, combined: 6.11 },
  Tennessee: { state: 7, combined: 9.61 }, Texas: { state: 6.25, combined: 8.2 },
  Utah: { state: 6.1, combined: 7.42 }, Vermont: { state: 6, combined: 6.39 },
  Virginia: { state: 5.3, combined: 5.77 }, Washington: { state: 6.5, combined: 9.51 },
  "West Virginia": { state: 6, combined: 6.59 }, Wisconsin: { state: 5, combined: 5.72 },
  Wyoming: { state: 4, combined: 5.56 },
};

/** The five states that levy nothing at state level. Alaska's localities still can. */
export const NO_SALES_TAX = ["Alaska", "Delaware", "Montana", "New Hampshire", "Oregon"];

const US = (state: string | null | undefined): Regime => {
  const s = US_STATES[(state ?? "").trim()];
  if (!s) {
    return {
      heading: "Sales tax",
      components: [salesTax("Sales tax", 0, "monthly")],
      note: "Pick the state the business sells into and this fills in. Sales tax is charged once, at the sale — there is nothing to claim back on what the business buys.",
    };
  }
  return {
    heading: "Sales tax",
    components: [salesTax("Sales tax", s.combined, "monthly")],
    note: s.combined === 0
      ? "This state levies no sales tax. Leave it at nil unless the business sells into a state that does."
      : `${s.state}% state plus what counties and cities add, averaging ${s.combined}%. It is charged once, at the sale, and there is nothing to claim back on what the business buys — the tax it pays on its own purchases is part of the cost.`,
  };
};

/* ------------------------------------------------------------------ *
 * The rest                                                            *
 * ------------------------------------------------------------------ */
const SIMPLE: Record<string, Regime> = {
  Australia: { heading: "GST", components: [vat("GST", 10)], note: "The BAS is lodged and paid a month after each quarter ends." },
  "New Zealand": { heading: "GST", components: [vat("GST", 15, "quarterly", 1)] },
  "United Kingdom": {
    heading: "VAT",
    components: [vat("VAT", 20, "quarterly", 2)],
    note: "A VAT return is due one month and seven days after the quarter ends, so a quarter to 30 June is paid in August — two months on, not one.",
  },
  Ireland: { heading: "VAT", components: [vat("VAT", 23, "quarterly", 1)] },
  Singapore: { heading: "GST", components: [vat("GST", 9)] },
  India: { heading: "GST", components: [vat("GST", 18, "monthly")], note: "A single rate stands in for India's rate slabs and its CGST/SGST/IGST split, which a business plan does not need to model." },
  "South Africa": { heading: "VAT", components: [vat("VAT", 15, "monthly", 1)] },
  Malaysia: { heading: "SST", components: [salesTax("SST", 10, "monthly")], note: "Malaysia replaced GST with SST in 2018: charged once, with nothing to claim back." },
  Japan: { heading: "Consumption tax", components: [vat("Consumption tax", 10)] },
  Germany: { heading: "VAT", components: [vat("VAT", 19, "monthly", 1)] },
  France: { heading: "VAT", components: [vat("VAT", 20, "monthly", 1)] },
  Netherlands: { heading: "VAT", components: [vat("VAT", 21)] },
  Spain: { heading: "VAT", components: [vat("VAT", 21)] },
  Italy: { heading: "VAT", components: [vat("VAT", 22, "monthly", 1)] },
};

/**
 * The tax a business in this place ordinarily charges. `region` is the state or province, and only the
 * United States and Canada use it — everywhere else a country is enough.
 */
export function regimeFor(country: string | null | undefined, region?: string | null): Regime {
  const c = (country ?? "").trim();
  if (c === "United States") return US(region);
  if (c === "Canada") return CANADA[(region ?? "").trim()] ?? {
    heading: "GST",
    components: [vat("GST", 5)],
    note: "Pick the province and this fills in — an HST province charges one combined rate, British Columbia, Saskatchewan and Manitoba add a PST that is never claimed back, and Quebec adds a QST that is.",
  };
  return SIMPLE[c] ?? { heading: "GST", components: [vat("GST", 10)] };
}

/** Whether this country's tax depends on which state or province the business is in. */
export const needsRegion = (country: string | null | undefined) =>
  ["United States", "Canada"].includes((country ?? "").trim());

/** The states or provinces to choose from, for the two countries that need one. */
export const regionsFor = (country: string | null | undefined): string[] => {
  const c = (country ?? "").trim();
  if (c === "United States") return Object.keys(US_STATES).sort();
  if (c === "Canada") return Object.keys(CANADA).sort();
  return [];
};
export const regionLabel = (country: string | null | undefined) =>
  (country ?? "").trim() === "Canada" ? "Province" : "State";

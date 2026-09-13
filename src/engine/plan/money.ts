/**
 * How money reads, in the plan's own currency (§6.30).
 *
 * This is the money twin of `calendar.ts`. Nine modules each carried their own
 * `new Intl.NumberFormat("en-AU", …)`, which nails every plan to Australian grouping regardless of the
 * currency the client chose in Settings — the same fault as the six modules that hardcoded January to
 * December while the plan ran July to June. One fact, nine copies, and the copies were wrong.
 *
 * It matters for four of the thirteen currencies the app offers. A euro plan groups on dots, a rand plan on
 * spaces, and a rupee plan groups in lakh — 21,19,240, not 2,119,240. That last one is not a cosmetic
 * difference: an Indian client reading 2,119,240 as twenty-one lakh would be out by a factor of ten before
 * they reached the second column.
 *
 * No symbol is attached. The plan's currency is stated once on the header chip, and repeating a code or a
 * sign in every cell of a dense grid costs more in noise than it returns in clarity.
 */

/** The market that spells a currency's numbers, not the market that spends it. */
const LOCALE: Record<string, string> = {
  AUD: "en-AU", NZD: "en-NZ", USD: "en-US", GBP: "en-GB", CAD: "en-CA", SGD: "en-SG",
  EUR: "de-DE", ZAR: "en-ZA", INR: "en-IN", PHP: "en-PH", THB: "th-TH", MYR: "ms-MY", IDR: "id-ID",
};

export const localeForCurrency = (currency: string | null | undefined) =>
  LOCALE[String(currency ?? "").toUpperCase().trim()] ?? "en-AU";

/**
 * Whole units, grouped the way that currency's market groups them. Plans are read in thousands and
 * millions; cents in a five-year forecast are noise, and every module already agreed on that.
 */
export function moneyFormatter(currency: string | null | undefined) {
  const fmt = new Intl.NumberFormat(localeForCurrency(currency), { maximumFractionDigits: 0 });
  return (value: number | null | undefined) => fmt.format(Number(value) || 0);
}

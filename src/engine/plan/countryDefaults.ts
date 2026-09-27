/**
 * WHAT A COUNTRY ALREADY ANSWERS (§6.151, open item 49 fixes 3 and 4).
 *
 * The client names the country once. Its currency and the company tax rate a small private company there
 * usually pays follow from it, so neither is asked for separately — both stay changeable for the business
 * that trades in another currency or that its accountant says pays a different rate.
 *
 * The rates are the usual SMALL-COMPANY rate on a typical small business's profits (checked Sep 2026), not
 * the headline rate, because that is who this app is for: Australia's is the 25 % base-rate-entity rate,
 * not 30 %. Where the rate moves with profit, `note` says so — the forecast applies one rate, and the
 * client's accountant knows which band they sit in.
 */
export type CountryDefault = { currency: string; taxRate: number; note?: string };

export const COUNTRY_DEFAULTS: Record<string, CountryDefault> = {
  "Australia": { currency: "AUD", taxRate: 25, note: "The base-rate-entity rate; 30% if turnover is over $50 million or most income is passive." },
  "New Zealand": { currency: "NZD", taxRate: 28 },
  "United States": { currency: "USD", taxRate: 21, note: "Federal only. State tax and pass-through entities (LLCs, S corps) are taxed differently." },
  "United Kingdom": { currency: "GBP", taxRate: 19, note: "The small profits rate, on profits up to £50,000; it rises to 25% by £250,000." },
  "Canada": { currency: "CAD", taxRate: 12, note: "Federal and provincial small business rate on the first $500,000; about 11–12% depending on the province." },
  "Singapore": { currency: "SGD", taxRate: 17, note: "Partial exemptions lower the effective rate on the first S$200,000." },
  "Ireland": { currency: "EUR", taxRate: 12.5, note: "The trading rate; non-trading income is taxed at 25%." },
  "South Africa": { currency: "ZAR", taxRate: 27, note: "Small business corporations pay less on their first profits." },
  "India": { currency: "INR", taxRate: 25, note: "Before surcharge and cess; other regimes apply." },
  "Philippines": { currency: "PHP", taxRate: 20, note: "The rate for smaller corporations; 25% above the income and asset limits." },
  "Thailand": { currency: "THB", taxRate: 20, note: "SMEs pay less on their first 3 million baht of profit." },
  "Malaysia": { currency: "MYR", taxRate: 17, note: "The SME rate on profits from RM150,000 to RM600,000; 15% below, 24% above." },
  "Indonesia": { currency: "IDR", taxRate: 22, note: "Smaller companies get a 50% reduction on part of their profit." },
};

/** The rate every plan was given before this, whatever its country. */
export const GENERIC_TAX_RATE = 25;
export const GENERIC_CURRENCY = "AUD";

export const countryDefault = (country: string | null | undefined): CountryDefault | null =>
  COUNTRY_DEFAULTS[String(country ?? "").trim()] ?? null;

/**
 * WHEN THE COUNTRY CHANGES, what follows it. A value follows only while it is still the OLD country's own
 * default — so a currency or rate the client chose on purpose is never overwritten by a change of country.
 * With no old country (or "Other"), the old default is the generic one every plan started with.
 */
export function followCountry(
  from: string | null | undefined, to: string | null | undefined,
  now: { currency: string | null | undefined; tax_rate: number | null | undefined },
): { currency?: string; tax_rate?: number } {
  const next = countryDefault(to);
  if (!next || String(from ?? "").trim() === String(to ?? "").trim()) return {};
  const was = countryDefault(from);
  const out: { currency?: string; tax_rate?: number } = {};
  const cur = String(now.currency ?? "").toUpperCase();
  if (cur === "" || cur === (was?.currency ?? GENERIC_CURRENCY)) { if (cur !== next.currency) out.currency = next.currency; }
  const rate = Number(now.tax_rate);
  if (!Number.isFinite(rate) || rate === (was?.taxRate ?? GENERIC_TAX_RATE)) { if (rate !== next.taxRate) out.tax_rate = next.taxRate; }
  return out;
}

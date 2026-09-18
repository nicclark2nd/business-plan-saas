/**
 * Whose laws the plan says it is governed by (§6.95.1).
 *
 * The confidentiality notice originally ended "in accordance with local laws" — true of every plan and
 * useful to nobody, when Plan settings already knows the country the business trades in.
 *
 * WHAT IT WILL AND WILL NOT SAY. It names a place only where a client has NAMED one. "Other" is the option
 * a client picks when the list does not have their country, so it is an absence rather than an answer, and
 * a notice claiming to be governed by the laws of Other would be worse than the vague version it replaced.
 * No country, or "Other", and the wording falls back to exactly what Nic wrote.
 *
 * THE STATE IS THE ONE ALREADY CAPTURED, NOT A NEW FIELD. `plan_settings.tax_region` exists because sales
 * tax in the United States and Canada depends on it (§6.39) — so those two countries have a state or
 * province on record and every other country does not. This uses it where it is there and says nothing
 * where it is not. Adding a second "main state of operation" beside it would be two fields meaning one
 * thing (§6.41), and the answer to a US plan would then depend on which of them a client filled in.
 */

/** A country a client actively picked. "Other" means the list did not have theirs, which is not a place. */
const named = (v: string | null | undefined) => {
  const s = String(v ?? "").trim();
  return s && s.toLowerCase() !== "other" ? s : null;
};

/**
 * The phrase that follows "governed by and construed in accordance with". Never a sentence, never
 * punctuated — the notice owns its own full stop.
 */
export function governingLaw(country: string | null | undefined, region?: string | null): string {
  const c = named(country);
  if (!c) return "local laws";
  const r = named(region);
  return r ? `the laws of ${r}, ${c}` : `the laws of ${c}`;
}

/**
 * What the screen can tell a client their plan will say, so the wording is not a surprise in the downloaded
 * file. Returns null where there is nothing worth saying.
 */
export const governingLawNote = (country: string | null | undefined, region?: string | null): string | null =>
  named(country) ? governingLaw(country, region) : null;

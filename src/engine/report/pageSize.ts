/**
 * What paper the Word download is laid out for (§6.93).
 *
 * THIS WAS NOT A SETTING, AND THAT WAS A BUG. `docx.ts` set margins and never set a page size, so the
 * document rode the `docx` library's own default — A4 portrait, 11906 × 16838 twips. Every plan this app
 * has ever produced printed A4, including the ones written in Dallas. Nobody decided that; a dependency did.
 *
 * IT IS DERIVED, NOT ASKED. A client in Brisbane should never be shown this question, so the stored value is
 * null for almost every plan and the country answers it. A stored 'a4' would be indistinguishable from a
 * client who chose A4, and a plan that later changes country would keep the old country's paper.
 *
 * THE SCREEN REPORT IS NOT AFFECTED. Its 900px measure is a reading width, not a paper size (§6.92). This
 * setting reaches the .docx and nothing else, and the label on the screen says so.
 */
export type PageSize = "a4" | "letter";

/** Width and height in twips — the unit `docx` takes, 1/1440 inch. */
export const PAGE_DIMENSIONS: Record<PageSize, { width: number; height: number }> = {
  a4: { width: 11906, height: 16838 },      // 210 × 297 mm
  letter: { width: 12240, height: 15840 },  // 8.5 × 11 in
};

export const PAGE_SIZE_LABEL: Record<PageSize, string> = {
  a4: "A4 — 210 × 297 mm",
  letter: "Letter — 8.5 × 11 in",
};

/**
 * The countries that use Letter. Short on purpose: it is the exception list, and everywhere the app offers
 * that is not on it uses A4, which is most of the world.
 */
const LETTER_COUNTRIES = new Set([
  "united states", "usa", "us", "united states of america",
  "canada", "mexico", "philippines", "chile", "colombia", "costa rica",
]);

/** The paper a plan in this country would ordinarily be printed on. */
export const defaultPageSizeFor = (country: string | null | undefined): PageSize =>
  LETTER_COUNTRIES.has(String(country ?? "").trim().toLowerCase()) ? "letter" : "a4";

/** What the document is actually built at: the client's choice if they made one, the country's answer if not. */
export const resolvePageSize = (stored: string | null | undefined, country: string | null | undefined): PageSize =>
  stored === "a4" || stored === "letter" ? stored : defaultPageSizeFor(country);

/**
 * THE FIRM'S COLOUR (§6.180).
 *
 * Stored as "#RRGGBB", upper case — the one shape the database check (0058) accepts, so a colour typed as
 * "1f3a5f", "#1F3A5F" or "#abc" is the same colour everywhere after it is saved.
 *
 * PRINTED READABLE, WHATEVER WAS CHOSEN. A firm whose colour is a pale gold still wants its headings in
 * gold, but gold text on white paper cannot be read. `readable` darkens the colour — same hue, less light —
 * until it reaches 3:1 against white, the contrast large text needs. The firm's own swatch is untouched;
 * only the ink on the page is a shade deeper, and the settings screen says so.
 */

export const DEFAULT_BRAND = "#1F3A5F";

export function cleanColour(v: string | null | undefined): string | null {
  const s = String(v ?? "").trim().replace(/^#/, "");
  if (/^[0-9a-f]{6}$/i.test(s)) return `#${s.toUpperCase()}`;
  if (/^[0-9a-f]{3}$/i.test(s)) return `#${s.split("").map((c) => c + c).join("").toUpperCase()}`;
  return null;
}

const channel = (c: number) => {
  const x = c / 255;
  return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
};
const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
const luminance = ([r, g, b]: [number, number, number]) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);

/** Contrast against white paper, 1 (none) to 21 (black). */
export const contrastOnWhite = (hex: string) => 1.05 / (luminance(rgb(hex)) + 0.05);

const MIN_CONTRAST = 3;

/** The colour as it will print: the same, or a shade darker until it can be read on white. */
export function readable(hex: string): string {
  let c = rgb(hex);
  for (let i = 0; i < 40 && 1.05 / (luminance(c) + 0.05) < MIN_CONTRAST; i++) {
    c = c.map((x) => Math.round(x * 0.92)) as [number, number, number];
  }
  return `#${c.map((x) => x.toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}

/** Six hex digits, no '#', as Word wants it. */
export const wordColour = (hex: string | null | undefined) => readable(cleanColour(hex) ?? DEFAULT_BRAND).slice(1);

/**
 * THE "PREPARED BY" LINE, built from the details when the firm has not written its own: the firm's name,
 * then its phone, then the consultant's email — the old system's "Coached by: … | … | …", without the
 * consultant having to type what the firm already holds.
 */
export function preparedByLine(firm: { name: string; phone: string | null; website: string | null; preparedBy: string | null }, email?: string | null): string {
  if (firm.preparedBy) return firm.preparedBy;
  return [`Prepared by ${firm.name}`, firm.phone, email ?? firm.website].filter(Boolean).join(" · ");
}

/**
 * THOUSANDS IN A BOX (§6.130). "1000000" makes a client count zeros; "1,000,000" does not.
 *
 * Display only. The box's value stays the raw string the client typed, and every parser in the app already
 * strips anything that is not a digit, point or minus — so a pasted "$1,000,000" saves the same as
 * "1000000". Grouping is applied while the box is NOT focused and left off while it is, so the cursor never
 * jumps as commas appear under it.
 *
 * Anything that does not read as a number is shown exactly as typed: the box must never hide what was
 * entered behind a tidied-up version of something else (§6.106.3).
 */
export function groupDigits(raw: string): string {
  const t = raw.trim();
  if (!t) return raw;
  const bare = t.replace(/[$,\s]/g, "");
  if (!/^-?\d+(\.\d*)?$/.test(bare)) return raw;
  const neg = bare.startsWith("-");
  const [int, dec] = (neg ? bare.slice(1) : bare).split(".");
  const grouped = int.replace(/^0+(?=\d)/, "").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${neg ? "-" : ""}${grouped}${dec !== undefined ? `.${dec}` : ""}`;
}

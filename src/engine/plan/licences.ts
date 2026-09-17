/**
 * When a licence needs attention (§6.64).
 *
 * The obvious rule — "warn if it expires within a year" — is worse than useless here. A QBCC contractor
 * licence, a public liability policy and a vehicle registration are all renewed ANNUALLY, so every licence
 * a business holds is always inside twelve months of running out. A plan that flags all of them, always,
 * has taught its owner to ignore the flag by the second read.
 *
 * So only two states say anything. A licence that has ALREADY lapsed is a fact about the business today and
 * belongs in the SWOT as a threat. A licence inside the renewal window is a reminder on the screen where it
 * is typed, and nowhere else — it is diary work, not strategy.
 */
export type LicenceState = "lapsed" | "soon" | "current" | "no-expiry";

/** Inside this many days of expiry, the screen says so. Deliberately shorter than any annual renewal cycle. */
export const RENEWAL_WINDOW_DAYS = 60;

const DAY = 86_400_000;
/** Midnight UTC for an ISO date, so a plan read in Brisbane and in London classifies a licence the same way. */
const utc = (iso: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
  return m ? Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : NaN;
};

export function licenceState(expiresOn: string | null | undefined, today: Date | string): LicenceState {
  if (!expiresOn || !String(expiresOn).trim()) return "no-expiry";
  const end = utc(String(expiresOn));
  const now = utc(typeof today === "string" ? today : today.toISOString());
  if (!Number.isFinite(end) || !Number.isFinite(now)) return "no-expiry";
  const days = Math.round((end - now) / DAY);
  if (days < 0) return "lapsed";
  return days <= RENEWAL_WINDOW_DAYS ? "soon" : "current";
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "3 Mar 2026" — a licence lapses on a day, so the day is printed. */
export function formatExpiry(expiresOn: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(expiresOn ?? "").trim());
  return m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}` : "";
}

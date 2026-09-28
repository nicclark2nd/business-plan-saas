import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * IS THIS NOTICE REALLY FROM STRIPE? (§6.185)
 *
 * Stripe signs every notice with the endpoint's signing secret: the header carries a timestamp `t` and one or
 * more `v1` signatures, each an HMAC-SHA256 of `${t}.${raw body}`. The body must be the bytes exactly as they
 * arrived — parsed and re-serialised JSON is a different string and never matches.
 *
 * Written here rather than pulled in with Stripe's library: the check is ten lines, it is the one piece that
 * decides whether anything else runs, and a pure function of (body, header, secret, now) can be tested with
 * a signature made in the test.
 *
 * Five minutes of tolerance, as Stripe recommends, so a notice captured and replayed later is refused.
 */
export const TOLERANCE_SECONDS = 300;

export function verifyStripeSignature(body: string, header: string | null, secret: string, nowSeconds = Math.floor(Date.now() / 1000)): boolean {
  if (!header || !secret) return false;
  const parts = header.split(",").map((p) => p.trim().split("=") as [string, string]);
  const t = Number(parts.find(([k]) => k === "t")?.[1]);
  const sigs = parts.filter(([k]) => k === "v1").map(([, v]) => v).filter(Boolean);
  if (!Number.isFinite(t) || !sigs.length) return false;
  if (Math.abs(nowSeconds - t) > TOLERANCE_SECONDS) return false;
  const expected = Buffer.from(createHmac("sha256", secret).update(`${t}.${body}`, "utf8").digest("hex"), "utf8");
  return sigs.some((s) => {
    const got = Buffer.from(s, "utf8");
    return got.length === expected.length && timingSafeEqual(got, expected);
  });
}

/** For tests: the header Stripe would send for this body. */
export function signForTest(body: string, secret: string, t: number): string {
  return `t=${t},v1=${createHmac("sha256", secret).update(`${t}.${body}`, "utf8").digest("hex")}`;
}

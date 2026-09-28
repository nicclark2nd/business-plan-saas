import "server-only";
import { formEncode, levelFromPrice, type Level } from "@/engine/billing/stripeObjects";

/**
 * THE ONE PLACE THIS APP TALKS TO STRIPE (§6.185).
 *
 * Plain HTTPS rather than Stripe's library: this app makes five calls (list prices, create a checkout, open the
 * billing portal, read a subscription, read a checkout's items), and a dependency for five calls is more to
 * keep up than the calls themselves.
 *
 * SERVER ONLY. `STRIPE_SECRET_KEY` has no `NEXT_PUBLIC_` prefix and is read nowhere else. No card number ever
 * reaches this app: paying happens on Stripe's own pages.
 */
export class StripeUnavailable extends Error {}

const API = "https://api.stripe.com/v1";

function key(): string {
  if (typeof window !== "undefined") throw new StripeUnavailable("Stripe must never be called from a browser.");
  const k = process.env.STRIPE_SECRET_KEY;
  if (!k) throw new StripeUnavailable("Payments are not set up on this server yet.");
  return k;
}

export async function stripe<T = Record<string, unknown>>(path: string, o: { method?: "GET" | "POST"; params?: Record<string, unknown> } = {}): Promise<T> {
  const method = o.method ?? "GET";
  const qs = o.params ? formEncode(o.params) : "";
  const res = await fetch(`${API}${path}${method === "GET" && qs ? `?${qs}` : ""}`, {
    method,
    headers: { Authorization: `Bearer ${key()}`, "Content-Type": "application/x-www-form-urlencoded", "Stripe-Version": "2024-06-20" },
    body: method === "POST" ? qs : undefined,
    cache: "no-store",
  });
  const j = (await res.json().catch(() => ({}))) as { error?: { message?: string } } & T;
  if (!res.ok) {
    console.error("stripe", path, res.status, j?.error?.message);
    throw new StripeUnavailable(j?.error?.message ?? `Stripe refused the request (${res.status}).`);
  }
  return j;
}

/** Every price this app sells, read from Stripe each time (Nic sets prices there, not here). */
export async function listLevels(): Promise<Level[]> {
  const r = await stripe<{ data: unknown[] }>("/prices", { params: { active: "true", limit: 100, expand: ["data.product"] } });
  return r.data.map(levelFromPrice).filter((l): l is Level => !!l)
    .sort((a, b) => (a.amount ?? 0) - (b.amount ?? 0));
}

export async function getLevel(priceId: string): Promise<Level | null> {
  try {
    return levelFromPrice(await stripe(`/prices/${encodeURIComponent(priceId)}`, { params: { expand: ["product"] } }));
  } catch {
    return null;
  }
}

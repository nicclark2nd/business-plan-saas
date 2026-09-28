/**
 * WHAT A STRIPE OBJECT MEANS TO THIS APP (§6.185) — pure readers over Stripe's JSON, so the rules are tested
 * without a network.
 *
 * THE CONVENTION NIC SETS UP IN STRIPE. Every product this app sells carries metadata:
 *
 *   bizplanhq = "firm"        a consultant's subscription     plans = how many active client plans it includes
 *   bizplanhq = "owner"       a business owner's subscription plans = how many active plans it includes
 *   bizplanhq = "extra_plan"  a one-off purchase               plans = plans per unit bought (default 1)
 *
 * A product without `bizplanhq` is not this app's and is never offered or counted. Prices are read from Stripe
 * each time, so a price changed in Stripe is the price shown — nothing here holds a number.
 */

export type ProductKind = "firm" | "owner" | "extra_plan";

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj | null => (v && typeof v === "object" ? (v as Obj) : null);
const str = (v: unknown) => (typeof v === "string" && v ? v : null);
const int = (v: unknown, dflt = 0) => {
  const n = Math.trunc(Number(v));
  return Number.isFinite(n) && n >= 0 ? n : dflt;
};

export function productKind(product: unknown): ProductKind | null {
  const k = str(obj(obj(product)?.metadata)?.bizplanhq);
  return k === "firm" || k === "owner" || k === "extra_plan" ? k : null;
}
export const productPlans = (product: unknown, dflt = 0) => int(obj(obj(product)?.metadata)?.plans, dflt);

/** A price offered on the billing page. */
export type Level = {
  priceId: string; kind: ProductKind; name: string; description: string | null;
  plans: number; amount: number | null; currency: string; interval: string | null; recurring: boolean;
};

export function levelFromPrice(price: unknown): Level | null {
  const p = obj(price);
  const product = obj(p?.product);
  if (!p || !product || p.active === false || product.active === false) return null;
  const kind = productKind(product);
  if (!kind) return null;
  const recurring = !!obj(p.recurring);
  if ((kind === "extra_plan") === recurring) return null; // an extra plan is one-off; a subscription recurs
  return {
    priceId: String(p.id), kind, name: str(product.name) ?? "Plan", description: str(product.description),
    plans: productPlans(product, kind === "extra_plan" ? 1 : 0),
    amount: typeof p.unit_amount === "number" ? p.unit_amount : null,
    currency: (str(p.currency) ?? "aud").toUpperCase(),
    interval: str(obj(p.recurring)?.interval), recurring,
  };
}

/** The subscription, as the database records it (billing_apply_subscription). */
export type SubscriptionFacts = {
  org: string | null; customer: string | null; subscription: string; status: string;
  price: string | null; level: string | null; plans: number; periodEnd: string | null; cancelAtEnd: boolean;
};

export function subscriptionFacts(sub: unknown): SubscriptionFacts | null {
  const s = obj(sub);
  if (!s || !str(s.id)) return null;
  const item = obj((obj(s.items)?.data as unknown[] | undefined)?.[0]);
  const price = obj(item?.price);
  const product = obj(price?.product);
  const kind = productKind(product);
  /* Newer API versions carry the period on the item; older ones on the subscription. */
  const end = Number(item?.current_period_end ?? s.current_period_end);
  const customer = typeof s.customer === "string" ? s.customer : str(obj(s.customer)?.id);
  return {
    org: str(obj(s.metadata)?.organisation_id), customer, subscription: String(s.id),
    status: str(s.status) ?? "none",
    price: str(price?.id), level: str(product?.name),
    /* A subscription to something that is not one of this app's levels counts for nothing. */
    plans: kind === "firm" || kind === "owner" ? productPlans(product) : 0,
    periodEnd: Number.isFinite(end) && end > 0 ? new Date(end * 1000).toISOString() : null,
    cancelAtEnd: s.cancel_at_period_end === true,
  };
}

/** Extra plans in a completed one-off checkout: quantity × plans per unit, over this app's extra-plan items. */
export function extraPlansBought(lineItems: unknown): number {
  const data = (obj(lineItems)?.data as unknown[] | undefined) ?? [];
  return data.reduce<number>((sum, li) => {
    const l = obj(li);
    const product = obj(obj(l?.price)?.product);
    return productKind(product) === "extra_plan" ? sum + int(l?.quantity) * productPlans(product, 1) : sum;
  }, 0);
}

/** Stripe's form encoding: nested keys as a[b][0][c]=v. */
export function formEncode(params: Record<string, unknown>, prefix = ""): string {
  const out: string[] = [];
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) v.forEach((x, i) => {
      if (x && typeof x === "object") out.push(formEncode(x as Record<string, unknown>, `${key}[${i}]`));
      else out.push(`${encodeURIComponent(`${key}[${i}]`)}=${encodeURIComponent(String(x))}`);
    });
    else if (typeof v === "object") out.push(formEncode(v as Record<string, unknown>, key));
    else out.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`);
  }
  return out.filter(Boolean).join("&");
}

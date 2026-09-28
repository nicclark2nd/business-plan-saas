import { describe, it, expect } from "vitest";
import { signForTest, verifyStripeSignature } from "./signature";
import { extraPlansBought, formEncode, levelFromPrice, subscriptionFacts } from "./stripeObjects";

const SECRET = "whsec_test_secret";
const body = JSON.stringify({ id: "evt_1", type: "checkout.session.completed" });

describe("a notice really from Stripe (§6.185)", () => {
  const t = 1_800_000_000;
  it("accepts the signature Stripe would send", () => {
    expect(verifyStripeSignature(body, signForTest(body, SECRET, t), SECRET, t + 10)).toBe(true);
  });
  it("refuses a changed body, a wrong secret, an old notice and no header", () => {
    const h = signForTest(body, SECRET, t);
    expect(verifyStripeSignature(body.replace("evt_1", "evt_2"), h, SECRET, t)).toBe(false);
    expect(verifyStripeSignature(body, h, "whsec_other", t)).toBe(false);
    expect(verifyStripeSignature(body, h, SECRET, t + 301)).toBe(false);
    expect(verifyStripeSignature(body, null, SECRET, t)).toBe(false);
    expect(verifyStripeSignature(body, "t=abc,v1=", SECRET, t)).toBe(false);
  });
  it("accepts any one of several signatures (Stripe sends two while a secret is being rolled)", () => {
    const good = signForTest(body, SECRET, t).split(",")[1];
    expect(verifyStripeSignature(body, `t=${t},v1=deadbeef,${good}`, SECRET, t)).toBe(true);
  });
});

const product = (meta: Record<string, string>, over: Record<string, unknown> = {}) => ({ id: "prod_1", name: "Bronze", active: true, metadata: meta, ...over });

describe("reading Stripe's objects", () => {
  it("offers only this app's products, subscriptions recurring and extra plans one-off", () => {
    const sub = levelFromPrice({ id: "price_1", active: true, unit_amount: 9900, currency: "aud", recurring: { interval: "month" }, product: product({ bizplanhq: "firm", plans: "10" }) });
    expect(sub).toMatchObject({ kind: "firm", plans: 10, amount: 9900, currency: "AUD", interval: "month", recurring: true });
    expect(levelFromPrice({ id: "p", active: true, recurring: null, product: product({ bizplanhq: "extra_plan" }) })).toMatchObject({ kind: "extra_plan", plans: 1 });
    expect(levelFromPrice({ id: "p", active: true, recurring: { interval: "month" }, product: product({}) })).toBeNull();
    expect(levelFromPrice({ id: "p", active: true, recurring: null, product: product({ bizplanhq: "firm", plans: "10" }) })).toBeNull();
    expect(levelFromPrice({ id: "p", active: false, recurring: { interval: "month" }, product: product({ bizplanhq: "firm" }) })).toBeNull();
  });

  it("reads a subscription, on either API shape of the period end", () => {
    const f = subscriptionFacts({
      id: "sub_1", status: "active", customer: "cus_1", cancel_at_period_end: true, metadata: { organisation_id: "org-1" },
      items: { data: [{ current_period_end: 1_800_000_000, price: { id: "price_1", product: product({ bizplanhq: "firm", plans: "10" }) } }] },
    })!;
    expect(f).toMatchObject({ org: "org-1", customer: "cus_1", status: "active", price: "price_1", level: "Bronze", plans: 10, cancelAtEnd: true });
    expect(f.periodEnd).toBe(new Date(1_800_000_000_000).toISOString());
    expect(subscriptionFacts({ id: "sub_2", status: "active", current_period_end: 1_800_000_000, items: { data: [{ price: { id: "p", product: product({}) } }] } })!)
      .toMatchObject({ plans: 0, periodEnd: new Date(1_800_000_000_000).toISOString(), org: null });
  });

  it("counts extra plans bought: quantity × plans per unit, this app's items only", () => {
    expect(extraPlansBought({ data: [
      { quantity: 3, price: { product: product({ bizplanhq: "extra_plan" }) } },
      { quantity: 2, price: { product: product({ bizplanhq: "extra_plan", plans: "5" }) } },
      { quantity: 9, price: { product: product({}) } },
    ] })).toBe(13);
  });

  it("encodes nested parameters the way Stripe reads them", () => {
    expect(formEncode({ mode: "payment", line_items: [{ price: "p_1", quantity: 2 }], metadata: { organisation_id: "o" } }))
      .toBe("mode=payment&line_items%5B0%5D%5Bprice%5D=p_1&line_items%5B0%5D%5Bquantity%5D=2&metadata%5Borganisation_id%5D=o");
  });
});

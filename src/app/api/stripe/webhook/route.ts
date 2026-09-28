import { createClient } from "@supabase/supabase-js";
import { verifyStripeSignature } from "@/engine/billing/signature";
import { extraPlansBought, subscriptionFacts } from "@/engine/billing/stripeObjects";
import { stripe } from "@/lib/stripe";

/**
 * STRIPE'S NOTICES (§6.185) — "someone paid", "a subscription changed", "a subscription ended".
 *
 * TWO LOCKS, EITHER OF WHICH STOPS A FORGED NOTICE.
 *
 *   1. The signature: every notice must be signed with this endpoint's secret from Stripe
 *      (`STRIPE_WEBHOOK_SECRET`), over the exact bytes received. Unsigned or altered, it is refused here.
 *   2. The one-job password (Nic's choice, migration 0062): the database accepts a billing change only with
 *      `BILLING_DB_SECRET`, and that password opens nothing but billing records. There is no master key.
 *
 * NEVER TRUST THE NOTICE'S COPY OF A SUBSCRIPTION. Notices can arrive out of order — "updated" before
 * "created" — so the subscription is read fresh from Stripe every time and its CURRENT state recorded.
 *
 * Answers 200 once a notice is recorded (or is one this app does not act on), and 500 when recording failed,
 * so Stripe tries again. Each notice is recorded once, however often it is sent.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const HANDLED = new Set([
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
]);

function db() {
  /* The publishable key and no session: the database treats this as nobody. Only the password gets it further. */
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function recordSubscription(eventId: string, eventType: string, subscriptionId: string, orgHint: string | null) {
  const sub = await stripe(`/subscriptions/${encodeURIComponent(subscriptionId)}`, { params: { expand: ["items.data.price.product"] } });
  const f = subscriptionFacts(sub);
  if (!f) throw new Error("unreadable subscription");
  const org = f.org ?? orgHint;
  if (!org) return; // not one of ours
  const { error } = await db().rpc("billing_apply_subscription", {
    p_secret: process.env.BILLING_DB_SECRET, p_event_id: eventId, p_event_type: eventType, p_org: org,
    p_customer: f.customer, p_subscription: f.subscription, p_status: f.status, p_price: f.price, p_level: f.level,
    p_plans: f.plans, p_period_end: f.periodEnd, p_cancel_at_end: f.cancelAtEnd,
  });
  if (error) throw error;
}

export async function POST(req: Request) {
  const body = await req.text();
  const secret = process.env.STRIPE_WEBHOOK_SECRET ?? "";
  if (!verifyStripeSignature(body, req.headers.get("stripe-signature"), secret)) {
    return new Response("Signature refused.", { status: 400 });
  }
  let event: { id: string; type: string; data: { object: Record<string, unknown> } };
  try { event = JSON.parse(body); } catch { return new Response("Malformed.", { status: 400 }); }
  if (!HANDLED.has(event.type)) return new Response("Not acted on.", { status: 200 });

  try {
    const o = event.data.object;
    if (event.type === "checkout.session.completed") {
      const org = (typeof o.client_reference_id === "string" ? o.client_reference_id : null)
        ?? ((o.metadata as Record<string, string> | undefined)?.organisation_id ?? null);
      if (o.mode === "subscription" && typeof o.subscription === "string") {
        await recordSubscription(event.id, event.type, o.subscription, org);
      } else if (o.mode === "payment" && org && o.payment_status === "paid") {
        const items = await stripe(`/checkout/sessions/${encodeURIComponent(String(o.id))}/line_items`, { params: { expand: ["data.price.product"], limit: 100 } });
        const n = extraPlansBought(items);
        if (n > 0) {
          const { error } = await db().rpc("billing_add_extra_plans", {
            p_secret: process.env.BILLING_DB_SECRET, p_event_id: event.id, p_org: org,
            p_customer: typeof o.customer === "string" ? o.customer : null, p_quantity: n,
          });
          if (error) throw error;
        }
      }
    } else if (typeof o.id === "string") {
      await recordSubscription(event.id, event.type, o.id, null);
    }
    return new Response("Recorded.", { status: 200 });
  } catch (e) {
    console.error("stripe webhook", event.type, event.id, e);
    return new Response("Not recorded — try again.", { status: 500 });
  }
}

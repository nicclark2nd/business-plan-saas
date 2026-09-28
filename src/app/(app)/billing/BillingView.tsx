import { Button } from "@/components/ui/button";
import { accountFor, allowanceFor, type BillingOrg } from "@/lib/billing";
import { StripeUnavailable, listLevels } from "@/lib/stripe";
import type { Level } from "@/engine/billing/stripeObjects";

const money = (cents: number | null, currency: string) =>
  cents === null ? "" : new Intl.NumberFormat("en-AU", { style: "currency", currency, maximumFractionDigits: cents % 100 ? 2 : 0 }).format(cents / 100);
const date = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" }) : "");
const STATUS: Record<string, string> = {
  active: "Active", trialing: "Trial", past_due: "Payment overdue — Stripe is retrying the card", canceled: "Cancelled",
  unpaid: "Unpaid", incomplete: "Payment not finished", incomplete_expired: "Payment not finished", paused: "Paused", none: "No subscription",
};

/**
 * BILLING (§6.185) — what the organisation pays for, how many of its plans are in use, and the way to Stripe.
 *
 * Every price shown is read from Stripe as the page opens: Nic sets levels and prices there. Paying, changing
 * card and cancelling all happen on Stripe's own pages — nothing about a card is typed into this app.
 */
export async function BillingView({ org, notice }: { org: BillingOrg; notice?: string }) {
  const [allowance, account] = await Promise.all([allowanceFor(org.id), accountFor(org.id)]);
  let levels: Level[] = [];
  let stripeDown: string | null = null;
  try { levels = await listLevels(); } catch (e) { stripeDown = e instanceof StripeUnavailable ? e.message : "Couldn't reach Stripe."; }
  const subs = levels.filter((l) => l.kind === org.kind);
  const extras = levels.filter((l) => l.kind === "extra_plan");
  const paid = !!allowance?.paid;
  const ro = !org.isAdmin;
  const full = allowance ? allowance.used >= allowance.allowed : false;

  return (
    <div className="pb-10">
      <div className="border-b border-border px-5 py-4">
        <div className="eyebrow">Billing</div>
        <h1 className="text-[22px] font-semibold">{org.kind === "firm" ? `${org.name}'s subscription` : "Your subscription"}</h1>
        <p className="mt-1 max-w-[80ch] text-[13px] text-muted-foreground">
          {org.kind === "firm"
            ? "Your subscription covers a number of active client plans at a time. Archiving a finished client frees a place. Extra plans can be added on top."
            : "Your subscription covers a number of active plans at a time. Archiving one you've finished with frees a place."}
          {" "}Paying, changing your card and cancelling all happen on Stripe&apos;s secure pages.
          {ro && <b className="text-foreground"> Only your firm&apos;s admin can change billing.</b>}
        </p>
        {notice && <p className="mt-2 text-[12.5px] font-semibold" role="status">{notice === "done" ? "Thank you — Stripe has your payment. It can take a few seconds to show here; refresh if it hasn't." : notice}</p>}
      </div>

      <section className="grid gap-px border-b border-border bg-border sm:grid-cols-3">
        <div className="bg-background px-5 py-4">
          <div className="eyebrow">Plans in use</div>
          <div className={full ? "mt-1 text-[26px] font-semibold text-warn" : "mt-1 text-[26px] font-semibold"}>
            {allowance ? <>{allowance.used}<span className="text-[15px] font-normal text-muted-foreground"> of {allowance.allowed}</span></> : "—"}
          </div>
          <p className="text-[12px] text-muted-foreground">{full ? "All in use. Archive one, or add more." : "Active plans. Archived ones don't count."}</p>
        </div>
        <div className="bg-background px-5 py-4">
          <div className="eyebrow">Subscription</div>
          <div className="mt-1 text-[16px] font-semibold">{account?.level ?? (paid ? "Active" : "None yet")}</div>
          <p className="text-[12px] text-muted-foreground">
            {STATUS[account?.status ?? "none"] ?? account?.status}
            {account?.periodEnd && paid && <> · {account.cancelAtEnd ? "ends" : "renews"} {date(account.periodEnd)}</>}
          </p>
        </div>
        <div className="bg-background px-5 py-4">
          <div className="eyebrow">Made up of</div>
          <p className="mt-1 text-[12.5px] leading-relaxed">
            {paid ? <>{account?.plansIncluded ?? 0} in the subscription</> : <>1 to start with, before subscribing</>}
            {!!account?.extraPlans && <><br />{account.extraPlans} extra bought{!paid && " (count again once subscribed)"}</>}
            {!!account?.grantedPlans && <><br />{account.grantedPlans} given by BizPlanHQ</>}
          </p>
        </div>
      </section>

      <div className="px-5 py-5">
        {stripeDown && <p className="mb-4 rounded border border-border bg-secondary/50 px-3 py-2 text-[13px]">{stripeDown}</p>}

        {!paid && !stripeDown && (
          <>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-[.05em] text-muted-foreground">Choose a subscription</h2>
            {subs.length === 0 ? <p className="text-[13px] text-muted-foreground">No subscriptions are on sale yet.</p> : (
              <div className="grid max-w-[980px] gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {subs.map((l) => (
                  <form key={l.priceId} action="/billing/checkout" method="post" className="flex flex-col rounded-md border border-border p-4">
                    <input type="hidden" name="price" value={l.priceId} />
                    <div className="text-[15px] font-semibold">{l.name}</div>
                    <div className="mt-1 text-[22px] font-semibold">{money(l.amount, l.currency)}<span className="text-[13px] font-normal text-muted-foreground"> / {l.interval ?? "period"}</span></div>
                    <p className="mt-1 text-[13px]">Up to <b>{l.plans}</b> active {org.kind === "firm" ? "client plans" : "plans"}</p>
                    {l.description && <p className="mt-1 text-[12px] text-muted-foreground">{l.description}</p>}
                    <div className="flex-1" />
                    <Button type="submit" className="mt-3" disabled={ro}>Subscribe →</Button>
                  </form>
                ))}
              </div>
            )}
          </>
        )}

        {paid && (
          <div className="flex max-w-[980px] flex-wrap items-start gap-6">
            {extras.length > 0 && !stripeDown && (
              <div className="min-w-[300px] flex-1 rounded-md border border-border p-4">
                <h2 className="text-[15px] font-semibold">Add extra plans</h2>
                <p className="mt-1 text-[12.5px] text-muted-foreground">Bought once, on top of your subscription, while it stays active.</p>
                {extras.map((l) => (
                  <form key={l.priceId} action="/billing/checkout" method="post" className="mt-3 flex flex-wrap items-center gap-2">
                    <input type="hidden" name="price" value={l.priceId} />
                    <span className="text-[13px]">{l.name} — {money(l.amount, l.currency)} for {l.plans === 1 ? "1 plan" : `${l.plans} plans`}</span>
                    <span className="flex-1" />
                    <label className="text-[12.5px] text-muted-foreground">How many <input name="quantity" type="number" min={1} max={50} defaultValue={1} disabled={ro}
                      className="ml-1 h-8 w-16 rounded-md border border-input bg-background px-2 text-right text-[13px]" /></label>
                    <Button type="submit" size="sm" disabled={ro}>Buy →</Button>
                  </form>
                ))}
              </div>
            )}
            <form action="/billing/portal" method="post" className="min-w-[260px] rounded-md border border-border p-4">
              <h2 className="text-[15px] font-semibold">Manage billing</h2>
              <p className="mt-1 text-[12.5px] text-muted-foreground">Change level, update your card, download invoices or cancel — on Stripe&apos;s page.</p>
              <Button type="submit" variant="outline" className="mt-3" disabled={ro || !account?.hasCustomer}>Open Stripe billing →</Button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

import { loadCapabilityFacts } from "@/lib/capabilityFacts";
import { moneyFormatter } from "@/engine/plan/money";
import { actualYear, capabilityViews } from "@/engine/capability/actual";
import { buildView } from "@/engine/capability/views";
import { cashBridge, issuesFrom, profitBridge } from "@/engine/capability/assessment";
import { DIAL_LABEL, SCORE_BANDS, statusOf } from "@/engine/capability/model";
import { verdict } from "@/engine/capability/verdict";
import { BORROW_WEIGHTS } from "@/engine/capability/borrow";
import { SELL_WEIGHTS } from "@/engine/capability/sell";
import { readTargets } from "@/engine/capability/targets";
import { createClient } from "@/lib/supabase/server";
import { AssessmentModule, type AssessmentData } from "./AssessmentModule";

/**
 * THE PLANNER'S ASSESSMENT (§6.164) — step 8, between the accounts and the first projection.
 *
 * Reads the same facts Financial Capabilities reads (`loadCapabilityFacts`) and only the actual view of them:
 * the last two years of accounts. Everything here is worked out on the server and handed down as figures and
 * sentences, so the screen is a reading, not a calculator.
 */
const PAST: Record<string, string> = {
  "The growth plan does not fund itself": "Growth so far has not paid for itself",
  "Worth doing, but it will be tight on cash": "Growing, but tight on cash",
  "The growth stands up": "The growth so far stands up",
};

export default async function AssessmentPage({ params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params;
  const supabase = await createClient();
  const [f, stored] = await Promise.all([
    loadCapabilityFacts(planId),
    supabase.from("plan_settings").select("agreed_targets, cash_floor, existing_debt").eq("plan_id", planId).maybeSingle().then((r) => r.data),
  ]);
  const money = moneyFormatter(f.currency);
  const views = capabilityViews(f.facts, f.history, f.firstYear);

  let data: AssessmentData = { hasHistory: false, adviser: f.adviser };
  if (views.actual) {
    const a = views.actual, last = a.last;
    const prev = actualYear(f.history, 2, f.firstYear);
    const V = buildView(a, money, last);
    const weights = { grow: V.growWeights, borrow: BORROW_WEIGHTS, sell: SELL_WEIGHTS };
    const scores = (["grow", "borrow", "sell"] as const).map((kind) => {
      const value = V.scores[kind].value;
      const band = value === null ? null : statusOf(value, SCORE_BANDS);
      const head = verdict(kind, V[kind], weights[kind], value).headline;
      return { kind, value, band, label: band ? DIAL_LABEL[kind][band] : "Not enough to judge", headline: PAST[head] ?? head };
    });

    const x = f.extras, facts = f.facts, h1 = f.history.find((r) => Number(r.period_number) === 1);
    const stressSet = facts.stress.salesPct !== null && facts.stress.marginPts !== null && facts.stress.debtorDaysAdded !== null;
    const asks = [
      { label: "The largest customers, and each one's share of sales", why: "A lender and a buyer both ask how much rests on one customer.", done: x.customers.length > 0, to: "marketing?area=market" },
      { label: "How late the debtors are (an aged debtors report)", why: "Separates slow payers from bad debts.", done: (x.ageing.current ?? 0) + (x.ageing.d30 ?? 0) + (x.ageing.d60 ?? 0) + (x.ageing.d90 ?? 0) > 0, to: "historic?area=bs" },
      { label: "Repayment history, covenants and guarantees", why: "The half of a credit application the numbers do not answer.", done: x.lender.onTime !== null, to: "funding?area=lender" },
      { label: "Whether it would run without the owner (six factors)", why: "Decides whether it can be sold, and at what multiple.", done: facts.transfer.filter((t) => t.score > 0).length >= 6, to: "people?area=risk" },
      { label: "What a bad year would look like", why: "A lender tests the loans against it before the good year.", done: stressSet, to: "assumptions?area=downside" },
      { label: "What the equipment is worth as security", why: "What a lender could lend against.", done: facts.collateral !== null, to: "assets" },
      { label: "Owner add-backs (costs a new owner would not carry)", why: "A buyer values earnings after these; a lender tests them.", done: x.addBackLines.length > 0 || (facts.sale.addBacks ?? 0) > 0, to: "settings?area=exit" },
      { label: "Share capital (what the owners put in)", why: "Splits equity into money put in and profit kept, which limits dividends.", done: h1?.share_capital !== null && h1?.share_capital !== undefined, to: "historic?area=bs" },
      { label: "Work quoted and customers kept from last year", why: "The evidence behind any growth the plan will claim.", done: x.pipeline !== null || x.retention !== null, to: "marketing" },
    ];

    data = {
      hasHistory: true, adviser: f.adviser,
      span: a.span, lastYear: last.year, prevYear: prev?.year ?? null,
      scores,
      profit: prev ? profitBridge(prev, last) : null,
      cash: prev ? cashBridge(prev, last) : null,
      issues: issuesFrom(prev, last, money).slice(0, 5),
      asks,
      firstYear: f.firstYear,
      agreed: readTargets(stored?.agreed_targets) ?? {},
      checks: f.targetChecks,
      settings: {
        cashFloor: stored?.cash_floor === null || stored?.cash_floor === undefined ? null : Number(stored.cash_floor),
        loanTermMonths: (stored?.existing_debt as { term_months?: number | null } | null)?.term_months ?? null,
      },
    };
  }

  return <AssessmentModule planId={planId} mode={f.mode} data={data} />;
}

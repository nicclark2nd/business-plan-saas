import type { CapabilityInput, Metric, Severity } from "./model";
import { ebitda, r1, r2 } from "./model";
import { saleYear } from "./judgements";

/**
 * THE FOUR PANELS THAT HAD NO DATA (§6.129.3).
 *
 * §6.129.2 built every panel the plan could feed. Four it could not, and Nic chose to show them anyway —
 * greyed, with a pencil to where the figure is collected — rather than leave a gap in the dashboard. 0049
 * built the somewhere; this file turns what is collected there into what the four panels draw.
 *
 * EVERY ROW KNOWS WHETHER IT WAS ANSWERED. A row with nothing behind it carries `fix` — the step and tab
 * that would answer it — and no status, so it draws greyed with a pencil and never as a pass or a fail
 * nobody earned (§6.89). A row that CAN be worked out from the plan (key hires, years trading, security)
 * is worked out, and never asked for (§6.41).
 */

export type ExtraFacts = {
  capacity: { name: string; pctUsed: number | null }[];
  /** People already started against people with a start date still to come — planned hires. */
  hires: { inPlace: number; planned: number };
  pipeline: number | null;
  retention: number | null;
  customers: { name: string; share: number | null; endsOn: string | null; assignable: boolean | null }[];
  /** The most recent historic period's debtors, split by age. Null buckets are unsaid, not nought. */
  ageing: { current: number | null; d30: number | null; d60: number | null; d90: number | null };
  receivables: number | null;
  /** True when the client has said the business has no trading history — no invoices to age. */
  newBusiness: boolean;
  lender: { onTime: boolean | null; covenants: string | null; guarantee: boolean | null; guaranteeBy: string | null };
  addBackLines: { label: string; amount: number }[];
  yearsTrading: number | null;
  leadership: { count: number; avgTenureYears: number | null };
  /** Revenue in the most recent year of actual trading, for testing the forecast's first year against. */
  lastRevenue: number | null;
};

export type Fix = { label: string; to: string };

/** One line on a checklist or a meter panel. `status` null = not answered, and then `fix` says where. */
export type Line = {
  label: string; display: string; detail?: string;
  /** 0–100 for a meter; null when the line is not a quantity. */
  pct: number | null;
  status: Severity | null;
  fix?: Fix;
};

const money0 = (m: (v: number) => string, v: number) => m(Math.round(v));

/* ---------------- Grow: can the business execute it? ---------------- */

export function executionLines(x: ExtraFacts, i: CapabilityInput): Line[] {
  const lines: Line[] = [];
  const m = i.money;

  if (!x.capacity.length) {
    lines.push({
      label: "What the business depends on", display: "Not said", pct: null, status: null,
      detail: "Premises, equipment, crews, systems — and how much of each is used now.",
      fix: { label: "Name them on Operations", to: "operations?area=capacity" },
    });
  }
  for (const c of x.capacity) {
    const p = c.pctUsed;
    lines.push({
      label: c.name, pct: p === null ? null : Math.min(100, p),
      display: p === null ? "Not measured" : `${r1(p)}% used`,
      status: p === null ? null : p >= 90 ? "bad" : p >= 75 ? "watch" : "good",
      detail: p === null ? undefined : p >= 90 ? "At its limit — growth stops here until it is lifted." : p >= 75 ? "Room for a little more, not for the plan's growth as well." : undefined,
      fix: p === null ? { label: "Measure it", to: "operations?area=capacity" } : undefined,
    });
  }

  /* Worked out, never asked: a person with a start date still to come is a planned hire. */
  const total = x.hires.inPlace + x.hires.planned;
  lines.push(total === 0
    ? { label: "Key people in place", display: "No one listed", pct: null, status: null, fix: { label: "Add the leadership team", to: "people" } }
    : {
      label: "Key people in place", display: `${x.hires.inPlace} of ${total}`, pct: Math.round((x.hires.inPlace / total) * 100),
      status: x.hires.planned === 0 ? "good" : "watch",
      detail: x.hires.planned ? `${x.hires.planned} still to be hired. The growth depends on finding them.` : undefined,
    });

  const y1 = i.pnl[1], y2 = i.pnl[2];
  const growth = y1 && y2 ? y2.revenue - y1.revenue : null;
  if (x.pipeline === null) {
    lines.push({ label: "Quoted work against next year's growth", display: "Not said", pct: null, status: null,
      fix: { label: "Add the pipeline", to: "marketing?area=sales" } });
  } else if (growth === null || growth <= 0) {
    lines.push({ label: "Quoted work in the pipeline", display: money0(m, x.pipeline), pct: null, status: "good",
      detail: "The forecast plans no growth next year, so there is nothing for the pipeline to cover." });
  } else {
    const cover = x.pipeline / growth;
    lines.push({
      label: "Quoted work against next year's growth", display: `${r1(cover)}×`, pct: Math.min(100, Math.round((cover / 2) * 100)),
      status: cover >= 1.5 ? "good" : cover >= 1 ? "watch" : "bad",
      detail: `${money0(m, x.pipeline)} weighted pipeline for ${money0(m, growth)} of planned growth.`,
    });
  }

  lines.push(x.retention === null
    ? { label: "Customers kept from last year", display: "Not said", pct: null, status: null, fix: { label: "Add retention", to: "marketing?area=market" } }
    : { label: "Customers kept from last year", display: `${r1(x.retention)}%`, pct: x.retention,
      status: x.retention >= 90 ? "good" : x.retention >= 75 ? "watch" : "bad" });

  return lines;
}

/* ---------------- Borrow: how overdue are the invoices? ---------------- */

export type Ageing =
  | { state: "new" }
  | { state: "missing"; fix: Fix }
  | { state: "ready"; buckets: { label: string; value: number; tone: Severity }[]; total: number; overduePct: number; gap: number | null };

export function ageingView(x: ExtraFacts): Ageing {
  /* A business with no trading history has no invoices to age. No pencil: there is nothing to go and fill. */
  if (x.newBusiness) return { state: "new" };
  const a = x.ageing;
  const parts = [a.current, a.d30, a.d60, a.d90];
  if (parts.every((p) => p === null)) return { state: "missing", fix: { label: "Split the debtors by age", to: "historic?area=bs" } };
  const v = parts.map((p) => p ?? 0);
  const total = v.reduce((t, p) => t + p, 0);
  const overdue = v[1] + v[2] + v[3];
  return {
    state: "ready",
    buckets: [
      { label: "Not yet due", value: v[0], tone: "good" },
      { label: "1–30 days late", value: v[1], tone: "watch" },
      { label: "31–60 days late", value: v[2], tone: "bad" },
      { label: "Over 60 days late", value: v[3], tone: "bad" },
    ],
    total, overduePct: total > 0 ? r1((overdue / total) * 100) : 0,
    gap: x.receivables === null ? null : r2(x.receivables - total),
  };
}

/* ---------------- Borrow: what the lender checks beyond the numbers ---------------- */

export function lenderChecklist(x: ExtraFacts, i: CapabilityInput, borrow: Metric[]): Line[] {
  const L: Line[] = [];

  L.push(x.yearsTrading === null
    ? { label: "Years trading", display: "Not said", pct: null, status: null, fix: { label: "Add the date established", to: "settings" } }
    : { label: "Years trading", display: `${r1(x.yearsTrading)} years`, pct: null,
      status: x.yearsTrading >= 3 ? "good" : x.yearsTrading >= 1 ? "watch" : "bad",
      detail: x.yearsTrading < 2 ? "Most lenders want two full years of accounts before they lend unsecured." : undefined });

  L.push(x.leadership.count === 0
    ? { label: "Management track record", display: "No one listed", pct: null, status: null, fix: { label: "Add the leadership team", to: "people" } }
    : {
      label: "Management track record",
      display: x.leadership.avgTenureYears === null ? `${x.leadership.count} people` : `${r1(x.leadership.avgTenureYears)} years on average`,
      pct: null,
      status: x.leadership.avgTenureYears === null ? "watch" : x.leadership.avgTenureYears >= 3 ? "good" : x.leadership.avgTenureYears >= 1 ? "watch" : "bad",
      detail: `${x.leadership.count} ${x.leadership.count === 1 ? "person" : "people"} on the leadership team.`,
    });

  /* Tested against the business's own last year, which is the first thing a credit officer compares. */
  const y1 = i.pnl[1];
  if (x.lastRevenue && y1) {
    const g = y1.revenue / x.lastRevenue - 1;
    L.push({
      label: "Forecast against last year", display: `${g >= 0 ? "+" : "−"}${r1(Math.abs(g) * 100)}%`, pct: null,
      status: g > 0.3 ? "bad" : g > 0.15 ? "watch" : "good",
      detail: g > 0.15 ? "Year 1 is well above what the business actually did last year. A lender will ask what changes." : "Year 1 sits close to what the business actually did last year.",
    });
  } else {
    L.push({ label: "Forecast against last year", display: "No history", pct: null, status: "watch",
      detail: "No year of actual trading to test the forecast against — the lender takes it on trust or not at all." });
  }

  const lvr = borrow.find((b) => b.key === "lvr");
  L.push(!lvr || lvr.value === null
    ? { label: "Security", display: "Not valued", pct: null, status: null, fix: { label: "Value the security", to: "assets" } }
    : { label: "Security", display: `${lvr.display} loan to value`, pct: null,
      status: lvr.value <= 65 ? "good" : lvr.value <= 75 ? "watch" : "bad" });

  const top = [...x.customers].filter((c) => c.share !== null).sort((a, b) => (b.share ?? 0) - (a.share ?? 0))[0];
  L.push(!x.customers.length
    ? { label: "Customer concentration", display: "Not said", pct: null, status: null, fix: { label: "Add the largest customers", to: "marketing?area=market" } }
    : !top
      ? { label: "Customer concentration", display: "Shares not given", pct: null, status: null, fix: { label: "Add each customer's share", to: "marketing?area=market" } }
      : { label: "Customer concentration", display: `${r1(top.share!)}% from ${top.name}`, pct: null,
        status: top.share! <= 15 ? "good" : top.share! <= 25 ? "watch" : "bad",
        detail: top.share! > 20 ? "One customer is a large share of the revenue the loan is repaid from." : undefined });

  const fixL = { label: "Answer it on Funding", to: "funding?area=lender" };
  L.push(x.lender.onTime === null
    ? { label: "Repayment history", display: "Not said", pct: null, status: null, fix: fixL }
    : { label: "Repayment history", display: x.lender.onTime ? "Always on time" : "Some late or missed", pct: null, status: x.lender.onTime ? "good" : "bad" });

  const cov = (x.lender.covenants ?? "").trim();
  L.push(!cov
    ? { label: "Covenant breaches", display: "Not said", pct: null, status: null, fix: fixL }
    : /^(none|no\b|nil)/i.test(cov)
      ? { label: "Covenant breaches", display: "None", pct: null, status: "good" }
      : { label: "Covenant breaches", display: "Yes — see note", pct: null, status: "watch", detail: cov });

  L.push(x.lender.guarantee === null
    ? { label: "Guarantee", display: "Not said", pct: null, status: null, fix: fixL }
    : x.lender.guarantee
      ? { label: "Guarantee", display: x.lender.guaranteeBy ? `Offered by ${x.lender.guaranteeBy}` : "Offered", pct: null, status: "good" }
      : { label: "Guarantee", display: "None offered", pct: null, status: "watch", detail: "Expect a smaller loan or a higher rate without one." });

  return L;
}

/* ---------------- Sell: customer concentration ---------------- */

export function concentration(x: ExtraFacts, today: Date) {
  const rows = x.customers
    .filter((c) => c.name.trim())
    .map((c) => {
      const ends = c.endsOn ? new Date(c.endsOn) : null;
      const months = ends ? (ends.getFullYear() - today.getFullYear()) * 12 + (ends.getMonth() - today.getMonth()) : null;
      return { ...c, endsWithinYear: months !== null && months <= 12 };
    })
    .sort((a, b) => (b.share ?? -1) - (a.share ?? -1));
  const shares = rows.map((r) => r.share).filter((s): s is number => s !== null);
  return {
    rows,
    topShare: shares.length ? shares[0] : null,
    listedShare: shares.length ? r1(shares.reduce((a, b) => a + b, 0)) : null,
    notAssignable: rows.filter((r) => r.assignable === false).length,
    unchecked: rows.filter((r) => r.assignable === null).length,
  };
}

/* ---------------- Sell: from reported to normalised earnings ---------------- */

/**
 * Each step a buyer's accountant will test, in order: what the accounts say, each add-back, and what is left.
 * Returned as steps rather than drawn here so the bridge on screen and the sum on the price card are one
 * reading of one list (§6.41).
 */
export function earningsBridge(x: ExtraFacts, i: CapabilityInput) {
  /* The year the sale is aimed at, or Year 1 (§6.135) — the bridge ends at the figure the price is judged on. */
  return bridgeFrom(i.pnl[saleYear(i.sale)], x.addBackLines);
}

/**
 * The same bridge from the two things it actually needs, so the printed plan (§6.130.2) reads it through the
 * one function the dashboard does rather than adding the add-backs up a second time (§6.41).
 */
export function bridgeFrom(year1: CapabilityInput["pnl"][number] | undefined, lines: { label: string; amount: number }[]) {
  const e = ebitda(year1);
  if (e === null) return null;
  const adds = lines.filter((a) => a.amount > 0);
  const normalised = r2(e + adds.reduce((t, a) => t + a.amount, 0));
  return { reported: e, adds, normalised };
}

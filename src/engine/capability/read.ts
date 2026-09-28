import type { CapabilityInput, Metric } from "./model";
import { SCORE_BANDS, ebitda, statusOf } from "./model";
import type { Lever } from "./levers";
import { LENDER_MIN_DSCR, saleYear } from "./judgements";
import { BORROW_WEIGHTS } from "./borrow";
import { SELL_WEIGHTS } from "./sell";
import { actionFor, verdict } from "./verdict";
import type { FacilityFacts } from "./series";
import { actualSummary, borrowSummary, growSummary, sellSummary, type SummaryFacts } from "./summary";
import { issuesFrom } from "./assessment";
import { buildView } from "./views";
import type { AgreedTargets } from "./targets";
import { worth as worthOf, borrowLevers, borrowStory, growLevers, growStory, growWith, leverTable, moveLine, profitForPrice, sellLevers, sellStory, viewWith, withMoves, type LoanFacts } from "./levers";
import { actualYear, capabilityViews, type HistoricRow } from "./actual";

/**
 * ONE TAB, READ ONCE (§6.179).
 *
 * The verdict, the "In short" box, the story, the fixes and the table used to be worked out inside the
 * Capabilities page. The Planner's briefing needs exactly the same words and figures on the server, and the
 * branded report will need them again. Three places assembling one tab is how three documents come to
 * disagree about one business (§6.41), so the assembly lives here and the page, the briefing and the report
 * all call it.
 *
 * Pure: the same facts give the same read, which is what lets a test pin it.
 */

export type Tab = "grow" | "borrow" | "sell";
export type View = "actual" | "plan";
export type PlanFacts = Omit<CapabilityInput, "money">;
export type PriceNote = { price: number; needed: number; high: number; after: number };

export type ReadContext = {
  facts: PlanFacts;
  history: HistoricRow[];
  firstYear: number;
  money: (v: number) => string;
  adviser: boolean;
  months: string[];
  agreedTargets: AgreedTargets;
  facilities: FacilityFacts[];
};

/** Both views, built once — the page switches between them, the briefing reads the one it was asked for. */
export function readViews(c: Pick<ReadContext, "facts" | "history" | "firstYear" | "money">) {
  const views = capabilityViews(c.facts, c.history, c.firstYear);
  const actualV = views.actual ? buildView(views.actual, c.money, views.actual.last) : null;
  const planV = buildView(views.plan, c.money, null);
  return { views, actualV, planV };
}
export type ReadViews = ReturnType<typeof readViews>;

/** A plain fallback for a card no lever moves (§6.178). */
export function plainAction(m: Metric): string | null {
  if (m.value === null || m.unscored) return null;
  const s = statusOf(m.value, m.bands);
  if (s === null || s === "good") return null;
  const a = actionFor(m);
  if (!a) return null;
  return m.key === "dscrStressed" ? `${a} None of the fixes above get this past the bad year set up on Assumptions — check it is realistic.` : a;
}

const PAST: Record<string, string> = {
  "The growth plan does not pay for itself": "Growth so far has not paid for itself",
  "Worth doing, but cash will be tight": "Growing, but cash is tight",
  "The growth plan works": "Growth so far has worked",
};
const past = (t: string) => t.replace(/\bin the plan\b/g, "in the business").replace(/\bthe plan\b/g, "the business");

export function readTab(c: ReadContext, r: ReadViews, tab: Tab, wantActual: boolean) {
  const { views, actualV, planV } = r;
  const { money, adviser, history, firstYear, agreedTargets, facilities } = c;
  const onActual = wantActual && !!actualV;
  const V = onActual && actualV ? actualV : planV;
  const input: CapabilityInput = { ...c.facts, money };

  const WEIGHTS = { grow: V.growWeights, borrow: BORROW_WEIGHTS, sell: SELL_WEIGHTS }[tab];
  const metrics = V[tab];
  const s = V.scores[tab];
  const raw = verdict(tab, metrics, WEIGHTS, s.value);
  /* The headline speaks about what happened on the actual view, and about what is planned on the plan view. */
  const v = onActual
    ? { ...raw, headline: PAST[raw.headline] ?? raw.headline, actions: raw.actions.map(past), paragraphs: raw.paragraphs.map((p) => ({ ...p, body: past(p.body) })) }
    : raw;
  const band = s.value === null ? null : statusOf(s.value, SCORE_BANDS);
  const span = onActual ? views.actual!.span : views.plan.span;
  const capped = s.capped.map((k) => metrics.find((m) => m.key === k)?.name ?? k);

  /* THREE LINES FOR THE PERSON IN THE ROOM (§6.160). */
  const summary = (() => {
    const f: SummaryFacts = {
      adviser, money,
      actual: views.actual && actualV ? { growIn: actualV.growIn, posIn: actualV.posIn, year: views.actual.last.year, grow: actualV.grow, borrow: actualV.borrow } : null,
      plan: { input, firstYear, grow: planV.grow, borrow: planV.borrow, monthNames: c.months },
    };
    const base = { grow: growSummary, borrow: borrowSummary, sell: sellSummary }[tab](f);
    if (!onActual || !views.actual || !actualV) return base;
    /* The Actual view: the accounts only, nothing from a projected year (§6.169). */
    const last = views.actual.last;
    const issues = issuesFrom(actualYear(history, 2, firstYear), last, money).filter((i) => i.area === tab);
    const e = ebitda(actualV.posIn.pnl[1]);
    return actualSummary(tab, base, {
      adviser, headline: v.headline, capped,
      issues, earnings: e === null ? null : e + (input.sale.addBacks ?? 0),
      scored: input.transfer.filter((x) => x.score !== null && x.score !== undefined).length,
    });
  })();

  /* WHAT FIXES IT (§6.173–§6.177). */
  const fixes = (() => {
    const cur = onActual && views.actual ? views.actual : views.plan;
    const last = onActual && views.actual ? views.actual.last : null;
    const ramp = !onActual && views.hasHistory;
    /*
     * On the plan, aim where the Planner's assessment aims: the agreed target, or else the better of the two
     * actual years — 2026 was the bad year, so measuring the plan's margin against it would ask for nothing.
     */
    const a1 = views.actual?.last ?? null, a0 = actualYear(history, 2, firstYear);
    const gmOf = (y: typeof a1) => (y && y.pnl.revenue > 0 ? ((y.pnl.revenue - y.pnl.cogs) / y.pnl.revenue) * 100 : null);
    const bestGm = Math.max(gmOf(a1) ?? -Infinity, gmOf(a0) ?? -Infinity);
    const bestDd = Math.min(a1?.days.debtorDays ?? Infinity, a0?.days.debtorDays ?? Infinity);
    const refs = onActual ? {} : {
      grossMargin: agreedTargets.grossMargin?.value ?? (Number.isFinite(bestGm) ? Math.round(bestGm * 10) / 10 : null),
      overheadsCap: agreedTargets.overheadsCap?.value ?? null,
      debtorDays: agreedTargets.debtorDays?.value ?? (Number.isFinite(bestDd) ? bestDd : null),
      loanTermMonths: agreedTargets.loanTermMonths?.value ?? null,
    };

    if (tab === "sell") {
      /* SELL (§6.177). A buyer prices one year — the sale year (the latest actual year on the accounts). */
      const slot = onActual ? 1 : saleYear(V.posIn.sale);
      let profitL: ReturnType<typeof growLevers> = [];
      if (slot === 1) profitL = views.hasHistory ? growLevers(V.growIn, refs) : [];
      else {
        const P = V.posIn;
        profitL = growLevers({ ...P, pnl: { 1: P.pnl[slot - 1], 2: P.pnl[slot] }, balanceSheet: { 1: P.balanceSheet[slot - 1], 2: P.balanceSheet[slot] } } as typeof P, refs);
      }
      const levers = withMoves(sellLevers(V.posIn, profitL, slot), cur, last, false, money, V.sell, "sell");
      const table = leverTable(levers, cur, last, false, money, { metrics: V.sell, score: V.scores.sell.value }, "sell");
      const moves: Record<string, string> = {};
      for (const m of V.sell) { const line = moveLine(m.key, levers, cur, last, false, money, V.sell, "sell") ?? plainAction(m); if (line) moves[m.key] = line; }
      const year = onActual && last ? String(last.year) : cur.positionNames[slot] ?? "";
      const need = profitForPrice(V.posIn);
      const afterP = viewWith(cur, last, levers.filter((l) => l.key !== "price"), false, money, "sell").input.pnl[slot];
      const afterE = afterP ? afterP.operatingProfit + afterP.depreciation + (V.posIn.sale.addBacks ?? 0) : null;
      const priceNote: PriceNote | null = need && afterE !== null && afterE < need.needed ? { ...need, after: afterE } : null;
      return { levers, table, moves, short: null as number | null, shortCover: null as number | null, shortStress: null as string | null, priceNote,
        story: sellStory(V.posIn, slot, year, onActual), year };
    }

    if (tab === "borrow") {
      /* BORROW (§6.176). The loans come from the accounts on the Actual view and from Funding on the plan. */
      let loans: LoanFacts[] = [];
      if (last) {
        const debt = last.balanceSheet.debtCurrent + last.balanceSheet.debtNonCurrent;
        const prevDebt = a0 ? a0.balanceSheet.debtCurrent + a0.balanceSheet.debtNonCurrent : debt;
        const avg = (debt + prevDebt) / 2;
        const rate = avg > 0 && last.pnl.interest > 0 ? (last.pnl.interest / avg) * 100 : 10;
        if (debt > 0 && last.balanceSheet.debtCurrent > 0) loans = [{ name: "the loans", balance: debt, ratePct: rate, years: debt / last.balanceSheet.debtCurrent }];
      } else {
        loans = facilities.filter((f) => f.termMonths > 0 && f.drawn > 0).map((f) => ({ name: f.name, balance: f.drawn, ratePct: f.ratePct, years: f.termMonths / 12 }));
      }
      const growL = views.hasHistory ? growLevers(V.growIn, refs) : [];
      const levers = withMoves(borrowLevers(V.posIn, growL, loans, refs, !onActual), cur, last, false, money, V.borrow, "borrow");
      const table = leverTable(levers, cur, last, false, money, { metrics: V.borrow, score: V.scores.borrow.value }, "borrow");
      const moves: Record<string, string> = {};
      for (const m of V.borrow) { const line = moveLine(m.key, levers, cur, last, false, money, V.borrow, "borrow") ?? plainAction(m); if (line) moves[m.key] = line; }
      const afterM = levers.length ? viewWith(cur, last, levers, false, money, "borrow").metrics : [];
      const after = afterM.find((x) => x.key === "dscr")?.value ?? null;
      const stressed = afterM.find((x) => x.key === "dscrStressed");
      const shortCover = after !== null && after < LENDER_MIN_DSCR ? after : null;
      const shortStress = shortCover === null && stressed && stressed.value !== null && stressed.value < LENDER_MIN_DSCR ? (stressed.sub ?? "") : null;
      return { levers, table, moves, short: null as number | null, shortCover, shortStress, priceNote: null as PriceNote | null, story: borrowStory(V.posIn, cur.positionNames, last), year: cur.positionNames[1] ?? "" };
    }

    const levers = withMoves(growLevers(V.growIn, refs), cur, last, ramp, money, V.grow);
    const table = leverTable(levers, cur, last, ramp, money, { metrics: V.grow, score: V.scores.grow.value });
    const moves: Record<string, string> = {};
    for (const m of V.grow) { const line = moveLine(m.key, levers, cur, last, ramp, money, V.grow) ?? plainAction(m); if (line) moves[m.key] = line; }
    /* When every lever together still leaves a loss, say how far short — the levers are not the whole answer. */
    const after = levers.length ? growWith(cur, last, levers, ramp, money).input.pnl[2]?.operatingProfit ?? null : null;
    const short = after !== null && after < 0 ? after : null;
    return { levers, table, moves, short, shortCover: null as number | null, shortStress: null as string | null, priceNote: null as PriceNote | null, story: growStory(V.growIn, cur.growNames, last, levers), year: cur.growNames[2] ?? "" };
  })();

  return { onActual, V, input, WEIGHTS, metrics, s, v, band, span, capped, summary, fixes };
}
export type TabRead = ReturnType<typeof readTab>;

/** What a lever is worth, as it reads beside the lever on the page, in the briefing and in the report. */
export const leverValue = (l: Lever, money: (v: number) => string) =>
  l.profit > 0 || l.saves || l.price || l.key === "overdraft" ? worthOf(l, money) : `+${money(l.cash)} cash, once`;

/**
 * THE LINES UNDER THE TABLE (§6.173–§6.177), as plain sentences: where the fixes still fall short. The page
 * draws them in red with a link; the briefing and the report need the same words without the link.
 */
export function fixNotes(R: TabRead, money: (v: number) => string): string[] {
  const f = R.fixes, out: string[] = [];
  if (f.short !== null) out.push(`Even with all these fixes, ${f.year} ${R.onActual ? "would still have lost" : "still loses"} ${money(-f.short)}. That gap has to be closed with higher prices, more sales at a good profit, or lower costs.`);
  if (f.shortCover !== null) out.push(`Even with all these fixes, trading would cover the loan payments only ${Math.round(f.shortCover * 100) / 100} times — lenders want ${LENDER_MIN_DSCR}. The rest has to come from more profit, or smaller loans.`);
  if (f.priceNote) out.push(`To keep the asking price of ${money(f.priceNote.price)}, a buyer would need to see ${money(f.priceNote.needed)} of profit after add-backs a year (at ${f.priceNote.high}×, the top of what similar businesses sold for). ${f.priceNote.after > 0 ? `With the fixes, it would be ${money(f.priceNote.after)}.` : "Even with the fixes, there is no profit."}`);
  if (f.shortStress !== null) out.push(`Even with all these fixes, the loans could not be paid in the bad year set up on Assumptions (${f.shortStress.replace(/^Bad year: /, "")}). That keeps the score below 50 — check the bad year is realistic.`);
  return out;
}

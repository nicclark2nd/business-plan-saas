"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ModuleFrame, ModuleStatusFooter } from "@/components/module/ModuleFrame";
import { CellSelect, Grid, Th, Td, Row, Toolbar, Meta, TOTAL_ROW } from "@/components/module/DataGrid";
import { useMoney } from "@/components/MoneyProvider";
import { cn } from "@/lib/utils";
import {
  LEVER_KEYS, planLevers, runPlan, runWhatIf,
  type DayScope, type LeverKey, type Levers, type Measures, type StartYear, type WhatIfPlan,
} from "@/engine/whatif/levers";
import { realityChecks, type Check } from "@/engine/whatif/checks";
import { AREA_LABEL, proposedGoals, type ProposedGoal } from "@/engine/whatif/goals";
import { revenueWorth } from "@/engine/whatif/worth";
import { type WorkingCapitalDays } from "@/engine/forecast/model";
import { applyScenario, createGoalsFromScenario, undoLastApply, type GoalToCreate } from "./actions";
import { plannedChanges, applyChanges, type Change } from "@/engine/whatif/apply";
import type { Noun } from "@/engine/plan/vocabulary";

/**
 * What-If Planner (§6.41) — seven levers, and the real forecast underneath them.
 *
 * Everything on this screen is a figure the engine produced by re-running the plan, including the two
 * headline numbers and every per-lever contribution. Nothing is approximated, because the one thing a
 * planner like this has to be is believable: a client who finds that "lowest cash in March" does not match
 * the cash flow two screens away will never trust either of them again.
 *
 * Read-only for now. Turning a scenario into the plan, or into goals, is the next piece of work, and it
 * writes through the modules that own the figures rather than behind their backs.
 */
type AreaKey = "levers" | "detail";

const LABEL: Record<LeverKey, string> = {
  price: "Price", volume: "Volume", cogs: "Cost of goods", overheads: "Overheads",
  debtorDays: "Debtor days", stockDays: "Stock days", creditorDays: "Creditor days",
};

/** Slider bounds. Wider than the mockup's: a business in trouble needs room to model getting out of it. */
const RANGE: Record<LeverKey, { min: number; max: number; step: number; unit: "%" | "days" }> = {
  price: { min: -20, max: 20, step: 0.5, unit: "%" },
  volume: { min: -30, max: 30, step: 1, unit: "%" },
  cogs: { min: -20, max: 20, step: 0.5, unit: "%" },
  overheads: { min: -20, max: 20, step: 0.5, unit: "%" },
  debtorDays: { min: 0, max: 120, step: 1, unit: "days" },
  stockDays: { min: 0, max: 90, step: 1, unit: "days" },
  creditorDays: { min: 0, max: 90, step: 1, unit: "days" },
};

const PROFIT_LEVERS: LeverKey[] = ["price", "volume", "cogs", "overheads"];
const CASH_LEVERS: LeverKey[] = ["debtorDays", "stockDays", "creditorDays"];

/** Which of the business's own implied days belongs beside each lever. The profit levers have no equivalent. */
const HISTORY_OF: Partial<Record<LeverKey, keyof WorkingCapitalDays>> = {
  debtorDays: "debtorDays", stockDays: "inventoryDays", creditorDays: "creditorDays",
};

export type QuarterChoice = { planYear: number; quarter: number; label: string; months: string };
export type Person = { id: string; name: string; role: string | null };

export function WhatIfModule({
  planId, mode, plan, noun, taxLabel, monthNames, history, people, quarters, thisQuarter, lastApplied,
}: {
  planId: string; mode: "guided" | "advanced"; plan: WhatIfPlan; noun: Noun; taxLabel: string;
  monthNames: string[];
  /** Days implied by the last set of accounts, or null for a business with no history yet (§6.41.3). */
  history: WorkingCapitalDays | null;
  /** Who a goal can be given to, and when (§6.44). */
  people: Person[]; quarters: QuarterChoice[]; thisQuarter: { planYear: number; quarter: number };
  /** The last applied scenario, if one is waiting to be undone (§6.45.1). */
  lastApplied?: { label: string; at: string } | null;
}) {
  const num = useMoney();
  const router = useRouter();
  const [area, setArea] = useState<AreaKey>("levers");
  const [saving, startSave] = useTransition();
  /**
   * Every lever means Year 1, which is the first PROJECTED year — the year the business is in, and a
   * forecast rather than a record (§6.47). The engine can start a change in a later year and is tested for
   * it, but the screen offers one meaning: there is no second thing for a client to get wrong.
   */
  const from: StartYear = 1;
  const [saveOpen, setSaveOpen] = useState(false);
  const [goalsOpen, setGoalsOpen] = useState(false);
  const [savedError, setSavedError] = useState<string>();
  const at = useMemo(() => planLevers(plan.workingCapital[1]), [plan]);
  const [lv, setLv] = useState<Levers>(at);

  /**
   * Nine forecasts — the plan, the scenario, and one per lever moved — on every drag of a slider. It is
   * sub-millisecond because the engine is plain arithmetic over five years, and it is the whole reason the
   * numbers on this screen can be trusted (§6.41).
   */
  const what = useMemo(() => runWhatIf(plan, lv, from), [plan, lv, from]);
  const checks = useMemo(() => realityChecks(what, lv, monthNames, num, history), [what, lv, monthNames, num, history]);
  /** What the business actually achieved, for the three levers that have a record to be held against. */
  const historyOf = (k: LeverKey) => {
    const field = HISTORY_OF[k];
    return field && history ? Math.round(Number(history[field]) || 0) : null;
  };
  /**
   * What a pound of revenue is worth depending on which lever wins it (§6.41.2). It is a fact about the plan
   * and not about the sliders, so it is computed once and stands there whether or not anything has moved.
   */
  const worth = useMemo(() => revenueWorth(plan), [plan]);
  /** A check about one lever belongs under that lever; the rest belong together in the panel. */
  const checkFor = (k: LeverKey): Check | undefined => checks.find((c) => c.lever === k);
  const scenarioChecks = checks.filter((c) => !c.lever);
  const base = what.base.outcome, now = what.adjusted.outcome;
  /** Whether the scenario's tightest month is a different month from the plan's own. */
  const moves = base.lowestMonth !== now.lowestMonth;
  const touched = LEVER_KEYS.some((k) => Number(lv[k]) !== Number(at[k]));

  const signed = (v: number) => (Math.round(v) > 0 ? "+" : "") + num(v);
  /**
   * Display rounding must not break a column (§6.17). Five figures rounded to whole currency units can miss
   * their own total by a couple, and a CFO adds the column. The residual line is already defined as what the
   * parts do not explain, so it takes the remainder — the same rule the twelve months settle by (§6.36).
   */
  const remainder = (total: number, parts: number[]) =>
    Math.round(total) - parts.reduce((a, b) => a + Math.round(b), 0);
  const profitParts = what.contributions.map((c) => ({ lever: c.lever, moved: c.moved, effect: c.effect.operatingProfit }));
  const profitResidual = remainder(what.total.operatingProfit, profitParts.map((c) => c.effect));
  const cashResidual = remainder(what.tightest.change, what.tightest.contributions.map((c) => c.effect));
  /** A figure that rounds away to nothing is not a contribution; it is a dash. */
  const cell = (v: number) => (Math.round(v) === 0 ? "—" : signed(v));
  const set = (k: LeverKey, v: number) => setLv((p) => ({ ...p, [k]: v }));
  const effect = (k: LeverKey) => what.contributions.find((c) => c.lever === k);

  /** What a lever means in the things the owner actually deals in. Every figure is a measured contribution. */
  const translate = (k: LeverKey): string => {
    const c = effect(k);
    if (!c?.moved) return "";
    const e = c.effect;
    const days = Math.round(Number(lv[k]) - Number(at[k]));
    switch (k) {
      case "price": {
        const each = base.unitsYear1 > 0 ? e.revenue / base.unitsYear1 : 0;
        return `${signed(e.revenue)} of revenue across the year — ${signed(each)} on an average sale of ${num(base.revenue / Math.max(1, base.unitsYear1))}.`;
      }
      case "volume": {
        const more = Math.round(now.unitsYear1 - base.unitsYear1);
        const each = Math.max(1, Math.round(Math.abs(more) / 12));
        return `${Math.abs(more)} ${more >= 0 ? "more" : "fewer"} ${Math.abs(more) === 1 ? noun.one : noun.many.toLowerCase()} in the year — about ${each} a month. Gross profit ${signed(e.grossProfit)}.`;
      }
      case "cogs":
        return `${num(Math.abs(e.cogs))} ${e.cogs < 0 ? "less" : "more"} a year on materials, subcontractors and anything else costed per sale.`;
      case "overheads":
        return `${num(Math.abs(e.overheads))} ${e.overheads < 0 ? "less" : "more"} a year — ${num(Math.abs(e.overheads) / 12)} a month.`;
      case "debtorDays":
        return `Customers pay ${Math.abs(days)} days ${days < 0 ? "sooner" : "later"} — ${num(Math.abs(e.accountsReceivable))} ${days < 0 ? "back in the bank by the end of the year" : "tied up in invoices"}.`;
      case "stockDays":
        return `${num(Math.abs(e.inventory))} of stock and work in progress ${days < 0 ? "released" : "tied up"}.`;
      case "creditorDays":
        return `${num(Math.abs(e.accountsPayable))} ${days > 0 ? "still unpaid at the end of the year, and still in the bank" : "paid out sooner"}.`;
    }
  };

  return (
    <ModuleFrame
      group="Financials" title="What if…?"
      subtitle="Move a lever and watch profit and cash change — nothing in your plan moves" mode={mode}
      areas={[{ key: "levers", label: "Levers" }, { key: "detail", label: "Baseline vs adjusted" }]}
      area={area} onArea={(k) => setArea(k as AreaKey)}
      scope={{ label: "Year 1" }}
      primaryAction={<>
        {lastApplied && !touched && (
          <Button variant="outline" size="sm" disabled={saving}
            onClick={() => startSave(async () => { const r = await undoLastApply(planId); if (!r.ok) setSavedError(r.error); else router.refresh(); })}>
            Undo last change
          </Button>
        )}
        <Button variant="outline" size="sm" disabled={!touched} onClick={() => setLv(at)}>Reset levers</Button>
        <Button variant="outline" size="sm" disabled={!touched} onClick={() => { setSavedError(undefined); setGoalsOpen(true); }}>Turn into goals</Button>
        <Button size="sm" disabled={!touched} onClick={() => { setSavedError(undefined); setSaveOpen(true); }}>Make this the plan</Button>
      </>}
      footer={<ModuleStatusFooter planId={planId} />}
      help={<>
        <h3>What this is</h3>
        <p>Every figure here is your real forecast, re-run. The lowest cash figure is the tightest of the twelve months in your cash flow — not an estimate of it — so it will always match the Cash flow tab exactly.</p>
        <h3>Profit levers move cash too</h3>
        <p>A price rise earns more profit, and the extra sits in debtors for a while before it reaches the bank. That is why the two tiles rarely move by the same amount.</p>
        <h3>Cash levers move cash only</h3>
        <p>Days are how long money sits with someone else. Fewer debtor and stock days, and more creditor days, all put cash back in your account without changing profit by a penny.</p>
        <h3>Why the parts do not add up</h3>
        <p>A price rise on more sales is worth more than either change alone. Each lever is measured on its own, and what the levers earn <i>together</i> is shown as its own line rather than hidden inside one of them.</p>
        <h3>Nothing is saved</h3>
        <p>Leave this screen and the levers reset. Turning a scenario into your plan, or into goals, is coming.</p>
      </>}
    >
      {!now.reconciled && (
        <div className="border-b border-bad bg-bad-soft px-5 py-2.5 text-[13px] font-semibold text-bad">
          These changes do not reconcile — profit, cash and the balance sheet no longer agree. Reset the levers; this is a fault worth reporting.
        </div>
      )}

      {area === "levers" ? (
        <div className="space-y-3 p-4">
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(300px,0.9fr)]">
            <Tile
              eyebrow="Year 1 operating profit" now={base.operatingProfit} value={now.operatingProfit}
              parts={profitParts} interaction={profitResidual} num={num} signed={signed}
            />
            {/*
              * The lowest of twelve balances is a minimum, and a minimum cannot be split between the levers
              * that produced it: move one and the tightest month itself moves, so each part would be
              * answering about a different month (§6.41). While the month holds still the parts are exact and
              * shown; once it moves, the tile says so and the lever-by-lever figures live on the other tab,
              * under the month they are actually measured in.
              */}
              <Tile
                eyebrow={`Lowest cash in Year 1 · ${monthNames[now.lowestMonth - 1]}`}
                now={base.lowestCash} value={now.lowestCash}
                parts={moves ? [] : what.tightest.contributions}
                interaction={moves ? 0 : cashResidual}
                num={num} signed={signed}
                foot={moves
                  ? <>The tightest month moves from <b>{monthNames[base.lowestMonth - 1]}</b> to <b>{monthNames[now.lowestMonth - 1]}</b>, so the two figures are not the same month. What each lever is worth in {monthNames[now.lowestMonth - 1]} is on <b>Baseline vs adjusted</b>.</>
                  : undefined}
              />
            <div className="rounded border border-border bg-card">
              <div className="border-b border-border px-3 py-2"><span className="eyebrow">Worth knowing</span></div>
              <div className="space-y-2 px-3 py-2.5">
                {scenarioChecks.length === 0
                  ? <p className="text-[12.5px] text-muted-foreground">
                      {!touched ? "Move a lever to see what it would do."
                        : checks.length ? "Nothing at the plan level — the notes are under the levers they belong to."
                          : "Nothing to flag — these changes look workable."}
                    </p>
                  : scenarioChecks.map((c) => (
                    <p key={c.key} className={cn("text-[12.5px] leading-snug",
                      c.level === "bad" && "font-semibold text-bad", c.level === "good" && "text-good", c.level === "warn" && "text-warn")}>
                      {c.text}
                    </p>
                  ))}
              </div>
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <LeverCard title="Profit levers" note="also move cash" keys={PROFIT_LEVERS} lv={lv} at={at} set={set}
              translate={translate} checkFor={checkFor} historyOf={historyOf} foot={worthNote(worth)} />
            <LeverCard title="Cash levers" note="move cash, not profit" keys={CASH_LEVERS} lv={lv} at={at} set={set}
              translate={translate} checkFor={checkFor} historyOf={historyOf}
              foot={<>Days are how long money sits with someone else. Fewer debtor and stock days, and more creditor days, all put cash back in your account.
                {history && <> The figures marked <b>history</b> are implied by your last set of accounts — a reading taken on one balance-sheet date, so a quiet month flatters them.</>}
              </>} />
          </div>
        </div>
      ) : (
        <>
          <Toolbar>
            <span className="text-[13px] font-semibold">Year 1, as planned and as adjusted</span>
            <Meta>{plan.components?.length ? `${taxLabel} registered — every figure below is tax-exclusive` : "Not registered for sales tax"}</Meta>
          </Toolbar>
          <Grid>
            <thead>
              <tr>
                <Th style={{ width: "34%" }}>Line</Th>
                <Th right>As planned</Th><Th right>Adjusted</Th><Th right>Change</Th>
              </tr>
            </thead>
            <tbody>
              {([
                ["Revenue", "revenue", "head"],
                ["Cost of sales", "cogs"],
                ["Gross profit", "grossProfit", "sub"],
                ["Overheads", "overheads"],
                ["Operating profit", "operatingProfit", "total"],
                ["Net profit", "netProfit", "sub"],
                ["Accounts receivable", "accountsReceivable", "head"],
                ["Inventory and work in progress", "inventory"],
                ["Accounts payable", "accountsPayable"],
                ["Net cash movement", "netCashFlow", "head"],
                ["Closing cash", "closingCash"],
                ["Lowest month-end cash", "lowestCash", "total"],
              ] as [string, keyof Measures, string?][]).map(([label, key, kind]) => (
                <Row key={key} className={cn(kind === "total" && TOTAL_ROW, kind === "sub" && "[&>td]:font-semibold", kind === "head" && "[&>td]:border-t [&>td]:border-input")}>
                  <Td>{label}</Td>
                  <Td right className="tabular-nums">{num(base[key])}</Td>
                  <Td right className="tabular-nums">{num(now[key])}</Td>
                  <Td right className={cn("tabular-nums", what.total[key] > 0 && "text-good", what.total[key] < 0 && "text-bad")}>
                    {cell(what.total[key])}
                  </Td>
                </Row>
              ))}
              {/* The month the lever table below is measured in, so its column has a visible total. */}
              <Row className="[&>td]:border-t [&>td]:border-input">
                <Td>Cash at the end of {monthNames[what.tightest.month - 1]}</Td>
                <Td right className="tabular-nums">{num(what.tightest.base)}</Td>
                <Td right className="tabular-nums">{num(what.tightest.adjusted)}</Td>
                <Td right className={cn("tabular-nums", what.tightest.change > 0 && "text-good", what.tightest.change < 0 && "text-bad")}>
                  {cell(what.tightest.change)}
                </Td>
              </Row>
            </tbody>
          </Grid>

          <Toolbar className="border-t">
            <span className="text-[13px] font-semibold">What each lever is worth</span>
            <Meta>measured by re-running the plan with that one lever moved, and the cash read in {monthNames[what.tightest.month - 1]} for all of them</Meta>
          </Toolbar>
          <Grid>
            <thead>
              <tr>
                <Th style={{ width: "34%" }}>Lever</Th><Th right>Set to</Th>
                <Th right>Operating profit</Th><Th right>Cash in {monthNames[what.tightest.month - 1]}</Th>
              </tr>
            </thead>
            <tbody>
              {what.contributions.map((c, i) => {
                const cash = what.tightest.contributions[i].effect;
                return (
                  <Row key={c.lever} className={cn(!c.moved && "text-muted-foreground")}>
                    <Td>{LABEL[c.lever]}</Td>
                    <Td right className="tabular-nums">
                      {RANGE[c.lever].unit === "%" ? `${Number(lv[c.lever]) > 0 ? "+" : ""}${Number(lv[c.lever])}%` : `${Number(lv[c.lever])} days`}
                    </Td>
                    <Td right className={cn("tabular-nums", c.effect.operatingProfit > 0 && "text-good", c.effect.operatingProfit < 0 && "text-bad")}>
                      {c.moved ? cell(c.effect.operatingProfit) : "—"}
                    </Td>
                    <Td right className={cn("tabular-nums", cash > 0 && "text-good", cash < 0 && "text-bad")}>
                      {c.moved ? cell(cash) : "—"}
                    </Td>
                  </Row>
                );
              })}
              <Row>
                <Td colSpan={2}>Levers working together</Td>
                <Td right className="tabular-nums">{cell(profitResidual)}</Td>
                <Td right className="tabular-nums">{cell(cashResidual)}</Td>
              </Row>
              <Row className={TOTAL_ROW}>
                <Td colSpan={2}>All changes</Td>
                <Td right className="tabular-nums">{signed(what.total.operatingProfit)}</Td>
                <Td right className="tabular-nums">{signed(what.tightest.change)}</Td>
              </Row>
            </tbody>
          </Grid>
        </>
      )}

      {goalsOpen && (
        <TurnIntoGoalsDialog
          goals={proposedGoals(what, lv, noun, num)} people={people} quarters={quarters}
          thisQuarter={thisQuarter} saving={saving} error={savedError}
          onClose={() => setGoalsOpen(false)}
          onCreate={(rows) => startSave(async () => {
            const r = await createGoalsFromScenario(planId, rows);
            if (!r.ok) { setSavedError(r.error); return; }
            setGoalsOpen(false);
            router.push(`/plans/${planId}/goals`);
          })}
        />
      )}

      {saveOpen && (
        <ApplyDialog
          plan={plan} lv={lv} at={at} from={from} num={num} signed={signed} saving={saving} error={savedError}
          onClose={() => setSaveOpen(false)}
          onApply={(scope) => startSave(async () => {
            const r = await applyScenario(planId, lv, scope, from);
            if (!r.ok) { setSavedError(r.error); return; }
            setSaveOpen(false);
            // The plan has moved, so the whole screen reloads against it: the sliders come back sitting on
            // the new figures, which are now the baseline everything else is measured from.
            setLv(planLevers(plan.workingCapital[1]));
            router.refresh();
          })}
        />
      )}
    </ModuleFrame>
  );
}

/**
 * A scenario, written down as goals (§6.44).
 *
 * The gentler of the two exits: it changes no figure anywhere, so a goal can be wrong without the forecast
 * being wrong. Each row is one lever the client moved, already carrying what that lever is worth — the
 * measured contribution, not a fresh calculation — and all that is left to decide is when and who.
 *
 * Quarter and owner default once at the top and then per row, because in practice a client sets "this
 * quarter, me" for all of them and changes one.
 */
function TurnIntoGoalsDialog({ goals, people, quarters, thisQuarter, saving, error, onClose, onCreate }: {
  goals: ProposedGoal[]; people: Person[]; quarters: QuarterChoice[];
  thisQuarter: { planYear: number; quarter: number };
  saving: boolean; error?: string;
  onClose: () => void; onCreate: (rows: GoalToCreate[]) => void;
}) {
  const key = (q: { planYear: number; quarter: number }) => `${q.planYear}:${q.quarter}`;
  const fallback = quarters.some((q) => key(q) === key(thisQuarter)) ? key(thisQuarter) : key(quarters[0]);
  const [when, setWhen] = useState<Record<string, string>>({});
  const [owner, setOwner] = useState<Record<string, string>>({});
  const [allWhen, setAllWhen] = useState(fallback);
  const [allOwner, setAllOwner] = useState("");

  const whenOf = (g: ProposedGoal) => when[g.lever] ?? allWhen;
  const ownerOf = (g: ProposedGoal) => owner[g.lever] ?? allOwner;
  const quarterOpts = quarters.map((q) => ({ value: key(q), label: `${q.label} · ${q.months}` }));
  const ownerOpts = [{ value: "", label: "Nobody yet" }, ...people.map((p) => ({ value: p.id, label: p.name || "Unnamed" }))];

  const rows = (): GoalToCreate[] => goals.map((g) => {
    const [year, quarter] = whenOf(g).split(":").map(Number);
    return { area: g.area, title: g.title, detail: g.detail, year, quarter, ownerPersonId: ownerOf(g) || null };
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-[720px]">
        <DialogHeader>
          <DialogTitle>Turn into goals</DialogTitle>
          <DialogDescription>
            One goal for each lever you moved, carrying what it is worth. They appear in Goals under their
            area and on your dashboard for the quarter you pick. Nothing in your forecast changes.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2 rounded border border-border bg-secondary px-3 py-2">
          <span className="text-[12.5px] text-muted-foreground">Set all to</span>
          <CellSelect className="h-7 w-[180px]" value={allWhen} onValueChange={(v) => { setAllWhen(v); setWhen({}); }} options={quarterOpts} />
          <CellSelect className="h-7 w-[160px]" value={allOwner} onValueChange={(v) => { setAllOwner(v); setOwner({}); }} options={ownerOpts} />
        </div>

        <div className="max-h-[42vh] overflow-auto rounded border border-border">
          {goals.map((g) => (
            <div key={g.lever} className="border-b border-border px-3 py-2 last:border-b-0">
              <div className="flex items-start gap-2">
                <span className="mt-[3px] w-[76px] flex-none text-[11px] font-semibold uppercase tracking-[.04em] text-muted-foreground">{AREA_LABEL[g.area]}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold">{g.title}</div>
                  {g.detail && <div className="text-[12px] text-muted-foreground">{g.detail}</div>}
                </div>
              </div>
              <div className="mt-1.5 flex flex-wrap gap-2 pl-[84px]">
                <CellSelect className="h-7 w-[180px]" value={whenOf(g)} onValueChange={(v) => setWhen((x) => ({ ...x, [g.lever]: v }))} options={quarterOpts} />
                <CellSelect className="h-7 w-[160px]" value={ownerOf(g)} onValueChange={(v) => setOwner((x) => ({ ...x, [g.lever]: v }))} options={ownerOpts} />
              </div>
            </div>
          ))}
        </div>
        {error && <p className="text-[12.5px] font-semibold text-bad">{error}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={() => onCreate(rows())} disabled={saving || !goals.length}>
            {saving ? "Creating…" : `Create ${goals.length} goal${goals.length === 1 ? "" : "s"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Making the scenario the plan (§6.45).
 *
 * The dialog that had to exist before this screen was a tool rather than a demo. It does three things a
 * client is entitled to before anything of theirs is overwritten.
 *
 * It LISTS every record — which product, what the price is now, what it becomes — because "10 products
 * changed" is a number to be trusted and a list is a thing to be checked.
 *
 * It says what it CANNOT reach. The overheads lever moves the rows in Overheads; the People line is each
 * person's salary and Marketing is its own module, and cutting overheads by a tenth cannot mean cutting
 * every salary by a tenth. So the share it is actually moving is stated, and the rest is named.
 *
 * And it shows the forecast RECOMPUTED from the records that will really be written — rounded figures,
 * unreachable overheads and all. Where that differs from the tile behind it, it says so. A screen that
 * promises a number the client will not have tomorrow is worse than one that never promised.
 */
function ApplyDialog({ plan, lv, at, from, num, signed, saving, error, onClose, onApply }: {
  plan: WhatIfPlan; lv: Levers; at: Levers; from: StartYear;
  num: (v: number) => string; signed: (v: number) => string; saving: boolean; error?: string;
  onClose: () => void; onApply: (scope: DayScope) => void;
}) {
  const [scope, setScope] = useState<DayScope>("year1");
  const [showAll, setShowAll] = useState(false);

  const planned = useMemo(() => plannedChanges(plan.sources, lv, at, from), [plan, lv, at, from]);
  /**
   * Two runs: what the sliders drew, and what the plan will actually hold. They differ by rounding and by
   * whatever the overheads lever could not reach, and the client sees the second.
   */
  const { preview, real } = useMemo(() => ({
    preview: runPlan(plan, lv, scope, from).outcome,
    real: runPlan({ ...plan, sources: applyChanges(plan.sources, planned.changes) },
      { ...planLevers(plan.workingCapital[1]), debtorDays: lv.debtorDays, stockDays: lv.stockDays, creditorDays: lv.creditorDays },
      scope).outcome,
  }), [plan, lv, scope, from, planned]);

  const base = useMemo(() => runPlan(plan, planLevers(plan.workingCapital[1])).outcome, [plan]);
  const gap = Math.round(real.operatingProfit - preview.operatingProfit);
  const byTable = (t: Change["table"]) => planned.changes.filter((c) => c.table === t);
  /** A percentage is not money and a count of driveways is not money; each reads as what it is. */
  const figure = (c: Change, v: number) =>
    c.unit === "percent" ? `${v > 0 ? "+" : ""}${Math.round(v * 100) / 100}%`
      : c.unit === "count" ? String(Math.round(v * 100) / 100)
        : num(v);
  const shown = showAll ? planned.changes : planned.changes.slice(0, 8);
  const oh = planned.overheads;
  const ohShare = oh.reached + oh.untouched > 0 ? Math.round((oh.reached / (oh.reached + oh.untouched)) * 100) : 100;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-[720px]">
        <DialogHeader>
          <DialogTitle>Make this the plan</DialogTitle>
          <DialogDescription>
            Your current figures are saved first, so this can be undone. Every record below is changed in the
            module that owns it — the same as editing it there by hand.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-x-4 gap-y-1 rounded border border-border bg-secondary px-3 py-2 text-[12.5px]">
          <span><b>{byTable("plan_products").length}</b> product {byTable("plan_products").length === 1 ? "figure" : "figures"}</span>
          <span><b>{byTable("plan_overheads").length}</b> overhead {byTable("plan_overheads").length === 1 ? "line" : "lines"}</span>
          {planned.daysMoved && <span><b>Working-capital days</b></span>}
        </div>

        {planned.changes.length > 0 && (
          <div className="max-h-[34vh] overflow-auto rounded border border-border">
            {shown.map((c) => (
              <div key={`${c.table}${c.id}${c.field}`} className="flex items-center gap-2 border-b border-border px-3 py-1.5 text-[13px] last:border-b-0">
                <span className="w-[150px] flex-none truncate" title={c.row}>{c.row}</span>
                <span className="w-[108px] flex-none text-[11.5px] text-muted-foreground">{c.label}</span>
                <span className="tabular-nums text-muted-foreground">{figure(c, c.from)}</span>
                <span className="text-muted-foreground">→</span>
                <span className="font-semibold tabular-nums">{figure(c, c.to)}</span>
              </div>
            ))}
            {planned.changes.length > shown.length && (
              <button type="button" onClick={() => setShowAll(true)}
                className="w-full px-3 py-1.5 text-left text-[12.5px] font-semibold text-primary hover:underline">
                Show the other {planned.changes.length - shown.length}
              </button>
            )}
          </div>
        )}

        {/* What the overheads lever cannot reach, sized rather than glossed over (§6.45). */}
        {Math.round(Number(lv.overheads)) !== 0 && oh.untouched > 0 && (
          <p className="rounded border border-warn/40 bg-warn-soft px-3 py-2 text-[12.5px] text-warn">
            This moves <b>{ohShare}%</b> of your overheads — the lines you typed. The other {num(oh.untouched)} a
            year is {oh.untouchedNames.join(" and ")}, which come from their own modules; a salary is a decision,
            not a slider. Change those in Leadership Team and Marketing.
          </p>
        )}

        {planned.daysMoved && (
          <div className="flex items-center gap-2">
            <span className="text-[13px]">Apply the days to</span>
            <div className="inline-flex overflow-hidden rounded border border-input">
              {(["year1", "all"] as const).map((k) => (
                <button key={k} type="button" onClick={() => setScope(k)} aria-pressed={scope === k}
                  className={cn("px-2.5 py-1 text-[12px] leading-none",
                    scope === k ? "bg-primary font-semibold text-primary-foreground" : "bg-background text-muted-foreground hover:bg-secondary")}>
                  {k === "year1" ? "Year 1 only" : "All five years"}
                </button>
              ))}
            </div>
          </div>
        )}

        <Grid>
          <thead>
            <tr>
              <Th style={{ width: "40%" }}>Year 1, after this</Th>
              <Th right>As planned</Th><Th right>After</Th><Th right>Change</Th>
            </tr>
          </thead>
          <tbody>
            {([["Revenue", "revenue"], ["Operating profit", "operatingProfit"], ["Lowest month-end cash", "lowestCash"]] as [string, keyof Measures][])
              .map(([lab, key]) => (
                <Row key={key} className={cn(key === "operatingProfit" && TOTAL_ROW)}>
                  <Td>{lab}</Td>
                  <Td right className="tabular-nums">{num(base[key])}</Td>
                  <Td right className="tabular-nums">{num(real[key])}</Td>
                  <Td right className={cn("tabular-nums", real[key] - base[key] > 0 && "text-good", real[key] - base[key] < 0 && "text-bad")}>
                    {signed(real[key] - base[key])}
                  </Td>
                </Row>
              ))}
          </tbody>
        </Grid>
        <p className="text-[12px] text-muted-foreground">
          {gap === 0
            ? "These are the figures the records will actually hold — the same as the sliders showed."
            : <>These are the figures the records will actually hold. Operating profit lands <b>{signed(gap)}</b> from
              the slider&apos;s {num(preview.operatingProfit)}, because {oh.untouched > 0 && Math.round(Number(lv.overheads)) !== 0
                ? "the overheads it cannot reach are unchanged" : "prices and counts round to what their columns hold"}.</>}
        </p>
        {error && <p className="text-[12.5px] font-semibold text-bad">{error}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={() => onApply(scope)} disabled={saving}>{saving ? "Applying…" : "Make this the plan"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ *
 * Pieces                                                              *
 * ------------------------------------------------------------------ */

/**
 * The standing line under the profit levers (§6.41.2).
 *
 * Price and Volume sit next to each other and look interchangeable — both raise revenue. They are not, and
 * which of the two a business reaches for is one of the larger decisions it makes. The figures are measured
 * from this plan, so a business whose extra work loses money is told that instead.
 */
function worthNote(w: ReturnType<typeof revenueWorth>): React.ReactNode {
  const price = w.price.margin, volume = w.volume.margin;
  if (price == null) return undefined;                       // nothing selling in Year 1
  const pct = (m: number) => `${Math.round(m * 100)}%`;
  const all = Math.abs(price - 1) < 0.005 ? "all" : pct(price);
  if (volume == null) return undefined;
  if (volume <= 0) {
    return <><b>Not all revenue is worth the same.</b> Raising prices costs nothing extra to deliver, so {all} of
      it reaches operating profit — but <b className="text-warn">selling more loses money on this plan</b>: the
      extra work costs more than it earns. Check the cost per unit before planning on volume.</>;
  }
  return <><b>Not all revenue is worth the same.</b> Raising prices costs nothing extra to deliver, so {all} of
    it reaches operating profit; winning more work keeps <b>{pct(volume)}</b>, because the extra has to be
    bought and made{w.multiple ? <> — so a price rise earns <b>{w.multiple.toFixed(1)}×</b> the profit of the same revenue
    from volume</> : null}.</>;
}

function Tile({ eyebrow, now, value, parts, interaction, num, signed, foot }: {
  eyebrow: string; now: number; value: number;
  parts: { lever: LeverKey; moved: boolean; effect: number }[]; interaction: number;
  num: (v: number) => string; signed: (v: number) => string; foot?: React.ReactNode;
}) {
  const delta = Math.round((value - now) * 100) / 100;
  const moved = parts.filter((c) => c.moved && Math.round(c.effect) !== 0);
  return (
    <div className="rounded border border-border bg-card px-3.5 py-3">
      <div className="flex items-start gap-3">
        <div>
          <span className="eyebrow">{eyebrow}</span>
          <div className="text-[12px] text-muted-foreground">As planned <b className="tabular-nums text-foreground">{num(now)}</b></div>
        </div>
        <span className={cn("ml-auto rounded-full px-2 py-[2px] text-[11px] font-semibold",
          !delta ? "bg-secondary text-muted-foreground" : delta > 0 ? "bg-good-soft text-good" : "bg-bad-soft text-bad")}>
          {!delta ? "No change yet" : delta > 0 ? "Better" : "Worse"}
        </span>
      </div>
      <div className={cn("mt-1.5 text-[28px] font-semibold leading-none tabular-nums", value < 0 && "text-bad")}>{num(value)}</div>
      <div className="mt-1 text-[12.5px] text-muted-foreground">
        {delta
          ? <><b className={cn("tabular-nums", delta > 0 ? "text-good" : "text-bad")}>{signed(delta)}</b> with these changes</>
          : "With these changes"}
      </div>
      {foot && <p className="mt-2 border-t border-border pt-2 text-[11.5px] leading-snug text-muted-foreground">{foot}</p>}
      {!foot && (moved.length > 0 || Math.round(interaction) !== 0) && (
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 border-t border-border pt-2 text-[11.5px] text-muted-foreground">
          {moved.map((c) => (
            <span key={c.lever}>{LABEL[c.lever]}{" "}
              <b className={cn("tabular-nums", c.effect > 0 ? "text-good" : "text-bad")}>{signed(c.effect)}</b>
            </span>
          ))}
          {Math.round(interaction) !== 0 && (
            <span>Together <b className={cn("tabular-nums", interaction > 0 ? "text-good" : "text-bad")}>{signed(interaction)}</b></span>
          )}
        </div>
      )}
    </div>
  );
}

function LeverCard({ title, note, keys, lv, at, set, translate, checkFor, historyOf, foot, action }: {
  title: string; note: string; keys: LeverKey[]; lv: Levers; at: Levers;
  set: (k: LeverKey, v: number) => void; translate: (k: LeverKey) => string;
  checkFor: (k: LeverKey) => Check | undefined; historyOf: (k: LeverKey) => number | null;
  foot?: React.ReactNode; action?: React.ReactNode;
}) {
  return (
    <div className="rounded border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <h2 className="text-[13px] font-semibold">{title}</h2>
        <span className="eyebrow ml-auto">{note}</span>
      </div>
      {keys.map((k) => <LeverRow key={k} k={k} lv={lv} at={at} set={set} note={translate(k)} check={checkFor(k)} history={historyOf(k)} />)}
      {action && <div className="border-t border-border px-3 py-2">{action}</div>}
      {foot && <div className="border-t border-border px-3 py-2 text-[12px] leading-snug text-muted-foreground">{foot}</div>}
    </div>
  );
}

function LeverRow({ k, lv, at, set, note, check, history }: {
  k: LeverKey; lv: Levers; at: Levers; set: (k: LeverKey, v: number) => void; note: string;
  check?: Check; history: number | null;
}) {
  const r = RANGE[k];
  const value = Number(lv[k]);
  const moved = value !== Number(at[k]);
  const clamp = (v: number) => Math.min(r.max, Math.max(r.min, v));
  // Where the business's own record sits on this track, as a share of it.
  const mark = history == null ? null : Math.min(100, Math.max(0, ((history - r.min) / (r.max - r.min)) * 100));
  return (
    <div className="grid grid-cols-[112px_minmax(0,1fr)_88px] items-center gap-x-3 gap-y-1 border-b border-border px-3 py-2 last:border-b-0">
      <div className="flex flex-col items-start">
        <label className={cn("text-[13px]", moved ? "font-semibold text-foreground" : "text-muted-foreground")} htmlFor={`lv-${k}`}>
          {LABEL[k]}
        </label>
        {/* The business's own record, and a way back to it: one click puts the slider where the accounts are. */}
        {history != null && (
          <button type="button" onClick={() => set(k, clamp(history))}
            title={`Set ${LABEL[k].toLowerCase()} back to what your accounts imply`}
            className="text-[10.5px] tabular-nums text-faint underline-offset-2 hover:text-primary hover:underline">
            {history} in history
          </button>
        )}
      </div>
      <div className="relative flex items-center">
        <input
          id={`lv-${k}`} type="range" min={r.min} max={r.max} step={r.step} value={value}
          onChange={(e) => set(k, clamp(Number(e.target.value)))}
          className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-border accent-primary"
        />
        {/* The business's own record, as a mark on the track — a reference, never the starting point. */}
        {mark != null && (
          <i aria-hidden title={`Your accounts imply ${history}`}
            className="pointer-events-none absolute top-1/2 h-3 w-px -translate-y-1/2 bg-foreground/40"
            style={{ left: `calc(${mark}% - 0.5px)` }} />
        )}
      </div>
      <div className="flex items-center gap-1">
        <Input
          className="h-7 px-1.5 text-right text-[13px] tabular-nums" inputMode="decimal"
          value={String(value)}
          onChange={(e) => {
            const v = Number(e.target.value.replace(/[^0-9.-]/g, ""));
            set(k, Number.isFinite(v) ? clamp(v) : Number(at[k]));
          }}
        />
        <span className="w-6 shrink-0 text-[11px] text-muted-foreground">{r.unit === "%" ? "%" : "days"}</span>
      </div>
      {note && <p className="col-[2/-1] text-[12px] leading-snug text-muted-foreground">{note}</p>}
      {/* A warning about this lever, beside the hand that is moving it (§6.41.2). */}
      {check && <p className="col-[2/-1] text-[12px] leading-snug text-warn">{check.text}</p>}
    </div>
  );
}

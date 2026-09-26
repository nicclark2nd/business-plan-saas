"use client";

import { useEffect, useMemo, useState, useSyncExternalStore, useTransition } from "react";
import { guarded } from "@/lib/guardedStart";
import { useSaveErrors } from "@/components/module/saveErrors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ModuleFrame, ModuleFooter, useModule } from "@/components/module/ModuleFrame";
import { CellInput, CellSelect, CellTextarea, LinkButton, Note, RemoveButton } from "@/components/module/DataGrid";
import { GUIDED_STEPS, navGroup } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { moneyFormatter } from "@/engine/plan/money";
import { AREA_LABEL } from "@/engine/whatif/goals";
import {
  AREA_HINT, MAX_KPIS, MEASURE_OF, PLAN_MEASURES, RUNGS, RUNG_LABEL, STATUSES,
  type Figures, type Goal, type GoalHorizon, type GoalStatus, type Header, type Kpi, type KpiTarget,
  type MeasureKey, type Person, type PlanMeasureValues, type SwotResponse,
} from "./model";
import { GoalsDraftDialog, type GoalQuestion } from "@/components/goals/GoalsDraftDialog";
import { GoalDialog } from "@/components/goals/GoalDialog";
import {
  closeNinetyDays, continueFromGoals, deleteGoal, deleteKpi, saveGoal, saveHeaderField, saveKpi, saveKpiTarget, setGoalStatus,
  type ReviewChoice,
} from "./actions";

type Tab = "ladder" | "swot";
const STEP = GUIDED_STEPS.find((s) => s.id === "goals")?.step ?? 14;

const TONE: Record<GoalStatus, string> = {
  not_started: "bg-secondary text-muted-foreground",
  in_progress: "bg-accent text-primary",
  done: "bg-good-soft text-good",
  at_risk: "bg-warn-soft text-warn",
};

/** "30 June 2027" — the date a rung falls due, written the way a person says it. */
const longDate = (iso: string | null | undefined) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso ?? ""));
  if (!m) return null;
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]))
    .toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
};

/**
 * Goals (§6.125) — a ladder at 1, 3 and 5 years, and the next 90 days underneath it.
 *
 * WHAT THIS REPLACED AND WHY, because the replacement is only defensible against it.
 *
 * The old screen put six long-form boxes down the page, one per area, each headed by a phrase describing
 * what the area COVERED — "Financial: profit, cash, margins and the terms behind them." A client reading
 * that is told the subject and never the task, and the only text that said "write a sentence here" was the
 * placeholder, which disappears the moment the box has a character in it. The instruction was visible only
 * before it was needed. No rewording fixes that; the shape had to change.
 *
 * SO EVERY FIELD ON THIS SCREEN IS A THING WITH A VALUE. A date. A revenue. A profit. A named measure and
 * the number wanted against it. The only free text left is the big goal at the top and the goals in the
 * lists — and by the time a client reaches those, the instruction above them is plain text that stays put.
 *
 * SIX FIGURES ARE SHOWN AND NONE IS STORED. Revenue and profit at all three rungs come from the forecast,
 * which runs five years. The near-miss here was giving each rung its own revenue and profit to type; that
 * is a second answer to a question the plan already answers, on the page a lender reads (§6.41).
 *
 * THE AREAS DID NOT DIE, THEY DEMOTED. They are a tag on a goal now. The report still groups by them,
 * What-If still writes them, Marketing still reads them — none of that had to change, which is the whole
 * reason the tag was kept rather than dropped.
 */
export function GoalsModule({
  planId, mode, initial, kpis: initialKpis, targets: initialTargets, header: initialHeader,
  figures, planMeasures, dates, currency, people, swot, drafting = null, aiOff = false, questions = [],
}: {
  planId: string; mode: "guided" | "advanced";
  initial: Goal[];
  kpis: Kpi[];
  targets: KpiTarget[];
  header: Header;
  /** Read from the forecast on the server, keyed by rung. Never written back. */
  figures: Partial<Record<string, Figures>>;
  /** What each plan-held measure reads at each rung (§6.125.1). Also read, also never written back. */
  planMeasures: PlanMeasureValues;
  /** Computed from the plan's financial year, keyed by rung. There is no picker for these. */
  dates: Record<string, string>;
  currency: string;
  people: Person[];
  swot: SwotResponse[];
  drafting?: { ready: boolean; reason?: string } | null;
  /** Drafting switched off for this plan — said out loud, with where to turn it on (§6.109, open item 29). */
  aiOff?: boolean;
  questions?: GoalQuestion[];
}) {
  const [tab, setTab] = useState<Tab>("ladder");
  const [goals, setGoals] = useState<Goal[]>(initial);
  /**
   * A REACT KEY THAT DOES NOT MOVE WHEN THE ROW IS SAVED.
   *
   * Found by driving the screen, not by reading it. Typing a measure's name and then clicking straight
   * into the unit box beside it saved the name — and threw the unit away. The row was keyed by its id, the
   * id changes from a temporary one to the database's the instant the insert returns, and a changed key
   * makes React throw the row away and build a new one: focus gone, and the half-typed word in the sibling
   * input with it.
   *
   * > AN IDENTIFIER THE SERVER OWNS IS NOT A KEY THE BROWSER CAN RENDER BY. The key is assigned once, when
   * > the row first appears on this screen, and never changes again whatever the database calls it.
   */
  const [kpis, setKpis] = useState<(Kpi & { uid: string })[]>(
    () => initialKpis.map((k) => ({ ...k, uid: k.id })));
  const [targets, setTargets] = useState<KpiTarget[]>(initialTargets);
  const [header, setHeader] = useState<Header>(initialHeader);
  const [pending, startRaw] = useTransition();
  /*
   * FAILURES REACH THE FOOTER AS WELL AS THE NOTE (§6.136, open item 25). The note sits at the top of a long
   * screen; a client editing the 90-day card never saw it. The footer is where every other step says a save
   * failed, so Goals says it there too — and a save that never reached the server is caught rather than
   * replacing the whole screen with an error page (`guarded`).
   */
  const errors = useSaveErrors();
  const [err, setErrState] = useState<string>();
  const setErr = (m?: string) => {
    setErrState(m);
    if (m) errors.raise({ key: "goals", message: m, label: "Goals" }); else errors.clear("goals");
  };
  const start = guarded(startRaw, (m) => setErr(m));
  const [editing, setEditing] = useState<{ goal?: Goal; from?: SwotResponse } | null>(null);
  const [toRemove, setToRemove] = useState<Goal | null>(null);
  const [drafts, setDrafts] = useState(false);

  // The plan can move underneath an open screen; the same rule the forecast grids follow (§6.43.2).
  const [cameFrom, setCameFrom] = useState(initial);
  if (initial !== cameFrom) { setCameFrom(initial); setGoals(initial); }

  const money = useMemo(() => moneyFormatter(currency), [currency]);
  const ownerName = (id: string | null) => people.find((p) => p.id === id)?.name || "";
  /* Closed goals are history (§6.137): kept, shown under "Earlier 90-day periods", and off every live list. */
  const at = (h: GoalHorizon) => goals.filter((g) => g.horizon === h && !g.closed_period_end);
  const ninety = at("ninety");
  const history = goals.filter((g) => g.closed_period_end);

  /**
   * HAS THE PERIOD ENDED (§6.137). Today is read on the client and never during the server render — the
   * server's date and the client's differ either side of midnight, and Nic is seven hours ahead of UTC.
   * Until it is known, nothing claims the period is over.
   */
  const today = useSyncExternalStore(() => () => {}, () => new Date().toLocaleDateString("en-CA"), () => null);
  const ends = header.ninety_day_ends_on;
  const periodOver = !!ends && !!today && today > ends;
  const [reviewing, setReviewing] = useState(false);
  const closePeriod = (decisions: { id: string; choice: ReviewChoice }[], nextEnd: string) => start(async () => {
    const r = await closeNinetyDays(planId, decisions, nextEnd);
    if (!r.ok) { setErr(r.error); return; }
    setErr(undefined);
    const closedOn = r.data!.closedOn;
    const by = new Map(decisions.map((d) => [d.id, d.choice]));
    setGoals((xs) => xs.map((g) => {
      const c = by.get(g.id);
      if (c === "done") return { ...g, status: "done", outcome: "done", closed_period_end: closedOn };
      if (c === "drop") return { ...g, outcome: "dropped", closed_period_end: closedOn };
      return g;
    }));
    setHeader((h) => ({ ...h, ninety_day_ends_on: nextEnd }));
    setReviewing(false);
  });

  /**
   * Lines from step 5 that nobody has committed to yet. One already answered is not offered twice — but a
   * goal that was DROPPED at a review no longer answers it, so the line is offered again (§6.137).
   */
  const committed = new Set(goals.filter((g) => g.outcome !== "dropped").map((g) => g.swot_item_id).filter(Boolean));
  const openSwot = swot.filter((s) => !committed.has(s.id));

  /* ---------- the top of the screen ---------- */

  const setField = (field: keyof Header, value: string) => setHeader((h) => ({ ...h, [field]: value }));
  const commitField = (field: keyof Header) => start(async () => {
    const r = await saveHeaderField(planId, field, String(header[field] ?? ""));
    setErr(r.ok ? undefined : r.error);
  });

  /* ---------- measures ---------- */

  const targetOf = (kpiId: string, h: GoalHorizon) =>
    targets.find((t) => t.kpi_id === kpiId && t.horizon === h)?.target ?? null;

  /**
   * WHAT IS IN THE BOX WHILE IT IS BEING TYPED IN (§6.125.1).
   *
   * Nic, watching a target field: *"the behaviour seems a bit random."* It was not random, it was
   * arithmetic. Every keystroke was run through `Number()` and the PARSED value was fed back as the box's
   * contents — so typing 3, then a decimal point, showed "3" again, because `Number("3.")` is 3 and the
   * dot had nowhere to live. A trailing zero vanished the same way.
   *
   * > A NUMBER IS WHAT IS SAVED. TEXT IS WHAT IS TYPED. Holding the keystrokes exactly as struck until
   * > focus leaves is the whole fix; the parse happens once, on the way to the database.
   */
  const [draft, setDraft] = useState<Record<string, string>>({});
  const cell = (kpiId: string, h: GoalHorizon) => `${kpiId}|${h}`;
  const shown = (kpiId: string, h: GoalHorizon) => draft[cell(kpiId, h)] ?? String(targetOf(kpiId, h) ?? "");

  /** A figure the plan already answers, formatted for the column it sits in. */
  const measureText = (key: MeasureKey, rung: string) => {
    const v = planMeasures[key]?.[rung];
    if (v === null || v === undefined) return "—";
    if (key === "closingCash") return money(v);
    if (key === "grossMargin") return `${Math.round(v * 10) / 10}`;
    return String(Math.round(v));
  };

  const setKpiField = (uid: string, patch: Partial<Kpi>) =>
    setKpis((xs) => xs.map((k) => (k.uid === uid ? { ...k, ...patch } : k)));

  const commitKpi = (k: Kpi & { uid: string }) => start(async () => {
    /*
     * A measure with no name is not saved and not an error. The row exists because the client clicked
     * "Add a measure" and is still deciding; refusing it in red for being empty would be the screen
     * telling them off for a step they are in the middle of (§6.98 is about failures that matter).
     */
    if (!k.name.trim()) return;
    const r = await saveKpi(planId, { id: k.id.startsWith("tmp-") ? undefined : k.id, name: k.name, unit: k.unit, sortOrder: k.sort_order });
    if (!r.ok) { setErr(r.error); return; }
    setErr(undefined);
    if (k.id.startsWith("tmp-") && r.data) {
      const realId = r.data.id;
      /* `uid` is deliberately left alone — see the note on the state above. */
      setKpis((xs) => xs.map((x) => (x.uid === k.uid ? { ...x, id: realId } : x)));
      setTargets((ts) => ts.map((t) => (t.kpi_id === k.id ? { ...t, kpi_id: realId } : t)));
    }
  });

  /**
   * ADDING A MEASURE IS A CHOICE BETWEEN TWO KINDS, NOT A BLANK ROW (§6.125.1).
   *
   * The five the plan already answers are offered by name, and picking one saves it immediately — there is
   * nothing to type, because its name, its unit and its figure at every rung are all decided elsewhere.
   * "Something else" gives the blank row, which is the right shape only for a measure the plan knows
   * nothing about.
   */
  const addMeasure = (choice: string) => {
    if (kpis.length >= MAX_KPIS) return;
    if (choice === "custom") {
      const id = `tmp-${crypto.randomUUID()}`;
      setKpis((xs) => [...xs, { id, uid: id, name: "", unit: null, sort_order: xs.length, source_key: null }]);
      return;
    }
    const m = MEASURE_OF[choice as MeasureKey];
    if (!m) return;
    const id = `tmp-${crypto.randomUUID()}`;
    const row = { id, uid: id, name: m.name, unit: m.unit || null, sort_order: kpis.length, source_key: m.key };
    setKpis((xs) => [...xs, row]);
    start(async () => {
      const r = await saveKpi(planId, { name: m.name, unit: m.unit || null, sortOrder: row.sort_order, sourceKey: m.key });
      if (!r.ok) { setErr(r.error); setKpis((xs) => xs.filter((x) => x.uid !== id)); return; }
      setErr(undefined);
      if (r.data) setKpis((xs) => xs.map((x) => (x.uid === id ? { ...x, id: r.data!.id } : x)));
    });
  };

  const removeKpi = (k: Kpi & { uid: string }) => {
    setKpis((xs) => xs.filter((x) => x.uid !== k.uid));
    setTargets((ts) => ts.filter((t) => t.kpi_id !== k.id));
    if (k.id.startsWith("tmp-")) return;
    start(async () => { const r = await deleteKpi(planId, k.id); if (!r.ok) setErr(r.error); });
  };

  const commitTarget = (kpiId: string, h: GoalHorizon, raw: string) => start(async () => {
    if (kpiId.startsWith("tmp-")) return;   // the measure itself has not been saved yet
    const r = await saveKpiTarget(planId, kpiId, h, raw);
    /* The keystrokes stay in the box on a failure, so nothing typed disappears while the message
       explaining why is still on screen (§6.98). */
    if (!r.ok) { setErr(r.error); return; }
    setErr(undefined);
    setDraft((d) => { const next = { ...d }; delete next[cell(kpiId, h)]; return next; });
    /*
     * WHAT POSTGRES KEPT, NOT WHAT WE SENT (§6.121). `numeric(16,3)` drops a fourth decimal place without
     * complaining, so the box is refilled from the stored value rather than left showing the keystrokes.
     */
    if (r.data) setTargets((ts) => ts.map((t) => (t.kpi_id === kpiId && t.horizon === h ? { ...t, target: r.data!.target } : t)));
  });

  /* ---------- goals ---------- */

  const saveOne = (input: Parameters<typeof saveGoal>[1], existing?: Goal) => start(async () => {
    const r = await saveGoal(planId, input);
    if (!r.ok) { setErr(r.error); return; }
    setErr(undefined);
    const row = r.data as unknown as Goal;
    setGoals((xs) => existing ? xs.map((g) => (g.id === existing.id ? row : g)) : [...xs, row]);
    setEditing(null);
  });

  const changeStatus = (g: Goal, status: GoalStatus) => {
    setGoals((xs) => xs.map((x) => (x.id === g.id ? { ...x, status } : x)));
    start(async () => { const r = await setGoalStatus(planId, g.id, status); if (!r.ok) setErr(r.error); });
  };

  const remove = (g: Goal) => start(async () => {
    const r = await deleteGoal(planId, g.id);
    if (!r.ok) { setErr(r.error); return; }
    setGoals((xs) => xs.filter((x) => x.id !== g.id));
    setToRemove(null);
  });

  /** A one-line goal on a long horizon: typed in place, saved when focus leaves, removed when emptied. */
  const [adding, setAdding] = useState<Partial<Record<GoalHorizon, string>>>({});
  const commitAdd = (h: GoalHorizon) => {
    const text = (adding[h] ?? "").trim();
    setAdding((a) => ({ ...a, [h]: "" }));
    if (!text) return;
    saveOne({ horizon: h, area: null, title: text, sortOrder: at(h).length });
  };

  const editLine = (g: Goal, title: string) => setGoals((xs) => xs.map((x) => (x.id === g.id ? { ...x, title } : x)));
  const commitLine = (g: Goal) => {
    const text = g.title.trim();
    if (!text) { remove(g); return; }
    saveOne({ id: g.id, horizon: g.horizon, area: g.area, title: text, detail: g.detail }, g);
  };

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const intent = ((e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null)?.value === "later" ? "later" : "next";
    /* Not guarded: the action ends in a redirect, and a catch around it could swallow the navigation. */
    startRaw(async () => { await continueFromGoals(planId, intent); });
  };

  /**
   * A LOSS IS SAID IN WORDS, NOT LEFT TO A MINUS SIGN (§6.115.1, again).
   *
   * §6.115.1 caught this in the AI drafter: net profit went through the money formatter, which renders a
   * loss the way an accountant does, and the draft that came back called a loss a profit. The same trap is
   * on this screen — the first build showed SEQ's year-one figure as a quiet "-136,681" in the same weight
   * and colour as the two profits beside it, under a label reading "Net profit".
   *
   * > A SIGN IS A CONVENTION. The word is the statement. So a negative year changes the LABEL as well as
   * > the number, and is coloured as the bad news it is.
   */
  const figure = (h: string, k: keyof Figures) => {
    const v = figures[h]?.[k];
    if (v === null || v === undefined) return { label: k === "revenue" ? "Revenue" : "Net profit", text: "—", bad: false };
    const loss = k === "profit" && v < 0;
    return {
      label: k === "revenue" ? "Revenue" : loss ? "Net LOSS" : "Net profit",
      text: money(loss ? Math.abs(v) : v),
      bad: loss,
    };
  };

  return (
    <ModuleFrame
      errors={errors}
      step={STEP} total={GUIDED_STEPS.length} group={navGroup("goals")} title="Goals"
      subtitle="Where the business is going at one, three and five years — and what happens in the next ninety days"
      mode={mode}
      areas={[
        { key: "ladder", label: "The ladder", count: goals.length },
        ...(swot.length ? [{ key: "swot", label: "From your SWOT", count: openSwot.length }] : []),
      ]}
      area={tab} onArea={(k) => setTab(k as Tab)}
      scope={{ label: "This plan" }}
      footer={<ModuleFooter planId={planId} moduleId="goals" formId="goals-form" />}
      help={<>
        <h3>One ladder, four rungs</h3>
        <p>The three cards say where the business is going at <b>one, three and five years</b>. The band underneath is the <b>next ninety days</b> — the only rung that carries a name and a date, because it is the only one anybody can act on this week.</p>
        <h3>The figures are not yours to type</h3>
        <p>Revenue and profit on each card come straight out of your forecast, which runs five years. If a figure is not what you want it to be, the answer is to change the forecast — the <b>What-If</b> planner exists for exactly that and writes its result back into the plan. A target typed here that disagreed with your own forecast would be the plan contradicting itself in front of a lender.</p>
        <h3>The dates are not yours to type either</h3>
        <p>They come from <b>Financial year ends in</b> and <b>First projected year</b> in Settings. Change those and all three move.</p>
        <h3>Measures</h3>
        <p>Three at most, named once, with the number you want against each at every rung. A business that steers by nine numbers steers by none.</p>
        <h3>Areas</h3>
        <p>Financial, Marketing, Sales and the rest are a <b>tag</b> now, not a heading. They decide which section of the report a goal is printed under, and nothing else. A five-year picture of the business does not need one.</p>
        <h3>From your SWOT</h3>
        <p>Anything you said you would do about a strength, weakness, opportunity or threat back at step 5 is waiting on its own tab. Turning one into a goal is where it gets an owner and a date.</p>
      </>}
    >
      <form id="goals-form" onSubmit={onSubmit} className="hidden" />
      <PendingBridge pending={pending} />
      {err && <Note><span className="text-bad">{err}</span></Note>}

      {tab === "ladder" ? (
        <div className="@container space-y-4 px-5 py-4">

          {/* ---------- the big goal and the one number ---------- */}
          <section className="grid gap-4 @[880px]:grid-cols-[minmax(0,1fr)_minmax(0,340px)]">
            <div>
              <h2 className="text-[13px] font-semibold">The big goal</h2>
              <p className="mt-0.5 text-[11.5px] text-muted-foreground">
                One or two sentences. Where this business is ultimately going — the thing the five-year card is a step towards.
              </p>
              <CellTextarea
                className="mt-1.5 min-h-[72px] w-full rounded border border-input bg-card px-2 py-1.5 text-[13px]"
                value={header.big_goal} disabled={pending}
                onChange={(e) => setField("big_goal", e.target.value)}
                onBlur={() => commitField("big_goal")}
              />
            </div>
            <div className="rounded border border-border bg-secondary/40 p-3">
              <h2 className="text-[13px] font-semibold">North Star</h2>
              <p className="mt-0.5 text-[11.5px] text-muted-foreground">
                The single number this business steers by. One measure, one figure — not a list.
              </p>
              <div className="mt-2 flex gap-2">
                <Input
                  className="h-8 flex-1 text-[13px]" placeholder="Measure — e.g. active members"
                  value={header.north_star_metric} disabled={pending}
                  onChange={(e) => setField("north_star_metric", e.target.value)}
                  onBlur={() => commitField("north_star_metric")}
                />
                <Input
                  className="h-8 w-[104px] text-right text-[13px]" placeholder="Value"
                  value={header.north_star_value} disabled={pending}
                  onChange={(e) => setField("north_star_value", e.target.value)}
                  onBlur={() => commitField("north_star_value")}
                />
              </div>
              <CellTextarea
                className="mt-2 min-h-[54px] w-full rounded border border-input bg-card px-2 py-1.5 text-[12.5px]"
                placeholder="Why that is the number. A few lines."
                value={header.north_star_why} disabled={pending}
                onChange={(e) => setField("north_star_why", e.target.value)}
                onBlur={() => commitField("north_star_why")}
              />
            </div>
          </section>

          {/* ---------- measures, named once ---------- */}
          <section className="rounded border border-border">
            <div className="flex items-center gap-2 border-b border-border bg-secondary px-3 py-1.5">
              <span className="eyebrow">Measures you steer by</span>
              <span className="text-[11.5px] text-muted-foreground">Named once here; the number you want at each rung goes on the cards below.</span>
              {kpis.length < MAX_KPIS && (
                <CellSelect
                  className="ml-auto h-7 w-[300px]" value="" onValueChange={addMeasure}
                  placeholder="+ Add a measure"
                  options={[
                    ...PLAN_MEASURES
                      .filter((m) => !kpis.some((k) => k.source_key === m.key))
                      .map((m) => ({ value: m.key, label: `${m.name} — from ${m.from}` })),
                    { value: "custom", label: "Something else — I'll set the targets" },
                  ]} />
              )}
            </div>
            {kpis.length === 0 ? (
              <p className="px-3 py-2.5 text-[12.5px] text-muted-foreground">
                None yet. Pick one your plan already works out — gross margin, cash, debtor days — or add your own: days to produce a unit, defects per batch, jobs won per month.
              </p>
            ) : kpis.map((k) => (
              <div key={k.uid} className="flex items-center gap-2 border-b border-border px-3 py-1.5 last:border-b-0">
                {k.source_key ? (
                  /*
                    NOT A FIELD, BECAUSE IT IS NOT AN ANSWER THIS SCREEN OWNS (§6.125.1). An input a client
                    can put a number into is a promise that the number will be kept (§6.87); these are read
                    from the plan, so the row says where they come from and offers nothing to type.
                  */
                  <>
                    <span className="min-w-0 flex-1 text-[13px] font-medium">{k.name}</span>
                    <span className="text-[11.5px] text-muted-foreground">
                      from {MEASURE_OF[k.source_key as MeasureKey]?.from ?? "your plan"} — not set here
                    </span>
                    <span className="w-[92px] text-[11.5px] text-muted-foreground">{k.unit}</span>
                  </>
                ) : (
                  <>
                    <CellInput
                      className="min-w-0 flex-1" placeholder="What you measure" value={k.name} disabled={pending}
                      onChange={(e) => setKpiField(k.uid, { name: e.target.value })} onBlur={() => commitKpi(k)}
                    />
                    <CellInput
                      className="w-[92px]" placeholder="Unit" value={k.unit ?? ""} disabled={pending}
                      onChange={(e) => setKpiField(k.uid, { unit: e.target.value })} onBlur={() => commitKpi(k)}
                    />
                  </>
                )}
                <RemoveButton onClick={() => removeKpi(k)} />
              </div>
            ))}
          </section>

          {/* ---------- the drafter, once, above the three cards ---------- */}
          {/*
            SILENCE SENDS A CLIENT LOOKING FOR A BUTTON THAT IS NOT THERE (§6.109). Every other draftable
            box says when drafting is off and where to turn it on; Goals rendered nothing, and every new plan
            starts with drafting off. Same words as DraftField, so the two cannot drift into different advice.
          */}
          {!drafting && aiOff && (
            <p className="text-[11.5px] text-muted-foreground">
              Drafting is off for this plan. Turn it on in{" "}
              <a className="font-semibold text-primary hover:underline" href={`/plans/${planId}/settings?area=ai`}>Plan settings</a>.
            </p>
          )}
          {drafting && (
            <div className="flex flex-wrap items-center gap-2.5">
              {drafting.ready ? (
                <>
                  <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => setDrafts(true)}>✦ Suggest a draft</Button>
                  <span className="text-[11.5px] text-muted-foreground">
                    Asks you two short questions, then writes the goals from your forecast, your plan and what you said you would do about your SWOT. No owners, no dates — those stay yours.
                  </span>
                </>
              ) : (
                <span className="text-[11.5px] text-muted-foreground">{drafting.reason}</span>
              )}
            </div>
          )}

          {/* ---------- the three rungs ---------- */}
          <section className="grid gap-3 @[900px]:grid-cols-3">
            {RUNGS.map(({ key, label, asks, listHeading }) => {
              const rows = at(key);
              return (
                <div key={key} className="flex flex-col rounded border border-border">
                  <div className="border-b border-border bg-secondary px-3 py-2">
                    <div className="flex items-baseline justify-between gap-2">
                      <h2 className="text-[13px] font-semibold">{label}</h2>
                      {/* Computed, never typed — so it is text, not an input (§6.89 in reverse). */}
                      <span className="text-[11.5px] tabular-nums text-muted-foreground">{longDate(dates[key]) ?? "—"}</span>
                    </div>
                  </div>

                  <dl className="divide-y divide-border border-b border-border text-[12.5px]">
                    {(["revenue", "profit"] as const).map((which) => {
                      const f = figure(key, which);
                      return (
                        <div key={which} className="flex items-center justify-between px-3 py-1.5">
                          <dt className={cn("text-muted-foreground", f.bad && "font-semibold text-bad")}>{f.label}</dt>
                          <dd className={cn("tabular-nums font-semibold", f.bad && "text-bad")}>{f.text}</dd>
                        </div>
                      );
                    })}
                    {kpis.filter((k) => k.name.trim()).map((k) => (
                      <div key={k.uid} className="flex items-center justify-between gap-2 px-3 py-1.5">
                        <dt className="min-w-0 flex-1 truncate text-muted-foreground" title={k.name}>{k.name}</dt>
                        <dd className="flex items-center gap-1">
                          {k.source_key ? (
                            <span className="w-[74px] text-right tabular-nums font-semibold">
                              {measureText(k.source_key as MeasureKey, key)}
                            </span>
                          ) : (
                            <CellInput
                              numeric className="w-[74px]" placeholder="—"
                              value={shown(k.id, key)} disabled={pending}
                              onChange={(e) => setDraft((d) => ({ ...d, [cell(k.id, key)]: e.target.value }))}
                              onBlur={(e) => commitTarget(k.id, key, e.target.value)}
                            />
                          )}
                          {k.unit && <span className="w-[34px] shrink-0 text-[11px] text-muted-foreground">{k.unit}</span>}
                        </dd>
                      </div>
                    ))}
                  </dl>

                  {/*
                    THE INSTRUCTION IS TEXT AND IT STAYS (§6.125). This is the sentence the old screen kept
                    in a placeholder, where it vanished the moment anybody wrote anything.
                  */}
                  <div className="px-3 pt-2.5">
                    <span className="eyebrow">{listHeading}</span>
                    <p className="mt-0.5 text-[11.5px] text-muted-foreground">{asks}</p>
                  </div>

                  <div className="flex-1 px-3 py-2">
                    {rows.map((g) => (
                      <div key={g.id} className="group flex items-start gap-1.5 py-1">
                        <CellTextarea
                          className="min-h-[34px] w-full rounded border border-transparent bg-transparent px-1.5 py-1 text-[12.5px] hover:border-input focus:border-input focus:bg-card"
                          value={g.title} disabled={pending}
                          onChange={(e) => editLine(g, e.target.value)}
                          onBlur={() => commitLine(g)}
                        />
                        <RemoveButton onClick={() => setToRemove(g)} />
                      </div>
                    ))}
                    <CellTextarea
                      className="mt-1 min-h-[34px] w-full rounded border border-dashed border-input bg-transparent px-1.5 py-1 text-[12.5px]"
                      placeholder="+ Add one" value={adding[key] ?? ""} disabled={pending}
                      onChange={(e) => setAdding((a) => ({ ...a, [key]: e.target.value }))}
                      onBlur={() => commitAdd(key)}
                    />
                  </div>
                </div>
              );
            })}
          </section>

          {/* ---------- the next ninety days ---------- */}
          <section className="rounded border border-border">
            <div className="flex flex-wrap items-center gap-2 border-b border-border bg-secondary px-3 py-1.5">
              <span className="eyebrow">{RUNG_LABEL.ninety}</span>
              <span className="text-[11.5px] text-muted-foreground">Ends</span>
              {/*
                THE ONE DATE ON THIS SCREEN THAT IS A PICKER. The three above are decided by the plan's
                financial year; a review cycle starts when a business decides it starts, and nothing in the
                plan could know that.
              */}
              <Input
                type="date" className="h-7 w-[150px] text-[12.5px]"
                value={header.ninety_day_ends_on ?? ""} disabled={pending}
                onChange={(e) => setField("ninety_day_ends_on", e.target.value)}
                onBlur={() => commitField("ninety_day_ends_on")}
              />
              <span className="text-[11.5px] text-muted-foreground">
                Everything here carries a name and a date. A goal nobody owns does not happen.
              </span>
              <LinkButton className="ml-auto whitespace-nowrap" onClick={() => setEditing({})}>+ Add a goal</LinkButton>
            </div>
            {/*
              THE PERIOD HAS ENDED AND THE SCREEN SAYS SO (§6.137, open item 23). Until now the band went on
              showing the same goals with the same statuses long after the date, and nothing prompted anyone.
            */}
            {periodOver && (
              <div className="flex flex-wrap items-center gap-3 border-b border-warn/40 bg-warn-soft px-3 py-2 text-[12.5px]">
                <span>These ninety days ended on <b>{longDate(ends)}</b>. Close them — mark what got done, carry forward what did not, drop what no longer matters — and set the next ninety.</span>
                <Button type="button" size="sm" className="ml-auto" disabled={pending} onClick={() => setReviewing(true)}>Review the 90 days</Button>
              </div>
            )}
            {ninety.length === 0 ? (
              <p className="px-3 py-2.5 text-[12.5px] text-muted-foreground">
                Nothing yet. These are the steps towards the one-year card — the things that have to move in the next ninety days.
              </p>
            ) : ninety.map((g) => (
              <div key={g.id} className="flex items-center gap-2 border-b border-border px-3 py-1.5 text-[13px] last:border-b-0">
                <button type="button" className="min-w-0 flex-1 truncate text-left hover:text-primary hover:underline"
                  title={g.detail ? `${g.title} — ${g.detail}` : g.title} onClick={() => setEditing({ goal: g })}>
                  {g.title}
                </button>
                {/* Outside the truncating cell: where a goal came from is the first thing truncation ate. */}
                {g.source === "whatif" && (
                  <span className="flex-none rounded-full bg-accent px-1.5 text-[10px] font-semibold text-primary" title="Created from a What-If scenario">What-If</span>
                )}
                <span className="w-[86px] flex-none truncate text-[11.5px] text-muted-foreground" title={g.area ? AREA_HINT[g.area] : undefined}>
                  {g.area ? AREA_LABEL[g.area] : "—"}
                </span>
                <span className="w-[92px] flex-none truncate text-[11.5px] text-muted-foreground">{ownerName(g.owner_person_id) || "—"}</span>
                <span className="w-[84px] flex-none tabular-nums text-[11.5px] text-muted-foreground">{g.milestone_date ?? "—"}</span>
                <select
                  value={g.status} disabled={pending}
                  onChange={(e) => changeStatus(g, e.target.value as GoalStatus)}
                  className={cn("h-6 rounded border-0 px-1.5 text-[11px] font-semibold", TONE[g.status])}>
                  {STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
                <RemoveButton onClick={() => setToRemove(g)} />
              </div>
            ))}
          </section>

          {/* ---------- earlier ninety days: kept, never deleted (§6.137) ---------- */}
          {history.length > 0 && <NinetyHistory goals={history} ownerName={ownerName} />}
        </div>
      ) : (
        /* ---------- From your SWOT ---------- */
        <div className="px-5 py-4">
          <p className="text-[12.5px] text-muted-foreground">
            What you said at step 5 you would do about each line. Turning one into a goal is where it gets an owner and a date — it lands in the next ninety days.
          </p>
          {openSwot.length === 0 ? (
            <p className="mt-3 text-[12.5px] text-muted-foreground">Nothing waiting. Every line you answered has a goal against it.</p>
          ) : (
            <div className="mt-3 rounded border border-border">
              {openSwot.map((s) => (
                <div key={s.id} className="flex items-start gap-3 border-b border-border px-3 py-2 last:border-b-0">
                  <span className="w-[92px] flex-none text-[11px] font-semibold uppercase text-muted-foreground">{s.quadrant}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[12.5px] text-muted-foreground">{s.text}</p>
                    <p className="text-[13px]">{s.response}</p>
                  </div>
                  <LinkButton className="flex-none whitespace-nowrap" onClick={() => setEditing({ from: s })}>Make it a goal</LinkButton>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {editing && (
        <GoalDialog
          goal={editing.goal} from={editing.from} people={people} pending={pending}
          onClose={() => setEditing(null)}
          onSave={(input) => saveOne({
            id: editing.goal?.id, horizon: "ninety", area: input.area ?? null, title: input.title,
            ownerPersonId: input.ownerPersonId, status: input.status, milestoneDate: input.milestoneDate,
            swotItemId: editing.from?.id ?? editing.goal?.swot_item_id ?? null,
          }, editing.goal)}
        />
      )}

      {reviewing && ends && (
        <ReviewDialog ends={ends} goals={ninety} ownerName={ownerName} pending={pending}
          onCancel={() => setReviewing(false)} onClose={closePeriod} />
      )}

      {toRemove && (
        <Dialog open onOpenChange={(o) => !o && setToRemove(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>Remove this goal?</DialogTitle></DialogHeader>
            <p className="text-[13px]">{toRemove.title || "This goal has no wording yet."}</p>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setToRemove(null)}>Keep it</Button>
              <Button type="button" variant="destructive" disabled={pending} onClick={() => remove(toRemove)}>Remove</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {drafts && (
        <GoalsDraftDialog
          planId={planId} questions={questions}
          existing={Object.fromEntries(RUNGS.map(({ key }) => [key, at(key).map((g) => g.title).join("\n")]))}
          /*
            ONE LINE, ONE GOAL (§6.125). The drafter returns a rung as a block of lines because that is
            what streams cleanly; a rung is a LIST on this screen, so the block is split here rather than
            saved as one goal with newlines in the middle of it.
          */
          onUse={(horizon, text) => {
            const h = horizon as GoalHorizon;
            const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
            let n = at(h).length;
            for (const title of lines) saveOne({ horizon: h, area: null, title, sortOrder: n++ });
          }}
          onClose={() => setDrafts(false)}
        />
      )}
    </ModuleFrame>
  );
}

/** The footer's "Saving…" for Goals (§6.136) — it never knew about any save on this screen. */
function PendingBridge({ pending }: { pending: boolean }) {
  const { setPending, setNote } = useModule();
  useEffect(() => setPending(pending), [pending, setPending]);
  useEffect(() => setNote(pending ? "Saving…" : undefined), [pending, setNote]);
  return null;
}

/** Ninety-one days on: thirteen weeks, so the next period ends on the same weekday as the last. */
const plus91 = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + 91));
  return t.toISOString().slice(0, 10);
};

/**
 * THE END-OF-PERIOD REVIEW (§6.137). One decision per goal, with a sensible first answer already chosen —
 * done if it is marked done, carried forward otherwise — so a review of a well-kept list is one click.
 */
function ReviewDialog({ ends, goals, ownerName, pending, onCancel, onClose }: {
  ends: string; goals: Goal[]; ownerName: (id: string | null) => string; pending: boolean;
  onCancel: () => void; onClose: (d: { id: string; choice: ReviewChoice }[], nextEnd: string) => void;
}) {
  const [choice, setChoice] = useState<Record<string, ReviewChoice>>(() =>
    Object.fromEntries(goals.map((g) => [g.id, g.status === "done" ? "done" : "carry"])));
  const [next, setNext] = useState(plus91(ends));
  const OPTIONS: { key: ReviewChoice; label: string }[] = [
    { key: "done", label: "Done" }, { key: "carry", label: "Carry forward" }, { key: "drop", label: "Drop" },
  ];
  const n = (c: ReviewChoice) => goals.filter((g) => choice[g.id] === c).length;
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(next) && next > ends;
  return (
    <Dialog open onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader><DialogTitle>Close the ninety days that ended {longDate(ends)}</DialogTitle></DialogHeader>
        {goals.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">There were no goals in this period. Set the next end date and start again.</p>
        ) : (
          <div className="max-h-[46vh] overflow-auto rounded border border-border">
            {goals.map((g) => (
              <div key={g.id} className="flex items-center gap-3 border-b border-border px-3 py-2 text-[13px] last:border-b-0">
                <div className="min-w-0 flex-1">
                  <div className="truncate" title={g.title}>{g.title}</div>
                  <div className="text-[11.5px] text-muted-foreground">{ownerName(g.owner_person_id) || "Nobody"}{g.milestone_date ? ` · due ${longDate(g.milestone_date)}` : ""}</div>
                </div>
                <div className="flex flex-none overflow-hidden rounded border border-border" role="radiogroup" aria-label={g.title}>
                  {OPTIONS.map((o) => (
                    <button key={o.key} type="button" role="radio" aria-checked={choice[g.id] === o.key}
                      onClick={() => setChoice((c) => ({ ...c, [g.id]: o.key }))}
                      className={cn("px-2.5 py-1 text-[11.5px] font-semibold", choice[g.id] === o.key ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground")}>
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
          <span>The next ninety days end on</span>
          <Input type="date" className="h-8 w-[160px]" value={next} onChange={(e) => setNext(e.target.value)} />
          {!valid && <span className="text-bad">It has to be after {longDate(ends)}.</span>}
        </div>
        <p className="text-[11.5px] text-muted-foreground">
          {goals.length > 0 && <>{n("done")} done, {n("carry")} carried forward, {n("drop")} dropped. </>}
          Done and dropped goals are kept under Earlier 90-day periods, not deleted.
        </p>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>Not now</Button>
          <Button type="button" disabled={pending || !valid}
            onClick={() => onClose(goals.map((g) => ({ id: g.id, choice: choice[g.id] ?? "carry" })), next)}>
            Close the 90 days
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Every closed period, newest first, with what got done beside what was dropped (§6.137). */
function NinetyHistory({ goals, ownerName }: { goals: Goal[]; ownerName: (id: string | null) => string }) {
  const periods = [...new Set(goals.map((g) => g.closed_period_end!))].sort().reverse();
  return (
    <details className="rounded border border-border">
      <summary className="cursor-pointer bg-secondary px-3 py-1.5 text-[12.5px]">
        <span className="eyebrow mr-2">Earlier 90-day periods</span>
        <span className="text-muted-foreground">{periods.length} closed</span>
      </summary>
      {periods.map((p) => {
        const inP = goals.filter((g) => g.closed_period_end === p);
        const done = inP.filter((g) => g.outcome === "done").length;
        return (
          <div key={p} className="border-t border-border">
            <div className="px-3 py-1.5 text-[12px] font-semibold">
              Ended {longDate(p)} <span className="font-normal text-muted-foreground">· {done} of {inP.length} done</span>
            </div>
            {inP.map((g) => (
              <div key={g.id} className="flex items-center gap-2 px-3 py-1 text-[12.5px]">
                <span className={cn("w-[62px] flex-none rounded-full px-1.5 text-center text-[10px] font-semibold",
                  g.outcome === "done" ? "bg-good-soft text-good" : "bg-secondary text-muted-foreground")}>
                  {g.outcome === "done" ? "Done" : "Dropped"}
                </span>
                <span className={cn("min-w-0 flex-1 truncate", g.outcome === "dropped" && "text-muted-foreground line-through")} title={g.title}>{g.title}</span>
                <span className="w-[110px] flex-none truncate text-[11.5px] text-muted-foreground">{ownerName(g.owner_person_id) || "—"}</span>
              </div>
            ))}
          </div>
        );
      })}
    </details>
  );
}


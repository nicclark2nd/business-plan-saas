import type { GoalArea } from "@/engine/whatif/goals";

/**
 * Goals — a ladder, not six boxes (§6.125).
 *
 * WHAT THE OLD SHAPE GOT WRONG, kept here because the replacement only makes sense against it.
 *
 * Until 0046 this screen asked for one annual goal per area, and each box was headed by a phrase describing
 * what the AREA covered: "Financial — profit, cash, margins and the terms behind them." That tells a client
 * the SUBJECT and never the TASK. The only text that said what to write was the placeholder, and a
 * placeholder is gone the moment the box has a character in it — so the instruction was visible only before
 * it was needed and absent every time afterwards.
 *
 * The ladder states the same few facts at 1, 3 and 5 years. Every field on it is a thing with a value: a
 * date, a revenue, a profit, a named measure and the number wanted against it. There is nothing left to
 * interpret, which is the actual repair — no wording would have fixed the old screen.
 *
 * THE AREAS SURVIVE AS A TAG. They no longer decide the shape of anything; they group. The report, What-If,
 * the SWOT commitment and Marketing's Actions tab all still read `area`, and none of them had to change.
 */
export type GoalStatus = "not_started" | "in_progress" | "done" | "at_risk";
export type GoalHorizon = "ninety" | "year1" | "year3" | "year5";

export type Goal = {
  id: string;
  horizon: GoalHorizon;
  /** Optional now (§6.125): a five-year picture of the business is not "a Marketing goal". */
  area: GoalArea | null;
  title: string;
  detail: string | null;
  year: number | null;
  quarter: number | null;
  owner_person_id: string | null;
  status: GoalStatus;
  milestone_date: string | null;
  source: "manual" | "ai" | "whatif";
  sort_order: number;
  swot_item_id: string | null;
  /** The 90-day period this goal was closed under, and how (§6.137). Both null while it is live. */
  closed_period_end?: string | null;
  outcome?: "done" | "dropped" | null;
};

/**
 * A measure the plan steers by.
 *
 * `source_key` decides who owns its numbers (§6.125.1). Null means the client's own: they name it and type
 * a target at each rung. Set means the plan already answers it — the name, the unit and every figure are
 * read, and there is no box to type in, because a typed debtor-days target beside a working-capital
 * schedule that says something else is two answers to one question (§6.41).
 */
export type Kpi = { id: string; name: string; unit: string | null; sort_order: number; source_key: string | null };
export type KpiTarget = { kpi_id: string; horizon: GoalHorizon; target: number | null };

/** The one big goal and the one number, for the whole plan rather than per rung. */
export type Header = {
  big_goal: string;
  north_star_metric: string;
  north_star_value: string;
  north_star_why: string;
  ninety_day_ends_on: string | null;
};

/** Revenue and profit at a horizon, READ from the forecast and never stored (§6.125). */
export type Figures = { revenue: number | null; profit: number | null };

export type SwotResponse = { id: string; quadrant: string; text: string; response: string };
export type Person = { id: string; name: string; role: string | null };

export const STATUSES: { key: GoalStatus; label: string; tone: "muted" | "primary" | "good" | "warn" }[] = [
  { key: "not_started", label: "Not started", tone: "muted" },
  { key: "in_progress", label: "In progress", tone: "primary" },
  { key: "done", label: "Done", tone: "good" },
  { key: "at_risk", label: "At risk", tone: "warn" },
];

export const STATUS_LABEL: Record<GoalStatus, string> =
  Object.fromEntries(STATUSES.map((s) => [s.key, s.label])) as Record<GoalStatus, string>;

/**
 * THE THREE RUNGS, AND WHAT EACH ONE ASKS FOR IN WORDS THAT DO NOT DISAPPEAR.
 *
 * `asks` is the instruction and it is rendered as TEXT above the list, not as a placeholder. That is the
 * whole lesson of the screen this replaced: an instruction that vanishes when the box fills is an
 * instruction the client can never re-read.
 *
 * The three rungs deliberately ask for different KINDS of thing, which is why each has its own wording
 * rather than one sentence with the year swapped in. A year out you commit; five years out you describe.
 */
export const RUNGS: { key: Exclude<GoalHorizon, "ninety">; planYear: number; label: string; asks: string; listHeading: string }[] = [
  {
    key: "year1", planYear: 1, label: "1-Year",
    listHeading: "Goals for the year",
    asks: "What has to be true twelve months from now. Things you are committing to, not hoping for — one line each.",
  },
  {
    key: "year3", planYear: 3, label: "3-Year",
    listHeading: "What it looks like",
    asks: "Describe the business three years out as if you were walking someone through it. Size, shape, what it is known for.",
  },
  {
    key: "year5", planYear: 5, label: "5-Year",
    listHeading: "What it looks like",
    asks: "Where this ends up. The version of the business the whole plan is aimed at.",
  },
];

export const RUNG_LABEL: Record<GoalHorizon, string> = {
  ninety: "Next 90 days", year1: "1-Year", year3: "3-Year", year5: "5-Year",
};

/**
 * What each area covers, in the client's language. Still useful — but now it labels a TAG on a goal rather
 * than heading a box, which is the only job it was ever any good at.
 */
export const AREA_HINT: Record<GoalArea, string> = {
  financial: "Profit, cash, margins and the terms behind them.",
  management: "How the business is run and who runs it — reporting, systems, accountability.",
  marketing: "Being known by the people who buy, and what that costs.",
  sales: "What you sell, to whom, at what price, and how much of it.",
  operational: "Delivering the work — capacity, quality, suppliers, equipment.",
  ai: "Where software and AI change how the business works.",
};

/**
 * THE MEASURES THE PLAN ALREADY ANSWERS (§6.125.1).
 *
 * Every one of these is decided somewhere else in the plan and used by the forecast. Offering them here as
 * something to TYPE was the same fault revenue and profit were rescued from one section earlier — it took
 * a real client adding "debtor days" to make it visible.
 *
 * `from` says where the figure is read, and nothing on this list is ever written back.
 */
export type MeasureKey = "grossMargin" | "closingCash" | "debtorDays" | "stockDays" | "creditorDays";

export const PLAN_MEASURES: { key: MeasureKey; name: string; unit: string; from: string }[] = [
  { key: "grossMargin", name: "Gross margin", unit: "%", from: "your forecast" },
  { key: "closingCash", name: "Cash at year end", unit: "", from: "your forecast" },
  { key: "debtorDays", name: "Debtor days", unit: "days", from: "your assumptions" },
  { key: "stockDays", name: "Stock days", unit: "days", from: "your assumptions" },
  { key: "creditorDays", name: "Creditor days", unit: "days", from: "your assumptions" },
];

export const MEASURE_OF = Object.fromEntries(PLAN_MEASURES.map((m) => [m.key, m])) as
  Record<MeasureKey, (typeof PLAN_MEASURES)[number]>;

/** What a plan-held measure reads at each rung, worked out on the server. Keyed measure → rung → value. */
export type PlanMeasureValues = Partial<Record<string, Partial<Record<string, number | null>>>>;

/** At most three measures. A plan that steers by nine numbers steers by none. */
export const MAX_KPIS = 3;

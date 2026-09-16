import type { GoalArea } from "@/engine/whatif/goals";

/**
 * Goals — two levels, six areas (§6.7, §6.44).
 *
 * One ANNUAL goal per area, which heads the matching section of the report, and any number of QUARTERLY
 * goals beneath it with a quarter, an owner, a status and a milestone. The database has enforced the shape
 * since migration 0002: `parent_id is null` marks an annual goal, and a unique index allows exactly one per
 * area per plan.
 */
export type GoalStatus = "not_started" | "in_progress" | "done" | "at_risk";

export type Goal = {
  id: string;
  parent_id: string | null;
  area: GoalArea;
  title: string;
  detail: string | null;
  year: number | null;
  quarter: number | null;
  owner_person_id: string | null;
  status: GoalStatus;
  milestone_date: string | null;
  source: "manual" | "ai" | "whatif";
  sort_order: number;
  /** The SWOT line this goal answers, if any (§6.59.1). */
  swot_item_id: string | null;
};

/**
 * A SWOT line the client said they would do something about, offered here as a goal (§6.59.1).
 *
 * The response is written at step 5 and the commitment is made here, at step 14, which is deliberate: a
 * quarter and an owner are set with the forecast in front of you, not eight steps before it exists.
 */
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
 * The prompt in each empty box. Written per area rather than generated from the label, because generating
 * it gives "Where ai is going this year" — and a placeholder is the first sentence a client reads.
 */
export const AREA_PROMPT: Record<GoalArea, string> = {
  financial: "Where the money side of the business is going this year — one or two sentences.",
  management: "Where the running of the business is going this year — one or two sentences.",
  marketing: "Where your marketing is going this year — one or two sentences.",
  sales: "Where your selling is going this year — one or two sentences.",
  operational: "Where delivery is going this year — one or two sentences.",
  ai: "Where AI and software fit into the business this year — one or two sentences.",
};

/**
 * What each area is for, in the client's language rather than the consultant's. Shown once beside the
 * annual goal so nobody has to guess what belongs under "Management".
 */
export const AREA_HINT: Record<GoalArea, string> = {
  financial: "Profit, cash, margins and the terms behind them.",
  management: "How the business is run and who runs it — reporting, systems, accountability.",
  marketing: "Being known by the people who buy, and what that costs.",
  sales: "What you sell, to whom, at what price, and how much of it.",
  operational: "Delivering the work — capacity, quality, suppliers, equipment.",
  ai: "Where software and AI change how the business works.",
};

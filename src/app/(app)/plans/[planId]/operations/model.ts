/**
 * Operations (§6.84) — where the work happens, who supplies it, how it flows, and what limits it.
 *
 * The one section of a standard business plan the app had no data for. Every outline asks for it and a
 * client could not answer a single question in it, so the report would have printed a heading with nothing
 * under it — the fault this project refuses to ship (§6.57).
 */
export const TENURE = [
  { value: "owned", label: "Owned" },
  { value: "leased", label: "Leased" },
  { value: "shared", label: "Shared or serviced" },
  { value: "none", label: "No fixed premises" },
];

/**
 * How badly the business is hurt if this supplier stops. Deliberately the same four words SWOT and
 * Competitors use for threat, because a client should not learn two scales for one idea.
 */
export const DEPENDENCY = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

export type Premise = {
  id: string; name: string; address: string | null; tenure: string | null; is_primary: boolean;
  floor_area: string | null; monthly_cost: number | null; purpose: string | null; sort_order: number;
};
export type Supplier = {
  id: string; name: string; supplies: string | null; terms: string | null;
  dependency: string | null; alternative: string | null; sort_order: number;
};
export type OpStep = {
  id: string; title: string; detail: string | null; owner: string | null; duration: string | null; sort_order: number;
};

export const CAPACITY_FIELDS = [
  { key: "operating_hours", label: "When the business operates",
    hint: "Days and hours the work actually happens, including any seasonal change.",
    placeholder: "e.g. Pours start 5am, crews on site 6am–3pm Mon–Fri. Saturday pours by arrangement. December is a three-week shutdown." },
  { key: "capacity_now", label: "What we can deliver today",
    hint: "How much work the business can do as it stands, in the units you sell in.",
    placeholder: "e.g. Two crews, about 9 slabs a week in good weather — roughly 400 a year." },
  { key: "capacity_constraint", label: "What limits it",
    hint: "The one thing that runs out first. Not a list — the binding constraint.",
    placeholder: "e.g. Licensed finishers. We can hire labourers in a week; a finisher takes three months to find." },
  { key: "capacity_plan", label: "How we lift it",
    hint: "What it takes to do more, and roughly what that costs. This is what connects the operation to the revenue forecast.",
    placeholder: "e.g. A third crew needs one finisher, two labourers and a second pump — about 180,000 a year and a 65,000 asset." },
  { key: "quality_approach", label: "How we keep the quality up",
    hint: "What stops the work going wrong, and what happens when it does.",
    placeholder: "e.g. Slump tested on every pour, photos filed against the job, and we re-pour our own mistakes before anyone asks." },
] as const;

export type CapacityKey = (typeof CAPACITY_FIELDS)[number]["key"];
export type Capacity = Record<CapacityKey, string>;

/**
 * THE WRITTEN ROW UNDER A PROCESS STEP (\u00a76.114). Out of the grid's JSX for the same reason as everything
 * else the drafter reads: one wording, on the screen and in the prompt (\u00a76.41).
 *
 * The step's OWNER is not draftable and never will be \u2014 it is a person's name, and no slice of this plan
 * reads a person. Its duration is a fact nothing can shape.
 */
export const STEP_DETAIL = {
  key: "detail", label: "What happens",
  placeholder: "e.g. Levels taken, boxing set, steel ordered against the measured quantity rather than the quote.",
} as const;

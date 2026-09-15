/**
 * A scenario, turned into goals (§6.44).
 *
 * The levers are decisions. A decision with a number on it, an owner and a quarter is a goal — which is the
 * whole reason this exit exists: the scenario a client liked on Tuesday is forgotten by Friday unless
 * somebody owns it.
 *
 * **Every figure traces to a lever's measured contribution**, never to a formula written here. "Raise prices
 * 5% — worth 109,112 to operating profit in Year 1" is the number the tile showed, which is the number a
 * full re-run of the plan produced (§6.41). A goal that quoted a different figure from the screen it came
 * from would be the oldest fault in this project wearing a new hat.
 *
 * The areas come from the six the plan already has (§6.7). Price and volume are Sales; cost of goods and
 * stock are Operational; overheads, debtor days and creditor days are Financial. That mapping is a
 * judgement and it is stated here once rather than guessed at by whoever writes the dialog.
 */
import { LEVER_KEYS, type Contribution, type LeverKey, type Levers, type WhatIf } from "./levers";
import type { Noun } from "../plan/vocabulary";

/** The plan's six goal areas (§6.7). Matches the `goal_area` enum exactly. */
export type GoalArea = "financial" | "management" | "marketing" | "sales" | "operational" | "ai";

export const GOAL_AREAS: { key: GoalArea; label: string }[] = [
  { key: "financial", label: "Financial" },
  { key: "management", label: "Management" },
  { key: "marketing", label: "Marketing" },
  { key: "sales", label: "Sales" },
  { key: "operational", label: "Operational" },
  { key: "ai", label: "AI" },
];

export const AREA_LABEL: Record<GoalArea, string> =
  Object.fromEntries(GOAL_AREAS.map((a) => [a.key, a.label])) as Record<GoalArea, string>;

/** Where each lever's goal belongs. A judgement, made once, in the open. */
const AREA_OF: Record<LeverKey, GoalArea> = {
  price: "sales",
  volume: "sales",
  cogs: "operational",
  stockDays: "operational",
  overheads: "financial",
  debtorDays: "financial",
  creditorDays: "financial",
};

export type ProposedGoal = {
  lever: LeverKey;
  area: GoalArea;
  /** What the business will do. One line, in the client's own words and units. */
  title: string;
  /** What it is worth, and where the figure came from. */
  detail: string;
};

const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const pct = (v: number) => `${v > 0 ? "+" : ""}${Math.round(v * 10) / 10}%`;
const bare = (v: number) => `${Math.abs(Math.round(v * 10) / 10)}%`;

/**
 * One goal per lever the client actually moved (§6.44).
 *
 * `money` is the plan's own formatter and `noun` its own word for what it sells, so a physiotherapist gets
 * treatments in pounds. Nothing is proposed for a lever at rest: a goal nobody chose is noise in a list that
 * only works while everything in it was chosen.
 */
export function proposedGoals(
  what: WhatIf, levers: Levers, noun: Noun, money: (v: number) => string,
): ProposedGoal[] {
  const base = what.base.outcome, now = what.adjusted.outcome;
  const at = what.base.levers;
  const by = (k: LeverKey) => what.contributions.find((c) => c.lever === k) as Contribution;
  const cashIn = (k: LeverKey) => what.tightest.contributions.find((c) => c.lever === k)?.effect ?? 0;

  const worth = (k: LeverKey) => {
    const profit = by(k).effect.operatingProfit;
    const cash = cashIn(k);
    const parts = [
      Math.round(profit) !== 0 ? `${money(profit)} of operating profit` : "",
      Math.round(cash) !== 0 ? `${money(cash)} of cash in the tightest month` : "",
    ].filter(Boolean);
    return parts.length ? `Worth ${parts.join(" and ")} in Year 1.` : "";
  };

  const days = (k: LeverKey) => Math.round(Number(levers[k]) - Number(at[k]));

  const out: ProposedGoal[] = [];
  for (const lever of LEVER_KEYS) {
    if (!by(lever).moved) continue;
    const area = AREA_OF[lever];
    let title = "";
    switch (lever) {
      case "price": {
        const p = n(levers.price);
        title = `${p > 0 ? "Raise" : "Cut"} prices by ${bare(p)} across the range`;
        break;
      }
      case "volume": {
        const more = Math.round(now.unitsYear1 - base.unitsYear1);
        const word = Math.abs(more) === 1 ? noun.one : noun.many.toLowerCase();
        title = `Win ${Math.abs(more)} ${more >= 0 ? "more" : "fewer"} ${word} this year — about ${Math.max(1, Math.round(Math.abs(more) / 12))} a month`;
        break;
      }
      case "cogs":
        title = `${n(levers.cogs) < 0 ? "Cut" : "Accept"} cost per sale by ${bare(n(levers.cogs))} — suppliers, materials and subcontractors`;
        break;
      case "overheads":
        title = `${n(levers.overheads) < 0 ? "Take" : "Add"} ${money(Math.abs(base.overheads - now.overheads))} ${n(levers.overheads) < 0 ? "out of" : "to"} overheads across the year`;
        break;
      case "debtorDays":
        title = `Bring debtor days from ${Math.round(Number(at.debtorDays))} to ${Math.round(Number(levers.debtorDays))} — get paid ${Math.abs(days("debtorDays"))} days ${days("debtorDays") < 0 ? "sooner" : "later"}`;
        break;
      case "stockDays":
        title = `Hold ${Math.round(Number(levers.stockDays))} days of stock, not ${Math.round(Number(at.stockDays))}`;
        break;
      case "creditorDays":
        title = `Agree ${Math.round(Number(levers.creditorDays))}-day terms with suppliers, up from ${Math.round(Number(at.creditorDays))}`;
        break;
    }
    out.push({ lever, area, title, detail: worth(lever) });
  }
  return out;
}

/** The percentage a lever moved, for a screen that wants to show it beside the goal. */
export const leverMove = (levers: Levers, at: Levers, k: LeverKey) =>
  k.endsWith("Days")
    ? `${Math.round(Number(levers[k]))} days`
    : pct(n(levers[k]) - n(at[k]));

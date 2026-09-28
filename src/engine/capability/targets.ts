import type { Target } from "./assessment";

/**
 * THE TARGETS THE PLANNER AGREES (§6.165).
 *
 * The assessment proposes one target per problem it finds; the Planner agrees it, at that figure or their own.
 * Stored on `plan_settings.agreed_targets`, one key per kind. Two of them are not only targets but the very
 * setting the plan runs on — the cash floor, and the term of the loans already owed — so agreeing them here
 * sets them there too, and the Planner is never asked for the same figure twice (SaaS_Requirements §0).
 */
export type TargetKind = Target["kind"];
export type AgreedTarget = { value: number; proposed: number; agreed_at: string };
export type AgreedTargets = Partial<Record<TargetKind, AgreedTarget>>;

export type TargetMeta = {
  /** Reads before the figure: "Gross margin of", "Overheads no more than". */
  label: string;
  unit: "pct" | "money" | "days" | "months";
  min: number;
  max: number;
  whole: boolean;
  /** Money targets are whole: a plan is not built to the cent. */
  /** The plan setting this target IS, when it is one — agreeing writes it. */
  sets?: { label: string; to: string };
};

export const TARGET_META: Record<TargetKind, TargetMeta> = {
  grossMargin: { label: "Gross margin of", unit: "pct", min: 0, max: 100, whole: false },
  overheadsCap: { label: "Overheads for the year no more than", unit: "money", min: 0, max: 1e12, whole: true },
  debtorDays: { label: "Customers paying in", unit: "days", min: 0, max: 365, whole: true },
  loanTermMonths: { label: "Existing loans paid back over", unit: "months", min: 1, max: 360, whole: true,
    sets: { label: "Funding → Loans already owed", to: "funding" } },
  cashFloor: { label: "Cash never below", unit: "money", min: 0, max: 1e12, whole: true,
    sets: { label: "Assumptions → Cash & capital", to: "assumptions?area=cash" } },
  breakEven: { label: "Profit of at least", unit: "money", min: -1e12, max: 1e12, whole: true },
};

export const TARGET_KINDS = Object.keys(TARGET_META) as TargetKind[];

/** A typed figure made safe to store: finite, within the kind's range, whole where it has to be. */
export function clampTarget(kind: TargetKind, v: number): number | null {
  const meta = TARGET_META[kind];
  if (!meta || !Number.isFinite(v)) return null;
  const c = Math.min(meta.max, Math.max(meta.min, v));
  return meta.whole ? Math.round(c) : Math.round(c * 100) / 100;
}

/** The stored column read defensively: unknown kinds and malformed entries are dropped, never trusted. */
export function readTargets(raw: unknown): AgreedTargets | null {
  if (raw === null || raw === undefined || typeof raw !== "object" || Array.isArray(raw)) return null;
  const out: AgreedTargets = {};
  for (const kind of TARGET_KINDS) {
    const e = (raw as Record<string, unknown>)[kind];
    if (!e || typeof e !== "object") continue;
    const { value, proposed, agreed_at } = e as Record<string, unknown>;
    const v = clampTarget(kind, Number(value));
    if (v === null) continue;
    const p = clampTarget(kind, Number(proposed));
    out[kind] = { value: v, proposed: p ?? v, agreed_at: typeof agreed_at === "string" ? agreed_at : "" };
  }
  return out;
}

/**
 * Whether agreeing (or removing) a target may write through to the setting it is.
 *
 * Only when the setting is still empty, or still holds what was last agreed here — a figure the Planner has
 * since typed on Funding or Assumptions is theirs, and a target agreed later does not overwrite it.
 */
export function mayWriteThrough(setting: number | null, lastAgreed: number | null): boolean {
  return setting === null || (lastAgreed !== null && setting === lastAgreed);
}

/* ------------------------------------------------------------------ *
 * The plan against its targets (§6.167)                              *
 * ------------------------------------------------------------------ */

/** The steps each target is shown on, and the one the Plan view links to for it. */
export const TARGET_STEPS: Record<TargetKind, { shownOn: string[]; fix: { label: string; to: string } }> = {
  grossMargin: { shownOn: ["sales", "cogs"], fix: { label: "COGS", to: "cogs" } },
  overheadsCap: { shownOn: ["overheads"], fix: { label: "Overheads", to: "overheads" } },
  breakEven: { shownOn: ["overheads", "sales"], fix: { label: "Overheads", to: "overheads" } },
  debtorDays: { shownOn: ["assumptions"], fix: { label: "Assumptions → Days & timing", to: "assumptions?area=days" } },
  loanTermMonths: { shownOn: ["funding"], fix: { label: "Funding → Loans already owed", to: "funding" } },
  cashFloor: { shownOn: ["assumptions", "funding"], fix: { label: "Funding", to: "funding" } },
};

/** What the plan holds, reduced to the figures the six targets are read against. */
export type TargetFacts = {
  firstYear: number;
  /** Year 1 of the forecast; null while the plan is too empty to run. */
  y1: { revenue: number; cogs: number; overheads: number; operatingProfit: number } | null;
  /** The debtor days the forecast runs on in Year 1. */
  debtorDays: number | null;
  /** The term the forecast repays the loans already owed over; null while it carries them flat. */
  loanTermMonths: number | null;
  /** The lowest month-end cash across all five years, and when. */
  lowestCash: { value: number; when: string } | null;
};

export type TargetCheck = {
  kind: TargetKind;
  /** "Gross margin 42%" */
  target: string;
  /** "Plan has 39.1% in 2027" — or why there is no figure yet. */
  plan: string;
  /** true met, false short, null nothing in the plan to read yet. */
  met: boolean | null;
  /** How far off, in the target's terms and in money where it has one: "2.9 points short — about 63,300 of gross profit". */
  gap: string | null;
  fix: { label: string; to: string };
};

const pctText = (v: number) => `${Math.round(v * 10) / 10}%`;

/**
 * EACH AGREED TARGET READ AGAINST THE PLAN. The same arithmetic on every step and on the Plan view, so the
 * COGS screen and Financial Capabilities can never disagree about whether the margin target is met.
 */
export function checkTargets(targets: AgreedTargets | null, f: TargetFacts, money: (v: number) => string, only?: string): TargetCheck[] {
  if (!targets) return [];
  const y = f.firstYear, p = f.y1, out: TargetCheck[] = [];
  for (const kind of TARGET_KINDS) {
    const t = targets[kind];
    if (!t || (only && !TARGET_STEPS[kind].shownOn.includes(only))) continue;
    const fix = TARGET_STEPS[kind].fix, v = t.value;
    const none = (plan: string): TargetCheck => ({ kind, target: "", plan, met: null, gap: null, fix });
    let c: TargetCheck;
    switch (kind) {
      case "grossMargin": {
        c = { ...none("No sales in the plan yet"), target: `Gross margin ${pctText(v)}` };
        if (p && p.revenue > 0) {
          const gm = ((p.revenue - p.cogs) / p.revenue) * 100, short = v - gm;
          c = { ...c, plan: `Plan has ${pctText(gm)} in ${y}`, met: short <= 0.05,
            gap: short > 0.05 ? `${Math.round(short * 10) / 10} points short — about ${money((short / 100) * p.revenue)} less profit on ${y}'s sales` : null };
        }
        break;
      }
      case "overheadsCap": {
        c = { ...none("No overheads in the plan yet"), target: `Overheads no more than ${money(v)} in ${y}` };
        if (p && p.overheads > 0) {
          const over = p.overheads - v;
          c = { ...c, plan: `Plan has ${money(p.overheads)}`, met: over <= 0.5, gap: over > 0.5 ? `${money(over)} over` : null };
        }
        break;
      }
      case "breakEven": {
        c = { ...none("Nothing in the plan yet"), target: `Profit of at least ${money(v)} in ${y}` };
        if (p && (p.revenue > 0 || p.overheads > 0)) {
          const short = v - p.operatingProfit;
          const shown = p.operatingProfit < 0 ? `a loss of ${money(-p.operatingProfit)}` : money(p.operatingProfit);
          c = { ...c, plan: `Plan has ${shown}`, met: short <= 0.5, gap: short > 0.5 ? `${money(short)} short` : null };
        }
        break;
      }
      case "debtorDays": {
        c = { ...none("No payment days in the plan yet"), target: `Customers paying in ${v} days` };
        if (f.debtorDays !== null) {
          const slower = f.debtorDays - v;
          const cash = p && p.revenue > 0 ? ` — about ${money((slower / 365) * p.revenue)} more cash stuck in unpaid invoices` : "";
          c = { ...c, plan: `Plan has ${Math.round(f.debtorDays)} days in ${y}`, met: slower <= 0.5,
            gap: slower > 0.5 ? `${Math.round(slower)} days slower${cash}` : null };
        }
        break;
      }
      case "loanTermMonths": {
        c = { ...none("The plan cannot work out the loan payments until the interest rate is in"), target: `Existing loans paid back over ${v} months` };
        if (f.loanTermMonths !== null) {
          const shorter = v - f.loanTermMonths;
          c = { ...c, plan: `Plan pays them back over ${f.loanTermMonths} months`, met: shorter <= 0,
            gap: shorter > 0 ? `${shorter} months shorter, so the yearly payments are higher` : null };
        }
        break;
      }
      case "cashFloor": {
        c = { ...none("No monthly cash in the plan yet"), target: `Cash never below ${money(v)}` };
        if (f.lowestCash) {
          const under = v - f.lowestCash.value;
          const low = f.lowestCash.value < 0 ? `overdrawn by ${money(-f.lowestCash.value)}` : money(f.lowestCash.value);
          c = { ...c, plan: `Lowest month ${low}, ${f.lowestCash.when}`, met: under <= 0.5,
            gap: under > 0.5 ? `${money(under)} below the cash floor at its lowest` : null };
        }
        break;
      }
    }
    out.push(c);
  }
  return out;
}

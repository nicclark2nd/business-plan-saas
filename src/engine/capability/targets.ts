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
  overheadsCap: { label: "Overheads a year no more than", unit: "money", min: 0, max: 1e12, whole: true },
  debtorDays: { label: "Customers paying in", unit: "days", min: 0, max: 365, whole: true },
  loanTermMonths: { label: "Loans already owed repaid over", unit: "months", min: 1, max: 360, whole: true,
    sets: { label: "Funding → Loans already owed", to: "funding" } },
  cashFloor: { label: "Cash never below", unit: "money", min: 0, max: 1e12, whole: true,
    sets: { label: "Assumptions → Cash & capital", to: "assumptions?area=cash" } },
  breakEven: { label: "Operating profit of at least", unit: "money", min: -1e12, max: 1e12, whole: true },
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

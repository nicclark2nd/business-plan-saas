/**
 * The reality checks (§6.41).
 *
 * A planner that lets a client drag price to +10 % and reports a handsome profit has not helped them; it has
 * agreed with them. These are the sentences that disagree — and every one of them is either arithmetic the
 * run already did (a month that closes below zero, a loss that turns into a profit) or a plainly stated rule
 * of thumb with its threshold in the open.
 *
 * **Nothing here is invented about the client's business.** The mockup said "needs a third crew — yours are
 * at capacity from March", which the app cannot know and a concreter would resent being told. What it can
 * say is how many more jobs a month that is, and ask. The rule is: state the consequence, name the number,
 * ask the question. Never assert a fact about a business the plan has not been told.
 *
 * Order is deliberate: what breaks, then what improves, then what to watch. A client who has just broken
 * their cash flow should read that before a compliment.
 */
import type { LeverKey, Levers, WhatIf } from "./levers";
import type { WorkingCapitalDays } from "../forecast/model";

export type CheckLevel = "bad" | "good" | "warn";
/**
 * A check about ONE lever names it, and the screen puts the sentence under that slider, where the hand
 * already is. A check about the scenario as a whole names none, and stays in the panel with the others.
 * Without the distinction the same warning ends up in both places, said twice and agreeing with itself.
 */
export type Check = { key: string; level: CheckLevel; text: string; lever?: LeverKey };

const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

/** "March", "March and June", "March, June and October" — a list a person would say out loud. */
export function listed(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/**
 * The months a scenario runs dry. Ten of them named one by one is a sentence nobody finishes reading, and a
 * run of consecutive months is one fact anyway — so a run is stated as a run.
 */
export function listedMonths(months: number[], name: (m: number) => string): string {
  const run = months.length >= 3 && months.every((m, i) => i === 0 || m === months[i - 1] + 1);
  return run ? `${name(months[0])} through to ${name(months[months.length - 1])}` : listed(months.map(name));
}

/**
 * What to say about a scenario (§6.41).
 *
 * `monthNames` is the plan's own twelve months in its own financial year (§6.21) and `money` its own
 * formatter, so a Manchester plan is told about April and pounds rather than January and dollars.
 *
 * `history` is what the business's own last accounts imply (§6.41.3). Where it exists it replaces the rules
 * of thumb for the three days levers, because "your accounts imply 46 days" is a stronger and more honest
 * challenge than "under 30 is quick for most trades" — it is the client's own record rather than my opinion.
 * A plan with no history keeps the rules of thumb, which is all anyone can offer a business with no track
 * record yet.
 */
export function realityChecks(
  what: WhatIf, levers: Levers, monthNames: string[], money: (v: number) => string,
  history?: WorkingCapitalDays | null,
): Check[] {
  const base = what.base.outcome, now = what.adjusted.outcome;
  const bad: Check[] = [], good: Check[] = [], warn: Check[] = [];
  const month = (m: number) => monthNames[m - 1] ?? `month ${m}`;

  /* ---- what breaks ---- */

  // The guard. If the statements stop agreeing under a lever, nothing else on the screen is worth reading.
  if (!now.reconciled) {
    bad.push({
      key: "reconciled", level: "bad",
      text: "These changes do not reconcile — the profit, the cash and the balance sheet no longer agree. Reset the levers and tell us what you had set.",
    });
  }

  const wasNegative = base.negativeMonths.length > 0;
  if (now.negativeMonths.length) {
    const where = listedMonths(now.negativeMonths, month);
    bad.push({
      key: "negative", level: "bad",
      text: wasNegative
        ? `Cash still closes below zero in ${where}. The business needs funding in place before then, or a bigger change than this.`
        : `Cash now closes below zero in ${where} — it did not before these changes. The business would need funding in place before then.`,
    });
  }

  if (base.operatingProfit >= 0 && now.operatingProfit < 0) {
    warn.push({
      key: "into-loss", level: "warn",
      text: `Year 1 turns from an operating profit into a loss of ${money(Math.abs(now.operatingProfit))}.`,
    });
  }

  /* ---- what improves ---- */

  if (base.operatingProfit < 0 && now.operatingProfit >= 0) {
    good.push({
      key: "into-profit", level: "good",
      text: `Year 1 goes from an operating loss to a profit of ${money(now.operatingProfit)}.`,
    });
  }
  if (wasNegative && !now.negativeMonths.length) {
    good.push({
      key: "cleared", level: "good",
      text: `Every month now closes above zero. The tightest is ${month(now.lowestMonth)}, at ${money(now.lowestCash)}.`,
    });
  }

  /* ---- what to watch ---- */

  const p = n(levers.price), v = n(levers.volume), c = n(levers.cogs), o = n(levers.overheads);
  const basis = what.base.levers;

  if (p > 5) {
    warn.push({
      key: "price", level: "warn", lever: "price",
      text: `A rise of ${p}% is above the 5% where most businesses start losing work. Try it alongside a small cut to volume and see whether it still pays.`,
    });
  }
  /**
   * Five per cent, not eight. Winning more work is the lever an owner reaches for first and the one the model
   * flatters most: it adds no crew, no vehicle and no supervisor, because the plan has not been told it needs
   * any — and it spends on materials and labour months before the invoices are paid. The count is what the
   * app knows. Whether the business can take the work on is the owner's to answer, so it is asked.
   */
  if (v > 5) {
    warn.push({
      key: "volume", level: "warn", lever: "volume",
      text: "The materials and labour for that extra work go out before the invoices come in, and the plan adds no crew or equipment to deliver it. Can the business take it on as it stands?",
    });
  }
  if (c < -10) {
    warn.push({
      key: "cogs", level: "warn", lever: "cogs",
      text: `Taking ${Math.abs(c)}% out of unit cost usually needs a different supplier or a different method, not better buying. What changes?`,
    });
  }
  if (o < -10) {
    warn.push({
      key: "overheads", level: "warn", lever: "overheads",
      text: `Cutting overheads by ${Math.abs(o)}% — ${money(Math.abs(base.overheads - now.overheads))} a year — usually means something stops. Which line?`,
    });
  }
  /**
   * The three days levers, measured against the business's own record (§6.41.3).
   *
   * These fire on where the slider IS, not on whether the client moved it — which matters, because a plan
   * can arrive already assuming terms it has never achieved. Measuring realism against the plan's own
   * assumption instead of against the business is backwards: a plan that assumes 25 days against a history
   * of 46 would sit there silently, and only a drag to 24 would say anything.
   *
   * A tenth is the line. It scales with the business, it is one number rather than a table of them, and it
   * is loose enough that trimming a day or two off a long collection cycle passes without comment.
   */
  const days = (
    key: "debtorDays" | "stockDays" | "creditorDays",
    set: number | null, hist: number, better: "lower" | "higher", say: (h: number, s: number) => string,
  ) => {
    if (set == null || !(hist > 0)) return false;   // the caller resolves "untouched" to the plan's own
    const stretch = better === "lower" ? set <= hist * 0.9 : set >= hist * 1.1;
    if (!stretch) return false;
    warn.push({ key: `${key}-history`, level: "warn", lever: key, text: say(hist, Math.round(set)) });
    return true;
  };

  /**
   * An untouched lever is `null`, meaning "whatever the plan says" — so it is resolved against the plan's
   * own days before being judged. Without that, a plan that ARRIVES assuming terms it has never achieved
   * says nothing until somebody drags the slider, which is the whole failure this replaces.
   */
  const told = history
    ? [
      days("debtorDays", levers.debtorDays ?? n(basis.debtorDays), n(history.debtorDays), "lower", (h, s) =>
        `Your accounts imply ${h} debtor days. This plan collects in ${s} — ${h - s} days faster than the business has managed. What changes to make that happen?`),
      days("stockDays", levers.stockDays ?? n(basis.stockDays), n(history.inventoryDays), "lower", (h, s) =>
        `Your accounts imply ${h} stock days. Holding ${s} is ${h - s} days less than the business has carried. What changes?`),
      days("creditorDays", levers.creditorDays ?? n(basis.creditorDays), n(history.creditorDays), "higher", (h, s) =>
        s > 60
          ? `Paying suppliers at ${s} days strains the relationship before it fixes the cash, and it is ${s - h} days longer than your accounts imply. Agree it with them first.`
          : `Your accounts imply ${h} creditor days. Paying at ${s} holds money ${s - h} days longer than you do now — agreed with your suppliers, or assumed?`),
    ]
    : [false, false, false];

  // No history, or a figure history cannot speak to: fall back to what is true of most businesses.
  if (!told[0] && levers.debtorDays != null && levers.debtorDays < 30 && levers.debtorDays < n(basis.debtorDays)) {
    warn.push({
      key: "debtor-days", level: "warn", lever: "debtorDays",
      text: `Being paid in ${levers.debtorDays} days is quick for most trades. Check the terms will hold before the plan relies on the cash.`,
    });
  }
  if (!told[2] && levers.creditorDays != null && levers.creditorDays > 60 && levers.creditorDays > n(basis.creditorDays)) {
    warn.push({
      key: "creditor-days", level: "warn", lever: "creditorDays",
      text: `Paying suppliers at ${levers.creditorDays} days strains the relationship before it fixes the cash. Agree it with them first.`,
    });
  }
  if (!told[1] && levers.stockDays != null && levers.stockDays === 0 && n(basis.stockDays) > 0) {
    warn.push({
      key: "stock-days", level: "warn", lever: "stockDays",
      text: "Holding no stock at all means buying for every job as it is won, and waiting for it. Only true where suppliers deliver same-day.",
    });
  }

  return [...bad, ...good, ...warn];
}

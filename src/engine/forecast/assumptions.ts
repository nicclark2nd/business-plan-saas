/**
 * The two grids the forecast cannot run without (§6.32.2).
 *
 * `plan_settings` has carried `working_capital_schedule` and `cash_flow_assumptions` since migration 0002,
 * shaped for this engine, and nothing has ever written to them. Left at zero they say: every client pays on
 * the day of the job, every supplier is paid the same day, nothing sits in stock, and the tax bill is settled
 * the instant it is incurred. **That is not a conservative cash flow, it is the most optimistic one that can
 * be drawn** — and it is the one number a lender tests hardest, because a profitable business that runs out
 * of cash in month seven is the ordinary way a good plan fails.
 *
 * So the defaults here are deliberate rather than empty, and the screen states them as assumptions the client
 * owns. A plan with history gets its opening days from what the business actually did; a startup gets
 * something defensible and visible rather than a silent zero.
 */
import { FORECAST_YEARS, type CashTiming, type WorkingCapitalDays } from "./model";

const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const clampDays = (v: unknown) => Math.min(365, Math.max(0, Math.round(n(v))));
const clampPct = (v: unknown) => Math.min(100, Math.max(0, Math.round(n(v) * 10) / 10));
const money = (v: unknown) => Math.max(0, Math.round(n(v) * 100) / 100);

/** 30 days out, 30 days in, nothing in stock: ordinary trade terms, and plainly an assumption. */
export const DEFAULT_DAYS: WorkingCapitalDays = { debtorDays: 30, inventoryDays: 0, creditorDays: 30 };
/** Tax settled in the year it is charged, no prepayments or accruals carried. */
export const DEFAULT_TIMING: CashTiming = { taxPaidPct: 100, prepaidClosing: 0, accruedClosing: 0 };

/**
 * Days implied by what the business actually did last year. A plan with history should not be asked to guess
 * at something its own accounts already answer — and a client who sees 58 debtor days rather than a round 30
 * is being told something true about their business.
 */
export function daysFromHistory(h: {
  revenue?: number | null; cogs?: number | null;
  accounts_receivable?: number | null; inventory_wip?: number | null; accounts_payable?: number | null;
} | null | undefined): WorkingCapitalDays | null {
  if (!h) return null;
  const revenue = n(h.revenue), cogs = n(h.cogs);
  if (revenue <= 0) return null;
  return {
    debtorDays: clampDays((n(h.accounts_receivable) / revenue) * 365),
    inventoryDays: cogs > 0 ? clampDays((n(h.inventory_wip) / cogs) * 365) : 0,
    creditorDays: cogs > 0 ? clampDays((n(h.accounts_payable) / cogs) * 365) : 0,
  };
}

const readYear = (raw: unknown, year: number): Record<string, unknown> | null => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const y = (raw as Record<string, unknown>)[String(year)];
  return y && typeof y === "object" && !Array.isArray(y) ? (y as Record<string, unknown>) : null;
};

/** Stored grid → five clean years. A year the client has never touched falls back, never to zero by accident. */
export function workingCapitalSchedule(
  stored: unknown, fallback: WorkingCapitalDays = DEFAULT_DAYS,
): Record<number, WorkingCapitalDays> {
  return Object.fromEntries(FORECAST_YEARS.map((year) => {
    const y = readYear(stored, year);
    return [year, {
      debtorDays: y && "debtorDays" in y ? clampDays(y.debtorDays) : fallback.debtorDays,
      inventoryDays: y && "inventoryDays" in y ? clampDays(y.inventoryDays) : fallback.inventoryDays,
      creditorDays: y && "creditorDays" in y ? clampDays(y.creditorDays) : fallback.creditorDays,
    }];
  }));
}

export function cashTimingSchedule(stored: unknown): Record<number, CashTiming> {
  return Object.fromEntries(FORECAST_YEARS.map((year) => {
    const y = readYear(stored, year);
    return [year, {
      taxPaidPct: y && "taxPaidPct" in y ? clampPct(y.taxPaidPct) : DEFAULT_TIMING.taxPaidPct,
      prepaidClosing: y ? money(y.prepaidClosing) : 0,
      accruedClosing: y ? money(y.accruedClosing) : 0,
    }];
  }));
}

/** Back to jsonb, every year present, so a half-filled grid can never be read as zeros later. */
export const serializeWorkingCapital = (s: Record<number, WorkingCapitalDays>) =>
  Object.fromEntries(FORECAST_YEARS.map((y) => [String(y), {
    debtorDays: clampDays(s[y]?.debtorDays), inventoryDays: clampDays(s[y]?.inventoryDays), creditorDays: clampDays(s[y]?.creditorDays),
  }]));

export const serializeCashTiming = (s: Record<number, CashTiming>) =>
  Object.fromEntries(FORECAST_YEARS.map((y) => [String(y), {
    taxPaidPct: clampPct(s[y]?.taxPaidPct), prepaidClosing: money(s[y]?.prepaidClosing), accruedClosing: money(s[y]?.accruedClosing),
  }]));

/**
 * What a day is worth, in money, so the screen can say it. "45 debtor days" means nothing to a builder;
 * "45 days — 261,378 sitting in debtors" is the sentence that gets the number changed.
 */
export const debtorBalance = (revenue: number, days: number) => Math.round((n(revenue) * clampDays(days)) / 365);
export const inventoryBalance = (cogs: number, days: number) => Math.round((n(cogs) * clampDays(days)) / 365);
export const creditorBalance = (cogs: number, days: number) => Math.round((n(cogs) * clampDays(days)) / 365);

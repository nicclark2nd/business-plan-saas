/**
 * Recurring products — a unit is a client who keeps paying (coaching, bookkeeping, legal retainers, memberships,
 * maintenance contracts), not a job invoiced once. Revenue comes from ACTIVE clients, so a year's sales are not
 * price × units: ten clients won through the year bill far less than ten clients billing all year.
 *
 * "How long does a client stay" is a steady monthly rate, not a fixed end date — a client keeps paying with
 * probability 1 − 1/L each month, so the average life is L months. Two consequences, both deliberate:
 *   • the opening book needs no "how far through are they?" question — remaining life is the same for everyone,
 *     which is what lets an established firm enter one number for the clients it already has;
 *   • a fixed-term program is smeared — a few leave early, a few run past the term. It never flatters the total.
 *
 * One-off products are untouched: they stay on price × units with a monthly % split (§6.16).
 */
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const r2 = (v: number) => Math.round(v * 100) / 100;

export type RecurringProduct = {
  monthlyPrice: number;          // what one client pays each month
  openingClients: number;        // clients already paying when the plan starts (0 for a new business)
  newByMonth: number[];          // Year 1: clients won in each of the twelve months
  newByYear: number[];           // Years 2–5 (index 1–4): clients won in the year; index 0 is ignored
  averageLifeMonths: number;     // how long a client stays
  lifeMode?: LifeMode;           // "average" (drift, the default) or "fixed" (a defined programme)
};

/**
 * Two honest readings of "a client stays twelve months", and they are 25 % apart in Year 1:
 *   "average" — clients drift away at a steady rate, so some leave in month two. Bookkeeping, memberships,
 *               retainers, any book that churns. The opening book needs no age: remaining life is the same for all.
 *   "fixed"   — a defined programme everyone serves out: a client won in March bills March to February.
 *               The opening book is assumed evenly spread through the term, so a share of it finishes each month.
 */
export type LifeMode = "average" | "fixed";

/** Monthly survival. A one-month life means every client leaves after the month they join. */
export const survival = (lifeMonths: number) => { const L = Math.max(1, num(lifeMonths)); return L <= 1 ? 0 : 1 - 1 / L; };

/** Clients won in each of the 60 plan months — Year 1 as entered, later years spread evenly. */
export function newClientsByMonth(p: RecurringProduct): number[] {
  const out = Array.from({ length: 12 }, (_, i) => num(p.newByMonth?.[i]));
  for (let y = 1; y < 5; y++) { const n = num(p.newByYear?.[y]) / 12; for (let m = 0; m < 12; m++) out.push(n); }
  return out;
}

/** Active clients at the end of each month. The opening book bills from month one. */
export function activeByMonth(openingClients: number, newEachMonth: number[], lifeMonths: number): number[] {
  const r = survival(lifeMonths);
  let active = num(openingClients);
  return newEachMonth.map((n, m) => { active = (m === 0 ? active : active * r) + num(n); return active; });
}

export type RecurringYear = { year: number; newClients: number; activeAtEnd: number; revenue: number; runRateAtEnd: number };

/** Fixed term: a client bills exactly L months from the month won; the opening book runs off in equal steps. */
export function activeByMonthFixed(openingClients: number, newEachMonth: number[], lifeMonths: number): number[] {
  const L = Math.max(1, Math.round(num(lifeMonths)));
  return newEachMonth.map((_, t) => {
    let active = num(openingClients) * Math.max(0, (L - t) / L);
    for (let m = 0; m <= t; m++) if (t < m + L) active += num(newEachMonth[m]);
    return active;
  });
}

export function recurringProjection(p: RecurringProduct) {
  const news = newClientsByMonth(p);
  const active = p.lifeMode === "fixed"
    ? activeByMonthFixed(p.openingClients, news, p.averageLifeMonths)
    : activeByMonth(p.openingClients, news, p.averageLifeMonths);
  const price = num(p.monthlyPrice);
  const months = active.map((a, i) => ({ month: i + 1, active: Math.round(a * 100) / 100, revenue: r2(a * price) }));
  const years: RecurringYear[] = [1, 2, 3, 4, 5].map((year) => {
    const s = (year - 1) * 12;
    const slice = months.slice(s, s + 12);
    const end = active[s + 11] ?? 0;
    return {
      year,
      newClients: r2(news.slice(s, s + 12).reduce((a, b) => a + b, 0)),
      activeAtEnd: Math.round(end * 100) / 100,
      revenue: r2(slice.reduce((a, m) => a + m.revenue, 0)),
      runRateAtEnd: r2(end * price * 12),
    };
  });
  return { months, years };
}

/** What the book is worth a year right now — the number an established firm recognises. */
export const bookValue = (openingClients: number, monthlyPrice: number) => r2(num(openingClients) * num(monthlyPrice) * 12);

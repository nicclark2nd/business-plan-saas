/**
 * Who owns this business (§6.54).
 *
 * Shareholding was being answered twice and the two answers never met. The Leadership Team holds a
 * `pct_shareholding` per person and totals it against 100 — amber until it gets there. Funding holds an
 * `equity_percent` per investor and reports "Investors hold 5 % of the business; you keep 95 %". On a plan
 * with two directors on 35 and 25 and one investor on 5, one screen said 60 % and the other said 95 %, and
 * neither was wrong on its own terms: People was counting the people and Funding was counting the investors.
 *
 * Neither is the cap table. The cap table is both, plus what nobody has been given yet — and it is computed
 * once, here, so the two screens cannot drift apart again.
 *
 * An investor is NOT added to the Leadership Team for holding shares. That list is "owners, directors and
 * the key people a lender asks about", and a passive shareholder is none of those: putting them there would
 * place them in the salary schedule and in front of a lender as management. If an investor does take a seat,
 * the client adds them as a person — and then their share is typed once, wherever they belong.
 */
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const r2 = (v: number) => Math.round(v * 100) / 100;
const share = (v: unknown) => Math.max(0, num(v));

export type HolderKind = "leadership" | "investor";
export type Holder = { name: string; percent: number; kind: HolderKind };

export type CapTable = {
  /** Everyone with a stake, biggest first. A holding of nil is not a holder. */
  holders: Holder[];
  leadership: number;
  investors: number;
  allocated: number;
  /** What nobody has been given. Nil rather than negative when more than all of it is handed out. */
  unallocated: number;
  /** More than 100 % is spoken for — a plan that cannot be true, and worth saying out loud. */
  over: boolean;
  /** Whether the whole business is accounted for, within a rounding hair. */
  complete: boolean;
};

export function capTable(
  people: { name?: string | null; pct_shareholding?: number | null }[],
  investors: { name?: string | null; equity_percent?: number | null }[],
): CapTable {
  const holders: Holder[] = [
    ...people.map((p) => ({ name: String(p.name ?? "").trim() || "Unnamed", percent: share(p.pct_shareholding), kind: "leadership" as const })),
    ...investors.map((i) => ({ name: String(i.name ?? "").trim() || "Investor", percent: share(i.equity_percent), kind: "investor" as const })),
  ].filter((h) => h.percent > 0).sort((a, b) => b.percent - a.percent);

  const leadership = r2(holders.filter((h) => h.kind === "leadership").reduce((a, h) => a + h.percent, 0));
  const investorsPct = r2(holders.filter((h) => h.kind === "investor").reduce((a, h) => a + h.percent, 0));
  const allocated = r2(leadership + investorsPct);
  return {
    holders, leadership, investors: investorsPct, allocated,
    unallocated: r2(Math.max(0, 100 - allocated)),
    over: allocated > 100.005,
    complete: Math.abs(allocated - 100) <= 0.005,
  };
}

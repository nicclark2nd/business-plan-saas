/**
 * THE OPENING TAX AND PROFIT POSITION, READ FROM THE ACCOUNTS ALREADY ENTERED (§6.148).
 *
 * Nic: "if the user has uploaded the historical financial information … surely the Tax losses brought
 * forward field and the Accumulated profit at the start would be collected from existing information,
 * rather than having the client entering data". Both boxes sat on Plan settings as free typing, and SEQ
 * Concreting — a loss of 71,000 in its latest year, no tax paid — had 0 in the first, so the forecast taxed
 * Year 1's profit in full.
 *
 * TAX LOSSES are worked out from the Historic profit and loss: each loss carried forward and used against
 * the next profit, oldest year first — the same ordinary rule the forecast applies from Year 1 (§6.37). A
 * tax return can still differ from the accounts (expenses that are not deductible, losses older than the
 * four years here), so the client may put the accountant's figure in its place; that choice is recorded,
 * never assumed.
 *
 * ACCUMULATED PROFIT is equity less what the owners put in. The Historic balance sheet had only equity, and
 * equity is not all profit: a business its owners funded with 200,000 would otherwise "have" 200,000 to pay
 * out, which no company law allows. So Historic asks for share capital, and until it is given this is not
 * guessed — it stays nil, which limits each year's dividend to that year's own profit (the cautious answer).
 *
 * Pure: the settings screen shows exactly what the forecast uses, because both call this.
 */
export type HistoricPeriodFacts = {
  period_number: number;
  net_profit_before_tax: number | null;
  equity: number | null;
  share_capital: number | null;
};

const r2 = (v: number) => Math.round(v * 100) / 100;
const num = (v: unknown) => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));

export type TaxLosses = {
  amount: number;
  /** What is still unused, and from which period (1 = latest). Empty when nothing is carried. */
  from: { period: number; amount: number }[];
  /** Whether there were any Historic years to read at all. */
  hadHistory: boolean;
};

/** Oldest first (period 4 → 1). A loss joins the pool; a profit uses up the oldest losses first. */
export function taxLossesFromHistory(periods: Pick<HistoricPeriodFacts, "period_number" | "net_profit_before_tax">[]): TaxLosses {
  const years = [...periods].filter((p) => p.period_number >= 1 && p.period_number <= 4).sort((a, b) => b.period_number - a.period_number);
  const pool: { period: number; amount: number }[] = [];
  for (const y of years) {
    const pbt = num(y.net_profit_before_tax) ?? 0;
    if (pbt < 0) { pool.push({ period: y.period_number, amount: -pbt }); continue; }
    let profit = pbt;
    for (const l of pool) {
      if (profit <= 0) break;
      const used = Math.min(l.amount, profit);
      l.amount -= used; profit -= used;
    }
  }
  const left = pool.filter((l) => l.amount > 0.004).map((l) => ({ period: l.period, amount: r2(l.amount) }));
  return { amount: r2(left.reduce((a, l) => a + l.amount, 0)), from: left, hadHistory: years.length > 0 };
}

export type AccumulatedProfit =
  | { status: "no-history"; amount: 0 }
  | { status: "needs-share-capital"; amount: 0; equity: number }
  | { status: "ok"; amount: number; equity: number; shareCapital: number };

/** From the latest Historic year (Period 1): equity less share capital, once share capital is given. */
export function accumulatedProfit(latest: Pick<HistoricPeriodFacts, "equity" | "share_capital"> | null | undefined): AccumulatedProfit {
  if (!latest) return { status: "no-history", amount: 0 };
  const equity = num(latest.equity) ?? 0;
  const share = num(latest.share_capital);
  if (share === null) return { status: "needs-share-capital", amount: 0, equity };
  return { status: "ok", amount: r2(equity - share), equity, shareCapital: share };
}

/** What the forecast opens with: the accountant's figure only when the client chose it. */
export function openingTaxLosses(fromHistory: TaxLosses, accountant: { chosen: boolean; amount: number | null }): number {
  return accountant.chosen ? Math.max(0, accountant.amount ?? 0) : fromHistory.amount;
}

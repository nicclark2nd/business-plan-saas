/**
 * What it costs to win one customer (§6.61).
 *
 * The one marketing KPI that is arithmetic rather than a wish. "Website traffic: 5,000 a month" typed into
 * a box is a hope with a number attached; this is the plan's own marketing spend divided by the plan's own
 * count of customers won, so it moves when the What-If sliders move and it cannot disagree with the
 * forecast. It is also the figure a lender asks for and almost no small-business plan can answer.
 *
 * TWO traps, and both would produce a confident wrong number.
 *
 * A LINKED LINE'S CLIENTS ARE ALREADY COUNTED. An ongoing line whose clients come from another line (§6.24)
 * wins nobody new: its clients ARE that line's jobs, arriving a second time under a maintenance plan. Adding
 * both halves the cost per customer on exactly the plans that have thought hardest about retention, which
 * is the opposite of what the figure is for. Linked lines are excluded from the count and nowhere else.
 *
 * AND A JOB IS NOT A CLIENT-MONTH. §6.49.1 refused a blended unit for break-even for the same reason a
 * blended unit is wrong here — but the thing being counted is different. A one-off line wins JOBS and an
 * ongoing line wins CLIENTS, and both are one customer deciding to buy, once. That is a sale won, so they
 * add. What must never be added is revenue-per-unit across the two, and this function does not.
 */
import { YEARS } from "../sales/projection";
import { isLinked, unitsByYear, type AnyProduct } from "../sales/product";

const r2 = (v: number) => Math.round(v * 100) / 100;

export type Acquisition = {
  year: number;
  /** What the plan spends on marketing that year. */
  spend: number;
  /** New jobs plus new ongoing clients — every customer who decided to buy for the first time. */
  won: number;
  /** Null when nobody is won that year: dividing by nothing says nothing, and "∞" is not a cost. */
  costPerWin: number | null;
};

/** New jobs and new clients in each plan year, with linked lines left out because they win nobody new. */
export function customersWonByYear(products: AnyProduct[]): number[] {
  const out = YEARS.map(() => 0);
  for (const p of products) {
    if (isLinked(p)) continue;
    const units = unitsByYear(p);
    for (let i = 0; i < out.length; i++) out[i] += Number(units[i]) || 0;
  }
  return out.map(r2);
}

export function acquisitionByYear(products: AnyProduct[], spendByYear: number[]): Acquisition[] {
  const won = customersWonByYear(products);
  return YEARS.map((year, i) => {
    const spend = r2(Number(spendByYear[i]) || 0);
    const w = won[i];
    return { year, spend, won: w, costPerWin: w > 0 ? r2(spend / w) : null };
  });
}

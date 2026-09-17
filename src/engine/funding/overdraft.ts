/**
 * An overdraft behaves like an overdraft (§6.72).
 *
 * `line_of_credit` existed in exactly two places in the whole codebase: the `LoanType` union and its
 * dropdown label. Nowhere in the engine. So choosing "Overdraft / line of credit" gave you a TERM LOAN
 * wearing another name — the full amount drawn on day one whether the business needed it or not, repaid on
 * a schedule the client invented, interest charged on a figure fixed at the start.
 *
 * A facility is the opposite of all three. It is a LIMIT, not a lump sum. It is drawn only when the month
 * would otherwise close short, repaid the moment there is cash to repay it with, and charged on what is
 * actually owed.
 *
 * ---------------------------------------------------------------------------------------------------
 * INTEREST IS CHARGED ON THE BALANCE OWED AT THE START OF THE MONTH.
 *
 * That is a deliberate choice, made with Nic, and it is what keeps this function honest. Charging on the
 * average of the opening and closing balance is closer to how a bank actually works — but this month's
 * interest would then depend on this month's closing balance, which depends on this month's draw, which
 * depends on this month's interest. A circular reference needing an iterative solve, for a difference that
 * is small across a five-year plan and a test that can no longer be checked by hand.
 *
 * Opening-balance interest runs strictly forwards: month by month, each one finished before the next
 * begins, and every figure in a test worked out on paper.
 * ---------------------------------------------------------------------------------------------------
 *
 * ZERO BUFFER. The facility covers the shortfall and not a dollar more, and every spare dollar pays it
 * down. It is the most conservative reading of what the facility costs, and the easiest for a lender to
 * check against the cash flow. It also gives the model a property worth relying on: **a drawn balance and
 * spare cash never exist in the same month.** If anything is owed, the account is at nil.
 */

export const HORIZON = 60;

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const r2 = (v: number) => Math.round(v * 100) / 100;

export type Facility = {
  id: string;
  name: string;
  /** What the bank will let the business owe at once. A facility with no limit is not a facility. */
  limit: number;
  /** Annual rate, per cent. */
  interestRate: number;
  /**
   * A line fee, charged whether or not the facility is used — which is the point of it, and the reason an
   * unused facility is not free. Spread evenly across the months it is available.
   */
  annualFee?: number;
  /** 1-based month of the plan, 1..60, from which the facility exists at all. */
  availableFrom?: number;
};

export type SweepMonth = {
  month: number;
  /** Owed at the start of the month — what this month's interest is charged on. */
  openingDrawn: number;
  interest: number;
  fee: number;
  /** Closing cash as the plan had it before the facility did anything. */
  cashBefore: number;
  drawn: number;
  repaid: number;
  closingDrawn: number;
  closingCash: number;
  /**
   * What the month still could not cover once the facility was exhausted. Non-zero here is the answer to
   * "is this facility big enough", and it is a number rather than a flag so the screen can say by how much.
   */
  shortfall: number;
};

export type OverdraftRun = {
  months: SweepMonth[];
  /** Per plan year, 1-indexed: what the annual model has to be told. */
  byYear: Record<number, { interest: number; drawn: number; repaid: number; closingDrawn: number; peakDrawn: number }>;
  /** The deepest the business ever goes, and when. The figure a lender asks for. */
  peak: { month: number; drawn: number };
  totalInterest: number;
  totalFees: number;
  /** Months the facility ran out. Empty is the answer the client wants. */
  short: number[];
  /** True when there is no facility at all, so the caller can leave the plan exactly as it was. */
  idle: boolean;
};

/**
 * Sweep a plan's cash through its facilities.
 *
 * `netMovement` is the sixty months of cash movement BEFORE the facility acts — everything the plan already
 * does, with no overdraft in it. This function never re-reads the plan; it moves one number.
 */
export function sweepOverdraft(input: {
  openingCash: number;
  netMovement: number[];
  facilities: Facility[];
}): OverdraftRun {
  const facilities = input.facilities.filter((f) => num(f.limit) > 0);
  const months: SweepMonth[] = [];
  const byYear: OverdraftRun["byYear"] = {};
  for (let y = 1; y <= 5; y++) byYear[y] = { interest: 0, drawn: 0, repaid: 0, closingDrawn: 0, peakDrawn: 0 };

  const owed = facilities.map(() => 0);
  let cash = num(input.openingCash);
  let totalInterest = 0, totalFees = 0;
  const short: number[] = [];
  let peak = { month: 0, drawn: 0 };

  for (let i = 0; i < HORIZON; i++) {
    const month = i + 1;
    const year = Math.floor(i / 12) + 1;
    const live = facilities.map((f) => month >= Math.max(1, Math.trunc(num(f.availableFrom)) || 1));

    const openingDrawn = r2(owed.reduce((a, b) => a + b, 0));

    // Interest on what was owed at the START of the month, and the line fee for having the facility at all.
    let interest = 0, fee = 0;
    facilities.forEach((f, k) => {
      if (!live[k]) return;
      interest += owed[k] * (num(f.interestRate) / 100 / 12);
      fee += num(f.annualFee) / 12;
    });
    interest = r2(interest); fee = r2(fee);

    // The plan's own movement, then the cost of the facility. Both are paid from the same account.
    cash = r2(cash + num(input.netMovement[i]) - interest - fee);
    const cashBefore = r2(num(input.netMovement[i]) + (i === 0 ? num(input.openingCash) : months[i - 1].closingCash));

    let drew = 0, repaid = 0;
    if (cash < 0) {
      // Draw only what the month is short, and only up to what each facility has left.
      let need = -cash;
      facilities.forEach((f, k) => {
        if (!live[k] || need <= 0) return;
        const room = Math.max(0, num(f.limit) - owed[k]);
        const take = Math.min(room, need);
        owed[k] = r2(owed[k] + take); need = r2(need - take); drew = r2(drew + take);
      });
      cash = r2(cash + drew);
    } else if (openingDrawn > 0) {
      // Every spare dollar pays it down, oldest facility first.
      let spare = cash;
      facilities.forEach((f, k) => {
        if (spare <= 0 || owed[k] <= 0) return;
        const pay = Math.min(owed[k], spare);
        owed[k] = r2(owed[k] - pay); spare = r2(spare - pay); repaid = r2(repaid + pay);
      });
      cash = r2(cash - repaid);
    }

    const shortfall = cash < 0 ? r2(-cash) : 0;
    if (shortfall > 0) short.push(month);
    const closingDrawn = r2(owed.reduce((a, b) => a + b, 0));
    if (closingDrawn > peak.drawn) peak = { month, drawn: closingDrawn };

    months.push({
      month, openingDrawn, interest, fee, cashBefore,
      drawn: drew, repaid, closingDrawn, closingCash: cash, shortfall,
    });

    const yr = byYear[year];
    yr.interest = r2(yr.interest + interest + fee);
    yr.drawn = r2(yr.drawn + drew);
    yr.repaid = r2(yr.repaid + repaid);
    yr.closingDrawn = closingDrawn;
    yr.peakDrawn = Math.max(yr.peakDrawn, closingDrawn);
    totalInterest = r2(totalInterest + interest);
    totalFees = r2(totalFees + fee);
  }

  return { months, byYear, peak, totalInterest, totalFees, short, idle: facilities.length === 0 };
}

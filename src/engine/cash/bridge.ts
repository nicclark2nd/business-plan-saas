/**
 * Why the profit and the cash are different numbers (§6.78).
 *
 * The engine has computed this bridge for every year since the forecast was built, an invariant has been
 * checking it the whole time, and no screen has ever shown a line of it. A client looking at a loss of
 * 136,681 and a bank balance that went UP has been given both figures and never the sentence joining them.
 *
 * Nothing here is new arithmetic. It is the `BridgeYear` the forecast already produced, put in the order a
 * person reads it in and labelled in words rather than field names.
 */
import type { BridgeYear } from "../forecast/model";

const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const r2 = (v: number) => Math.round(v * 100) / 100;

export type BridgeLine = {
  key: string;
  label: string;
  /** What this line does to the cash. Signed: negative is cash the profit claimed but the bank never saw. */
  value: number;
  /** Why it is here at all — shown under the label, because "movement in receivables" explains nothing. */
  why: string;
  kind: "start" | "noncash" | "working" | "timing" | "end";
};

/**
 * The bridge, in reading order: start at the profit, undo what was never cash, then the movements, and
 * land on the operating cash flow the statement prints.
 *
 * Lines worth nothing are dropped rather than shown as a dash. A dash on a statement is a real answer —
 * "this happened and it came to zero" — but a bridge is an explanation, and an explanation made of eleven
 * lines of nothing explains less than one made of four.
 */
export function bridgeLines(b: BridgeYear): BridgeLine[] {
  const all: BridgeLine[] = [
    { key: "netProfit", label: "Net profit after tax", value: r2(n(b.netProfit)), kind: "start",
      why: "Where the profit and loss ends" },
    { key: "depreciation", label: "Depreciation added back", value: r2(n(b.depreciation)), kind: "noncash",
      why: "A cost against the profit that no money ever left for" },
    /* Already stored reversed by the engine — negating it here would put the gain back in twice. */
    { key: "disposalGainLoss", label: "Gain on asset sales removed", value: r2(n(b.disposalGainLoss)), kind: "noncash",
      why: "The proceeds are investing cash, so the gain cannot count here too" },
    { key: "interestReclassified", label: "Interest moved to financing", value: r2(n(b.interestReclassified)), kind: "noncash",
      why: "Interest is the cost of the borrowing, not of the trading" },
    { key: "receivablesMovement", label: "Money owed to you", value: r2(n(b.receivablesMovement)), kind: "working",
      why: "Sales counted as profit that the client has not paid for yet" },
    { key: "inventoryMovement", label: "Stock and work in progress", value: r2(n(b.inventoryMovement)), kind: "working",
      why: "Cash spent on stock that has not been sold yet" },
    { key: "payablesMovement", label: "Money you owe suppliers", value: r2(n(b.payablesMovement)), kind: "working",
      why: "Costs counted against the profit that you have not paid out yet" },
    { key: "prepaidMovement", label: "Paid in advance", value: r2(n(b.prepaidMovement)), kind: "timing",
      why: "Cash gone for something the profit has not been charged for yet" },
    { key: "accruedMovement", label: "Incurred, not yet billed", value: r2(n(b.accruedMovement)), kind: "timing",
      why: "Charged against the profit, not yet out of the bank" },
    { key: "taxTimingMovement", label: "Tax not yet paid over", value: r2(n(b.taxTimingMovement)), kind: "timing",
      why: "The charge is in the profit; the payment falls in its own month" },
    { key: "deferredIncomeMovement", label: "Grant money not yet earned", value: r2(n(b.deferredIncomeMovement)), kind: "timing",
      why: "In the bank, not yet in the profit" },
    { key: "gstMovement", label: "Tax collected, not yet paid over", value: r2(n(b.gstMovement)), kind: "timing",
      why: "Cash the business is holding and does not own" },
    { key: "gstOnCapexCredit", label: "Tax reclaimed on assets bought", value: r2(n(b.gstOnCapexCredit)), kind: "timing",
      why: "The asset is investing cash; the credit on it comes back through trading" },
  ];
  /* The opening line always shows, even at nil: a bridge that starts nowhere is not a bridge. */
  return all.filter((l) => l.kind === "start" || l.value !== 0);
}

/**
 * What the bridge has to land on. The lines are an explanation and the operating cash flow is the fact —
 * if they ever disagreed, the explanation is the thing that is wrong.
 */
export const bridgeTotal = (b: BridgeYear) => r2(bridgeLines(b).reduce((a, l) => a + l.value, 0));

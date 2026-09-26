import type { ReportInput } from "./build";
import { cell, num, type Block, type Draft } from "./blocks";
import { COPY } from "./content";
import { bridgeFrom } from "../capability/extras";
import { TRANSFER_FACTORS } from "../capability/judgements";
import type { MultipleSource } from "../ai/multiples";

/**
 * SALE READINESS AND BORROWING (§6.130.2, open item 37).
 *
 * The figures §6.129 moved off the dashboard and onto the steps that own them were stored so that a report
 * could print them and they would mean the same thing next week. This is the report printing them.
 *
 * FOUR PARTS, EACH ONLY WHEN IT HAS SOMETHING TO SAY. A plan that is not for sale and not borrowing prints
 * none of it — and is not told it is missing anything, because "no asking price" is not a gap in a plan
 * that has nothing to sell. A price with no add-backs prints the price; ratings with no price print the
 * ratings. Nothing is printed as a blank to be filled in (§6.57).
 *
 * THE ARITHMETIC IS THE DASHBOARD'S. Normalised earnings come through `bridgeFrom`, the function Capability
 * to sell reads, so the printed bridge and the dial cannot disagree about the same add-backs (§6.41).
 */
export type SaleFacts = {
  askingPrice: number | null;
  multipleLow: number | null;
  multipleHigh: number | null;
  exitYear: number | null;
  sources: MultipleSource[] | null;
  /** Long-form day the searched range was accepted, already formatted. */
  foundOn: string | null;
  addBacks: { label: string; amount: number }[];
};
export type LenderFacts = {
  repaymentsOnTime: boolean | null;
  covenants: string | null;
  guaranteeOffered: boolean | null;
  guaranteeBy: string | null;
};

const has = (s: string | null | undefined): s is string => !!s && s.trim().length > 0;
const x = (n: number) => `${Number(n.toFixed(2))}×`;

export function saleAndBorrowing(i: ReportInput): Draft {
  const { sale, lender, money } = i;
  const bridge = bridgeFrom(i.forecast.pnl[1], sale.addBacks);
  const normalised = bridge?.normalised ?? null;
  const ranged = sale.multipleLow !== null && sale.multipleHigh !== null;
  const price = sale.askingPrice !== null && sale.askingPrice > 0 ? sale.askingPrice : null;
  const earns = normalised !== null && normalised > 0;

  /* ---- Price and value ---- */
  const value: Draft = (() => {
    if (price === null && !ranged) return null;
    const rows: [string, string][] = [];
    if (price !== null) rows.push(["Asking price", money(price)]);
    if (sale.exitYear !== null && i.yearEndLabels[sale.exitYear - 1]) {
      rows.push(["Sale aimed at", `Year ${sale.exitYear}, ending ${i.yearEndLabels[sale.exitYear - 1]}`]);
    }
    if (normalised !== null) rows.push(["Normalised EBITDA, Year 1", normalised < 0 ? `(${money(-normalised)})` : money(normalised)]);
    if (ranged) {
      rows.push(["Similar businesses have sold for", sale.multipleLow === sale.multipleHigh
        ? `${x(sale.multipleLow!)} EBITDA` : `${x(sale.multipleLow!)} to ${x(sale.multipleHigh!)} EBITDA`]);
      if (earns) rows.push(["Value at that range", `${money(normalised! * sale.multipleLow!)} to ${money(normalised! * sale.multipleHigh!)}`]);
    }
    if (price !== null && earns) rows.push(["Asking price as a multiple", `${x(price / normalised!)} EBITDA`]);

    const blocks: Block[] = [{ kind: "facts", rows }];
    if (!earns && normalised !== null) blocks.push({ kind: "note", text: COPY.saleNoEarnings });
    if (price !== null && earns && ranged) {
      const m = price / normalised!;
      blocks.push({ kind: "para", text:
        m > sale.multipleHigh! ? `The asking price is ${money(price - normalised! * sale.multipleHigh!)} above the top of the range. A buyer paying it would be paying for earnings the plan does not yet show.`
        : m < sale.multipleLow! ? "The asking price sits below the range similar businesses have sold for."
        : "The asking price sits inside the range similar businesses have sold for." });
    }
    if (ranged && sale.sources?.length) {
      blocks.push(
        { kind: "lead", text: "Where the range comes from" },
        { kind: "table",
          columns: [{ label: "Source", width: 230 }, { label: "Address" }, { label: "Range", numeric: true, width: 90 }],
          rows: sale.sources.map((s) => [cell(s.title), cell(s.url, { muted: true }), num(s.low === s.high ? x(s.low) : `${x(s.low)}–${x(s.high)}`)]) },
        { kind: "note", text: COPY.saleRangeSourced(sale.foundOn ?? "recently") },
      );
    } else if (ranged) {
      blocks.push({ kind: "note", text: COPY.saleRangeOwn });
    }
    return { title: "Price and value", blocks };
  })();

  /* ---- From reported to normalised earnings ---- */
  const bridgeDraft: Draft = bridge && bridge.adds.length ? {
    title: "From reported to normalised earnings",
    blocks: [
      { kind: "para", text: COPY.bridge(i.businessName) },
      { kind: "table", columns: [{ label: "" }, { label: "Year 1", numeric: true, width: 130 }],
        rows: [
          [cell("EBITDA as forecast"), num(bridge.reported < 0 ? `(${money(-bridge.reported)})` : money(bridge.reported))],
          ...bridge.adds.map((a) => [cell(`Add back: ${a.label}`), num(money(a.amount))]),
          [cell("Normalised EBITDA", { bold: true }), num(bridge.normalised < 0 ? `(${money(-bridge.normalised)})` : money(bridge.normalised), { bold: true })],
        ] },
    ],
  } : null;

  /* ---- Would it survive a change of owner ---- */
  const scored = TRANSFER_FACTORS
    .map((f) => ({ f, r: i.transfer.find((t) => t.factor === f.key && t.score > 0) }))
    .filter((v) => v.r);
  const transferDraft: Draft = scored.length ? {
    title: "Would it survive a change of owner",
    blocks: [
      { kind: "para", text: COPY.transfer(i.businessName) },
      { kind: "table", columns: [{ label: "What a buyer tests", width: 250 }, { label: "Score", numeric: true, width: 70 }, { label: "Why" }],
        rows: scored.map(({ f, r }) => [cell(f.label), num(`${r!.score} / 5`), has(r!.note) ? cell(r!.note!.trim()) : cell("—", { muted: true })]) },
      scored.length === TRANSFER_FACTORS.length
        ? { kind: "para", text: `Taken together, ${(Math.round(scored.reduce((t, v) => t + v.r!.score, 0) / scored.length * 10) / 10).toFixed(1)} out of 5.` }
        : { kind: "note", text: COPY.transferPartial(scored.length) },
    ],
  } : null;

  /* ---- History with lenders ---- */
  const lrows: [string, string][] = [];
  if (lender.repaymentsOnTime !== null) lrows.push(["Repayments made on time", lender.repaymentsOnTime ? "Yes, every one, for the last three years" : "No — some were late or missed"]);
  if (has(lender.covenants)) lrows.push(["Loan conditions (covenants)", lender.covenants.trim()]);
  if (lender.guaranteeOffered !== null) {
    lrows.push(["Personal guarantee", lender.guaranteeOffered ? (has(lender.guaranteeBy) ? `Offered, by ${lender.guaranteeBy.trim()}` : "Offered") : "Not offered"]);
  }
  const lenderDraft: Draft = lrows.length ? {
    title: "History with lenders",
    blocks: [{ kind: "para", text: COPY.lenderHistory }, { kind: "facts", rows: lrows }],
  } : null;

  /*
   * THE HEADING NAMES ONLY WHAT IS UNDER IT (§6.87). A plan with a lender record and nothing about a sale
   * would otherwise print "Sale Readiness" over a page with no sale on it.
   */
  const selling = value !== null || bridgeDraft !== null || transferDraft !== null;
  if (!selling && !lenderDraft) return null;
  const title = selling && lenderDraft ? "Sale Readiness and Borrowing" : selling ? "Sale Readiness" : "Borrowing Record";
  return {
    title,
    blocks: selling ? [{ kind: "para", text: COPY.saleIntro(i.businessName) }] : [],
    children: [value, bridgeDraft, transferDraft, lenderDraft],
  };
}

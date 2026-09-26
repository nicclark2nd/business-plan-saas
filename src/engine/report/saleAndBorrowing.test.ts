import { describe, it, expect } from "vitest";
import type { ReportInput } from "./build";
import { saleAndBorrowing, type SaleFacts, type LenderFacts } from "./saleAndBorrowing";
import type { TransferRating } from "../capability/judgements";

const money = (v: number) => new Intl.NumberFormat("en-AU", { maximumFractionDigits: 0 }).format(Math.round(v) || 0);
/* Year 1 EBITDA = operating profit + depreciation = 180,000 + 20,000 = 200,000. */
const pnl = { 1: { operatingProfit: 180_000, depreciation: 20_000 }, 2: { operatingProfit: 230_000, depreciation: 20_000 } };
const empty: { sale: SaleFacts; transfer: TransferRating[]; lender: LenderFacts } = {
  sale: { askingPrice: null, multipleLow: null, multipleHigh: null, exitYear: null, sources: null, foundOn: null, addBacks: [] },
  transfer: [],
  lender: { repaymentsOnTime: null, covenants: null, guaranteeOffered: null, guaranteeBy: null },
};
const input = (over: Partial<typeof empty> = {}) => ({
  businessName: "SEQ Concreting", money, forecast: { pnl }, yearEndLabels: ["30 Jun 2027", "30 Jun 2028", "30 Jun 2029", "30 Jun 2030", "30 Jun 2031"],
  ...empty, ...over,
} as unknown as ReportInput);

const text = (d: ReturnType<typeof saleAndBorrowing>) => JSON.stringify(d);

describe("sale readiness and borrowing", () => {
  it("prints nothing, and claims nothing missing, for a plan not being sold or borrowing against", () => {
    expect(saleAndBorrowing(input())).toBeNull();
  });

  it("reads the price against the range through the dashboard's own bridge", () => {
    const d = saleAndBorrowing(input({ sale: { ...empty.sale, askingPrice: 1_000_000, multipleLow: 3, multipleHigh: 4, exitYear: 2,
      addBacks: [{ label: "Owner's salary above market", amount: 50_000 }] } }))!;
    expect(d.title).toBe("Sale Readiness");
    const t = text(d);
    /* Aimed at Year 2, so struck on Year 2 (§6.135): EBITDA 250,000 + 50,000 add-back = 300,000. */
    expect(t).toContain("Normalised EBITDA, Year 2");
    expect(t).toContain("300,000");
    expect(t).toContain("900,000 to 1,200,000");         // 300,000 × 3 to × 4
    expect(t).toContain("Year 2, ending 30 Jun 2028");
    expect(t).toContain("inside the range");
    expect(t).toContain("Add back: Owner's salary above market");
  });

  it("names the sources of a searched range, and says a typed one is the owner's", () => {
    const sources = [{ title: "Broker A", url: "https://a.com", low: 2, high: 3.5 }, { title: "Valuer B", url: "https://b.com", low: 2, high: 3.5 }];
    const searched = text(saleAndBorrowing(input({ sale: { ...empty.sale, multipleLow: 2, multipleHigh: 3.5, sources, foundOn: "26 September 2026" } })));
    expect(searched).toContain("https://a.com");
    expect(searched).toContain("found 26 September 2026");
    const typed = text(saleAndBorrowing(input({ sale: { ...empty.sale, multipleLow: 2, multipleHigh: 3.5 } })));
    expect(typed).toContain("owner's own figure");
  });

  it("will not value a business that is not earning", () => {
    const d = saleAndBorrowing({ ...input({ sale: { ...empty.sale, askingPrice: 500_000, multipleLow: 2, multipleHigh: 3 } }),
      forecast: { pnl: { 1: { operatingProfit: -50_000, depreciation: 10_000 } } } } as unknown as ReportInput);
    const t = text(d);
    expect(t).toContain("(40,000)");
    expect(t).not.toContain("Value at that range");
    expect(t).toContain("not positive");
  });

  it("gives an overall score only when all six are judged", () => {
    const two = text(saleAndBorrowing(input({ transfer: [
      { factor: "owner", score: 2, note: "Owner quotes every job" }, { factor: "systems", score: 4, note: null },
    ] })));
    expect(two).toContain("2 / 5");
    expect(two).toContain("Two of the six have been assessed");
    expect(text(saleAndBorrowing(input({ transfer: [{ factor: "owner", score: 2, note: null }] })))).toContain("One of the six has been assessed");
    expect(two).not.toContain("out of 5");
    const all = text(saleAndBorrowing(input({ transfer: (["owner", "customers", "processes", "staff", "contracts", "systems"] as const)
      .map((factor) => ({ factor, score: 3, note: null })) })));
    expect(all).toContain("Taken together, 3.0 out of 5");
  });

  it("titles itself by what is under it", () => {
    const lenderOnly = saleAndBorrowing(input({ lender: { repaymentsOnTime: true, covenants: "None.", guaranteeOffered: true, guaranteeBy: "Both directors" } }))!;
    expect(lenderOnly.title).toBe("Borrowing Record");
    expect(text(lenderOnly)).toContain("Offered, by Both directors");
    const both = saleAndBorrowing(input({ sale: { ...empty.sale, askingPrice: 900_000 }, lender: { ...empty.lender, repaymentsOnTime: false } }))!;
    expect(both.title).toBe("Sale Readiness and Borrowing");
  });

  it("strikes the price on Year 1 until a sale year is chosen (§6.135)", () => {
    const t = text(saleAndBorrowing(input({ sale: { ...empty.sale, askingPrice: 800_000, multipleLow: 3, multipleHigh: 4 } })));
    expect(t).toContain("Normalised EBITDA, Year 1");
    expect(t).toContain("600,000 to 800,000");           // 200,000 × 3 to × 4
    expect(t).not.toContain("the year the sale is aimed at");
  });
});

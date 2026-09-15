import { describe, expect, it } from "vitest";
import { cleanComponent, gstPeriods, gstSchedule, gstSettings, inclusive, salesTaxCountry, serializeComponents, suggestedRate, taxComponents, taxHeading, taxLabel, taxOn, type GstSettings } from "./gst";
import { regimeFor } from "./taxRegimes";

const AU: GstSettings = { registered: true, label: "GST", rate: 10, frequency: "quarterly", lagMonths: 1, reclaimable: true };
const flat = (v: number) => Array(12).fill(v) as number[];
const sum = (a: number[]) => Math.round(a.reduce((x, y) => x + y, 0) * 100) / 100;

describe("registration is the switch", () => {
  it("charges nothing at all when the business is not registered", () => {
    const off = gstSettings({ gst_registered: false, gst_rate: 10, gst_frequency: "quarterly" });
    expect(taxOn(1000, off)).toBe(0);
    expect(inclusive(1000, off)).toBe(1000);
    const s = gstSchedule(flat(50000), flat(30000), off);
    expect(s.collected).toBe(0);
    expect(s.remitted).toBe(0);
    expect(s.closingPayable).toBe(0);
    expect(s.months.every((m) => m.payable === 0)).toBe(true);
  });

  it("falls back rather than throwing on a frequency it does not know", () => {
    expect(gstSettings({ gst_registered: true, gst_rate: 10, gst_frequency: "fortnightly" }).frequency).toBe("quarterly");
  });

  it("does not charge a line that is not taxable", () => {
    expect(taxOn(120000, AU, false)).toBe(0);      // wages
    expect(taxOn(120000, AU, true)).toBe(12000);
  });
});

describe("when the return falls due", () => {
  it("files a quarter after the quarter has closed, so four returns land in months 4, 7, 10 and 1", () => {
    const q = gstPeriods("quarterly");
    expect(q).toHaveLength(4);
    expect(q[0]).toEqual({ months: [0, 1, 2], paidInMonth: 3 });
    expect(q[3]).toEqual({ months: [9, 10, 11], paidInMonth: 12 });   // beyond the year — still owed
  });

  it("files monthly a month in arrears", () => {
    const m = gstPeriods("monthly");
    expect(m).toHaveLength(12);
    expect(m[0]).toEqual({ months: [0], paidInMonth: 1 });
    expect(m[11].paidInMonth).toBe(12);
  });

  it("files an annual return after the year ends", () => {
    expect(gstPeriods("annually")).toEqual([{ months: [0,1,2,3,4,5,6,7,8,9,10,11], paidInMonth: 12 }]);
  });
});

describe("the money", () => {
  const s = gstSchedule(flat(100000), flat(40000), AU);

  it("collects on sales and claims on purchases", () => {
    expect(s.collected).toBe(120000);              // 10% of 1.2m
    expect(s.credits).toBe(48000);
    expect(s.net).toBe(72000);
  });

  it("pays only three of the four quarters inside the year", () => {
    expect(s.remitted).toBe(54000);                // three quarters at 18,000
    expect(s.months[3].remitted).toBe(18000);
    expect(s.months[6].remitted).toBe(18000);
    expect(s.months[9].remitted).toBe(18000);
    expect(s.months[11].remitted).toBe(0);
  });

  it("leaves the last quarter owing at year end — a liability, never cash", () => {
    expect(s.closingPayable).toBe(18000);
    expect(s.net - s.remitted).toBe(s.closingPayable);
  });

  it("never lets the payable drift: collected less credits less remitted, every month", () => {
    let running = 0;
    for (const m of s.months) {
      running = Math.round((running + m.net - m.remitted) * 100) / 100;
      expect(m.payable, `month ${m.month}`).toBeCloseTo(running, 2);
    }
  });

  it("pays last year's closing return in the first month of this one", () => {
    const withCarry = gstSchedule(flat(100000), flat(40000), AU, 18000);
    expect(withCarry.months[0].remitted).toBe(18000);
    expect(withCarry.closingPayable).toBe(18000);          // this year's last quarter, same as before
    expect(withCarry.remitted).toBe(72000);                // and a fourth payment actually left the bank
  });

  it("a monthly filer carries only one month at year end", () => {
    const m = gstSchedule(flat(100000), flat(40000), { ...AU, frequency: "monthly" });
    expect(m.closingPayable).toBe(6000);
    expect(m.remitted).toBe(66000);
  });

  it("an annual filer carries the whole year", () => {
    const a = gstSchedule(flat(100000), flat(40000), { ...AU, frequency: "annually" });
    expect(a.remitted).toBe(0);
    expect(a.closingPayable).toBe(72000);
  });

  it("pays a refund quarter back to the business, because that is what actually happens", () => {
    // Purchases exceed sales all year: the tax office owes money, and it arrives at each return.
    const refund = gstSchedule(flat(10000), flat(50000), AU);
    expect(refund.net).toBe(-48000);
    expect(refund.months[3].remitted).toBe(-12000);        // a quarter's credits, refunded
    expect(refund.remitted).toBe(-36000);                  // three of the four quarters land inside the year
    expect(refund.closingPayable).toBe(-12000);            // and the last is still due back
  });

  it("is seasonal when the sales are", () => {
    const seasonal = [0, 0, 0, 0, 0, 0, 0, 0, 0, 400000, 400000, 400000];
    const s2 = gstSchedule(seasonal, flat(0), AU);
    expect(s2.months[3].remitted).toBe(0);
    expect(s2.months[9].collected).toBe(40000);
    expect(s2.closingPayable).toBe(120000);        // the whole busy quarter, still owed
    expect(sum(s2.months.map((m) => m.collected))).toBe(s2.collected);
  });
});

describe("what it is called where the business trades", () => {
  it("names the tax the way the client does", () => {
    expect(taxLabel("Australia")).toBe("GST");
    expect(taxLabel("New Zealand")).toBe("GST");
    expect(taxLabel("United Kingdom")).toBe("VAT");
    expect(taxLabel("Ireland")).toBe("VAT");
    expect(taxLabel("United States")).toBe("Sales tax");
    expect(taxLabel(null)).toBe("GST");
  });

  it("offers the ordinary rate as a starting point", () => {
    expect(suggestedRate("Australia")).toBe(10);
    expect(suggestedRate("New Zealand")).toBe(15);
    expect(suggestedRate("United Kingdom")).toBe(20);
    expect(suggestedRate("Finland")).toBe(25.5);      // moved from 24 in 2024; it was wrong here
    expect(suggestedRate("Nowhere")).toBe(10);
  });

  it("knows which countries charge a single-stage sales tax rather than a value-added one", () => {
    expect(salesTaxCountry("United States")).toBe(true);
    expect(salesTaxCountry("Malaysia")).toBe(true);    // replaced GST with SST in 2018
    expect(salesTaxCountry("Australia")).toBe(false);
    expect(salesTaxCountry("United Kingdom")).toBe(false);
    expect(salesTaxCountry(null)).toBe(false);
  });

  it("calls the tax what it is called there", () => {
    expect(taxLabel("Malaysia")).toBe("SST");
  });
});

describe("resolving a plan's taxes from what is stored (§6.39)", () => {
  it("returns nothing at all when the switch is off, whatever else is stored", () => {
    expect(taxComponents({ gst_registered: false, country: "Canada", tax_region: "Ontario" })).toEqual([]);
    expect(taxComponents({ gst_registered: false, tax_components: [{ label: "VAT", rate: 20 }] })).toEqual([]);
    expect(taxComponents(null)).toEqual([]);
  });

  it("uses what the client chose, ahead of any default", () => {
    const cs = taxComponents({
      gst_registered: true, country: "Canada", tax_region: "Ontario",
      tax_components: [{ label: "HST", rate: 11, reclaimable: true, frequency: "monthly", lagMonths: 1 }],
    });
    expect(cs).toHaveLength(1);
    expect(cs[0].rate).toBe(11);                 // not Ontario's 13
    expect(cs[0].frequency).toBe("monthly");
  });

  it("falls back to the country and region when nothing is chosen", () => {
    const bc = taxComponents({ gst_registered: true, country: "Canada", tax_region: "British Columbia" });
    expect(bc.map((c) => c.label)).toEqual(["GST", "PST"]);
    expect(bc[0].reclaimable).toBe(true);
    expect(bc[1].reclaimable).toBe(false);

    const uk = taxComponents({ gst_registered: true, country: "United Kingdom" });
    expect(uk[0].rate).toBe(20);
    expect(uk[0].lagMonths).toBe(2);
  });

  it("keeps a rate the client typed before any of this existed, rather than repricing them", () => {
    const cs = taxComponents({ gst_registered: true, gst_rate: 12.5, gst_frequency: "monthly", country: "Australia" });
    expect(cs[0].rate).toBe(12.5);               // their figure, not Australia's 10
    expect(cs[0].frequency).toBe("monthly");
    expect(cs[0].label).toBe("GST");
  });

  it("does not apply a single stored rate to a province that levies two taxes", () => {
    const cs = taxComponents({ gst_registered: true, gst_rate: 9, country: "Canada", tax_region: "Quebec" });
    expect(cs.map((c) => c.label)).toEqual(["GST", "QST"]);
    expect(cs[0].rate).toBe(5);                  // the stored 9 would have been meaningless across two
  });

  it("cleans a component that is nonsense rather than throwing", () => {
    const cs = taxComponents({
      gst_registered: true,
      tax_components: [{ label: "", rate: "abc", frequency: "fortnightly", lagMonths: 99 }],
    });
    expect(cs[0].label).toBe("Tax");
    expect(cs[0].rate).toBe(0);
    expect(cs[0].frequency).toBe("quarterly");
    expect(cs[0].lagMonths).toBe(6);
  });

  it("survives a round trip through storage", () => {
    const before = regimeFor("Canada", "British Columbia").components;
    const after = serializeComponents(before).map(cleanComponent);
    expect(after).toEqual(before);
  });

  it("names however many taxes there are, in one heading", () => {
    expect(taxHeading([{ label: "GST" }])).toBe("GST");
    expect(taxHeading([{ label: "GST" }, { label: "PST" }])).toBe("GST and PST");
    expect(taxHeading([{ label: "A" }, { label: "B" }, { label: "C" }])).toBe("A, B and C");
    expect(taxHeading([])).toBe("GST");
  });
});

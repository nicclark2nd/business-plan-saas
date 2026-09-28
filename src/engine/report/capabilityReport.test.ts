import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import { type HistoricRow } from "@/engine/capability/actual";
import type { CapabilityInput } from "@/engine/capability/model";
import { readTab, readViews } from "@/engine/capability/read";
import { walk } from "./blocks";
import { renderDocx } from "./docx";
import { capabilityReport, capabilityReportFileName, type ReportTab } from "./capabilityReport";
import { cleanColour, contrastOnWhite, preparedByLine, readable, wordColour } from "@/engine/plan/brand";

/* SEQ's two actual years (as actual.test.ts). */
const rows: HistoricRow[] = [
  { period_number: 1, revenue: 1_997_000, cogs: 1_229_527, overheads: 808_000, depreciation_amortisation: 11_835, operating_profit: -52_362,
    interest_paid: 18_638, net_profit_before_tax: -71_000, tax_paid: 0, net_profit: -71_000, cash: 21_315, accounts_receivable: 253_938,
    inventory_wip: 6_000, accounts_payable: 20_000, bank_loans_current: 98_849, bank_loans_non_current: 89_974, fixed_assets: 129_294,
    current_assets: 287_496, current_liabilities: 253_756, equity: 73_325 },
  { period_number: 2, revenue: 1_890_000, cogs: 1_096_200, overheads: 680_000, depreciation_amortisation: 11_565, operating_profit: 102_235,
    interest_paid: 14_000, net_profit_before_tax: 88_235, tax_paid: 13_235, net_profit: 75_000, cash: 150_000, accounts_receivable: 155_342,
    inventory_wip: 4_000, accounts_payable: 18_000, bank_loans_current: 85_000, bank_loans_non_current: 87_000, fixed_assets: 130_800,
    current_assets: 318_493, current_liabilities: 217_418, equity: 144_325 },
];
const money = (v: number) => Math.round(v).toLocaleString("en-AU");
const plan = {
  pnl: {}, cashFlow: {}, balanceSheet: {}, days: {}, monthlyCash: [], monthlyProfit: [], debtService: {}, capex: {},
  growth: { cashBuffer: 78_048, costOfCapital: 12 }, stress: { salesPct: null, marginPts: null, debtorDaysAdded: null },
  sale: { askingPrice: null, addBacks: null, multipleLow: null, multipleHigh: null, exitYear: null },
  transfer: [], recurringShare: null, largestProductShare: null, leadershipPay: null, collateral: null, undrawn: 0,
} as unknown as Omit<CapabilityInput, "money">;

const ctx = { facts: plan, history: rows, firstYear: 2027, money, adviser: true, months: [], agreedTargets: {}, facilities: [] };
const RV = readViews(ctx);
const tabs: ReportTab[] = (["grow", "borrow", "sell"] as const).map((tab) => ({
  tab, actual: readTab(ctx, RV, tab, true), plan: readTab(ctx, RV, tab, false),
  briefings: tab === "grow" ? { actual: "Your score is 47.\n\n1. Bring overheads down.\n2. Lift margin." } : {},
}));
const input = { business: "SEQ Concreting", firm: "Clark Advisory", adviser: true, date: "September 2026", preparedOn: "28 September 2026", money, tabs, timeline: [], targets: [] };

describe("the Planner's report (§6.180)", () => {
  const doc = capabilityReport(input);
  const flat = walk(doc.sections);

  it("goes out under the firm's name, about the client", () => {
    expect(doc.businessName).toBe("SEQ Concreting");
    expect(doc.cover.contact).toBe("Prepared by Clark Advisory");
    expect(doc.cover.year).toBe("Planner's report");
    expect(capabilityReportFileName(doc)).toBe("SEQ-Concreting-Financial-Capabilities-September-2026.docx");
    expect(doc.disclaimer.parts.map((p) => p.heading)).toContain("Not financial advice");
  });

  it("has a section per capability, each with the accounts and then the plan", () => {
    expect(doc.sections.map((s) => s.title)).toEqual(["At a glance", "Capability to grow", "Capability to borrow", "Capability to sell", "Information still needed"]);
    expect(doc.sections[1].children.map((c) => c.title)).toEqual(["From the accounts, 2025 → 2026", expect.stringMatching(/^From the plan, /)]);
  });

  it("prints the Planner's saved words first, one paragraph per line", () => {
    const acc = doc.sections[1].children[0].blocks;
    const at = acc.findIndex((b) => b.kind === "lead" && b.text === "The Planner's view");
    expect(at).toBe(1);
    expect(acc.slice(at + 1, at + 4)).toEqual([
      { kind: "para", text: "Your score is 47." }, { kind: "para", text: "1. Bring overheads down." }, { kind: "para", text: "2. Lift margin." },
    ]);
    expect(doc.sections[2].children[0].blocks.some((b) => b.kind === "lead" && b.text === "The Planner's view")).toBe(false);
  });

  it("never names a projected year under the accounts' heading (§6.169)", () => {
    for (const s of doc.sections.slice(1, 4)) {
      const text = JSON.stringify(s.children[0].blocks);
      expect(text).not.toMatch(/\b202[7-9]\b|\b203\d\b/);
    }
  });

  it("carries the story and the fixes the page shows", () => {
    const acc = JSON.stringify(doc.sections[1].children[0].blocks);
    expect(acc).toContain(tabs[0].actual!.fixes.story!);
    expect(acc).toContain("1. Bring overheads down to");
    expect(flat.length).toBeGreaterThan(8);
  });

  it("prints in the firm's colour, made readable", async () => {
    const buf = await renderDocx(doc, [], "a4", null, { accent: wordColour("#1D6F42") });
    const styles = await (await JSZip.loadAsync(buf)).file("word/styles.xml")!.async("string");
    expect(styles).toContain('w:color w:val="1D6F42"');
    expect(styles).not.toContain('w:color w:val="1F3A5F"');
  });
});

describe("the firm's colour (§6.180)", () => {
  it("cleans what is typed into the one shape the database accepts", () => {
    expect(cleanColour("1d6f42")).toBe("#1D6F42");
    expect(cleanColour("#abc")).toBe("#AABBCC");
    expect(cleanColour("navy")).toBeNull();
    expect(cleanColour("")).toBeNull();
  });
  it("darkens a colour too light to read on white, and leaves a dark one alone", () => {
    expect(readable("#1F3A5F")).toBe("#1F3A5F");
    const gold = readable("#F2C94C");
    expect(gold).not.toBe("#F2C94C");
    expect(contrastOnWhite(gold)).toBeGreaterThanOrEqual(3);
    expect(wordColour(null)).toBe("1F3A5F");
  });
});

describe("the \u201cPrepared by\u201d line (§6.182)", () => {
  it("is built from the firm's details when the firm has not written its own", () => {
    expect(preparedByLine({ name: "Nic Clark Coaching", phone: "0400 111 222", website: "nicclark.com", preparedBy: null }, "nic@nicclark.com"))
      .toBe("Prepared by Nic Clark Coaching · 0400 111 222 · nic@nicclark.com");
    expect(preparedByLine({ name: "Nic Clark Coaching", phone: null, website: "nicclark.com", preparedBy: null }))
      .toBe("Prepared by Nic Clark Coaching · nicclark.com");
  });
  it("is the firm's own words when it wrote some", () => {
    expect(preparedByLine({ name: "X", phone: "1", website: null, preparedBy: "Coached by Nic Clark" }, "a@b.c")).toBe("Coached by Nic Clark");
  });
});

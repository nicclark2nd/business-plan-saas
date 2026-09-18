/**
 * The business plan, built from the plan (§6.83).
 *
 * Every section is a function of `ReportInput`. It returns a draft, or `null` when the plan has nothing to
 * put in it — and a `null` costs the reader a line in "What is not in this plan" rather than a heading with
 * an empty table under it.
 *
 * The figures come in already computed, from the one forecast run every statement screen uses (§6.67).
 * Nothing in this file reads the plan a second time, and nothing in it does arithmetic the engine has not
 * already been held to by a test.
 */
import { FORECAST_YEARS, type Forecast } from "../forecast/model";
import type { ServiceProfit } from "../pnl/lines";
import type { Strength } from "../balance/lines";
import type { Noun } from "../plan/vocabulary";
import { marginalCash, ratios } from "./analysis";
import { barsChart, columnsChart, linesChart, trendChart } from "./charts";
import { cell, num, numberSections, type Block, type Cell, type Draft, type Omission, type ReportDoc } from "./blocks";
import { COPY } from "./content";
import { groupByCategory } from "../overheads/categories";
import { governingLaw } from "../plan/jurisdiction";
import { contactLine } from "../plan/contact";
import { goalsAndMilestones, historicAppendix, howWeOperate, marketingAndSales, ourPeople, risksAndMitigation, theBusiness, theCompetition, theMarket, whatWeSell } from "./narrative";

export type ReportInput = {
  businessName: string;
  forecast: Forecast;
  strength: Strength[];
  services: ServiceProfit[];
  /** Year 1 units and price per line, for the products table a lender reads first. */
  /**
   * Everything a client typed about a line (§6.87), not the four figures the forecast needs. "Why this
   * price" and "why they buy it" are the two a lender reads hardest, and they were collected and dropped.
   */
  productLines: {
    name: string; averagePrice: number; units: number; revenue: number;
    description: string | null; whyTheyBuy: string | null; pricingRationale: string | null;
    lifecycle: string | null; soldAs: string | null; startYear: number;
  }[];
  profile: {
    established: string | null; industry: string | null; country: string | null;
    legalStructure: string | null; customerType: string | null; productType: string | null;
    /**
     * The main state of operation (§6.96). Held in `tax_region`, which is the column that has always meant
     * a state or province — asked of every plan now, rather than only where sales tax needed it (§6.39).
     */
    taxRegion: string | null;
    /** The cover's three optional fields (§6.96). Each drops its line when empty rather than leaving a gap. */
    tagline: string | null;
    contactEmail: string | null;
    website: string | null;
  };
  /** The year on the front cover — the PLAN's year, never the clock's (§6.33.2). */
  planYear: number | null;
  framework: { vision: string | null; mission: string | null; purpose: string | null; brandPromise: string | null; fieldOfPlay: string | null };
  goals: { area: string; title: string }[];
  capital: { name: string; amount: number; year: number; category: string | null; usefulLifeMonths: number | null; residual: number; financed: boolean }[];
  /** Year 1 figure, plus the category the client set and what kind of line it is (§6.93). */
  overheads: { name: string; amount: number; category: string | null; source: "entered" | "people" | "marketing" }[];
  /**
   * What each key person is paid, year by year, already computed through `salaryForYear` and already free of
   * contractors — so the table's total IS the Leadership Team salaries line above it (§6.41).
   */
  keyPeople: { name: string; position: string | null; role: string | null; startYear: number; salaries: number[] }[];
  /**
   * Whether the salary table prints. It does NOT decide whether the money prints: the overheads line and the
   * profit and loss carry it either way, and any wording that suggests otherwise is a lie to the client (§6.93).
   */
  printSalaries: boolean;
  /**
   * The TERMS, not just the amount (§6.88). A funding section that says "Bank loan 250,000" and stops has
   * left out everything a lender reads it for: the rate, the term, how it is repaid and when it starts.
   */
  funding: {
    name: string; kind: string; amount: number;
    rate: number | null; termMonths: number | null; repayment: string | null; frequency: string | null;
    startsYear: number | null; taxable: boolean | null;
  }[];
  extraordinary: { name: string; amount: number; year: number; income: boolean }[];
  owners: { name: string; share: number | null; role: string | null }[];
  licences: { name: string; number: string | null; issuer: string | null; expires: string | null }[];
  /** Market and brand prose, as typed on Marketing. */
  market: {
    size: string | null; trends: string | null; positioning: string | null;
    brandValues: string | null; brandPersonality: string | null; visualIdentity: string | null;
    salesProcess: string | null; salesTeam: string | null;
  };
  segments: { name: string; profile: string | null; caresAbout: string | null; share: number | null }[];
  evidence: { source: string; method: string | null; finding: string | null; decision: string | null }[];
  spend: { label: string; approach: string | null; budget: number }[];
  competitors: { name: string; kind: string | null; reach: string | null; pricing: string | null; threat: string | null; strengths: string | null; weaknesses: string | null; howWeWin: string | null }[];
  position: { ourAdvantage: string | null; barriers: string | null; futureThreats: string | null };
  people: { id: string; name: string; position: string | null; role: string | null; share: number | null }[];
  /**
   * ALREADY FILTERED (§6.86). The People screen promises on screen that development areas are "never
   * printed in an external report", and this is the only place that promise can be broken. It is kept at
   * the boundary rather than inside a renderer, so no future section can forget.
   */
  capabilities: { personId: string; kind: string; description: string }[];
  swot: { quadrant: string; text: string; response: string | null }[];
  goalsAnnual: { area: string; title: string; detail: string | null }[];
  goalsQuarterly: { area: string; title: string; when: string | null; owner: string | null; status: string; due: string | null }[];
  operations: {
    premises: { name: string; address: string | null; tenure: string | null; isPrimary: boolean; floorArea: string | null; purpose: string | null }[];
    suppliers: { name: string; supplies: string | null; terms: string | null; dependency: string | null; alternative: string | null }[];
    steps: { title: string; detail: string | null; owner: string | null; duration: string | null }[];
    capacity: { operatingHours: string | null; capacityNow: string | null; capacityConstraint: string | null; capacityPlan: string | null; qualityApproach: string | null };
  };
  /** The client's own prior accounts, if they entered any. `null` for a business with no history. */
  historic: { label: string; pnl: { label: string; value: number }[]; balance: { label: string; value: number }[] } | null;
  noun: Noun & { aOne: string };
  taxLabel: string;
  currency: string;
  yearEndLabels: string[];
  money: (v: number) => string;
  date: string;
  preparedOn: string;
};

/** The stage labels the Sales screen uses, so the plan says what the client picked. */
export const LIFECYCLE: Record<string, string> = {
  development: "In development", introduction: "Introduction", growth: "Growth",
  maturity: "Maturity", decline: "Decline",
};
export const SOLD_AS: Record<string, string> = { one_off: "One-off job", recurring: "Ongoing client" };

/** Every chart goes into the document the same way, so no section invents its own picture block. */
const chartBlock = (c: { svg: string; title: string; note?: string; alt: string; height: number }): Block =>
  ({ kind: "chart", ...c });

const pct = (v: number | null, dp = 1) => (v === null ? "—" : `${v.toFixed(dp)}%`);
const times = (v: number | null) => (v === null ? "—" : `${v.toFixed(2)}×`);
const plain = (v: number | null) => (v === null ? "—" : String(v));
/** A column is the DATE the year ends on — the heading a lender expects above a five-year statement. */
const yearCols = (labels: string[]) => labels.map((label) => ({ label, numeric: true, width: 110 }));

/**
 * Money out in brackets and NOTHING FOR NIL — the convention every statement in the product already uses
 * (§6.76), and the report had drifted from it (§6.92). A five-year statement printed a column of `0`s where
 * the screens print dashes, which reads as twelve measured zeros rather than "this does not apply".
 */
const signed = (money: (v: number) => string) => (v: number) =>
  v === 0 ? "\u2014" : v < 0 ? `(${money(Math.abs(v))})` : money(v);

// ---------------------------------------------------------------------------
// 1.0 Executive Summary
// ---------------------------------------------------------------------------

function executiveSummary(i: ReportInput): Draft {
  const { forecast: f, money } = i;
  const s = signed(money);
  const p = f.pnl, bs = f.balanceSheet;
  const cols = yearCols(i.yearEndLabels);

  const snapshot: Draft = {
    title: "Company snapshot",
    blocks: [
      { kind: "para", text: COPY.snapshot(i.businessName) },
      { kind: "facts", rows: ([
        ["Established", i.profile.established],
        ["Industry", i.profile.industry],
        ["Country of operations", i.profile.country],
        ["Legal structure", i.profile.legalStructure],
        ["Sales tax", i.taxLabel],
        ["Currency", i.currency],
        ["Plan period", `Year 1 ending ${i.yearEndLabels[0]}, through to ${i.yearEndLabels[i.yearEndLabels.length - 1]}`],
      ] as [string, string | null][]).filter((r): r is [string, string] => !!r[1]) },
    ],
  };

  const highlights: Draft = {
    title: "Revenue and profit highlights",
    blocks: [
      { kind: "para", text: COPY.highlights(i.businessName) },
      chartBlock(linesChart({
        title: "Revenue, gross profit and net profit",
        note: "The gap between the lines is the cost story: revenue that grows while the bottom line flattens shows here before it shows anywhere else.",
        categories: i.yearEndLabels, money,
        series: [
          { name: "Revenue", values: FORECAST_YEARS.map((y) => p[y].revenue) },
          { name: "Gross profit", values: FORECAST_YEARS.map((y) => p[y].grossProfit) },
          { name: "Net profit", values: FORECAST_YEARS.map((y) => p[y].netProfit) },
        ],
      })),
      { kind: "table",
        columns: [{ label: "Projected year", width: 110 }, { label: "Year ending", width: 120 },
          { label: `Net profit after tax (${i.currency})`, numeric: true }, { label: "% of revenue", numeric: true }],
        rows: FORECAST_YEARS.map((y) => [
          cell(`Year ${y}`),
          cell(i.yearEndLabels[y - 1], { muted: true }),
          num(s(p[y].netProfit), { bold: true }),
          num(pct(p[y].revenue === 0 ? null : (p[y].netProfit / p[y].revenue) * 100)),
        ]) },
    ],
  };

  const projections: Draft = {
    title: "Financial projections",
    blocks: [
      { kind: "para", text: COPY.projections(i.businessName) },
      statementTable(cols, [
        ["Revenue", (y) => p[y].revenue, "head"],
        ["Cost of sales", (y) => -p[y].cogs],
        ["Gross profit", (y) => p[y].grossProfit, "sub"],
        ["Overheads", (y) => -p[y].overheads],
        ["Depreciation", (y) => -p[y].depreciation],
        ["Operating profit", (y) => p[y].operatingProfit, "sub"],
        ["Interest", (y) => -p[y].interest],
        ["Profit before tax", (y) => p[y].profitBeforeTax, "sub"],
        ["Tax", (y) => -p[y].tax],
        ["Net profit after tax", (y) => p[y].netProfit, "total"],
      ], s),
      { kind: "lead", text: COPY.grossMarginLead },
      chartBlock(trendChart({
        title: "Gross margin",
        note: "What is left of every dollar of revenue after the cost of delivering it.",
        categories: i.yearEndLabels, values: FORECAST_YEARS.map((y) => p[y].grossMargin ?? 0),
        money: (v) => `${v.toFixed(0)}%`,
      })),
      { kind: "table", columns: [{ label: "" }, ...cols],
        rows: [[cell("Gross profit margin"), ...FORECAST_YEARS.map((y) => num(pct(p[y].grossMargin)))]] },
    ],
  };

  const mc = marginalCash(p, bs, FORECAST_YEARS);
  const marginal: Draft = mc.every((m) => m.revenue === 0) ? null : {
    title: "Marginal cash analysis",
    blocks: [
      { kind: "para", text: COPY.marginalCash },
      { kind: "para", text: COPY.marginalCashWhy },
      { kind: "table", columns: [{ label: "Per 100 units of revenue", width: 220 }, ...cols],
        rows: ([
          ["Revenue", (m: typeof mc[number]) => m.revenue, false],
          ["Cost of goods", (m: typeof mc[number]) => m.costOfGoods, false],
          ["Money owed to us", (m: typeof mc[number]) => m.receivables, false],
          ["Stock and work in progress", (m: typeof mc[number]) => m.inventory, false],
          ["Money we owe suppliers", (m: typeof mc[number]) => m.payables, false],
          ["Overheads", (m: typeof mc[number]) => m.overheads, false],
          ["Net variable cash flow", (m: typeof mc[number]) => m.netVariableCashFlow, true],
        ] as [string, (m: typeof mc[number]) => number, boolean][]).map(([label, get, bold]) => [
          cell(label, { bold }), ...mc.map((m) => num(get(m).toFixed(2), { bold })),
        ]) },
      chartBlock(trendChart({
        title: "Net variable cash flow per 100 units of revenue",
        note: "What is left as cash out of every hundred dollars earned. Below the line at nil, growth is being funded out of the bank.",
        categories: i.yearEndLabels, values: mc.map((m) => m.netVariableCashFlow),
        money: (v) => v.toFixed(1),
      })),
      { kind: "note", text: COPY.marginalCashNote },
    ],
  };

  const rows = ratios(p, bs, FORECAST_YEARS);
  const ratioSection: Draft = {
    title: "Financial ratios",
    blocks: [
      { kind: "para", text: COPY.ratios(i.businessName) },
      { kind: "table", columns: [{ label: "", width: 220 }, ...cols],
        rows: (["Profitability", "Growth", "Efficiency & liquidity"] as const).flatMap((group) => [
          [cell(group, { bold: true }), ...FORECAST_YEARS.map(() => cell(""))],
          ...rows.filter((r) => r.group === group).map((r) => [
            cell(r.label, { muted: true }),
            ...r.values.map((v) => num(r.unit === "%" ? pct(v, 2) : r.unit === "x" ? times(v) : plain(v))),
          ]),
        ]) },
    ],
  };

  /* Settings labels the noun for a menu ("Services"); a heading mid-sentence wants it lower case. */
  const products: Draft = i.productLines.length === 0 ? null : {
    title: `Overview of our ${i.noun.many.charAt(0).toLowerCase() + i.noun.many.slice(1)}`,
    blocks: [
      { kind: "para", text: COPY.products(i.businessName, i.noun.many.charAt(0).toLowerCase() + i.noun.many.slice(1), (i.profile.customerType ?? "customer").toLowerCase() + "s") },
      /*
       * An OVERVIEW is not a price list (§6.87). It says what each line IS and where it sits in its own
       * life, next to what it earns — which is what somebody reading the summary needs before deciding
       * whether to read section 3 at all. The case for each line lives there.
       */
      { kind: "table",
        columns: [{ label: i.noun.head, width: 180 }, { label: "What it is" }, { label: "Stage", width: 110 },
          { label: `Average sale (${i.currency})`, numeric: true }, { label: `Year 1 revenue (${i.currency})`, numeric: true }],
        rows: i.productLines.map((l) => [
          cell(l.name, { bold: true }),
          cell(l.description?.trim() ?? "—", { muted: !l.description }),
          cell(LIFECYCLE[l.lifecycle ?? ""] ?? "—", { muted: !l.lifecycle }),
          num(money(l.averagePrice)), num(money(l.revenue)),
        ]).concat([[cell("Total", { bold: true }), cell(""), cell(""), num(""),
          num(money(i.productLines.reduce((a, l) => a + l.revenue, 0)), { bold: true })]]) },
      chartBlock(barsChart({
        title: `Year 1 revenue by ${i.noun.one}`,
        note: "Where the revenue actually comes from, largest first.",
        rows: i.productLines.map((l) => ({ label: l.name, value: l.revenue })), money,
      })),
      { kind: "note", text: COPY.productsNote(i.noun.many.charAt(0).toLowerCase() + i.noun.many.slice(1)) },
    ],
  };

  const whatWeDo: Draft = i.framework.purpose ? {
    title: "What we do", blocks: [{ kind: "para", text: i.framework.purpose }],
  } : null;

  const ownership: Draft = i.owners.length === 0 ? null : {
    title: "Ownership",
    blocks: [
      { kind: "para", text: COPY.ownership(i.businessName) },
      { kind: "table", columns: [{ label: "Owner", width: 240 }, { label: "Share held", numeric: true }, { label: "Position in the business" }],
        rows: i.owners.map((o) => [cell(o.name), num(o.share === null ? "—" : `${o.share}%`), cell(o.role ?? "—", { muted: !o.role })]) },
    ],
  };

  const statement = (title: string, text: string | null, lead: string): Draft =>
    text ? { title, blocks: [{ kind: "para", text: lead }, { kind: "quote", text }] } : null;

  const goals: Draft = i.goals.length === 0 ? null : {
    title: "Important goals",
    blocks: [
      { kind: "para", text: COPY.goals(i.businessName) },
      { kind: "list", items: i.goals.map((g) => `${g.area} — ${g.title}`) },
    ],
  };

  const capital: Draft = i.capital.length === 0 ? null : {
    title: "Capital requirements",
    blocks: [
      { kind: "para", text: COPY.capital(i.businessName) },
      { kind: "table",
        columns: [{ label: "Item", width: 220 }, { label: "Category" }, { label: "Year", numeric: true },
          { label: `Cost (${i.currency})`, numeric: true }, { label: "Written off over", numeric: true }, { label: "Funded by" }],
        rows: i.capital.map((c) => [
          cell(c.name), cell(c.category ?? "—", { muted: !c.category }), num(`Year ${c.year}`), num(money(c.amount)),
          num(c.usefulLifeMonths ? `${Math.round(c.usefulLifeMonths / 12)} yr` : "—"),
          cell(c.financed ? "Finance" : "Cash", { muted: !c.financed }),
        ]).concat([[cell("Total", { bold: true }), cell(""), num(""),
          num(money(i.capital.reduce((a, c) => a + c.amount, 0)), { bold: true }), num(""), cell("")]]) },
      { kind: "note", text: COPY.capitalNote },
    ],
  };

  return {
    title: "Executive Summary",
    children: [
      snapshot, highlights, projections, marginal, ratioSection, products, whatWeDo, ownership,
      statement("Our vision", i.framework.vision, COPY.visionLead(i.businessName)),
      statement("Our mission", i.framework.mission, COPY.missionLead(i.businessName)),
      statement("Our brand promise", i.framework.brandPromise, COPY.promiseLead(i.businessName)),
      goals, capital,
    ],
  };
}

// ---------------------------------------------------------------------------
// The five-year statement, the shape every financial table in the plan takes
// ---------------------------------------------------------------------------

type Line = [string, (y: number) => number, ("head" | "sub" | "total")?];

function statementTable(cols: { label: string; numeric?: boolean; width?: number }[], lines: Line[], s: (v: number) => string): Block {
  return {
    kind: "table",
    columns: [{ label: "", width: 220 }, ...cols],
    rows: lines.map(([label, get, weight]) => [
      cell(label, { bold: !!weight, muted: !weight }),
      ...FORECAST_YEARS.map((y) => num(s(get(y)), { bold: !!weight })),
    ]),
  };
}

// ---------------------------------------------------------------------------
// 9.0 Financial Plan
// ---------------------------------------------------------------------------

function financialPlan(i: ReportInput): Draft {
  const { forecast: f, money } = i;
  const s = signed(money);
  const p = f.pnl, cf = f.cashFlow, bs = f.balanceSheet;
  const cols = yearCols(i.yearEndLabels);

  /*
   * GROUPED ONLY ONCE A CLIENT HAS GROUPED SOMETHING (§6.93).
   *
   * §6.88 grouped this table by `plan_overheads.category`, and §6.89 tore it out, because the column had no
   * editor: every plan collapsed under one heading called "Other" — structure invented from a field nobody
   * could reach. 0041 gave the column an editor and a check constraint, so the data is real now.
   *
   * What does NOT come back is grouping a plan that has not been categorised. `groupByCategory` reports
   * `grouped: false` when not one line carries a category, and this prints exactly the flat table it printed
   * before. The two synced lines always carry one, so any plan with salaries or a marketing budget groups —
   * which is correct: those two lines genuinely are People & admin and Sales & marketing.
   */
  const og = groupByCategory(i.overheads);
  const overheadRows: Cell[][] = og.grouped
    ? og.groups.flatMap((g) => [
        [cell(g.label, { bold: true }), num("")],
        ...g.rows.map((o) => [cell(`    ${o.name}`), num(money(o.amount))]),
        [cell(`    ${g.label} total`, { muted: true }), num(money(g.total), { muted: true })],
      ])
    : i.overheads.map((o) => [cell(o.name), num(money(o.amount))]);

  const overheads: Draft = i.overheads.length === 0 ? null : {
    title: "Overheads",
    blocks: [
      { kind: "para", text: COPY.overheads(i.businessName) },
      { kind: "table", columns: [{ label: "Expense", width: 300 }, { label: `Year 1 (${i.currency})`, numeric: true }],
        rows: [...overheadRows, [cell("Total overheads", { bold: true }), num(money(p[1].overheads), { bold: true })]] },
      /* A chart of one bar is a heading with a rectangle under it. Two groups is where it starts to say something. */
      ...(og.grouped && og.groups.length > 1 ? [chartBlock(barsChart({
        title: "Where the overheads go",
        note: "Year 1, by category, largest first.",
        rows: og.groups.map((g) => ({ label: g.label, value: g.total })), money,
      }))] : []),
      ...(og.grouped ? [{ kind: "note" as const, text: COPY.overheadsGrouped }] : []),
    ],
  };

  /*
   * WHAT EACH KEY PERSON IS PAID (§6.93), directly above the overheads line that totals them.
   *
   * It sits here rather than in Our People for two reasons. The total has to be readable against the
   * "Leadership Team salaries" line, which is in this section; and a salary written down in two places is
   * two readings of one fact (§6.41), which is the fault this project keeps relearning.
   *
   * `printSalaries` decides whether it prints AT ALL, and decides nothing else. The money is in the
   * overheads table and the profit and loss whatever this says.
   */
  const keyPeople: Draft = !i.printSalaries || i.keyPeople.length === 0 ? null : {
    title: "Leadership Team salaries",
    blocks: [
      { kind: "para", text: COPY.keyPeople(i.businessName) },
      { kind: "table",
        columns: [{ label: "Name", width: 190 }, { label: "Position", width: 180 }, ...cols],
        rows: [
          ...i.keyPeople.map((x) => [
            cell(x.name), cell(x.position ?? "\u2014", { muted: !x.position }),
            ...FORECAST_YEARS.map((y) => num(x.salaries[y - 1] ? money(x.salaries[y - 1]) : "\u2014",
              x.salaries[y - 1] ? {} : { muted: true })),
          ]),
          [cell("Total", { bold: true }), cell(""), ...FORECAST_YEARS.map((y) =>
            num(money(i.keyPeople.reduce((t, x) => t + (x.salaries[y - 1] ?? 0), 0)), { bold: true }))],
        ] },
      { kind: "note", text: COPY.keyPeopleNote },
    ],
  };

  const funding: Draft = i.funding.length === 0 ? null : {
    title: "Funding",
    blocks: [
      { kind: "para", text: COPY.funding(i.businessName) },
      { kind: "table",
        columns: [{ label: "Source", width: 200 }, { label: "Type" }, { label: `Amount (${i.currency})`, numeric: true },
          { label: "Rate", numeric: true }, { label: "Term", numeric: true }, { label: "Repaid" }, { label: "Starts" }],
        rows: i.funding.map((x) => [
          cell(x.name), cell(x.kind, { muted: true }), num(money(x.amount)),
          num(x.rate === null ? "—" : `${x.rate}%`),
          num(x.termMonths ? `${x.termMonths} mo` : "—"),
          cell(x.repayment ? `${x.repayment}${x.frequency ? `, ${x.frequency.toLowerCase()}` : ""}` : "—", { muted: !x.repayment }),
          cell(x.startsYear ? `Year ${x.startsYear}` : "—", { muted: !x.startsYear }),
        ]).concat([[cell("Total", { bold: true }), cell(""), num(money(i.funding.reduce((a, x) => a + x.amount, 0)), { bold: true }),
          num(""), num(""), cell(""), cell("")]]) },
      { kind: "note", text: COPY.fundingNote },
    ],
  };

  const oneOffs: Draft = i.extraordinary.length === 0 ? null : {
    title: "One-off income and costs",
    blocks: [
      { kind: "para", text: COPY.oneOffs },
      { kind: "table", columns: [{ label: "Item", width: 300 }, { label: "Year", numeric: true }, { label: `Amount (${i.currency})`, numeric: true }],
        rows: i.extraordinary.map((x) => [cell(x.name), num(`Year ${x.year}`), num(s(x.income ? x.amount : -x.amount))]) },
    ],
  };

  return {
    title: "Financial Plan",
    blocks: [{ kind: "para", text: COPY.financialPlanIntro(i.businessName) }],
    children: [
      { title: "Profit and loss projections",
        blocks: [
          { kind: "para", text: COPY.pnl },
          statementTable(cols, [
            ["Revenue", (y) => p[y].revenue, "head"],
            ["Cost of sales", (y) => -p[y].cogs],
            ["Gross profit", (y) => p[y].grossProfit, "sub"],
            ["Overheads", (y) => -p[y].overheads],
            ["Depreciation", (y) => -p[y].depreciation],
            ["Operating profit", (y) => p[y].operatingProfit, "sub"],
            ["Grant income", (y) => p[y].grantIncome],
            ["One-off income", (y) => p[y].extraordinaryIncome],
            ["One-off costs", (y) => -p[y].extraordinaryExpense],
            ["Gain on asset sales", (y) => p[y].disposalGainLoss],
            ["Interest", (y) => -p[y].interest],
            ["Profit before tax", (y) => p[y].profitBeforeTax, "sub"],
            ["Tax", (y) => -p[y].tax],
            ["Net profit after tax", (y) => p[y].netProfit, "total"],
            ["Dividends", (y) => -p[y].dividends],
            ["Retained profit", (y) => p[y].retainedProfit, "sub"],
          ], s),
        ] },
      { title: "Balance sheet projections",
        blocks: [
          { kind: "para", text: COPY.balanceSheet },
          chartBlock(linesChart({
            title: "What is owned, what is owed, and what is left",
            note: "The gap between the first two lines is the third. A widening gap is the plan building something that belongs to the business.",
            categories: i.yearEndLabels, money,
            series: [
              { name: "Total assets", values: FORECAST_YEARS.map((y) => bs[y].totalAssets) },
              { name: "Total liabilities", values: FORECAST_YEARS.map((y) => bs[y].totalLiabilities) },
              { name: "Equity", values: FORECAST_YEARS.map((y) => bs[y].equity) },
            ],
          })),
          statementTable(cols, [
            ["Cash", (y) => bs[y].cash, "head"],
            ["Debtors", (y) => bs[y].accountsReceivable],
            ["Stock and work in progress", (y) => bs[y].inventory],
            ["Prepayments", (y) => bs[y].prepaid],
            ["Other current assets", (y) => bs[y].otherCurrentAssets],
            ["Current assets", (y) => bs[y].currentAssets, "sub"],
            ["Fixed assets", (y) => bs[y].fixedAssets],
            ["Other non-current assets", (y) => bs[y].otherNonCurrentAssets],
            ["Total assets", (y) => bs[y].totalAssets, "total"],
            ["Creditors", (y) => bs[y].accountsPayable],
            ["Accruals", (y) => bs[y].accrued],
            ["Tax owing", (y) => bs[y].taxPayable],
            ["Loans due within a year", (y) => bs[y].debtCurrent],
            ["Other current liabilities", (y) => bs[y].otherCurrentLiabilities],
            ["Current liabilities", (y) => bs[y].currentLiabilities, "sub"],
            ["Loans due later", (y) => bs[y].debtNonCurrent],
            ["Other non-current liabilities", (y) => bs[y].otherNonCurrentLiabilities],
            ["Total liabilities", (y) => bs[y].totalLiabilities, "sub"],
            ["Equity", (y) => bs[y].equity],
            ["Liabilities and equity", (y) => bs[y].totalLiabilitiesAndEquity, "total"],
          ], s),
        ] },
      { title: "Cash flow projections",
        blocks: [
          { kind: "para", text: COPY.cashFlow },
          chartBlock(columnsChart({
            title: "Cash at the end of each year",
            note: "Where the bank balance lands each year. Anything below the line at nil is a year the business cannot fund out of its own account.",
            categories: i.yearEndLabels, values: FORECAST_YEARS.map((y) => cf[y].closingCash), money,
          })),
          statementTable(cols, [
            ["Opening cash", (y) => cf[y].openingCash, "head"],
            ["Received from customers", (y) => cf[y].receiptsFromCustomers],
            ["Grants received", (y) => cf[y].grantsReceived],
            ["One-off receipts", (y) => cf[y].extraordinaryReceipts],
            ["Paid to suppliers and staff", (y) => -cf[y].paidToSuppliersAndEmployees],
            ["One-off payments", (y) => -cf[y].extraordinaryPayments],
            ["Tax paid", (y) => -cf[y].taxPaid],
            ["Operating cash flow", (y) => cf[y].netOperating, "sub"],
            ["Assets bought", (y) => -cf[y].capex],
            ["Assets sold", (y) => cf[y].disposalProceeds],
            ["Investing cash flow", (y) => cf[y].netInvesting, "sub"],
            ["Money borrowed", (y) => cf[y].debtProceeds],
            ["Money invested", (y) => cf[y].equityRaised],
            ["Loan repayments", (y) => -cf[y].debtRepaid],
            ["Interest paid", (y) => -cf[y].interestPaid],
            ["Dividends paid", (y) => -cf[y].dividendsPaid],
            ["Financing cash flow", (y) => cf[y].netFinancing, "sub"],
            ["Closing cash", (y) => cf[y].closingCash, "total"],
          ], s),
          { kind: "note", text: COPY.cashFlowNote },
        ] },
      { title: `Revenue by ${i.noun.one}`, ...(i.services.length === 0 ? { blocks: [] } : {}),
        blocks: i.services.length === 0 ? [{ kind: "para", text: COPY.noServices(i.noun.many) }] : [
          { kind: "para", text: COPY.byService(i.noun.one) },
          { kind: "table",
            columns: [{ label: i.noun.head, width: 240 }, { label: `Revenue (${i.currency})`, numeric: true },
              { label: `Cost of sales (${i.currency})`, numeric: true }, { label: `Gross profit (${i.currency})`, numeric: true }, { label: "Margin", numeric: true }],
            rows: i.services.map((x) => [cell(x.name), num(money(x.revenue)), num(money(x.cogs)), num(money(x.grossProfit)), num(pct(x.margin))]) },
          chartBlock(barsChart({
            title: `Gross profit by ${i.noun.one}`,
            note: "What each line earns above the cost of delivering it, largest first.",
            rows: i.services.map((x) => ({ label: x.name, value: x.grossProfit })), money,
          })),
          { kind: "note", text: COPY.byServiceNote(i.noun.one) },
        ] },
      keyPeople, overheads, funding, oneOffs,
      { title: "Financial strength",
        blocks: [
          { kind: "para", text: COPY.strength },
          chartBlock(linesChart({
            title: "Borrowed against owned",
            note: "Where equity crosses above the borrowings, the business has become worth more than it owes.",
            categories: i.yearEndLabels, money,
            series: [
              { name: "Borrowings", values: i.strength.map((x) => x.totalDebt) },
              { name: "Equity", values: i.strength.map((x) => x.equity) },
            ],
          })),
          { kind: "table", columns: [{ label: "", width: 220 }, ...cols],
            rows: [
              [cell("Working capital"), ...i.strength.map((x) => num(s(x.netWorkingCapital)))],
              [cell("Borrowings"), ...i.strength.map((x) => num(money(x.totalDebt)))],
              [cell("Net debt"), ...i.strength.map((x) => num(s(x.netDebt)))],
              [cell("Net assets", { bold: true }), ...i.strength.map((x) => num(s(x.netAssets), { bold: true }))],
            ] },
        ] },
    ],
  };
}

// ---------------------------------------------------------------------------

export function buildReport(i: ReportInput): ReportDoc {
  const omitted: Omission[] = [];
  const keep = (d: Draft, title: string, why: string): Draft => {
    if (d === null) omitted.push({ title, why });
    return d;
  };

  /**
   * THE ORDER IS THE STANDARD OUTLINE'S, NOT APeX'S (§6.86).
   *
   * Executive summary, then the business, what it sells, the market, the competition, how it markets and
   * sells, who runs it, how it operates, what could go wrong, what it has committed to — and the money
   * LAST. A lender reads the financials against a business they have already been told about; APeX puts
   * them at 1.3 and again at 9, and a plan that opens on a table is a spreadsheet with a cover.
   */
  const sections = numberSections([
    executiveSummary(i),
    keep(theBusiness(i), "The Business", "Nothing recorded about the business itself yet."),
    keep(whatWeSell(i), "What We Sell", `No ${i.noun.many} have been recorded.`),
    keep(theMarket(i), "The Market", "No market size, trends or segments have been written."),
    keep(theCompetition(i), "The Competition", "No competitors have been recorded."),
    keep(marketingAndSales(i), "Marketing and Sales", "No positioning, brand or marketing spend has been written."),
    keep(ourPeople(i), "Our People", "Nobody has been added to the team."),
    keep(howWeOperate(i), "How We Operate", "No premises, suppliers, process or capacity have been recorded."),
    keep(risksAndMitigation(i), "Risks and Mitigation", "No SWOT lines have been written."),
    keep(goalsAndMilestones(i), "Goals and Milestones", "No goals have been set."),
    keep(financialPlan(i), "Financial Plan", "The forecast has not been built yet."),
    historicAppendix(i),
  ]);

  /* Sections the plan has no module behind yet are not listed as missing: a client cannot fix them. */
  return {
    businessName: i.businessName,
    subtitle: COPY.subtitle,
    date: i.date,
    preparedOn: i.preparedOn,
    /*
     * The cover (§6.96), following the placement Nic supplied: name, tagline, title, year, then the contact
     * line and the address at the foot. Every one of those but the name is allowed to be absent.
     *
     * The address is the PRIMARY premise, falling back to the first — Operations already asks which one is
     * the business's own address (§6.84), so the cover does not ask a second time.
     */
    cover: {
      tagline: i.profile.tagline,
      year: i.planYear ? String(i.planYear) : null,
      contact: contactLine(i.profile.contactEmail, i.profile.website),
      address: i.operations.premises.find((p) => p.isPrimary)?.address
        ?? i.operations.premises[0]?.address ?? null,
    },
    /* Page two, with this plan's own name in it and never another's (§6.95), governed by the laws of the
       place the client actually named (§6.95.1). */
    disclaimer: COPY.disclaimer(i.businessName, governingLaw(i.profile.country, i.profile.taxRegion)),
    sections,
    omitted,
  };
}

/**
 * The nine sections that are words rather than figures (§6.86).
 *
 * Every one is a function of `ReportInput` returning a draft, and every one returns `null` when the plan
 * has nothing to put in it — because the alternative is a heading with an empty table under it, which in
 * the document a client hands to a bank is the §6.57 fault at its most expensive.
 *
 * ONE PROMISE IS KEPT HERE THAT IS MADE SOMEWHERE ELSE. The People screen says, on the screen, in so many
 * words: "Hatched rows (Development areas) are internal — never printed in an external report." This file
 * is the only place that promise can be broken, so `capabilities` arrives already filtered and §6.86's test
 * holds it to that. A promise made on one screen and kept nowhere is worse than one never made.
 */
import type { Draft } from "./blocks";
import { cell, num, type Block } from "./blocks";
import { barsChart } from "./charts";
import { LIFECYCLE, SOLD_AS, type ReportInput } from "./build";
import { COPY } from "./content";

const listOr = <T,>(xs: T[], f: (x: T) => Draft | null): Draft[] => xs.map(f).filter((d): d is Draft => d !== null);
const has = (s: string | null | undefined) => !!s && !!s.trim();
const para = (text: string) => ({ kind: "para" as const, text });
/** "Services" is how Settings labels it; "the services we offer" is how a sentence carries it. */
const lower = (s: string) => (s === s.toUpperCase() ? s : s.charAt(0).toLowerCase() + s.slice(1));
const chartBlock = (c: { svg: string; title: string; note?: string; alt: string; height: number }): Block => ({ kind: "chart", ...c });
const pct = (v: number | null) => (v === null ? "—" : `${v.toFixed(1)}%`);

/** A written field becomes a titled subsection; an empty one becomes nothing. */
const written = (title: string, text: string | null | undefined): Draft =>
  has(text) ? { title, blocks: [para(text!.trim())] } : null;

// ---------------------------------------------------------------------------
// 2.0 The Business
// ---------------------------------------------------------------------------

export function theBusiness(i: ReportInput): Draft {
  const p = i.profile;
  const facts: [string, string | null][] = [
    ["Established", p.established], ["Industry", p.industry],
    ["Legal structure", p.legalStructure], ["Country of operations", p.country],
  ];
  const kept = facts.filter((f): f is [string, string] => !!f[1]);

  const licences: Draft = i.licences.length === 0 ? null : {
    title: "Licences, registrations and insurances",
    blocks: [
      para(COPY.licences(i.businessName)),
      { kind: "table",
        columns: [{ label: "Licence or registration", width: 280 }, { label: "Number" }, { label: "Issued by" }, { label: "Expires" }],
        rows: i.licences.map((l) => [
          cell(l.name), cell(l.number ?? "—", { muted: !l.number }),
          cell(l.issuer ?? "—", { muted: !l.issuer }), cell(l.expires ?? "Does not expire", { muted: !l.expires }),
        ]) },
    ],
  };

  const ownership: Draft = i.owners.length === 0 ? null : {
    title: "Ownership",
    blocks: [
      para(COPY.ownership(i.businessName)),
      { kind: "table", columns: [{ label: "Owner", width: 240 }, { label: "Share held", numeric: true }, { label: "Position in the business" }],
        rows: i.owners.map((o) => [cell(o.name), num(o.share === null ? "—" : `${o.share}%`), cell(o.role ?? "—", { muted: !o.role })]) },
    ],
  };

  const children = [
    kept.length ? { title: "The business at a glance", blocks: [para(COPY.glance(i.businessName)), { kind: "facts" as const, rows: kept }] } : null,
    written("Why the business exists", i.framework.purpose),
    written("Where we compete", i.framework.fieldOfPlay),
    licences, ownership,
  ];
  return children.some(Boolean) ? { title: "The Business", children } : null;
}

// ---------------------------------------------------------------------------
// 3.0 What We Sell
// ---------------------------------------------------------------------------

export function whatWeSell(i: ReportInput): Draft {
  if (i.productLines.length === 0) return null;
  const detail = i.productLines.filter((l) => has(l.description) || has(l.whyTheyBuy) || has(l.pricingRationale));
  /** Stage, how it is sold, and when it starts — the three facts that are one line rather than a paragraph. */
  const lifeLine = (l: ReportInput["productLines"][number]) => {
    const bits = [
      LIFECYCLE[l.lifecycle ?? ""] ?? null,
      SOLD_AS[l.soldAs ?? ""] ?? null,
      l.startYear > 1 ? `First sold in Year ${l.startYear}` : null,
    ].filter(Boolean);
    return bits.length ? bits.join(" · ") : null;
  };
  return {
    title: `What We Sell`,
    blocks: [para(COPY.whatWeSell(i.businessName, lower(i.noun.many)))],
    children: [
      { title: `The ${lower(i.noun.many)} we offer`,
        blocks: [
          { kind: "table",
            columns: [{ label: i.noun.head, width: 220 }, { label: `Average sale (${i.currency})`, numeric: true },
              { label: "Units in Year 1", numeric: true }, { label: `Year 1 revenue (${i.currency})`, numeric: true },
              { label: "Share of revenue", numeric: true }],
            rows: (() => {
              const total = i.productLines.reduce((a, l) => a + l.revenue, 0);
              return i.productLines.map((l) => [
                cell(l.name), num(i.money(l.averagePrice)), num(l.units ? String(l.units) : "—"),
                num(i.money(l.revenue)), num(pct(total > 0 ? (l.revenue / total) * 100 : null)),
              ]);
            })() },
        ] },
      i.services.length === 0 ? null : {
        title: "What each line earns",
        blocks: [
          para(COPY.margins(lower(i.noun.one))),
          { kind: "table",
            columns: [{ label: i.noun.head, width: 220 }, { label: `Revenue (${i.currency})`, numeric: true },
              { label: `Cost to deliver (${i.currency})`, numeric: true }, { label: `Gross profit (${i.currency})`, numeric: true }, { label: "Margin", numeric: true }],
            rows: i.services.map((s) => [
              cell(s.name), num(i.money(s.revenue)), num(i.money(s.cogs)), num(i.money(s.grossProfit)), num(pct(s.margin)),
            ]) },
          chartBlock(barsChart({
            title: `Margin by ${lower(i.noun.one)}`,
            note: "What share of each line's revenue survives the cost of delivering it. A line can earn a lot and keep little.",
            rows: i.services.filter((s2) => s2.margin !== null).map((s2) => ({ label: s2.name, value: s2.margin! })),
            money: (v) => `${v.toFixed(1)}%`,
          })),
          { kind: "note", text: COPY.marginsNote(lower(i.noun.one)) },
        ] },
      /*
       * EVERYTHING THE CLIENT TYPED ABOUT A LINE (§6.87). "What it is", "why they buy it, margin,
       * weaknesses" and "why this price" are three separate boxes on the Sales screen and all three were
       * collected and never printed. The last is the one a lender reads hardest — a price with a reason
       * behind it is a business decision; a price without one is a guess.
       */
      detail.length === 0 ? null : {
        title: "In detail",
        blocks: [para(COPY.inDetail(lower(i.noun.many)))],
        children: detail.map((l) => ({
          title: l.name,
          blocks: [
            ...(lifeLine(l) ? [{ kind: "lead" as const, text: lifeLine(l)! }] : []),
            ...(has(l.description) ? [para(l.description!.trim())] : []),
            ...(has(l.whyTheyBuy) ? [para(`${COPY.whyTheyBuy}: ${l.whyTheyBuy!.trim()}`)] : []),
            ...(has(l.pricingRationale) ? [{ kind: "note" as const, text: `${COPY.whyThisPrice}: ${l.pricingRationale!.trim()}` }] : []),
          ],
        })),
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// 4.0 The Market
// ---------------------------------------------------------------------------

export function theMarket(i: ReportInput): Draft {
  const segments: Draft = i.segments.length === 0 ? null : {
    title: "Who we sell to",
    blocks: [
      para(COPY.segments(i.businessName)),
      ...(i.segments.some((x) => (x.share ?? 0) > 0) ? [chartBlock(barsChart({
        title: "Share of sales by segment",
        note: "Which kind of buyer the revenue actually comes from.",
        rows: i.segments.filter((x) => (x.share ?? 0) > 0).map((x) => ({ label: x.name, value: x.share ?? 0 })),
        money: (v) => `${v}%`,
      }))] : []),
      { kind: "table",
        columns: [{ label: "Segment", width: 200 }, { label: "Who they are" }, { label: "What they care about" }, { label: "Share of sales", numeric: true }],
        rows: i.segments.map((s) => [
          cell(s.name), cell(s.profile ?? "—", { muted: !s.profile }),
          cell(s.caresAbout ?? "—", { muted: !s.caresAbout }),
          num(s.share === null ? "—" : `${s.share}%`),
        ]) },
    ],
  };

  /**
   * Research is BLOCKS, not subsections (§6.86). Each entry's first field is free text a client typed —
   * on Nic's own plan it is a sixty-word description of the method — and a free-text field used as a
   * numbered heading puts a paragraph in the contents page. A heading is a name; this is not one.
   */
  const evidence: Draft = i.evidence.length === 0 ? null : {
    title: "What we have checked",
    blocks: [
      para(COPY.evidence),
      ...i.evidence.flatMap((e) => [
        { kind: "lead" as const, text: e.source.trim() },
        ...(has(e.method) ? [para(`How we found out: ${e.method!.trim()}`)] : []),
        ...(has(e.finding) ? [para(e.finding!.trim())] : []),
        ...(has(e.decision) ? [{ kind: "note" as const, text: `What we are doing about it: ${e.decision!.trim()}` }] : []),
      ]),
    ],
  };

  const children = [
    written("How big the market is", i.market.size),
    written("Where demand is heading", i.market.trends),
    segments, evidence,
  ];
  return children.some(Boolean) ? { title: "The Market", children } : null;
}

// ---------------------------------------------------------------------------
// 5.0 The Competition
// ---------------------------------------------------------------------------

const REACH: Record<string, string> = { local: "Local", regional: "Regional", national: "National", online: "Online" };
const PRICING: Record<string, string> = { much_lower: "Much lower", lower: "A little lower", same: "About the same", higher: "A little higher", much_higher: "Much higher" };
const THREAT: Record<string, string> = { low: "Low", medium: "Medium", high: "High", critical: "Critical" };

export function theCompetition(i: ReportInput): Draft {
  const rivals = i.competitors.filter((c) => has(c.name));
  const table: Draft = rivals.length === 0 ? null : {
    title: "Who else a customer would consider",
    blocks: [
      para(COPY.competitors(i.businessName)),
      { kind: "table",
        columns: [{ label: "Competitor", width: 200 }, { label: "Type" }, { label: "Reach" }, { label: "Pricing vs us" }, { label: "Threat" }],
        rows: rivals.map((c) => [
          cell(c.name), cell(c.kind === "indirect" ? "Indirect" : "Direct"),
          cell(REACH[c.reach ?? ""] ?? "—", { muted: !c.reach }),
          cell(PRICING[c.pricing ?? ""] ?? "—", { muted: !c.pricing }),
          cell(THREAT[c.threat ?? ""] ?? "—", { bold: c.threat === "high" || c.threat === "critical" }),
        ]) },
    ],
    children: listOr(rivals.filter((c) => has(c.strengths) || has(c.weaknesses) || has(c.howWeWin)), (c) => ({
      title: c.name,
      blocks: [
        ...(has(c.strengths) ? [para(`What they do well: ${c.strengths!.trim()}`)] : []),
        ...(has(c.weaknesses) ? [para(`Where they are weak: ${c.weaknesses!.trim()}`)] : []),
        ...(has(c.howWeWin) ? [{ kind: "note" as const, text: `How we win: ${c.howWeWin!.trim()}` }] : []),
      ],
    })),
  };

  const children = [
    table,
    written("Why a customer picks us", i.position.ourAdvantage),
    written("What stops this being copied", i.position.barriers),
    written("What could change", i.position.futureThreats),
  ];
  return children.some(Boolean) ? { title: "The Competition", children } : null;
}

// ---------------------------------------------------------------------------
// 6.0 Marketing and Sales
// ---------------------------------------------------------------------------

export function marketingAndSales(i: ReportInput): Draft {
  const spend: Draft = i.spend.length === 0 ? null : {
    title: "Where the marketing money goes",
    blocks: [
      para(COPY.spend(i.businessName)),
      ...(i.spend.some((x) => x.budget > 0) ? [chartBlock(barsChart({
        title: "Marketing budget by kind",
        note: "Where the money to be found and chosen actually goes.",
        rows: i.spend.filter((x) => x.budget > 0).map((x) => ({ label: x.label, value: x.budget })), money: i.money,
      }))] : []),
      { kind: "table",
        columns: [{ label: "Kind", width: 200 }, { label: "Approach" }, { label: `Year 1 budget (${i.currency})`, numeric: true }],
        rows: i.spend.map((s) => [cell(s.label), cell(s.approach ?? "—", { muted: !s.approach }), num(i.money(s.budget))])
          .concat([[cell("Total", { bold: true }), cell(""), num(i.money(i.spend.reduce((a, s) => a + s.budget, 0)), { bold: true })]]) },
      { kind: "note", text: COPY.spendNote },
    ],
  };

  const brand = [
    written("How we want to be seen", i.market.positioning),
    written("What the business stands for", i.market.brandValues),
    written("How it sounds", i.market.brandPersonality),
    written("How it looks", i.market.visualIdentity),
  ];

  const children = [
    ...brand,
    spend,
    written(`How ${i.noun.aOne} is won`, i.market.salesProcess),
    written("Who sells, and what they need", i.market.salesTeam),
  ];
  return children.some(Boolean) ? { title: "Marketing and Sales", children } : null;
}

// ---------------------------------------------------------------------------
// 7.0 Our People
// ---------------------------------------------------------------------------

const KIND_LABEL: Record<string, string> = {
  responsibility: "Responsibilities", skill: "Skills", strength: "Strengths",
  expertise: "Expertise", licence: "Licences", education: "Education",
};

export function ourPeople(i: ReportInput): Draft {
  if (i.people.length === 0) return null;
  return {
    title: "Our People",
    blocks: [para(COPY.people(i.businessName))],
    children: [
      { title: "The team",
        blocks: [
          { kind: "table",
            columns: [{ label: "Name", width: 200 }, { label: "Position" }, { label: "Role" }, { label: "Share held", numeric: true }],
            rows: i.people.map((p) => [
              cell(p.name), cell(p.position ?? "—", { muted: !p.position }),
              cell(p.role ?? "—", { muted: !p.role }),
              num(p.share ? `${p.share}%` : "—"),
            ]) },
        ] },
      ...listOr(i.people.filter((p) => i.capabilities.some((c) => c.personId === p.id)), (p) => ({
        title: p.name,
        blocks: [
          ...(p.position ? [{ kind: "lead" as const, text: p.position }] : []),
          ...Object.keys(KIND_LABEL).flatMap((kind) => {
            const rows = i.capabilities.filter((c) => c.personId === p.id && c.kind === kind && has(c.description));
            if (!rows.length) return [];
            return [{ kind: "list" as const, items: rows.map((r) => `${KIND_LABEL[kind]}: ${r.description.trim()}`) }];
          }),
        ],
      })),
    ],
  };
}

// ---------------------------------------------------------------------------
// 8.0 How We Operate
// ---------------------------------------------------------------------------

const TENURE_LABEL: Record<string, string> = { owned: "Owned", leased: "Leased", shared: "Shared or serviced", none: "No fixed premises" };
const DEP_LABEL: Record<string, string> = { low: "Low", medium: "Medium", high: "High", critical: "Critical" };

export function howWeOperate(i: ReportInput): Draft {
  const o = i.operations;
  const premises: Draft = o.premises.length === 0 ? null : {
    title: "Where the work happens",
    blocks: [
      para(COPY.premises(i.businessName)),
      { kind: "table",
        columns: [{ label: "Place", width: 180 }, { label: "Address" }, { label: "Tenure" }, { label: "Size" }, { label: "What happens there" }],
        rows: o.premises.map((p) => [
          cell(p.isPrimary ? `${p.name} (main)` : p.name, { bold: p.isPrimary }),
          cell(p.address ?? "—", { muted: !p.address }),
          cell(TENURE_LABEL[p.tenure ?? ""] ?? "—", { muted: !p.tenure }),
          cell(p.floorArea ?? "—", { muted: !p.floorArea }),
          cell(p.purpose ?? "—", { muted: !p.purpose }),
        ]) },
    ],
  };

  const suppliers: Draft = o.suppliers.length === 0 ? null : {
    title: "Who we depend on",
    blocks: [
      para(COPY.suppliers(i.businessName)),
      { kind: "table",
        columns: [{ label: "Supplier", width: 180 }, { label: "What they supply" }, { label: "Terms" }, { label: "Dependency" }, { label: "If they stopped" }],
        rows: o.suppliers.map((s) => [
          cell(s.name), cell(s.supplies ?? "—", { muted: !s.supplies }),
          cell(s.terms ?? "—", { muted: !s.terms }),
          cell(DEP_LABEL[s.dependency ?? ""] ?? "—", { bold: s.dependency === "high" || s.dependency === "critical" }),
          cell(s.alternative ?? "—", { muted: !s.alternative }),
        ]) },
    ],
  };

  const steps: Draft = o.steps.length === 0 ? null : {
    title: "How the work gets done",
    blocks: [
      para(COPY.process(i.noun.one)),
      { kind: "table",
        columns: [{ label: "Step", width: 220 }, { label: "What happens" }, { label: "Who owns it" }, { label: "How long" }],
        rows: o.steps.map((s) => [
          cell(s.title), cell(s.detail ?? "—", { muted: !s.detail }),
          cell(s.owner ?? "—", { muted: !s.owner }), cell(s.duration ?? "—", { muted: !s.duration }),
        ]) },
    ],
  };

  const children = [
    premises, suppliers, steps,
    written("When the business operates", o.capacity.operatingHours),
    written("What we can deliver today", o.capacity.capacityNow),
    written("What limits it", o.capacity.capacityConstraint),
    written("How we lift it", o.capacity.capacityPlan),
    written("How we keep the quality up", o.capacity.qualityApproach),
  ];
  return children.some(Boolean) ? { title: "How We Operate", children } : null;
}

// ---------------------------------------------------------------------------
// 9.0 Risks and Mitigation
// ---------------------------------------------------------------------------

export function risksAndMitigation(i: ReportInput): Draft {
  const of = (q: string) => i.swot.filter((s) => s.quadrant === q && has(s.text));
  const strengths = of("strength"), weaknesses = of("weakness"), opportunities = of("opportunity"), threats = of("threat");
  if (!strengths.length && !weaknesses.length && !opportunities.length && !threats.length) return null;

  /**
   * The case FOR the business and the case against it are read differently, so they are shaped differently.
   * Strengths and opportunities are a list. Weaknesses and threats are a table with a second column for
   * what is being done — because a risk stated without a response is the one a lender remembers, and this
   * is the section where saying "nothing planned yet" out loud beats leaving a gap (§6.59).
   */
  const plain = (title: string, rows: typeof strengths, lead: string): Draft =>
    rows.length === 0 ? null : { title, blocks: [para(lead), { kind: "list", items: rows.map((r) => r.text.trim()) }] };

  const withResponse = (title: string, rows: typeof weaknesses, lead: string, head: string): Draft =>
    rows.length === 0 ? null : {
      title,
      blocks: [
        para(lead),
        { kind: "table", columns: [{ label: title.replace(/s$/, ""), width: 340 }, { label: head }],
          rows: rows.map((r) => [
            cell(r.text.trim()),
            has(r.response) ? cell(r.response!.trim()) : cell("Not yet addressed in this plan.", { muted: true }),
          ]) },
      ],
    };

  return {
    title: "Risks and Mitigation",
    blocks: [para(COPY.swot(i.businessName))],
    children: [
      plain("Strengths", strengths, COPY.strengths),
      plain("Opportunities", opportunities, COPY.opportunities),
      withResponse("Weaknesses", weaknesses, COPY.weaknesses, "What we are doing about it"),
      withResponse("Threats", threats, COPY.threats, "How we guard against it"),
    ],
  };
}

// ---------------------------------------------------------------------------
// 10.0 Goals and Milestones
// ---------------------------------------------------------------------------

const STATUS: Record<string, string> = { not_started: "Not started", in_progress: "In progress", done: "Done", at_risk: "At risk" };

export function goalsAndMilestones(i: ReportInput): Draft {
  if (i.goalsAnnual.length === 0 && i.goalsQuarterly.length === 0) return null;
  return {
    title: "Goals and Milestones",
    blocks: [para(COPY.goals(i.businessName))],
    children: [
      i.goalsAnnual.length === 0 ? null : {
        title: "What the year commits to",
        blocks: [
          { kind: "table", columns: [{ label: "Area", width: 160 }, { label: "Goal" }],
            rows: i.goalsAnnual.map((g) => [
              cell(g.area, { muted: true }),
              cell(has(g.detail) ? `${g.title.trim()} — ${g.detail!.trim()}` : g.title.trim()),
            ]) },
        ] },
      i.goalsQuarterly.length === 0 ? null : {
        title: "The quarters that get us there",
        blocks: [
          para(COPY.quarters),
          { kind: "table",
            columns: [{ label: "Quarter", width: 100 }, { label: "Goal" }, { label: "Area" }, { label: "Owner" }, { label: "Due" }, { label: "Status" }],
            rows: i.goalsQuarterly.map((g) => [
              cell(g.when ?? "—", { muted: !g.when }), cell(g.title.trim()),
              cell(g.area, { muted: true }), cell(g.owner ?? "—", { muted: !g.owner }),
              /* The date a commitment is due is the difference between a goal and a wish (§6.88). */
              cell(g.due ?? "—", { muted: !g.due }),
              cell(STATUS[g.status] ?? g.status, { muted: g.status === "not_started" }),
            ]) },
        ] },
    ],
  };
}

// ---------------------------------------------------------------------------
// Appendix — the accounts the forecast opens from
// ---------------------------------------------------------------------------

/**
 * WHERE THE PROJECTION STARTS (§6.87).
 *
 * A whole module's worth of typing — the client's own prior-period profit and loss and balance sheet —
 * reached the forecast's opening balances and NOTHING ELSE. The plan showed five projected years with no
 * statement of where year zero was, which is the first thing a lender with the accounts in front of them
 * checks. It is an appendix rather than a section because it is evidence, not argument.
 */
export function historicAppendix(i: ReportInput): Draft {
  const h = i.historic;
  if (!h || (h.pnl.length === 0 && h.balance.length === 0)) return null;
  const table = (rows: { label: string; value: number }[]) => ({
    kind: "table" as const,
    columns: [{ label: "", width: 300 }, { label: `${h.label} (${i.currency})`, numeric: true }],
    rows: rows.map((r) => [cell(r.label, { muted: true }), num(i.money(r.value))]),
  });
  return {
    title: "Appendix — historical accounts",
    blocks: [para(COPY.historic(i.businessName))],
    children: [
      h.pnl.length === 0 ? null : { title: "Historical profit and loss", blocks: [table(h.pnl)] },
      h.balance.length === 0 ? null : { title: "Historical balance sheet", blocks: [table(h.balance)] },
    ],
  };
}

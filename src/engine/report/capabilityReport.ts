import { cell, num, numberSections, type Block, type Draft, type ReportDoc } from "./blocks";
import { CARD_LABEL, DIAL_LABEL, INFO_MISSING, statusOf } from "@/engine/capability/model";
import { fixNotes, leverValue, type Tab, type TabRead } from "@/engine/capability/read";
import { readiness, type TimelineYear } from "@/engine/capability/timeline";
import type { TargetCheck } from "@/engine/capability/targets";
import { TAB_TITLE } from "@/engine/ai/briefing";

/**
 * THE PLANNER'S REPORT (§6.180) — Financial Capabilities, as a Word document under the firm's letterhead.
 *
 * Nic: "it would be better in a branded report for the consultant". Everything in it is already on the
 * Financial Capabilities page — the scores, the verdicts, the "In short" box, the stories, the fixes, the
 * tables and the cards — read through `readTab`, the same assembly the page draws. The only words that are
 * not on the page are the Planner's own: the briefing saved on each tab (§6.179), printed first under
 * "The Planner's view", because that is what the client came to read.
 *
 * THE TWO VIEWS NEVER MIX (§6.169). Each capability has its accounts section and its plan section, each
 * built from its own read. Nothing from the plan is printed under the accounts' heading.
 *
 * Pure: a set of reads and notes gives the same document every time, so the test can pin what a client
 * will be handed.
 */

export type ReportTab = {
  tab: Tab;
  /** Null for a business with no accounts in Historic. */
  actual: TabRead | null;
  plan: TabRead;
  briefings: { actual?: string | null; plan?: string | null };
};

export type CapabilityReportInput = {
  business: string;
  /** "Prepared by" — the firm, for a plan written by a coach, consultant or accounting firm. */
  firm: string | null;
  adviser: boolean;
  /** "September 2026" for the cover; "28 September 2026" for the notice page. */
  date: string;
  preparedOn: string;
  money: (v: number) => string;
  tabs: ReportTab[];
  timeline: TimelineYear[];
  targets: TargetCheck[];
};

const QUESTION: Record<Tab, string> = {
  grow: "Can the business afford to grow — does each extra dollar of sales pay its way, and is there cash to carry it?",
  borrow: "Could the business borrow — would a lender see enough profit and cash to cover the payments, even in a bad year?",
  sell: "Could the business be sold — and would a buyer pay the asking price for the profit it makes?",
};

const scoreText = (R: TabRead, tab: Tab) =>
  R.s.value === null ? "Not enough information yet" : `${R.s.value} out of 100${R.band ? ` — ${DIAL_LABEL[tab][R.band]}` : ""}`;

/* One paragraph per line: a numbered step the Planner put on its own line stays on its own line. */
const paragraphs = (text: string): Block[] =>
  text.replace(/\r\n/g, "\n").split("\n").map((p) => p.trim()).filter(Boolean).map((p) => ({ kind: "para", text: p }));

/** One view of one capability: the Planner's words first, then the figures behind them. */
function viewDraft(title: string, R: TabRead, tab: Tab, briefing: string | null | undefined, i: CapabilityReportInput): Draft {
  const f = R.fixes;
  const blocks: Block[] = [
    { kind: "facts", rows: [
      ["Score", scoreText(R, tab)],
      ["Verdict", R.v.headline],
      ...(R.s.value !== null && R.s.covered < R.s.total ? [["Based on", `${R.s.covered} of ${R.s.total} measures — the others need more information`] as [string, string]] : []),
      ...(R.capped.length ? [["Held down by", `${R.capped.join(" and ")} — a problem this big keeps the score below 50`] as [string, string]] : []),
    ] },
  ];

  if (briefing && briefing.trim()) {
    blocks.push({ kind: "lead", text: i.adviser ? "The Planner's view" : "Notes" }, ...paragraphs(briefing));
  }

  blocks.push(
    { kind: "lead", text: "What happened" }, { kind: "para", text: R.summary.happened },
    { kind: "lead", text: R.onActual ? "What it means" : "What the plan asks" }, { kind: "para", text: R.summary.asks },
    { kind: "lead", text: "Start with" }, { kind: "para", text: R.summary.talk },
  );

  if (f.story) blocks.push({ kind: "lead", text: "How it fits together" }, { kind: "para", text: f.story });

  if (f.levers.length) {
    blocks.push({ kind: "lead", text: "What to do, in order" },
      ...f.levers.map((l, n): Block => ({ kind: "para", text: `${n + 1}. ${l.label} (${leverValue(l, i.money)}). ${l.detail}` })));
  } else if (R.v.actions.length) {
    blocks.push({ kind: "lead", text: "What to do next" }, ...R.v.actions.map((a, n): Block => ({ kind: "para", text: `${n + 1}. ${a}` })));
  }

  if (f.table.length) {
    blocks.push({ kind: "lead", text: R.onActual ? `${f.year} with these fixes` : `${f.year} if the plan makes these fixes` }, {
      kind: "table",
      columns: [{ label: "Measure", width: 46 }, { label: "Now", numeric: true, width: 27 }, { label: "With the fixes", numeric: true, width: 27 }],
      rows: f.table.map((r) => [cell(r.label), num(r.now), num(r.after, { bold: r.better })]),
    });
  }
  for (const n of fixNotes(R, i.money)) blocks.push({ kind: "note", text: n });

  const shown = R.metrics.filter((m) => m.value !== null || m.missing);
  if (shown.length) {
    blocks.push({ kind: "lead", text: "The measures" }, {
      kind: "table",
      columns: [{ label: "Measure", width: 26 }, { label: "Reading", numeric: true, width: 16 }, { label: "Rating", width: 18 }, { label: "How to improve it", width: 40 }],
      rows: shown.map((m) => {
        const s = m.value === null || m.unscored ? null : statusOf(m.value, m.bands);
        return [
          cell(m.name, { bold: true }),
          num(m.value === null ? "—" : m.display, { muted: m.value === null }),
          /* The card's own words (§6.172): a loss year is "No earnings to measure", not a gap in the information. */
          cell(m.unscored ?? (m.value === null ? INFO_MISSING : s ? CARD_LABEL[tab][s] : "—"), { muted: !s }),
          cell(m.value === null ? (m.missing ?? "") : f.moves[m.key] ?? "", { muted: m.value === null }),
        ];
      }),
    });
  }
  return { title, blocks };
}

function atAGlance(i: CapabilityReportInput): Draft {
  const withActual = i.tabs.some((t) => t.actual);
  const a = i.tabs.find((t) => t.actual)?.actual ?? null;
  const p = i.tabs[0]?.plan;
  const blocks: Block[] = [
    { kind: "para", text: `Three questions about ${i.business}: could it afford to grow, could it borrow, and could it be sold. Each is scored out of 100 from the business's own figures${withActual ? " — first from its past accounts, then from its plan" : ", from its plan"}.` },
    { kind: "lead", text: "The three scores" },
    {
      kind: "table",
      columns: [
        { label: "Capability", width: withActual ? 30 : 40 },
        ...(withActual && a ? [{ label: `Accounts, ${a.span}`, width: 35 }] : []),
        ...(p ? [{ label: `Plan, ${p.span}`, width: withActual ? 35 : 60 }] : []),
      ],
      rows: i.tabs.map((t) => [
        cell(TAB_TITLE[t.tab], { bold: true }),
        ...(withActual ? [cell(t.actual ? scoreText(t.actual, t.tab) : "—")] : []),
        cell(scoreText(t.plan, t.tab)),
      ]),
    },
  ];

  if (i.timeline.length > 1) {
    const kinds: Tab[] = ["grow", "borrow", "sell"];
    blocks.push({ kind: "lead", text: "The scores, year by year of the plan" }, {
      kind: "table",
      columns: [{ label: "", width: 28 }, ...i.timeline.map((y) => ({ label: String(y.year), numeric: true, width: Math.floor(72 / i.timeline.length) }))],
      rows: kinds.map((k) => [cell(TAB_TITLE[k], { bold: true }), ...i.timeline.map((y) => num(y.scores[k] === null ? "—" : String(y.scores[k])))]),
    });
    blocks.push({ kind: "list", items: kinds.map((k) => {
      const r = readiness(i.timeline, k);
      const what = TAB_TITLE[k].replace("Capability to ", "");
      if (r.from === null && r.first === null) return `Not ready to ${what} within the plan's years.`;
      if (r.from === null) return `Ready to ${what} in ${r.first}, but it does not hold to the end of the plan.`;
      return `Ready to ${what} from ${r.from}${r.first !== null && r.first < r.from ? ` (first in ${r.first}, then slips in ${r.slips.join(", ")})` : ""}.`;
    }) });
    blocks.push({ kind: "note", text: "A score of 70 or more is ready. Each plan year is scored on its own." });
  }

  if (i.targets.length) {
    blocks.push({ kind: "lead", text: "The targets agreed, against the plan" }, {
      kind: "table",
      columns: [{ label: "Target", width: 30 }, { label: "The plan", width: 35 }, { label: "Result", width: 35 }],
      rows: i.targets.map((t) => [
        cell(t.target, { bold: true }), cell(t.plan),
        cell(t.met === null ? "No figure yet" : t.met ? "Met" : `Short${t.gap ? ` — ${t.gap}` : ""}`, { muted: t.met === null }),
      ]),
    });
  }
  return { title: "At a glance", blocks };
}

function stillNeeded(i: CapabilityReportInput): Draft {
  const seen = new Set<string>();
  const items: string[] = [];
  for (const t of i.tabs) for (const R of [t.actual, t.plan]) for (const m of R?.metrics ?? []) {
    /* Only what somebody can go and enter. A loss year is not missing information — it fills in with a profit. */
    if (m.value !== null || !m.missing || m.unscored) continue;
    const line = `${m.name}: ${m.missing}`;
    if (!seen.has(line)) { seen.add(line); items.push(line); }
  }
  if (!items.length) return null;
  return { title: "Information still needed", blocks: [
    { kind: "para", text: "These measures could not be worked out yet. Each one is left out of its score rather than counted as zero, so the scores above get fairer as these are filled in." },
    { kind: "list", items },
  ] };
}

export function capabilityReport(i: CapabilityReportInput): ReportDoc {
  const drafts: Draft[] = [
    atAGlance(i),
    ...i.tabs.map((t): Draft => ({
      title: TAB_TITLE[t.tab],
      blocks: [{ kind: "para", text: QUESTION[t.tab] }],
      children: [
        t.actual ? viewDraft(`From the accounts, ${t.actual.span}`, t.actual, t.tab, t.briefings.actual, i) : null,
        viewDraft(`From the plan, ${t.plan.span}`, t.plan, t.tab, t.briefings.plan, i),
      ],
    })),
    stillNeeded(i),
  ];

  const who = i.firm ?? "the Planner";
  return {
    businessName: i.business,
    subtitle: "Financial Capabilities",
    date: i.date,
    preparedOn: i.preparedOn,
    cover: {
      tagline: null,
      year: i.adviser ? "Planner's report" : "Report",
      contact: i.firm ? `Prepared by ${i.firm}` : null,
      address: null,
    },
    disclaimer: {
      title: "About this report",
      parts: [
        { heading: "What it is", body: `This report looks at three things about ${i.business}: whether it could afford to grow, whether it could borrow, and whether it could be sold. It is meant to be read with ${i.adviser ? who : "your adviser"}, as the start of a conversation.` },
        { heading: "Where the figures come from", body: `Every figure comes from the business's own accounts and its plan, as they stood on ${i.preparedOn}. If the accounts or the plan change, these figures change with them. The past accounts and the plan are kept in separate sections and are never mixed.` },
        ...(i.adviser ? [{ heading: "The Planner's view", body: `The notes headed "The Planner's view" are ${who}'s own words. They may have been drafted with the help of AI, and were read and saved by the Planner before this report was made.` }] : []),
        { heading: "Not financial advice", body: "This is general information to help plan the business. It is not financial, tax or legal advice, not an offer of finance, and not a valuation. A lender or a buyer will make their own assessment." },
      ],
    },
    sections: numberSections(drafts),
    omitted: [],
  };
}

/** A file name a Planner can find again: the client, what it is, and the month. */
export const capabilityReportFileName = (doc: ReportDoc) =>
  `${doc.businessName.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-")}-Financial-Capabilities-${doc.date.replace(/\s+/g, "-")}.docx`;

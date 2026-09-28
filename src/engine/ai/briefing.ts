import type { Message } from "./prompt";
import { CARD_LABEL, DIAL_LABEL, statusOf } from "@/engine/capability/model";
import { fixNotes, leverValue, type Tab, type TabRead } from "@/engine/capability/read";

/**
 * THE PLANNER'S BRIEFING (§6.179).
 *
 * A client-ready note about one Financial Capabilities tab, on one view, written from what that tab already
 * says: the score, the verdict, the "In short" box, the story, the fixes and every measure. Nothing else.
 *
 * THE MODEL IS HANDED THE PAGE, NOT THE PLAN. Every line of the fact sheet below is a sentence or a figure
 * the Planner can already see on the tab — built by `readTab`, the same function that draws the page. So a
 * note can only ever restate, order and explain what is on the screen; it cannot find a number the page
 * does not show, and `unknownFigures` checks that it did not make one up.
 *
 * THE ACTUAL VIEW NEVER MENTIONS THE PLAN (§6.169). Nic: "We are on the button 'Actual…' therefore no data
 * or comments should be about the projected year." The fact sheet for the Actual view holds only the
 * accounts, and the rules say so a second time, because a model that has never seen a projected year can
 * still invent one.
 *
 * GRADE 9 ENGLISH (§6.174). The same rule as every word on the page: short sentences, everyday words, and
 * any money term explained the first time it is used.
 */

export const TAB_TITLE: Record<Tab, string> = {
  grow: "Capability to grow",
  borrow: "Capability to borrow",
  sell: "Capability to sell",
};

const SYSTEM = (adviser: boolean, onActual: boolean) => [
  adviser
    ? "You write a short briefing note from a business adviser (the Planner) to the owner of a small business. It explains one part of the business's financial check-up. Write as the adviser, to the owner: say 'you' and 'your business'."
    : "You write a short briefing note for the owner of a small business. It explains one part of the business's financial check-up. Say 'you' and 'your business'.",
  "",
  "Rules:",
  "- Use ONLY the facts in the fact sheet. Never invent a figure, a year, a cause, a customer or a plan the sheet does not state.",
  "- Copy every figure exactly as the sheet writes it — same rounding, same currency sign. Do not work out new figures.",
  onActual
    ? "- This note is about the business's past accounts ONLY. Do not mention the plan, a forecast, a budget, projections or any future year. Only name the years the sheet names."
    : "- This note is about the plan. You may compare it with the last actual year when the sheet does.",
  "- Plain English a 15-year-old could follow. Short sentences. Everyday words. If you must use a money term (like 'cash flow' or 'margin'), explain it in a few words the first time.",
  "- No jargon, no hype, no 'leverage', 'synergy', 'robust', 'optimise', 'holistic'. No blame.",
  "- Plain text only. No markdown, no headings, no bold, no bullet symbols. Short paragraphs, separated by one blank line. You may number the steps '1.', '2.', '3.'.",
  "- No greeting and no sign-off — the Planner adds those.",
  "",
  "Shape, 180 to 320 words:",
  "1. Where things stand, in two or three sentences: the score and what it means.",
  "2. Why — how the main measures connect. Name the one or two that matter most.",
  "3. What to do, in order, with what each step is worth. Use the fixes in the sheet, in the sheet's order.",
  "4. If the sheet says the fixes still fall short, or that information is missing, say so plainly in one or two sentences.",
].join("\n");

const line = (label: string, text: string | null | undefined) => (text && text.trim() ? `${label}: ${text.trim()}` : null);

/**
 * The page, as text. Deterministic: the same read gives the same sheet, which is what the test pins and what
 * the figure check compares the note against.
 */
export function briefingSheet(R: TabRead, tab: Tab, money: (v: number) => string, business: string | null): string {
  const f = R.fixes;
  const band = R.band ? DIAL_LABEL[tab][R.band] : null;
  const measures = R.metrics.map((m) => {
    if (m.value === null) return `- ${m.name}: not worked out yet${m.missing ? ` — ${m.missing}` : ""}.`;
    if (m.unscored) return `- ${m.name}: ${m.unscored}.${m.note ? ` ${m.note}` : ""}`;
    const s = statusOf(m.value, m.bands);
    const move = f.moves[m.key];
    return [
      `- ${m.name}: ${m.display}${s ? ` (${CARD_LABEL[tab][s]})` : ""}${m.sub ? ` — ${m.sub}` : ""}.`,
      m.note ? `  ${m.note}` : null,
      move ? `  How to improve it: ${move}` : null,
    ].filter(Boolean).join("\n");
  });

  const blocks = [
    `TOPIC: ${TAB_TITLE[tab]}${business ? ` — ${business}` : ""}`,
    R.onActual
      ? `WHAT THIS COVERS: the business's past accounts, ${R.span}. Nothing from the plan.`
      : `WHAT THIS COVERS: the business plan, ${R.span}.`,
    `SCORE: ${R.s.value === null ? "not enough information to score yet" : `${R.s.value} out of 100${band ? ` — ${band}` : ""}`}${R.s.value !== null && R.s.covered < R.s.total ? ` (based on ${R.s.covered} of ${R.s.total} measures; the others need more information)` : ""}`,
    line("THE QUESTION", R.v.question),
    line("VERDICT", R.v.headline),
    R.capped.length ? `HELD DOWN BY: ${R.capped.join(" and ")} — a problem this big keeps the score below 50 however well the rest is going.` : null,
    ["IN SHORT:", line("What happened", R.summary.happened), line(R.onActual ? "What it means" : "What the plan asks", R.summary.asks), line("Start with", R.summary.talk)].filter(Boolean).join("\n"),
    line("HOW IT FITS TOGETHER", f.story),
    f.levers.length
      ? ["FIXES, IN ORDER:", ...f.levers.map((l, i) => `${i + 1}. ${l.label} (${leverValue(l, money)}). ${l.detail}${l.moves.length ? ` Improves: ${l.moves.join(", ")}.` : ""}`)].join("\n")
      : R.v.actions.length ? ["WHAT TO DO NEXT:", ...R.v.actions.map((a, i) => `${i + 1}. ${a}`)].join("\n") : null,
    f.table.length
      ? [`${f.year} ${R.onActual ? "WITH THESE FIXES" : "IF THE PLAN MAKES THESE FIXES"}:`, ...f.table.map((r) => `- ${r.label}: ${r.now} → ${r.after}`)].join("\n")
      : null,
    fixNotes(R, money).length ? ["WHERE THE FIXES FALL SHORT:", ...fixNotes(R, money)].join("\n") : null,
    ["THE MEASURES:", ...measures].join("\n"),
  ];
  return blocks.filter(Boolean).join("\n\n");
}

export function briefingMessages(sheet: string, o: { adviser: boolean; onActual: boolean }): Message[] {
  return [
    { role: "system", content: SYSTEM(o.adviser, o.onActual) },
    { role: "user", content: `FACT SHEET\n\n${sheet}\n\nWrite the briefing note now.` },
  ];
}

/**
 * EVERY FIGURE IN THE NOTE THAT IS NOT ON THE PAGE (§6.179).
 *
 * The rule not to invent is a request, not a constraint (§6.106.2). This is the check: each figure in the
 * note is compared, as a number, with the figures in the fact sheet. Anything left over is shown to the
 * Planner beside the Save button — usually a rounding ("about $90,000" for $89,802), sometimes a sum the
 * model did itself, occasionally a figure from nowhere. Small counts (a numbered step, "two measures") are
 * not figures and are let through.
 */
const FIGURE = /([$€£]\s?)?-?\d[\d,]*(\.\d+)?\s?(%|×|x\b|k\b|m\b|days?\b|times\b|months?\b|years?\b)?/gi;

function valueOf(tok: string): { n: number; money: boolean; unit: string } | null {
  const t = tok.trim();
  const money = /^[$€£]/.test(t);
  const unit = (t.match(/(%|×|x|k|m|days?|times|months?|years?)$/i)?.[1] ?? "").toLowerCase();
  const num = Number(t.replace(/[^\d.]/g, ""));
  if (!Number.isFinite(num)) return null;
  const n = unit === "k" ? num * 1000 : unit === "m" ? num * 1_000_000 : num;
  return { n, money, unit };
}

export function unknownFigures(note: string, sheet: string): string[] {
  const known = new Set<number>();
  for (const t of sheet.match(FIGURE) ?? []) {
    const v = valueOf(t);
    if (v) known.add(Math.round(v.n * 100) / 100);
  }
  const out: string[] = [];
  for (const raw of note.match(FIGURE) ?? []) {
    const tok = raw.trim().replace(/[.,]$/, "");
    const v = valueOf(tok);
    if (!v) continue;
    /* A step number, a count of measures, "one or two" written as digits — not a figure worth checking. */
    if (!v.money && !v.unit && v.n <= 12 && Number.isInteger(v.n)) continue;
    if (known.has(Math.round(v.n * 100) / 100)) continue;
    if (!out.includes(tok)) out.push(tok);
  }
  return out;
}

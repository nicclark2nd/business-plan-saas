"use client";

import { ModuleFrame, ModuleReadOnlyFooter } from "@/components/module/ModuleFrame";
import { Grid, Th, Td, Row as GridRow, Toolbar, Meta, Note } from "@/components/module/DataGrid";
import { StatTile, TileRow } from "@/components/chart/core";
import { GUIDED_STEPS, navGroup } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { walk, type Block, type ReportDoc, type Section } from "@/engine/report/blocks";
import { COPY } from "@/engine/report/content";

/**
 * The business plan, on screen (§6.83).
 *
 * This is one of two renderers over the same blocks — the other writes the Word file. Neither knows how a
 * figure was reached; both walk a structure the engine already built and tested. That is the whole point:
 * the plan a client reads here and the plan they send to a bank cannot say different things, because there
 * is only one plan and these are two ways of looking at it.
 *
 * It reads as a DOCUMENT, not as a module: serif-width measure, real headings, tables with rules. A client
 * is checking what a lender will see, so what they see is what a lender will see.
 */
/**
 * Derived, never typed (§6.84). Inserting Operations moved this from 15 to 16, and the hard-coded number
 * that was here would have quietly said "STEP 15 OF 15" on the sixteenth step.
 */
const STEP = GUIDED_STEPS.find((s) => s.id === "reports")?.step ?? 16;

export function ReportsModule({ planId, mode, doc, reconciled, missing }: {
  planId: string; mode: "guided" | "advanced"; doc: ReportDoc;
  reconciled: boolean;
  /** Steps with nothing in them yet — named so a client can go and fix them (§6.57). */
  missing: { label: string; id: string }[];
}) {
  const flat = walk(doc.sections);
  const tables = flat.reduce((a, s) => a + s.blocks.filter((b) => b.kind === "table").length, 0);

  return (
    <ModuleFrame
      step={STEP} total={GUIDED_STEPS.length} group={navGroup("reports")} title="Business plan"
      subtitle="What a lender reads, built from everything in this plan" mode={mode}
      areas={[{ key: "plan", label: "The plan", count: flat.length }]}
      area="plan" onArea={() => {}} scope={{ label: "This plan" }}
      footer={<ModuleReadOnlyFooter planId={planId} moduleId="reports" nextLabel="Done →" />}
      help={<>
        <h3>What this is</h3>
        <p>Every figure here is the same figure the statements show, from the same calculation. Nothing in this document is typed twice or worked out a second way, so it cannot disagree with the rest of the plan.</p>
        <p>A section with nothing behind it <b>does not appear</b>. An empty heading in a business plan is worse than a missing one — it tells a lender the business did not finish. What is missing is listed at the end instead, so you can see it and go and fix it.</p>
        <h3>Before you send it</h3>
        <p>The checks on <b>Review forecast</b> have to pass. If they do not, the figures in this document cannot be relied on and this screen says so at the top.</p>
      </>}
    >
      <TileRow>
        <StatTile label="Sections" value={String(doc.sections.length)} sub={`${flat.length} including subsections`} />
        <StatTile label="Tables" value={String(tables)} sub="Every one from the live forecast" />
        <StatTile label="Not yet included" value={String(missing.length)} tone={missing.length ? "warn" : "good"}
          sub={missing.length ? "Steps with nothing recorded" : "Every step has something in it"} />
        <StatTile label="Figures agree" value={reconciled ? "Yes" : "No"} tone={reconciled ? "good" : "bad"}
          sub={reconciled ? "The statements reconcile" : "Review forecast shows which check fails"} />
      </TileRow>

      {!reconciled && (
        <Note><span className="text-bad">The forecast has a check that is not balancing, so this plan cannot be relied on yet — <b>Review forecast</b> shows which.</span></Note>
      )}

      <Toolbar><Meta className="ml-0">
        <b>{doc.businessName}</b> · {doc.subtitle} · {doc.date}
      </Meta></Toolbar>

      {/* A document measure, not a module measure: a line of prose stops being readable past about 90 characters. */}
      <div className="mx-auto max-w-[900px] px-5 py-6">
        <div className="mb-8 border-b border-border pb-6">
          <div className="text-[28px] font-semibold leading-tight">{doc.businessName}</div>
          <div className="mt-1 text-[15px] text-muted-foreground">{doc.subtitle} · {doc.date}</div>
        </div>

        <div className="mb-8">
          <div className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">Contents</div>
          {flat.map((s) => (
            <div key={s.number} className={cn("flex gap-3 py-[3px] text-[13px]",
              s.number.endsWith(".0") ? "font-semibold" : "pl-6 text-muted-foreground")}>
              <span className="w-12 shrink-0 tabular-nums">{s.number}</span>
              <span>{s.title}</span>
            </div>
          ))}
        </div>

        {doc.sections.map((s) => <SectionView key={s.number} section={s} />)}

        {missing.length > 0 && (
          <div className="mt-10 border-t border-border pt-6">
            <h2 className="text-[17px] font-semibold">What is not in this plan</h2>
            <p className="mt-2 text-[13.5px] leading-relaxed">{COPY.omittedLead}</p>
            <ul className="mt-3 space-y-1">
              {missing.map((m) => (
                <li key={m.id} className="text-[13.5px] text-muted-foreground">
                  <b className="text-foreground">{m.label}</b> — nothing recorded yet.
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </ModuleFrame>
  );
}

function SectionView({ section }: { section: Section }) {
  const top = section.number.endsWith(".0");
  return (
    <section className={cn(top ? "mt-10 first:mt-0" : "mt-6")}>
      <h2 className={cn("flex gap-3", top ? "border-b border-border pb-1.5 text-[19px] font-semibold" : "text-[15px] font-semibold")}>
        <span className="tabular-nums text-muted-foreground">{section.number}</span>
        <span>{section.title}</span>
      </h2>
      {section.blocks.map((b, i) => <BlockView key={i} block={b} />)}
      {section.children.map((c) => <SectionView key={c.number} section={c} />)}
    </section>
  );
}

function BlockView({ block }: { block: Block }) {
  switch (block.kind) {
    case "para":
      return <p className="mt-3 text-[13.5px] leading-relaxed">{block.text}</p>;
    case "lead":
      return <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">{block.text}</p>;
    case "quote":
      return <blockquote className="mt-3 border-l-2 border-primary pl-4 text-[14px] italic leading-relaxed">{block.text}</blockquote>;
    case "note":
      return <p className="mt-2.5 text-[12.5px] leading-relaxed text-muted-foreground">{block.text}</p>;
    case "list":
      return (
        <ul className="mt-3 space-y-1.5">
          {block.items.map((t, i) => <li key={i} className="flex gap-2 text-[13.5px] leading-relaxed"><span className="text-muted-foreground">·</span><span>{t}</span></li>)}
        </ul>
      );
    case "facts":
      return (
        <div className="mt-3 overflow-x-auto"><Grid>
          <tbody>
            {block.rows.map(([k, v]) => (
              <GridRow key={k}>
                <Td className="w-[240px] text-muted-foreground">{k}</Td>
                <Td className="font-medium">{v}</Td>
              </GridRow>
            ))}
          </tbody>
        </Grid></div>
      );
    case "table":
      return (
        <div className="mt-3 overflow-x-auto"><Grid>
          <thead><tr>
            {block.columns.map((c, i) => (
              <Th key={i} right={c.numeric} style={c.width ? { width: c.width } : undefined}>{c.label}</Th>
            ))}
          </tr></thead>
          <tbody>
            {block.rows.map((row, i) => (
              <GridRow key={i}>
                {row.map((c, j) => (
                  <Td key={j} right={c.numeric} className={cn(c.numeric && "num", c.bold && "font-semibold", c.muted && "text-muted-foreground")}>
                    {c.text}
                  </Td>
                ))}
              </GridRow>
            ))}
          </tbody>
        </Grid></div>
      );
  }
}

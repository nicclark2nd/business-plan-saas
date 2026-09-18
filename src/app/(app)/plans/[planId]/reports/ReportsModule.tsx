"use client";

import { ModuleFrame, ModuleReadOnlyFooter } from "@/components/module/ModuleFrame";
import Image from "next/image";
import { Toolbar, Meta, Note } from "@/components/module/DataGrid";
import { PAGE_SIZE_LABEL, type PageSize } from "@/engine/report/pageSize";
import { StatTile, TileRow } from "@/components/chart/core";
import { GUIDED_STEPS, navGroup } from "@/lib/nav";
import { Button } from "@/components/ui/button";
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

export function ReportsModule({ planId, mode, doc, reconciled, missing, pageSize, printSalaries, logoUrl }: {
  planId: string; mode: "guided" | "advanced"; doc: ReportDoc;
  reconciled: boolean;
  /** Steps with nothing in them yet — named so a client can go and fix them (§6.57). */
  missing: { label: string; id: string }[];
  /**
   * How this plan prints (§6.93), SHOWN ON THE SCREEN THE DOWNLOAD HAPPENS ON.
   *
   * Both of these live in Plan settings, and a setting that changes what leaves the building must not be
   * invisible from the screen it changes. A client who cleared the salary toggle three weeks ago and cannot
   * see that from here is a client who does not know what is in the file they are about to email a bank.
   */
  pageSize: PageSize; printSalaries: boolean;
  /** A signed URL for the plan's logo, or null (§6.94). The screen shows what the Word file will carry. */
  logoUrl: string | null;
}) {
  const flat = walk(doc.sections);
  const tables = flat.reduce((a, s) => a + s.blocks.filter((b) => b.kind === "table").length, 0);

  return (
    <ModuleFrame
      step={STEP} total={GUIDED_STEPS.length} group={navGroup("reports")} title="Business plan"
      subtitle="What a lender reads, built from everything in this plan" mode={mode}
      areas={[{ key: "plan", label: "The plan", count: flat.length }]}
      area="plan" onArea={() => {}} scope={{ label: "This plan" }}
      /*
        * A plain link, not a button that fetches (§6.90). The browser saves files; asking React to hold a
        * 200KB document in memory first so it can hand it back to the browser buys nothing and can fail.
        */
      primaryAction={
        <Button size="sm" render={<a href={`/plans/${planId}/reports/download`} download />}>
          Download as Word
        </Button>
      }
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

      <Toolbar>
        <Meta className="ml-0"><b>{doc.businessName}</b> · {doc.subtitle} · {doc.date}</Meta>
        <span className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          {printSalaries
            ? "Leadership Team salaries print by name"
            : "Leadership Team salaries are left out — the total still prints"}
          · Word download on {PAGE_SIZE_LABEL[pageSize].split(" — ")[0]}
          <a href={`/plans/${planId}/settings?area=printing`} className="font-semibold text-primary hover:underline">Change</a>
        </span>
      </Toolbar>

      {/* A document measure, not a module measure: a line of prose stops being readable past about 90 characters. */}
      <div className="mx-auto max-w-[900px] px-5 py-6">
        {/*
          THE COVER (§6.96), to the placement Nic supplied and in the app's own type. Centred, and every
          line but the name and the title disappears when its field is empty — a blank line where a website
          should be reads as a fault; one line fewer reads as a decision.

          It is the same arrangement the .docx lays out, because the screen is what a client checks before
          they send the file (§6.90).
        */}
        <div className="mb-10 border-b border-border pb-10 text-center">
          {/* `unoptimized`: the URL is signed and short-lived, so there is nothing for an image CDN to cache. */}
          {logoUrl && <Image src={logoUrl} alt={`${doc.businessName} logo`} width={240} height={96} unoptimized
            className="mx-auto mb-7 max-h-[96px] w-auto object-contain" />}

          <div className="text-[22px] font-semibold leading-tight text-primary">{doc.businessName}</div>
          {/* As typed, not upper-cased (§6.96.1) — a strapline is the client's sentence, not the app's. */}
          {doc.cover.tagline && (
            <div className="mx-auto mt-2 max-w-[34em] text-[12.5px] tracking-[.04em] text-muted-foreground">{doc.cover.tagline}</div>
          )}

          <div className="mx-auto mt-10 h-px w-16 bg-primary" />
          <div className="mt-6 text-[44px] font-light leading-none tracking-tight">{doc.subtitle}</div>
          {doc.cover.year && (
            <div className="mt-4 text-[17px] font-semibold tracking-[.3em] text-primary">{doc.cover.year}</div>
          )}
          <div className="mt-3 text-[13px] text-muted-foreground">{doc.date}</div>

          {(doc.cover.contact || doc.cover.address) && (
            <>
              <div className="mx-auto mt-12 h-px w-10 bg-primary" />
              {doc.cover.contact && <div className="mt-4 text-[12.5px] text-muted-foreground">{doc.cover.contact}</div>}
              {doc.cover.address && <div className="mt-1 text-[12.5px] text-muted-foreground">{doc.cover.address}</div>}
            </>
          )}
        </div>

        {/*
          PAGE TWO ON SCREEN TOO (§6.95). The screen report is what a client reads before they download, so
          a page that exists only in the .docx would be a surprise in the file they send — the two have to
          be the same document (§6.90).
        */}
        <div className="mb-8 border-b border-border pb-6">
          <div className="mb-3 text-[13px] font-semibold uppercase tracking-[.06em] text-primary">{doc.disclaimer.title}</div>
          {doc.disclaimer.parts.map((part) => (
            <div key={part.heading} className="mb-3 last:mb-0">
              <div className="text-[13px] font-semibold">{part.heading}</div>
              <p className="mt-0.5 text-[12.5px] leading-[1.55] text-muted-foreground">{part.body}</p>
            </div>
          ))}
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

/**
 * A DOCUMENT TABLE, not a data grid (§6.92).
 *
 * The report was rendering its tables with the shared `Grid`, which carries `min-w-[900px]` — a floor that
 * exists so a full-width page grid's flexible column never collapses to nothing (§6.73.2). The document's
 * own measure is 900px, so every table was a hair wider than the page that holds it: each one grew its own
 * horizontal scrollbar and cut its right-hand column off.
 *
 * Nic, on his own plan: "a number of tables are not built correctly ... they have active sliders as the
 * table width is cut so it fits. The right column is not fully shown."
 *
 * The same lesson as §6.89, in a third place: **a constraint written for one context is not a fact about
 * every context.** A document table has no scrollbar — it fits the measure or it wraps. So the report has
 * its own table, which is `w-full` with no floor, lets text wrap, and keeps only the figures from wrapping.
 */
function DocTable({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-3">
      <table className="w-full border-collapse text-[12.5px]">{children}</table>
    </div>
  );
}

/** A px width in the model is a PROPORTION of the document measure, never a hard size. */
const DOC_MEASURE = 900;
const pctWidth = (w?: number) => (w ? { width: `${Math.min(60, Math.round((w / DOC_MEASURE) * 100))}%` } : undefined);

function DocCell({ children, numeric, className }: { children: React.ReactNode; numeric?: boolean; className?: string }) {
  return (
    <td className={cn("px-2 py-[7px] align-top leading-snug",
      /* Figures never wrap; words always may. A broken number is unreadable, a broken sentence is not. */
      numeric ? "whitespace-nowrap text-right tabular-nums" : "text-left",
      className)}>
      {children}
    </td>
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
    case "chart":
      /*
       * The SVG is inlined, not rasterised (§6.91). The screen has a browser and should use it — the PNG
       * exists for Word, which has no other way to draw. `alt` rides along as the accessible name so the
       * picture says the same thing to a screen reader that it says to an eye.
       */
      return (
        <figure className="mt-4">
          <figcaption className="text-[13px] font-semibold text-primary">{block.title}</figcaption>
          <div className="mt-1.5 w-full overflow-hidden" role="img" aria-label={block.alt}
            dangerouslySetInnerHTML={{ __html: block.svg.replace("<svg ", '<svg style="width:100%;height:auto" ') }} />
          {block.note && <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">{block.note}</p>}
        </figure>
      );
    case "list":
      return (
        <ul className="mt-3 space-y-1.5">
          {block.items.map((t, i) => <li key={i} className="flex gap-2 text-[13.5px] leading-relaxed"><span className="text-muted-foreground">·</span><span>{t}</span></li>)}
        </ul>
      );
    case "facts":
      return (
        <DocTable>
          <tbody>
            {block.rows.map(([k, v]) => (
              <tr key={k} className="border-b border-border last:border-b-0">
                <DocCell className="w-[38%] text-muted-foreground">{k}</DocCell>
                <DocCell className="font-medium">{v}</DocCell>
              </tr>
            ))}
          </tbody>
        </DocTable>
      );
    case "table":
      return (
        <DocTable>
          <thead>
            <tr className="border-b border-input">
              {block.columns.map((c, i) => (
                <th key={i} style={pctWidth(c.width)}
                  className={cn("px-2 py-1.5 align-bottom text-[10.5px] font-semibold uppercase tracking-[.04em] text-muted-foreground",
                    c.numeric ? "text-right" : "text-left")}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row, i) => (
              <tr key={i} className="border-b border-border last:border-b-0">
                {row.map((c, j) => (
                  <DocCell key={j} numeric={c.numeric}
                    className={cn(c.bold && "font-semibold", c.muted && "text-muted-foreground")}>
                    {c.text}
                  </DocCell>
                ))}
              </tr>
            ))}
          </tbody>
        </DocTable>
      );
  }
}

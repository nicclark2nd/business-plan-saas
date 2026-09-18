/**
 * The same plan, as a Word file (§6.90).
 *
 * This is the SECOND renderer over the blocks `buildReport` produces — the screen is the first. Neither
 * knows how a figure was reached and neither can drop or add a section, because both walk one structure.
 * That is the whole reason the report was built as data rather than as a template: the plan a client reads
 * on screen and the plan they send to a bank cannot say different things, because there is only one plan.
 *
 * Nothing here decides content. If this file is ever tempted to compute something, the answer is that the
 * computation belongs in `build.ts` where the screen gets it too.
 */
import {
  AlignmentType, BorderStyle, Document, Header, HeadingLevel, ImageRun, Packer, Paragraph,
  Table, TableCell, TableRow, TextRun, WidthType, type ISectionOptions,
} from "docx";
import type { Block, ReportDoc, Section } from "./blocks";
import { walk } from "./blocks";
import { rasterise } from "./rasterise";
import { PAGE_DIMENSIONS, type PageSize } from "./pageSize";
import { imageSize } from "./imageSize";

/** The plan's one accent. Everything else is black on white, because a bank prints in mono. */
const ACCENT = "1F3A5F";
const MUTED = "6B7280";
const RULE = { style: BorderStyle.SINGLE, size: 4, color: "D1D5DB" };

const text = (s: string, o: { bold?: boolean; italics?: boolean; color?: string; size?: number } = {}) =>
  new TextRun({ text: s, bold: o.bold, italics: o.italics, color: o.color, size: o.size ?? 20 });

/**
 * A chart, rasterised (§6.91). Word cannot draw an SVG the way a browser does, so the same SVG the screen
 * inlines is turned into a PNG here — one drawing, two renderings, never two drawings.
 *
 * Rendered at 2× and placed at 1×, so the picture is sharp on paper rather than on a 96dpi screen.
 */
function chartToDocx(b: Extract<Block, { kind: "chart" }>, pngs: Map<string, Buffer>): (Paragraph | Table)[] {
  const png = pngs.get(b.svg) ?? null;
  const width = 600, height = Math.round((b.height / 960) * 600);
  return [
    new Paragraph({ spacing: { before: 200, after: 60 }, children: [text(b.title, { bold: true, color: ACCENT, size: 20 })] }),
    new Paragraph({
      spacing: { after: b.note ? 60 : 200 },
      children: png
        ? [new ImageRun({ type: "png", data: png, transformation: { width, height }, altText: { name: b.title, title: b.title, description: b.alt } })]
        /* If the picture cannot be drawn the plan still says what it showed, rather than leaving a hole. */
        : [text(b.alt, { color: MUTED, size: 18 })],
    }),
    ...(b.note ? [new Paragraph({ spacing: { after: 200 }, children: [text(b.note, { color: MUTED, size: 17 })] })] : []),
  ];
}

function blockToDocx(b: Block, pngs: Map<string, Buffer>): (Paragraph | Table)[] {
  switch (b.kind) {
    case "para":
      return [new Paragraph({ children: [text(b.text)], spacing: { after: 160, line: 276 } })];
    case "lead":
      return [new Paragraph({ children: [text(b.text, { bold: true, color: ACCENT })], spacing: { before: 120, after: 80 } })];
    case "quote":
      return [new Paragraph({
        children: [text(b.text, { italics: true })],
        indent: { left: 340 }, border: { left: { ...RULE, size: 12, color: ACCENT, space: 12 } },
        spacing: { before: 120, after: 160, line: 276 },
      })];
    case "note":
      return [new Paragraph({ children: [text(b.text, { color: MUTED, size: 18 })], spacing: { after: 160, line: 264 } })];
    case "list":
      return b.items.map((t) => new Paragraph({
        children: [text(t)], bullet: { level: 0 }, spacing: { after: 60, line: 264 },
      }));
    case "facts":
      return [table(
        b.rows.map(([k, v]) => [
          { text: k, muted: true, width: 34 },
          { text: v, bold: true },
        ]),
        null,
      )];
    case "chart":
      return chartToDocx(b, pngs);
    case "table":
      return [table(
        b.rows.map((row) => row.map((c, i) => ({
          text: c.text, bold: c.bold, muted: c.muted, right: !!b.columns[i]?.numeric,
        }))),
        b.columns.map((c) => ({ text: c.label, right: !!c.numeric })),
      )];
  }
}

type DCell = { text: string; bold?: boolean; muted?: boolean; right?: boolean; width?: number };

/**
 * One table shape for the whole document.
 *
 * A header row when the block has one, a hairline under it, and nothing else — no shading, no banding, no
 * vertical rules. A five-year statement is read down its columns, and every line a designer adds across it
 * is one more thing between the reader and the figure.
 */
function table(rows: DCell[][], header: { text: string; right?: boolean }[] | null): Table {
  const cell = (c: DCell, isHeader = false) => new TableCell({
    width: c.width ? { size: c.width, type: WidthType.PERCENTAGE } : undefined,
    margins: { top: 60, bottom: 60, left: 80, right: 80 },
    borders: {
      top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      bottom: isHeader ? RULE : { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
    },
    children: [new Paragraph({
      alignment: c.right ? AlignmentType.RIGHT : AlignmentType.LEFT,
      spacing: { after: 0, line: 252 },
      children: [text(c.text, { bold: c.bold || isHeader, color: c.muted && !isHeader ? MUTED : undefined, size: 18 })],
    })],
  });
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      ...(header ? [new TableRow({ tableHeader: true, children: header.map((h) => cell({ text: h.text, right: h.right }, true)) })] : []),
      ...rows.map((r) => new TableRow({ children: r.map((c) => cell(c)) })),
    ],
  });
}

function sectionToDocx(s: Section, pngs: Map<string, Buffer>): (Paragraph | Table)[] {
  const top = s.number.endsWith(".0");
  return [
    new Paragraph({
      heading: top ? HeadingLevel.HEADING_1 : HeadingLevel.HEADING_2,
      /* A top-level section starts a page. A business plan a reader can flick through is worth the paper. */
      pageBreakBefore: top && s.number !== "1.0",
      spacing: { before: top ? 0 : 280, after: top ? 200 : 120 },
      border: top ? { bottom: { ...RULE, space: 6 } } : undefined,
      children: [
        text(`${s.number}  `, { bold: true, color: MUTED, size: top ? 28 : 22 }),
        text(s.title, { bold: true, color: ACCENT, size: top ? 28 : 22 }),
      ],
    }),
    ...s.blocks.flatMap((b) => blockToDocx(b, pngs)),
    ...s.children.flatMap((c) => sectionToDocx(c, pngs)),
  ];
}

/**
 * The plan's logo, already fetched (§6.94). The renderer takes BYTES rather than a path or a URL: it is a
 * pure function of what it is handed, and a document builder that goes and fetches things is a document
 * builder that can fail halfway through writing a file.
 */
export type DocxLogo = { data: Buffer; type: "png" | "jpg" };

export async function renderDocx(
  doc: ReportDoc, omitted: { label: string }[], pageSize: PageSize = "a4", logo?: DocxLogo | null,
): Promise<Buffer> {
  const flat = walk(doc.sections);

  /**
   * EVERY CHART IS DRAWN BEFORE THE DOCUMENT IS BUILT (§6.91). Rasterising is asynchronous — it loads a
   * native binary — and the document tree is built synchronously by design, because a tree-builder that
   * awaits is a tree-builder that can interleave. So the pictures are made first, keyed by the SVG that
   * produced them, and the builder only ever looks one up.
   */
  const charts = flat.flatMap((s) => s.blocks).filter((b): b is Extract<Block, { kind: "chart" }> => b.kind === "chart");
  const pngs = new Map<string, Buffer>();
  for (const c of charts) {
    const png = await rasterise(c.svg);
    if (png) pngs.set(c.svg, png);
  }

  /*
   * THE LOGO IS DRAWN TO A FIXED HEIGHT, NOT A FIXED WIDTH (§6.94).
   *
   * Logos are not one shape: a wordmark is wide and short, a roundel is square. Fixing the width makes a
   * tall logo enormous and a wide one tiny. Fixing the height and deriving the width from the file's own
   * aspect ratio makes every client's logo sit on the page as the same weight of mark, which is what a
   * letterhead is. `pngSize` reads the dimensions out of the file itself rather than trusting an upload.
   */
  const shape = logo ? imageSize(logo) : null;
  const scaled = (h: number) => ({ height: h, width: Math.round(h * (shape ? shape.width / shape.height : 3)) });

  const cover: (Paragraph | Table)[] = [
    ...(logo ? [new Paragraph({
      spacing: { before: 1600, after: 400 },
      children: [new ImageRun({
        type: logo.type === "jpg" ? "jpg" : "png", data: logo.data,
        transformation: scaled(110),
        altText: { name: "Logo", title: "Logo", description: `${doc.businessName} logo` },
      })],
    })] : []),
    new Paragraph({ spacing: { before: logo ? 0 : 2400 }, children: [text(doc.businessName, { bold: true, color: ACCENT, size: 56 })] }),
    new Paragraph({ spacing: { before: 120 }, children: [text(doc.subtitle, { size: 32, color: MUTED })] }),
    new Paragraph({ spacing: { before: 80, after: 2400 }, children: [text(doc.date, { size: 22, color: MUTED })] }),
    new Paragraph({
      spacing: { after: 160 }, pageBreakBefore: true,
      children: [text("Contents", { bold: true, color: ACCENT, size: 28 })],
    }),
    ...flat.map((s) => new Paragraph({
      spacing: { after: 40 },
      indent: { left: s.number.endsWith(".0") ? 0 : 340 },
      children: [
        text(`${s.number}`.padEnd(8, " "), { color: MUTED, size: 18 }),
        text(s.title, { bold: s.number.endsWith(".0"), size: 18 }),
      ],
    })),
  ];

  const tail: Paragraph[] = omitted.length === 0 ? [] : [
    new Paragraph({
      pageBreakBefore: true, spacing: { after: 160 },
      children: [text("What is not in this plan", { bold: true, color: ACCENT, size: 26 })],
    }),
    ...omitted.map((o) => new Paragraph({
      bullet: { level: 0 }, spacing: { after: 60 },
      children: [text(o.label, { bold: true }), text(" — nothing recorded yet.", { color: MUTED })],
    })),
  ];

  /*
   * THE PAGE SIZE IS SET, NOT INHERITED (§6.93).
   *
   * This said `margin` and nothing else, so the document took the `docx` library's own default — A4 portrait,
   * 11906 × 16838 twips. It was right for almost every plan and nobody had decided it: a plan written in
   * Dallas printed 210mm paper because of a dependency's default value. The margins stay 1134 twips (2cm) on
   * both papers; Letter is wider and shorter, and the tables are laid out in percentages, so they reflow.
   */
  /*
   * A HEADER ON EVERY PAGE BUT THE COVER. `titlePage` gives the section a separate first-page header, which
   * is left empty — the cover already carries the logo at full size, and a second copy of it an inch above
   * is what makes a document look automated.
   */
  const header = logo
    ? new Header({ children: [new Paragraph({
        alignment: AlignmentType.RIGHT, spacing: { after: 120 },
        children: [new ImageRun({
          type: logo.type === "jpg" ? "jpg" : "png", data: logo.data,
          transformation: scaled(26),
          altText: { name: "Logo", title: "Logo", description: `${doc.businessName} logo` },
        })],
      })] })
    : undefined;

  const section: ISectionOptions = {
    properties: {
      page: { size: PAGE_DIMENSIONS[pageSize], margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } },
      ...(header ? { titlePage: true } : {}),
    },
    ...(header ? { headers: { default: header, first: new Header({ children: [new Paragraph({ children: [] })] }) } } : {}),
    footers: undefined,
    children: [...cover, ...doc.sections.flatMap((s) => sectionToDocx(s, pngs)), ...tail],
  };

  const document = new Document({
    creator: doc.businessName,
    title: `${doc.businessName} — ${doc.subtitle}`,
    description: `${doc.subtitle} for ${doc.businessName}, ${doc.date}`,
    styles: {
      default: {
        document: { run: { font: "Calibri", size: 20, color: "111827" }, paragraph: { spacing: { line: 276 } } },
      },
    },
    sections: [section],
  });
  return Packer.toBuffer(document);
}

/** A file name a client can find again in a downloads folder six months from now. */
export const docxFileName = (doc: ReportDoc) =>
  `${doc.businessName.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-")}-Business-Plan-${doc.date.replace(/\s+/g, "-")}.docx`;

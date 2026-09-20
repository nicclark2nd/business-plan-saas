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
  AlignmentType, BorderStyle, Document, Footer, Header, HeadingLevel, ImageRun,
  PageNumber, Packer, Paragraph,
  Table, TableCell, TableOfContents, TableRow, TextRun, WidthType, type ISectionOptions,
} from "docx";
import type { Block, ReportDoc, Section } from "./blocks";
import { walk } from "./blocks";
import { rasterise } from "./rasterise";
import { PAGE_DIMENSIONS, type PageSize } from "./pageSize";
import { imageSize } from "./imageSize";
import { PLAN_STYLES, S, PAGE_BREAK_STYLES, ACCENT, MUTED, HAIRLINE } from "./docxStyles";
import { applyStylePageBreaks } from "./docxPatch";
import { COPY } from "./content";

const RULE = { style: BorderStyle.SINGLE, size: 4, color: HAIRLINE };

/**
 * A run of text (§6.107.3).
 *
 * `size` IS LEFT UNSET UNLESS A CALLER GIVES ONE, and that is the whole point of this comment.
 *
 * It used to read `size: o.size ?? 20`, so every run in the document carried a hard 10pt. Direct formatting
 * beats a paragraph style, so every font size in `docxStyles.ts` was decorative: the cover's 36pt title
 * rendered at 10pt, and had since §6.90 built the first Word file. §6.97 argued at length that a heading
 * must be a STYLE rather than direct formatting, and then this line overrode every style in the document.
 *
 * Unset, a run inherits its paragraph's style, and a style-less paragraph inherits the document default —
 * which is 10pt, set once in `PLAN_STYLES.default.document`. Same body text, styles that finally work.
 */
const text = (s: string, o: { bold?: boolean; italics?: boolean; color?: string; size?: number } = {}) =>
  new TextRun({ text: s, bold: o.bold, italics: o.italics, color: o.color, size: o.size });

/**
 * A chart, rasterised (§6.91). Word cannot draw an SVG the way a browser does, so the same SVG the screen
 * inlines is turned into a PNG here — one drawing, two renderings, never two drawings.
 *
 * Rendered at 2× and placed at 1×, so the picture is sharp on paper rather than on a 96dpi screen.
 */
function chartToDocx(b: Extract<Block, { kind: "chart" }>, pngs: Map<string, Buffer>): (Paragraph | Table)[] {
  const png = pngs.get(b.svg) ?? null;
  const width = 600, height = Math.round((b.height / 960) * 600);
  /*
   * TITLE, PICTURE, NOTE — one thing, and now held together as one (§6.97). Each carries a named style
   * whose `keepNext` binds it to the next, so Word can no longer leave "Margin by service" alone at the
   * foot of a page with its chart overleaf.
   */
  return [
    new Paragraph({ style: S.figureTitle, children: [text(b.title)] }),
    new Paragraph({
      style: S.figure,
      children: png
        ? [new ImageRun({ type: "png", data: png, transformation: { width, height }, altText: { name: b.title, title: b.title, description: b.alt } })]
        /* If the picture cannot be drawn the plan still says what it showed, rather than leaving a hole. */
        : [text(b.alt, { color: MUTED, size: 18 })],
    }),
    ...(b.note ? [new Paragraph({ style: S.figureNote, children: [text(b.note)] })] : []),
  ];
}

/**
 * `holdNext` is set when the NEXT block is a table, a chart or a facts grid (§6.97).
 *
 * A style cannot know this: "keep with what follows" is right for a sentence introducing a table and wrong
 * for the last sentence of a section, and the difference is not in the paragraph, it is in what comes after
 * it. So the look-ahead happens where the blocks are in order, and nowhere else.
 */
function blockToDocx(b: Block, pngs: Map<string, Buffer>, holdNext = false): (Paragraph | Table)[] {
  switch (b.kind) {
    case "para":
      return [new Paragraph({ style: S.body, children: [text(b.text)], keepNext: holdNext, keepLines: holdNext })];
    case "lead":
      return [new Paragraph({ style: S.lead, children: [text(b.text)] })];
    case "quote":
      return [new Paragraph({ style: S.quote, children: [text(b.text)] })];
    case "note":
      return [new Paragraph({ style: S.note, children: [text(b.text)], keepNext: holdNext })];
    case "list":
      return b.items.map((t) => new Paragraph({ style: S.bullet, children: [text(t)], bullet: { level: 0 } }));
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
      style: isHeader ? S.tableHeading : S.tableCell,
      alignment: c.right ? AlignmentType.RIGHT : AlignmentType.LEFT,
      children: [text(c.text, { bold: c.bold || isHeader, color: c.muted && !isHeader ? MUTED : undefined, size: 18 })],
    })],
  });
  /*
   * `cantSplit` on every row (§6.97). A five-year figure and its label torn across a page break is the same
   * fault as a stranded heading, one row further down, and it is the one the reader is most likely to
   * misread — the numbers are still there, but not beside the thing they measure.
   *
   * `tableHeader` was already set: it repeats the column headings at the top of each continued page.
   */
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      ...(header ? [new TableRow({ tableHeader: true, cantSplit: true, children: header.map((h) => cell({ text: h.text, right: h.right }, true)) })] : []),
      ...rows.map((r) => new TableRow({ cantSplit: true, children: r.map((c) => cell(c)) })),
    ],
  });
}

/** What a paragraph must not be separated from: anything a reader has to see WITH it (§6.97). */
const HOLDS_ON = new Set<Block["kind"]>(["table", "chart", "facts"]);

/** 2cm, in twips. One constant, named because the page margin is referred to in more than one place. */
const MARGIN = 1134;

/**
 * How far the foot of each page's footer sits above the bottom edge (§6.107.4).
 *
 * The cover's is higher, because its contact block is part of the design rather than a page number. Both
 * were measured against the cover Nic built, by rendering the file and looking at where the lines landed.
 */
const COVER_FOOT = 1566;
const PAGE_FOOT = 708;

function sectionToDocx(s: Section, pngs: Map<string, Buffer>): (Paragraph | Table)[] {
  const top = s.number.endsWith(".0");
  /*
   * EVERY top-level section starts a page, 1.0 included (§6.97.2) — a rule that now lives on `Heading1`
   * itself (§6.107.1), so it applies to every section by definition rather than by a style being chosen
   * correctly at each heading. The Executive Summary was once the single exemption, and nothing went back
   * to check it.
   */
  return [
    new Paragraph({
      /*
       * A NAMED STYLE, not bold-and-blue (§6.97). `heading` alone made it look like a heading; the style is
       * what makes Word treat it as one — keep-with-next, keep-lines-together, the page break and a place
       * in the navigation pane, all set once rather than on 1,613 paragraphs.
       *
       * THE PAGE BREAK IS NOT SET HERE (§6.97.1). `PlanSectionNewPage` carries it, added to the stylesheet
       * after packing because the library's type will not express it. Setting it on the paragraph as well
       * would be direct formatting overriding the style, and a client who cleared the checkbox would find
       * the breaks still there.
       */
      /*
       * HEADING 1 AND HEADING 2, NOT A STYLE OF OUR OWN (§6.107.1).
       *
       * The paragraph used to carry BOTH a custom style and a heading level, and the custom style won — so
       * the document looked structured and was not. Insert → Table of Contents found nothing, the
       * navigation pane was empty, and the contents page was a list this app had drawn by hand.
       *
       * No bookmarks either: a TOC field finds its own headings and works out its own page numbers, which
       * is the entire reason to use one.
       */
      heading: top ? HeadingLevel.HEADING_1 : HeadingLevel.HEADING_2,
      /* Two colours in one heading is a per-run decision. The SIZE is the style's, and saying it again
         here is what stopped the style from having any effect (§6.107.3). */
      children: [
        text(`${s.number}  `, { bold: true, color: MUTED }),
        text(s.title, { bold: true, color: ACCENT }),
      ],
    }),
    ...s.blocks.flatMap((b, i) => blockToDocx(b, pngs, HOLDS_ON.has(s.blocks[i + 1]?.kind))),
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

  /*
   * THE COVER (§6.96), to the placement Nic supplied, in the app's own type rather than the example's
   * display serif — his call: "the attached example was more for the placement".
   *
   * CENTRED, and every line optional but the name and the title. A cover that prints a blank where a
   * website should be looks like a fault; one line fewer looks like a decision.
   *
   * The rule under the tagline and the one above the contact block are a paragraph border rather than a
   * drawn line, because a border scales with the page and a fixed-width line does not — Letter is wider
   * than A4 (§6.93) and a hard-coded rule would sit off-centre on one of them.
   */
  const styled = (style: string, children: TextRun[], o: { before?: number; after?: number } = {}) =>
    new Paragraph({ style, spacing: { before: o.before, after: o.after }, children });
  const goldRule = (before: number, after: number) =>
    new Paragraph({ style: S.coverRule, spacing: { before, after }, children: [text("\u00a0")] });

  const c = doc.cover;
  const cover: (Paragraph | Table)[] = [
    ...(logo ? [new Paragraph({
      alignment: AlignmentType.CENTER,
      /* 400 above, 360 below (§6.107.2) — his numbers. It was 1400, which pushed the mark down the page. */
      spacing: { before: 1225, after: 360 },
      children: [new ImageRun({
        type: logo.type === "jpg" ? "jpg" : "png", data: logo.data,
        transformation: scaled(110),
        altText: { name: "Logo", title: "Logo", description: `${doc.businessName} logo` },
      })],
    })] : []),
    /*
     * No drop above the name when there is a logo: the logo's own 360 below it is the gap (§6.107.2).
     * Without a logo the cover still needs the name off the top edge, and 2200 is where it sat before.
     */
    styled(S.coverName, [text(doc.businessName)], { before: logo ? 674 : 2200 }),
    ...(c.tagline
      /*
       * PRINTED AS TYPED (§6.96.1). This upper-cased it, because the example's tagline was two words —
       * "CONCRETING & CIVIL WORKS" — and small caps looked right. The first real one was a sentence:
       * "Quality Work, Honest Value, and a Partnership You Can Trust." In forced caps at that tracking it
       * shouted, wrapped to two lines and lost its own punctuation's rhythm.
       *
       * A client who wants caps can type caps. Deciding the case of somebody's own strapline is the app
       * having an opinion about their words (§6.87), and the tracking came down with it.
       */
      ? [new Paragraph({ style: S.coverTagline, children: [new TextRun({ text: c.tagline, characterSpacing: 16 })] })]
      : []),

    goldRule(760, 520),
    styled(S.coverTitle, [text(doc.subtitle)], { before: 724 }),
    ...(c.year
      ? [new Paragraph({ style: S.coverYear, children: [new TextRun({ text: c.year, characterSpacing: 80 })] })]
      : []),
    styled(S.coverDetail, [text(doc.date)], { before: 240 }),


  ];

  /*
   * EVERYTHING AFTER THE COVER (§6.107.4), which is a SECTION of its own.
   *
   * The cover needs its contact block at a fixed height above the foot of the page, and every other page
   * needs its number near the bottom edge. Those are two different footer distances, and a Word section
   * holds exactly one — so the cover gets a section to itself. It also gets no header, which is what
   * `titlePage` was faking before.
   */
  const frontMatter: (Paragraph | Table)[] = [
    /*
     * PAGE TWO (§6.95): the confidentiality statement, between the cover and the contents.
     *
     * `pageBreakBefore` on its title and again on "Contents" is what makes it a page of its own rather than
     * something that lands wherever the text happens to reach. It is deliberately NOT a numbered section —
     * a legal notice does not belong in a list of what the business does, and numbering it would push the
     * Executive Summary to 2.0.
     */
    new Paragraph({ style: S.noticeTitle, children: [text(doc.disclaimer.title.toUpperCase())] }),
    ...doc.disclaimer.parts.flatMap((part) => [
      new Paragraph({ style: S.noticeHeading, children: [text(part.heading)] }),
      /* Smaller than body text and a touch grey: it is a notice to be read once, not the plan itself. */
      new Paragraph({ style: S.noticeBody, children: [text(part.body)] }),
    ]),

    /* Which copy this is (§6.102). The foot of the notice page, not the cover. */
    new Paragraph({ style: S.noticePrepared, children: [text(COPY.preparedOn(doc.preparedOn))] }),

    new Paragraph({ style: S.contentsTitle, children: [text("Contents")] }),
    /*
     * THE CONTENTS WORD BUILDS FOR ITSELF (§6.107.1).
     *
     * A TOC field over Heading 1 and 2. It was a list of paragraphs this app wrote out, with the numbers
     * either absent or, once PAGEREF fields were added, a column of 1s — and worse than either, it was
     * DEAD: a reader who inserted a page, or edited a heading, had a contents page that quietly stopped
     * being true and no way to refresh it short of deleting the thing and starting again.
     *
     * > **A TABLE OF CONTENTS THAT CANNOT REBUILD ITSELF IS A PICTURE OF A TABLE OF CONTENTS.**
     *
     * Word now owns it: F9 rebuilds it, inserted material renumbers it, the entries are links, and a client
     * who prefers one of Word's own formats can replace it with a command they already know.
     */
    new TableOfContents("Contents", {
      /*
       * THE SAME FOUR SWITCHES WORD ITSELF WRITES (§6.107.5): \o "1-2" \h \z \u.
       *
       * `\h` makes the entries links, `\z` hides the tab and page number in web view, and `\u` tells the
       * field to use each paragraph's applied outline level. None of them is exotic — they are what Insert →
       * Table of Contents produces — and matching it exactly removes one more way for this field to behave
       * differently in somebody's Word than in ours.
       */
      hyperlink: true,
      headingStyleRange: "1-2",
      hideTabAndPageNumbersInWebView: true,
      useAppliedParagraphOutlineLevel: true,
    }),
  ];

  const tail: Paragraph[] = omitted.length === 0 ? [] : [
    new Paragraph({ style: S.contentsTitle, children: [text("What is not in this plan", { size: 26 })] }),
    ...omitted.map((o) => new Paragraph({
      style: S.bullet, bullet: { level: 0 },
      children: [text(o.label, { bold: true }), text(" \u2014 nothing recorded yet.", { color: MUTED })],
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

  /*
   * A PAGE NUMBER ON EVERY PAGE BUT THE COVER (§6.107).
   *
   * "Page 4 of 27" rather than a bare 4, because a plan is read on paper as often as on a screen and a
   * reader who has dropped it needs to know whether they are holding all of it.
   *
   * The cover is page 1 and carries no footer, which is why `titlePage` is now set for every plan rather
   * than only for one with a logo: the first page needs its own header AND its own footer, and a cover with
   * "Page 1 of 27" across the bottom is not a cover.
   */
  const footer = new Footer({ children: [new Paragraph({
    style: S.pageNumber,
    alignment: AlignmentType.RIGHT,
    children: [new TextRun({ children: ["Page ", PageNumber.CURRENT, " of ", PageNumber.TOTAL_PAGES] })],
  })] });

  /*
   * THE FOOT OF THE COVER IS A FOOTER (§6.107.4).
   *
   * The rule and the contact line used to sit at the end of the cover's text, held down by a stack of
   * paragraph spacing. That put them at the mercy of everything above: a taller logo, a tagline that wraps
   * to two lines, a plan with no logo at all — each moved them, and no fixed gap could be right for all of
   * them.
   *
   * > A FOOTER IS MEASURED FROM THE BOTTOM OF THE PAGE. Nothing above it can push it anywhere.
   */
  const coverFoot = new Footer({ children: [
    new Paragraph({ style: S.coverRule, spacing: { after: 236 }, children: [text("\u00a0")] }),
    ...(c.contact ? [new Paragraph({ style: S.coverDetail, children: [text(c.contact)] })] : []),
    ...(c.address ? [new Paragraph({ style: S.coverDetail, children: [text(c.address)] })] : []),
  ] });

  const page = (footerDistance: number) => ({
    size: PAGE_DIMENSIONS[pageSize],
    /* `footer` is the distance from the bottom edge of the page to the footer (§6.107.4). */
    margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN, footer: footerDistance },
  });

  /* The cover: no header, no page number, and its contact block held at a fixed height off the foot. */
  const coverSection: ISectionOptions = {
    properties: { page: page(COVER_FOOT) },
    footers: { default: coverFoot },
    children: cover,
  };

  /* Everything else: the logo in the header, the page number where a page number goes. */
  const bodySection: ISectionOptions = {
    properties: { page: page(PAGE_FOOT) },
    ...(header ? { headers: { default: header } } : {}),
    footers: { default: footer },
    children: [...frontMatter, ...doc.sections.flatMap((s) => sectionToDocx(s, pngs)), ...tail],
  };

  const document = new Document({
    creator: doc.businessName,
    title: `${doc.businessName} — ${doc.subtitle}`,
    description: `${doc.subtitle} for ${doc.businessName}, ${doc.date}`,
    /* Every named style the plan uses, and the pagination rules that hang off them (§6.97). */
    styles: PLAN_STYLES,
    /*
     * ASK WORD TO WORK THE FIELDS OUT ON OPEN (§6.107). The contents' page numbers are PAGEREF fields and a
     * field that has never been calculated shows its placeholder. Without this a client opens their plan to
     * a contents page of ones.
     */
    features: { updateFields: true },
    sections: [coverSection, bodySection],
  });
  /* The one pagination rule the library cannot put on a style, put there anyway (§6.97.1). */
  return applyStylePageBreaks(await Packer.toBuffer(document), PAGE_BREAK_STYLES);
}

/** A file name a client can find again in a downloads folder six months from now. */
export const docxFileName = (doc: ReportDoc) =>
  `${doc.businessName.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-")}-Business-Plan-${doc.date.replace(/\s+/g, "-")}.docx`;

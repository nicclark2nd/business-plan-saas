/**
 * The Word document's named styles (§6.97).
 *
 * WHY THIS FILE EXISTS. Every paragraph in the plan was direct-formatted — "Normal, plus bold, plus this
 * colour, plus that size" — so 1,613 paragraphs carried 91 styles between them and the rest were Normal
 * wearing make-up. Nic, reading the output in Word: *"This could be a style problem... If you more
 * effectively use styles, you can tell that style to Keep with next and Page break before."*
 *
 * He is right, and the consequence was visible on nearly every chart in the document: a bold line reading
 * "Margin by service" alone at the foot of one page and the chart it titles at the top of the next.
 *
 * > **DIRECT FORMATTING HAS NOWHERE TO PUT A RULE.** Bold-and-blue makes a paragraph LOOK like a heading;
 * > only a style makes Word TREAT it as one. Keep-with-next, keep-lines-together and page-break-before are
 * > properties of a style, and a document with no styles has nowhere to hang them.
 *
 * The second reason is his, not the renderer's: a client who opens this file can select "Plan Figure Title"
 * in Word's Styles pane and change every chart title in the plan at once. Direct formatting makes that a
 * find-and-replace through ninety pages.
 *
 * ONE PLACE. The sizes and colours live here now rather than beside each `new Paragraph`, so a heading
 * cannot be 22 half-points in one branch of the renderer and 20 in another (§6.19).
 *
 * ONE PROPERTY THAT CANNOT LIVE HERE, and it is worth naming because it is the other half of what Nic
 * asked for. This version of the `docx` library accepts `keepNext`, `keepLines` and `outlineLevel` on a
 * paragraph STYLE, but not `pageBreakBefore` or `widowControl` — those are paragraph-only. So "start each
 * section on a new page" is still set on the paragraph, and a client who wants the plan to run continuously
 * cannot turn it off by editing one style. `PlanSectionNewPage` exists anyway, so the intent is legible in
 * the document and the property has somewhere to move to the day the library allows it.
 */
import { AlignmentType, BorderStyle, type IStylesOptions } from "docx";

export const ACCENT = "1F3A5F";
export const MUTED = "6B7280";
export const INK = "111827";
export const HAIRLINE = "D1D5DB";

/**
 * Every style the plan uses, and what each is FOR — the name is what a client sees in Word, so it says the
 * job rather than the appearance ("Plan Figure Title", not "Blue Bold 11").
 */
export const S = {
  body: "PlanBody",
  lead: "PlanLead",
  quote: "PlanQuote",
  note: "PlanNote",
  bullet: "PlanBullet",
  figureTitle: "PlanFigureTitle",
  figure: "PlanFigure",
  figureNote: "PlanFigureNote",
  tableCell: "PlanTableCell",
  tableHeading: "PlanTableHeading",
  noticeTitle: "PlanNoticeTitle",
  noticeHeading: "PlanNoticeHeading",
  noticeBody: "PlanNoticeBody",
  noticePrepared: "PlanNoticePrepared",
  pageNumber: "PlanPageNumber",
  contentsTitle: "PlanContentsTitle",
  contentsEntry: "PlanContentsEntry",
  coverName: "PlanCoverName",
  coverTagline: "PlanCoverTagline",
  coverTitle: "PlanCoverTitle",
  coverYear: "PlanCoverYear",
  coverDetail: "PlanCoverDetail",
  coverRule: "PlanCoverRule",
} as const;

/**
 * The styles that start a new page (§6.97.1).
 *
 * Named here rather than in the renderer because it is a fact about the STYLES — which of them begin a page
 * — and because the list is what `applyStylePageBreaks` patches into the stylesheet after packing. One
 * place: a style added to this list gets the break, and nothing else has to be told.
 */
/**
 * Styles that start a new page (§6.97.1, §6.107.1).
 *
 * `Heading1` rather than a style of our own: every top-level section starts a page, and a client who wants
 * the plan to run continuously clears one checkbox on a style their Word already knows the name of.
 */
export const PAGE_BREAK_STYLES: readonly string[] = ["Heading1", S.contentsTitle];

const HAIR = { style: BorderStyle.SINGLE, size: 4, color: HAIRLINE };

export const PLAN_STYLES: IStylesOptions = {
  default: {
    document: { run: { font: "Calibri", size: 20, color: INK }, paragraph: { spacing: { line: 276 } } },

    /*
     * THE PLAN'S HEADINGS ARE WORD'S HEADINGS (§6.107.1).
     *
     * They used to be `Plan Section` and `Plan Subsection` — custom styles carrying `outlineLevel`, on the
     * theory that outline levels were enough. They are not enough in the way that matters: a reader who
     * does Insert → Table of Contents, or opens the navigation pane, or applies one of Word's own TOC
     * formats, is working with Heading 1, 2 and 3. A document whose headings are something else is a
     * document their Word does not recognise as having any structure at all.
     *
     * > So the BUILT-IN styles are redefined to the plan's look, rather than the plan's look being given
     * > a name of its own. Everything downstream — the contents field, the navigation pane, a client's own
     * > inserted TOC, and the styles pane they already know how to use — then works without being taught.
     */
    heading1: {
      run: { size: 28, bold: true, color: ACCENT },
      paragraph: {
        spacing: { before: 0, after: 200 }, keepNext: true, keepLines: true, outlineLevel: 0,
        border: { bottom: { ...HAIR, space: 6 } },
      },
    },
    heading2: {
      run: { size: 22, bold: true, color: ACCENT },
      paragraph: { spacing: { before: 280, after: 120 }, keepNext: true, keepLines: true, outlineLevel: 1 },
    },
    heading3: {
      run: { size: 20, bold: true, color: INK },
      paragraph: { spacing: { before: 200, after: 80 }, keepNext: true, keepLines: true, outlineLevel: 2 },
    },
  },
  paragraphStyles: [
    /*
     * The contents Word builds for itself (§6.107.1). These are Word's OWN TOC styles, redefined so the
     * generated contents looks like the rest of the plan instead of like a default. A client who replaces
     * the field with their own still gets these, because they are the styles Word reaches for.
     */
    { id: "TOC1", name: "toc 1", basedOn: "Normal", next: "Normal",
      run: { size: 18, bold: true },
      paragraph: { spacing: { before: 120, after: 0 } } },
    { id: "TOC2", name: "toc 2", basedOn: "Normal", next: "Normal",
      run: { size: 18 },
      paragraph: { spacing: { before: 0, after: 0 }, indent: { left: 340 } } },
    { id: "TOC3", name: "toc 3", basedOn: "Normal", next: "Normal",
      run: { size: 18, color: MUTED },
      paragraph: { spacing: { before: 0, after: 0 }, indent: { left: 680 } } },


    { id: S.body, name: "Plan Body", basedOn: "Normal", next: S.body, quickFormat: true,
      run: { size: 20, color: INK },
      paragraph: { spacing: { after: 160, line: 276 } } },

    /* A lead-in exists to introduce the thing under it, so it is bound to it by definition. */
    { id: S.lead, name: "Plan Lead-in", basedOn: "Normal", next: S.body,
      run: { size: 20, bold: true, color: ACCENT },
      paragraph: { spacing: { before: 120, after: 80 }, keepNext: true, keepLines: true } },

    { id: S.quote, name: "Plan Quote", basedOn: "Normal", next: S.body,
      run: { size: 20, italics: true, color: INK },
      paragraph: {
        spacing: { before: 120, after: 160, line: 276 }, keepLines: true, indent: { left: 340 },
        border: { left: { style: BorderStyle.SINGLE, size: 12, color: ACCENT, space: 12 } },
      } },

    { id: S.note, name: "Plan Note", basedOn: "Normal", next: S.body,
      run: { size: 18, color: MUTED },
      paragraph: { spacing: { after: 160, line: 264 }, keepLines: true } },

    { id: S.bullet, name: "Plan Bullet", basedOn: "Normal", next: S.bullet,
      run: { size: 20, color: INK },
      paragraph: { spacing: { after: 60, line: 264 }, keepLines: true } },

    /*
     * THE THREE THAT CAUSED THE COMPLAINT. A figure is a title, a picture and a note, and the reader needs
     * all three at once — a chart on its own page with its title on the one before explains nothing.
     * The title keeps with the picture; the picture keeps with its note.
     *
     * The cost is honest and worth stating: where the trio will not fit in what is left of a page, Word
     * moves the WHOLE trio down and leaves white space behind. That gap is the price of never splitting
     * them, and it is the right trade — a reader forgives a short page, not a stranded heading.
     */
    { id: S.figureTitle, name: "Plan Figure Title", basedOn: "Normal", next: S.figure, quickFormat: true,
      run: { size: 20, bold: true, color: ACCENT },
      paragraph: { spacing: { before: 200, after: 60 }, keepNext: true, keepLines: true } },
    { id: S.figure, name: "Plan Figure", basedOn: "Normal", next: S.figureNote,
      paragraph: { spacing: { after: 60 }, keepNext: true, keepLines: true } },
    { id: S.figureNote, name: "Plan Figure Note", basedOn: "Normal", next: S.body,
      run: { size: 17, color: MUTED },
      paragraph: { spacing: { after: 200 }, keepLines: true } },

    { id: S.tableCell, name: "Plan Table Cell", basedOn: "Normal", next: S.tableCell,
      run: { size: 18, color: INK },
      paragraph: { spacing: { after: 0, line: 252 } } },
    /* A header row that ended a page would leave its figures orphaned overleaf. */
    { id: S.tableHeading, name: "Plan Table Heading", basedOn: S.tableCell, next: S.tableCell,
      run: { size: 18, bold: true, color: INK },
      paragraph: { spacing: { after: 0, line: 252 }, keepNext: true, keepLines: true } },

    { id: S.noticeTitle, name: "Plan Notice Title", basedOn: "Normal", next: S.noticeHeading,
      run: { size: 24, bold: true, color: ACCENT },
      paragraph: { spacing: { before: 240, after: 240 }, keepNext: true, keepLines: true } },
    { id: S.noticeHeading, name: "Plan Notice Heading", basedOn: "Normal", next: S.noticeBody,
      run: { size: 20, bold: true, color: INK },
      paragraph: { spacing: { before: 200, after: 60 }, keepNext: true, keepLines: true } },
    { id: S.noticeBody, name: "Plan Notice Body", basedOn: "Normal", next: S.noticeBody,
      run: { size: 17, color: MUTED },
      paragraph: { spacing: { after: 100, line: 264 } } },

    /* The version line (§6.102): set apart from the notice above it, and kept with nothing — it is the
       last thing on the page and has no data to be stranded from. */
    { id: S.noticePrepared, name: "Plan Notice Prepared", basedOn: "Normal", next: "Normal",
      run: { size: 16, italics: true, color: MUTED },
      paragraph: { spacing: { before: 320, after: 0 } } },

    /* The footer's page number (§6.107). A style, so a client can change it once for the whole document. */
    { id: S.pageNumber, name: "Plan Page Number", basedOn: "Normal", next: "Normal",
      run: { size: 16, color: MUTED },
      paragraph: { spacing: { before: 0, after: 0 } } },

    { id: S.contentsTitle, name: "Plan Contents Title", basedOn: "Normal", next: S.contentsEntry,
      run: { size: 28, bold: true, color: ACCENT },
      paragraph: { spacing: { after: 160 }, keepNext: true, keepLines: true } },
    { id: S.contentsEntry, name: "Plan Contents Entry", basedOn: "Normal", next: S.contentsEntry,
      run: { size: 18, color: INK },
      paragraph: { spacing: { after: 40 }, keepLines: true } },

    /*
     * THE COVER, AS NIC SET IT (§6.107.2).
     *
     * These six sizes are not an opinion of this app's. He opened a plan, adjusted the cover styles in Word
     * until it looked right, and sent the file back — so the numbers below were read out of HIS styles.xml
     * rather than approximated from a description of it.
     *
     * Centred on the style rather than on each paragraph, so the whole cover still moves as one decision.
     */
    /* 16pt (§6.107.4) — measured off the cover Nic built, not off the number he quoted. */
    { id: S.coverName, name: "Plan Cover Name", basedOn: "Normal", next: S.coverTagline,
      run: { size: 32, bold: true, color: ACCENT },
      paragraph: { alignment: AlignmentType.CENTER, keepNext: true, keepLines: true } },
    /* 10pt — the same size as the detail lines, which is what makes them read as one family. */
    { id: S.coverTagline, name: "Plan Cover Tagline", basedOn: "Normal", next: S.coverTitle,
      run: { size: 20, color: MUTED },
      paragraph: { alignment: AlignmentType.CENTER, spacing: { before: 140 }, keepNext: true, keepLines: true } },
    /* 48pt. The one thing on the page that is allowed to be big, and it has to be this big. */
    { id: S.coverTitle, name: "Plan Cover Title", basedOn: "Normal", next: S.coverYear,
      run: { size: 96, color: INK },
      paragraph: { alignment: AlignmentType.CENTER, keepNext: true, keepLines: true } },
    /* 24pt. */
    { id: S.coverYear, name: "Plan Cover Year", basedOn: "Normal", next: S.coverDetail,
      run: { size: 48, color: ACCENT },
      paragraph: { alignment: AlignmentType.CENTER, spacing: { before: 866 }, keepNext: true, keepLines: true } },
    /* 10pt. The id now matches the name it has always shown in Word's styles pane. */
    { id: S.coverDetail, name: "Plan Cover Detail", basedOn: "Normal", next: S.coverDetail,
      run: { size: 20, color: MUTED },
      paragraph: { alignment: AlignmentType.CENTER, spacing: { before: 60 }, keepLines: true } },
    /*
     * The rule is a paragraph border, and its LENGTH is the indent: 7cm in from each side (3969 twips),
     * which is what turns a line across the whole page into a short centred mark. Indenting is the only way
     * to shorten a border, since a border follows the paragraph's measure.
     */
    { id: S.coverRule, name: "Plan Cover Rule", basedOn: "Normal", next: S.coverTitle,
      /*
       * 10pt, not the 1pt hairline this used to be (§6.107.4). The paragraph is empty and the border hangs
       * off it, so its RUN SIZE is the height of the gap the rule sits in — and everything below the rule
       * moves with it. Measured off Nic's cover, where the rule's run is 10pt.
       */
      run: { size: 20 },
      paragraph: {
        alignment: AlignmentType.CENTER, keepNext: true,
        indent: { left: 3969, right: 3969 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: ACCENT, space: 6 } },
      } },
  ],
};

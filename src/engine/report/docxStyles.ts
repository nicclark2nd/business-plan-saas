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
  section: "PlanSection",
  sectionNewPage: "PlanSectionNewPage",
  subsection: "PlanSubsection",
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
  contentsTitle: "PlanContentsTitle",
  contentsEntry: "PlanContentsEntry",
  coverName: "PlanCoverName",
  coverTagline: "PlanCoverTagline",
  coverTitle: "PlanCoverTitle",
  coverYear: "PlanCoverYear",
  coverMeta: "PlanCoverMeta",
  coverRule: "PlanCoverRule",
} as const;

const HAIR = { style: BorderStyle.SINGLE, size: 4, color: HAIRLINE };

export const PLAN_STYLES: IStylesOptions = {
  default: {
    document: { run: { font: "Calibri", size: 20, color: INK }, paragraph: { spacing: { line: 276 } } },
  },
  paragraphStyles: [
    /*
     * A SECTION HEADING NEVER ENDS A PAGE. `keepNext` binds it to whatever follows and `keepLines` stops a
     * two-line heading splitting across the break. `outlineLevel` is what puts it in Word's navigation
     * pane and lets a client insert a real table of contents over the top of ours.
     */
    {
      id: S.section, name: "Plan Section", basedOn: "Normal", next: S.body, quickFormat: true,
      run: { size: 28, bold: true, color: ACCENT },
      paragraph: {
        spacing: { before: 0, after: 200 }, keepNext: true, keepLines: true, outlineLevel: 0,
        border: { bottom: { ...HAIR, space: 6 } },
      },
    },
    /*
     * The same heading, starting a page. It is a SEPARATE STYLE rather than a property set on each
     * paragraph so that a client who wants the plan to run continuously can clear one checkbox in Word
     * and have every section follow suit — which is exactly the control Nic pointed at.
     */
    {
      id: S.sectionNewPage, name: "Plan Section (new page)", basedOn: S.section, next: S.body, quickFormat: true,
      paragraph: { keepNext: true, keepLines: true, outlineLevel: 0 },
    },
    {
      id: S.subsection, name: "Plan Subsection", basedOn: "Normal", next: S.body, quickFormat: true,
      run: { size: 22, bold: true, color: ACCENT },
      paragraph: { spacing: { before: 280, after: 120 }, keepNext: true, keepLines: true, outlineLevel: 1 },
    },

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

    { id: S.contentsTitle, name: "Plan Contents Title", basedOn: "Normal", next: S.contentsEntry,
      run: { size: 28, bold: true, color: ACCENT },
      paragraph: { spacing: { after: 160 }, keepNext: true, keepLines: true } },
    { id: S.contentsEntry, name: "Plan Contents Entry", basedOn: "Normal", next: S.contentsEntry,
      run: { size: 18, color: INK },
      paragraph: { spacing: { after: 40 }, keepLines: true } },

    /* The cover. Centred here rather than on each paragraph, so the whole cover moves as one decision. */
    { id: S.coverName, name: "Plan Cover Name", basedOn: "Normal", next: S.coverTagline,
      run: { size: 40, bold: true, color: ACCENT },
      paragraph: { alignment: AlignmentType.CENTER, keepNext: true, keepLines: true } },
    { id: S.coverTagline, name: "Plan Cover Tagline", basedOn: "Normal", next: S.coverTitle,
      run: { size: 18, color: MUTED },
      paragraph: { alignment: AlignmentType.CENTER, spacing: { before: 140 }, keepNext: true, keepLines: true } },
    { id: S.coverTitle, name: "Plan Cover Title", basedOn: "Normal", next: S.coverYear,
      run: { size: 72, color: INK },
      paragraph: { alignment: AlignmentType.CENTER, keepNext: true, keepLines: true } },
    { id: S.coverYear, name: "Plan Cover Year", basedOn: "Normal", next: S.coverMeta,
      run: { size: 26, color: ACCENT },
      paragraph: { alignment: AlignmentType.CENTER, spacing: { before: 260 }, keepNext: true, keepLines: true } },
    { id: S.coverMeta, name: "Plan Cover Detail", basedOn: "Normal", next: S.coverMeta,
      run: { size: 18, color: MUTED },
      paragraph: { alignment: AlignmentType.CENTER, spacing: { before: 60 }, keepLines: true } },
    { id: S.coverRule, name: "Plan Cover Rule", basedOn: "Normal", next: S.coverTitle,
      run: { size: 2 },
      paragraph: {
        alignment: AlignmentType.CENTER, keepNext: true,
        border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: ACCENT, space: 6 } },
      } },
  ],
};

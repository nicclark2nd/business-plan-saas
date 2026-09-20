import { describe, expect, it } from "vitest";
import { renderDocx, docxFileName } from "./docx";
import { numberSections, cell, num, type ReportDoc } from "./blocks";

const doc = (): ReportDoc => ({
  businessName: "BNE Concreting",
  subtitle: "Business Plan",
  date: "September 2026",
  preparedOn: "18 September 2026",
  omitted: [],
  cover: {
    tagline: "Concreting & civil works",
    year: "2027",
    contact: "hello@bne.example \u00b7 bne.example",
    address: "25 Deta Street, Suite 1, Geebung QLD 4004",
  },
  disclaimer: {
    title: "Confidentiality Statement & Legal Disclaimer",
    parts: [{ heading: "Confidentiality & Intellectual Property", body: "Strictly confidential to BNE Concreting." }],
  },
  sections: numberSections([
    {
      title: "Executive Summary",
      children: [
        { title: "Company snapshot", blocks: [
          { kind: "para", text: "A sentence the document must carry." },
          { kind: "facts", rows: [["Established", "June 1998"]] },
        ] },
        { title: "Revenue and profit highlights", blocks: [
          { kind: "table",
            columns: [{ label: "Year" }, { label: "Net profit", numeric: true }],
            rows: [[cell("Year 1"), num("(136,681)")]] },
        ] },
      ],
    },
    { title: "Financial Plan", blocks: [
      { kind: "quote", text: "A quoted mission." },
      { kind: "list", items: ["A bulleted commitment."] },
      { kind: "note", text: "A note a reader is entitled to." },
    ] },
  ]),
});

/** Word files are zips; the text lives in word/document.xml, so that is what gets searched. */
async function documentXml(buf: Buffer) {
  const { default: JSZip } = await import("jszip");
  const zip = await JSZip.loadAsync(buf);
  return zip.file("word/document.xml")!.async("string");
}

/** The stylesheet, which is where the pagination rules live once they are properties of a style (§6.97). */
async function stylesXml(buf: Buffer) {
  const { default: JSZip } = await import("jszip");
  const zip = await JSZip.loadAsync(buf);
  return zip.file("word/styles.xml")!.async("string");
}

/** One style's definition, so an assertion can say what that style promises rather than what the file contains. */
function styleBlock(xml: string, id: string): string {
  const at = xml.indexOf(`w:styleId="${id}"`);
  if (at === -1) return "";
  const end = xml.indexOf("</w:style>", at);
  return xml.slice(at, end === -1 ? undefined : end);
}

/**
 * THE PAGE SIZE, READ BACK OUT OF THE FILE (§6.93).
 *
 * Not compared against `PAGE_DIMENSIONS` — that would be the constant agreeing with itself (§6.92.1). These
 * assertions unzip the document Word will actually open and read the `w:pgSz` element out of it.
 */
describe("the page it prints on", () => {
  it("defaults to A4 when nothing is passed", async () => {
    const xml = await documentXml(await renderDocx(doc(), []));
    expect(xml).toContain('w:w="11906"');
    expect(xml).toContain('w:h="16838"');
  });

  it("lays out for Letter when asked", async () => {
    const xml = await documentXml(await renderDocx(doc(), [], "letter"));
    expect(xml).toContain('w:w="12240"');
    expect(xml).toContain('w:h="15840"');
    expect(xml).not.toContain('w:w="11906"');
  });

  it("keeps the same 2cm margins on both papers", async () => {
    for (const size of ["a4", "letter"] as const) {
      const xml = await documentXml(await renderDocx(doc(), [], size));
      expect(xml).toContain('w:top="1134"');
      expect(xml).toContain('w:left="1134"');
    }
  });
});

/**
 * The logo on the cover and in the page header (§6.94), checked by unzipping the document and looking at
 * what is inside it — not by trusting that the code that put it there ran.
 */
const pngFixture = (w: number, h: number) => {
  const head = Buffer.alloc(24);
  head.writeUInt32BE(0x89504e47, 0); head.writeUInt32BE(0x0d0a1a0a, 4);
  head.writeUInt32BE(13, 8); head.write("IHDR", 12, "ascii");
  head.writeUInt32BE(w, 16); head.writeUInt32BE(h, 20);
  return Buffer.concat([head, Buffer.alloc(64)]);
};

async function zipNames(buf: Buffer) {
  const { default: JSZip } = await import("jszip");
  return Object.keys((await JSZip.loadAsync(buf)).files);
}

/**
 * Page two (§6.95). The point of every assertion here is that a legal notice which names the WRONG company,
 * or lands in the middle of the contents, is worse than not having one.
 */
/**
 * The cover (§6.96). Every field but the name and the title is optional, and the assertions that matter are
 * the ones about absence: a cover that prints a blank line where a website should be looks like a fault.
 */
/**
 * THE FAULT NIC FOUND IN WORD (§6.97): a bold line reading "Margin by service" alone at the foot of a page
 * and its chart overleaf. These assertions read the STYLESHEET, because that is where the rule that stops it
 * now lives — checking the paragraphs would only prove they were formatted, which they always were.
 */
describe("what must not be split across a page", () => {
  it("defines the styles the plan's paragraphs actually use", async () => {
    const styles = await stylesXml(await renderDocx(doc(), []));
    for (const id of ["Heading1", "Heading2", "PlanBody", "PlanFigureTitle", "PlanFigure", "PlanFigureNote"]) {
      expect(styleBlock(styles, id), `missing style ${id}`).not.toBe("");
    }
  });

  it("keeps a heading with what follows it", async () => {
    const styles = await stylesXml(await renderDocx(doc(), []));
    for (const id of ["Heading1", "Heading2", "PlanLead", "PlanNoticeHeading"]) {
      expect(styleBlock(styles, id), id).toContain("<w:keepNext");
      expect(styleBlock(styles, id), id).toContain("<w:keepLines");
    }
  });

  it("keeps a figure's title, picture and note together", async () => {
    const styles = await stylesXml(await renderDocx(doc(), []));
    expect(styleBlock(styles, "PlanFigureTitle")).toContain("<w:keepNext");
    expect(styleBlock(styles, "PlanFigure")).toContain("<w:keepNext");
    expect(styleBlock(styles, "PlanFigureNote")).toContain("<w:keepLines");
  });

  it("holds a paragraph to the table or chart it introduces", async () => {
    /* The look-ahead is per-paragraph, because whether to keep depends on what comes NEXT, not on the style. */
    const xml = await documentXml(await renderDocx(doc(), []));
    expect(xml).toContain("<w:keepNext");
  });

  /**
   * §6.97.1. The library's type refuses `pageBreakBefore` on a paragraph style, so it is written into the
   * stylesheet after packing. These assertions read the FINISHED file — if the patch silently failed, or
   * the document was still relying on per-paragraph breaks, one of them says so.
   */
  /**
   * §6.97.2. Nic, reading the file: "the heading '1.0 Executive Summary' must use the style 'Plan Section
   * (new page)'. All the other ones e.g. 2.0, 3.0, 4.0 use this style." One section behaving differently
   * from eleven is not a special case — it is an inconsistency a client meets when they edit that style
   * and eleven headings move.
   */
  it("gives EVERY top-level section the same style, 1.0 included", async () => {
    const xml = await documentXml(await renderDocx(doc(), []));
    /* The fixture has two top-level sections, and there is now only one style either could take. */
    expect((xml.match(/w:val="Heading1"/g) ?? []).length).toBe(2);
    expect(xml).not.toContain("PlanSection");
  });

  it("starts each section on a new page from the style, not from the paragraph", async () => {
    const buf = await renderDocx(doc(), []);
    expect(styleBlock(await stylesXml(buf), "Heading1")).toContain("<w:pageBreakBefore/>");
    /* Nothing sets it directly any more, so a client clearing the checkbox actually clears it. */
    expect(await documentXml(buf)).not.toContain("<w:pageBreakBefore/>");
  });

  it("puts the break before the other properties, as the schema requires", async () => {
    const block = styleBlock(await stylesXml(await renderDocx(doc(), [])), "Heading1");
    const pPr = block.indexOf("<w:pPr>");
    const brk = block.indexOf("<w:pageBreakBefore/>");
    const keep = block.indexOf("<w:keepNext");
    expect(pPr).toBeGreaterThan(-1);
    expect(brk).toBe(pPr + "<w:pPr>".length);
    if (keep > -1) expect(brk).toBeLessThan(keep);
  });

  it("leaves every other style alone", async () => {
    const styles = await stylesXml(await renderDocx(doc(), []));
    for (const id of ["PlanSection", "PlanSubsection", "PlanBody", "PlanFigureTitle", "PlanNoticeBody"]) {
      expect(styleBlock(styles, id), id).not.toContain("pageBreakBefore");
    }
  });

  it("is still a Word file Word will open after being patched", async () => {
    const buf = await renderDocx(doc(), []);
    expect(buf.subarray(0, 2).toString()).toBe("PK");
    const { default: JSZip } = await import("jszip");
    const zip = await JSZip.loadAsync(buf);
    for (const part of ["[Content_Types].xml", "word/document.xml", "word/styles.xml", "_rels/.rels"]) {
      expect(zip.file(part), `missing ${part}`).not.toBeNull();
    }
  });

  it("never breaks a table row in half", async () => {
    const xml = await documentXml(await renderDocx(doc(), []));
    expect(xml).toContain("<w:cantSplit");
  });

  it("repeats a table's headings on a continued page", async () => {
    const xml = await documentXml(await renderDocx(doc(), []));
    expect(xml).toContain("<w:tblHeader");
  });

  /** Direct formatting is what had nowhere to put a rule — so most paragraphs must now carry a style. */
  it("styles the body of the document rather than formatting it by hand", async () => {
    const xml = await documentXml(await renderDocx(doc(), []));
    const paragraphs = (xml.match(/<w:p[ >]/g) ?? []).length;
    const styled = (xml.match(/<w:pStyle /g) ?? []).length;
    expect(paragraphs).toBeGreaterThan(0);
    expect(styled / paragraphs).toBeGreaterThan(0.6);
  });
});

describe("the cover", () => {
  it("carries the name, the title, the tagline, the year and the contact block", async () => {
    const xml = await documentXml(await renderDocx(doc(), []));
    expect(xml).toContain("BNE Concreting");
    expect(xml).toContain("Business Plan");
    expect(xml).toContain("Concreting &amp; civil works");
    expect(xml).toContain("2027");
    /* The contact block is in the cover's FOOTER now (§6.107.4), so it is not in the body at all. */
    const zip = await (await import("jszip")).default.loadAsync(await renderDocx(doc(), []));
    const feet = await Promise.all(Object.keys(zip.files).filter((n) => /footer\d*\.xml$/.test(n))
      .map((n) => zip.file(n)!.async("string")));
    expect(feet.join("")).toContain("bne.example");
    expect(feet.join("")).toContain("Geebung QLD 4004");
  });

  it("drops each optional line rather than printing a blank one", async () => {
    const bare = { ...doc(), cover: { tagline: null, year: null, contact: null, address: null } };
    const xml = await documentXml(await renderDocx(bare, []));
    expect(xml).toContain("BNE Concreting");
    expect(xml).toContain("Business Plan");
    expect(xml).not.toContain("Concreting &amp; civil works");
    expect(xml).not.toContain("2027");
    expect(xml).not.toContain("Geebung");
  });

  /* Centring moved onto the cover styles, so it is asserted where it now lives (§6.97). */
  it("is centred, by style rather than by paragraph", async () => {
    const styles = await stylesXml(await renderDocx(doc(), []));
    for (const id of ["PlanCoverName", "PlanCoverTitle", "PlanCoverYear", "PlanCoverDetail"]) {
      expect(styleBlock(styles, id), id).toContain('w:val="center"');
    }
    const xml = await documentXml(await renderDocx(doc(), []));
    expect(xml).toContain('w:pStyle w:val="PlanCoverTitle"');
  });

  /*
   * THE SIZES NIC SET (§6.107.2). Read out of the styles.xml of a plan he adjusted in Word and sent back,
   * so these assertions are a record of a decision rather than a guess at one. Half-points, as Word stores
   * them: 36 is 18pt.
   */
  it("carries the cover sizes he set", async () => {
    const styles = await stylesXml(await renderDocx(doc(), []));
    const sizes: [string, number][] = [
      ["PlanCoverName", 32], ["PlanCoverTagline", 20], ["PlanCoverTitle", 96],
      ["PlanCoverYear", 48], ["PlanCoverDetail", 20],
    ];
    for (const [id, half] of sizes) {
      expect(styleBlock(styles, id), `${id} should be ${half / 2}pt`).toContain(`<w:sz w:val="${half}"/>`);
    }
  });

  /* A border runs the width of its paragraph, so the only way to shorten the rule is to indent it. */
  it("shortens the cover rule by indenting it 7cm from each side", async () => {
    const block = styleBlock(await stylesXml(await renderDocx(doc(), [])), "PlanCoverRule");
    expect(block).toContain('w:left="3969"');
    expect(block).toContain('w:right="3969"');
    expect(block).toContain("pBdr");
  });

  /*
   * THE TEST THAT SHOULD HAVE EXISTED FROM THE START (§6.107.3).
   *
   * `text()` carried `size: o.size ?? 20`, so every run in the document had a hard 10pt on it. Direct
   * formatting beats a paragraph style, so every size in the stylesheet was decorative — the cover's 36pt
   * title rendered at 10pt and had done since the first Word file was built. 722 tests were green.
   *
   * Nothing checked what a reader would SEE, only what the stylesheet CLAIMED. So this one reads the
   * document rather than the styles.
   */
  it("lets the cover styles decide the cover's sizes", async () => {
    const xml = await documentXml(await renderDocx(doc(), []));
    const cover = xml.slice(0, xml.indexOf("PlanNoticeTitle"));
    for (const id of ["PlanCoverName", "PlanCoverTagline", "PlanCoverTitle", "PlanCoverYear", "PlanCoverDetail"]) {
      const at = cover.indexOf(`w:pStyle w:val="${id}"`);
      expect(at, `${id} missing from the cover`).toBeGreaterThan(-1);
      const para = cover.slice(at, cover.indexOf("</w:p>", at));
      expect(para, `${id} sets its own size and overrides the style`).not.toContain("<w:sz ");
    }
  });

  it("lets the heading styles decide the headings' sizes", async () => {
    const xml = await documentXml(await renderDocx(doc(), []));
    const at = xml.indexOf('w:pStyle w:val="Heading1"');
    const para = xml.slice(at, xml.indexOf("</w:p>", at));
    expect(para).not.toContain("<w:sz ");
    /* Two colours in one heading is a real per-run decision, and stays. */
    expect(para).toContain("w:color");
  });

  /* The id said Meta and the styles pane said Detail — two names for one style is one too many (§6.41). */
  it("gives the detail style the id its name has always shown", async () => {
    const styles = await stylesXml(await renderDocx(doc(), []));
    expect(styles).toContain('w:styleId="PlanCoverDetail"');
    expect(styles).not.toContain("PlanCoverMeta");
  });
});

describe("the confidentiality statement", () => {
  it("is in the document, under its own heading", async () => {
    const xml = await documentXml(await renderDocx(doc(), []));
    expect(xml).toContain("CONFIDENTIALITY STATEMENT &amp; LEGAL DISCLAIMER");
    expect(xml).toContain("Confidentiality &amp; Intellectual Property");
  });

  it("is a page of its own, and the contents is the page after it", async () => {
    const buf = await renderDocx(doc(), []);
    const xml = await documentXml(buf);
    const title = xml.indexOf("CONFIDENTIALITY STATEMENT");
    const contents = xml.indexOf("Contents");
    expect(title).toBeGreaterThan(-1);
    expect(contents).toBeGreaterThan(title);
    /*
     * The notice opens the SECOND SECTION (§6.107.4), so the section break is what starts its page — it no
     * longer needs a break of its own, and having both would leave a blank page between them.
     */
    expect((xml.match(/<w:sectPr/g) ?? []).length).toBe(2);
    expect(styleBlock(await stylesXml(buf), "PlanContentsTitle")).toContain("<w:pageBreakBefore/>");
  });

  it("comes after the cover and before the contents", async () => {
    const xml = await documentXml(await renderDocx(doc(), []));
    expect(xml.indexOf("BNE Concreting")).toBeLessThan(xml.indexOf("CONFIDENTIALITY STATEMENT"));
    expect(xml.indexOf("CONFIDENTIALITY STATEMENT")).toBeLessThan(xml.indexOf("Contents"));
  });
});

describe("the logo", () => {
  it("is absent from a plan that has none, and the file is still valid", async () => {
    const buf = await renderDocx(doc(), []);
    const names = await zipNames(buf);
    expect(names.some((n) => n.startsWith("word/media/"))).toBe(false);
    expect(names.some((n) => n.includes("header"))).toBe(false);
  });

  it("puts an image in the file and a header on the pages after the cover", async () => {
    const buf = await renderDocx(doc(), [], "a4", { data: pngFixture(600, 200), type: "png" });
    const names = await zipNames(buf);
    expect(names.some((n) => n.startsWith("word/media/"))).toBe(true);
    expect(names.some((n) => /header\d*\.xml$/.test(n))).toBe(true);
    /* The cover is a section of its own with no header at all (§6.107.4), which titlePage used to fake. */
    const xml = await documentXml(buf);
    const cover = xml.slice(0, xml.indexOf("<w:sectPr"));
    expect(cover).not.toContain("headerReference");
  });

  /**
   * THE ONE THAT MATTERS FOR HOW IT LOOKS. A logo is placed at a fixed height with the width derived from
   * its own aspect ratio, so a 3:1 wordmark and a square roundel sit on the page as the same weight of
   * mark. Fixing the width instead is what makes one client's logo enormous and another's a postage stamp.
   */
  it("keeps the logo's own proportions", async () => {
    const xml = await documentXml(await renderDocx(doc(), [], "a4", { data: pngFixture(600, 200), type: "png" }));
    // Cover at height 110 → width 330; header at height 26 → width 78. Both 3:1, as the file is.
    expect(xml).toMatch(/cx="[0-9]+" cy="[0-9]+"/);
    const pairs = [...xml.matchAll(/cx="(\d+)" cy="(\d+)"/g)].map((m) => [Number(m[1]), Number(m[2])]);
    expect(pairs.length).toBeGreaterThan(0);
    for (const [cx, cy] of pairs) expect(cx / cy).toBeCloseTo(3, 1);
  });
});

describe("the Word renderer", () => {
  it("produces a real Word file", async () => {
    const buf = await renderDocx(doc(), []);
    expect(buf.subarray(0, 2).toString()).toBe("PK");
    expect(buf.byteLength).toBeGreaterThan(2000);
  });

  /**
   * The claim the whole two-renderer design rests on: the file says what the screen says. If a block kind
   * is ever added to the model and not handled here, this is what notices — a section silently missing
   * from the document a client sends to a bank is the worst failure this app has.
   */
  it("carries every section, heading and block kind into the document", async () => {
    const xml = await documentXml(await renderDocx(doc(), []));
    for (const s of [
      "Executive Summary", "Company snapshot", "Revenue and profit highlights", "Financial Plan",
      "A sentence the document must carry.", "Established", "June 1998",
      "Year 1", "(136,681)", "A quoted mission.", "A bulleted commitment.",
      "A note a reader is entitled to.",
    ]) {
      expect(xml, `missing from the Word file: ${s}`).toContain(s);
    }
  });

  it("numbers the headings the same way the screen does", async () => {
    const xml = await documentXml(await renderDocx(doc(), []));
    expect(xml).toContain("1.0");
    expect(xml).toContain("1.1");
    expect(xml).toContain("2.0");
  });

  /** What is missing is stated in the file too, not only on screen (§6.57). */
  it("prints what is not in the plan when there is any", async () => {
    const xml = await documentXml(await renderDocx(doc(), [{ label: "Historic" }]));
    expect(xml).toContain("What is not in this plan");
    expect(xml).toContain("Historic");
  });

  it("names the file so it can be found again", () => {
    expect(docxFileName(doc())).toBe("BNE-Concreting-Business-Plan-September-2026.docx");
  });
});

/**
 * WHICH COPY THIS IS (§6.102).
 *
 * A client who downloads, sends the file to their bank, changes a price and downloads again holds two
 * different plans. Until this line existed nothing in either one said which was which — the cover carried
 * the month, so both said "September 2026", and the filename was built from that same string.
 *
 * The assertions are about placement as much as presence: the day belongs on the notice page and must stay
 * off the cover, because a cover dated to the day reads like a receipt rather than a plan.
 */
describe("which version of the plan this is", () => {
  it("prints the day it was prepared on the notice page", async () => {
    const xml = await documentXml(await renderDocx(doc(), []));
    expect(xml).toContain("This version prepared 18 September 2026.");
  });

  it("says it once and not twice", async () => {
    const xml = await documentXml(await renderDocx(doc(), []));
    expect(xml.split("This version prepared").length - 1).toBe(1);
  });

  it("keeps the day off the cover, which carries the month", async () => {
    const xml = await documentXml(await renderDocx(doc(), []));
    const cover = xml.slice(0, xml.indexOf("CONFIDENTIALITY STATEMENT"));
    expect(cover).toContain("September 2026");
    expect(cover).not.toContain("18 September 2026");
  });

  it("carries a style of its own rather than direct formatting (§6.97)", async () => {
    const styles = await stylesXml(await renderDocx(doc(), []));
    expect(styles).toContain('w:styleId="PlanNoticePrepared"');
  });

  it("sits after the notice and before the contents", async () => {
    const xml = await documentXml(await renderDocx(doc(), []));
    expect(xml.indexOf("This version prepared")).toBeGreaterThan(xml.indexOf("CONFIDENTIALITY STATEMENT"));
    expect(xml.indexOf("This version prepared")).toBeLessThan(xml.indexOf("Contents"));
  });
});


/**
 * PAGE NUMBERS (§6.107).
 *
 * Two different problems wearing one name. The footer's number Word works out as it lays the page; the
 * contents' numbers it can only work out by looking up where a bookmark ended up. So the assertions are
 * about the PLUMBING — a bookmark for every entry, a field pointing at each one, and the instruction to
 * calculate them — because what the number actually says is Word's answer and not ours to test.
 */
describe("page numbers and the contents", () => {
  const zipOf = async (buf: Buffer) => {
    const { default: JSZip } = await import("jszip");
    return JSZip.loadAsync(buf);
  };

  it("puts a page number in the footer", async () => {
    const zip = await zipOf(await renderDocx(doc(), []));
    const names = Object.keys(zip.files).filter((n) => /footer\d*\.xml$/.test(n));
    expect(names.length).toBeGreaterThan(0);
    const all = (await Promise.all(names.map((n) => zip.file(n)!.async("string")))).join("");
    expect(all).toContain("PAGE");
    expect(all).toContain("NUMPAGES");
  });

  /* A cover with "Page 1 of 27" across the bottom is not a cover. */
  it("leaves the cover without one", async () => {
    const xml = await documentXml(await renderDocx(doc(), []));
    /* Two sections: the cover's footer is its contact block, the body's is the page number (§6.107.4). */
    const cover = xml.slice(0, xml.indexOf("</w:sectPr>"));
    expect((xml.match(/<w:sectPr/g) ?? []).length).toBe(2);
    expect(cover).toContain("footerReference");
  });

  /*
   * THE ASSERTIONS THAT MATTER (§6.107.1). The previous version of this block checked bookmarks and PAGEREF
   * fields — the plumbing of a contents page this app drew by hand. All of it passed, and the document was
   * still one that Word did not recognise as having any structure.
   */
  it("uses Word's own heading styles, so Insert > Table of Contents finds them", async () => {
    const xml = await documentXml(await renderDocx(doc(), []));
    expect(xml).toContain('w:val="Heading1"');
    expect(xml).toContain('w:val="Heading2"');
  });

  it("applies no heading style of its own invention", async () => {
    const xml = await documentXml(await renderDocx(doc(), []));
    expect(xml).not.toContain("PlanSection");
    expect(xml).not.toContain("PlanSubsection");
  });

  it("asks Word to build the contents rather than drawing one", async () => {
    const xml = await documentXml(await renderDocx(doc(), []));
    expect(xml).toContain("TOC ");
    /* The switches, as Word writes them: quotes are XML-escaped inside the field instruction. */
    expect(xml).toContain("&quot;1-2&quot;");
    /* Hyperlinked entries: a contents page you cannot click is half a contents page. */
    expect(xml).toContain("TOC \\h");
  });

  it("defines the heading styles it relies on", async () => {
    const styles = await stylesXml(await renderDocx(doc(), []));
    expect(styles).toContain('w:styleId="Heading1"');
    expect(styles).toContain('w:styleId="Heading2"');
    /* And Word's own contents styles, so the generated list looks like the plan. */
    expect(styles).toContain('w:styleId="TOC1"');
  });

  it("starts every section on a new page, by a rule on Heading 1 itself", async () => {
    const styles = await stylesXml(await renderDocx(doc(), []));
    const h1 = styles.slice(styles.indexOf('w:styleId="Heading1"'));
    expect(h1.slice(0, h1.indexOf("</w:style>"))).toContain("pageBreakBefore");
  });

  /*
   * §6.107.5. The field carries no result of its own — it cannot, because nothing here knows what page a
   * heading lands on — so whether a client opens their plan to a contents page or to a blank one comes down
   * to this flag and these four switches. Both were wrong in ways that read as right.
   */
  it("says updateFields is TRUE, out loud", async () => {
    const settings = await (await zipOf(await renderDocx(doc(), []))).file("word/settings.xml")!.async("string");
    expect(settings).toContain('<w:updateFields w:val="true"/>');
  });

  it("writes the same four switches Word writes for itself", async () => {
    const xml = await documentXml(await renderDocx(doc(), []));
    const at = xml.indexOf("TOC ");
    const instr = xml.slice(at, xml.indexOf("</w:instrText>", at));
    for (const sw of ["&quot;1-2&quot;", "\\h", "\\z", "\\u"]) expect(instr, instr).toContain(sw);
  });
});

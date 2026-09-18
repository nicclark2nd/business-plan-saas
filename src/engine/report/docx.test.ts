import { describe, expect, it } from "vitest";
import { renderDocx, docxFileName } from "./docx";
import { numberSections, cell, num, type ReportDoc } from "./blocks";

const doc = (): ReportDoc => ({
  businessName: "BNE Concreting",
  subtitle: "Business Plan",
  date: "September 2026",
  omitted: [],
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
describe("the confidentiality statement", () => {
  it("is in the document, under its own heading", async () => {
    const xml = await documentXml(await renderDocx(doc(), []));
    expect(xml).toContain("CONFIDENTIALITY STATEMENT &amp; LEGAL DISCLAIMER");
    expect(xml).toContain("Confidentiality &amp; Intellectual Property");
  });

  it("carries a page break before it and before the contents, so it is a page of its own", async () => {
    const xml = await documentXml(await renderDocx(doc(), []));
    const title = xml.indexOf("CONFIDENTIALITY STATEMENT");
    const contents = xml.indexOf("Contents");
    expect(title).toBeGreaterThan(-1);
    expect(contents).toBeGreaterThan(title);
    // Two breaks between the cover and the first section: one onto page 2, one onto page 3.
    const breaks = [...xml.matchAll(/w:pageBreakBefore/g)].length;
    expect(breaks).toBeGreaterThanOrEqual(2);
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
    // titlePage, so the cover does not carry the header copy as well as the big one.
    expect(await documentXml(buf)).toContain("w:titlePg");
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

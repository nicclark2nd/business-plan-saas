import { describe, expect, it } from "vitest";
import { renderDocx, docxFileName } from "./docx";
import { numberSections, cell, num, type ReportDoc } from "./blocks";

const doc = (): ReportDoc => ({
  businessName: "BNE Concreting",
  subtitle: "Business Plan",
  date: "September 2026",
  omitted: [],
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

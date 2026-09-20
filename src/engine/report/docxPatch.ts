/**
 * Page-break-before, put where Nic asked for it: on the STYLE (§6.97.1).
 *
 * §6.97 set every other pagination rule on a style and left this one on the paragraph, because the `docx`
 * library takes `keepNext`, `keepLines` and `outlineLevel` on a paragraph style and refuses
 * `pageBreakBefore` — it is paragraph-only in its type. Nic: *"headings like 1.0 should be able to have a
 * style of Page Break Before."*
 *
 * He is right, and the library being unable to express it is not a reason for the document to be wrong. A
 * property set on 12 paragraphs is 12 things to change; on a style it is one checkbox, and a client who
 * wants the plan to read continuously can clear it in Word in two seconds.
 *
 * > **A LIBRARY'S TYPE IS A STATEMENT ABOUT THAT LIBRARY, NOT ABOUT THE FILE FORMAT.** `w:pageBreakBefore`
 * > is an ordinary child of `w:pPr` and Word has honoured it inside a style definition for twenty years.
 * > The wrapper could not say it; the format has no such limit.
 *
 * So the document is packed as usual and ONE element is added to ONE part afterwards. The alternative was
 * hand-authoring the entire stylesheet through `initialStyles`, which would throw away the library's own
 * Normal and Heading definitions to change one flag — a far larger surface for a far smaller gain.
 *
 * Nothing else in the file is touched: the other parts are copied through byte for byte, and a style that
 * already carries the element is left alone.
 */
const PAGE_BREAK = "<w:pageBreakBefore/>";

/**
 * Add `pageBreakBefore` to the named paragraph styles of a packed .docx.
 *
 * Returns the document unchanged if anything about it is not as expected — a missing stylesheet, a style
 * that is not there, XML that does not parse the way this expects. A plan that prints without page breaks
 * is a cosmetic disappointment; a plan that fails to download is not (§6.94's rule for the logo, again).
 */
export async function applyStylePageBreaks(buffer: Buffer, styleIds: readonly string[]): Promise<Buffer> {
  try {
    const { default: JSZip } = await import("jszip");
    const zip = await JSZip.loadAsync(buffer);

    const styles = zip.file("word/styles.xml");
    if (styles && styleIds.length) {
      const before = await styles.async("string");
      let xml = before;
      for (const id of styleIds) xml = addPageBreak(xml, id);
      if (xml !== before) zip.file("word/styles.xml", xml);
    }

    /*
     * SAY "TRUE" OUT LOUD (§6.107.5).
     *
     * The library writes `<w:updateFields/>`. By the schema an empty CT_OnOff means true, and by the schema
     * that is the end of it — but this is the flag that decides whether a client opens their plan to a
     * contents page or to a blank one, and it costs nothing to write the attribute every Word document
     * Word itself produces has written for twenty years.
     */
    const settings = zip.file("word/settings.xml");
    if (settings) {
      const before = await settings.async("string");
      const xml = before.replace("<w:updateFields/>", '<w:updateFields w:val="true"/>');
      if (xml !== before) zip.file("word/settings.xml", xml);
    }

    return await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  } catch (e) {
    console.error("docx patch", e);
    return buffer;
  }
}

/**
 * One style, one element.
 *
 * `w:pPr` is where paragraph properties live inside a style. Two cases: the style already has one, in which
 * case the element goes in at the FRONT — the schema fixes the order of `w:pPr`'s children and
 * `w:pageBreakBefore` comes before `w:keepNext`, `w:spacing` and everything else this document sets, and
 * Word rejects a file whose properties are out of order. Or the style has no `w:pPr` at all, and one is
 * created directly after the `w:style` element's own attributes.
 */
function addPageBreak(xml: string, styleId: string): string {
  const at = xml.indexOf(`w:styleId="${styleId}"`);
  if (at === -1) return xml;
  const end = xml.indexOf("</w:style>", at);
  if (end === -1) return xml;

  const block = xml.slice(at, end);
  if (block.includes("w:pageBreakBefore")) return xml;

  const pPr = block.indexOf("<w:pPr>");
  if (pPr !== -1) {
    const insert = at + pPr + "<w:pPr>".length;
    return xml.slice(0, insert) + PAGE_BREAK + xml.slice(insert);
  }

  /* No paragraph properties yet: open a block for it immediately after the style element's own tag. */
  const tagEnd = xml.indexOf(">", at);
  if (tagEnd === -1 || tagEnd > end) return xml;
  const insert = tagEnd + 1;
  return xml.slice(0, insert) + `<w:pPr>${PAGE_BREAK}</w:pPr>` + xml.slice(insert);
}

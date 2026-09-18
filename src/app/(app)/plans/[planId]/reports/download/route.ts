import { docxFileName, renderDocx, type DocxLogo } from "@/engine/report/docx";
import { createClient } from "@/lib/supabase/server";
import { LOGO_BUCKET, logoWordType } from "@/engine/plan/logo";
import { gatherReport } from "../gather";

async function fetchLogo(planId: string, path: string | null): Promise<DocxLogo | null> {
  const type = logoWordType(path);
  if (!path || !type) return null;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.storage.from(LOGO_BUCKET).download(path);
    if (error || !data) return null;
    return { data: Buffer.from(await data.arrayBuffer()), type };
  } catch (e) {
    console.error("logo for docx", e);
    return null;
  }
}

/**
 * The Word file (§6.90).
 *
 * A route rather than a server action, because the thing being returned is a FILE and a browser already
 * knows how to save one of those. It calls the same `gatherReport` the screen calls, so the download and
 * the page are one plan rendered twice rather than two plans.
 *
 * `force-dynamic`: a business plan must never come from a cache. A client who changes a price and
 * downloads again is entitled to the price they just typed.
 */
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params;
  /* The paper comes from the plan, not from this route — the screen and the file are one gather (§6.90). */
  const { doc, missing, pageSize, logoPath } = await gatherReport(planId);
  /*
   * The logo is fetched HERE because only this caller needs the bytes (§6.94). A logo that cannot be
   * fetched does not fail the download: a client waiting on a business plan would rather have it without
   * the letterhead than not at all, so the renderer simply gets nothing and lays out the cover as it did
   * before there was one.
   */
  const buffer = await renderDocx(doc, missing, pageSize, await fetchLogo(planId, logoPath));
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${docxFileName(doc)}"`,
      "Cache-Control": "no-store",
    },
  });
}

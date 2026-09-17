import { docxFileName, renderDocx } from "@/engine/report/docx";
import { gatherReport } from "../gather";

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
  const { doc, missing } = await gatherReport(planId);
  const buffer = await renderDocx(doc, missing);
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${docxFileName(doc)}"`,
      "Cache-Control": "no-store",
    },
  });
}

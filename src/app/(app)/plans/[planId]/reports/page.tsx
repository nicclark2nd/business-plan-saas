import { createClient } from "@/lib/supabase/server";
import { LOGO_BUCKET, LOGO_URL_TTL_SECONDS } from "@/engine/plan/logo";
import { gatherReport } from "./gather";
import { ReportsModule } from "./ReportsModule";

/**
 * The business plan (§6.83), assembled on the server and handed down finished. Everything it reads comes
 * from `gatherReport`, which the Word download calls too.
 */
export default async function ReportsPage({ params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params;
  const { doc, missing, mode, reconciled, hasFigures, pageSize, printSalaries, logoPath } = await gatherReport(planId);
  /* Signed for this request only — the bucket is private, so there is no address to keep (§6.94). */
  const supabase = await createClient();
  const logoUrl = logoPath
    ? (await supabase.storage.from(LOGO_BUCKET).createSignedUrl(logoPath, LOGO_URL_TTL_SECONDS)).data?.signedUrl ?? null
    : null;
  return <ReportsModule planId={planId} mode={mode} doc={doc} reconciled={reconciled} hasFigures={hasFigures} missing={missing}
    pageSize={pageSize} printSalaries={printSalaries} logoUrl={logoUrl} />;
}

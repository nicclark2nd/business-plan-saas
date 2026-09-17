import { gatherReport } from "./gather";
import { ReportsModule } from "./ReportsModule";

/**
 * The business plan (§6.83), assembled on the server and handed down finished. Everything it reads comes
 * from `gatherReport`, which the Word download calls too.
 */
export default async function ReportsPage({ params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params;
  const { doc, missing, mode, reconciled, pageSize, printSalaries } = await gatherReport(planId);
  return <ReportsModule planId={planId} mode={mode} doc={doc} reconciled={reconciled} missing={missing}
    pageSize={pageSize} printSalaries={printSalaries} />;
}

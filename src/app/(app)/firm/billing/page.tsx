import { redirect } from "next/navigation";
import { myBillingOrg } from "@/lib/billing";
import { BillingView } from "../../billing/BillingView";

export const dynamic = "force-dynamic";

/** The firm's billing, inside the consultant's own area (§6.185). */
export default async function FirmBillingPage({ searchParams }: { searchParams: Promise<{ billing?: string }> }) {
  const { billing } = await searchParams;
  const org = await myBillingOrg();
  if (!org || org.kind !== "firm") redirect("/setup");
  return <BillingView org={org} notice={billing} />;
}

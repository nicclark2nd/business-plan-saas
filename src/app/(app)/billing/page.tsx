import Link from "next/link";
import { redirect } from "next/navigation";
import { myBillingOrg } from "@/lib/billing";
import { Brand } from "@/components/Brand";
import { BillingView } from "./BillingView";

export const dynamic = "force-dynamic";

/**
 * A business owner's billing (§6.185) — owners have no firm area, so it stands on its own, one click from their
 * plans. A consultant is sent to the firm's billing instead.
 */
export default async function OwnerBillingPage({ searchParams }: { searchParams: Promise<{ billing?: string }> }) {
  const { billing } = await searchParams;
  const org = await myBillingOrg();
  if (!org) redirect("/setup");
  if (org.kind === "firm") redirect(`/firm/billing${billing ? `?billing=${encodeURIComponent(billing)}` : ""}`);
  return (
    <main className="mx-auto max-w-[1100px] px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <Brand height={26} />
        <Link href="/setup" className="text-[13px] font-semibold text-primary hover:underline">← Your plans</Link>
      </div>
      <div className="rounded-md border border-border bg-background"><BillingView org={org} notice={billing} /></div>
    </main>
  );
}

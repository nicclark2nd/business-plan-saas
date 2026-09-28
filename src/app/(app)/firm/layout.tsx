import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/plan";
import { loadMyFirm } from "@/lib/myFirm";
import { Brand } from "@/components/Brand";
import { FirmNav } from "./FirmNav";
import { holdOf, isPlatformAdmin } from "@/lib/platform";
import { OnHoldBanner } from "@/components/OnHoldBanner";

/**
 * THE CONSULTANT'S OWN AREA (§6.182).
 *
 * Nic: "If I log into the system as a consultant then it is for me and my consulting team. This is where my
 * brand, my team, my details and my clients list live." Nothing in here is ever shown inside a client's plan,
 * and nobody who is not an admin or advisor of a firm can open it — a client with a login is sent to their plan.
 */
export default async function FirmLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const firm = await loadMyFirm();
  if (!firm) redirect("/setup");
  const [hold, admin] = await Promise.all([holdOf(firm.id), isPlatformAdmin()]);
  const initials = (session.profile?.full_name || session.user.email || "?").split(/\s+/).map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="grid h-screen min-h-[640px] grid-cols-[220px_1fr] grid-rows-[48px_1fr]">
      <header className="col-span-2 flex items-center gap-4 border-b border-sidebar-border bg-sidebar px-4 text-sidebar-foreground">
        <Link href="/firm/clients" className="flex w-[204px] items-center"><Brand variant="reversed" height={22} /></Link>
        <div className="text-[13px] text-sidebar-muted"><b className="font-semibold text-sidebar-foreground">{firm.name}</b></div>
        <div className="flex-1" />
        {admin && <Link href="/admin" className="rounded bg-bad px-1.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-white hover:opacity-90">Site Admin</Link>}
        <span className="text-[12.5px] text-sidebar-muted">{session.profile?.full_name || session.user.email}</span>
        <form action="/auth/signout" method="post">
          <button type="submit" title="Sign out" className="grid size-7 place-items-center rounded-full bg-sidebar-accent text-[11px] font-bold text-sidebar-accent-foreground ring-1 ring-sidebar-border hover:bg-sidebar-primary">{initials}</button>
        </form>
      </header>
      <FirmNav />
      <main className="mx-auto min-h-0 w-full max-w-[1500px] overflow-y-auto"><OnHoldBanner hold={hold} />{children}</main>
    </div>
  );
}

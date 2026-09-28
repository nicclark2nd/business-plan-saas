import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/plan";
import { isPlatformAdmin } from "@/lib/platform";
import { Brand } from "@/components/Brand";

/**
 * SITE ADMIN (§6.186) — only for a site admin, and to anyone else it does not exist (404, not "forbidden":
 * there is nothing here worth confirming to someone who guessed the address).
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const [session, admin] = await Promise.all([getSession(), isPlatformAdmin()]);
  if (!session || !admin) notFound();
  return (
    <div className="min-h-screen">
      <header className="flex h-12 items-center gap-5 border-b border-sidebar-border bg-sidebar px-4 text-sidebar-foreground">
        <Link href="/admin" className="flex items-center gap-2"><Brand variant="reversed" height={22} /><span className="rounded bg-bad px-1.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-white">Site Admin</span></Link>
        <nav className="flex gap-4 text-[13px]">
          <Link href="/admin" className="hover:underline">Accounts</Link>
          <Link href="/admin/log" className="hover:underline">Activity log</Link>
        </nav>
        <div className="flex-1" />
        <Link href="/setup" className="text-[12.5px] text-sidebar-muted hover:underline">Back to my own work</Link>
      </header>
      <main className="mx-auto max-w-[1500px] px-5 py-5">{children}</main>
    </div>
  );
}

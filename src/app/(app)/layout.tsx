import { redirect } from "next/navigation";
import { getSession } from "@/lib/plan";

/** Signed-in area. Plan-specific chrome (sidebar) lives in plans/[planId]/layout. */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  return <>{children}</>;
}

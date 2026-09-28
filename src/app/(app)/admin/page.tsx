import { createClient } from "@/lib/supabase/server";
import { AccountsTable, type AccountRow } from "./AccountsTable";

export const dynamic = "force-dynamic";

/** Every account — firms and businesses planning for themselves — with what they pay and how much they use. */
export default async function AdminAccountsPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("platform_accounts");
  if (error) return <p className="text-[13px] text-bad">Couldn&apos;t read the accounts: {error.message}</p>;
  return <AccountsTable rows={(data ?? []) as AccountRow[]} />;
}

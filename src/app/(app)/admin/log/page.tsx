import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const when = (iso: string) => new Date(iso).toLocaleString("en-AU", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });

/** Every look and every change a Site Admin made (§6.186), newest first. Written by the database; nothing here edits it. */
export default async function AdminLogPage() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("platform_audit_recent", { p_limit: 200 });
  const rows = (data ?? []) as { at: string; admin_email: string | null; action: string; organisation_id: string | null; organisation_name: string | null; detail: Record<string, unknown> }[];
  return (
    <div>
      <div className="eyebrow">Site Admin</div>
      <h1 className="text-[22px] font-semibold">Activity log</h1>
      <p className="text-[12.5px] text-muted-foreground">The last 200 entries. Entries cannot be changed or removed.</p>
      <table className="mt-3 w-full text-[13px]">
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-border">
              <td className="py-1.5 pr-3 whitespace-nowrap text-muted-foreground">{when(r.at)}</td>
              <td className="py-1.5 pr-3">{r.admin_email}</td>
              <td className="py-1.5 pr-3 font-semibold">{r.action}</td>
              <td className="py-1.5 pr-3">{r.organisation_name ?? ""}</td>
              <td className="py-1.5 text-muted-foreground">{Object.keys(r.detail ?? {}).length ? Object.entries(r.detail).map(([k, v]) => `${k}: ${v}`).join(" · ") : ""}</td>
            </tr>
          ))}
          {!rows.length && <tr><td className="py-4 text-muted-foreground">Nothing yet.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

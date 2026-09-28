import { renderDocx, type DocxLogo } from "@/engine/report/docx";
import { capabilityReport, capabilityReportFileName, type ReportTab } from "@/engine/report/capabilityReport";
import { resolvePageSize } from "@/engine/report/pageSize";
import { readTab, readViews } from "@/engine/capability/read";
import { capabilityTimeline } from "@/engine/capability/timeline";
import { moneyFormatter } from "@/engine/plan/money";
import { preparedByLine, wordColour } from "@/engine/plan/brand";
import { getSession } from "@/lib/plan";
import { FIRM_LOGO_BUCKET, LOGO_BUCKET, logoWordType } from "@/engine/plan/logo";
import { loadCapabilityFacts } from "@/lib/capabilityFacts";
import { loadFirm } from "@/lib/firm";
import { TABS } from "@/lib/briefing";
import { createClient } from "@/lib/supabase/server";

/**
 * THE PLANNER'S REPORT, AS A WORD FILE (§6.180).
 *
 * The same facts the Financial Capabilities page reads (`loadCapabilityFacts`), through the same assembly
 * (`readTab`), with the Planner's saved briefings (§6.179) — so the file and the page are one reading
 * rendered twice. `force-dynamic` for the reason the business plan's download gives: a report must never
 * come from a cache.
 *
 * WHOSE LETTERHEAD. A plan written by a coach, consultant or accounting firm goes out under the FIRM's logo,
 * colour and name. A business planning for itself gets its own logo and the app's colour. A logo that
 * cannot be fetched does not fail the download (§6.94) — the report prints without it.
 */
export const dynamic = "force-dynamic";

async function fetchLogo(bucket: string, path: string | null): Promise<DocxLogo | null> {
  const type = logoWordType(path);
  if (!path || !type) return null;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.storage.from(bucket).download(path);
    if (error || !data) return null;
    return { data: Buffer.from(await data.arrayBuffer()), type };
  } catch (e) {
    console.error("logo for capability report", e);
    return null;
  }
}

export async function GET(_req: Request, { params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params;
  /* The Planner's report is the Planner's (§6.181): a client with their own login cannot download it. */
  const firm = await loadFirm(planId);
  if (!firm?.isPlanner) {
    return new Response(JSON.stringify({ error: "This report is for the Planner." }), { status: 403, headers: { "Content-Type": "application/json" } });
  }
  const supabase = await createClient();
  const [f, plan, settings, notes] = await Promise.all([
    loadCapabilityFacts(planId),
    supabase.from("plans").select("business_name").eq("id", planId).maybeSingle().then((r) => r.data),
    supabase.from("plan_settings").select("page_size, country, logo_path").eq("plan_id", planId).maybeSingle().then((r) => r.data),
    supabase.from("plan_briefings").select("tab, view, body").eq("plan_id", planId).then((r) => (r.error ? [] : r.data ?? [])),
  ]);

  const money = moneyFormatter(f.currency);
  const ctx = {
    facts: f.facts, history: f.history ?? [], firstYear: f.firstYear, money, adviser: f.adviser,
    months: f.months, agreedTargets: f.agreedTargets, facilities: f.facilities,
  };
  const RV = readViews(ctx);
  const note = (tab: string, view: string) => notes.find((n) => n.tab === tab && n.view === view)?.body ?? null;
  const tabs: ReportTab[] = TABS.map((tab) => ({
    tab,
    actual: RV.actualV ? readTab(ctx, RV, tab, true) : null,
    plan: readTab(ctx, RV, tab, false),
    briefings: { actual: note(tab, "actual"), plan: note(tab, "plan") },
  }));

  const now = new Date();
  const lettered = firm?.adviser ? firm : null;
  const business = typeof plan?.business_name === "string" && plan.business_name.trim() ? plan.business_name.trim() : "This business";
  const doc = capabilityReport({
    business, firm: lettered?.name ?? null, adviser: f.adviser,
    preparedBy: lettered ? preparedByLine(lettered, (await getSession())?.user.email ?? null) : null,
    date: now.toLocaleDateString("en-AU", { month: "long", year: "numeric" }),
    preparedOn: now.toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" }),
    money, tabs,
    timeline: capabilityTimeline(f.facts, RV.views, f.monthsByYear, f.firstYear, money),
    targets: f.targetChecks,
  });

  const logo = lettered
    ? await fetchLogo(FIRM_LOGO_BUCKET, lettered.logoPath)
    : await fetchLogo(LOGO_BUCKET, (settings?.logo_path as string | null) ?? null);
  const buffer = await renderDocx(doc, [], resolvePageSize(settings?.page_size as string | null, settings?.country as string | null), logo, {
    accent: wordColour(lettered?.colour ?? null),
    logoOf: lettered?.name ?? business,
  });

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${capabilityReportFileName(doc)}"`,
      "Cache-Control": "no-store",
    },
  });
}

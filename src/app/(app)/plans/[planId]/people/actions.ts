"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type Person = {
  id: string; name: string; position: string | null;
  pct_time_in_sales: number | null; pct_shareholding: number | null; annual_salary: number | null;
  salary_by_year: Record<string, number> | null;
  productivity_level: string | null; productivity_comments: string | null;
  duties: string | null; qualities: string | null; education: string | null; focus_areas: string | null;
  sort_order: number;
};

const num = (v: FormDataEntryValue | null) => { const n = parseFloat(String(v ?? "").replace(/[^0-9.-]/g, "")); return Number.isFinite(n) ? n : 0; };
const txt = (v: FormDataEntryValue | null) => { const s = String(v ?? "").trim(); return s || null; };

/** Create or update one person. Returns the row id so the client can swap a temp row for the saved one. */
export async function savePerson(planId: string, formData: FormData): Promise<{ id?: string; error?: string }> {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  const salary_by_year: Record<string, number> = {};
  for (let y = 1; y <= 5; y++) { const v = formData.get(`salary_y${y}`); if (v !== null && String(v).trim() !== "") salary_by_year[String(y)] = num(v); }
  const row = {
    plan_id: planId,
    name: String(formData.get("name") ?? "").trim(),
    position: txt(formData.get("job_title")),
    pct_shareholding: num(formData.get("pct_shareholding")),
    annual_salary: num(formData.get("annual_salary")),
    salary_by_year,
    productivity_level: txt(formData.get("productivity_level")),
    productivity_comments: txt(formData.get("productivity_comments")),
    duties: txt(formData.get("duties")), qualities: txt(formData.get("qualities")),
    education: txt(formData.get("education")), focus_areas: txt(formData.get("focus_areas")),
  };
  if (!row.name) return { error: "Give this person a name." };
  const q = id
    ? supabase.from("plan_people").update(row).eq("id", id).eq("plan_id", planId).select("id").single()
    : supabase.from("plan_people").insert({ ...row, sort_order: -Date.now() }).select("id").single();
  const { data, error } = await q;
  if (error) return { error: "Couldn't save. Check your connection and try again." };
  revalidatePath(`/plans/${planId}`, "layout");
  return { id: data.id };
}

export async function deletePerson(planId: string, id: string) {
  const supabase = await createClient();
  await supabase.from("plan_people").delete().eq("id", id).eq("plan_id", planId);
  revalidatePath(`/plans/${planId}`, "layout");
}

export async function continueFromPeople(planId: string, intent: "next" | "later") {
  redirect(intent === "next" ? `/plans/${planId}/marketing` : `/plans/${planId}/dashboard`);
}

"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { SalaryAdjustments } from "@/engine/people/salary";

export type Person = {
  id: string; plan_id: string; first_name: string; last_name: string | null; name: string; position: string | null;
  pct_shareholding: number | null; annual_salary: number | null;
  salary_start_year: number; salary_adjustments: SalaryAdjustments | null;
  productivity_level: string | null; productivity_comments: string | null; sort_order: number;
};
export type Duty = { id: string; person_id: string; duty: string; sort_order: number };
export type Quality = { id: string; person_id: string; kind: string; description: string; sort_order: number };
export type Education = { id: string; person_id: string; kind: string; institution: string; year_completed: string | null; description: string | null; sort_order: number };
export type Focus = { id: string; person_id: string; focus_area: string; description: string | null; priority: string; target_date: string | null; sort_order: number };
export type PeopleData = { people: Person[]; duties: Duty[]; qualities: Quality[]; education: Education[]; focus: Focus[] };

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };
const fail = (e: { message: string }, what: string): Result<never> => { console.error(what, e); return { ok: false, error: `Couldn't save ${what}: ${e.message}` }; };
const touch = (planId: string) => revalidatePath(`/plans/${planId}`, "layout");

// ---------- person ----------
export async function upsertPerson(planId: string, p: Partial<Person> & { id?: string }): Promise<Result<{ id: string }>> {
  const supabase = await createClient();
  const row = {
    plan_id: planId,
    first_name: (p.first_name ?? "").trim(),
    last_name: p.last_name?.trim() || null,
    position: p.position?.trim() || null,
    pct_shareholding: Number(p.pct_shareholding) || 0,
    annual_salary: Number(p.annual_salary) || 0,
    salary_start_year: Math.min(5, Math.max(1, Number(p.salary_start_year) || 1)),
    salary_adjustments: p.salary_adjustments ?? {},
    productivity_level: p.productivity_level || null,
    productivity_comments: p.productivity_comments?.trim() || null,
  };
  if (!row.first_name) return { ok: false, error: "Give this person a first name." };
  const q = p.id
    ? supabase.from("plan_people").update(row).eq("id", p.id).eq("plan_id", planId).select("id").single()
    : supabase.from("plan_people").insert({ ...row, sort_order: -Math.floor(Date.now() / 1000) }).select("id").single();
  const { data, error } = await q;
  if (error) return fail(error, "person");
  touch(planId);
  return { ok: true, data: { id: data.id } };
}

export async function deletePerson(planId: string, id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("plan_people").delete().eq("id", id).eq("plan_id", planId);
  if (error) return fail(error, "removal");
  touch(planId); return { ok: true };
}

// ---------- per-person lists (one generic set of actions) ----------
export type ListKind = "duties" | "qualities" | "education" | "focus";
const TABLE: Record<ListKind, string> = { duties: "plan_people_duties", qualities: "plan_people_qualities", education: "plan_people_education", focus: "plan_people_focus" };

export async function upsertListItem(planId: string, kind: ListKind, personId: string, item: Record<string, unknown> & { id?: string }): Promise<Result<{ id: string }>> {
  const supabase = await createClient();
  const { id, ...fields } = item;
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) clean[k] = typeof v === "string" ? (v.trim() || null) : v;
  const q = id
    ? supabase.from(TABLE[kind]).update(clean).eq("id", id).eq("plan_id", planId).select("id").single()
    : supabase.from(TABLE[kind]).insert({ ...clean, plan_id: planId, person_id: personId }).select("id").single();
  const { data, error } = await q;
  if (error) return fail(error, kind);
  touch(planId);
  return { ok: true, data: { id: data.id } };
}

export async function deleteListItem(planId: string, kind: ListKind, id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from(TABLE[kind]).delete().eq("id", id).eq("plan_id", planId);
  if (error) return fail(error, "removal");
  touch(planId); return { ok: true };
}

export async function continueFromPeople(planId: string, intent: "next" | "later") {
  redirect(intent === "next" ? `/plans/${planId}/marketing` : `/plans/${planId}/dashboard`);
}

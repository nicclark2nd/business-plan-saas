"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

import { PERSON_ROLES, CAPABILITY_KINDS, parseMonth, type Person, type Capability, type CapabilityKind } from "./model";

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };
const fail = (e: { message: string }, what: string): Result<never> => { console.error(what, e); return { ok: false, error: `Couldn't save ${what}: ${e.message}` }; };
const touch = (planId: string) => revalidatePath(`/plans/${planId}`, "layout");

// ---------- person ----------
export async function upsertPerson(planId: string, p: Partial<Person> & { id?: string; started_text?: string }): Promise<Result<{ id: string; started_on: string | null }>> {
  const supabase = await createClient();
  const started = p.started_text !== undefined ? parseMonth(p.started_text) : p.started_on;
  if (started === undefined) return { ok: false, error: "Started should be a month and year, e.g. Mar 2020." };
  const row = {
    plan_id: planId,
    first_name: (p.first_name ?? "").trim(),
    last_name: p.last_name?.trim() || null,
    position: p.position?.trim() || null,
    role: (PERSON_ROLES as readonly string[]).includes(p.role ?? "") ? p.role : "employee",
    pct_shareholding: Number(p.pct_shareholding) || 0,
    annual_salary: Number(p.annual_salary) || 0,
    started_on: started ?? null,
    salary_adjustments: p.salary_adjustments ?? {},
  };
  if (!row.first_name) return { ok: false, error: "Give this person a first name." };
  const q = p.id
    ? supabase.from("plan_people").update(row).eq("id", p.id).eq("plan_id", planId).select("id, started_on").single()
    : supabase.from("plan_people").insert({ ...row, sort_order: -Math.floor(Date.now() / 1000) }).select("id, started_on").single();
  const { data, error } = await q;
  if (error) return fail(error, "person");
  touch(planId);
  return { ok: true, data: { id: data.id, started_on: data.started_on } };
}

export async function deletePerson(planId: string, id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("plan_people").delete().eq("id", id).eq("plan_id", planId);
  if (error) return fail(error, "removal");
  touch(planId); return { ok: true };
}

// ---------- capabilities (one typed list per person) ----------
export async function upsertCapability(planId: string, c: Partial<Capability> & { person_id: string }): Promise<Result<{ id: string }>> {
  const supabase = await createClient();
  const kind: CapabilityKind = (CAPABILITY_KINDS as readonly string[]).includes(c.kind ?? "") ? c.kind! : "responsibility";
  const row = { plan_id: planId, person_id: c.person_id, kind, description: (c.description ?? "").trim(), internal: c.internal ?? kind === "development" };
  if (!row.description) return { ok: false, error: "Write a line first." };
  const q = c.id
    ? supabase.from("plan_people_capabilities").update(row).eq("id", c.id).eq("plan_id", planId).select("id").single()
    : supabase.from("plan_people_capabilities").insert({ ...row, sort_order: -Math.floor(Date.now() / 1000) }).select("id").single();
  const { data, error } = await q;
  if (error) return fail(error, "capability");
  touch(planId);
  return { ok: true, data: { id: data.id } };
}

export async function deleteCapability(planId: string, id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("plan_people_capabilities").delete().eq("id", id).eq("plan_id", planId);
  if (error) return fail(error, "removal");
  touch(planId); return { ok: true };
}

export async function continueFromPeople(planId: string, intent: "next" | "later") {
  redirect(intent === "next" ? `/plans/${planId}/marketing` : `/plans/${planId}/dashboard`);
}

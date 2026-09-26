"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

import { PERSON_ROLES, CAPABILITY_KINDS, parseMonth, type Person, type Capability, type CapabilityKind } from "./model";
import { TRANSFER_FACTORS, type TransferFactor } from "@/engine/capability/judgements";
import { nextHref } from "@/lib/nav";
import { failed } from "@/lib/actionFailed";

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };
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
  if (error) return failed(error, "save the person");
  touch(planId);
  return { ok: true, data: { id: data.id, started_on: data.started_on } };
}

export async function deletePerson(planId: string, id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("plan_people").delete().eq("id", id).eq("plan_id", planId);
  if (error) return failed(error, "remove the person");
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
  if (error) return failed(error, "save the capability");
  touch(planId);
  return { ok: true, data: { id: data.id } };
}

export async function deleteCapability(planId: string, id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("plan_people_capabilities").delete().eq("id", id).eq("plan_id", planId);
  if (error) return failed(error, "remove the capability");
  touch(planId); return { ok: true };
}

// ---------- risk & succession: would it survive a change of owner? ----------
/**
 * One of the six judgements (§6.129).
 *
 * A SCORE OF NULL DELETES THE ROW rather than storing a nought. The average is taken over what was actually
 * scored, and the screen says "4 of 6 scored" — both of which need "unjudged" to be the absence of a row,
 * not a value in one. Scoring something 0 out of 5 would drag the average down and claim a finding nobody
 * made (§6.89).
 *
 * A NOTE WITHOUT A SCORE IS KEPT, because somebody typing "every quote still goes through Dave" before they
 * have decided on a number has done the useful half of the work. That row carries a note and no score, so
 * the count and the average still exclude it.
 */
export async function saveTransferRating(planId: string, factor: TransferFactor, score: number | null, note: string | null): Promise<Result> {
  if (!TRANSFER_FACTORS.some((f) => f.key === factor)) return { ok: false, error: "That is not one of the six factors." };
  const supabase = await createClient();
  const text = (note ?? "").trim() || null;

  if (score === null && !text) {
    const { error } = await supabase.from("plan_transfer_ratings").delete().eq("plan_id", planId).eq("factor", factor);
    if (error) return failed(error, "clear that judgement");
    touch(planId); return { ok: true };
  }

  const n = score === null ? null : Math.min(5, Math.max(1, Math.round(score)));
  /*
   * The column is NOT NULL, so a note-without-a-score cannot be stored as a null score. It is stored with
   * the score column absent from the patch on an update, and — on an insert, where something must go in —
   * the row simply is not written until a score exists. The screen keeps the typed note in state meanwhile
   * and saves it the moment a number is chosen, which is the behaviour a client expects anyway.
   */
  if (n === null) {
    const { error } = await supabase.from("plan_transfer_ratings").update({ note: text })
      .eq("plan_id", planId).eq("factor", factor);
    if (error) return failed(error, "save that note");
    touch(planId); return { ok: true };
  }

  const { error } = await supabase.from("plan_transfer_ratings")
    .upsert({ plan_id: planId, factor, score: n, note: text }, { onConflict: "plan_id,factor" });
  if (error) return failed(error, "save that judgement");
  touch(planId); return { ok: true };
}

export async function continueFromPeople(planId: string, intent: "next" | "later") {
  redirect(intent === "next" ? nextHref(planId, "people") : `/plans/${planId}/dashboard`);
}

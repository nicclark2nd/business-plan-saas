"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { distributionValid, type Growth, type MonthlyDistribution } from "@/engine/sales/projection";

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };
const touch = (planId: string) => revalidatePath(`/plans/${planId}`, "layout");
const LIFECYCLES = ["development", "introduction", "growth", "maturity", "saturation", "decline"];

export async function upsertProduct(planId: string, p: {
  id?: string; name: string; description?: string | null; notes?: string | null; lifecycle?: string | null;
  average_price: number; units_sold: number; start_selling_year: number; yearly_growth?: Growth | null; monthly_distribution?: MonthlyDistribution | null;
}): Promise<Result<{ id: string }>> {
  const supabase = await createClient();
  const name = (p.name ?? "").trim();
  if (!name) return { ok: false, error: "Give the product a name." };
  if (p.monthly_distribution && !distributionValid(p.monthly_distribution)) return { ok: false, error: "The monthly split must add up to 100%." };
  const growth: Growth = {};
  for (const y of ["1", "2", "3", "4", "5"]) {
    const g = p.yearly_growth?.[y]; if (!g) continue;
    const price = Number(g.price), units = Number(g.units);
    growth[y] = { price: Number.isFinite(price) ? Math.max(-100, Math.min(1000, price)) : 0, units: Number.isFinite(units) ? Math.max(-100, Math.min(1000, units)) : 0 };
  }
  const row = {
    plan_id: planId, name, description: p.description?.trim() || null, notes: p.notes?.trim() || null,
    lifecycle: LIFECYCLES.includes(p.lifecycle ?? "") ? p.lifecycle : null,
    average_price: Math.max(0, Number(p.average_price) || 0), units_sold: Math.max(0, Number(p.units_sold) || 0),
    start_selling_year: Math.min(5, Math.max(1, Math.trunc(Number(p.start_selling_year)) || 1)),
    yearly_growth: growth, monthly_distribution: p.monthly_distribution ?? null,
  };
  const q = p.id
    ? supabase.from("plan_products").update(row).eq("id", p.id).eq("plan_id", planId).select("id").single()
    : supabase.from("plan_products").insert({ ...row, sort_order: -Math.floor(Date.now() / 1000) }).select("id").single();
  const { data, error } = await q;
  if (error) { console.error("product", error); return { ok: false, error: `Couldn't save: ${error.message}` }; }
  touch(planId);
  return { ok: true, data: { id: data.id } };
}

export async function deleteProduct(planId: string, id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("plan_products").delete().eq("id", id).eq("plan_id", planId);
  if (error) return { ok: false, error: error.message };
  touch(planId); return { ok: true };
}

export async function continueFromSales(planId: string, intent: "next" | "later") {
  redirect(intent === "next" ? `/plans/${planId}/cogs` : `/plans/${planId}/dashboard`);
}

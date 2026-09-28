"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { failed } from "@/lib/actionFailed";
import { loadFirm } from "@/lib/firm";
import { cleanColour } from "@/engine/plan/brand";
import { checkLogo, firmLogoObjectPath, FIRM_LOGO_BUCKET } from "@/engine/plan/logo";

type Result = { ok: true } | { ok: false; error: string };

/**
 * THE FIRM'S LETTERHEAD (§6.180): name, colour and logo, set once and used on every client's report.
 *
 * Each action takes the PLAN it was pressed on and works out the firm from that, on the server. The browser
 * never names an organisation, so a Planner cannot restyle a firm they merely have a plan in — and the
 * database's own policies (0001, 0058) refuse it a second time if this check were ever wrong.
 */
async function adminFirm(planId: string) {
  const firm = await loadFirm(planId);
  if (!firm) return { firm: null, error: "Couldn't find the firm this plan belongs to." } as const;
  if (!firm.isAdmin) return { firm: null, error: "Only your firm's admin can change the firm's letterhead." } as const;
  return { firm, error: null } as const;
}

export async function saveFirm(planId: string, patch: { name?: string; colour?: string | null }): Promise<Result> {
  const { firm, error: denied } = await adminFirm(planId);
  if (!firm) return { ok: false, error: denied };
  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) {
    const name = String(patch.name).trim();
    if (!name) return { ok: false, error: "The firm needs a name — it goes on the cover of every report." };
    if (name.length > 120) return { ok: false, error: "That name is longer than 120 characters." };
    row.name = name;
  }
  if (patch.colour !== undefined) {
    const c = patch.colour === null || patch.colour === "" ? null : cleanColour(patch.colour);
    if (patch.colour && !c) return { ok: false, error: "That is not a colour. Use six digits like #1F3A5F." };
    row.brand_colour = c;
  }
  if (!Object.keys(row).length) return { ok: true };
  const supabase = await createClient();
  const { error } = await supabase.from("organisations").update(row).eq("id", firm.orgId);
  if (error) return failed(error, "save the firm's letterhead");
  revalidatePath(`/plans/${planId}/settings`);
  return { ok: true };
}

/** Same rules as the plan's logo (§6.94): checked here, one object per firm, the old one removed on a change of format. */
export async function uploadFirmLogo(planId: string, form: FormData): Promise<Result> {
  const { firm, error: denied } = await adminFirm(planId);
  if (!firm) return { ok: false, error: denied };
  const file = form.get("logo");
  if (!(file instanceof File)) return { ok: false, error: "No file arrived — try choosing it again." };
  const check = checkLogo({ type: file.type, size: file.size, name: file.name });
  if (!check.ok) return { ok: false, error: check.error };

  const supabase = await createClient();
  const path = firmLogoObjectPath(firm.orgId, check.ext);
  const { error: upload } = await supabase.storage.from(FIRM_LOGO_BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type, cacheControl: "3600" });
  if (upload) return failed(upload, "save that logo");
  if (firm.logoPath && firm.logoPath !== path) await supabase.storage.from(FIRM_LOGO_BUCKET).remove([firm.logoPath]);

  const { error } = await supabase.from("organisations").update({ logo_path: path }).eq("id", firm.orgId);
  if (error) return failed(error, "save the logo");
  revalidatePath(`/plans/${planId}/settings`);
  return { ok: true };
}

export async function removeFirmLogo(planId: string): Promise<Result> {
  const { firm, error: denied } = await adminFirm(planId);
  if (!firm) return { ok: false, error: denied };
  const supabase = await createClient();
  if (firm.logoPath) await supabase.storage.from(FIRM_LOGO_BUCKET).remove([firm.logoPath]);
  const { error } = await supabase.from("organisations").update({ logo_path: null }).eq("id", firm.orgId);
  if (error) return failed(error, "remove the logo");
  revalidatePath(`/plans/${planId}/settings`);
  return { ok: true };
}

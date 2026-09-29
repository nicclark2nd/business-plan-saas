"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/plan";
import { failed } from "@/lib/actionFailed";
import { loadMyFirm } from "@/lib/myFirm";
import { createPlan, readNewPlan } from "@/lib/createPlan";
import { cleanColour } from "@/engine/plan/brand";
import { planLimitMessage } from "@/lib/billing";
import { checkLogo, firmLogoObjectPath, FIRM_LOGO_BUCKET, PHOTO_BUCKET } from "@/engine/plan/logo";

type Result = { ok: true } | { ok: false; error: string };

/**
 * THE CONSULTANT'S OWN AREA — every change it can make (§6.182).
 *
 * Each action works out the firm from the person signed in (`loadMyFirm`), never from anything the browser
 * sends. The database refuses a second time if that were ever wrong: only a firm admin may update the firm
 * (0001), only its admins may write its logo (0058), and a person may only change their own profile.
 */

/* ---------------------------------------------------------------- the firm ---- */

const FIRM_TEXT = {
  name: 120, address_line: 200, city: 80, region: 80, postcode: 20, phone: 40, website: 200,
  business_number: 40, prepared_by: 200, country: 80,
} as const;
export type FirmPatch = Partial<Record<keyof typeof FIRM_TEXT, string | null>> & {
  colour?: string | null; default_page_size?: "a4" | "letter" | null;
};

async function adminFirm() {
  const firm = await loadMyFirm();
  if (!firm) return { firm: null, error: "You are not signed in to a firm." } as const;
  if (firm.role !== "admin") return { firm: null, error: "Only your firm's admin can change the firm's details." } as const;
  return { firm, error: null } as const;
}

export async function saveFirm(patch: FirmPatch): Promise<Result> {
  const { firm, error: denied } = await adminFirm();
  if (!firm) return { ok: false, error: denied };
  const row: Record<string, unknown> = {};
  for (const [k, max] of Object.entries(FIRM_TEXT)) {
    const v = patch[k as keyof typeof FIRM_TEXT];
    if (v === undefined) continue;
    const t = String(v ?? "").trim();
    if (t.length > max) return { ok: false, error: `That is longer than ${max} characters.` };
    if (k === "name" && !t) return { ok: false, error: "The firm needs a name — it goes on every report you send." };
    row[k] = t || null;
  }
  if (patch.colour !== undefined) {
    const c = patch.colour ? cleanColour(patch.colour) : null;
    if (patch.colour && !c) return { ok: false, error: "That is not a colour. Use six digits like #1F3A5F." };
    row.brand_colour = c;
  }
  if (patch.default_page_size !== undefined) {
    row.default_page_size = patch.default_page_size === "a4" || patch.default_page_size === "letter" ? patch.default_page_size : null;
  }
  if (!Object.keys(row).length) return { ok: true };
  const supabase = await createClient();
  const { error } = await supabase.from("organisations").update(row).eq("id", firm.id);
  if (error) return failed(error, "save the firm's details");
  revalidatePath("/firm", "layout");
  return { ok: true };
}

/** Same rules as the plan's logo (§6.94): checked here, one object per firm, the old one removed on a change of format. */
export async function uploadFirmLogo(form: FormData): Promise<Result> {
  const { firm, error: denied } = await adminFirm();
  if (!firm) return { ok: false, error: denied };
  const file = form.get("logo");
  if (!(file instanceof File)) return { ok: false, error: "No file arrived — try choosing it again." };
  const check = checkLogo({ type: file.type, size: file.size, name: file.name });
  if (!check.ok) return { ok: false, error: check.error };

  const supabase = await createClient();
  const path = firmLogoObjectPath(firm.id, check.ext);
  const { error: upload } = await supabase.storage.from(FIRM_LOGO_BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type, cacheControl: "3600" });
  if (upload) return failed(upload, "save that logo");
  if (firm.logoPath && firm.logoPath !== path) await supabase.storage.from(FIRM_LOGO_BUCKET).remove([firm.logoPath]);
  const { error } = await supabase.from("organisations").update({ logo_path: path }).eq("id", firm.id);
  if (error) return failed(error, "save the logo");
  revalidatePath("/firm", "layout");
  return { ok: true };
}

export async function removeFirmLogo(): Promise<Result> {
  const { firm, error: denied } = await adminFirm();
  if (!firm) return { ok: false, error: denied };
  const supabase = await createClient();
  if (firm.logoPath) await supabase.storage.from(FIRM_LOGO_BUCKET).remove([firm.logoPath]);
  const { error } = await supabase.from("organisations").update({ logo_path: null }).eq("id", firm.id);
  if (error) return failed(error, "remove the logo");
  revalidatePath("/firm", "layout");
  return { ok: true };
}

/* ---------------------------------------------------------------- the person ---- */

export type ProfilePatch = { full_name?: string; title?: string | null; phone?: string | null };

export async function saveProfile(patch: ProfilePatch): Promise<Result> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Sign in again." };
  const row: Record<string, unknown> = {};
  if (patch.full_name !== undefined) {
    const t = String(patch.full_name).trim();
    if (!t) return { ok: false, error: "Your name goes on what you send clients — it can't be blank." };
    if (t.length > 120) return { ok: false, error: "That name is longer than 120 characters." };
    row.full_name = t;
  }
  for (const k of ["title", "phone"] as const) {
    if (patch[k] === undefined) continue;
    const t = String(patch[k] ?? "").trim();
    if (t.length > 80) return { ok: false, error: "That is longer than 80 characters." };
    row[k] = t || null;
  }
  if (!Object.keys(row).length) return { ok: true };
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update(row).eq("id", session.user.id);
  if (error) return failed(error, "save your details");
  revalidatePath("/firm", "layout");
  return { ok: true };
}

/**
 * THE PHOTO (§6.190): the square fitted into the circle, and — when a new file was chosen — the original it was
 * cut from, so "Adjust" can reopen the whole picture later. Both are checked here as well as in the browser.
 * The square lives at `<id>/photo.jpg`, the original at `<id>/original` (its type travels as the content type).
 */
export async function uploadPhoto(form: FormData): Promise<Result> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Sign in again." };
  const photo = form.get("photo") ?? form.get("logo");
  const original = form.get("original");
  if (!(photo instanceof File)) return { ok: false, error: "No photo arrived — try choosing it again." };
  for (const f of [photo, original]) {
    if (!(f instanceof File)) continue;
    const check = checkLogo({ type: f.type, size: f.size, name: f.name });
    if (!check.ok) return { ok: false, error: check.error.replace("A logo", "A photo").replace("a logo", "a photo") };
  }

  const supabase = await createClient();
  const dir = session.user.id;
  const path = `${dir}/photo.jpg`;
  const { error: upload } = await supabase.storage.from(PHOTO_BUCKET)
    .upload(path, photo, { upsert: true, contentType: "image/jpeg", cacheControl: "60" });
  if (upload) return failed(upload, "save that photo");
  if (original instanceof File) {
    const { error: up2 } = await supabase.storage.from(PHOTO_BUCKET)
      .upload(`${dir}/original`, original, { upsert: true, contentType: original.type, cacheControl: "60" });
    if (up2) console.error("photo original", up2); // the square is saved; only later re-adjusting loses the edges
  }
  const { data: me } = await supabase.from("profiles").select("*").eq("id", session.user.id).maybeSingle();
  const previous = (me as Record<string, unknown> | null)?.photo_path as string | null | undefined;
  if (previous && previous !== path && previous !== `${dir}/original`) await supabase.storage.from(PHOTO_BUCKET).remove([previous]);
  const { error } = await supabase.from("profiles").update({ photo_path: path }).eq("id", session.user.id);
  if (error) return failed(error, "save the photo");
  revalidatePath("/firm", "layout");
  return { ok: true };
}

export async function removePhoto(): Promise<Result> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Sign in again." };
  const supabase = await createClient();
  const { data: me } = await supabase.from("profiles").select("*").eq("id", session.user.id).maybeSingle();
  const previous = (me as Record<string, unknown> | null)?.photo_path as string | null | undefined;
  await supabase.storage.from(PHOTO_BUCKET).remove([previous, `${session.user.id}/original`].filter((x): x is string => !!x));
  const { error } = await supabase.from("profiles").update({ photo_path: null }).eq("id", session.user.id);
  if (error) return failed(error, "remove the photo");
  revalidatePath("/firm", "layout");
  return { ok: true };
}

/* ---------------------------------------------------------------- the clients ---- */

export type ContactPatch = Partial<Record<"contact_first_name" | "contact_family_name" | "contact_email" | "contact_phone", string | null>>;

/** The client's contact person (§6.182) — only on a plan that belongs to the consultant's own firm. */
export async function saveClientContact(planId: string, patch: ContactPatch): Promise<Result> {
  const firm = await loadMyFirm();
  if (!firm) return { ok: false, error: "You are not signed in to a firm." };
  const row: Record<string, unknown> = {};
  for (const k of ["contact_first_name", "contact_family_name", "contact_email", "contact_phone"] as const) {
    if (patch[k] === undefined) continue;
    const t = String(patch[k] ?? "").trim();
    if (t.length > 120) return { ok: false, error: "That is longer than 120 characters." };
    if (k === "contact_email" && t && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) return { ok: false, error: "That doesn't look like an email address." };
    row[k] = t || null;
  }
  if (!Object.keys(row).length) return { ok: true };
  const supabase = await createClient();
  const { data, error } = await supabase.from("plans").update(row).eq("id", planId).eq("organisation_id", firm.id).select("id");
  if (error) return failed(error, "save the contact");
  if (!data?.length) return { ok: false, error: "That business is not one of your firm's clients." };
  revalidatePath("/firm/clients");
  return { ok: true };
}

export type AddState = { error?: string } | undefined;

/** My Clients → Add new business: a plan in the consultant's own firm, never a new organisation (§6.182). */
export async function addClient(_: AddState, formData: FormData): Promise<AddState> {
  const session = await getSession();
  if (!session) redirect("/login");
  const firm = await loadMyFirm();
  if (!firm) return { error: "You are not signed in to a firm." };
  const read = readNewPlan(formData);
  if ("error" in read) return { error: read.error };
  const made = await createPlan(firm.id, session.user.id, { ...read, ownerEmail: null, pageSize: firm.defaultPageSize });
  if ("error" in made) return { error: made.error === "limit" ? planLimitMessage("firm") : made.error };
  redirect(`/firm/clients?client=${made.id}`);
}

/* ---------------------------------------------------------------- client access (§6.183) ---- */

/**
 * CREATE THE INVITATION LINK. No email is sent by the app (Nic: the email comes from the consultant, and all
 * email is built last) — the link comes back to the screen, to copy or to open in the consultant's own email.
 * The link goes to the contact person's email already saved in My Clients, so there is one address to trust.
 */
export async function inviteClient(planId: string): Promise<{ ok: true; token: string; expiresAt: string } | { ok: false; error: string }> {
  const firm = await loadMyFirm();
  if (!firm) return { ok: false, error: "You are not signed in to a firm." };
  const supabase = await createClient();
  const { data: plan } = await supabase.from("plans").select("*").eq("id", planId).eq("organisation_id", firm.id).maybeSingle();
  if (!plan) return { ok: false, error: "That business is not one of your firm's clients." };
  const email = typeof plan.contact_email === "string" ? plan.contact_email.trim() : "";
  if (!email) return { ok: false, error: "Add the contact person's email first — the invitation only works with that address." };
  const { data, error } = await supabase.rpc("create_plan_invitation", { p_plan: planId, p_email: email });
  const row = (data as { token: string; expires_at: string }[] | null)?.[0];
  if (error || !row) return failed(error, "create the invitation");
  revalidatePath("/firm/clients");
  return { ok: true, token: row.token, expiresAt: row.expires_at };
}

/** Turn the client's access off: out of the plan now, and any open link closed. They can be invited again. */
export async function revokeClientAccess(planId: string): Promise<Result> {
  const firm = await loadMyFirm();
  if (!firm) return { ok: false, error: "You are not signed in to a firm." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("revoke_client_access", { p_plan: planId });
  if (error) return failed(error, "turn off the client's access");
  revalidatePath("/firm/clients");
  return { ok: true };
}

/** Whether the client may download their own business plan (the old "Your client can print their own reports"). */
export async function setClientDownload(planId: string, allow: boolean): Promise<Result> {
  const firm = await loadMyFirm();
  if (!firm) return { ok: false, error: "You are not signed in to a firm." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_client_download", { p_plan: planId, p_allow: !!allow });
  if (error) return failed(error, "change what the client may download");
  revalidatePath("/firm/clients");
  return { ok: true };
}

/* ---------------------------------------------------------------- the team (§6.184) ---- */

const TEAM_ERRORS: [RegExp, string][] = [
  [/last admin/, "The firm needs at least one admin. Make someone else an admin first."],
  [/already in the team/, "That person is already in your team."],
  [/bad email/, "That doesn't look like an email address."],
  [/not the admin/, "Only your firm's admin can change the team."],
  [/not in the firm/, "That person is not in your team."],
];
const teamError = (e: { message?: string } | null, doing: string) => {
  const hit = TEAM_ERRORS.find(([re]) => re.test(e?.message ?? ""));
  return hit ? { ok: false as const, error: hit[1] } : failed(e, doing);
};

/** A link for a new consultant — sent from the admin's own email, like a client's (no email leaves the app). */
export async function inviteTeammate(email: string, role: "admin" | "advisor"): Promise<{ ok: true; token: string; expiresAt: string } | { ok: false; error: string }> {
  const firm = await loadMyFirm();
  if (!firm) return { ok: false, error: "You are not signed in to a firm." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_team_invitation", { p_org: firm.id, p_email: email, p_role: role });
  const row = (data as { token: string; expires_at: string }[] | null)?.[0];
  if (error || !row) return teamError(error, "create the invitation");
  revalidatePath("/firm/team");
  return { ok: true, token: row.token, expiresAt: row.expires_at };
}

export async function cancelTeamInvite(id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("revoke_team_invitation", { p_id: id });
  if (error) return teamError(error, "cancel the invitation");
  revalidatePath("/firm/team");
  return { ok: true };
}

export async function setTeamRole(userId: string, role: "admin" | "advisor"): Promise<Result> {
  const firm = await loadMyFirm();
  if (!firm) return { ok: false, error: "You are not signed in to a firm." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_team_role", { p_org: firm.id, p_user: userId, p_role: role });
  if (error) return teamError(error, "change the role");
  revalidatePath("/firm", "layout");
  return { ok: true };
}

/** Out of the firm, and off every client it holds — a plan membership does not outlive the job (0061). */
export async function removeTeammate(userId: string): Promise<Result> {
  const firm = await loadMyFirm();
  if (!firm) return { ok: false, error: "You are not signed in to a firm." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_from_team", { p_org: firm.id, p_user: userId });
  if (error) return teamError(error, "remove them from the team");
  revalidatePath("/firm", "layout");
  return { ok: true };
}

/** Who looks after a client: the admin puts a teammate on, or takes them off. */
export async function assignPlanner(planId: string, userId: string, on: boolean): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("assign_planner", { p_plan: planId, p_user: userId, p_on: on });
  if (error) return teamError(error, "change who looks after this client");
  revalidatePath("/firm", "layout");
  return { ok: true };
}

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/plan";
import { LOGO_URL_TTL_SECONDS, PHOTO_BUCKET } from "@/engine/plan/logo";
import { ProfileForm } from "./ProfileForm";

export default async function MyProfilePage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const supabase = await createClient();
  /* `*` so the page opens in the gap before migration 0059 adds title, phone and photo. */
  const { data } = await supabase.from("profiles").select("*").eq("id", session.user.id).maybeSingle();
  const me = (data ?? {}) as Record<string, unknown>;
  const photoPath = typeof me.photo_path === "string" ? me.photo_path : null;
  const sign = async (path: string) => (await supabase.storage.from(PHOTO_BUCKET).createSignedUrl(path, LOGO_URL_TTL_SECONDS)).data?.signedUrl ?? null;
  const photoUrl = photoPath ? await sign(photoPath) : null;
  /* The original the square was cut from (§6.190), for "Adjust". Missing for photos saved before it was kept. */
  const originalUrl = photoPath ? await sign(`${session.user.id}/original`) : null;
  return (
    <ProfileForm me={{
      fullName: typeof me.full_name === "string" ? me.full_name : "",
      title: typeof me.title === "string" ? me.title : null,
      phone: typeof me.phone === "string" ? me.phone : null,
      email: session.user.email ?? null, photoPath, photoUrl, originalUrl,
    }} />
  );
}

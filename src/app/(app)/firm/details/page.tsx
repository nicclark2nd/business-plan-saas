import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/plan";
import { loadMyFirm } from "@/lib/myFirm";
import { FIRM_LOGO_BUCKET, LOGO_URL_TTL_SECONDS } from "@/engine/plan/logo";
import { FirmDetails } from "./FirmDetails";

export default async function MyFirmPage() {
  const [session, firm] = await Promise.all([getSession(), loadMyFirm()]);
  if (!session || !firm) redirect("/setup");
  const supabase = await createClient();
  const logoUrl = firm.logoPath
    ? (await supabase.storage.from(FIRM_LOGO_BUCKET).createSignedUrl(firm.logoPath, LOGO_URL_TTL_SECONDS)).data?.signedUrl ?? null
    : null;
  return (
    <FirmDetails email={session.user.email ?? null} isAdmin={firm.role === "admin"} firm={{
      name: firm.name, country: firm.country, colour: firm.colour,
      addressLine: firm.addressLine, city: firm.city, region: firm.region, postcode: firm.postcode,
      phone: firm.phone, website: firm.website, businessNumber: firm.businessNumber,
      preparedBy: firm.preparedBy, defaultPageSize: firm.defaultPageSize, logoPath: firm.logoPath, logoUrl,
    }} />
  );
}

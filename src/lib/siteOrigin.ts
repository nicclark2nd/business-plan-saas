import "server-only";
import { headers } from "next/headers";

/** This deployment's own address, from the request — what an invitation link starts with (§6.183, §6.184). */
export async function siteOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return host ? `${proto}://${host}` : "";
}

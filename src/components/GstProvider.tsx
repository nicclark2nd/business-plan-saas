"use client";

import { createContext, useContext, useMemo } from "react";
import { gstSettings, taxLabel, type GstSettings } from "@/engine/plan/gst";

/**
 * Whether this plan is registered for GST / VAT, and what the tax is called here (§6.38.1).
 *
 * Four modules need the same two facts to decide whether to show a per-line flag at all, and the plan
 * layout already fetches `plan_settings` once for currency and vocabulary. Drilling registration through
 * Sales, COGS, Overheads and Assets as props would be four more arguments on four signatures for one fact
 * that never changes inside a plan — the same reasoning that put currency (§6.30) and the plan's own nouns
 * (§6.31.1) here rather than in every page.
 */
type Gst = GstSettings & { label: string };
const Ctx = createContext<Gst>({ registered: false, rate: 0, frequency: "quarterly", label: "GST" });

export function GstProvider({ registered, rate, frequency, country, children }: {
  registered: boolean | null | undefined;
  rate: number | string | null | undefined;
  frequency: string | null | undefined;
  country: string | null | undefined;
  children: React.ReactNode;
}) {
  const value = useMemo<Gst>(() => ({
    ...gstSettings({ gst_registered: !!registered, gst_rate: rate, gst_frequency: frequency }),
    label: taxLabel(country),
  }), [registered, rate, frequency, country]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useGst = () => useContext(Ctx);

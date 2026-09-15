"use client";

import { createContext, useContext, useMemo } from "react";
import { taxComponents, taxHeading } from "@/engine/plan/gst";

/**
 * Whether this plan charges any tax, and what to call it (§6.38.1).
 *
 * Four modules need the same two facts to decide whether to show a per-line flag at all, and the plan
 * layout already fetches `plan_settings` once for currency and vocabulary. Drilling this through Sales,
 * COGS, Overheads and Assets as props would be four more arguments on four signatures for one fact that
 * never changes inside a plan — the same reasoning that put currency (§6.30) and the plan's own nouns
 * (§6.31.1) here rather than in every page.
 *
 * The label is the heading across however many taxes the plan has: "GST" in Brisbane, "VAT" in Bristol,
 * "GST and PST" in Vancouver (§6.39).
 */
type Gst = { registered: boolean; label: string };
const Ctx = createContext<Gst>({ registered: false, label: "GST" });

export function GstProvider({ settings, children }: {
  settings: {
    gst_registered?: boolean | null; gst_rate?: number | string | null; gst_frequency?: string | null;
    country?: string | null; tax_region?: string | null; tax_components?: unknown;
  } | null | undefined;
  children: React.ReactNode;
}) {
  const value = useMemo<Gst>(() => {
    const cs = taxComponents(settings);
    return { registered: cs.length > 0, label: taxHeading(cs) };
  }, [settings]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useGst = () => useContext(Ctx);

"use client";

import { createContext, useContext, useMemo } from "react";
import { moneyFormatter } from "@/engine/plan/money";

/**
 * The plan's currency, once, for every module under it (§6.30).
 *
 * The plan layout already reads `plan_settings.currency` for the header chip, so this hangs off the same
 * fetch: no page needs to select it again and no module needs it threaded through as a prop. That matters
 * more than the keystrokes saved — nine modules each building their own `Intl.NumberFormat("en-AU")` is how
 * the currency setting came to be ignored everywhere but the chip that displayed it.
 *
 * `useMoney()` returns the formatter itself rather than the code, so a module never has to know which
 * locale groups which way, and a module that forgets to call it will not compile.
 */
const MoneyContext = createContext<string>("AUD");

export function MoneyProvider({ currency, children }: { currency: string; children: React.ReactNode }) {
  return <MoneyContext.Provider value={currency}>{children}</MoneyContext.Provider>;
}

/** The plan's currency code — for the rare label that names it, like the monthly split's entry switch. */
export const useCurrency = () => useContext(MoneyContext);

/** Whole units, grouped the way this plan's currency is read. Stable across renders. */
export function useMoney() {
  const currency = useContext(MoneyContext);
  return useMemo(() => moneyFormatter(currency), [currency]);
}

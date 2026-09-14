"use client";

import { createContext, useContext, useMemo } from "react";
import { customerNoun, productNoun, type Noun } from "@/engine/plan/vocabulary";

/**
 * What this plan calls a line and a buyer (§6.31.1).
 *
 * Settings holds `product_type` and `customer_type`; every screen that names a line or a buyer should say
 * what the client says. A concreter's plan reads *Services*, a physiotherapist's reads *Treatments* and
 * *Patients*, and the report that goes to the bank reads like her business rather than a template.
 *
 * It hangs off the plan layout beside `MoneyProvider` and for the same reason: the layout already loads
 * `plan_settings`, so no page selects these again and no module takes them as props. Both nouns arrive
 * inflected — `many`, `one`, `head` — because the caller must never have to guess a plural.
 */
type Vocab = { product: Noun; customer: Noun };

const VocabContext = createContext<Vocab>({
  product: productNoun(null),
  customer: customerNoun(null),
});

export function VocabularyProvider({ productType, customerType, children }: {
  productType: string | null; customerType: string | null; children: React.ReactNode;
}) {
  const value = useMemo(
    () => ({ product: productNoun(productType), customer: customerNoun(customerType) }),
    [productType, customerType],
  );
  return <VocabContext.Provider value={value}>{children}</VocabContext.Provider>;
}

/** What this plan calls one of the things it sells: Products, Services, Treatments, Crops. */
export const useProductNoun = () => useContext(VocabContext).product;

/** What this plan calls the people who buy: Customers, Clients, Patients, Members. */
export const useCustomerNoun = () => useContext(VocabContext).customer;

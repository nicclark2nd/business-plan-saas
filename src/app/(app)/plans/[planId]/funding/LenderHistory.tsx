"use client";

import { useRef, useState, useTransition } from "react";
import { Section, FieldGrid, Field, FieldSelect, FieldTextarea, FieldInput } from "@/components/module/FieldGrid";
import { Toolbar, Meta } from "@/components/module/DataGrid";
import { saveLenderHistory } from "./actions";

export type LenderHistoryValues = {
  repayments_on_time: boolean | null; covenant_history: string | null;
  guarantee_offered: boolean | null; guarantee_by: string | null;
};

const tri = (v: boolean | null) => (v === true ? "yes" : v === false ? "no" : "");
const fromTri = (v: string) => (v === "yes" ? true : v === "no" ? false : null);

/**
 * LENDER HISTORY (§6.129.3).
 *
 * The three things a credit officer asks that no forecast answers: has this business paid on time, has it
 * ever broken a covenant, and who stands behind it. They are the "beyond the numbers" half of the lender
 * checklist on Financial Capabilities, and they live here, beside the loans they are about.
 *
 * A choice saves on the choice, text when the box is left (§6.10).
 */
export function LenderHistory({ planId, initial, onError }: {
  planId: string; initial: LenderHistoryValues; onError: (message: string | null) => void;
}) {
  const [pending, start] = useTransition();
  const [v, setV] = useState({
    on: tri(initial.repayments_on_time), cov: initial.covenant_history ?? "",
    g: tri(initial.guarantee_offered), by: initial.guarantee_by ?? "",
  });
  const ref = useRef(v);
  const edit = (patch: Partial<typeof v>) => { const next = { ...ref.current, ...patch }; ref.current = next; setV(next); };
  const save = (h: Parameters<typeof saveLenderHistory>[1]) => start(async () => {
    const r = await saveLenderHistory(planId, h);
    onError(r.ok ? null : r.error);
  });

  return (
    <>
      <Toolbar><Meta className="ml-0">
        What a lender checks that no forecast can answer. Shown on Financial Capabilities as the lender&apos;s
        checklist; leave anything you have not checked as &ldquo;Not said&rdquo; rather than guessing.
      </Meta></Toolbar>
      <Section title="History with lenders">
        <FieldGrid>
          <Field label="Repayments made on time" span={2} hint="Every loan and lease repayment, for the last three years.">
            <FieldSelect value={v.on} placeholder="Not said"
              options={[{ value: "", label: "Not said" }, { value: "yes", label: "Yes, every one" }, { value: "no", label: "No — some were late or missed" }]}
              onValueChange={(x) => { edit({ on: x }); save({ repayments_on_time: fromTri(x) }); }} />
          </Field>
          <Field label="Covenant breaches" span={4}
            hint="Any time a loan condition was broken — a ratio missed, a report late — and what the lender did. Write &ldquo;None&rdquo; if there were none.">
            <FieldTextarea value={v.cov} disabled={pending} placeholder="e.g. None. / One breach of the cover covenant in FY24, waived by the bank."
              onChange={(e) => edit({ cov: e.target.value })} onBlur={() => save({ covenant_history: ref.current.cov })} />
          </Field>
        </FieldGrid>
      </Section>
      <Section title="Who stands behind it">
        <FieldGrid>
          <Field label="Personal guarantee offered" span={2} hint="Most small-business lending asks for one.">
            <FieldSelect value={v.g} placeholder="Not said"
              options={[{ value: "", label: "Not said" }, { value: "yes", label: "Yes" }, { value: "no", label: "No" }]}
              onValueChange={(x) => { edit({ g: x }); save({ guarantee_offered: fromTri(x) }); }} />
          </Field>
          <Field label="Guaranteed by" span={2} hint="Who signs it — the directors, a parent company.">
            <FieldInput value={v.by} disabled={pending || v.g !== "yes"} placeholder={v.g === "yes" ? "e.g. Both directors" : "—"}
              onChange={(e) => edit({ by: e.target.value })} onBlur={() => save({ guarantee_by: ref.current.by })} />
          </Field>
        </FieldGrid>
      </Section>
    </>
  );
}

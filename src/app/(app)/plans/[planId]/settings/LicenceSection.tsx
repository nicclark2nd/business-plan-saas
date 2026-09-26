"use client";

import { useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { Section } from "@/components/module/FieldGrid";
import { Grid, Th, Td, Row as GridRow, CellInput, RemoveButton, Note, focusRow } from "@/components/module/DataGrid";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { licenceState, formatExpiry } from "@/engine/plan/licences";
import { saveLicence, deleteLicence } from "./actions";
import { useRowSaves } from "@/lib/rowSaves";
import type { Licence } from "./model";

type Row_ = Licence & { _dirty?: boolean; _error?: string };

/**
 * What the BUSINESS is licensed, registered or insured to do (§6.64).
 *
 * It sits under the identity fields rather than on a step of its own because this is the module that opens
 * every report's business overview: legal structure, years trading, and what the business is allowed to do,
 * which is the order a lender reads them in.
 *
 * There is deliberately no blank first row. A grid that always shows one empty line reads as an obligation,
 * and a bookkeeper with no trade licence would be looking at a form asking her for something she does not
 * have. Nothing here is required of anybody.
 */
export function LicenceSection({ planId, initial, onPending }: {
  planId: string; initial: Licence[]; onPending: (busy: boolean, error?: string) => void;
}) {
  const [rows, setRows] = useState<Row_[]>(initial);
  const [pending, start] = useTransition();
  const rowsRef = useRef(rows); useEffect(() => { rowsRef.current = rows; }, [rows]);
  /**
   * Today is read after mount, never during render. This is a client component that Next still renders on
   * the server, so a date taken during render is the SERVER's date — and a plan opened either side of
   * midnight would hydrate with two different answers to "has this lapsed". Until it is known, no row
   * claims anything.
   */
  const today = useSyncExternalStore(
    () => () => {},                                   // nothing to subscribe to: the date is read, never watched
    () => new Date().toISOString().slice(0, 10),      // on the client
    () => null,                                       // on the server: no claim at all
  );

  const err = rows.find((r) => r._error)?._error;
  useEffect(() => { onPending(pending, err); }, [pending, err, onPending]);

  /*
   * EACH BOX SAVES AS IT IS LEFT, QUEUED PER LICENCE (§6.131, see src/lib/rowSaves.ts). The list is written
   * to its ref on the edit, so the save always reads what was typed.
   */
  const rs = useRowSaves();
  const put = (fn: (xs: Row_[]) => Row_[]) => { const next = fn(rowsRef.current); rowsRef.current = next; setRows(next); };
  const edit = (id: string, changes: Partial<Licence>) =>
    /* Typing no longer erases the reason a licence would not save (§6.98). */
    put((xs) => xs.map((x) => (rs.same(x.id, id) ? { ...x, ...changes, _dirty: true } : x)));

  const commit = (id: string) => start(() => rs.queue("licence", id, async () => {
    const row = rowsRef.current.find((x) => rs.same(x.id, id));
    if (!row || !row._dirty) return;
    // A row with no name has nothing to save yet; it is a line somebody has started, not an error.
    if (!row.name.trim()) return;
    put((xs) => xs.map((x) => (rs.same(x.id, id) ? { ...x, _dirty: false } : x)));
    const r = await saveLicence(planId, { ...row, id: rs.realId(row.id) });
    if (!r.ok) { put((xs) => xs.map((x) => (rs.same(x.id, id) ? { ...x, _dirty: true, _error: r.error } : x))); return; }
    rs.adopt(row.id, r.id);
    put((xs) => xs.map((x) => (rs.same(x.id, id) ? { ...x, id: r.id, _error: undefined } : x)));
  }));

  const add = () => {
    const tmp = `tmp-${crypto.randomUUID()}`;
    put((xs) => [...xs, { id: tmp, name: "", number: null, issuer: null, expires_on: null, sort_order: xs.length }]);
    focusRow(`[data-licence="${tmp}"]`);
  };
  const remove = (id: string) => {
    put((xs) => xs.filter((x) => !rs.same(x.id, id)));
    /* Behind any save still running for the licence, so a first save in flight cannot land after the delete. */
    start(() => rs.queue("licence", id, async () => {
      const stored = rs.realId(id);
      if (stored) await deleteLicence(planId, stored);
    }));
  };

  return (
    <>
      <Section title="Licences, registrations and insurances"
        tail={<Button size="sm" variant="outline" type="button" onClick={add}>+ Licence</Button>}>
        <p className="text-[12px] text-muted-foreground">
          What the <b>business</b> holds — a contractor or trade licence, an industry registration, the
          insurances a client asks to see. A person&apos;s own ticket belongs on their bio in Leadership Team,
          under Roles &amp; Capability: this is what the entity is allowed to do, and it outlives whoever
          happens to be on the payroll.
        </p>
      </Section>

      {rows.length === 0 ? (
        <Note>Nothing here yet — and for plenty of businesses that is the right answer. A licensed trade is not.</Note>
      ) : (
        <Grid>
          <thead><tr>
            <Th style={{ width: "34%" }}>Licence or registration</Th>
            <Th style={{ width: "16%" }}>Number</Th>
            <Th style={{ width: "28%" }}>Issued by</Th>
            <Th style={{ width: "14%" }}>Expires</Th>
            <Th style={{ width: 104 }} />
          </tr></thead>
          <tbody>
            {rows.map((l) => {
              const state = today ? licenceState(l.expires_on, today) : "current";
              return (
                <GridRow key={rs.keyOf(l.id)} data-licence={l.id} onBlur={() => commit(l.id)}
                  className={cn(l._error && "[&>td]:bg-bad-soft")} title={l._error}>
                  <Td><CellInput value={l.name} placeholder="e.g. QBCC contractor licence — concreting" className="font-semibold"
                    onChange={(e) => edit(l.id, { name: e.target.value })} /></Td>
                  <Td><CellInput value={l.number ?? ""} placeholder="Number"
                    onChange={(e) => edit(l.id, { number: e.target.value })} /></Td>
                  <Td><CellInput value={l.issuer ?? ""} placeholder="Who issues it"
                    onChange={(e) => edit(l.id, { issuer: e.target.value })} /></Td>
                  <Td><CellInput type="date" value={l.expires_on ?? ""}
                    className={cn(state === "lapsed" && "text-bad font-semibold", state === "soon" && "text-warn")}
                    onChange={(e) => edit(l.id, { expires_on: e.target.value || null })} /></Td>
                  <Td>
                    {/* The chip says only "lapsed": the date is already red in the cell beside it, and
                        repeating it here overflowed the column (§6.64). */}
                    {state === "lapsed" && <span className="mr-1.5 text-[9.5px] uppercase tracking-[.06em] text-bad" title={`Expired ${formatExpiry(l.expires_on)}`}>lapsed</span>}
                    {state === "soon" && <span className="mr-1.5 text-[9.5px] uppercase tracking-[.06em] text-warn">renew</span>}
                    <RemoveButton onClick={() => remove(l.id)} />
                  </Td>
                </GridRow>
              );
            })}
          </tbody>
        </Grid>
      )}
    </>
  );
}

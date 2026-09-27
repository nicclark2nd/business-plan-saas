"use client";

import { guarded } from "@/lib/guardedStart";
import { useRowSaves } from "@/lib/rowSaves";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ModuleFrame, ModuleStatusFooter, useModule } from "@/components/module/ModuleFrame";
import { useSaveErrors } from "@/components/module/saveErrors";
import { Grid, Th, Td, Toolbar, Meta, Note, RemoveButton, CellInput, CellSelect, CellTextarea, focusRow } from "@/components/module/DataGrid";
import { ConfirmDelete } from "@/components/module/ConfirmDelete";
import { navGroup } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { IP_TYPES, type AreaKey, type Ip, type Membership, type Social } from "./model";
import { deleteAsset, upsertAsset } from "./actions";

/**
 * ASSETS (§6.147): Social media · Memberships · Intellectual property, one screen with three areas, the
 * way Leadership Team has four. Its route is `registers`, because `assets` is Fixed Assets (step 12) —
 * this screen was first written over it and put back before it left the machine.
 *
 * way Leadership Team has four. Each menu item opens its own area, and moving between areas moves the URL
 * so the menu lights the right one.
 *
 * The save pattern is Operations' (§6.131, §6.138): every box saves as it is left, queued per row; a new
 * row with no name waits quietly; a save that never arrives puts the row back to unsaved.
 */
type Dirty = { _dirty?: boolean };
type AnyRow = Record<string, unknown> & Dirty & { id: string };
const REQUIRED: Record<AreaKey, string> = { social: "platform", memberships: "organisation_name", ip: "name" };
const LABEL: Record<AreaKey, string> = { social: "Social media", memberships: "Membership", ip: "Intellectual property" };

export function RegistersModule({ planId, mode, initialArea, initialSocial, initialMemberships, initialIp }: {
  planId: string; mode: "guided" | "advanced"; initialArea: AreaKey;
  initialSocial: Social[]; initialMemberships: Membership[]; initialIp: Ip[];
}) {
  const router = useRouter();
  const [area, setArea] = useState<AreaKey>(initialArea);
  const errors = useSaveErrors();
  const [pending, startRaw] = useTransition();
  /* A save that never reaches the server is reported, not allowed to take the screen down (§6.138). */
  const start = guarded(startRaw, (message) => errors.raise({ key: "connection", message, label: "Connection" }), () => errors.clear("connection"));
  const [kill, setKill] = useState<{ kind: AreaKey; id: string; name: string } | null>(null);

  const blank: Record<AreaKey, (id: string) => AnyRow> = {
    social: (id) => ({ id, platform: "", url: null, description: null, sort_order: 0 }),
    memberships: (id) => ({ id, organisation_name: "", description: null, sort_order: 0 }),
    ip: (id) => ({ id, name: "", ip_type: null, description: null, sort_order: 0 }),
  };
  const seed = (rows: AnyRow[], kind: AreaKey) => (rows.length ? rows : [blank[kind](`tmp-${kind}`)]);
  const [social, setSocial] = useState<AnyRow[]>(() => seed(initialSocial as unknown as AnyRow[], "social"));
  const [memberships, setMemberships] = useState<AnyRow[]>(() => seed(initialMemberships as unknown as AnyRow[], "memberships"));
  const [ip, setIp] = useState<AnyRow[]>(() => seed(initialIp as unknown as AnyRow[], "ip"));
  const refs = { social: useRef(social), memberships: useRef(memberships), ip: useRef(ip) };
  const setters = { social: setSocial, memberships: setMemberships, ip: setIp };
  /* Written to the ref on the edit (§6.131), so a choice saved in the same tick sees itself. */
  const put = (kind: AreaKey) => (fn: (xs: AnyRow[]) => AnyRow[]) => {
    const next = fn(refs[kind].current);
    refs[kind].current = next;
    setters[kind](next);
  };
  const rs = useRowSaves();

  const edit = (kind: AreaKey, id: string, changes: Record<string, unknown>, immediate = false) => {
    put(kind)((xs) => xs.map((x) => (rs.same(x.id, id) ? { ...x, ...changes, _dirty: true } : x)));
    if (immediate) commit(kind, id);
  };
  const commit = (kind: AreaKey, id: string): Promise<void> => {
    const p = rs.queue(kind, id, () => saveRow(kind, id));
    start(() => p);
    return p;
  };
  const saveRow = async (kind: AreaKey, id: string) => {
    const row = refs[kind].current.find((x) => rs.same(x.id, id));
    if (!row || !row._dirty) return;
    const stored = rs.realId(row.id);
    /* A new row with no name waits, dirty and unscolded, until it has one (§6.131). */
    if (!stored && !String(row[REQUIRED[kind]] ?? "").trim()) return;
    put(kind)((xs) => xs.map((x) => (rs.same(x.id, id) ? { ...x, _dirty: false } : x)));
    let r: Awaited<ReturnType<typeof upsertAsset>>;
    try { r = await upsertAsset(planId, kind, { ...row, id: stored }); }
    catch (e) { put(kind)((xs) => xs.map((x) => (rs.same(x.id, id) ? { ...x, _dirty: true } : x))); throw e; }
    const key = `${kind}:${rs.keyOf(row.id)}`;
    if (!r.ok) {
      errors.raise({ key, message: r.error, label: LABEL[kind] });
      put(kind)((xs) => xs.map((x) => (rs.same(x.id, id) ? { ...x, _dirty: true } : x)));
      return;
    }
    errors.clear(key);
    rs.adopt(row.id, r.data!.id);
    put(kind)((xs) => xs.map((x) => (rs.same(x.id, id) ? { ...x, id: r.data!.id } : x)));
  };
  const add = (kind: AreaKey) => {
    const tmp = `tmp-${crypto.randomUUID()}`;
    put(kind)((xs) => [blank[kind](tmp), ...xs]);
    focusRow(`[data-row="${tmp}"]`);
  };
  const askRemove = (kind: AreaKey, id: string, name: string) => {
    if (!name.trim() && !rs.realId(id)) { remove(kind, id); return; }
    setKill({ kind, id, name });
  };
  const remove = (kind: AreaKey, id: string) => {
    setKill(null);
    put(kind)((xs) => { const rest = xs.filter((x) => !rs.same(x.id, id)); return rest.length ? rest : [blank[kind](`tmp-${crypto.randomUUID()}`)]; });
    /* Behind any save still running for the row, so a first save in flight cannot land after the delete. */
    start(() => rs.queue(kind, id, async () => {
      const stored = rs.realId(id);
      if (!stored) return;
      const r = await deleteAsset(planId, kind, stored);
      if (!r.ok) errors.raise({ key: `${kind}:${rs.keyOf(id)}`, message: r.error, label: "Remove" });
    }));
  };
  const flush = () => Promise.all((["social", "memberships", "ip"] as AreaKey[])
    .flatMap((k) => refs[k].current.filter((r) => r._dirty).map((r) => commit(k, r.id))));
  const go = (k: AreaKey) => {
    flush();
    setArea(k);
    router.replace(`/plans/${planId}/registers?area=${k}`, { scroll: false });
  };

  const named = (rows: AnyRow[], kind: AreaKey) => rows.filter((x) => String(x[REQUIRED[kind]] ?? "").trim());
  const dirty = [...social, ...memberships, ...ip].some((r) => r._dirty);
  const rowProps = (kind: AreaKey, x: AnyRow) => ({
    "data-row": x.id, onBlur: () => commit(kind, x.id),
    className: cn(errors.forKey(`${kind}:${rs.keyOf(x.id)}`) && "[&>td]:bg-bad-soft"),
    title: errors.forKey(`${kind}:${rs.keyOf(x.id)}`),
  });
  const text = (x: AnyRow, k: string) => (x[k] as string | null) ?? "";

  return (
    <ModuleFrame
      group={navGroup("social")} title="Assets"
      subtitle="What the business owns and belongs to that is not on the balance sheet" mode={mode}
      errors={errors}
      areas={[
        { key: "social", label: "Social media", count: named(social, "social").length },
        { key: "memberships", label: "Memberships", count: named(memberships, "memberships").length },
        { key: "ip", label: "Intellectual property", count: named(ip, "ip").length },
      ]}
      area={area} onArea={(k) => go(k as AreaKey)} scope={{ label: "This plan" }}
      primaryAction={<Button size="sm" type="button" onClick={() => add(area)}>
        {area === "social" ? "+ Account" : area === "memberships" ? "+ Membership" : "+ Right"}
      </Button>}
      footer={<ModuleStatusFooter planId={planId} />}
      help={<>
        <h3>What goes here</h3>
        <p><b>Social media</b> — the accounts people find the business through, and what each is for. Kept for you; it does not print in the plan.</p>
        <p><b>Memberships</b> — industry bodies, associations and accreditations. Membership of the body a customer checks for is worth saying out loud.</p>
        <p><b>Intellectual property</b> — trade marks, registered designs, patents, domain names, and know-how the business owns. A buyer pays for these, so name them precisely, with a registration number where there is one.</p>
        <h3>Where this goes</h3>
        <p>Memberships and intellectual property print under <b>The Business</b> in the plan, beside Licences. None of this changes a forecast figure.</p>
      </>}
    >
      <PendingBridge pending={pending} dirty={dirty} />

      {area === "social" && (
        <>
          <Toolbar><Meta className="ml-0">
            {named(social, "social").length ? `${named(social, "social").length} recorded` : "Where people find the business online, and what each account is for."}
          </Meta></Toolbar>
          <Grid>
            <thead><tr><Th style={{ width: "22%" }}>Platform</Th><Th style={{ width: "32%" }}>Address or handle</Th><Th>What it is for</Th><Th style={{ width: 36 }} /></tr></thead>
            <tbody>
              {social.map((x) => (
                <tr {...rowProps("social", x)} key={rs.keyOf(x.id)}>
                  <Td><CellInput value={text(x, "platform")} placeholder="Instagram, LinkedIn…" className="font-semibold" onChange={(e) => edit("social", x.id, { platform: e.target.value })} /></Td>
                  <Td><CellInput value={text(x, "url")} placeholder="instagram.com/yourbusiness or @handle" onChange={(e) => edit("social", x.id, { url: e.target.value })} /></Td>
                  <Td><CellTextarea value={text(x, "description")} placeholder="e.g. Finished jobs; where most homeowner enquiries start" onChange={(e) => edit("social", x.id, { description: e.target.value })} /></Td>
                  <Td><RemoveButton onClick={() => askRemove("social", x.id, text(x, "platform"))} /></Td>
                </tr>
              ))}
            </tbody>
          </Grid>
          <Note>Kept for you — social accounts do not print in the plan a lender reads.</Note>
        </>
      )}

      {area === "memberships" && (
        <>
          <Toolbar><Meta className="ml-0">
            {named(memberships, "memberships").length ? `${named(memberships, "memberships").length} recorded` : "Industry bodies, associations and accreditations the business belongs to."}
          </Meta></Toolbar>
          <Grid>
            <thead><tr><Th style={{ width: "34%" }}>Organisation</Th><Th>What it gives the business</Th><Th style={{ width: 36 }} /></tr></thead>
            <tbody>
              {memberships.map((x) => (
                <tr {...rowProps("memberships", x)} key={rs.keyOf(x.id)}>
                  <Td><CellInput value={text(x, "organisation_name")} placeholder="e.g. Master Builders Queensland" className="font-semibold" onChange={(e) => edit("memberships", x.id, { organisation_name: e.target.value })} /></Td>
                  <Td><CellTextarea value={text(x, "description")} placeholder="e.g. Contract templates, dispute support, and the logo builders look for on a quote" onChange={(e) => edit("memberships", x.id, { description: e.target.value })} /></Td>
                  <Td><RemoveButton onClick={() => askRemove("memberships", x.id, text(x, "organisation_name"))} /></Td>
                </tr>
              ))}
            </tbody>
          </Grid>
          <Note>Prints under The Business in the plan, as &ldquo;Memberships and accreditations&rdquo;.</Note>
        </>
      )}

      {area === "ip" && (
        <>
          <Toolbar><Meta className="ml-0">
            {named(ip, "ip").length ? `${named(ip, "ip").length} recorded` : "Trade marks, designs, domain names and know-how the business owns — the things a buyer pays for that are not equipment."}
          </Meta></Toolbar>
          <Grid>
            <thead><tr><Th style={{ width: "28%" }}>Name</Th><Th style={{ width: 190 }}>Type</Th><Th>Description</Th><Th style={{ width: 36 }} /></tr></thead>
            <tbody>
              {ip.map((x) => (
                <tr {...rowProps("ip", x)} key={rs.keyOf(x.id)}>
                  <Td><CellInput value={text(x, "name")} placeholder="e.g. SEQ Concreting logo" className="font-semibold" onChange={(e) => edit("ip", x.id, { name: e.target.value })} /></Td>
                  <Td><CellSelect value={text(x, "ip_type")} placeholder="Choose" options={IP_TYPES.map((t) => ({ value: t.value, label: t.label }))}
                    onValueChange={(v) => edit("ip", x.id, { ip_type: v }, !!text(x, "name").trim() || !!rs.realId(x.id))} /></Td>
                  <Td><CellTextarea value={text(x, "description")} placeholder="e.g. Registered trade mark 2145678, class 37, renews 2031" onChange={(e) => edit("ip", x.id, { description: e.target.value })} /></Td>
                  <Td><RemoveButton onClick={() => askRemove("ip", x.id, text(x, "name"))} /></Td>
                </tr>
              ))}
            </tbody>
          </Grid>
          <Note>Prints under The Business in the plan, as &ldquo;Intellectual property&rdquo;. Recorded, not valued — nothing here changes a forecast figure.</Note>
        </>
      )}

      {kill && (
        <ConfirmDelete
          title={`Delete ${kill.name.trim() || "this row"}?`}
          what={<>It comes off this register{kill.kind === "social" ? "" : " and out of the plan"}.</>}
          onCancel={() => setKill(null)}
          onConfirm={() => remove(kill.kind, kill.id)}
        />
      )}
    </ModuleFrame>
  );
}

/** STATUS ONLY (§6.98) — a failed save travels on its own channel and is shown in red, not in this grey. */
function PendingBridge({ pending, dirty }: { pending: boolean; dirty: boolean }) {
  const { setPending, setNote } = useModule();
  useEffect(() => setPending(pending), [pending, setPending]);
  useEffect(() => setNote(pending ? "Saving…" : dirty ? "Unsaved — saves when you leave the field" : undefined), [pending, dirty, setNote]);
  return null;
}

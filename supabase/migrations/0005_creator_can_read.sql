-- 0005: the creator of an organisation or plan can always read it.
-- Why: INSERT ... RETURNING checks the new row against the SELECT policy before AFTER-INSERT triggers run,
-- so the membership rows added by on_org_created / on_plan_created are not yet visible. Without this, creating
-- an organisation or plan from the app fails with "new row violates row-level security policy".

drop policy "org read" on organisations;
create policy "org read" on organisations for select
  using (is_org_member(id) or created_by = auth.uid());

drop policy "plans read" on plans;
create policy "plans read" on plans for select
  using (can_read_plan(id) or created_by = auth.uid());

-- 0030: a plan can be put away, and it can be destroyed (§6.58).
--
-- Until now neither was possible anywhere in the app. A coach who mistyped a client's name was stuck with
-- that plan on the Welcome screen forever, and a finished FY2026 client sat beside this year's work with
-- nothing to tell them apart.
--
-- Archiving is its own fact, not a status. `plan_status` already has an 'archived' value, and using it
-- would have meant a completed plan losing the fact that it was complete the moment it was put away — one
-- field asked to answer two questions, which is the shape of every expensive fault in this project. So a
-- timestamp: null is on the shelf in front of you, a date is on the shelf behind. Status is untouched, and
-- restoring is setting it back to null.
--
-- Deleting needs no column. RLS already allows it for an org admin or advisor, and every plan_* table
-- cascades from plans(id), so the database removes the rest.
alter table plans add column if not exists archived_at timestamptz;
create index if not exists plans_archived_at_idx on plans (archived_at);

comment on column plans.archived_at is
  'When the plan was put away. Null means active. Kept apart from status so a complete plan is still complete after it is archived (§6.58).';

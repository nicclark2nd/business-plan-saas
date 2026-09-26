-- 0051: which What-If lever a goal came from (§6.134, open item 24).
--
-- Turning a What-If scenario into goals twice left both sets: SEQ's 90-day rung carries "debtor days 46 to
-- 42" beside "46 to 35", because `createGoalsFromScenario` inserted without looking for what it wrote last
-- time. It could not have looked — nothing on a goal said which lever made it, and matching on a title
-- that changes every time the lever moves is guessing.
--
-- So the goal carries its lever. Turning a scenario into goals again now UPDATES the open goal that lever
-- made last time and inserts only for a lever with none. A goal marked done is left alone: it is history,
-- and a new push on the same lever is a new goal.
--
-- Nullable and free text: hand-typed and AI goals have no lever, and the lever keys belong to the engine
-- (src/engine/whatif), not to a database enum that would need a migration every time a lever is added.
-- Existing What-If goals have no key and are not back-filled — which of SEQ's two debtor-day goals is the
-- "real" one is the client's call, not a migration's.
alter table public.plan_goals add column if not exists source_key text;

comment on column public.plan_goals.source_key is
  'For source = whatif: the What-If lever that proposed this goal (e.g. "debtorDays"). Lets a second "Turn into goals" update the open goal instead of adding a duplicate.';

create index if not exists plan_goals_source_key on public.plan_goals (plan_id, source_key) where source_key is not null;

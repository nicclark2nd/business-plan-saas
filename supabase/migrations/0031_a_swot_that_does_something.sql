-- 0031: a SWOT line can say what the business will DO about it (§6.59).
--
-- §6.14 closed this the other way — "no priority columns, no implication fields, no quadrant commentary; a
-- SWOT is a list" — and that was right about commentary. A response is not commentary. Four honest lists
-- with nothing attached is a page in a report; the same four lists with "the owner does all the estimating
-- → hire and train a second estimator by Q2" is a plan. The decision is reversed deliberately, not drifted
-- past.
--
-- One field, because one line deserves one answer. Several answers to one weakness is a set of GOALS, and
-- goals already exist with an owner, a quarter and a status — which is what the second column here is for.
alter table public.plan_swot_items add column if not exists response text;

comment on column public.plan_swot_items.response is
  'What the business will do about this line: build on it, fix it, take it, guard against it (§6.59). Null means nothing is planned yet, which the screen says out loud.';

-- `id` is already the primary key; this exists only to be the composite foreign key's target, the same
-- shape `plan_goals.owner_person_id` follows (§6.42).
do $$ begin
  alter table public.plan_swot_items add constraint plan_swot_items_id_plan_id_key unique (id, plan_id);
exception when duplicate_table then null; when duplicate_object then null;
end $$;

-- A goal can say which SWOT line it answers (§6.59.1).
--
-- Without this a response and a goal would be the same commitment written in two places, and two readings
-- of one plan is the fault this project keeps paying for. So the response is the intent, the goal is the
-- commitment, and the link is what lets the SWOT screen show which of its responses anybody is actually
-- accountable for.
--
-- Composite, so one plan's goal can never name another plan's SWOT line. `on delete set null` because a
-- goal that has become real work outlives the observation that prompted it.
alter table public.plan_goals add column if not exists swot_item_id uuid;

do $$ begin
  alter table public.plan_goals
    add constraint plan_goals_swot_item_fk
    foreign key (swot_item_id, plan_id) references public.plan_swot_items(id, plan_id) on delete set null;
exception when duplicate_object then null;
end $$;

create index if not exists plan_goals_swot_item_idx on public.plan_goals (swot_item_id);

comment on column public.plan_goals.swot_item_id is
  'The SWOT line this goal answers, if any (§6.59.1). Null for a goal that came from anywhere else.';

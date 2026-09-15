-- 0024 — a goal is owned by a person in the plan, not by a login (§6.42)
--
-- `plan_goals.owner_user_id` has been there since 0002 and points at `auth.users`. That is the wrong shape
-- for the question the screen actually asks. The people who own quarterly goals are the Leadership Team —
-- the office manager, the slab supervisor, the owner's brother who does the quoting — and most of them will
-- never have a login to this app. Asking "who owns this?" and offering only the one person in the room with
-- an account is not a choice.
--
-- So `owner_person_id` points at `plan_people`, which is where the plan already keeps its people, with their
-- names and positions and salaries. `owner_user_id` is left exactly as it is: when an advisor workspace
-- exists (§7.1) there will be a real second question — which LOGIN is accountable — and it can be answered
-- then without moving this one.
--
-- The foreign key is composite, matching the rule `parent_id` already follows: a goal's owner must be a
-- person in the SAME plan. A plain reference to `plan_people(id)` would let one plan's goal name another
-- plan's employee, which under multi-tenancy is a data leak and not merely a mistake.

-- `id` is already the primary key, so this is free; it exists only to be the composite key's target.
do $$ begin
  alter table public.plan_people add constraint plan_people_id_plan_id_key unique (id, plan_id);
exception when duplicate_table then null; when duplicate_object then null;
end $$;

alter table public.plan_goals
  add column if not exists owner_person_id uuid;

do $$ begin
  alter table public.plan_goals
    add constraint plan_goals_owner_person_fk
    foreign key (owner_person_id, plan_id) references public.plan_people(id, plan_id) on delete set null;
exception when duplicate_object then null;
end $$;

create index if not exists plan_goals_owner_person_idx on public.plan_goals (owner_person_id);

comment on column public.plan_goals.owner_person_id is
  'The person in the plan accountable for this goal (plan_people). Null means nobody has been named yet.';
comment on column public.plan_goals.owner_user_id is
  'Reserved for the advisor workspace: which LOGIN is accountable. The named person is owner_person_id.';

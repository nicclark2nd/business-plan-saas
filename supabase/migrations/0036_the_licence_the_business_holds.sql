-- 0036: the licences, registrations and insurances the BUSINESS holds (§6.64).
--
-- THE PLAN ALREADY ARGUES FROM A LICENCE IT HAS NO FIELD FOR. SWOT's own help text offers "the only QBCC
-- open licence in the postcode" as its example of a proper strength, and Marketing's barriers-to-entry
-- placeholder reads "e.g. QBCC open licence". So the app asks an owner to reason from a licence twice, in
-- two prose boxes, and has nowhere to record its number, its issuer or the date it runs out.
--
-- The only licences the plan could hold were a PERSON'S: plan_people_capabilities has a `licence` kind, and
-- that is the right home for an individual's ticket. A contractor licence is not that. It is held by the
-- entity, it is what the entity is allowed to do, and when it lapses the business stops trading whoever is
-- on the payroll. Filing it against a director would put the business's own permission to operate inside
-- one person's bio, and lose it the day that person leaves.
--
-- It lands beside the identity fields in Plan settings because that is the module that opens every report's
-- business overview — legal structure, years trading, and now what the business is licensed to do, which is
-- the order a lender reads them in.
create table if not exists public.plan_licences (
  id          uuid primary key default gen_random_uuid(),
  plan_id     uuid not null references plans(id) on delete cascade,
  name        text not null,                  -- "QBCC contractor licence — concreting", "Public liability insurance"
  number      text,                           -- the licence, registration or policy number
  issuer      text,                           -- "Queensland Building and Construction Commission", "CGU"
  -- Null is a real answer, not a blank: plenty of registrations never expire. It is a date rather than a
  -- month because a licence lapses on a day, and the day is the thing a lender checks.
  expires_on  date,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists plan_licences_plan_idx on public.plan_licences (plan_id);

do $$ begin
  create trigger plan_licences_updated before update on public.plan_licences
    for each row execute function set_updated_at();
exception when duplicate_object then null;
end $$;

do $$ begin
  perform apply_plan_rls('public.plan_licences'::regclass);
exception when duplicate_object then null;
end $$;

comment on table public.plan_licences is
  'What the BUSINESS is licensed, registered or insured to do (§6.64). A person''s own ticket stays in plan_people_capabilities.';

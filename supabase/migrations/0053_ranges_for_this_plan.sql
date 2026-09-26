-- 0053: capability ranges set for this plan (§6.140, open item 32).
--
-- Every band on Financial Capabilities is a general small-business range. The person who knows the
-- industry can now move the two lines on any plain measure — where "watch" starts, and where the good or
-- bad end starts — for this plan alone. Stored as only what was changed: { "operatingMargin": [8, 14], … }.
-- A measure with no entry keeps the general range, so improving a general range reaches every plan that
-- never overrode it. Null = nothing changed.
alter table public.plan_settings add column if not exists capability_ranges jsonb;

alter table public.plan_settings drop constraint if exists plan_settings_capability_ranges_object;
alter table public.plan_settings add constraint plan_settings_capability_ranges_object
  check (capability_ranges is null or jsonb_typeof(capability_ranges) = 'object');

comment on column public.plan_settings.capability_ranges is
  'Per-plan capability band lines (§6.140): { measureKey: [firstLine, secondLine] }, rising. Absent keys use the general range.';

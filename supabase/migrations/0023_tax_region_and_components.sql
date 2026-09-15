-- 0023 — where the business trades, and the taxes that follow from it (§6.39)
--
-- `tax_region`     The state or province. Only the United States and Canada need it, and for them it is
--                  not a detail: a Canadian plan's whole tax treatment depends on it (Ontario charges one
--                  reclaimable 13% HST; British Columbia charges 5% GST it claims back plus 7% PST it never
--                  does), and a US rate is a state rate plus whatever counties and cities add.
--
-- `tax_components` The taxes themselves: [{label, rate, reclaimable, frequency, lagMonths}]. A list, because
--                  a province can levy two at once on two different treatments. Empty means "use the
--                  country's ordinary regime", so an existing plan needs no backfill and a new one is
--                  correct before anybody opens Settings.
--
-- The older single-tax columns stay exactly as they are. `gst_registered` remains the on/off switch, and
-- `gst_rate` / `gst_frequency` remain the answer for a plan saved before this existed — read as a
-- one-component list. Nothing is migrated, nothing is dropped, and no plan changes until someone chooses.

alter table public.plan_settings
  add column if not exists tax_region     text,
  add column if not exists tax_components jsonb not null default '[]'::jsonb;

do $$ begin
  alter table public.plan_settings
    add constraint plan_settings_tax_components_is_array
    check (jsonb_typeof(tax_components) = 'array');
exception when duplicate_object then null;
end $$;

comment on column public.plan_settings.tax_region is
  'State or province. Decides the tax treatment in the United States and Canada; unused elsewhere.';
comment on column public.plan_settings.tax_components is
  'Taxes charged, each with its own rate, filing frequency, payment lag and whether it is reclaimable. Empty = the country default.';

-- 0022 — GST / VAT (§6.38)
--
-- A registered business collects tax on its sales, pays it on its purchases, and remits the difference
-- every BAS period. None of that touches the profit and loss — revenue and costs stay tax-exclusive — but
-- between collecting and remitting, the money sits in the bank looking exactly like cash, and then leaves
-- in one lump four times a year. A forecast that does not know this is wrong about cash in every month.
--
-- `gst_registered` defaults to FALSE, so every existing plan is untouched until someone turns it on.
--
-- The per-line flags exist because not everything is taxable, and getting that wrong is worse than
-- ignoring tax altogether: wages carry no GST, and claiming input credits on a payroll is a fiction that
-- would overstate cash by tens of thousands a year. Defaults are `true` for things normally taxable and the
-- client changes the exceptions — an export, a residential rent, a bank fee, a government charge.

alter table public.plan_settings
  add column if not exists gst_registered boolean       not null default false,
  add column if not exists gst_rate       numeric(6,3)  not null default 10,
  add column if not exists gst_frequency  text          not null default 'quarterly';

do $$ begin
  alter table public.plan_settings
    add constraint plan_settings_gst_frequency
    check (gst_frequency in ('monthly','quarterly','annually'));
exception when duplicate_object then null;
end $$;

alter table public.plan_products     add column if not exists gst_applies boolean not null default true;
alter table public.plan_fixed_cogs   add column if not exists gst_applies boolean not null default true;
alter table public.plan_overheads    add column if not exists gst_applies boolean not null default true;
alter table public.plan_fixed_assets add column if not exists gst_applies boolean not null default true;

comment on column public.plan_settings.gst_registered is
  'Whether the business is registered for GST/VAT. False leaves the forecast exactly as it was.';
comment on column public.plan_settings.gst_frequency is
  'How often the net tax is remitted: monthly, quarterly or annually.';
comment on column public.plan_products.gst_applies is
  'False for a GST-free or exempt sale — an export, basic food, a medical service.';
comment on column public.plan_overheads.gst_applies is
  'False where no tax is charged — wages, bank interest, most government charges.';

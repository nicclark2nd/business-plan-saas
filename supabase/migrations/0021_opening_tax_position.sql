-- 0021 — the tax position a business brings into the plan (§6.37)
--
-- Two facts the forecast now needs and had nowhere to read:
--
--   opening_tax_losses        Unrelieved losses carried in. Without them, a business that has been losing
--                             money and is now turning the corner is taxed from its first profitable year
--                             as though the losses never happened.
--   opening_retained_earnings Accumulated profits — or a deficit — already on the balance sheet. A dividend
--                             can only be paid out of accumulated profit, so without this a going concern
--                             is wrongly told it cannot pay one, and a company in deficit is wrongly told
--                             it can.
--
-- Both default to zero, which is the right answer for a startup and a stated assumption for anyone else.
-- Guarded so a re-run is a no-op.

alter table public.plan_settings
  add column if not exists opening_tax_losses        numeric(14,2) not null default 0,
  add column if not exists opening_retained_earnings numeric(14,2) not null default 0;

comment on column public.plan_settings.opening_tax_losses is
  'Unrelieved tax losses brought into the plan; relieved against the earliest taxable profit.';
comment on column public.plan_settings.opening_retained_earnings is
  'Accumulated profits (or deficit) at the plan start; a dividend cannot exceed what is distributable.';

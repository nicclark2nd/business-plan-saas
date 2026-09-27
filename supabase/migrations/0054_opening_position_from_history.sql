-- 0054 — The opening tax and profit position, read from Historic (§6.148).
--
-- share_capital on each Historic period: what the owners put in. Equity less this is the accumulated profit
--   the forecast's dividend test needs. Null means "not given" — the app then does not guess.
-- tax_losses_from_accountant on plan_settings: true when the client has put their accountant's figure in
--   place of the losses worked out from Historic. Anyone who had already typed a figure keeps it: their
--   row is marked as the accountant's, so nothing a client entered silently stops counting.

alter table public.plan_historic_periods
  add column if not exists share_capital numeric(14,2);

comment on column public.plan_historic_periods.share_capital is
  'What the owners put in (paid-up share capital, or owner capital). Equity less this is accumulated profit. Null = not given (§6.148).';

alter table public.plan_settings
  add column if not exists tax_losses_from_accountant boolean not null default false;

comment on column public.plan_settings.tax_losses_from_accountant is
  'True: opening_tax_losses is the accountant''s figure and is used as given. False: losses are worked out from Historic (§6.148).';

update public.plan_settings set tax_losses_from_accountant = true where opening_tax_losses > 0;

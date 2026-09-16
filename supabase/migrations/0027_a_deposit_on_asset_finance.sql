-- 0027 — what you put down, on finance that buys an asset (§6.52)
--
-- Equipment and vehicle finance almost never lends the whole price. DesignOne's own accounts show a 2,500
-- deposit on a 425,000 machine and 1,500 on a 15,000 one, and the plan had nowhere to put either: the asset
-- was priced at exactly what was borrowed, so the deposit vanished and the plan understated both the asset
-- and the cash that left the bank to get it.
--
-- One column, and the forecast needs no change at all to use it, because the two flows were already read
-- from two different places:
--
--     capex           = the ASSET's purchase price          (what the supplier was paid)
--     debt proceeds   = the LOAN's amount drawn             (what the lender advanced)
--     the difference  = the deposit, which is cash out of the business, in the month of purchase
--
-- The loan still owns both figures — the asset is synced from it, as a synced Overheads line is (§6.19) —
-- so there is one place to change the price of a financed thing and it is the finance that bought it.
--
-- Nil by default, which is exactly what every existing row means today: no deposit, financed in full.

alter table public.plan_funding_debt
  add column if not exists deposit numeric(14,2) not null default 0;

comment on column public.plan_funding_debt.deposit is
  'Paid up front out of the business''s own cash on finance that buys an asset. The asset is worth amount_drawn + deposit; the deposit is cash out in the month of purchase (§6.52). Nil on a loan that buys nothing.';

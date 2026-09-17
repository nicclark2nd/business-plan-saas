-- 0037: prepayments and accruals on the historic balance sheet (§6.66).
--
-- THE FORECAST CHARGED YEAR 1 FOR A BALANCE THAT ALREADY EXISTED. Prepayments and accruals at year end are
-- entered on the Assumptions screen as CLOSING balances, and the cash flow moves on the change in them:
--
--     dPrepaid = prepaid - priorPrepaid
--
-- `priorPrepaid` was hard-coded to 0 for Year 1 (engine/forecast/model.ts), because OpeningBalance had no
-- prepaid or accrued field and this table had no column to fill one from. Accounts receivable, inventory,
-- accounts payable, bank loans and tax payable all carry over from the last historic period. Prepayments
-- and accruals were the only two working-capital balances that did not.
--
-- So a business that has always paid its insurance a year ahead was shown paying that half-premium AGAIN in
-- Year 1, out of cash that in reality left the bank before the plan started; the accrual side did the
-- reverse and handed it money it did not have. And "the statements agree" stayed green throughout, because
-- the cash-flow bridge reconciles against the same wrong movement — the plan agreed with itself about the
-- wrong number.
--
-- This is the same fault as §6.32.4, where the opening bank loan was missing: a balance sheet is short by
-- exactly what you forget to put on it.
alter table public.plan_historic_periods
  add column if not exists prepayments numeric(14,2) default 0,
  add column if not exists accruals    numeric(14,2) default 0;

comment on column public.plan_historic_periods.prepayments is
  'Paid in advance and not yet used at period end — insurance, rent, registrations. Opens the forecast''s prepaid balance (§6.66).';
comment on column public.plan_historic_periods.accruals is
  'Incurred and not yet billed at period end. Opens the forecast''s accrued balance (§6.66).';

-- Both default to 0, so every existing period keeps the figures it already has and no plan changes until
-- somebody fills one in. On the TOTALS path they cost nothing to adopt: `other_current_assets` is derived as
-- the residual of total current assets, so naming a prepayment simply moves it out of "other" rather than
-- adding to it. On the COMPONENTS path a client who had buried a prepayment inside "Other current assets"
-- needs to take it out when they name it here, which is what the line's help text says on the screen.

-- 0038: a grant that is not assessable for tax (§6.74).
--
-- EVERY GRANT IN THE PLAN IS TAXED, AND PLENTY ARE NOT. Australian R&D and export grants, disaster and
-- drought relief, and a good many state programmes are non-assessable non-exempt income: they land in the
-- bank, they belong in the profit and loss as income, and the tax office does not want a cent of them.
--
-- The plan had no way to say so, so a client with a 100,000 relief grant was shown a tax bill on money that
-- carries none — overstating the charge and understating the cash in exactly the year a lender is reading.
--
-- `true` is the default because it is the safe answer: a grant assumed taxable and actually exempt
-- understates the client's cash, which is the error that disappoints nobody. The reverse writes a plan that
-- promises money the tax office is about to take.
alter table public.plan_funding_grants
  add column if not exists taxable boolean not null default true;

comment on column public.plan_funding_grants.taxable is
  'False for a grant that is non-assessable: income in the profit and loss, excluded from taxable profit (§6.74).';

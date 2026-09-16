-- 0028 — assets the business already owns (§6.55)
--
-- Fixed assets could only hold things bought INSIDE the plan. Everything a trading business already owned
-- was a single figure lifted from its Historic balance sheet, with no items behind it. Two consequences,
-- and the second is the expensive one:
--
--   1. A disposal can only name an asset in the list, so selling a lathe the business has had for years
--      had nowhere to point. The honest answer to "is this from selling something the business owns?" was
--      yes, and the only available answer was no — which books the whole proceeds as income, taxes it in
--      full, and puts it in operating cash instead of investing.
--
--   2. EXISTING PLANT NEVER DEPRECIATED. Run BNE Concreting's opening position through the engine and its
--      129,294 of gear sits flat across all five years contributing nil depreciation: profit and tax
--      overstated every year, and a concreting business whose plant never wears out.
--
-- So an asset can now say it was already owned. It carries what it is worth NOW rather than what it once
-- cost, and how long is left in it rather than its original life. It depreciates from Year 1, no cash moves
-- (that happened before the plan began), and it can be sold like any other.
--
-- It adds NOTHING to the balance sheet, because it is already in the opening figure Historic gave us. The
-- client itemises what they need and the rest stays as a lump the screen names out loud — the same bargain
-- §6.41.3 struck with working-capital days: show what the accounts imply, let them refine it, and say
-- plainly what has not been refined.

alter table public.plan_fixed_assets
  add column if not exists already_owned boolean not null default false;

comment on column public.plan_fixed_assets.already_owned is
  'True for something the business owned before the plan began (§6.55). Its purchase_price is what it is WORTH now, not what it cost; useful_life_months is what is LEFT of its life. No cash moves for it and it adds nothing to the balance sheet — it is already inside the opening fixed assets figure — but it depreciates from Year 1 and can be disposed of.';

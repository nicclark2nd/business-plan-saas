-- 0050: where a comparable multiple came from (§6.130).
--
-- WHY. 0048 asked the client for "Comparable deals, low" and "Comparable deals, high" and commented that the
-- figure is "a broker's or the accountant's, never the app's". Nic, reading the screen: most business owners
-- would not know either number, and if the app is going to ask for them, the AI should search for them from
-- the Business Profile and enter the values.
--
-- It can — but a range the app FOUND is a different kind of fact from a range the client TYPED, and the
-- Capability to sell tab weighs the price dial at 3. A plan capped at 49 on a number nobody can trace is
-- worse than no number. So the range keeps its sources and its date beside it, and says so wherever it
-- is shown.
--
-- ONE RANGE, ONE PROVENANCE. The sources describe the pair (low, high) as it was accepted. The moment the
-- client types over either end, the range is theirs and these two columns are cleared by the save — a
-- range that says "from 3 web sources" after the client changed it would be claiming a pedigree it lost.

alter table public.plan_settings add column if not exists multiple_sources jsonb;
alter table public.plan_settings add column if not exists multiple_found_on date;

-- Both or neither: sources with no date cannot say how stale they are, and a date with no sources is a
-- search that found nothing, which is never saved.
alter table public.plan_settings drop constraint if exists plan_settings_multiple_provenance;
alter table public.plan_settings add constraint plan_settings_multiple_provenance
  check ((multiple_sources is null) = (multiple_found_on is null)
     and (multiple_sources is null or jsonb_typeof(multiple_sources) = 'array'));

comment on column public.plan_settings.multiple_sources is
  'When the comparable range was accepted from a web search (§6.130): [{title, url, low, high}], EBITDA multiples only. Null = typed by the client, or never set.';
comment on column public.plan_settings.multiple_found_on is
  'The day the searched range was accepted. Null with multiple_sources.';
comment on column public.plan_settings.multiple_low is
  'The bottom of the range businesses like this one have changed hands for, as a multiple of normalised EBITDA. Typed by the client, or accepted from a sourced web search (see multiple_sources).';

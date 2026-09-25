-- 0045: a ceiling on drafting (§6.119)
--
-- `ai_calls` has existed since 0004 with a read policy and this comment above it:
--
--     -- inserts happen server-side with the service role only
--
-- That was the plan then and it is not the plan now. This app has NO service-role client, deliberately —
-- every query runs as the signed-in user and obeys RLS, which is the guarantee the security review turned
-- on. So the table nothing could write was also the table the rate limit needed, and the limit was never
-- built. §6.116 recorded it as the one open item that can cost money while nobody is looking.
--
-- An insert policy for the plan's own writers fixes that without a service role.

create policy "ai calls insert" on ai_calls for insert
  with check (
    plan_id is not null
    and can_write_plan(plan_id)
    and user_id = auth.uid()
  );

-- WHY IT IS SAFE TO LET A CLIENT WRITE THEIR OWN METER.
--
-- There is no update policy and no delete policy, and none is added here. A client can therefore only ever
-- ADD to their own count, never reduce it — the worst they can do to themselves is switch their own
-- drafting off early, which costs them a feature and costs the platform nothing. The row is pinned to
-- `auth.uid()` so nobody can spend another plan's allowance or blame their usage on someone else.
--
-- The index this counts on already exists: `create index on ai_calls (plan_id, created_at)` in 0004.

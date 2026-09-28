/**
 * ON HOLD (§6.186) — said where it matters: at the top of every screen, so nobody types into a form that
 * cannot save and wonders why. Everything can still be read; nothing can be changed until the hold is lifted.
 */
export function OnHoldBanner({ hold }: { hold: { since: string; reason: string | null } | null }) {
  if (!hold) return null;
  return (
    <div role="alert" className="border-b border-warn/40 bg-warn/10 px-5 py-2 text-[12.5px]">
      <b className="text-warn">This account is on hold.</b> You can read everything, but changes can&apos;t be saved and nothing new can be added.
      {hold.reason && <> Reason: {hold.reason}.</>} Contact BizPlanHQ to lift it.
    </div>
  );
}

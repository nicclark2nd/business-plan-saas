"use client";

import { cn } from "@/lib/utils";
import type { SaveError } from "./saveErrors";

/**
 * What did not save, said at the top of the area the client is working in (§6.98).
 *
 * It is STICKY, because these screens scroll and the whole fault being fixed here is a message the client
 * never scrolled to. It stays until the save succeeds. There is no dismiss button on purpose: a client who
 * dismisses this is a client who has lost data and agreed to forget about it.
 *
 * It lists every outstanding failure rather than the first, because `.find()` on an array of errors is how a
 * plan ends up with four broken rows and one visible explanation.
 */
export function SaveErrorBanner({ errors }: { errors: SaveError[] }) {
  if (errors.length === 0) return null;
  const many = errors.length > 1;
  return (
    <div role="alert" aria-live="assertive"
      className="sticky top-0 z-20 border-b border-bad/40 bg-bad-soft px-5 py-2.5">
      <div className="flex items-start gap-2.5">
        <span aria-hidden className="mt-[1px] grid size-4 shrink-0 place-items-center rounded-full bg-bad text-[11px] font-bold leading-none text-white">!</span>
        <div className="min-w-0">
          <div className="text-[13px] font-semibold text-bad">
            {many ? `${errors.length} changes didn't save` : "That didn't save"}
          </div>
          <ul className={cn("mt-0.5 space-y-0.5", !many && "mt-0")}>
            {errors.map((e) => (
              <li key={e.key} className="text-[12.5px] leading-[1.45] text-bad">
                {e.label && <span className="font-semibold">{e.label}: </span>}
                {e.message}
              </li>
            ))}
          </ul>
          {/* Said once, plainly: the figures on screen are not what is stored. */}
          <div className="mt-1 text-[11.5px] text-bad/80">
            What you typed is still on screen but is not saved. Fix the problem above and it will save itself.
          </div>
        </div>
      </div>
    </div>
  );
}

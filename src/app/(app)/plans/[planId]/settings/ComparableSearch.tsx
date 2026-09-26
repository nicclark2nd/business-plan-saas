"use client";

import { Button } from "@/components/ui/button";
import type { MultiplesReading, MultipleSource } from "@/engine/ai/multiples";

/**
 * WHAT SIMILAR BUSINESSES SOLD FOR (§6.130) — the button, the card and the record, under the two boxes.
 *
 * THREE STATES, AND THE SCREEN SAYS WHICH ONE IT IS IN.
 *
 * - **AI off:** the boxes stay and are explained, with the two places a real figure comes from. The dial
 *   waits grey until one is typed, which is what it did before (§6.89).
 * - **AI on:** a search, a card, and nothing saved until "Use this range" (§6.106.1). A range the plan's
 *   decisive dial rests on is not one to land unseen.
 * - **Accepted:** a line saying where it came from and when, with the sources one click away. Typing over
 *   either box makes the range the client's own, and the line goes (the save clears it on the server).
 */
const LINK = "font-medium text-primary underline-offset-2 hover:underline";
const x = (n: number) => `${n}×`;
const span = (lo: number, hi: number) => (lo === hi ? x(lo) : `${x(lo)} to ${x(hi)}`);
const day = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });

function Sources({ sources }: { sources: MultipleSource[] }) {
  return (
    <ul className="grid gap-1">
      {sources.map((s) => (
        <li key={s.url} className="flex items-baseline justify-between gap-4 text-[12px]">
          {/* A search result is somebody else's page: no referrer, no handle back to this one. */}
          <a href={s.url} target="_blank" rel="noopener noreferrer" className={`${LINK} min-w-0 truncate`} title={s.url}>{s.title}</a>
          <span className="num shrink-0 text-muted-foreground">{span(s.low, s.high)}</span>
        </li>
      ))}
    </ul>
  );
}

export function ComparableSearch({ aiOn, industry, country, found, search, busy, onSearch, onUse, onDismiss, onGo }: {
  aiOn: boolean;
  industry: string | null;
  country: string | null;
  found: { sources: MultipleSource[]; on: string } | null;
  search: "searching" | MultiplesReading | null;
  busy: boolean;
  onSearch: () => void;
  onUse: (r: Extract<MultiplesReading, { ok: true }>) => void;
  onDismiss: () => void;
  onGo: (area: "ai" | "profile") => void;
}) {
  const setAside = (n: number) => n > 0 && (
    <p className="text-[11.5px] text-muted-foreground">
      {n === 1 ? "One other figure was" : `${n} other figures were`} quoted on owner earnings (SDE) or on revenue.
      Those read lower than EBITDA for the same business, so they were left out rather than mixed in.
    </p>
  );

  if (!aiOn) {
    return (
      <p className="mt-3 max-w-[86ch] text-[12px] leading-relaxed text-muted-foreground">
        Not sure? A business broker or your accountant will know the range for your industry. Or{" "}
        <button type="button" className={LINK} onClick={() => onGo("ai")}>turn on AI</button> and the app can look up
        published sales for you, showing where each figure came from.
      </p>
    );
  }

  const ready = !!industry?.trim() && !!country?.trim();

  return (
    <div className="mt-3 grid max-w-[760px] gap-3">
      {found && !search && (
        <details className="text-[12px] text-muted-foreground">
          <summary className="cursor-pointer">
            Range from {found.sources.length} published sources, found {day(found.on)}. Type over it to use your own.
          </summary>
          <div className="mt-2"><Sources sources={found.sources} /></div>
        </details>
      )}

      {search === null && (
        ready ? (
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" size="sm" variant="outline" onClick={onSearch} disabled={busy}>
              {found ? "Search again" : "Find what similar businesses sold for"}
            </Button>
            <span className="text-[11.5px] text-muted-foreground">
              Searches published sales of <b className="text-foreground">{industry}</b> businesses in{" "}
              <b className="text-foreground">{country}</b>. Nothing is saved until you accept it.
            </span>
          </div>
        ) : (
          <p className="text-[12px] text-muted-foreground">
            To look up similar sales, set the industry and country on{" "}
            <button type="button" className={LINK} onClick={() => onGo("profile")}>Business Profile</button> first.
          </p>
        )
      )}

      {search === "searching" && (
        <p className="text-[12px] text-muted-foreground" role="status">
          Searching published sales of {industry} businesses in {country}. This can take up to half a minute.
        </p>
      )}

      {search && search !== "searching" && (
        <div className="grid gap-2.5 rounded-md border bg-card p-3.5" role="status">
          {search.ok ? (
            <>
              <p className="text-[13px]">
                Published sales of {industry} businesses in {country} put the range at{" "}
                <b className="num">{span(search.low, search.high)}</b> yearly earnings (EBITDA).
              </p>
              <Sources sources={search.sources} />
              {setAside(search.setAside)}
              <p className="text-[11.5px] text-muted-foreground">
                These are averages across many sales. Where this business sits in the range depends on how much of it
                runs without you, which is what a broker or accountant can judge.
              </p>
              <div className="flex gap-2">
                <Button type="button" size="sm" onClick={() => onUse(search)} disabled={busy}>Use this range</Button>
                <Button type="button" size="sm" variant="ghost" onClick={onDismiss}>Dismiss</Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-[12.5px]">{search.reason}</p>
              {setAside(search.setAside)}
              <div><Button type="button" size="sm" variant="ghost" onClick={onDismiss}>Dismiss</Button></div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

import { cn } from "@/lib/utils";

/** The "Your Planner" card (§6.183) — what a firm's client sees of the person who looks after their plan. */
export type PlannerCardData = { name: string; title: string | null; phone: string | null; email: string | null; photoUrl: string | null };

/**
 * ONE CARD, TWO PLACES (§6.187): in a client's plan (the dark sidebar) and as a preview on the Planner's own
 * My Profile (light), so what the Planner sees there is exactly what the client gets.
 */
export function PlannerCard({ planner, tone = "sidebar", className }: { planner: PlannerCardData; tone?: "sidebar" | "light"; className?: string }) {
  const dark = tone === "sidebar";
  const initials = planner.name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div className={cn("rounded-md border p-3 text-[12px]",
      dark ? "border-sidebar-border bg-sidebar-accent text-sidebar-foreground" : "border-border bg-background text-foreground", className)}>
      <div className={cn("text-[10.5px] font-bold uppercase tracking-[0.08em]", dark ? "text-sidebar-muted" : "text-muted-foreground")}>Your Planner</div>
      <div className="mt-2 flex items-center gap-2.5">
        {planner.photoUrl
          /* eslint-disable-next-line @next/next/no-img-element -- a short-lived signed URL; next/image would cache it past its life */
          ? <img src={planner.photoUrl} alt={planner.name} className="size-10 shrink-0 rounded-full object-cover" />
          : <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary text-[13px] font-bold text-primary-foreground">{initials}</span>}
        <div className="min-w-0">
          <div className="truncate font-semibold">{planner.name}</div>
          {planner.title && <div className={cn("truncate", dark ? "text-sidebar-muted" : "text-muted-foreground")}>{planner.title}</div>}
        </div>
      </div>
      {planner.phone && <a href={`tel:${planner.phone.replace(/[^\d+]/g, "")}`} className="mt-2 block truncate hover:underline">{planner.phone}</a>}
      {planner.email && <a href={`mailto:${planner.email}`} className={cn("block truncate hover:underline", !planner.phone && "mt-2")}>{planner.email}</a>}
    </div>
  );
}

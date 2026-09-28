"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/firm/clients", label: "My Clients", icon: "▦" },
  { href: "/firm/details", label: "My Firm", icon: "◧" },
  { href: "/firm/profile", label: "My Profile", icon: "◉" },
];

/** The consultant's own menu (§6.182) — three items today; Team, Billing and Site Admin join it as they are built. */
export function FirmNav() {
  const path = usePathname();
  return (
    <nav className="flex h-full flex-col border-r border-sidebar-border bg-sidebar pb-6 pt-3 text-sidebar-foreground">
      {ITEMS.map((it) => {
        const active = path === it.href || path.startsWith(it.href + "/");
        return (
          <Link key={it.href} href={it.href}
            className={cn("flex items-center gap-2.5 border-l-[3px] py-[9px] pl-[18px] pr-4 text-[13.5px] transition-colors hover:bg-sidebar-accent",
              active ? "border-sidebar-primary bg-sidebar-accent font-semibold text-sidebar-accent-foreground" : "border-transparent")}>
            <span className="w-[18px] text-center text-xs opacity-70">{it.icon}</span>{it.label}
          </Link>
        );
      })}
    </nav>
  );
}

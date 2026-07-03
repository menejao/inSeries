import Link from "next/link";
import { cn } from "@/lib/utils";

export type TabItem = { href: string; label: string };

/**
 * Route-driven pill navigation (each "tab" is a real page, not a JS panel
 * switch) — so semantically this is a nav landmark with `aria-current`,
 * not an ARIA `tablist`. Used for the /me/* sub-nav and, generically, for
 * any query-param view switcher (feed, calendar).
 */
export function Tabs({ items, active, label = "Secoes" }: { items: TabItem[]; active: string; label?: string }) {
  return (
    <nav aria-label={label} className="scrollbar-thin -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
      {items.map((item) => {
        const isActive = item.href === active;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "shrink-0 rounded-full px-4 py-2 text-sm font-medium transition",
              isActive ? "bg-primary text-primary-foreground" : "bg-surface-strong text-muted hover:text-ink"
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

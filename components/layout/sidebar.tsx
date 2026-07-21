"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn, isNavItemActive } from "@/lib/utils";
import {
  CalendarIcon,
  ChartIcon,
  CompassIcon,
  FilmIcon,
  LayoutDashboardIcon,
  ListIcon,
  PanelLeftIcon,
  ShieldIcon,
  SparklesIcon,
  TrophyIcon,
  TvIcon,
  type IconProps
} from "@/components/ui/icons";

type SidebarItem = { href: string; label: string; icon: (props: IconProps) => React.ReactElement };

/** Fase 5's suggested list, minus Perfil/Configuracoes — those live in the avatar dropdown now (Fase 6/10). */
const ITEMS: SidebarItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboardIcon },
  { href: "/calendar", label: "Calendario", icon: CalendarIcon },
  { href: "/series", label: "Catalogo", icon: TvIcon },
  { href: "/feed", label: "Feed", icon: FilmIcon },
  { href: "/recommendations", label: "Recomendacoes", icon: CompassIcon },
  { href: "/me/stats", label: "Estatisticas", icon: ChartIcon },
  { href: "/me/recap", label: "Recap", icon: SparklesIcon },
  { href: "/me/achievements", label: "Conquistas", icon: TrophyIcon },
  { href: "/lists", label: "Listas", icon: ListIcon }
];

const ADMIN_ITEM: SidebarItem = { href: "/admin", label: "Admin", icon: ShieldIcon };

const COLLAPSE_STORAGE_KEY = "inseries-sidebar-collapsed";

/** Fase 5/13 — fixed left on desktop (lg+), collapsible to icon-only, persisted. Never rendered for visitors (Fase 5). */
export function Sidebar({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_STORAGE_KEY) === "1");
    } catch {
      // Storage can be unavailable (private mode) — default to expanded.
    }
  }, []);

  function toggleCollapsed() {
    setCollapsed((previous) => {
      const next = !previous;
      try {
        localStorage.setItem(COLLAPSE_STORAGE_KEY, next ? "1" : "0");
      } catch {
        // Ignore — the collapse state just won't persist across visits.
      }
      return next;
    });
  }

  const items = isAdmin ? [...ITEMS, ADMIN_ITEM] : ITEMS;

  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-screen shrink-0 flex-col border-r border-border bg-surface/60 py-6 backdrop-blur-sm transition-[width] duration-200 lg:flex",
        collapsed ? "w-[4.5rem] px-2" : "w-64 px-3"
      )}
    >
      <Link href="/" className={cn("mb-6 flex items-center gap-3 px-2", collapsed && "justify-center px-0")}>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary text-base font-black text-primary-foreground">
          in
        </span>
        {!collapsed ? <span className="truncate text-base font-semibold leading-tight text-ink">inSeries</span> : null}
      </Link>

      <nav aria-label="Navegacao principal" className="flex-1 space-y-1 overflow-y-auto">
        {items.map((item) => {
          const isActive = isNavItemActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition",
                collapsed && "justify-center px-0",
                isActive ? "bg-primary/12 text-primary-text" : "text-muted hover:bg-surface-strong hover:text-ink"
              )}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {!collapsed ? <span className="truncate">{item.label}</span> : null}
            </Link>
          );
        })}
      </nav>

      <button
        type="button"
        onClick={toggleCollapsed}
        aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
        className={cn(
          "mt-2 flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium text-subtle transition hover:bg-surface-strong hover:text-ink",
          collapsed && "justify-center px-0"
        )}
      >
        <PanelLeftIcon className="h-5 w-5 shrink-0" />
        {!collapsed ? <span>Recolher menu</span> : null}
      </button>
    </aside>
  );
}

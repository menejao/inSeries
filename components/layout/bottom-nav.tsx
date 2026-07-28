"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { CalendarIcon, CompassIcon, FilmIcon, HomeIcon, ListIcon, PlayIcon, UserIcon } from "@/components/ui/icons";

function isItemActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Fase 11 — mobile's primary nav, mirrors the Sidebar's top items. Only ever rendered inside DashboardShell (authenticated). */
export function BottomNav({ username }: { username: string }) {
  const pathname = usePathname();
  const mobileNav = [
    { href: "/", label: "Home", icon: HomeIcon },
    { href: "/watch-next", label: "A seguir", icon: PlayIcon },
    { href: "/series", label: "Buscar", icon: CompassIcon },
    { href: "/calendar", label: "Calendario", icon: CalendarIcon },
    { href: "/feed", label: "Feed", icon: FilmIcon },
    { href: "/lists", label: "Listas", icon: ListIcon },
    { href: `/profile/${username}`, label: "Perfil", icon: UserIcon }
  ];

  return (
    <nav
      aria-label="Navegacao principal"
      className="safe-pb fixed inset-x-3 bottom-3 z-40 rounded-[2rem] border border-border bg-surface-strong/95 p-1.5 shadow-raised backdrop-blur-md lg:hidden"
    >
      <div className="grid grid-cols-7 gap-0.5 text-center">
        {mobileNav.map((item) => {
          const isActive = isItemActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-3xl px-1 py-2 transition active:scale-95",
                isActive ? "bg-primary/12 text-primary-text" : "text-muted active:bg-surface"
              )}
            >
              <item.icon className="h-5 w-5" />
              <span className="text-[10px] font-medium leading-none">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

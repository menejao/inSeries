import Link from "next/link";
import { CalendarIcon, CompassIcon, FilmIcon, HomeIcon, ListIcon, UserIcon } from "@/components/ui/icons";

/**
 * Fase 11 — mobile's primary nav, mirrors the Sidebar's top items. Only ever rendered inside
 * DashboardShell (authenticated). "A seguir" (/watch-next) removido
 * (INSERIES-PRODUCT-EXPERIENCE-REVOLUTION-01, Fase 2) — a mesma fila ja vive no Dashboard.
 */
export function BottomNav({ username }: { username: string }) {
  const mobileNav = [
    { href: "/", label: "Home", icon: HomeIcon },
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
      <div className="grid grid-cols-6 gap-0.5 text-center">
        {mobileNav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-3xl px-1 py-2 text-muted transition active:scale-95 active:bg-surface"
          >
            <item.icon className="h-5 w-5" />
            <span className="text-[10px] font-medium leading-none">{item.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}

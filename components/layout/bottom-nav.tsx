"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { Sheet } from "@/components/ui/sheet";
import {
  CalendarIcon,
  ChartIcon,
  CompassIcon,
  FilmIcon,
  HomeIcon,
  ListIcon,
  MoreHorizontalIcon,
  SparklesIcon,
  TrophyIcon,
  TvIcon,
  type IconProps
} from "@/components/ui/icons";
import { cn, isNavItemActive } from "@/lib/utils";

type NavItem = { href: string; label: string; icon: (props: IconProps) => React.ReactElement };

/**
 * Fase 3 (INSERIES-PRODUCT-EXPERIENCE-REVOLUTION-01) — "no maximo cinco destinos principais
 * ... Mais pode conter acoes secundarias". 4 primarios + "Mais" (Sheet com o resto da
 * Sidebar). "Perfil" saiu daqui: o avatar no DashboardHeader (sempre visivel, inclusive no
 * mobile) ja abre Perfil/Configuracoes/Sair — tinha 2 caminhos pro mesmo lugar.
 */
const PRIMARY_NAV: NavItem[] = [
  { href: "/", label: "Inicio", icon: HomeIcon },
  { href: "/me/minha-lista", label: "Acompanhar", icon: TvIcon },
  { href: "/calendar", label: "Calendario", icon: CalendarIcon },
  { href: "/series", label: "Series", icon: CompassIcon }
];

const MORE_NAV: NavItem[] = [
  { href: "/feed", label: "Feed", icon: FilmIcon },
  { href: "/lists", label: "Listas", icon: ListIcon },
  { href: "/recommendations", label: "Recomendacoes", icon: CompassIcon },
  { href: "/me/stats", label: "Estatisticas", icon: ChartIcon },
  { href: "/me/recap", label: "Recap", icon: SparklesIcon },
  { href: "/me/achievements", label: "Conquistas", icon: TrophyIcon }
];

export function BottomNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const isMoreActive = MORE_NAV.some((item) => isNavItemActive(pathname, item.href));

  return (
    <>
      <nav
        aria-label="Navegacao principal"
        className="safe-pb fixed inset-x-3 bottom-3 z-40 rounded-[2rem] border border-border bg-surface-strong/95 p-1.5 shadow-raised backdrop-blur-md lg:hidden"
      >
        <div className="grid grid-cols-5 gap-0.5 text-center">
          {PRIMARY_NAV.map((item) => {
            const isActive = isNavItemActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-3xl px-1 py-2 transition active:scale-95 active:bg-surface",
                  isActive ? "text-primary-text" : "text-muted"
                )}
              >
                <item.icon className="h-5 w-5" />
                <span className="text-[10px] font-medium leading-none">{item.label}</span>
              </Link>
            );
          })}
          <button
            type="button"
            aria-haspopup="dialog"
            aria-expanded={moreOpen}
            onClick={() => setMoreOpen(true)}
            className={cn(
              "flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-3xl px-1 py-2 transition active:scale-95 active:bg-surface",
              isMoreActive ? "text-primary-text" : "text-muted"
            )}
          >
            <MoreHorizontalIcon className="h-5 w-5" />
            <span className="text-[10px] font-medium leading-none">Mais</span>
          </button>
        </div>
      </nav>

      <Sheet open={moreOpen} onClose={() => setMoreOpen(false)} title="Mais opcoes">
        <div className="grid grid-cols-2 gap-3">
          {MORE_NAV.map((item) => {
            const isActive = isNavItemActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMoreOpen(false)}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex flex-col items-start gap-2 rounded-3xl border border-border p-4 transition",
                  isActive ? "border-primary/40 bg-primary/10 text-primary-text" : "text-ink hover:border-border-strong hover:bg-surface"
                )}
              >
                <item.icon className="h-5 w-5" />
                <span className="text-sm font-semibold">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </Sheet>
    </>
  );
}

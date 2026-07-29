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
  { href: "/me/minha-lista", label: "Minha Lista", icon: TvIcon },
  { href: "/calendar", label: "Calendario", icon: CalendarIcon },
  { href: "/series", label: "Series", icon: CompassIcon }
];

const MORE_NAV: NavItem[] = [
  { href: "/feed", label: "Feed", icon: FilmIcon },
  { href: "/lists", label: "Listas", icon: ListIcon },
  { href: "/recommendations", label: "Recomendacoes", icon: CompassIcon },
  { href: "/me/stats", label: "Estatisticas", icon: ChartIcon },
  { href: "/me/achievements", label: "Conquistas", icon: TrophyIcon }
];

// INSERIES-RECAP-ENGINE-01 — same "doesn't exist outside the window" rule as the Sidebar, kept
// out of MORE_NAV entirely and spliced in first only when available.
const RECAP_ITEM: NavItem = { href: "/recap", label: "Recap", icon: SparklesIcon };

export function BottomNav({ recapWrappedAvailable }: { recapWrappedAvailable: boolean }) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreItems = recapWrappedAvailable ? [RECAP_ITEM, ...MORE_NAV] : MORE_NAV;
  const isMoreActive = moreItems.some((item) => isNavItemActive(pathname, item.href));

  return (
    <>
      <nav
        aria-label="Navegacao principal"
        className="fixed inset-x-3 bottom-[calc(0.75rem_+_env(safe-area-inset-bottom))] z-40 rounded-[2rem] border border-border bg-surface-strong/95 p-1.5 shadow-raised backdrop-blur-md lg:hidden"
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
          {moreItems.map((item) => {
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
                <div className="flex w-full items-center justify-between">
                  <item.icon className="h-5 w-5" />
                  {item.href === "/recap" ? (
                    <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary-foreground">
                      Novo
                    </span>
                  ) : null}
                </div>
                <span className="text-sm font-semibold">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </Sheet>
    </>
  );
}

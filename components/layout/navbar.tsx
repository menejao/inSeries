import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/server";
import { cn } from "@/lib/utils";
import { CalendarIcon, CheckCircleIcon, FilmIcon, HomeIcon, ListIcon, PlayIcon, SettingsIcon, TvIcon, UserIcon } from "@/components/ui/icons";

export async function Navbar() {
  const user = await getCurrentUser();

  const desktopNav = [
    { href: "/", label: "Home", icon: HomeIcon },
    { href: "/watch-next", label: "Assistir a seguir", icon: PlayIcon },
    { href: "/series", label: "Series", icon: TvIcon },
    { href: "/feed", label: "Feed", icon: FilmIcon },
    { href: "/me", label: "Minha Area", icon: CheckCircleIcon },
    { href: "/calendar", label: "Calendario", icon: CalendarIcon },
    { href: "/lists", label: "Listas", icon: ListIcon },
    { href: user ? `/profile/${user.username}` : "/login", label: "Perfil", icon: UserIcon },
    { href: "/settings", label: "Configuracoes", icon: SettingsIcon }
  ];

  return (
    <nav aria-label="Navegacao principal" className="hidden rounded-full border border-border bg-surface/70 p-1.5 backdrop-blur-sm md:block">
      <div className="flex flex-wrap gap-1">
        {desktopNav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-medium text-muted transition hover:bg-surface-strong hover:text-ink"
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}

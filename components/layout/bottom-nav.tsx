import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/server";
import { CalendarIcon, CheckCircleIcon, CompassIcon, HomeIcon, ListIcon, PlayIcon, UserIcon } from "@/components/ui/icons";

export async function BottomNav() {
  const user = await getCurrentUser();

  const mobileNav = [
    { href: "/", label: "Home", icon: HomeIcon },
    { href: "/watch-next", label: "A seguir", icon: PlayIcon },
    { href: "/series", label: "Buscar", icon: CompassIcon },
    { href: "/me", label: "Minha Area", icon: CheckCircleIcon },
    { href: "/calendar", label: "Calendario", icon: CalendarIcon },
    { href: "/lists", label: "Listas", icon: ListIcon },
    { href: user ? `/profile/${user.username}` : "/login", label: "Perfil", icon: UserIcon }
  ];

  return (
    <nav
      aria-label="Navegacao principal"
      className="safe-pb fixed inset-x-3 bottom-3 z-40 rounded-[2rem] border border-border bg-surface-strong/95 p-1.5 shadow-raised backdrop-blur-md md:hidden"
    >
      <div className="grid grid-cols-7 gap-0.5 text-center">
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

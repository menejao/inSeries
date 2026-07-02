import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/server";
import { NotificationsNavLink } from "@/components/notifications/notifications-nav-link";

export async function Navbar() {
  const user = await getCurrentUser();
  const navLinkClassName = "rounded-full px-4 py-2 text-sm text-slate-200 transition hover:bg-white/5";

  const desktopNav = [
    { href: "/", label: "Home" },
    { href: "/series", label: "Series" },
    { href: "/feed", label: "Feed" },
    { href: "/me", label: "Minha Area" },
    { href: "/calendar", label: "Calendario" },
    { href: "/lists", label: "Listas" },
    { href: user ? `/profile/${user.username}` : "/login", label: "Perfil" },
    { href: "/settings", label: "Configuracoes" }
  ];

  return (
    <nav className="hidden rounded-full border border-white/10 bg-slate-950/55 p-2 md:block">
      <div className="flex flex-wrap gap-2">
        {desktopNav.map((item) => (
          <Link key={item.href} href={item.href} className={navLinkClassName}>
            {item.label}
          </Link>
        ))}
        <NotificationsNavLink className={navLinkClassName} />
      </div>
    </nav>
  );
}

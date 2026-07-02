import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/server";

export async function BottomNav() {
  const user = await getCurrentUser();

  const mobileNav = [
    { href: "/", label: "Home" },
    { href: "/series", label: "Buscar" },
    { href: "/me", label: "Minha Area" },
    { href: "/calendar", label: "Calendario" },
    { href: "/lists", label: "Listas" },
    { href: user ? `/profile/${user.username}` : "/login", label: "Perfil" }
  ];

  return (
    <nav className="safe-pb fixed inset-x-4 bottom-4 z-50 rounded-full border border-white/10 bg-slate-950/90 p-2 backdrop-blur md:hidden">
      <div className="grid grid-cols-6 gap-1 text-center">
        {mobileNav.map((item) => (
          <Link key={item.href} href={item.href} className="rounded-full px-2 py-3 text-xs text-slate-200">
            {item.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}

import Link from "next/link";

const mobileNav = [
  { href: "/", label: "Home" },
  { href: "/series", label: "Buscar" },
  { href: "/me", label: "Minha Area" },
  { href: "/lists", label: "Listas" },
  { href: "/profile/jbenedito", label: "Perfil" }
];

export function BottomNav() {
  return (
    <nav className="safe-pb fixed inset-x-4 bottom-4 z-50 rounded-full border border-white/10 bg-slate-950/90 p-2 backdrop-blur md:hidden">
      <div className="grid grid-cols-5 gap-1 text-center">
        {mobileNav.map((item) => (
          <Link key={item.href} href={item.href} className="rounded-full px-2 py-3 text-xs text-slate-200">
            {item.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}

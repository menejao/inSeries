import Link from "next/link";

const desktopNav = [
  { href: "/", label: "Home" },
  { href: "/series", label: "Series" },
  { href: "/me", label: "Minha Area" },
  { href: "/lists", label: "Listas" },
  { href: "/profile/jbenedito", label: "Perfil" },
  { href: "/settings", label: "Configuracoes" }
];

export function Navbar() {
  return (
    <nav className="hidden rounded-full border border-white/10 bg-slate-950/55 p-2 md:block">
      <div className="flex flex-wrap gap-2">
        {desktopNav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-full px-4 py-2 text-sm text-slate-200 transition hover:bg-white/5"
          >
            {item.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}

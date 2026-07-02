import type { PropsWithChildren } from "react";
import Link from "next/link";
import { requireAdminUser, hasPermission, type Permission } from "@/lib/admin/rbac";
import { Badge } from "@/components/ui/badge";

const NAV_ITEMS: { href: string; label: string; permission: Permission }[] = [
  { href: "/admin", label: "Dashboard", permission: "admin.read" },
  { href: "/admin/catalog", label: "Catalogo", permission: "admin.catalog" },
  { href: "/admin/sync", label: "Sincronizacoes", permission: "admin.sync" },
  { href: "/admin/users", label: "Usuarios", permission: "admin.users" },
  { href: "/admin/reviews", label: "Reviews", permission: "admin.reviews" },
  { href: "/admin/lists", label: "Listas", permission: "admin.lists" },
  { href: "/admin/system", label: "Sistema", permission: "admin.system" },
  { href: "/admin/logs", label: "Logs", permission: "admin.read" }
];

export default async function AdminLayout({ children }: PropsWithChildren) {
  const admin = await requireAdminUser();
  const visibleItems = NAV_ITEMS.filter((item) => hasPermission(admin.role, item.permission));

  return (
    <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
      <aside className="space-y-4">
        <div className="rounded-4xl border border-white/10 bg-slate-950/55 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Workspace</p>
          <p className="mt-1 text-sm font-semibold text-ink">{admin.name}</p>
          <Badge className="mt-2">{admin.role}</Badge>
        </div>
        <nav className="flex flex-col gap-1 rounded-4xl border border-white/10 bg-slate-950/55 p-3">
          {visibleItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-2xl px-3 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/5"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="space-y-6">{children}</div>
    </div>
  );
}

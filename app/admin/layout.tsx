import type { PropsWithChildren } from "react";
import Link from "next/link";
import { requireAdminUser, hasPermission, type Permission } from "@/lib/admin/rbac";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  CalendarIcon,
  CheckCircleIcon,
  FilmIcon,
  ListIcon,
  SettingsIcon,
  ShieldIcon,
  TvIcon,
  UserIcon
} from "@/components/ui/icons";

const NAV_ITEMS: { href: string; label: string; permission: Permission; icon: typeof TvIcon }[] = [
  { href: "/admin", label: "Dashboard", permission: "admin.read", icon: CheckCircleIcon },
  { href: "/admin/catalog", label: "Catalogo", permission: "admin.catalog", icon: TvIcon },
  { href: "/admin/sync", label: "Sincronizacoes", permission: "admin.sync", icon: CalendarIcon },
  { href: "/admin/users", label: "Usuarios", permission: "admin.users", icon: UserIcon },
  { href: "/admin/reviews", label: "Reviews", permission: "admin.reviews", icon: FilmIcon },
  { href: "/admin/lists", label: "Listas", permission: "admin.lists", icon: ListIcon },
  { href: "/admin/system", label: "Sistema", permission: "admin.system", icon: SettingsIcon },
  { href: "/admin/logs", label: "Logs", permission: "admin.read", icon: ShieldIcon }
];

export default async function AdminLayout({ children }: PropsWithChildren) {
  const admin = await requireAdminUser();
  const visibleItems = NAV_ITEMS.filter((item) => hasPermission(admin.role, item.permission));

  return (
    <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
      <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
        <Card padding="sm" className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/12 text-primary-text">
            <ShieldIcon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink">{admin.name}</p>
            <Badge variant="secondary" className="mt-1">
              {admin.role}
            </Badge>
          </div>
        </Card>
        <nav aria-label="Navegacao administrativa" className="flex gap-1 overflow-x-auto rounded-4xl border border-border bg-surface/70 p-2 lg:flex-col lg:overflow-visible">
          {visibleItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex shrink-0 items-center gap-2.5 rounded-2xl px-3 py-2.5 text-sm font-medium text-muted transition hover:bg-surface-strong hover:text-ink"
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="space-y-6">{children}</div>
    </div>
  );
}

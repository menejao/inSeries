import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/server";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { UserMenu } from "@/components/layout/user-menu";

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Administrador",
  MODERATOR: "Moderador"
};

/**
 * Fase 6 — minimalist: logo only shows where the Sidebar doesn't (below `lg`),
 * everything else lives on the right (notifications + avatar menu). Only ever
 * rendered inside DashboardShell, so a session is guaranteed here.
 */
export async function DashboardHeader() {
  const user = await getCurrentUser();
  if (!user) return null;

  return (
    <header className="safe-pt sticky top-0 z-30 flex items-center gap-4 border-b border-border/60 bg-canvas/80 px-4 py-3 backdrop-blur-sm sm:px-6 lg:px-8">
      <Link href="/" className="flex items-center gap-2 lg:hidden">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-sm font-black text-primary-foreground">in</span>
        <span className="text-base font-semibold text-ink">inSeries</span>
      </Link>
      <div className="ml-auto flex items-center gap-2">
        <NotificationBell />
        <UserMenu name={user.name} username={user.username} avatarUrl={user.avatarUrl} roleLabel={ROLE_LABELS[user.role]} />
      </div>
    </header>
  );
}

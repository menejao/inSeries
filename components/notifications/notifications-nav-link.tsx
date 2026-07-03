import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/server";
import { countUnreadNotifications } from "@/lib/notifications/service";
import { BellIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

export async function NotificationsNavLink({ className }: { className?: string }) {
  const user = await getCurrentUser();
  if (!user) return null;

  const unread = await countUnreadNotifications(user.id);

  return (
    <Link
      href="/notifications"
      aria-label={unread > 0 ? `Notificacoes, ${unread} nao lida(s)` : "Notificacoes"}
      className={cn(
        "relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-border text-muted transition hover:border-border-strong hover:text-ink",
        className
      )}
    >
      <BellIcon className="h-5 w-5" />
      {unread > 0 ? (
        <span
          aria-hidden="true"
          className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold leading-none text-primary-foreground"
        >
          {unread > 9 ? "9+" : unread}
        </span>
      ) : null}
    </Link>
  );
}

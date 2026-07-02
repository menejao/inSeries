import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/server";
import { countUnreadNotifications } from "@/lib/notifications/service";

export async function NotificationsNavLink({ className }: { className?: string }) {
  const user = await getCurrentUser();
  if (!user) return null;

  const unread = await countUnreadNotifications(user.id);

  return (
    <Link href="/notifications" className={className}>
      Notificacoes{unread > 0 ? ` (${unread})` : ""}
    </Link>
  );
}

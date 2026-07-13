import { getCurrentUser } from "@/lib/auth/server";
import { countUnreadNotifications } from "@/lib/notifications/service";
import { NotificationBellClient } from "@/components/notifications/notification-bell-client";

/**
 * Fase 7 (INSERIES-DASHBOARD-UX-AND-NAVIGATION-01) — o sino do Header vira o
 * unico centro de notificacoes do app (a pagina /notifications foi removida).
 */
export async function NotificationBell() {
  const user = await getCurrentUser();
  if (!user) return null;
  const unread = await countUnreadNotifications(user.id);
  return <NotificationBellClient initialUnread={unread} />;
}

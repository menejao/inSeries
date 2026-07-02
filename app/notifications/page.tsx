import { EmptyState } from "@/components/ui/empty-state";
import { MarkAllReadButton } from "@/components/notifications/mark-all-read-button";
import { NotificationItem } from "@/components/notifications/notification-item";
import { requireUser } from "@/lib/auth/server";
import { listNotifications } from "@/lib/notifications/service";

export default async function NotificationsPage() {
  const user = await requireUser();
  const notifications = await listNotifications(user.id, 50);
  const hasUnread = notifications.some((notification) => !notification.readAt);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Voce</p>
          <h1 className="section-title">Notificacoes</h1>
        </div>
        {hasUnread ? <MarkAllReadButton /> : null}
      </div>

      {notifications.length === 0 ? (
        <EmptyState title="Nenhuma notificacao ainda" copy="Voce sera avisado aqui sobre novos seguidores, reviews, listas e episodios." />
      ) : (
        <div className="space-y-3">
          {notifications.map((notification) => (
            <NotificationItem key={notification.id} notification={notification} />
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { IconButton } from "@/components/ui/button";
import { CheckIcon } from "@/components/ui/icons";
import { formatRelativeDate, getInitials } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { NotificationWithRelations } from "@/lib/notifications/service";

export function NotificationItem({ notification }: { notification: NotificationWithRelations }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const isRead = Boolean(notification.readAt);

  async function markRead() {
    setLoading(true);
    try {
      await fetch(`/api/notifications/${notification.id}/read`, { method: "POST" });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  const content = (
    <div className="min-w-0 flex-1 space-y-1">
      <div className="flex items-center gap-2">
        {!isRead ? <span className="h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden="true" /> : null}
        <p className="text-sm font-semibold text-ink">{notification.title}</p>
      </div>
      <p className="text-sm text-muted">{notification.body}</p>
      <p className="text-xs text-subtle">{formatRelativeDate(notification.createdAt)}</p>
    </div>
  );

  return (
    <Card className={cn("flex items-start gap-4", isRead && "opacity-70")}>
      {notification.actorUser ? (
        <Avatar
          label={getInitials(notification.actorUser.name)}
          name={notification.actorUser.name}
          src={notification.actorUser.avatarUrl}
          size="sm"
          className="shrink-0"
        />
      ) : null}
      {notification.href ? (
        <Link href={notification.href} className="min-w-0 flex-1">
          {content}
        </Link>
      ) : (
        content
      )}
      {!isRead ? (
        <IconButton label="Marcar como lida" variant="secondary" onClick={markRead} disabled={loading} className="shrink-0">
          <CheckIcon className="h-4 w-4" />
        </IconButton>
      ) : null}
    </Card>
  );
}

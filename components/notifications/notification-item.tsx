"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatRelativeDate, getInitials } from "@/lib/utils";
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
        <p className="text-sm font-semibold text-ink">{notification.title}</p>
        {!isRead ? <Badge>Nova</Badge> : null}
      </div>
      <p className="text-sm text-slate-300">{notification.body}</p>
      <p className="text-xs text-slate-400">{formatRelativeDate(notification.createdAt)}</p>
    </div>
  );

  return (
    <Card className={`flex items-start gap-4 ${isRead ? "opacity-70" : ""}`}>
      {notification.actorUser ? (
        <Avatar
          label={getInitials(notification.actorUser.name)}
          src={notification.actorUser.avatarUrl}
          className="h-11 w-11 shrink-0 text-sm"
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
        <Button variant="secondary" onClick={markRead} disabled={loading} className="shrink-0">
          {loading ? "..." : "Marcar como lida"}
        </Button>
      ) : null}
    </Card>
  );
}

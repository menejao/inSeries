"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { IconButton } from "@/components/ui/button";
import { BellIcon, CheckIcon } from "@/components/ui/icons";
import { formatRelativeDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

type NotificationItem = {
  id: string;
  title: string;
  body: string;
  href: string | null;
  readAt: string | null;
  createdAt: string;
  actorUser: { id: string; username: string; name: string | null; avatarUrl: string | null } | null;
};

function NotificationRow({ item, onMarkRead }: { item: NotificationItem; onMarkRead: (id: string) => void }) {
  const isUnread = !item.readAt;

  return (
    <div
      className={cn(
        "group flex items-start gap-3 rounded-2xl p-3 transition hover:bg-surface-strong/60",
        isUnread && "bg-primary/5"
      )}
    >
      <Link
        href={item.href ?? "#"}
        onClick={() => isUnread && onMarkRead(item.id)}
        className="flex flex-1 items-start gap-3"
      >
        {item.actorUser ? (
          <Avatar label={(item.actorUser.name ?? item.actorUser.username).slice(0, 2).toUpperCase()} src={item.actorUser.avatarUrl} size="sm" />
        ) : (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-surface-strong text-muted">
            <BellIcon className="h-4 w-4" />
          </span>
        )}
        <span className="min-w-0 flex-1 space-y-0.5">
          <span className="flex items-center gap-1.5">
            {isUnread ? <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" /> : null}
            <span className="line-clamp-1 text-sm font-semibold text-ink">{item.title}</span>
          </span>
          <span className="line-clamp-2 block text-xs text-muted">{item.body}</span>
          <span className="block text-[11px] text-subtle">{formatRelativeDate(new Date(item.createdAt))}</span>
        </span>
      </Link>
      {isUnread ? (
        <IconButton
          label="Marcar como lida"
          variant="ghost"
          size="sm"
          className="opacity-0 transition group-hover:opacity-100"
          onClick={() => onMarkRead(item.id)}
        >
          <CheckIcon className="h-3.5 w-3.5" />
        </IconButton>
      ) : null}
    </div>
  );
}

export function NotificationBellClient({ initialUnread }: { initialUnread: number }) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(initialUnread);
  const rootRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  async function load() {
    setStatus("loading");
    try {
      const response = await fetch("/api/notifications");
      if (!response.ok) throw new Error("failed");
      const json = await response.json();
      setItems(json.data.items);
      setUnread(json.data.unreadCount);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }

  useEffect(() => {
    if (open) void load();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handlePointer(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  async function markRead(id: string) {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, readAt: new Date().toISOString() } : item)));
    setUnread((current) => Math.max(0, current - 1));
    try {
      await fetch(`/api/notifications/${id}/read`, { method: "POST" });
      router.refresh();
    } catch {
      // rede falhou: badge/local state ja refletiram a intencao do usuario, proxima carga do dropdown resincroniza.
    }
  }

  async function markAllRead() {
    setItems((current) => current.map((item) => ({ ...item, readAt: item.readAt ?? new Date().toISOString() })));
    setUnread(0);
    try {
      await fetch("/api/notifications/read-all", { method: "POST" });
      router.refresh();
    } catch {
      // idem markRead: proxima abertura do dropdown resincroniza com o servidor.
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={unread > 0 ? `Notificacoes, ${unread} nao lida(s)` : "Notificacoes"}
        onClick={() => setOpen((current) => !current)}
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-border text-muted transition hover:border-border-strong hover:text-ink"
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
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-12 z-50 w-[22rem] max-w-[calc(100vw-2rem)] rounded-3xl border border-border bg-surface shadow-raised"
        >
          <div className="flex items-center justify-between gap-2 border-b border-border p-3">
            <p className="text-sm font-semibold text-ink">Notificacoes</p>
            {unread > 0 ? (
              <button type="button" onClick={() => void markAllRead()} className="text-xs font-medium text-primary-text hover:underline">
                Marcar todas como lidas
              </button>
            ) : null}
          </div>

          <div className="max-h-[26rem] overflow-y-auto p-2">
            {status === "loading" || status === "idle" ? (
              <div className="space-y-2 p-2">
                {[0, 1, 2].map((key) => (
                  <div key={key} className="h-14 animate-pulse rounded-2xl bg-surface-strong/60" />
                ))}
              </div>
            ) : status === "error" ? (
              <div className="p-4 text-center">
                <p className="mb-2 text-sm text-muted">Nao foi possivel carregar as notificacoes.</p>
                <button type="button" onClick={() => void load()} className="text-xs font-medium text-primary-text hover:underline">
                  Tentar novamente
                </button>
              </div>
            ) : items.length === 0 ? (
              <EmptyState icon={<BellIcon className="h-6 w-6" />} title="Nenhuma notificacao ainda" copy="Quando algo acontecer, voce vera aqui." />
            ) : (
              <div className="space-y-1">
                {items.map((item) => (
                  <NotificationRow key={item.id} item={item} onMarkRead={(id) => void markRead(id)} />
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

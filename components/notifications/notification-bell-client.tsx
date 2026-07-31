"use client";

import Link from "next/link";
import { createPortal } from "react-dom";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { IconButton } from "@/components/ui/button";
import { BellIcon, CheckIcon } from "@/components/ui/icons";
import { formatRelativeDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

const PANEL_WIDTH = 352; // 22rem
const VIEWPORT_MARGIN = 8;

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
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => setMounted(true), []);

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

  // INSERIES-SERIES-LIBRARY-ENGINE-01 — o painel era `absolute right-0` dentro do proprio
  // wrapper do sino: no mobile, ficava cortado/fora da tela (mesmo problema ja corrigido no
  // Dropdown compartilhado — ver components/ui/dropdown.tsx). Portal com `position: fixed`,
  // calculado a partir do rect do botao e sempre clampado a viewport, igual ao Dropdown.
  useLayoutEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const left = Math.max(VIEWPORT_MARGIN, Math.min(rect.right - PANEL_WIDTH, window.innerWidth - PANEL_WIDTH - VIEWPORT_MARGIN));
    setPosition({ top: rect.bottom + 8, left });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handlePointer(event: MouseEvent) {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    function handleClose() {
      setOpen(false);
    }
    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("keydown", handleKey);
    window.addEventListener("resize", handleClose);
    window.addEventListener("scroll", handleClose, true);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleKey);
      window.removeEventListener("resize", handleClose);
      window.removeEventListener("scroll", handleClose, true);
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
    <>
      <button
        ref={triggerRef}
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

      {mounted && open && position
        ? createPortal(
            <div
              ref={panelRef}
              role="menu"
              style={{ top: position.top, left: position.left, width: `min(${PANEL_WIDTH}px, calc(100vw - ${VIEWPORT_MARGIN * 2}px))` }}
              className="fixed z-50 animate-scale-in rounded-3xl border border-border bg-surface shadow-raised"
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
            </div>,
            document.body
          )
        : null}
    </>
  );
}

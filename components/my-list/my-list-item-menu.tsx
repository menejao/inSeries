"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Dropdown, DropdownItem, DropdownSeparator } from "@/components/ui/dropdown";
import { useToast } from "@/components/ui/toast";
import { MoreHorizontalIcon, TrashIcon, HeartIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { WATCH_STATE_ORDER, getWatchStateLabel } from "@/lib/progress/labels";
import type { MyListItem } from "@/lib/my-list/types";
import type { WatchState } from "@/lib/types";

export function MyListItemMenu({ item }: { item: MyListItem }) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [isFavorite, setIsFavorite] = useState(item.isFavorite);

  function changeStatus(state: WatchState) {
    startTransition(async () => {
      const response = await fetch(`/api/series/${item.series.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seriesId: item.series.id, state })
      });
      if (!response.ok) {
        toast({ title: "Erro ao mudar status", variant: "error" });
        return;
      }
      toast({ title: "Status atualizado", description: getWatchStateLabel(state), variant: "success" });
      router.refresh();
    });
  }

  function remove() {
    startTransition(async () => {
      const response = await fetch(`/api/series/${item.series.id}/status`, { method: "DELETE" });
      if (!response.ok) {
        toast({ title: "Erro ao remover da lista", variant: "error" });
        return;
      }
      toast({ title: "Removida da Minha Lista", description: item.series.title, variant: "success" });
      router.refresh();
    });
  }

  function toggleFavorite() {
    startTransition(async () => {
      const response = await fetch(`/api/series/${item.series.id}/favorite`, { method: "POST" });
      if (!response.ok) {
        toast({ title: "Erro ao atualizar favorito", variant: "error" });
        return;
      }
      const next = !isFavorite;
      setIsFavorite(next);
      toast({ title: next ? "Adicionada aos favoritos" : "Removida dos favoritos", description: item.series.title, variant: "success" });
      router.refresh();
    });
  }

  return (
    <Dropdown
      trigger={
        <button
          type="button"
          disabled={isPending}
          aria-label={`Acoes para ${item.series.title}`}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-canvas/80 text-ink backdrop-blur transition hover:bg-canvas disabled:opacity-50"
        >
          <MoreHorizontalIcon className="h-4 w-4" />
        </button>
      }
    >
      {WATCH_STATE_ORDER.filter((state) => state !== item.state).map((state) => (
        <DropdownItem key={state} onClick={() => changeStatus(state)}>
          {state === "COMPLETED" ? "Marcar como concluida" : `Mover para ${getWatchStateLabel(state).toLowerCase()}`}
        </DropdownItem>
      ))}
      <DropdownSeparator />
      <DropdownItem onClick={toggleFavorite} className={cn(isFavorite && "text-error-text")}>
        <HeartIcon className={cn("h-4 w-4 shrink-0", isFavorite && "fill-current")} />
        {isFavorite ? "Remover dos favoritos" : "Favoritar"}
      </DropdownItem>
      <DropdownSeparator />
      <DropdownItem onClick={remove} className="text-danger-text hover:bg-danger/10">
        <TrashIcon className="h-4 w-4" /> Remover da lista
      </DropdownItem>
    </Dropdown>
  );
}

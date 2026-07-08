"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { ListIcon } from "@/components/ui/icons";
import { useToast } from "@/components/ui/toast";

export type SeriesListOption = { id: string; title: string; containsSeries: boolean };

/**
 * Fase 2 (INSERIES-SERIES-PAGE-PREMIUM-01) — "Adicionar a Lista" reuses the exact same
 * `POST /api/lists/[id]/items` endpoint `ListItemManager` (components/social/list-item-
 * manager.tsx) already uses from inside a list's own page — same mutation, same business
 * rule, just triggered from a new place (the series Hero) instead of duplicating it.
 */
export function AddToListButton({ seriesId, lists, authenticated }: { seriesId: string; lists: SeriesListOption[]; authenticated: boolean }) {
  const router = useRouter();
  const { toast } = useToast();
  const availableLists = lists.filter((list) => !list.containsSeries);
  const [selectedListId, setSelectedListId] = useState(availableLists[0]?.id ?? "");
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  if (!authenticated) {
    return (
      <Button variant="secondary" size="md" disabled>
        <ListIcon className="h-4 w-4" />
        Adicionar a Lista
      </Button>
    );
  }

  if (!lists.length) {
    return (
      <Link href="/lists" className="inline-flex">
        <Button variant="secondary" size="md">
          <ListIcon className="h-4 w-4" />
          Criar sua primeira lista
        </Button>
      </Link>
    );
  }

  if (!open) {
    return (
      <Button variant="secondary" size="md" onClick={() => setOpen(true)} disabled={!availableLists.length}>
        <ListIcon className="h-4 w-4" />
        {availableLists.length ? "Adicionar a Lista" : "Ja esta em todas as listas"}
      </Button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={selectedListId} onChange={(event) => setSelectedListId(event.target.value)} aria-label="Escolher lista" className="w-auto">
        {availableLists.map((list) => (
          <option key={list.id} value={list.id}>
            {list.title}
          </option>
        ))}
      </Select>
      <Button
        variant="primary"
        size="md"
        disabled={isPending || !selectedListId}
        loading={isPending}
        onClick={() => {
          startTransition(async () => {
            const response = await fetch(`/api/lists/${selectedListId}/items`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ seriesId })
            });
            if (!response.ok) {
              toast({ title: "Erro ao adicionar a lista", variant: "error" });
              return;
            }
            toast({ title: "Adicionada a lista", variant: "success" });
            setOpen(false);
            router.refresh();
          });
        }}
      >
        Confirmar
      </Button>
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { WATCH_STATE_ORDER, getWatchStateLabel } from "@/lib/progress/labels";
import type { WatchState } from "@/lib/types";

/**
 * Fase 7 (INSERIES-MY-LISTS-PREMIUM-01) — acoes em lote sempre reaproveitando as mutations
 * existentes, uma chamada por serie selecionada em paralelo (mesmo padrao de "marcar
 * temporada inteira" da pagina da serie, INSERIES-SERIES-PAGE-PREMIUM-01): "mover status"/
 * "marcar concluidas" reaproveitam `POST /api/series/[id]/status`; "remover" reaproveita o
 * novo `DELETE` aditivo (Fase 7 desta sprint); "adicionar as listas" reaproveita
 * `POST /api/lists/[id]/items`, o mesmo endpoint do `AddToListButton`/`ListItemManager`.
 * "Favoritar" em lote nao foi implementado: a unica forma de favoritar hoje e uma review com
 * nota >= 4 (`reviewSchema` exige um `body` nao vazio) — criar reviews com texto falso so
 * para marcar favorito alteraria o significado de "review" e nao e uma boa pratica.
 */
export function MyListBulkBar({
  selectedIds,
  lists,
  onClear
}: {
  selectedIds: Set<string>;
  lists: Array<{ id: string; title: string }>;
  onClear: () => void;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [targetState, setTargetState] = useState<WatchState>("WATCHING");
  const [targetListId, setTargetListId] = useState(lists[0]?.id ?? "");

  if (selectedIds.size === 0) return null;

  const ids = [...selectedIds];

  function runBulk(label: string, action: (seriesId: string) => Promise<Response>) {
    startTransition(async () => {
      const results = await Promise.all(ids.map((id) => action(id)));
      if (results.some((response) => !response.ok)) {
        toast({ title: `Erro ao ${label}`, variant: "error" });
        return;
      }
      toast({ title: `${ids.length} serie(s): ${label}`, variant: "success" });
      onClear();
      router.refresh();
    });
  }

  function moveToStatus(state: WatchState) {
    runBulk(`movida(s) para ${getWatchStateLabel(state)}`, (seriesId) =>
      fetch(`/api/series/${seriesId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seriesId, state })
      })
    );
  }

  function remove() {
    runBulk("removida(s) da Minha Lista", (seriesId) => fetch(`/api/series/${seriesId}/status`, { method: "DELETE" }));
  }

  function addToList() {
    if (!targetListId) return;
    runBulk("adicionada(s) a lista", (seriesId) =>
      fetch(`/api/lists/${targetListId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seriesId })
      })
    );
  }

  return (
    <div className="sticky bottom-4 z-10 flex flex-wrap items-center gap-3 rounded-3xl border border-border-strong bg-surface-strong/95 p-4 shadow-raised backdrop-blur">
      <p className="text-sm font-semibold text-ink">{ids.length} selecionada(s)</p>

      <div className="flex items-center gap-2">
        <Select
          aria-label="Novo status para as series selecionadas"
          value={targetState}
          disabled={isPending}
          onChange={(event) => setTargetState(event.target.value as WatchState)}
          className="min-h-9 py-1"
        >
          {WATCH_STATE_ORDER.map((state) => (
            <option key={state} value={state}>
              {getWatchStateLabel(state)}
            </option>
          ))}
        </Select>
        <Button variant="secondary" size="sm" disabled={isPending} onClick={() => moveToStatus(targetState)}>
          Mover para status
        </Button>
      </div>

      <Button variant="secondary" size="sm" disabled={isPending} onClick={() => moveToStatus("COMPLETED")}>
        Marcar concluidas
      </Button>

      {lists.length ? (
        <div className="flex items-center gap-2">
          <Select
            aria-label="Lista de destino"
            value={targetListId}
            disabled={isPending}
            onChange={(event) => setTargetListId(event.target.value)}
            className="min-h-9 py-1"
          >
            {lists.map((list) => (
              <option key={list.id} value={list.id}>
                {list.title}
              </option>
            ))}
          </Select>
          <Button variant="secondary" size="sm" disabled={isPending} onClick={addToList}>
            Adicionar a lista
          </Button>
        </div>
      ) : null}

      <Button variant="danger" size="sm" disabled={isPending} onClick={remove}>
        Remover
      </Button>

      <Button variant="ghost" size="sm" disabled={isPending} onClick={onClear}>
        Cancelar selecao
      </Button>
    </div>
  );
}

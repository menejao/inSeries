"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, IconButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { ChevronDownIcon, TrashIcon } from "@/components/ui/icons";
import { useToast } from "@/components/ui/toast";

type ListItem = {
  id: string;
  seriesId: string;
  title: string;
};

export function ListItemManager({
  listId,
  items,
  seriesOptions
}: {
  listId: string;
  items: ListItem[];
  seriesOptions: Array<{ id: string; title: string }>;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [selectedSeries, setSelectedSeries] = useState(seriesOptions[0]?.id ?? "");
  const [isPending, startTransition] = useTransition();

  const availableOptions = seriesOptions.filter((option) => !items.some((item) => item.seriesId === option.id));

  return (
    <div className="space-y-4">
      {availableOptions.length ? (
        <Card>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Select value={selectedSeries} onChange={(event) => setSelectedSeries(event.target.value)} className="sm:flex-1" aria-label="Escolher serie para adicionar">
              {availableOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.title}
                </option>
              ))}
            </Select>
            <Button
              disabled={isPending || !selectedSeries}
              loading={isPending}
              onClick={() => {
                startTransition(async () => {
                  const response = await fetch(`/api/lists/${listId}/items`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ seriesId: selectedSeries })
                  });

                  const result = (await response.json().catch(() => ({}))) as { error?: string };

                  if (!response.ok) {
                    toast({ title: "Erro ao adicionar serie", description: result.error, variant: "error" });
                    return;
                  }

                  toast({ title: "Serie adicionada", variant: "success" });
                  router.refresh();
                });
              }}
            >
              Adicionar serie
            </Button>
          </div>
        </Card>
      ) : null}

      <div className="space-y-3">
        {items.length ? (
          items.map((item, index) => (
            <Card key={item.id} padding="sm" className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="font-medium text-ink">{item.title}</p>
              <div className="flex flex-wrap items-center gap-1">
                <IconButton
                  label="Mover para cima"
                  variant="secondary"
                  size="sm"
                  disabled={isPending || index === 0}
                  onClick={() => {
                    startTransition(async () => {
                      await fetch(`/api/lists/${listId}/items/${item.id}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ direction: "up" })
                      });
                      router.refresh();
                    });
                  }}
                >
                  <ChevronDownIcon className="h-4 w-4 rotate-180" />
                </IconButton>
                <IconButton
                  label="Mover para baixo"
                  variant="secondary"
                  size="sm"
                  disabled={isPending || index === items.length - 1}
                  onClick={() => {
                    startTransition(async () => {
                      await fetch(`/api/lists/${listId}/items/${item.id}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ direction: "down" })
                      });
                      router.refresh();
                    });
                  }}
                >
                  <ChevronDownIcon className="h-4 w-4" />
                </IconButton>
                <IconButton
                  label="Remover da lista"
                  variant="ghost"
                  size="sm"
                  disabled={isPending}
                  className="text-danger-text"
                  onClick={() => {
                    startTransition(async () => {
                      await fetch(`/api/lists/${listId}/items/${item.id}`, { method: "DELETE" });
                      toast({ title: "Serie removida da lista", variant: "success" });
                      router.refresh();
                    });
                  }}
                >
                  <TrashIcon className="h-4 w-4" />
                </IconButton>
              </div>
            </Card>
          ))
        ) : (
          <p className="text-sm text-muted">Nenhuma serie na lista ainda.</p>
        )}
      </div>
    </div>
  );
}

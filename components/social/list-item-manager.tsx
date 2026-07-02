"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";

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
  const [selectedSeries, setSelectedSeries] = useState(seriesOptions[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const availableOptions = seriesOptions.filter((option) => !items.some((item) => item.seriesId === option.id));

  return (
    <div className="space-y-4">
      {availableOptions.length ? (
        <Card>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Select value={selectedSeries} onChange={(event) => setSelectedSeries(event.target.value)} className="sm:flex-1">
              {availableOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.title}
                </option>
              ))}
            </Select>
            <Button
              disabled={isPending || !selectedSeries}
              onClick={() => {
                setError(null);
                startTransition(async () => {
                  const response = await fetch(`/api/lists/${listId}/items`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ seriesId: selectedSeries })
                  });

                  const result = (await response.json().catch(() => ({}))) as { error?: string };

                  if (!response.ok) {
                    setError(result.error ?? "request_failed");
                    return;
                  }

                  router.refresh();
                });
              }}
            >
              {isPending ? "Adicionando..." : "Adicionar serie"}
            </Button>
          </div>
          {error ? <p className="mt-2 text-sm text-rose-300">Erro: {error}</p> : null}
        </Card>
      ) : null}

      <div className="space-y-3">
        {items.length ? (
          items.map((item, index) => (
            <Card key={item.id} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="font-medium text-ink">{item.title}</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
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
                  Subir
                </Button>
                <Button
                  variant="secondary"
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
                  Descer
                </Button>
                <Button
                  variant="ghost"
                  disabled={isPending}
                  onClick={() => {
                    startTransition(async () => {
                      await fetch(`/api/lists/${listId}/items/${item.id}`, { method: "DELETE" });
                      router.refresh();
                    });
                  }}
                >
                  Remover
                </Button>
              </div>
            </Card>
          ))
        ) : (
          <p className="text-sm text-slate-300">Nenhuma serie na lista ainda.</p>
        )}
      </div>
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * INSERIES-SERIES-LIBRARY-ENGINE-01 — "ao marcar um episodio individualmente, escolher a data
 * que assisti": mesmo padrao de useMarkCompleted (Hoje / Escolher uma data), so que aplicado a
 * UM episodio via POST /api/episodes/[id]/progress com watchedAt opcional. A data escolhida e
 * o que alimenta o filtro por data de Minhas Series.
 */
export function useMarkEpisodeWatched(episodeId: string, onDone?: (watchedAt: string) => void) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [pickingDate, setPickingDate] = useState(false);
  const [customDate, setCustomDate] = useState(todayInputValue());
  const [isPending, startTransition] = useTransition();

  function requestMark() {
    setPickingDate(false);
    setCustomDate(todayInputValue());
    setOpen(true);
  }

  function submit(watchedAt: string) {
    startTransition(async () => {
      const response = await fetch(`/api/episodes/${episodeId}/progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ episodeId, watched: true, watchedAt })
      });
      if (!response.ok) {
        toast({ title: "Erro ao marcar episodio", variant: "error" });
        return;
      }
      setOpen(false);
      toast({ title: "Episodio marcado", variant: "success" });
      onDone?.(watchedAt);
      router.refresh();
    });
  }

  const dialog = (
    <Dialog open={open} onClose={() => setOpen(false)} title="Quando voce assistiu este episodio?">
      {pickingDate ? (
        <div className="space-y-3">
          <input
            type="date"
            value={customDate}
            max={todayInputValue()}
            onChange={(event) => setCustomDate(event.target.value)}
            className="w-full rounded-2xl border border-border bg-surface px-3 py-2 text-sm text-ink"
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setPickingDate(false)} disabled={isPending}>
              Voltar
            </Button>
            <Button variant="primary" onClick={() => submit(customDate)} loading={isPending}>
              Confirmar
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <Button variant="primary" onClick={() => submit(todayInputValue())} loading={isPending}>
            Hoje
          </Button>
          <Button variant="secondary" onClick={() => setPickingDate(true)} disabled={isPending}>
            Escolher uma data
          </Button>
        </div>
      )}
    </Dialog>
  );

  return { requestMark, dialog, isPending };
}

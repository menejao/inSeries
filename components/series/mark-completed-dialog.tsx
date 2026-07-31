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
 * INSERIES-SERIES-LIBRARY-ENGINE-01 — "Quando voce terminou esta serie? Hoje / Escolher uma
 * data": pergunta antes de marcar Concluida em qualquer tela (pagina da serie, menu de tres
 * pontos, Minhas Series), aplicando a data escolhida como `watchedAt` de todos os episodios
 * marcados automaticamente. Um unico hook, um unico dialogo — nenhuma tela pergunta de um
 * jeito diferente.
 */
export function useMarkCompleted(seriesId: string, onDone?: () => void) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [pickingDate, setPickingDate] = useState(false);
  const [customDate, setCustomDate] = useState(todayInputValue());
  const [isPending, startTransition] = useTransition();

  function requestComplete() {
    setPickingDate(false);
    setCustomDate(todayInputValue());
    setOpen(true);
  }

  function submit(completedAt: string) {
    startTransition(async () => {
      const response = await fetch(`/api/series/${seriesId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seriesId, state: "COMPLETED", completedAt })
      });
      if (!response.ok) {
        toast({ title: "Erro ao marcar como concluida", variant: "error" });
        return;
      }
      setOpen(false);
      toast({ title: "Serie concluida", description: "Todos os episodios disponiveis foram marcados.", variant: "success" });
      onDone?.();
      router.refresh();
    });
  }

  const dialog = (
    <Dialog open={open} onClose={() => setOpen(false)} title="Quando voce terminou esta serie?">
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

  return { requestComplete, dialog, isPending };
}

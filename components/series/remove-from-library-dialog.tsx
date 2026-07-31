"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";

/**
 * INSERIES-SERIES-LIBRARY-ENGINE-01 — "clicar novamente no status atual remove a serie" e
 * "remover... exibir confirmacao" precisam do MESMO fluxo em toda tela que muda status
 * (pagina da serie, menu de tres pontos do Catalogo/Recomendacoes, Minhas Series): um unico
 * hook, uma unica copia de texto, um unico DELETE /api/series/[id]/status — nenhuma tela
 * reimplementa a confirmacao com suas proprias palavras.
 */
export function useRemoveFromLibrary(seriesId: string, onRemoved?: () => void) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function requestRemove() {
    setOpen(true);
  }

  function confirmRemove() {
    startTransition(async () => {
      const response = await fetch(`/api/series/${seriesId}/status`, { method: "DELETE" });
      if (!response.ok) {
        toast({ title: "Erro ao remover da biblioteca", variant: "error" });
        return;
      }
      setOpen(false);
      toast({ title: "Removida da sua biblioteca", variant: "success" });
      onRemoved?.();
      router.refresh();
    });
  }

  const dialog = (
    <ConfirmDialog
      open={open}
      onClose={() => setOpen(false)}
      onConfirm={confirmRemove}
      title="Remover esta serie da sua biblioteca?"
      description="Todos os episodios serao desmarcados e ela deixara de fazer parte das suas estatisticas."
      confirmLabel="Remover"
      cancelLabel="Cancelar"
      confirmVariant="danger"
      loading={isPending}
    />
  );

  return { requestRemove, dialog, isPending };
}

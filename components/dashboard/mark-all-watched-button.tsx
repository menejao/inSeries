"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CheckCircleIcon } from "@/components/ui/icons";
import { useToast } from "@/components/ui/toast";

/**
 * Redesign completo do Dashboard (pedido do usuario: "super interativo... facilidade no dia
 * a dia") — acao em lote pra limpar Pendencias de uma vez, em vez de N cliques individuais.
 * Sempre atras de confirmacao: marcar varios episodios assistidos de uma vez e dificil de
 * desfazer e pode abranger series diferentes, entao nao e um clique casual como o de 1 item.
 * Reusa a mesma mutation de sempre (POST /api/episodes/[id]/progress), uma chamada por
 * episodio, em paralelo — nenhuma logica de progresso nova.
 */
export function MarkAllWatchedButton({
  episodeIds,
  count,
  scope = "todas as pendencias listadas de uma vez, mesmo as de series diferentes"
}: {
  episodeIds: string[];
  count: number;
  /** Fase 8 (INSERIES-DASHBOARD-OPERATIONAL-EXPERIENCE-04) — o mesmo botao/mutation e reusado
   *  no cabecalho geral (todas as series) e por grupo (uma serie so, AvailableNowGroupCard);
   *  a descricao do dialogo de confirmacao muda de acordo, pra nunca mencionar "series
   *  diferentes" quando na verdade e so uma. */
  scope?: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    startTransition(async () => {
      const results = await Promise.all(
        episodeIds.map((episodeId) =>
          fetch(`/api/episodes/${episodeId}/progress`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ episodeId, watched: true })
          })
        )
      );
      const failed = results.filter((response) => !response.ok).length;
      setOpen(false);
      if (failed > 0) {
        toast({ title: `${failed} de ${count} episodios nao puderam ser marcados`, variant: "error" });
      } else {
        toast({ title: `${count} episodios marcados como assistidos`, variant: "success" });
      }
      router.refresh();
    });
  }

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)} className="whitespace-nowrap">
        <CheckCircleIcon className="h-4 w-4" />
        Marcar todos
      </Button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={handleConfirm}
        title={`Marcar ${count} episodios como assistidos?`}
        description={`Isso vai marcar ${scope}.`}
        confirmLabel="Marcar todos"
        loading={isPending}
      />
    </>
  );
}

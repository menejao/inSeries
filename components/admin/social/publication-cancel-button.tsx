"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";

/**
 * INSERIES-INSTAGRAM-PUBLISHER-05 — cancelamento de uma publicacao ainda nao publicada.
 *
 * O motivo e obrigatorio e validado tambem no servidor (publish-service.cancelPublication) — este
 * dialogo apenas evita uma ida ao servidor obviamente invalida. Cancelar nunca apaga a linha: o
 * status vai para CANCELLED e o historico registra a transicao.
 */
export function PublicationCancelButton({ publicationId }: { publicationId: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [reason, setReason] = useState("");

  async function handleConfirm() {
    setLoading(true);

    try {
      const response = await fetch(`/api/admin/social/publications/${publicationId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason })
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        toast({ title: "Nao foi possivel cancelar", description: data.message ?? data.error, variant: "error" });
      } else {
        toast({ title: "Publicacao cancelada", variant: "success" });
        setOpen(false);
        router.refresh();
      }
    } catch {
      toast({ title: "Falha de rede", variant: "error" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button variant="ghost" size="xs" onClick={() => setOpen(true)}>
        Cancelar
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Cancelar publicacao"
        description="A publicacao nao sera enviada. Nada e apagado — o status passa a CANCELLED e fica no historico."
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={loading}>
              Voltar
            </Button>
            <Button type="button" variant="danger" onClick={handleConfirm} loading={loading} disabled={!reason.trim()}>
              Cancelar publicacao
            </Button>
          </>
        }
      >
        <label className="block text-sm font-medium text-ink" htmlFor={`cancel-reason-${publicationId}`}>
          Motivo do cancelamento
        </label>
        <Input
          id={`cancel-reason-${publicationId}`}
          className="mt-2"
          value={reason}
          placeholder="Ex.: conteudo desatualizado"
          onChange={(event) => setReason(event.target.value)}
        />
      </Dialog>
    </>
  );
}

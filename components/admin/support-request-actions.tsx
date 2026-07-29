"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";

/** Painel administrativo — Aprovar/Rejeitar uma SupportRequest AWAITING_REVIEW. Aprovacao ativa os beneficios automaticamente no backend; nada acontece no cliente alem de refletir o novo status. */
export function SupportRequestActions({ requestId }: { requestId: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [approving, setApproving] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  async function approve() {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/support-requests/${requestId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      });
      if (!response.ok) {
        toast({ title: "Erro ao aprovar solicitacao", variant: "error" });
        return;
      }
      toast({ title: "Apoio aprovado", description: "Beneficios ativados para o usuario.", variant: "success" });
      router.refresh();
    } finally {
      setLoading(false);
      setApproving(false);
    }
  }

  async function reject() {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/support-requests/${requestId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(notes.trim() ? { notes: notes.trim() } : {})
      });
      if (!response.ok) {
        toast({ title: "Erro ao rejeitar solicitacao", variant: "error" });
        return;
      }
      toast({ title: "Solicitacao rejeitada", variant: "success" });
      router.refresh();
    } finally {
      setLoading(false);
      setRejectOpen(false);
      setNotes("");
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button size="sm" variant="primary" onClick={() => setApproving(true)}>
        Aprovar
      </Button>
      <Button size="sm" variant="secondary" onClick={() => setRejectOpen(true)}>
        Rejeitar
      </Button>

      <ConfirmDialog
        open={approving}
        onClose={() => setApproving(false)}
        onConfirm={approve}
        title="Aprovar este apoio?"
        description="Os beneficios de Apoiador sao ativados automaticamente para o usuario por 30 dias."
        confirmLabel="Aprovar"
        loading={loading}
      />

      <Dialog
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        title="Rejeitar este apoio?"
        description="Nenhum beneficio sera ativado. O usuario recebe uma notificacao."
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => setRejectOpen(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button type="button" variant="danger" onClick={reject} loading={loading}>
              Rejeitar
            </Button>
          </>
        }
      >
        <Textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Motivo (opcional)"
          maxLength={500}
        />
      </Dialog>
    </div>
  );
}

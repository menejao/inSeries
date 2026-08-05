"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { CopyIcon } from "@/components/ui/icons";

/**
 * INSERIES-ADMIN-PASSWORD-RESET-01 — 2 passos: confirmar (acao irreversivel, invalida a senha
 * atual do usuario) e, so entao, mostrar a senha temporaria gerada — exibida exatamente uma
 * vez, nunca recuperavel depois (o backend so guarda o hash).
 */
export function ResetPasswordButton({ userId, username }: { userId: string; username: string }) {
  const { toast } = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function confirmReset() {
    startTransition(async () => {
      const response = await fetch(`/api/admin/users/${userId}/reset-password`, { method: "POST" });
      const result = (await response.json().catch(() => ({}))) as { data?: { tempPassword: string }; error?: string };
      setConfirmOpen(false);
      if (!response.ok || !result.data) {
        toast({ title: "Erro ao resetar senha", variant: "error" });
        return;
      }
      setTempPassword(result.data.tempPassword);
    });
  }

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setConfirmOpen(true)}>
        Resetar senha
      </Button>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={confirmReset}
        title={`Resetar a senha de @${username}?`}
        description="A senha atual deixa de funcionar imediatamente. Uma senha temporaria sera gerada e o usuario tera que criar uma nova senha no proximo login."
        confirmLabel="Resetar senha"
        confirmVariant="danger"
        loading={isPending}
      />

      <Dialog open={Boolean(tempPassword)} onClose={() => setTempPassword(null)} title="Senha temporaria gerada">
        <div className="space-y-3">
          <p className="text-sm text-muted">
            Envie esta senha para @{username} por um canal seguro. Ela so aparece agora — nao fica salva em nenhum lugar.
          </p>
          <div className="flex items-center gap-2 rounded-2xl border border-border bg-surface px-3 py-2">
            <code className="flex-1 font-mono text-sm text-ink">{tempPassword}</code>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (tempPassword) navigator.clipboard?.writeText(tempPassword);
                toast({ title: "Copiado", variant: "success" });
              }}
            >
              <CopyIcon className="h-4 w-4" />
              Copiar
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}

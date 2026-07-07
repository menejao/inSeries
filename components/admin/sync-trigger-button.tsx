"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";

export function SyncTriggerButton({
  type,
  label,
  confirmMessage
}: {
  type: "popular" | "existing" | "discovery";
  label: string;
  confirmMessage: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleConfirm() {
    setLoading(true);

    try {
      const response = await fetch(`/api/admin/sync/${type}`, { method: "POST" });
      const data = await response.json();

      if (!response.ok) {
        toast({ title: "Falha ao iniciar sincronizacao", description: data.error, variant: "error" });
      } else if (data.summary?.errorMessage) {
        toast({ title: "Sincronizacao concluida com aviso", description: data.summary.errorMessage, variant: "info" });
      } else {
        toast({ title: "Sincronizacao concluida", description: data.summary?.status, variant: "success" });
      }

      router.refresh();
    } catch {
      toast({ title: "Falha de rede ao iniciar sincronizacao", variant: "error" });
    } finally {
      setLoading(false);
      setOpen(false);
    }
  }

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        {label}
      </Button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={handleConfirm}
        title="Iniciar sincronizacao?"
        description={confirmMessage}
        confirmLabel="Sincronizar"
        loading={loading}
      />
    </>
  );
}

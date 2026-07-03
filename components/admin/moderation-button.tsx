"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";

export function ModerationButton({
  action,
  endpoint,
  confirmMessage
}: {
  action: "hide" | "restore";
  endpoint: string;
  confirmMessage: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleConfirm() {
    setLoading(true);
    try {
      const response = await fetch(endpoint, { method: "POST" });
      if (!response.ok) {
        toast({ title: "Erro ao processar acao", variant: "error" });
        return;
      }
      toast({ title: action === "hide" ? "Item ocultado" : "Item restaurado", variant: "success" });
      router.refresh();
    } finally {
      setLoading(false);
      setOpen(false);
    }
  }

  return (
    <>
      <Button size="sm" variant={action === "hide" ? "secondary" : "primary"} onClick={() => setOpen(true)}>
        {action === "hide" ? "Ocultar" : "Restaurar"}
      </Button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={handleConfirm}
        title={action === "hide" ? "Ocultar item?" : "Restaurar item?"}
        description={confirmMessage}
        confirmLabel={action === "hide" ? "Ocultar" : "Restaurar"}
        confirmVariant={action === "hide" ? "danger" : "primary"}
        loading={loading}
      />
    </>
  );
}

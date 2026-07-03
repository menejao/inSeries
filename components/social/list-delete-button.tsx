"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";

export function ListDeleteButton({ listId, redirectTo }: { listId: string; redirectTo?: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  return (
    <>
      <Button variant="danger" onClick={() => setOpen(true)}>
        Excluir lista
      </Button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        title="Excluir lista?"
        description="Essa acao nao pode ser desfeita."
        confirmLabel="Excluir"
        confirmVariant="danger"
        loading={isPending}
        onConfirm={() => {
          startTransition(async () => {
            const response = await fetch(`/api/lists/${listId}`, { method: "DELETE" });
            if (!response.ok) {
              const result = (await response.json().catch(() => ({}))) as { error?: string };
              toast({ title: "Erro ao excluir lista", description: result.error, variant: "error" });
              setOpen(false);
              return;
            }
            toast({ title: "Lista excluida", variant: "success" });
            if (redirectTo) {
              router.push(redirectTo);
            }
            router.refresh();
          });
        }}
      />
    </>
  );
}

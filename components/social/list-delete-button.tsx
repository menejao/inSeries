"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function ListDeleteButton({ listId, redirectTo }: { listId: string; redirectTo?: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <Button variant="secondary" onClick={() => setConfirming(true)}>
        Excluir lista
      </Button>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-slate-300">Confirmar exclusao da lista?</p>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          disabled={isPending}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const response = await fetch(`/api/lists/${listId}`, { method: "DELETE" });
              if (!response.ok) {
                const result = (await response.json().catch(() => ({}))) as { error?: string };
                setError(result.error ?? "request_failed");
                return;
              }
              if (redirectTo) {
                router.push(redirectTo);
              }
              router.refresh();
            });
          }}
        >
          {isPending ? "Excluindo..." : "Sim, excluir"}
        </Button>
        <Button variant="ghost" onClick={() => setConfirming(false)}>
          Cancelar
        </Button>
      </div>
      {error ? <p className="text-xs text-rose-300">Erro: {error}</p> : null}
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

const labels: Array<{ value: "WANT_TO_WATCH" | "WATCHING" | "PAUSED" | "DROPPED" | "COMPLETED"; label: string }> = [
  { value: "WANT_TO_WATCH", label: "Quero assistir" },
  { value: "WATCHING", label: "Assistindo" },
  { value: "PAUSED", label: "Pausada" },
  { value: "DROPPED", label: "Abandonada" },
  { value: "COMPLETED", label: "Concluida" }
];

export function SeriesStatusActions({
  seriesId,
  initialState,
  authenticated
}: {
  seriesId: string;
  initialState?: string | null;
  authenticated: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [state, setState] = useState(initialState ?? "");
  const [pendingValue, setPendingValue] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!authenticated) {
    return <p className="text-sm text-muted">Entre para salvar status e progresso.</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {labels.map((item) => (
        <Button
          key={item.value}
          size="md"
          variant={state === item.value ? "primary" : "secondary"}
          disabled={isPending}
          loading={isPending && pendingValue === item.value}
          onClick={() => {
            setPendingValue(item.value);
            startTransition(async () => {
              const response = await fetch(`/api/series/${seriesId}/status`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ seriesId, state: item.value })
              });
              if (!response.ok) {
                toast({ title: "Erro ao salvar status", variant: "error" });
                return;
              }
              setState(item.value);
              toast({ title: "Status atualizado", description: item.label, variant: "success" });
              router.refresh();
            });
          }}
        >
          {item.label}
        </Button>
      ))}
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

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
  const [state, setState] = useState(initialState ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!authenticated) {
    return <p className="text-sm text-slate-300">Entre para salvar status e progresso.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        {labels.map((item) => (
          <Button
            key={item.value}
            variant={state === item.value ? "primary" : "secondary"}
            disabled={isPending}
            onClick={() => {
              setMessage(null);
              startTransition(async () => {
                const response = await fetch(`/api/series/${seriesId}/status`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ seriesId, state: item.value })
                });
                if (!response.ok) {
                  setMessage("Erro ao salvar status.");
                  return;
                }
                setState(item.value);
                setMessage("Status salvo.");
                router.refresh();
              });
            }}
          >
            {isPending && state !== item.value ? "Salvando..." : item.label}
          </Button>
        ))}
      </div>
      {message ? <p className="text-sm text-slate-300">{message}</p> : null}
    </div>
  );
}

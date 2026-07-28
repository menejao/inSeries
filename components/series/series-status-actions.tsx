"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dropdown, DropdownItem } from "@/components/ui/dropdown";
import { CheckIcon, ChevronDownIcon } from "@/components/ui/icons";
import { useToast } from "@/components/ui/toast";
import { WATCH_STATE_ORDER, getWatchStateLabel } from "@/lib/progress/labels";

const labels = WATCH_STATE_ORDER.map((value) => ({ value, label: getWatchStateLabel(value) }));

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
  const [isPending, startTransition] = useTransition();

  if (!authenticated) {
    return <p className="text-sm text-muted">Entre para salvar status e progresso.</p>;
  }

  const currentLabel = labels.find((l) => l.value === state)?.label ?? "Adicionar ao perfil";

  return (
    <Dropdown
      trigger={
        <Button variant="primary" size="md" disabled={isPending} aria-label="Alterar status da serie">
          {currentLabel}
          <ChevronDownIcon className="h-4 w-4" />
        </Button>
      }
      align="start"
    >
      {labels.map((item) => (
        <DropdownItem
          key={item.value}
          disabled={isPending}
          className={state === item.value ? "font-semibold text-primary-text" : undefined}
          onClick={() => {
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
          {state === item.value ? (
            <CheckIcon className="h-4 w-4 shrink-0 text-primary-text" />
          ) : (
            <span className="h-4 w-4 shrink-0" aria-hidden />
          )}
          {item.label}
        </DropdownItem>
      ))}
    </Dropdown>
  );
}

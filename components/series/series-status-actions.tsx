"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dropdown, DropdownItem } from "@/components/ui/dropdown";
import { CheckIcon, ChevronDownIcon } from "@/components/ui/icons";
import { useToast } from "@/components/ui/toast";
import { WATCH_STATE_ORDER, getWatchStateLabel } from "@/lib/progress/labels";

const labels = WATCH_STATE_ORDER.map((value) => ({ value, label: getWatchStateLabel(value) }));

/**
 * Fase 13 (INSERIES-CATALOG-SERIES-EXPERIENCE-V2) — "manter apenas: Acompanhar, Lista,
 * Avaliar, Mais acoes (...)". A antiga linha de 5 botoes (um por estado, sempre visiveis)
 * virou 1 botao "Acompanhar" (ou o nome do estado atual) com um menu — mesma mutation, mesma
 * API, so a apresentacao mudou.
 */
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
    return (
      <Button size="md" variant="secondary" disabled>
        Acompanhar
      </Button>
    );
  }

  const currentLabel = labels.find((item) => item.value === state)?.label ?? "Acompanhar";

  function selectState(value: string) {
    startTransition(async () => {
      const response = await fetch(`/api/series/${seriesId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seriesId, state: value })
      });
      if (!response.ok) {
        toast({ title: "Erro ao salvar status", variant: "error" });
        return;
      }
      setState(value);
      const label = labels.find((item) => item.value === value)?.label ?? value;
      toast({ title: "Status atualizado", description: label, variant: "success" });
      router.refresh();
    });
  }

  return (
    <Dropdown
      align="start"
      trigger={
        <Button size="md" variant={state ? "primary" : "secondary"} loading={isPending}>
          {currentLabel}
          <ChevronDownIcon className="h-4 w-4" />
        </Button>
      }
    >
      {labels.map((item) => (
        <DropdownItem key={item.value} onClick={() => selectState(item.value)} disabled={isPending}>
          {item.label}
          {state === item.value ? <CheckIcon className="ml-auto h-4 w-4 text-primary-text" /> : null}
        </DropdownItem>
      ))}
    </Dropdown>
  );
}
